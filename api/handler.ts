// ============================================================================
// AgentGuard — Vercel Serverless API Handler
//
// Self-contained handler for all API endpoints, with built-in security:
// - IP-based rate limiting (sliding window)
// - Stricter limits on demo trigger & write endpoints
// - Request body size cap (16KB)
// - Max 50 pending tasks
// - Auto-cleanup of stale tasks (15 min TTL)
// - CORS headers
// ============================================================================

import type { VercelRequest, VercelResponse } from '@vercel/node';

// ── Types ───────────────────────────────────────────────────────────────

interface PendingTask {
  request: {
    id: string;
    agentId: string;
    toolName: string;
    toolArgs: Record<string, unknown>;
    riskTier: string;
    threshold: number;
    requiredPools: string[];
    createdAt: string;
    ttl: number;
    traceId: string;
  };
  state: string;
  signatures: Signature[];
  createdAt: number;
  updatedAt: number;
  expiresAt: number;
  escalationCount: number;
}

interface Signature {
  approverId: string;
  pool: string;
  decision?: string;
  reason?: string;
  timestamp: string;
}

interface ProviderSetting {
  name: string;
  enabled: boolean;
}

interface AuditEntry {
  task: unknown;
  resolvedAt: number;
}

interface RiskPolicy {
  tool: string;
  tier: string;
  threshold?: number;
  pools?: string[];
  timeout?: string;
  conditions?: unknown[];
  autoApprove?: boolean;
}

// ── Global State (persists across warm invocations) ─────────────────────

let pendingTasks: Map<string, PendingTask> = new Map();
let auditEntries: AuditEntry[] = [];
let policies: RiskPolicy[] = [
  { tool: 'read_*', tier: 'LOW', autoApprove: true },
  { tool: 'update_*', tier: 'MID', threshold: 1, pools: ['general'], timeout: '3m' },
  { tool: 'apply_*', tier: 'HIGH', threshold: 2, pools: ['finance'], timeout: '5m' },
  { tool: 'transfer_*', tier: 'CRITICAL', threshold: 3, pools: ['finance', 'security', 'legal'], timeout: '15m' },
  { tool: 'delete_*', tier: 'CRITICAL', threshold: 3, pools: ['engineering', 'security'], timeout: '15m' },
];
let providers: ProviderSetting[] = [
  { name: 'github', enabled: true },
  { name: 'linkedin', enabled: true },
  { name: 'sso', enabled: true },
  { name: 'oidc', enabled: false },
  { name: 'okta', enabled: false },
  { name: 'web3', enabled: false },
  { name: 'mock', enabled: false },
];

// ── Rate Limiter ────────────────────────────────────────────────────────

interface RateBucket {
  count: number;
  resetAt: number;
}

const rateBuckets = new Map<string, RateBucket>();
const RATE_CLEANUP_INTERVAL = 60_000;
let lastCleanup = Date.now();

const RATE_LIMITS: Record<string, { max: number; windowMs: number }> = {
  '/demo/trigger':  { max: 3,  windowMs: 60_000 },   // 3 per min
  '/mcp/approve':   { max: 20, windowMs: 60_000 },   // 20 per min
  '/mcp/tools/call':{ max: 20, windowMs: 60_000 },   // 20 per min
  '/settings':      { max: 10, windowMs: 60_000 },   // 10 per min (writes)
  'default':        { max: 60, windowMs: 60_000 },   // 60 per min (reads)
};

function getRateLimit(path: string): { max: number; windowMs: number } {
  for (const [prefix, limit] of Object.entries(RATE_LIMITS)) {
    if (path.startsWith(prefix)) return limit;
  }
  return RATE_LIMITS['default'];
}

