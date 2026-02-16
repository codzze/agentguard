# Risk Classification Guide

## Overview

The AgentGuard Risk Classifier is the first decision point in the governance pipeline. Every tool call from an AI agent passes through this engine, which determines whether the action requires human approval and at what level.

## Risk Tiers

### Tier 1 — LOW Risk
**Trigger:** Auto-Approve (logged only)  
**Threshold:** 0 signatures  
**Examples:**
- Reading a public file
- Formatting a document
- Querying non-sensitive data
- Generating a report

**Behavior:** The tool call passes through immediately. An OpenTelemetry trace is created for auditability, but no human is notified.

### Tier 2 — MID Risk
**Trigger:** Single-Sig Approval  
**Threshold:** 1 signature from 1 pool  
**Examples:**
- Sending an email to a client
- Updating a Jira ticket
- Modifying a non-production config
- Creating a calendar event

**Behavior:** A single verified human from the appropriate pool must approve. The request goes to one pool (e.g., IT Ops) and the first qualified person to sign releases the action.

### Tier 3 — HIGH Risk
**Trigger:** Multi-Sig Approval  
**Threshold:** 2-3 signatures from 1 pool  
**Examples:**
- Writing to a production database
- Processing a $1K-$100K transaction
- Modifying access permissions
- Deploying to staging

**Behavior:** Multiple verified humans from the same pool must independently approve. This prevents collusion and ensures peer review.

### Tier 4 — CRITICAL Risk
**Trigger:** Cross-Pool Executive-Sig  
**Threshold:** 2-3+ signatures from MULTIPLE pools  
**Examples:**
- Deleting a production VPC
- Processing a $100K+ wire transfer
- Modifying encryption keys
- Changing audit/compliance settings

**Behavior:** Signatures are required from different departmental pools (e.g., Finance AND Security AND Legal). Each pool's reviewer must independently verify their identity and approve.

## Policy Configuration

Policies are defined in YAML format and loaded by the Risk Classifier on startup.

```yaml
policies:
  # Critical: Large financial transactions
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

  # High: Moderate financial actions
  - tool: "execute_transfer"
    conditions:
      - field: "args.amount"
        operator: ">"
        value: 1000
      - field: "args.amount"
        operator: "<="
        value: 100000
    tier: "HIGH"
    threshold: 2
    pools: ["finance"]
    timeout: "30m"
    onRejection: "notify_agent"
    onTimeout: "auto_deny"

  # Mid: Email communications
  - tool: "send_email"
    tier: "MID"
    threshold: 1
    pools: ["itops"]
    timeout: "10m"

  # Low: Read-only operations
  - tool: "read_*"
    tier: "LOW"
    autoApprove: true
```

## Condition Operators

| Operator | Description | Example |
|----------|-------------|---------|
| `>` | Greater than | `amount > 10000` |
| `<` | Less than | `count < 5` |
| `>=` | Greater or equal | `priority >= 3` |
| `<=` | Less or equal | `discount <= 50` |
| `==` | Equals | `env == "production"` |
| `!=` | Not equals | `status != "draft"` |
| `contains` | String contains | `recipient contains "@external"` |
| `matches` | Regex match | `action matches "delete\|drop\|truncate"` |

## AIOps Feedback Loop

The Risk Classifier continuously learns from human decisions:

1. **Auto-tuning:** If a Tier 3 action is approved 100 consecutive times without rejection, the system may recommend downgrading it to Tier 2.
2. **Escalation learning:** If a specific tool call is frequently rejected, the system may recommend upgrading its risk tier.
3. **Pattern recognition:** The AIOps component identifies common approval patterns and suggests policy optimizations.

## Trust Requirements

Each risk tier can specify the minimum qualifications for the human reviewer:

| Tier | Minimum Seniority | Required Verification |
|------|-------------------|----------------------|
| LOW | None | None |
| MID | Associate | Verified Workplace |
| HIGH | Senior | Workplace + Relevant Skill |
| CRITICAL | Director/VP | Workplace + Skill + Multi-Factor |
