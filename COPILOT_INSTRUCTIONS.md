# AgentGuard HaaS Framework — Copilot Build Instructions

## 🎯 Project Vision

**AgentGuard** is a decentralized **Human-as-a-Service (HaaS)** framework that acts as a governance layer for AI Agents. It validates critical tool calls via the **Model Context Protocol (MCP)**, broadcasts approval requests across a **LibP2P peer-to-peer network**, and requires **multi-sig human validation** backed by **pluggable Identity Providers** (LinkedIn, GitHub, OIDC, Okta, Web3).

> **Tagline:** "The Safety Switch for the Agentic Web"

---

## 📦 Monorepo Structure

```
agentguard/
├── packages/
│   ├── haas-core/                  # Node.js/TypeScript — Governance Validator & P2P Node
│   │   ├── src/
│   │   │   ├── types/              # Shared TypeScript interfaces
│   │   │   │   └── index.ts
│   │   │   ├── classifier/         # Risk Classification Engine
│   │   │   │   ├── risk-classifier.ts
│   │   │   │   └── policies.ts
│   │   │   ├── state/              # State Machine & Pending Task Store
│   │   │   │   ├── state-machine.ts
│   │   │   │   └── store.ts
│   │   │   ├── network/            # LibP2P P2P Communication
│   │   │   │   ├── p2p.ts
│   │   │   │   └── gossipsub.ts
│   │   │   ├── auth/               # Pluggable Identity Adapter Mesh
│   │   │   │   ├── factory.ts
│   │   │   │   ├── providers/
│   │   │   │   │   ├── linkedin.ts
│   │   │   │   │   ├── github.ts
│   │   │   │   │   ├── oidc.ts
│   │   │   │   │   ├── okta.ts
│   │   │   │   │   └── web3.ts
│   │   │   │   └── types.ts
│   │   │   ├── consensus/          # Multi-Sig Consensus Engine
│   │   │   │   ├── aggregator.ts
│   │   │   │   └── threshold.ts
│   │   │   ├── mcp/                # MCP Proxy Server
│   │   │   │   ├── server.ts
│   │   │   │   └── interceptor.ts
│   │   │   ├── telemetry/          # OpenTelemetry Integration
│   │   │   │   ├── tracer.ts
│   │   │   │   └── spans.ts
│   │   │   └── index.ts
│   │   ├── tests/
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── haas-python-sdk/            # Python — Agent-side SDK
│   │   ├── agentguard/
│   │   │   ├── __init__.py
│   │   │   ├── decorator.py        # @haas_governed decorator
│   │   │   ├── interceptor.py      # MCP client & communication
│   │   │   ├── models.py           # Pydantic models (shared schema)
│   │   │   ├── client.py           # HTTP/WebSocket client to haas-core
│   │   │   ├── exceptions.py       # HaaSApprovalDenied, HaaSTimeout
│   │   │   ├── telemetry.py        # OTel context propagation
│   │   │   └── config.py           # SDK configuration
│   │   ├── tests/
│   │   ├── setup.py
│   │   ├── pyproject.toml
│   │   └── requirements.txt
│   │
│   ├── haas-dashboard/             # React/Vite — Expert Reviewer UI
│   │   ├── src/
│   │   │   ├── components/
│   │   │   │   ├── ApprovalQueue.tsx
│   │   │   │   ├── RequestCard.tsx
│   │   │   │   ├── IdentityChallenge.tsx
│   │   │   │   ├── ConsensusTracker.tsx
│   │   │   │   ├── AuditTimeline.tsx
│   │   │   │   └── PoolSelector.tsx
│   │   │   ├── hooks/
│   │   │   │   ├── useP2P.ts
│   │   │   │   ├── useAuth.ts
│   │   │   │   └── useApproval.ts
│   │   │   ├── pages/
│   │   │   │   ├── Dashboard.tsx
│   │   │   │   ├── Login.tsx
│   │   │   │   └── AuditLog.tsx
│   │   │   ├── lib/
│   │   │   │   ├── api.ts
│   │   │   │   └── websocket.ts
│   │   │   ├── App.tsx
│   │   │   └── main.tsx
│   │   ├── package.json
│   │   └── vite.config.ts
│   │
│   └── shared-proto/               # Shared schemas & protocol definitions
│       ├── schemas/
│       │   ├── approval-request.json
│       │   ├── approval-response.json
│       │   ├── identity-proof.json
│       │   └── consensus-bundle.json
│       ├── types.ts
│       └── package.json
│
├── docs/
│   ├── ARCHITECTURE.md             # This file (architecture reference)
│   ├── SEQUENCE_FLOWS.md           # All sequence diagrams
│   ├── RISK_CLASSIFICATION.md      # Risk tier definitions
│   └── diagrams/                   # Draw.io XML exports
│       ├── enterprise-architecture.drawio
│       └── sequence-flow.drawio
│
├── .github/
│   ├── workflows/
│   │   ├── ci.yml                  # Lint, test, build
│   │   └── publish.yml             # npm + PyPI publish
│   └── CONTRIBUTING.md
│
├── package.json                    # Root monorepo (npm workspaces)
├── turbo.json                      # Turborepo config
├── .gitignore
├── LICENSE
└── README.md
```

