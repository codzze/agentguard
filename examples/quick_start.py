"""
AgentGuard Python SDK — Quick Start Example
============================================

This example shows how to use the @governed decorator
to wrap AI agent tool calls with human approval gates.

Prerequisites:
  1. Start HaaS Core:  cd packages/haas-core && npm run dev
  2. Install SDK:      cd packages/haas-python-sdk && pip install -e .
  3. Run this script:  python examples/quick_start.py
"""

from agentguard import governed, configure
from agentguard.config import HaaSConfig

# ─── 1. Configure the SDK ─────────────────────────────────
configure(HaaSConfig(
    core_url="http://localhost:3100",
    agent_id="sales-agent-1",
    default_timeout_seconds=120,
))


# ─── 2. Define governed tool functions ─────────────────────

@governed(tier="LOW")
def read_customer_data(customer_id: str) -> dict:
    """LOW risk — auto-approved, no human needed."""
    return {"id": customer_id, "name": "Acme Corp", "tier": "enterprise"}


@governed(tier="MID", pool="general")
def update_customer_notes(customer_id: str, notes: str) -> dict:
    """MID risk — requires 1 human approval."""
    return {"id": customer_id, "notes": notes, "updated": True}


@governed(tier="HIGH", pool="finance", threshold=2)
def apply_discount(
    customer_id: str,
    percentage: float,
) -> dict:
    """HIGH risk — requires 2 approvals from finance pool."""
    return {
        "id": customer_id,
        "discount": percentage,
        "applied": True,
    }


@governed(
    tier="CRITICAL",
    pools=["finance", "security", "legal"],
    threshold=3,
    timeout_seconds=900,
)
def transfer_funds(
    from_account: str,
    to_account: str,
    amount: float,
) -> dict:
    """CRITICAL risk — requires 3 cross-pool approvals."""
    return {
        "from": from_account,
        "to": to_account,
        "amount": amount,
        "status": "completed",
    }


# ─── 3. Agent workflow ────────────────────────────────────

def main():
    print("=== AgentGuard Quick Start ===\n")

    # LOW → passes through immediately
    print("1. Reading customer data (LOW risk)...")
    data = read_customer_data("cust-001")
    print(f"   Result: {data}\n")

    # MID → waits for 1 human approval
    print("2. Updating notes (MID risk)...")
    print("   ⏳ Waiting for human approval...")
    try:
        result = update_customer_notes("cust-001", "VIP")
        print(f"   ✅ Approved: {result}\n")
    except Exception as e:
        print(f"   ❌ {e}\n")

    # HIGH → waits for 2 approvals from finance
    print("3. Applying 25% discount (HIGH risk)...")
    print("   ⏳ Waiting for 2 finance approvals...")
    try:
        result = apply_discount("cust-001", 25.0)
        print(f"   ✅ Approved: {result}\n")
    except Exception as e:
        print(f"   ❌ {e}\n")

    # CRITICAL → waits for 3 cross-pool approvals
    print("4. Transferring $50K (CRITICAL risk)...")
    print("   ⏳ Waiting for 3 cross-pool approvals...")
    try:
        result = transfer_funds("acc-001", "acc-002", 50000.0)
        print(f"   ✅ Approved: {result}\n")
    except Exception as e:
        print(f"   ❌ {e}\n")


if __name__ == "__main__":
    main()
