"""
AgentGuard — Custom Exceptions

These exceptions are raised by the @haas_governed decorator to signal
approval outcomes to the AI agent, enabling "Plan B" logic.
"""

from __future__ import annotations


class HaaSError(Exception):
    """Base exception for all AgentGuard errors."""

    def __init__(self, message: str, request_id: str | None = None) -> None:
        super().__init__(message)
        self.request_id = request_id


class HaaSApprovalDenied(HaaSError):
    """
    Raised when a human reviewer rejects the agent's tool call.

    The agent should handle this by triggering "Plan B" logic:
    - Retry with modified parameters
    - Alert an administrator
    - Log the denial and move to the next task
    """

    def __init__(
        self,
        message: str = "Action denied by human reviewer",
        request_id: str | None = None,
        reason: str | None = None,
        pool: str | None = None,
    ) -> None:
        super().__init__(message, request_id)
        self.reason = reason
        self.pool = pool

    def __str__(self) -> str:
        parts = [f"HaaSApprovalDenied: {self.args[0]}"]
        if self.reason:
            parts.append(f"Reason: {self.reason}")
        if self.pool:
            parts.append(f"Pool: {self.pool}")
        if self.request_id:
            parts.append(f"Request ID: {self.request_id}")
        return " | ".join(parts)


class HaaSTimeoutError(HaaSError):
    """
    Raised when no human responds within the configured TTL.

    The agent should handle this by:
    - Retrying the request
    - Notifying an admin about the unresponsive pool
    - Falling back to a safe default action
    """

    def __init__(
        self,
        message: str = "Approval request timed out",
        request_id: str | None = None,
        timeout_seconds: int | None = None,
    ) -> None:
        super().__init__(message, request_id)
        self.timeout_seconds = timeout_seconds

    def __str__(self) -> str:
        parts = [f"HaaSTimeoutError: {self.args[0]}"]
        if self.timeout_seconds:
            parts.append(f"Timeout: {self.timeout_seconds}s")
        if self.request_id:
            parts.append(f"Request ID: {self.request_id}")
        return " | ".join(parts)


class HaaSConnectionError(HaaSError):
    """Raised when the Python SDK cannot connect to the HaaS Core server."""

    pass


class HaaSConfigError(HaaSError):
    """Raised when the SDK configuration is invalid."""

    pass