---

## 🏗️ Technical Stack

| Layer               | Technology                         | Purpose                                       |
| ------------------- | ---------------------------------- | --------------------------------------------- |
| **Agent SDK**       | Python 3.11+, httpx, websockets    | Validate agent tool calls, decorator system   |
| **Governance Core** | Node.js 20+, TypeScript 5.x        | Risk classification, state machine, consensus |
| **Transport**       | MCP (Model Context Protocol)       | Agent ↔ Validator communication               |
| **P2P Network**     | LibP2P (GossipSub)                 | Decentralized approval broadcast              |
| **Identity**        | Pluggable (OIDC, LinkedIn, GitHub) | Expert verification                           |
| **Observability**   | OpenTelemetry                      | Immutable audit trail                         |
| **State Store**     | Redis / In-memory Map              | Pending task persistence                      |
| **Dashboard**       | React 18, Vite, Tailwind, shadcn   | Enterprise reviewer UI                        |
| **Monorepo**        | npm workspaces + Turborepo         | Build orchestration                           |

---

## 🔴 Risk Classification Framework

| Tier       | Risk Level | Example Action                      | HaaS Trigger        | Required Validators                     |
| ---------- | ---------- | ----------------------------------- | ------------------- | --------------------------------------- |
| **Tier 1** | Low        | Read public file, format document   | Auto-Approve        | None (logged in OTel)                   |
| **Tier 2** | Mid        | Send email, update Jira ticket      | Single-Sig          | Associate level (Verified Workplace)    |
| **Tier 3** | High       | Database write, $1K+ transaction    | Multi-Sig (2/3)     | Senior level + Relevant Verified Skill  |
| **Tier 4** | Critical   | Delete prod VPC, $1M+ wire transfer | Executive-Sig (M/N) | VP/Director + Multi-Factor verification |

---

## 🔄 Business Logic: Approval/Fail Lifecycle

### Scenario A: APPROVED

1. Collect signature + Identity Proof (e.g., LinkedIn VC hash, GitHub org token)
2. Validate proof via `IdentityAdapter.verify(proof)`
3. Emit OpenTelemetry Span Event: `haas.approval.granted` with metadata
4. Notify the Python SDK via open WebSocket/HTTP callback
5. Python agent resumes execution of the original function

### Scenario B: REJECTED

1. Collect human-provided "Reason for Rejection"
2. Log OpenTelemetry Span Event: `haas.approval.denied` with reason
3. Send `FAIL` signal to Python SDK
4. Python SDK raises `HaaSApprovalDenied` exception
5. Agent triggers "Plan B" logic (retry with lower amount, alert admin, etc.)
6. **AIOps Feedback**: Feed rejection back into RiskClassifier to increase risk weight for similar future calls

### Scenario C: TIMEOUT

