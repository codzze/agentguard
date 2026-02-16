"""Tests for AgentGuard Python SDK decorator."""
import asyncio
from agentguard.decorator import governed, configure
from agentguard.config import HaaSConfig


class TestGovernedDecorator:
    def test_configure_sets_global_config(self):
        config = HaaSConfig(
            core_url="http://localhost:3100",
            agent_id="test-agent",
        )
        configure(config)
        # Should not raise

    def test_governed_wraps_sync_function(self):
        @governed(tier="MID", pool="general")
        def my_tool(x: int, y: int) -> int:
            return x + y

        # The decorator should wrap the function
        assert callable(my_tool)

    def test_governed_wraps_async_function(self):
        @governed(tier="HIGH", pool="finance")
        async def my_async_tool(amount: float) -> str:
            return f"Transferred {amount}"

        assert asyncio.iscoroutinefunction(my_async_tool)

    def test_governed_with_multiple_pools(self):
        @governed(
            tier="CRITICAL",
            pools=["finance", "security", "legal"],
            threshold=3,
        )
        def critical_action() -> None:
            pass

        assert callable(critical_action)
