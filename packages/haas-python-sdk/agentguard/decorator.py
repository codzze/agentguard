"""
AgentGuard — @haas_governed Decorator

The primary interface for AI agents to integrate with AgentGuard.
Wraps Python functions to intercept critical tool calls and route
them through the HaaS governance pipeline.

Usage:
    from agentguard import governed, HaaSConfig

    config = HaaSConfig(core_url="http://localhost:3000")

    @governed(tier="critical", pool="finance", config=config)
    async def execute_wire_transfer(amount: float, recipient: str):
        # This code only runs if a human approves
        return banking_api.transfer(amount, recipient)
"""

from __future__ import annotations

import asyncio
import functools
import inspect
import logging
import time
from typing import Any, Callable, TypeVar

from agentguard.client import HaaSClient
from agentguard.config import HaaSConfig
from agentguard.exceptions import HaaSApprovalDenied, HaaSTimeoutError
from agentguard.models import RiskTier

logger = logging.getLogger(__name__)

F = TypeVar("F", bound=Callable[..., Any])

# Module-level default client (lazily initialized)
_default_client: HaaSClient | None = None
_default_config: HaaSConfig | None = None


def configure(config: HaaSConfig) -> None:
    """Set the global default HaaS configuration."""
    global _default_config, _default_client
    _default_config = config
    _default_client = HaaSClient(config)


def _get_client(config: HaaSConfig | None = None) -> HaaSClient:
    """Get or create the HaaS client."""
    global _default_client, _default_config
    if config:
        return HaaSClient(config)
    if _default_client is None:
        _default_config = _default_config or HaaSConfig()
        _default_client = HaaSClient(_default_config)
    return _default_client


def governed(
    tier: str = "mid",
    pool: str = "default",
    pools: list[str] | None = None,
    threshold: int | None = None,
    timeout_seconds: int | None = None,
    config: HaaSConfig | None = None,
) -> Callable[[F], F]:
    """
    Decorator that wraps a function with HaaS governance.

    When the decorated function is called, the decorator:
    1. Serializes the function name and arguments
    2. Sends the call to the HaaS Core for risk classification
    3. Waits for human approval (if required by the risk tier)
    4. Executes the function on approval, raises exception on rejection

    Args:
        tier: Risk tier hint ("low", "mid", "high", "critical").
              The Core may override based on its own classification.
        pool: Target approver pool (e.g., "finance", "security").
        pools: Multiple target pools (for cross-pool multi-sig).
        threshold: Number of required approvals (overrides policy default).
        timeout_seconds: Custom timeout for this specific call.
        config: Optional HaaSConfig (uses global default if not provided).

    Example:
        @governed(tier="critical", pool="finance")
        async def transfer_funds(amount: float, recipient: str):
            return await bank.transfer(amount, recipient)
    """

    # Map string tier to enum
    tier_map = {
        "low": RiskTier.LOW,
        "mid": RiskTier.MID,
        "high": RiskTier.HIGH,
        "critical": RiskTier.CRITICAL,
    }
    risk_tier = tier_map.get(tier.lower(), RiskTier.MID)
    effective_pools = pools or [pool]

    def decorator(func: F) -> F:
        is_async = inspect.iscoroutinefunction(func)

        @functools.wraps(func)
        async def async_wrapper(*args: Any, **kwargs: Any) -> Any:
            client = _get_client(config)
            tool_name = func.__qualname__

            # Serialize arguments
            sig = inspect.signature(func)
            bound = sig.bind(*args, **kwargs)
            bound.apply_defaults()
            tool_args = {k: _serialize(v) for k, v in bound.arguments.items()}

            logger.info(
                "HaaS: Submitting %s for governance (tier=%s, pools=%s)",
                tool_name,
                risk_tier.value,
                effective_pools,
            )

            start_time = time.monotonic()

            # Submit to HaaS Core
            result = await client.submit_tool_call(
                tool_name=tool_name,
                tool_args=tool_args,
                risk_tier=risk_tier,
            )

            elapsed_ms = int((time.monotonic() - start_time) * 1000)

            if result.status == "approved":
                logger.info(
                    "HaaS: %s APPROVED (wait=%dms)", tool_name, elapsed_ms
                )
                return await func(*args, **kwargs)

            elif result.status == "rejected":
                logger.warning(
                    "HaaS: %s REJECTED (reason=%s)", tool_name, result.reason
                )
                raise HaaSApprovalDenied(
                    message=f"Action '{tool_name}' was denied by human reviewer",
                    request_id=result.request_id,
                    reason=result.reason,
                )

            elif result.status == "timeout":
                logger.warning("HaaS: %s TIMEOUT", tool_name)
                raise HaaSTimeoutError(
                    message=f"Approval for '{tool_name}' timed out",
                    request_id=result.request_id,
                    timeout_seconds=timeout_seconds,
                )

            else:
                logger.error(
                    "HaaS: %s unexpected status: %s", tool_name, result.status
                )
                raise HaaSApprovalDenied(
                    message=f"Unexpected status for '{tool_name}': {result.status}",
                    request_id=result.request_id,
                )

        @functools.wraps(func)
        def sync_wrapper(*args: Any, **kwargs: Any) -> Any:
            return asyncio.run(async_wrapper(*args, **kwargs))

        if is_async:
            return async_wrapper  # type: ignore[return-value]
        else:
            return sync_wrapper  # type: ignore[return-value]

    return decorator


def _serialize(value: Any) -> Any:
    """Attempt to serialize a value for JSON transport."""
    if isinstance(value, (str, int, float, bool, type(None))):
        return value
    if isinstance(value, (list, tuple)):
        return [_serialize(v) for v in value]
    if isinstance(value, dict):
        return {str(k): _serialize(v) for k, v in value.items()}
    # Fallback to string representation
    return str(value)
