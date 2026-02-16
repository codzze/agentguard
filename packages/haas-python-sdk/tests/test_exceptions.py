"""Tests for AgentGuard Python SDK exceptions."""
from agentguard.exceptions import (
    HaaSError,
    HaaSApprovalDenied,
    HaaSTimeoutError,
    HaaSConnectionError,
    HaaSConfigError,
)


class TestExceptions:
    def test_base_error(self):
        err = HaaSError("something failed")
        assert str(err) == "something failed"
        assert isinstance(err, Exception)

    def test_approval_denied(self):
        err = HaaSApprovalDenied(
            reason="Policy violation",
            pool="security",
        )
        assert err.reason == "Policy violation"
        assert err.pool == "security"
        assert "Policy violation" in str(err)

    def test_timeout_error(self):
        err = HaaSTimeoutError(timeout_seconds=300)
        assert err.timeout_seconds == 300
        assert "300" in str(err)

    def test_connection_error(self):
        err = HaaSConnectionError("Cannot reach core")
        assert isinstance(err, HaaSError)

    def test_config_error(self):
        err = HaaSConfigError("Missing core_url")
        assert isinstance(err, HaaSError)
