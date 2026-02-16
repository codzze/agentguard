# Sequence Flows

This document contains all sequence diagrams for the AgentGuard HaaS framework, covering standard approval, rejection, timeout, escalation, and cross-pool multi-sig scenarios.

---

## 1. Standard Approval Flow (Tier 3 — High Risk)

```mermaid
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
    participant IdP as Identity Provider (Pluggable)
    participant OTel as OpenTelemetry

    Note over A,B: [A2A Protocol — Agent Collaboration]
    A->>B: Post Task: Request $50K Discount
    B-->>A: Task State: Submitted (Task ID: 789)
    B->>B: Reasoning: Evaluates 25% discount threshold

    Note over B,RC: [MCP Protocol — Tool Call]
    B->>RC: tool_call: apply_discount(amount=25%)

    Note over RC: Risk Analysis: Tier 3 (High)
    RC->>RA: Escalate (threshold: 2)
    RC->>OTel: Start Trace

    Note over RA,TS: [State Persistence]
    RA->>TS: Store {id: 789, state: PENDING}
    RA->>SW: Transition → WAITING_FOR_HUMAN

    Note over RA,P2P: [P2P Broadcast]
    RA->>P2P: Broadcast RFA {topic: haas/finance}
    P2P->>FP: Notify Pool

    FP->>IdP: Verify Identity (LinkedIn/GitHub/OIDC)
    IdP-->>FP: Verified: Senior Finance Director
    FP->>P2P: Submit Signature
    P2P->>RA: Signature 1/2 ✓
    RA->>OTel: Event: Partial Approval 1/2

    FP->>IdP: Verify Identity (2nd reviewer)
    IdP-->>FP: Verified: Finance Manager
    FP->>P2P: Submit Signature
    P2P->>RA: Signature 2/2 ✓
    RA->>OTel: Event: Consensus Reached

    RA->>TS: Update {state: APPROVED}
    SW->>B: tool_result: SUCCESS
    B-->>A: Task Complete
    RA->>OTel: Close Span (OK)
```

---

## 2. Rejection Flow

```mermaid
sequenceDiagram
    autonumber
    participant Agent as AI Agent (Python)
    participant Core as HaaS Interceptor
    participant P2P as P2P Network
    participant Pool as Approver Pool
    participant OTel as OpenTelemetry

    Agent->>Core: tool_call: delete_prod_database()
    Core->>OTel: Start Span (Risk: CRITICAL)
    Core->>P2P: Broadcast RFA

    Pool-->>Core: REJECTED (Reason: Policy Violation)
    Core->>OTel: Event: haas.approval.denied

    Core-->>Agent: tool_result: FAIL {reason}
    Agent->>Agent: Raise HaaSApprovalDenied
    Agent->>Agent: Execute Plan B

    Core->>OTel: Close Span (DENIED)
    Note over Core: AIOps: Increase risk weight
```

---

## 3. Timeout & Escalation Flow

```mermaid
sequenceDiagram
    autonumber
    participant Agent as AI Agent (Python)
    participant Core as HaaS Interceptor
    participant P2P as P2P Network
    participant Pool1 as Primary Pool
    participant Pool2 as Backup Pool
    participant OTel as OpenTelemetry

    Agent->>Core: tool_call: update_pricing()
    Core->>P2P: Broadcast RFA (TTL: 5min)

    Note over Pool1: No response (5 min)...
    Core->>OTel: Event: haas.approval.timeout

    alt Escalation Policy
        Core->>P2P: Re-broadcast (Backup Pool, TTL: 10min)
        Pool2-->>Core: APPROVED
        Core-->>Agent: tool_result: SUCCESS
    else Auto-Deny Policy
        Core-->>Agent: tool_result: TIMEOUT
        Agent->>Agent: Raise HaaSTimeoutError
    end

    Core->>OTel: Close Span
```

---

## 4. Cross-Pool Critical Flow (Tier 4 — Multi-Sig)

