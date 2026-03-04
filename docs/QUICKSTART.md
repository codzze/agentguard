# Quick Start Guide

Get AgentGuard running in under 5 minutes.

## Prerequisites

- **Node.js 20+** and npm
- **Python 3.10+** (for the Python SDK)

## 1. Install Dependencies

```bash
git clone https://github.com/your-org/agentguard.git
cd agentguard
npm install
```

## 2. Start HaaS Core

```bash
# Option A: Use the deployment script (recommended)
./deploy-mcp.sh http

# Option B: Run directly
cd packages/haas-core
npx tsx src/start-server.ts
```

You should see:

```
🛡️  AgentGuard — Starting HaaS Core...
📋 Loaded 10 risk policies
🚀 HaaS Core running at http://localhost:3100
```

## 3. Verify It Works

```bash
curl http://localhost:3100/health
# → {"status":"ok","uptime":...}
```

## 4. Trigger a Demo

```bash
curl -X POST http://localhost:3100/demo/trigger \
  -H "Content-Type: application/json" \
  -d '{"scenario":"all"}'
```

This creates sample tasks at each risk tier. Check the pending queue:

```bash
curl http://localhost:3100/pending
```

## 5. Start the Dashboard

In a new terminal:

```bash
cd packages/haas-dashboard
npm run dev
```

Open **http://localhost:5173** to see the approval queue.

## 6. Connect as MCP Server

For Claude Desktop or Cursor, copy `mcp-config.json` to your MCP client config:

```json
{
  "mcpServers": {
    "agentguard": {
      "command": "npx",
      "args": ["tsx", "packages/haas-core/src/mcp/mcp-server.ts"],
      "cwd": "/path/to/agentguard"
    }
  }
}
```

Or start in MCP mode directly:

```bash
./deploy-mcp.sh mcp
```

## 7. Use the Python SDK

```bash
pip install agentguard
```

```python
from agentguard import governed

@governed(tier="high", pool="finance")
async def transfer_funds(amount: float, recipient: str):
    # Only executes after human approval
    return {"status": "transferred", "amount": amount}
```

## Deployment Modes

| Command                     | Description                                |
| --------------------------- | ------------------------------------------ |
| `./deploy-mcp.sh http`      | HTTP API server on port 3100               |
| `./deploy-mcp.sh mcp`       | MCP stdio server for Claude Desktop/Cursor |
| `./deploy-mcp.sh dashboard` | HTTP API + React dashboard                 |
| `./deploy-mcp.sh demo`      | Start server + trigger demo scenarios      |
