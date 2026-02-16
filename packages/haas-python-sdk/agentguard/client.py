"""
AgentGuard — HTTP/WebSocket Client

Communicates with the HaaS Core (Node.js) server to submit tool calls
and wait for human approval decisions.
"""

from __future__ import annotations

import asyncio
import logging
from typing import Any

import httpx

from agentguard.config import HaaSConfig
from agentguard.exceptions import (
    HaaSConnectionError,
    HaaSTimeoutError,
)
from agentguard.models import RiskTier, ToolCallResult

logger = logging.getLogger(__name__)


class HaaSClient:
    """Client for communicating with the HaaS Core governance server."""

    def __init__(self, config: HaaSConfig | None = None) -> None:
        self.config = config or HaaSConfig()
        self._http: httpx.AsyncClient | None = None

    async def _get_http(self) -> httpx.AsyncClient:
        if self._http is None or self._http.is_closed:
            self._http = httpx.AsyncClient(
                base_url=self.config.core_url,
                timeout=httpx.Timeout(
                    connect=10.0,
                    read=float(self.config.default_timeout_seconds),
                    write=10.0,
                    pool=10.0,
                ),
            )
        return self._http

    async def submit_tool_call(
        self,
        tool_name: str,
        tool_args: dict[str, Any],
        agent_id: str | None = None,
        risk_tier: RiskTier | None = None,
        trace_id: str = "",
    ) -> ToolCallResult:
        """
        Submit a tool call to the HaaS Core for governance.

        The Core will:
        1. Classify the risk tier
        2. If auto-approve (Tier 1), return immediately
        3. If human approval needed, broadcast RFA and wait
        4. Return the result (approved/rejected/timeout)
        """
        http = await self._get_http()

        payload = {
            "toolName": tool_name,
            "toolArgs": tool_args,
            "agentId": agent_id or self.config.agent_id,
            "traceId": trace_id,
        }
        if risk_tier:
            payload["riskTier"] = risk_tier.value

        try:
            response = await http.post(
                "/api/v1/governance/submit",
                json=payload,
            )
            response.raise_for_status()
            data = response.json()

            result = ToolCallResult(
                status=data["status"],
                request_id=data["requestId"],
                reason=data.get("reason"),
                wait_time_ms=data.get("waitTimeMs"),
            )

            return result

        except httpx.ConnectError as e:
            raise HaaSConnectionError(
                f"Cannot connect to HaaS Core at {self.config.core_url}: {e}"
            ) from e
        except httpx.ReadTimeout:
            raise HaaSTimeoutError(
                "Approval request timed out while waiting for human response",
                timeout_seconds=self.config.default_timeout_seconds,
            )

    async def poll_status(self, request_id: str) -> ToolCallResult:
        """Poll the status of a pending approval request."""
        http = await self._get_http()
        response = await http.get(f"/api/v1/governance/status/{request_id}")
        response.raise_for_status()
        data = response.json()

        return ToolCallResult(
            status=data["status"],
            request_id=data["requestId"],
            reason=data.get("reason"),
            wait_time_ms=data.get("waitTimeMs"),
        )

    async def wait_for_approval(
        self,
        request_id: str,
        timeout_seconds: int | None = None,
    ) -> ToolCallResult:
        """
        Poll-based wait for approval.
        Falls back to polling when WebSocket is unavailable.
        """
        timeout = timeout_seconds or self.config.default_timeout_seconds
        elapsed = 0.0
        interval = self.config.poll_interval_seconds

        while elapsed < timeout:
            result = await self.poll_status(request_id)

            if result.status in ("approved", "rejected", "timeout", "error"):
                return result

            await asyncio.sleep(interval)
            elapsed += interval

        raise HaaSTimeoutError(
            "Polling timed out waiting for human approval",
            request_id=request_id,
            timeout_seconds=timeout,
        )

    async def close(self) -> None:
        """Close the HTTP client connection."""
        if self._http and not self._http.is_closed:
            await self._http.aclose()