```mermaid
sequenceDiagram
    autonumber
    participant Agents as Agent Mesh (A2A)
    participant Core as HaaS Core (MCP)
    participant P2P as P2P Relay (LibP2P)
    participant FP as Finance Pool
    participant SP as Security Pool
    participant LP as Legal Pool
    participant IdP as Identity Provider
    participant OTel as OpenTelemetry

    Agents->>Core: tool_call: transfer_funds($1M)
    Core->>OTel: Start Span (CRITICAL, Multi-Sig: 3)

    par Cross-Pool Broadcast
        Core->>P2P: Broadcast to haas/finance
        Core->>P2P: Broadcast to haas/security
        Core->>P2P: Broadcast to haas/legal
    end

    par Parallel Expert Validation
        FP->>IdP: Verify (LinkedIn: CFO)
        IdP-->>FP: Verified VC
        FP->>P2P: Signature Fragment A
        P2P->>Core: Fragment A ✓ (1/3)
        Core->>OTel: Event: Approval 1/3
    and
        SP->>IdP: Verify (Entra: CISO)
        IdP-->>SP: Verified Token
        SP->>P2P: Signature Fragment B
        P2P->>Core: Fragment B ✓ (2/3)
        Core->>OTel: Event: Approval 2/3
    and
        LP->>IdP: Verify (Okta: Legal Counsel)
        IdP-->>LP: Verified Assertion
        LP->>P2P: Signature Fragment C
        P2P->>Core: Fragment C ✓ (3/3)
        Core->>OTel: Event: Consensus 3/3
    end

    Note over Core: Cryptographic Recombination
    Core-->>Agents: tool_result: SUCCESS (Proof Bundle)
    Core->>OTel: Close Span (3-of-3 Evidence)
```

---

## 5. Full Enterprise Flow (Aligned with Draw.io Architecture)

This flow maps to the component IDs in the enterprise Draw.io diagram.

```mermaid
sequenceDiagram
    autonumber
    participant A as Agent [Agent Layer]
    participant RC as Risk Classifier [Governance]
    participant RA as Request Approval [Governance]
    participant TS as Task Store [Redis]
    participant SW as Sync Wait [Governance]
    participant Pools as Approver Pools [P2P]
    participant OTel as OpenTelemetry [Observability]

    Note over A, RC: Tool Call Initiated
    A->>RC: tool_call (Critical Action)

    Note over RC: Analyzing Risk Tier...
    RC->>RA: Escalate (Tier 4: Critical)

    Note over RA, TS: Suspend & Store
    RA->>TS: Persist Agent State & TraceID
    RA->>SW: Transition to 'Waiting' State

    Note over RA, Pools: P2P Broadcast
    RA->>Pools: RFA (Target: Finance + Security Pools)

    Note over Pools: Decentralized Multi-Approval

    par Multi-Sig Collection
        Pools->>Pools: Finance SME signs (Verified ID)
        Pools->>OTel: Approval Telemetry
    and
        Pools->>Pools: Security SME signs (Verified ID)
        Pools->>OTel: Approval Telemetry
    end

    Note over Pools, SW: Consensus Reached (2/2)

    alt Approved
        Pools->>SW: Signal: Approved (Proof Bundle)
        SW->>A: Continue Processing
        Note right of A: Agent executes tool
    else Rejected
        Pools->>A: Not Approved - Stop/Change path
        Note right of A: Agent triggers Plan B
    end

    Note over SW, RC: Learning Loop
    SW->>RC: Update Classifier (Reduce Risk Factor)
    RC->>OTel: Finalize Trace
```

---

## 6. Component Interaction Matrix

| Source | Target | Protocol | Data |
|--------|--------|----------|------|
| Python Agent | HaaS Core | MCP / HTTP | ToolCall payload |
| HaaS Core | Risk Classifier | Internal | Tool metadata |
| Risk Classifier | State Machine | Internal | RiskTier + Policy |
| State Machine | Task Store | Redis/Map | PendingTask |
| State Machine | P2P Node | LibP2P | RFA broadcast |
| P2P Node | Approver Pools | GossipSub | Encrypted RFA |
| Reviewer | Identity Provider | OIDC/OAuth | Challenge-Response |
| Reviewer | P2P Node | GossipSub | Signed Approval |
| P2P Node | Consensus Engine | Internal | SignatureEntry |
| Consensus Engine | State Machine | Internal | ConsensusBundle |
| State Machine | Python Agent | MCP / HTTP | ToolCallResult |
| All Components | OTel Collector | gRPC | Traces + Events |
