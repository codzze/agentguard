# AgentGuard — Build & Run Guide (Demo)

> Complete step-by-step instructions to build and run **all components** for a local demo.

---

## 📋 Prerequisites

| Tool       | Version  | Check Command            |
|------------|----------|--------------------------|
| **Node.js**| ≥ 20.x   | `node --version`         |
| **npm**    | ≥ 10.x   | `npm --version`          |
| **Python** | ≥ 3.11   | `python --version`       |
| **pip**    | latest   | `pip --version`          |
| **Git**    | any      | `git --version`          |

> **Optional**: Redis (for production state store). The demo uses an **in-memory store** by default.

---

## 🏗️ Architecture Recap (What You're Running)

```
┌──────────────────┐     ┌────────────────────┐     ┌──────────────────┐
│  Python Agent     │────►│  HaaS Core (MCP)   │────►│  Dashboard (UI)  │
│  (quick_start.py) │     │  localhost:3100     │     │  localhost:5173   │
│  Port: N/A        │     │                    │     │                  │
└──────────────────┘     └────────────────────┘     └──────────────────┘
                                  │
                          ┌───────▼───────┐
                          │ In-Memory     │
                          │ Task Store    │
                          └───────────────┘
```

| Component              | Package                       | Port   | Purpose                          |
|------------------------|-------------------------------|--------|----------------------------------|
| **Shared Proto**       | `packages/shared-proto`       | —      | Shared types & JSON schemas      |
| **Governance Core**    | `packages/haas-core`          | `3100` | MCP proxy, risk engine, state    |
| **Reviewer Dashboard** | `packages/haas-dashboard`     | `5173` | React UI for human reviewers     |
| **Python Agent SDK**   | `packages/haas-python-sdk`    | —      | `@governed` decorator for agents |

---

## 🚀 Step-by-Step Build & Run

### Step 0: Clone & Navigate

```cmd
git clone https://github.com/your-org/agentguard.git
cd agentguard
```

---

### Step 1: Install All Node.js Dependencies (Monorepo)

This single command installs dependencies for **all packages** (shared-proto, haas-core, haas-dashboard) via npm workspaces:

```cmd
npm install
```

---

### Step 2: Build All TypeScript Packages

Turborepo builds in dependency order: `shared-proto` → `haas-core` → `haas-dashboard`.

```cmd
npm run build
```

**What happens:**
1. `@agentguard/shared-proto` compiles `types.ts` → `dist/`
2. `@agentguard/core` compiles all TypeScript source → `dist/`
3. `@agentguard/dashboard` runs `tsc` + `vite build` → `dist/`

> 💡 If you only want to build a specific package:
> ```cmd
> cd packages\haas-core
> npm run build
> ```

---

### Step 3: Install Python SDK

Open a **separate terminal** and set up the Python SDK:

```cmd
cd packages\haas-python-sdk
pip install -e ".[dev]"
```

This installs:
- `httpx`, `websockets`, `pydantic` (runtime)
- `opentelemetry-api`, `opentelemetry-sdk` (tracing)
- `pytest`, `ruff`, `mypy` (dev tools)

---

### Step 4: Start the Governance Core (Terminal 1)

```cmd
cd packages\haas-core
npx ts-node ..\..\..\examples\server_start.ts
```

**Or** if you prefer using the compiled output:

```cmd
npm run build
node dist\index.js
```

**Or** use the dev watcher (auto-recompiles on changes):

```cmd
npm run dev
```

**Expected Output:**
```
🛡️  AgentGuard — Starting HaaS Core...

📋 Loaded 10 risk policies
🚀 HaaS Core running at http://localhost:3100

Endpoints:
  POST /mcp/tools/call  — Intercept tool calls
  POST /mcp/approve     — Submit approvals
  GET  /pending         — List pending tasks
  GET  /health          — Health check

⏳ Waiting for agent tool calls...
```

**Verify it's running:**
```cmd
curl http://localhost:3100/health
```

---

### Step 5: Start the Dashboard (Terminal 2)

```cmd
cd packages\haas-dashboard
npm run dev
```

**Expected Output:**
```
  VITE v5.4.x  ready in 300ms

  ➜  Local:   http://localhost:5173/
  ➜  Network: http://192.168.x.x:5173/
  ➜  press h + enter to show help
```

Open **http://localhost:5173** in your browser to see the reviewer dashboard.

> The Vite config proxies `/mcp`, `/pending`, and `/health` to `localhost:3100` automatically.

---

### Step 6: Run the Python Agent (Terminal 3)

```cmd
python examples\quick_start.py
```

**Expected Output:**
```
=== AgentGuard Quick Start ===

1. Reading customer data (LOW risk)...
   Result: {'id': 'cust-001', 'name': 'Acme Corp', 'tier': 'enterprise'}

2. Updating notes (MID risk)...
   ⏳ Waiting for human approval...
```

The agent **pauses** at step 2, waiting for a human to approve via the Dashboard (or API).

---

### Step 7: Approve via Dashboard or API

#### Option A: Dashboard UI
1. Open **http://localhost:5173** 
2. You'll see the pending approval request
3. Click **Approve** to release the agent

#### Option B: REST API (curl)
```cmd
curl -X POST http://localhost:3100/mcp/approve ^
  -H "Content-Type: application/json" ^
  -d "{\"requestId\": \"<ID_FROM_PENDING>\", \"threshold\": 1, \"signature\": {\"approverId\": \"demo-user\", \"pool\": \"general\", \"decision\": \"APPROVE\"}}"
```

#### Option C: Check Pending Tasks First
```cmd
curl http://localhost:3100/pending
```

