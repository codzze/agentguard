# AgentGuard — Architecture Reference

## 1. System Overview

AgentGuard implements a **decentralized Human-in-the-Loop (HITL) governance** layer for AI Agents. The system is composed of four primary subsystems that communicate via standardized protocols.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        ENTERPRISE VPC (Multi-AZ)                            │
│                                                                             │
│  ┌──────────────────┐     ┌───────────────────────────────────────────┐     │
│  │  AGENT LAYER     │     │  HAAS GOVERNANCE (MCP Server)             │     │
│  │  (A2A Mesh)      │     │                                           │     │
│  │                  │     │  ┌──────────────┐  ┌──────────────────┐   │     │
│  │  ┌────────────┐  │     │  │    Risk       │  │ Request Approval │   │     │
│  │  │ AI Agent   │──┼────►│  │  Classifier   │─►│ + Consensus      │   │     │
│  │  │ (Python)   │  │     │  └──────────────┘  └────────┬─────────┘   │     │
│  │  │ Awaiting   │  │     │                              │             │     │
│  │  │ Approval   │  │     │  ┌──────────────┐  ┌────────▼─────────┐   │     │
│  │  └─────▲──────┘  │     │  │ Task Store   │  │   Sync Wait      │   │     │
│  │        │         │     │  │ (Redis)      │  │   State Machine  │   │     │
│  │        │         │     │  └──────────────┘  └──────────────────┘   │     │
│  └────────┼─────────┘     └───────────────┬───────────────────────────┘     │
│           │                               │                                 │
│           │  ┌────────────────────────────┐│                                │
│           │  │ OBSERVABILITY / MONITORING ││                                │
│           │  │ ┌───────────┐ ┌─────────┐ ││                                │
│           │  │ │ OpenTelem │ │  AIOps  │ ││                                │
│           │  │ └───────────┘ └─────────┘ ││                                │
│           │  └────────────────────────────┘│                                │
│           │                               │                                 │
└───────────┼───────────────────────────────┼─────────────────────────────────┘
            │                               │
            │  Resume/Reject                │  P2P RFA Broadcast
            │                               ▼
┌───────────┴───────────────────────────────────────────────────────────────┐
│                    HUMAN APPROVER POOLS (P2P Network)                      │
│                                                                            │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐            │
│  │  Finance Pool   │  │  Security Pool  │  │ IT Ops Pool     │            │
│  │  (Tier 3-4)     │  │  (Tier 4)       │  │ (Tier 2)        │            │
│  │  👤👤👤👤       │  │  👤👤👤👤       │  │  👤👤👤👤       │            │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘            │
│  ┌─────────────────┐                                                       │
│  │  Data Pool      │   Decentralized Single/Multi Approval Pattern         │
│  │  👤👤👤👤       │   Based on Risk Tier                                  │
│  └─────────────────┘                                                       │
│                                                                            │
│  ┌──────────────────────────────────────┐                                  │
│  │  IDENTITY ADAPTER MESH (Pluggable)  │                                   │
│  │  ┌────────────┐ ┌────────────┐      │                                   │
│  │  │ LinkedIn   │ │ GitHub     │      │                                   │
│  │  │ Verified   │ │ Org Auth   │      │                                   │
│  │  └────────────┘ └────────────┘      │                                   │
│  │  ┌────────────┐ ┌────────────┐      │                                   │
│  │  │ OIDC/SAML  │ │ Custom     │      │                                   │
│  │  │ Okta/Entra │ │ Web3/PGP   │      │                                   │
│  │  └────────────┘ └────────────┘      │                                   │
│  └──────────────────────────────────────┘                                  │
└────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Component Architecture

### 2.1 Agent Layer (A2A Mesh)

**Location**: Private Subnet / VPC  
**Protocol**: A2A (Agent-to-Agent)  
**Language**: Python

The Agent Layer hosts multiple AI agents (Sales, Finance, Legal, etc.) that collaborate via the A2A protocol. Each agent exposes an `AgentCard` at `/.well-known/agent.json` for discovery.

**Responsibilities:**

- Multi-agent task negotiation (e.g., Sales Agent asks Finance Agent to approve a discount)
- Tool execution via MCP client
- State preservation during `WAITING_FOR_HUMAN` pause
- "Plan B" logic when approvals are rejected

**Key Components:**
| Component | Description |
|-----------|-------------|
| `@haas_governed` decorator | Wraps Python functions to validate critical calls |
| `HaaSClient` | HTTP/WebSocket client communicating with haas-core |
| `ContextPreserver` | Saves agent memory/stack during approval wait |
| `ExceptionHandler` | Raises `HaaSApprovalDenied` or `HaaSTimeoutError` |

