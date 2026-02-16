"""Tests for AgentGuard Python SDK models."""
from agentguard.models import (
    RiskTier,
    SeniorityLevel,
    Decision,
    ConsensusStatus,
    TrustRequirements,
    ApprovalRequest,
    ApprovalResponse,
    SignatureEntry,
    ConsensusBundle,
    ToolCallResult,
)


class TestEnums:
    def test_risk_tier_values(self):
        assert RiskTier.LOW == "LOW"
        assert RiskTier.MID == "MID"
        assert RiskTier.HIGH == "HIGH"
        assert RiskTier.CRITICAL == "CRITICAL"

    def test_seniority_level_values(self):
        assert SeniorityLevel.JUNIOR == "JUNIOR"
        assert SeniorityLevel.MID == "MID"
        assert SeniorityLevel.SENIOR == "SENIOR"
        assert SeniorityLevel.EXECUTIVE == "EXECUTIVE"

    def test_decision_values(self):
        assert Decision.APPROVE == "APPROVE"
        assert Decision.REJECT == "REJECT"

    def test_consensus_status_values(self):
        assert ConsensusStatus.PENDING == "PENDING"
        assert ConsensusStatus.REACHED == "REACHED"
        assert ConsensusStatus.FAILED == "FAILED"


class TestModels:
    def test_trust_requirements(self):
        req = TrustRequirements(seniority=SeniorityLevel.SENIOR, pools=["finance"])
        assert req.seniority == SeniorityLevel.SENIOR
        assert req.pools == ["finance"]

    def test_approval_request_minimal(self):
        request = ApprovalRequest(
            id="req-001",
            agent_id="agent-1",
            tool_name="transfer_funds",
            tool_args={"amount": 5000},
            risk_tier=RiskTier.HIGH,
            required_approvals=2,
            pools=["finance"],
            timestamp="2024-01-15T10:00:00Z",
            ttl_ms=300000,
        )
        assert request.id == "req-001"
        assert request.risk_tier == RiskTier.HIGH
        assert request.required_approvals == 2

    def test_approval_response(self):
        response = ApprovalResponse(
            request_id="req-001",
            approver_id="reviewer-1",
            pool="finance",
            decision=Decision.APPROVE,
            timestamp="2024-01-15T10:05:00Z",
        )
        assert response.decision == Decision.APPROVE
        assert response.reason is None

    def test_signature_entry(self):
        sig = SignatureEntry(
            approver_id="reviewer-1",
            pool="finance",
            decision=Decision.APPROVE,
            timestamp="2024-01-15T10:05:00Z",
        )
        assert sig.approver_id == "reviewer-1"

    def test_consensus_bundle(self):
        bundle = ConsensusBundle(
            request_id="req-001",
            status=ConsensusStatus.REACHED,
            signatures=[
                SignatureEntry(
                    approver_id="r1",
                    pool="finance",
                    decision=Decision.APPROVE,
                    timestamp="2024-01-15T10:05:00Z",
                ),
            ],
            reached_at="2024-01-15T10:05:00Z",
            total_required=1,
        )
        assert bundle.status == ConsensusStatus.REACHED
        assert len(bundle.signatures) == 1

    def test_tool_call_result(self):
        result = ToolCallResult(
            status="approved",
            request_id="req-001",
            reason="All approvals received",
            wait_time_ms=3000,
        )
        assert result.status == "approved"
        assert result.wait_time_ms == 3000
