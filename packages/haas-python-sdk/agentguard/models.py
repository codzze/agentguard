"""
AgentGuard — Pydantic Models (Shared Schema)

These models mirror the TypeScript types in @agentguard/shared-proto
to ensure protocol compatibility between the Python SDK and Node.js Core.
"""

from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Any

from pydantic import BaseModel, Field


class RiskTier(str, Enum):
    """Risk classification tiers for tool calls."""
    LOW = "LOW"
    MID = "MID"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"


class SeniorityLevel(str, Enum):
    """Seniority levels for trust requirements."""
    ASSOCIATE = "associate"
    SENIOR = "senior"
    LEAD = "lead"
    DIRECTOR = "director"
    VP = "vp"
    C_LEVEL = "c-level"


class Decision(str, Enum):
    """Human reviewer decision."""
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"


class ConsensusStatus(str, Enum):
    """Status of the consensus process."""
    CONSENSUS_REACHED = "CONSENSUS_REACHED"
    PARTIAL = "PARTIAL"
    DENIED = "DENIED"
    TIMEOUT = "TIMEOUT"


class RequestState(str, Enum):
    """State machine states for approval requests."""
    IDLE = "IDLE"
    PENDING = "PENDING"
    WAITING_FOR_HUMAN = "WAITING_FOR_HUMAN"
    PARTIAL_APPROVAL = "PARTIAL_APPROVAL"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"
    TIMEOUT = "TIMEOUT"
    ESCALATED = "ESCALATED"


# ---------------------------------------------------------------------------
# Trust & Identity
# ---------------------------------------------------------------------------

class TrustRequirements(BaseModel):
    """Requirements a human reviewer must meet to approve a request."""
    min_seniority: SeniorityLevel | None = None
    required_skills: list[str] = Field(default_factory=list)
    accepted_providers: list[str] = Field(default_factory=list)


class ApproverClaims(BaseModel):
    """Claims extracted from a verified identity proof."""
    name: str | None = None
    title: str | None = None
    org: str | None = None
    seniority: SeniorityLevel | None = None
    skills: list[str] = Field(default_factory=list)
    verified_at: datetime | None = None


class ApproverInfo(BaseModel):
    """Information about the human reviewer who signed an approval."""
    peer_id: str
    identity_hash: str
    provider: str
    claims: ApproverClaims | None = None
    pool: str | None = None


# ---------------------------------------------------------------------------
# Approval Request (RFA)
# ---------------------------------------------------------------------------

class AgentContext(BaseModel):
    """Context about the agent's reasoning and intent."""
    reasoning: str | None = None
    conversation_summary: str | None = None
    previous_actions: list[str] = Field(default_factory=list)


class ApprovalRequest(BaseModel):
    """Request for Approval (RFA) sent to the HaaS governance core."""
    id: str
    agent_id: str
    tool_name: str
    tool_args: dict[str, Any] = Field(default_factory=dict)
    risk_tier: RiskTier
    required_pools: list[str] = Field(default_factory=list)
    threshold: int = 1
    trust_requirements: TrustRequirements | None = None
    agent_context: AgentContext | None = None
    trace_id: str = ""
    span_id: str | None = None
    created_at: datetime = Field(default_factory=datetime.now)
    ttl: int = 300  # seconds
    callback_url: str | None = None


# ---------------------------------------------------------------------------
# Approval Response
# ---------------------------------------------------------------------------

class ApprovalResponse(BaseModel):
    """Response from a human reviewer."""
    request_id: str
    decision: Decision
    reason: str | None = None
    approver: ApproverInfo
    signature: str
    timestamp: datetime


# ---------------------------------------------------------------------------
# Consensus Bundle
# ---------------------------------------------------------------------------

class SignatureEntry(BaseModel):
    """A single signature in the consensus bundle."""
    pool: str
    approver_id: str
    signature: str
    identity_hash: str
    provider: str
    timestamp: datetime


class ConsensusBundle(BaseModel):
    """Final proof containing all collected signatures."""
    request_id: str
    status: ConsensusStatus
    threshold: int
    signatures: list[SignatureEntry] = Field(default_factory=list)
    combined_proof: str | None = None
    trace_id: str
    completed_at: datetime
    total_wait_time_ms: int | None = None


# ---------------------------------------------------------------------------
# Tool Call Result (returned to the Python agent)
# ---------------------------------------------------------------------------

class ToolCallResult(BaseModel):
    """Result of a governed tool call, returned to the AI agent."""
    status: str  # "approved" | "rejected" | "timeout" | "error"
    request_id: str
    proof: ConsensusBundle | None = None
    reason: str | None = None
    wait_time_ms: int | None = None