### 2.2 HaaS Governance Core (MCP Server)

**Location**: Private Subnet / VPC  
**Protocol**: MCP (Model Context Protocol)  
**Language**: TypeScript/Node.js

The central governance engine that validates, classifies, and orchestrates human approvals.

**Sub-Components:**

#### Risk Classifier Engine

```
Input: tool_call metadata (name, args, caller_agent_id)
Output: RiskTier (LOW | MID | HIGH | CRITICAL)
```

- Pattern-matching rules engine
- Configurable policy files (YAML/JSON)
- AIOps feedback loop: learns from approval/rejection history

#### State Machine

```
States: IDLE → PENDING → WAITING → APPROVED | REJECTED | TIMEOUT | ESCALATED
```

- Redis-backed persistence for crash recovery
- TTL-based automatic timeout
- Supports concurrent pending requests per agent

#### Consensus Aggregator

```
For Tier 3 (High):   threshold = 2, pools = ["finance"]
For Tier 4 (Critical): threshold = 3, pools = ["finance", "security", "legal"]
```

- Collects unique signatures from distinct approver pools
- Threshold cryptography (optional: Shamir's Secret Sharing)
- Race condition handling for competing approvers

#### MCP Proxy Server

- Wraps standard MCP tool servers
- Transparent passthrough for Tier 1 (auto-approve)
- Validation + pause for Tier 2-4
- Returns `input-required` MCP state during human validation

### 2.3 Human Approver Pools (P2P Network)

**Location**: Public/DMZ (P2P Relay) + Remote (Reviewer devices)  
**Protocol**: LibP2P (GossipSub)  
**Language**: TypeScript

**Pool Types:**
| Pool | GossipSub Topic | Tier Access | Typical Validators |
|------|----------------|-------------|-------------------|
| Finance | `haas/finance` | 3-4 | CFO, Finance Directors |
| Security | `haas/security` | 4 | CISO, Security Engineers |
| IT Operations | `haas/itops` | 2-3 | DevOps, SREs |
| Data | `haas/data` | 2-3 | Data Engineers, DBAs |
| Legal | `haas/legal` | 4 | Legal Counsel |

**Approval Patterns:**

- **Single-Sig (Tier 2)**: First qualified human to verify and sign → approved
- **Multi-Sig (Tier 3)**: N unique signatures from ONE pool required
- **Cross-Pool Multi-Sig (Tier 4)**: N signatures from MULTIPLE different pools

**Claim Pattern:**

1. RFA broadcast to relevant topic(s)
2. Multiple humans receive notification (push, desktop, Slack)
3. First human to "Claim" the task gets the identity challenge
4. Race condition: once claimed, other humans see "In Progress"
5. If claimer fails identity check, task is re-released to pool

### 2.4 Identity Adapter Mesh (Pluggable Auth)

**Location**: External / Edge  
**Pattern**: Strategy Pattern with Factory

```typescript
interface IIdentityProvider {
  name: string;
  getChallenge(requirements: TrustRequirements): Challenge;
  verifyProof(proof: IdentityProof): Promise<VerificationResult>;
  extractClaims(proof: IdentityProof): ExpertClaims;
}
```

**Supported Providers:**
| Provider | Trust Signal | Use Case |
|----------|-------------|----------|
| LinkedIn Verified ID | Workplace + Seniority + Skills | Enterprise governance |
| Microsoft Entra ID | AD Group Membership + MFA | Corporate environments |
| GitHub | Org Membership + Contributions | Open-source projects |
| Okta / OIDC / SAML | Role-based claims | SSO-integrated orgs |
| Custom Web3 / Wallet | Wallet signature + DAO membership | Decentralized teams |
| PGP / GPG | Key-based identity | High-security environments |

### 2.5 Observability / Monitoring

**Location**: Shared Management VPC  
**Protocol**: gRPC (OTel export)

**OpenTelemetry Trace Structure:**

```
Trace: "HaaS Governance Flow"
├── Span: "Agent Tool Call"
│   ├── Attribute: agent.id = "finance-agent-001"
│   ├── Attribute: tool.name = "execute_transfer"
│   └── Attribute: risk.tier = "critical"
├── Span: "Risk Classification"
│   └── Attribute: classifier.result = "TIER_4"
├── Span: "P2P Broadcast"
│   ├── Attribute: pools = ["finance", "security"]
│   └── Attribute: threshold = 2
├── Span: "Human Validation"
│   ├── Event: "claim_by_user_alice" (timestamp)
│   ├── Event: "identity_verified" (provider: "linkedin")
│   ├── Event: "signature_submitted" (pool: "finance")
│   ├── Event: "claim_by_user_bob" (timestamp)
│   ├── Event: "identity_verified" (provider: "github")
│   └── Event: "signature_submitted" (pool: "security")
├── Span: "Consensus Check"
│   ├── Attribute: signatures_collected = 2
│   ├── Attribute: threshold_met = true
│   └── Attribute: decision = "APPROVED"
└── Span: "Tool Execution"
    ├── Attribute: result = "SUCCESS"
    └── Attribute: haas.wait_time_ms = 45000
```

**AIOps Feedback Loop:**

- Rejection patterns feed into Risk Classifier training
- Historical approval times optimize pool routing
- Auto-approve recommendations for repeatedly approved low-risk patterns

---

## 3. Sequence Flows

### 3.1 Standard Flow (Tier 3 — High Risk, Multi-Sig)

```
sequenceDiagram
    autonumber
    participant A as Sales Agent (Python)
    participant B as Finance Agent (Python)
    participant RC as Risk Classifier
    participant RA as Request Approval
    participant TS as Task Store (Redis)
    participant SW as Sync Wait
    participant P2P as P2P Network (LibP2P)
    participant FP as Finance Pool
    participant SP as Security Pool
    participant IdP as Identity Provider (Pluggable)
    participant OTel as OpenTelemetry
    participant DB as Enterprise ERP (Tool)

    Note over A,B: [A2A Protocol — Agent Collaboration]
    A->>B: Post Task: Request $50K Discount (AgentCard Discovery)
    B-->>A: Task State: Submitted (Task ID: 789)
    B->>B: Reasoning: Evaluates 25% discount threshold

    Note over B,RC: [MCP Protocol — Tool Call Validation]
    B->>RC: tool_call: apply_discount(amount=25%, value=$50K)

    Note over RC: Risk Analysis: amount > $10K → Tier 3
    RC->>RA: Escalate (Tier 3: High, threshold: 2)
    RC->>OTel: Start Trace + Span: "HaaS Governance"

    Note over RA,TS: [State Persistence]
    RA->>TS: Store: {id: 789, state: PENDING, context: snapshot}
    RA->>SW: Transition → WAITING_FOR_HUMAN

    Note over RA,P2P: [P2P Broadcast to Pools]
    RA->>P2P: Broadcast RFA {topic: "haas/finance", threshold: 2, expertise: "Senior"}

    par Parallel Pool Notifications
        P2P->>FP: Notify Pool (Push/Desktop/Slack)
    end

    Note over FP: Reviewer 1 "Claims" the task
    FP->>IdP: Present Identity (e.g., LinkedIn Verified ID)
    IdP-->>FP: Verified: "Senior Finance Director"
    FP->>P2P: Submit Signature + Verified Proof
    P2P->>RA: Deliver Signature 1/2 (Finance)
    RA->>OTel: Event: "Partial Approval 1/2"

    Note over FP: Reviewer 2 "Claims" the task
    FP->>IdP: Present Identity (e.g., GitHub Org)
    IdP-->>FP: Verified: "Finance Team Member"
    FP->>P2P: Submit Signature + Verified Proof
    P2P->>RA: Deliver Signature 2/2 (Finance)
    RA->>OTel: Event: "Consensus Reached 2/2"

    Note over RA: Threshold Met → State: APPROVED
    RA->>TS: Update: {id: 789, state: APPROVED}
    SW->>B: tool_result: SUCCESS (Proof: Multi-Sig Bundle)

    Note over B,DB: [Tool Execution]
    B->>DB: write: commit_discount(25%)
    DB-->>B: Success: 200 OK

    B-->>A: Task State: Completed (Artifact: Approved_Discount_PDF)
    RA->>OTel: Close Span (Status: OK, Evidence: Multi-Hash-Link)
```

### 3.2 Rejection Flow

```
sequenceDiagram
    autonumber
    participant Agent as AI Agent (Python)
    participant Core as HaaS Validator
    participant P2P as P2P Network
    participant Pool as Approver Pool
    participant OTel as OpenTelemetry

    Agent->>Core: tool_call: delete_prod_database()
    Core->>OTel: Start Span (Risk: CRITICAL)
    Core->>P2P: Broadcast RFA (Pools: [Security, IT Ops])

    Pool->>Core: REJECTED (Reason: "Policy Violation — No prod deletions without change ticket")
    Core->>OTel: Event: haas.approval.denied {reason, approver}

    Core-->>Agent: tool_result: FAIL {reason: "Action Denied by Security Pool"}
    Agent->>Agent: Raise HaaSApprovalDenied → Execute Plan B
    Agent->>Agent: Create change ticket, retry with proper authorization

    Core->>OTel: Close Span (Status: DENIED)
    Note over Core: AIOps: Increase risk weight for delete_prod_database
```

### 3.3 Timeout & Escalation Flow

```
sequenceDiagram
    autonumber
    participant Agent as AI Agent (Python)
    participant Core as HaaS Validator
    participant P2P as P2P Network
    participant Pool1 as Primary Pool
    participant Pool2 as Escalation Pool
    participant OTel as OpenTelemetry

    Agent->>Core: tool_call: update_pricing()
    Core->>P2P: Broadcast RFA (Pool: Finance, TTL: 5min)

    Note over Pool1: No response within 5 minutes...
    Core->>OTel: Event: haas.approval.timeout (Pool: Finance)

    alt Escalation Policy: Route to backup
        Core->>P2P: Re-broadcast RFA (Pool: Finance-Backup, TTL: 10min)
        Pool2->>Core: APPROVED (Escalated)
        Core-->>Agent: tool_result: SUCCESS
    else Escalation Policy: Auto-deny
        Core-->>Agent: tool_result: TIMEOUT
        Agent->>Agent: Raise HaaSTimeoutError → Notify admin
    end

    Core->>OTel: Close Span
```

### 3.4 Cross-Pool Critical Flow (Tier 4)

```
sequenceDiagram
    autonumber
    participant Agents as Agent Mesh (A2A)
    participant Core as HaaS Core (MCP)
    participant P2P as P2P Relay (LibP2P)
    participant FP as Finance Pool
    participant SP as Security Pool
    participant LP as Legal Pool
    participant IdP as Identity Provider (Pluggable)
    participant OTel as OpenTelemetry

    Agents->>Core: tool_call: transfer_funds($1M)
    Core->>OTel: Start Span (Risk: CRITICAL, Multi-Sig: 3, Pools: 3)

    par Cross-Pool Broadcast
        Core->>P2P: Broadcast to haas/finance
        Core->>P2P: Broadcast to haas/security
        Core->>P2P: Broadcast to haas/legal
    end

    par Parallel Expert Validation
        FP->>IdP: Verify (Provider: LinkedIn, Role: CFO)
        IdP-->>FP: Verified VC
        FP->>P2P: Signature Fragment A
        P2P->>Core: Fragment A (Finance) ✓
        Core->>OTel: Event: "Approval 1/3"
    and
        SP->>IdP: Verify (Provider: Entra, Role: CISO)
        IdP-->>SP: Verified Token
        SP->>P2P: Signature Fragment B
        P2P->>Core: Fragment B (Security) ✓
        Core->>OTel: Event: "Approval 2/3"
    and
        LP->>IdP: Verify (Provider: Okta, Role: Legal Counsel)
        IdP-->>LP: Verified Assertion
        LP->>P2P: Signature Fragment C
        P2P->>Core: Fragment C (Legal) ✓
        Core->>OTel: Event: "Consensus Reached 3/3"
    end

    Note over Core: Cryptographic Recombination
    Core-->>Agents: tool_result: SUCCESS (Proof Bundle)
    Core->>OTel: Close Span (Evidence: 3-of-3 Multi-Hash)
```

---

## 4. Enterprise Network Topology

```
┌──────────────────────────────────────────────────────────────────────────┐
│                        CLOUD REGION (AWS/Azure/GCP)                      │
│                                                                          │
│  ┌─────────────────────────────────────────────────────┐                 │
│  │              PUBLIC SUBNET (DMZ)                     │                │
│  │  ┌───────────────────┐  ┌────────────────────────┐  │                │
│  │  │ API Gateway /     │  │ P2P Relay Node         │  │                │
│  │  │ Load Balancer     │  │ (LibP2P Discovery)     │  │                │
│  │  │ (A2A Endpoints)   │  │                        │  │                │
│  │  └───────────────────┘  └────────────────────────┘  │                │
│  └─────────────────────────────────────────────────────┘                 │
│                                                                          │
│  ┌─────────────────────────────────────────────────────┐                 │
│  │              PRIVATE SUBNET (VPC)                    │                │
│  │                                                      │                │
│  │  AZ-1                        AZ-2                    │                │
│  │  ┌──────────────────┐  ┌──────────────────────┐     │                │
│  │  │ Agent Mesh       │  │ HaaS Core (Primary)  │     │                │
│  │  │ (Python Workers) │  │ + Redis Cluster       │     │                │
│  │  └──────────────────┘  └──────────────────────┘     │                │
│  │                                                      │                │
│  │  ┌──────────────────────────────────────────────┐   │                │
│  │  │          Shared Management VPC                │   │                │
│  │  │  ┌──────────────┐  ┌──────────────────────┐  │   │                │
│  │  │  │ OTel Cluster │  │ Jaeger / Honeycomb   │  │   │                │
│  │  │  └──────────────┘  └──────────────────────┘  │   │                │
│  │  └──────────────────────────────────────────────┘   │                │
│  └─────────────────────────────────────────────────────┘                 │
│                                                                          │
│  ┌─────────────────────────────────────────────────────┐                 │
│  │              EXTERNAL VALIDATION ZONE                │                │
│  │  ┌────────────────────────────────────────────┐     │                │
│  │  │ Identity Adapter Mesh                       │     │                │
│  │  │ LinkedIn | Entra | GitHub | Okta | Web3    │     │                │
│  │  └────────────────────────────────────────────┘     │                │
│  └─────────────────────────────────────────────────────┘                 │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## 5. Data Models

### ApprovalRequest (RFA Payload)

```json
{
  "id": "uuid-v4",
  "agentId": "finance-agent-001",
  "toolName": "execute_transfer",
  "toolArgs": { "amount": 1000000, "recipient": "vendor-xyz" },
  "riskTier": "CRITICAL",
  "requiredPools": ["finance", "security"],
  "threshold": 2,
  "trustRequirements": {
    "minSeniority": "director",
    "requiredSkills": ["finance", "risk-management"],
    "acceptedProviders": ["linkedin", "entra", "okta"]
  },
  "traceId": "otel-trace-id",
  "createdAt": "2026-02-09T12:00:00Z",
  "ttl": 3600
}
```

### ApprovalResponse (Signature Payload)

```json
{
  "requestId": "uuid-v4",
  "decision": "APPROVED",
  "reason": null,
  "approver": {
    "peerId": "libp2p-peer-id",
    "identityHash": "sha256(verified-credential)",
    "provider": "linkedin",
    "claims": {
      "name": "Alice Johnson",
      "title": "Senior Finance Director",
      "org": "Acme Corp",
      "verifiedAt": "2026-02-09T12:05:00Z"
    }
  },
  "signature": "ed25519-signature-bytes",
  "timestamp": "2026-02-09T12:05:30Z"
}
```

### ConsensusBundle (Final Proof)

```json
{
  "requestId": "uuid-v4",
  "status": "CONSENSUS_REACHED",
  "threshold": 2,
  "signatures": [
    { "pool": "finance", "approver": "...", "signature": "..." },
    { "pool": "security", "approver": "...", "signature": "..." }
  ],
  "combinedProof": "threshold-signature-bytes",
  "traceId": "otel-trace-id",
  "completedAt": "2026-02-09T12:10:00Z"
}
```

---

## 6. Configuration Schema

### Risk Policy (YAML)

```yaml
policies:
  - tool: "execute_transfer"
    conditions:
      - field: "args.amount"
        operator: ">"
        value: 100000
    tier: "CRITICAL"
    threshold: 3
    pools: ["finance", "security", "legal"]
    timeout: "1h"
    onRejection: "abort_agent"
    onTimeout: "escalate"
    escalationPool: "executive"

  - tool: "update_pricing"
    conditions:
      - field: "args.discount_pct"
        operator: ">"
        value: 20
    tier: "HIGH"
    threshold: 2
    pools: ["finance"]
    timeout: "30m"
    onRejection: "notify_agent"
    onTimeout: "auto_deny"

  - tool: "send_email"
    tier: "MID"
    threshold: 1
    pools: ["itops"]
    timeout: "10m"

  - tool: "read_document"
    tier: "LOW"
    autoApprove: true
```

---

## 7. Deployment Considerations

| Aspect                | Recommendation                                                                         |
| --------------------- | -------------------------------------------------------------------------------------- |
| **Scaling**           | HaaS Core: Horizontal (stateless with Redis). P2P Relay: Multiple nodes for redundancy |
| **High Availability** | Multi-AZ deployment, Redis Cluster, P2P DHT for peer resilience                        |
| **Security**          | mTLS between agents and core, encrypted P2P channels, JWT validation                   |
| **Compliance**        | OTel traces exported to immutable storage (S3/GCS), 7-year retention for SOX           |
| **Performance**       | Target <100ms for risk classification, <5s for P2P broadcast                           |
| **Disaster Recovery** | Task Store snapshots, P2P state rehydration from DHT                                   |