function checkRateLimit(ip: string, path: string): { allowed: boolean; remaining: number; resetIn: number } {
  // Cleanup old entries every minute
  const now = Date.now();
  if (now - lastCleanup > RATE_CLEANUP_INTERVAL) {
    for (const [key, bucket] of rateBuckets) {
      if (now > bucket.resetAt) rateBuckets.delete(key);
    }
    lastCleanup = now;
  }

  const { max, windowMs } = getRateLimit(path);
  const key = `${ip}::${path}`;
  const bucket = rateBuckets.get(key);

  if (!bucket || now > bucket.resetAt) {
    rateBuckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: max - 1, resetIn: windowMs };
  }

  bucket.count++;
  const remaining = Math.max(0, max - bucket.count);
  const resetIn = bucket.resetAt - now;

  return { allowed: bucket.count <= max, remaining, resetIn };
}

// ── Task Cleanup ────────────────────────────────────────────────────────

const MAX_PENDING_TASKS = 50;
const TASK_TTL_MS = 15 * 60 * 1000; // 15 minutes

function cleanupStaleTasks(): void {
  const now = Date.now();
  for (const [id, task] of pendingTasks) {
    if (now - task.createdAt > TASK_TTL_MS) {
      auditEntries.push({ task: { ...task, state: 'TIMEOUT' }, resolvedAt: now });
      pendingTasks.delete(id);
    }
  }
  // Trim audit log
  if (auditEntries.length > 500) {
    auditEntries = auditEntries.slice(-500);
  }
}

// ── Risk Classifier (simplified) ────────────────────────────────────────

function classifyTool(toolName: string, _args: Record<string, unknown>): {
  tier: string; policy: RiskPolicy | null; threshold: number; pools: string[];
} {
  for (const policy of policies) {
    const pattern = policy.tool.replace(/\*/g, '.*');
    if (new RegExp(`^${pattern}$`).test(toolName)) {
      return {
        tier: policy.tier,
        policy,
        threshold: policy.threshold ?? (policy.tier === 'CRITICAL' ? 3 : policy.tier === 'HIGH' ? 2 : 1),
        pools: policy.pools ?? ['general'],
      };
    }
  }
  return { tier: 'MID', policy: null, threshold: 1, pools: ['general'] };
}

// ── Request ID Generator ────────────────────────────────────────────────

