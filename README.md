# AgentGuard — Human-as-a-Service (HaaS) for AI Agents

<p align="center">
  <strong>The Safety Switch for the Agentic Web</strong>
</p>

<p align="center">
  <em>Decentralized Human-in-the-Loop governance for AI Agents via MCP, LibP2P, and Pluggable Identity Providers</em>
</p>

---

## 🧠 What is AgentGuard?

AgentGuard is an open-source framework that acts as a **governance layer** between AI agents and the tools they use. When an agent attempts a high-risk action (deleting a database, transferring funds, modifying production configs), AgentGuard **pauses execution** and broadcasts a **Request for Approval (RFA)** to a decentralized network of verified human experts.

### Why?

As AI agents evolve from chatbots to autonomous actors with real-world tool access, enterprises need:

- **Auditability** — Who approved what, when, and why?
- **Expertise-based validation** — A finance action should be approved by a finance expert.
- **Decentralization** — No single point of failure in the approval chain.
- **Multi-sig consensus** — Critical actions require multiple independent approvals.

---

## 📺 Demo

> **Run the built-in demo:**
>
> ```bash
> ./deploy-mcp.sh demo
> ```
>
> This starts HaaS Core and triggers sample LOW/MID/HIGH/CRITICAL scenarios. Open the dashboard at `http://localhost:5173` to approve/reject requests.

---

## 🏗️ Architecture Overview

```
Python Agent → MCP Interceptor → Risk Classifier → P2P Broadcast → Human Pool → Identity Check → Approve/Reject → Resume/Abort Agent
```

| Component           | Technology                                     | Purpose                                              |
| ------------------- | ---------------------------------------------- | ---------------------------------------------------- |
| **Agent SDK**       | Python                                         | `@haas_governed` decorator for agent functions       |
| **Governance Core** | TypeScript/Node.js                             | Risk classification, state machine, consensus engine |
| **Transport**       | MCP                                            | Agent ↔ Interceptor communication                    |
| **P2P Network**     | LibP2P GossipSub                               | Decentralized approval broadcast                     |
| **Identity**        | Pluggable (LinkedIn, GitHub, OIDC, Okta, Web3) | Expert verification                                  |
| **Observability**   | OpenTelemetry                                  | Immutable audit trail                                |
| **Dashboard**       | React/Vite                                     | Enterprise reviewer UI                               |

---

## 📦 Packages

| Package                    | Description                                       | Language         |
| -------------------------- | ------------------------------------------------- | ---------------- |
| `@agentguard/core`         | Governance interceptor, risk classifier, P2P node | TypeScript       |
| `@agentguard/dashboard`    | Expert reviewer web application                   | React/TypeScript |
| `@agentguard/shared-proto` | Shared schemas and protocol definitions           | TypeScript       |
| `agentguard` (PyPI)        | Python SDK for AI agent integration               | Python           |

---

## 🚀 Quick Start

### For AI Agent Developers (Python)

```python
from agentguard import haas

@haas.governed(tier="critical", pool="finance")
async def execute_wire_transfer(amount: float, recipient: str):
    # This code only runs if a human approves
    return banking_api.transfer(amount, recipient)
```

### 🚦 Defining Policy Logic (policies.yaml)

Define exactly _who_ approves _what_. Route risks intelligently based on content:

```yaml
policies:
  # Route database risks to the DBA team
  - tool: "drop_table"
    tier: CRITICAL
    pools: ["dba-team", "engineering-leads"]
    threshold: 2 # Requires 2 approvals

  # Route budget risks to the CFO
  - tool: "approve_budget"
    tier: HIGH
    pools: ["finance-exec"]
    conditions:
      - field: "amount"
        operator: ">"
        value: 5000
```

### For Governance Admins (Node.js)

```typescript
import { HaaSCore } from "@agentguard/core";

const core = new HaaSCore({
  policies: "./policies.yaml",
  redis: "redis://localhost:6379",
  identity: ["linkedin", "github", "oidc"],
  telemetry: { endpoint: "http://otel-collector:4318" },
});

await core.start();
```

---

## 🔴 Risk Classification

| Tier | Level    | Example           | Approval                 |
| ---- | -------- | ----------------- | ------------------------ |
| 1    | Low      | Read file         | Auto-approve (logged)    |
| 2    | Mid      | Send email        | Single-sig               |
| 3    | High     | DB write, $1K+    | Multi-sig (2/3)          |
| 4    | Critical | Prod delete, $1M+ | Cross-pool executive-sig |

---

## 🔐 Pluggable Identity Providers

AgentGuard doesn't lock you into a single auth provider. Implement `IIdentityProvider` to add your own:

- ✅ LinkedIn Verified ID
- ✅ Microsoft Entra / Azure AD
- ✅ GitHub Organization Membership
- ✅ Okta / OIDC / SAML
- ✅ Custom Web3 / Wallet Signatures
- ✅ PGP / GPG Key Verification

---

## 📊 OpenTelemetry Audit Trail

Every governance decision is traced end-to-end, making your agents **SOX-compliant** and **Audit-ready** out of the box.

```
Trace: "HaaS Governance"
├── Span: "Tool Call" (agent.id, tool.name, risk.tier)
├── Span: "P2P Broadcast" (pools, threshold)
├── Span: "Human Validation"
│   ├── Event: "identity_verified" (provider: linkedin)
│   └── Event: "signature_submitted" (pool: finance)
└── Span: "Consensus" (decision: APPROVED, wait_time: 45s)
```

---

## 🤝 Contributing

See [CONTRIBUTING.md](.github/CONTRIBUTING.md) for guidelines.

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Commit using conventional commits: `git commit -m "feat: add okta provider"`
4. Push and open a Pull Request

---

## 📄 License

MIT — See [LICENSE](LICENSE) for details.

---

## 📚 Documentation

- [Architecture Reference](docs/ARCHITECTURE.md)
- [Quick Start Guide](docs/QUICKSTART.md)
- [API Reference](docs/API_REFERENCE.md)
- [Risk Classification Guide](docs/RISK_CLASSIFICATION.md)
- [Sequence Flows](docs/SEQUENCE_FLOWS.md)
- [Copilot Build Instructions](COPILOT_INSTRUCTIONS.md)
