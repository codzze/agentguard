"""
AgentGuard — SDK Configuration

Configuration for connecting the Python agent to the HaaS Core server.
"""

from __future__ import annotations

from pydantic import BaseModel, Field


class HaaSConfig(BaseModel):
    """Configuration for the AgentGuard Python SDK."""

    # Core server connection
    core_url: str = Field(
        default="http://localhost:3000",
        description="URL of the HaaS Core server (MCP proxy)",
    )

    # WebSocket endpoint for real-time updates
    ws_url: str = Field(
        default="ws://localhost:3000/ws",
        description="WebSocket URL for real-time approval updates",
    )

    # Agent identification
    agent_id: str = Field(
        default="default-agent",
        description="Unique identifier for this agent",
    )

    # Timeout settings
    default_timeout_seconds: int = Field(
        default=300,
        description="Default timeout for approval requests (seconds)",
    )

    # Polling configuration (used when WebSocket is unavailable)
    poll_interval_seconds: float = Field(
        default=2.0,
        description="Interval between polling requests when waiting for approval",
    )

    # Retry settings
    max_retries: int = Field(
        default=3,
        description="Maximum number of connection retries",
    )
    retry_delay_seconds: float = Field(
        default=1.0,
        description="Delay between connection retries (seconds)",
    )

    # OpenTelemetry
    enable_telemetry: bool = Field(
        default=True,
        description="Enable OpenTelemetry trace context propagation",
    )
    otel_service_name: str = Field(
        default="agentguard-python-sdk",
        description="OpenTelemetry service name",
    )
