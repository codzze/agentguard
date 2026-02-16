"""
AgentGuard — OpenTelemetry Integration

Provides trace context propagation between the Python agent
and the HaaS Core (Node.js) server, ensuring end-to-end
audit trails across the governance pipeline.
"""

from __future__ import annotations

import logging
from typing import Any

from opentelemetry import trace
from opentelemetry.trace import StatusCode

logger = logging.getLogger(__name__)

# Global tracer instance
_tracer: trace.Tracer | None = None


def get_tracer() -> trace.Tracer:
    """Get or create the AgentGuard tracer."""
    global _tracer
    if _tracer is None:
        _tracer = trace.get_tracer("agentguard-python-sdk", "1.0.0")
    return _tracer


def start_governance_span(
    tool_name: str,
    tool_args: dict[str, Any],
    risk_tier: str,
    agent_id: str,
) -> trace.Span:
    """
    Start an OpenTelemetry span for a governance request.

    This span tracks the full lifecycle:
    tool_call → risk_classification → p2p_broadcast → human_decision → execution
    """
    tracer = get_tracer()
    span = tracer.start_span(
        name=f"haas.governance.{tool_name}",
        attributes={
            "haas.agent.id": agent_id,
            "haas.tool.name": tool_name,
            "haas.risk.tier": risk_tier,
        },
    )
    return span


def record_approval_event(
    span: trace.Span,
    decision: str,
    approver_id: str | None = None,
    provider: str | None = None,
    wait_time_ms: int | None = None,
) -> None:
    """Record an approval decision as a span event."""
    attributes: dict[str, Any] = {"haas.decision": decision}
    if approver_id:
        attributes["haas.approver.id"] = approver_id
    if provider:
        attributes["haas.auth.provider"] = provider
    if wait_time_ms is not None:
        attributes["haas.wait_time_ms"] = wait_time_ms

    span.add_event(f"haas.approval.{decision.lower()}", attributes=attributes)

    if decision == "APPROVED":
        span.set_status(StatusCode.OK)
    elif decision == "REJECTED":
        span.set_status(StatusCode.ERROR, "Approval denied by human reviewer")


def get_trace_context() -> dict[str, str]:
    """
    Extract the current trace context for propagation to HaaS Core.

    Returns a dict with traceparent and tracestate headers
    that can be sent in HTTP requests to the Core.
    """
    ctx: dict[str, str] = {}
    span = trace.get_current_span()
    if span and span.get_span_context().is_valid:
        sc = span.get_span_context()
        ctx["traceparent"] = (
            f"00-{format(sc.trace_id, '032x')}"
            f"-{format(sc.span_id, '016x')}-01"
        )
    return ctx