This returns all pending RFA payloads with their IDs.

---

## 🧪 Running Tests

### TypeScript Tests (haas-core)
```cmd
cd packages\haas-core
npm test
```

Or from root (runs all test suites via Turborepo):
```cmd
npm test
```

### Python Tests (SDK)
```cmd
cd packages\haas-python-sdk
pytest
```

Or with verbose output:
```cmd
pytest -v
```

---

## 🔀 All-in-One Quick Start (3 Terminals)

### Terminal 1 — Core Server
```cmd
cd agentguard
npm install
npm run build
cd packages\haas-core
npx ts-node ..\..\examples\server_start.ts
```

### Terminal 2 — Dashboard
```cmd
cd agentguard\packages\haas-dashboard
npm run dev
```

### Terminal 3 — Python Agent
```cmd
cd agentguard\packages\haas-python-sdk
pip install -e .
cd ..\..
python examples\quick_start.py
```

---

## 📁 Demo Walkthrough

### Scenario 1: LOW Risk (Auto-Approve)
- **Action**: `read_customer_data("cust-001")`
- **What happens**: Passes through immediately, logged in OTel
- **Dashboard**: Shows in audit log but no approval needed

### Scenario 2: MID Risk (Single-Sig)
- **Action**: `update_customer_notes("cust-001", "VIP")`
- **What happens**: Agent pauses, RFA appears in Dashboard
- **Approve**: One click in Dashboard → agent resumes

### Scenario 3: HIGH Risk (Multi-Sig)
- **Action**: `apply_discount("cust-001", 25.0)` — threshold: 2
- **What happens**: Agent pauses, needs 2 approvals from finance pool
- **Approve**: Submit 2 separate approvals → agent resumes

### Scenario 4: CRITICAL Risk (Cross-Pool)
- **Action**: `transfer_funds("acc-001", "acc-002", 50000.0)` — threshold: 3
- **What happens**: Agent pauses, needs approvals from finance + security + legal
- **Approve**: Submit 3 approvals from different pools → agent resumes

---

## ⚙️ Configuration

### Risk Policies
Edit `config/risk-policies.example.yml` to customize which tools require approval:

```yaml
policies:
  - tool: "send_email"
    tier: MID
    requiredApprovals: 1
    requiredPools: [general]
    timeout: "3m"
```

### Core Server Config
The server configuration is in `examples/server_start.ts`:

```typescript
const config: HaaSCoreConfig = {
  policies: { policies },       // YAML policy file
  identity: ['mock', 'github'], // Identity providers
  port: 3100,                   // Server port
  inMemoryStore: true,          // Use in-memory (no Redis)
  telemetry: {
    endpoint: 'http://localhost:4317',
    serviceName: 'agentguard-core',
  },
};
```

### Python SDK Config
Configure in your agent code:

```python
from agentguard.config import HaaSConfig
from agentguard import configure

configure(HaaSConfig(
    core_url="http://localhost:3100",
    agent_id="my-agent-1",
    default_timeout_seconds=120,
))
```

---

## 🐛 Troubleshooting

| Issue | Solution |
|-------|----------|
| `npm install` fails | Ensure Node.js ≥ 20 and npm ≥ 10. Run `node --version` |
| `turbo` not found | Run `npm install` at root to install turbo as devDependency |
| `ts-node` not found | Install globally: `npm install -g ts-node typescript` |
| Port 3100 in use | Change `port` in `examples/server_start.ts` or kill the process |
| Port 5173 in use | Vite auto-picks next port, or set in `vite.config.ts` |
| Python `ModuleNotFoundError` | Run `pip install -e .` in `packages/haas-python-sdk` |
| `pip install -e ".[dev]"` fails | Try `pip install -e .` (without dev extras) |
| Dashboard shows no pending tasks | Ensure Core is running on 3100, check `curl http://localhost:3100/health` |
| Agent connects but times out | Increase `default_timeout_seconds` in Python config |
| Build errors in shared-proto | Build it first: `cd packages\shared-proto && npm run build` |

---

## 📊 Optional: OpenTelemetry Collector

For full observability with traces, run a local OTel Collector + Jaeger:

```cmd
docker run -d --name jaeger ^
  -p 16686:16686 ^
  -p 4317:4317 ^
  -p 4318:4318 ^
  jaegertracing/all-in-one:latest
```

Then open **http://localhost:16686** to see distributed traces spanning:
- Python Agent → HaaS Core → P2P Broadcast → Human Approval → Resume

---

## 📊 Optional: Redis (Production State Store)

For persistent state storage instead of in-memory:

```cmd
docker run -d --name redis -p 6379:6379 redis:latest
```

Then update config:
```typescript
const config: HaaSCoreConfig = {
  // ...
  redis: 'redis://localhost:6379',
  inMemoryStore: false,  // Use Redis
};
```

---

## 📂 Summary of Commands

| What                     | Command                                          |
|--------------------------|--------------------------------------------------|
| Install all deps         | `npm install`                                    |
| Build everything         | `npm run build`                                  |
| Start Core server        | `npx ts-node examples\server_start.ts`           |
| Start Dashboard          | `cd packages\haas-dashboard && npm run dev`      |
| Install Python SDK       | `cd packages\haas-python-sdk && pip install -e .` |
| Run Python agent         | `python examples\quick_start.py`                 |
| Run TS tests             | `npm test`                                       |
| Run Python tests         | `cd packages\haas-python-sdk && pytest`          |
| Check health             | `curl http://localhost:3100/health`               |
| List pending approvals   | `curl http://localhost:3100/pending`              |
| Clean build artifacts    | `npm run clean`                                  |
| Format code              | `npm run format`                                 |
