# API Reference

AgentGuard HaaS Core exposes a REST API on port 3100 (default).

## Core Endpoints

### `GET /health`

Health check.

**Response:**

```json
{ "status": "ok", "uptime": 12345 }
```

---

### `POST /mcp/tools/call`

Validate a tool call for risk classification and governance.

**Request:**

```json
{
  "toolName": "transfer_funds",
  "args": { "amount": 50000, "recipient": "vendor-xyz" },
  "agentId": "finance-agent-1"
}
```

**Response (LOW risk — auto-approved):**

```json
{
  "status": "auto-approved",
  "result": { "tier": "LOW" }
}
```

**Response (HIGH/CRITICAL — pending approval):**

```json
{
  "status": "pending",
  "requestId": "req-abc123",
  "riskTier": "CRITICAL",
  "requiredApprovals": 3,
  "pools": ["finance", "security", "legal"]
}
```

---

### `POST /mcp/approve`

Submit an approval/rejection for a pending request.

**Request:**

```json
{
  "requestId": "req-abc123",
  "threshold": 3,
  "signature": {
    "approverId": "finance-director",
    "pool": "finance",
    "decision": "APPROVE",
    "reason": "Verified vendor contract",
    "timestamp": "2024-01-15T10:30:00Z"
  }
}
```

**Response:**

```json
{
  "consensusReached": false,
  "state": "PARTIAL_APPROVAL",
  "signaturesCollected": 1,
  "signaturesRequired": 3
}
```

---

### `GET /pending`

List all pending approval tasks.

**Response:**

```json
{
  "pending": [
    {
      "request": {
        "id": "req-abc123",
        "toolName": "transfer_funds",
        "riskTier": "CRITICAL",
        "threshold": 3,
        "requiredPools": ["finance", "security", "legal"]
      },
      "state": "WAITING_FOR_HUMAN",
      "signatures": [],
      "createdAt": 1705312200000,
      "expiresAt": 1705313100000
    }
  ]
}
```

---

### `POST /demo/trigger`

Trigger demo scenarios for testing.

**Request:**

```json
{ "scenario": "all" }
```

Scenarios: `"low"`, `"mid"`, `"high"`, `"critical"`, `"all"`

---

## Settings Endpoints

### `GET /settings/policies`

Get current risk classification policies.

**Response:**

```json
{
  "policies": [
    { "tool": "read_*", "tier": "LOW", "threshold": 0, "pools": [] },
    {
      "tool": "delete_*",
      "tier": "HIGH",
      "threshold": 2,
      "pools": ["security"]
    }
  ]
}
```

---

### `POST /settings/policies`

Update risk classification policies at runtime.

**Request:**

```json
{
  "policies": [
    {
      "tool": "deploy_*",
      "tier": "HIGH",
      "threshold": 2,
      "pools": ["engineering"]
    }
  ]
}
```

**Response:**

```json
{ "message": "Policies updated", "count": 1 }
```

---

### `GET /settings/providers`

List configured identity providers.

**Response:**

```json
{
  "providers": [
    { "name": "mock", "enabled": true },
    { "name": "github", "enabled": true }
  ]
}
```

---

## AIOps Endpoints

### `GET /aiops/stats`

Get AIOps learning statistics.

**Response:**

```json
{
  "totalTrackedTools": 5,
  "totalAdjustments": 2,
  "pendingRecommendations": 1,
  "topApproved": [{ "tool": "update_user", "count": 52 }],
  "topRejected": [{ "tool": "delete_account", "count": 7 }]
}
```

---

## Audit Endpoints

### `GET /audit/log`

Get resolved task history (last 100 entries).

**Response:**

```json
{
  "entries": [
    {
      "task": {
        "request": { "toolName": "update_user", "riskTier": "MID" },
        "state": "APPROVED"
      },
      "resolvedAt": 1705312200000
    }
  ]
}
```

---

## MCP Server Tools

When running as an MCP server (`./deploy-mcp.sh mcp`), the following tools are available:

| Tool            | Description                                |
| --------------- | ------------------------------------------ |
| `haas_evaluate` | Evaluate risk level of a tool call         |
| `haas_submit`   | Submit a tool call for governance approval |
| `haas_status`   | Check approval status of a request         |
| `haas_approve`  | Submit approval/rejection for a request    |
| `haas_policies` | List all configured risk policies          |
