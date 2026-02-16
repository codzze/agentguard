"""
AgentGuard Python SDK — Human-as-a-Service for AI Agents.

Provides the @haas_governed decorator and client for integrating
AI agents with the AgentGuard governance framework.
"""

from agentguard.decorator import governed
from agentguard.exceptions import HaaSApprovalDenied, HaaSTimeoutError, HaaSError
from agentguard.models import (
    RiskTier,
    ApprovalRequest,
    ApprovalResponse,
    ConsensusBundle,
    ToolCallResult,
)
from agentguard.config import HaaSConfig

__version__ = "1.0.0"
__all__ = [
    "governed",
    "HaaSApprovalDenied",
    "HaaSTimeoutError",
    "HaaSError",
    "RiskTier",
    "ApprovalRequest",
    "ApprovalResponse",
    "ConsensusBundle",
    "ToolCallResult",
    "HaaSConfig",
]