1. No human responds within configured TTL
2. Log OpenTelemetry Span Event: `haas.approval.timeout`
3. Escalate to backup pool OR auto-deny based on policy
4. Python SDK raises `HaaSTimeoutError`

### Scenario D: MULTI-SIG PARTIAL

1. Some but not all required signatures collected before timeout
2. Log partial approvals in OTel trace
3. Policy decides: extend timeout, escalate, or deny

---

## 🔗 Protocol Interactions

### A2A (Agent-to-Agent)

- Used for **orchestration** between multiple AI agents
- Sales Agent discovers Finance Agent via `AgentCard` (`.well-known/agent.json`)
- Multi-turn negotiation before final tool call

### MCP (Model Context Protocol)

- Used for **tool governance**
- HaaS Core acts as MCP Proxy Server between Agent and actual Tools
- Validates `tool_call` and returns `input-required` state during human validation

### LibP2P (Peer-to-Peer)

- Used for **decentralized broadcast** of Requests for Approval (RFA)
- GossipSub topics per department: `haas/finance`, `haas/security`, `haas/devops`
- DHT for peer discovery — no central server required

### OpenTelemetry

- Global `TraceContext` spanning: Python `tool_call` → P2P Broadcast → Human Click → Auth → Execution
- Attributes: `agent.id`, `tool.name`, `risk.tier`, `approver.id`, `auth.provider`

---

## 🛠️ Build Order (Step-by-Step for Copilot)

### Phase 1: Shared Protocol

1. `shared-proto/schemas/approval-request.json` — JSON Schema for RFA payload
2. `packages/haas-core/src/types/index.ts` — TypeScript interfaces

### Phase 2: Governance Core

3. `haas-core/src/classifier/risk-classifier.ts` — Risk tier logic
4. `haas-core/src/state/state-machine.ts` — PENDING → APPROVED | REJECTED transitions
5. `haas-core/src/state/store.ts` — Redis/Map backed persistence
6. `haas-core/src/consensus/aggregator.ts` — Multi-sig collection & threshold check
7. `haas-core/src/auth/factory.ts` — Pluggable IdP adapter factory
8. `haas-core/src/network/p2p.ts` — LibP2P GossipSub node
9. `haas-core/src/mcp/server.ts` — MCP-compliant proxy server
10. `haas-core/src/telemetry/tracer.ts` — OTel trace initialization

### Phase 3: Python SDK

11. `haas-python-sdk/agentguard/models.py` — Pydantic models matching TS types
12. `haas-python-sdk/agentguard/client.py` — HTTP/WS client to haas-core
13. `haas-python-sdk/agentguard/decorator.py` — `@haas_governed` decorator
14. `haas-python-sdk/agentguard/exceptions.py` — Custom exceptions
15. `haas-python-sdk/agentguard/telemetry.py` — OTel context propagation

### Phase 4: Dashboard

16. `haas-dashboard/` — React app with Tailwind + shadcn/ui
17. Real-time WebSocket feed for incoming RFAs
18. Identity challenge flow (pluggable provider selection)
19. Consensus progress tracker (X of N signatures)
20. Audit timeline view

### Phase 5: Integration Testing

21. End-to-end test: Python agent → Core → P2P → Dashboard mock → Back to Python
22. Multi-sig consensus test with 2-of-3 approvers
23. Rejection flow test with Plan B trigger
24. Timeout and escalation test

---

## 📏 Code Quality Standards

- **TypeScript**: Strict mode, no `any`, ESLint + Prettier
- **Python**: Type hints everywhere, mypy strict, ruff linter
- **Testing**: Vitest (TS), pytest (Python), >80% coverage target
- **Documentation**: JSDoc/docstrings on all public APIs
- **Git**: Conventional Commits, PR templates, branch protection

---

## 🚀 Publishing

### npm (haas-core + haas-dashboard)

```bash
npm version patch
npm publish --access public
```

### PyPI (haas-python-sdk)

```bash
python -m build
twine upload dist/*
```

### Prepublish Hook

```json
"prepublishOnly": "npm run build && npm run test"
```