function genId(): string {
  return `req-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

// ── Main Handler ────────────────────────────────────────────────────────

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  // Get client IP
  const ip =
    (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ??
    req.headers['x-real-ip'] as string ??
    'unknown';

  // Determine the route path from the rewrite query param
  const route = (req.query._r as string) ?? '/';

  // Rate limiting
  const rateCheck = checkRateLimit(ip, route);
  res.setHeader('X-RateLimit-Remaining', String(rateCheck.remaining));
  res.setHeader('X-RateLimit-Reset', String(Math.ceil(rateCheck.resetIn / 1000)));

  if (!rateCheck.allowed) {
    return res.status(429).json({
      error: 'Too many requests',
      message: 'Rate limit exceeded. Please wait before retrying.',
      retryAfter: Math.ceil(rateCheck.resetIn / 1000),
    });
  }

  // Request body size limit (16KB)
  if (req.method === 'POST') {
    const contentLength = parseInt(req.headers['content-length'] ?? '0', 10);
    if (contentLength > 16384) {
      return res.status(413).json({ error: 'Request body too large (max 16KB)' });
    }
  }

  // Cleanup stale tasks
  cleanupStaleTasks();

  // Route handling
  try {
    switch (route) {
      case '/health':
        return handleHealth(res);

      case '/pending':
        return handlePending(req, res);

      case '/mcp/tools/call':
        if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
        return handleToolCall(req, res);

      case '/mcp/approve':
        if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
        return handleApprove(req, res);

      case '/demo/trigger':
        if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
        return handleDemoTrigger(req, res);

      case '/settings/policies':
        if (req.method === 'POST') return handleSavePolicies(req, res);
        return handleGetPolicies(res);

      case '/settings/providers':
        if (req.method === 'POST') return handleSaveProviders(req, res);
        return handleGetProviders(res);

      case '/settings/providers/enabled':
        return handleGetEnabledProviders(res);

      case '/aiops/stats':
        return handleAIOpsStats(res);

      case '/audit/log':
        return handleAuditLog(res);

      default:
        return res.status(404).json({ error: 'Not found' });
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return res.status(500).json({ error: message });
  }
}

// ── Endpoint Handlers ───────────────────────────────────────────────────

function handleHealth(res: VercelResponse) {
  return res.status(200).json({
    status: 'ok',
    mode: 'vercel-demo',
    pendingTasks: pendingTasks.size,
    auditEntries: auditEntries.length,
  });
}

function handlePending(_req: VercelRequest, res: VercelResponse) {
  const pending = Array.from(pendingTasks.values()).filter(
    (t) => t.state === 'WAITING_FOR_HUMAN' || t.state === 'PENDING' || t.state === 'PARTIAL_APPROVAL',
  );
  return res.status(200).json({ pending });
}

function handleToolCall(req: VercelRequest, res: VercelResponse) {
  const body = req.body;
  if (!body?.params?.name) {
    return res.status(400).json({ error: 'Missing params.name' });
  }

  if (pendingTasks.size >= MAX_PENDING_TASKS) {
    return res.status(503).json({ error: 'Demo task limit reached. Please resolve existing tasks before adding more.' });
  }

  const toolName = body.params.name;
  const toolArgs = body.params.arguments ?? {};
  const { tier, threshold, pools } = classifyTool(toolName, toolArgs);

  if (tier === 'LOW') {
    return res.status(200).json({
      content: [{ type: 'text', text: `Tool "${toolName}" executed successfully (auto-approved, LOW risk).` }],
    });
  }

  const requestId = genId();
  const now = Date.now();
  const task: PendingTask = {
    request: {
      id: requestId,
      agentId: body.agentId ?? 'agent-demo',
      toolName, toolArgs,
      riskTier: tier,
      threshold,
      requiredPools: pools,
      createdAt: new Date().toISOString(),
      ttl: 900,
      traceId: requestId,
    },
    state: 'WAITING_FOR_HUMAN',
    signatures: [],
    createdAt: now,
    updatedAt: now,
    expiresAt: now + TASK_TTL_MS,
    escalationCount: 0,
  };

  pendingTasks.set(requestId, task);

  return res.status(200).json({
    content: [{ type: 'text', text: `Tool "${toolName}" requires ${tier} risk approval (${threshold} signatures from [${pools.join(', ')}]).` }],
    requestId,
    tier,
    isError: true,
  });
}

function handleApprove(req: VercelRequest, res: VercelResponse) {
  const { requestId, signature } = req.body ?? {};
  if (!requestId || !signature) {
    return res.status(400).json({ error: 'Missing requestId or signature' });
  }

  const task = pendingTasks.get(requestId);
  if (!task) {
    return res.status(404).json({ error: 'Request not found or already resolved' });
  }

  if (signature.decision === 'REJECT') {
    task.state = 'REJECTED';
    task.updatedAt = Date.now();
    task.signatures.push(signature);
    auditEntries.push({ task: { ...task }, resolvedAt: Date.now() });
    pendingTasks.delete(requestId);
    return res.status(200).json({ consensusReached: false, decision: 'REJECTED', requestId });
  }

  task.signatures.push(signature);
  task.updatedAt = Date.now();

  const threshold = task.request.threshold;
  if (task.signatures.length >= threshold) {
    task.state = 'APPROVED';
    auditEntries.push({ task: { ...task }, resolvedAt: Date.now() });
    pendingTasks.delete(requestId);
    return res.status(200).json({ consensusReached: true, requestId });
  }

  task.state = 'PARTIAL_APPROVAL';
  return res.status(200).json({ consensusReached: false, requestId, signaturesNeeded: threshold - task.signatures.length });
}

function handleDemoTrigger(req: VercelRequest, res: VercelResponse) {
  if (pendingTasks.size >= MAX_PENDING_TASKS) {
    return res.status(503).json({ error: 'Demo task limit reached (max 50). Approve or reject existing tasks first.' });
  }

  const { scenario = 'all' } = req.body ?? {};

  const demoScenarios: Record<string, { name: string; args: Record<string, unknown> }[]> = {
    low: [
      { name: 'read_customer_data', args: { customer_id: 'cust-001' } },
    ],
    mid: [
      { name: 'update_customer_notes', args: { customer_id: 'cust-001', notes: 'VIP upgrade requested' } },
    ],
    high: [
      { name: 'apply_discount', args: { customer_id: 'cust-001', percentage: 25 } },
    ],
    critical: [
      { name: 'transfer_funds', args: { from_account: 'acc-001', to_account: 'acc-002', amount: 50000 } },
    ],
    all: [
      { name: 'read_customer_data', args: { customer_id: 'cust-001' } },
      { name: 'update_customer_notes', args: { customer_id: 'cust-001', notes: 'VIP upgrade requested' } },
      { name: 'apply_discount', args: { customer_id: 'cust-001', percentage: 25 } },
      { name: 'transfer_funds', args: { from_account: 'acc-001', to_account: 'acc-002', amount: 50000 } },
    ],
  };

  const calls = demoScenarios[scenario] ?? demoScenarios['all'];
  const results: { tool: string; tier: string; status: string }[] = [];
  const now = Date.now();

  for (const call of calls) {
    const { tier, threshold, pools } = classifyTool(call.name, call.args);

    if (tier === 'LOW') {
      results.push({ tool: call.name, tier: 'LOW', status: 'auto-approved' });
      continue;
    }

    if (pendingTasks.size >= MAX_PENDING_TASKS) {
      results.push({ tool: call.name, tier, status: 'skipped-limit-reached' });
      continue;
    }

    const requestId = genId();
    const task: PendingTask = {
      request: {
        id: requestId,
        agentId: 'demo-agent',
        toolName: call.name,
        toolArgs: call.args,
        riskTier: tier,
        threshold,
        requiredPools: pools,
        createdAt: new Date().toISOString(),
        ttl: 900,
        traceId: requestId,
      },
      state: 'WAITING_FOR_HUMAN',
      signatures: [],
      createdAt: now,
      updatedAt: now,
      expiresAt: now + TASK_TTL_MS,
      escalationCount: 0,
    };

    pendingTasks.set(requestId, task);
    results.push({ tool: call.name, tier, status: 'pending-approval' });
  }

  return res.status(200).json({ message: `Demo triggered: ${scenario}`, results });
}

function handleGetPolicies(res: VercelResponse) {
  return res.status(200).json({ policies });
}

function handleSavePolicies(req: VercelRequest, res: VercelResponse) {
  const body = req.body;
  if (!Array.isArray(body?.policies)) {
    return res.status(400).json({ error: 'Expected { policies: [...] }' });
  }
  if (body.policies.length > 100) {
    return res.status(400).json({ error: 'Too many policies (max 100)' });
  }
  policies = body.policies;
  return res.status(200).json({ message: 'Policies updated', count: policies.length });
}

function handleGetProviders(res: VercelResponse) {
  return res.status(200).json({ providers });
}

function handleSaveProviders(req: VercelRequest, res: VercelResponse) {
  const body = req.body;
  if (!Array.isArray(body?.providers)) {
    return res.status(400).json({ error: 'Expected { providers: [...] }' });
  }
  if (body.providers.length > 20) {
    return res.status(400).json({ error: 'Too many providers (max 20)' });
  }
  providers = body.providers;
  return res.status(200).json({ message: 'Providers saved', count: providers.length });
}

function handleGetEnabledProviders(res: VercelResponse) {
  const enabled = providers.filter((p) => p.enabled);
  return res.status(200).json({ providers: enabled });
}

function handleAIOpsStats(res: VercelResponse) {
  const approvedCount = auditEntries.filter(
    (e) => (e.task as PendingTask)?.state === 'APPROVED',
  ).length;
  const rejectedCount = auditEntries.filter(
    (e) => (e.task as PendingTask)?.state === 'REJECTED',
  ).length;

  return res.status(200).json({
    totalTrackedTools: policies.length,
    totalAdjustments: 0,
    pendingRecommendations: 0,
    totalApproved: approvedCount,
    totalRejected: rejectedCount,
    topApproved: [],
    topRejected: [],
  });
}

function handleAuditLog(res: VercelResponse) {
  return res.status(200).json({ entries: auditEntries.slice(-100) });
}
