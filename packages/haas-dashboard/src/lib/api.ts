// API client for the HaaS Core MCP proxy server

const BASE_URL = '/mcp';

export interface PendingTask {
  request: {
    id: string;
    agentId: string;
    toolName: string;
    toolArgs: Record<string, unknown>;
    riskTier: 'LOW' | 'MID' | 'HIGH' | 'CRITICAL';
    threshold: number;
    requiredPools: string[];
    createdAt: string;   // ISO 8601
    ttl: number;         // seconds
    traceId: string;
  };
  state: string;
  signatures: SignatureEntry[];
  createdAt: number;     // Unix ms
  updatedAt: number;     // Unix ms
  expiresAt: number;     // Unix ms
  escalationCount: number;
}

export interface SignatureEntry {
  approverId: string;
  pool: string;
  decision?: 'APPROVE' | 'REJECT';
  reason?: string;
  signature?: string;
  identityHash?: string;
  provider?: string;
  timestamp: string;
}

export interface HealthStatus {
  status: string;
  uptime: number;
}

export interface RiskPolicyDTO {
  tool: string;
  tier: string;
  threshold?: number;
  pools?: string[];
  timeout?: string;
  conditions?: unknown[];
  autoApprove?: boolean;
}

export interface ProviderDTO {
  name: string;
  enabled: boolean;
}

export interface AIOpsStats {
  totalTrackedTools: number;
  totalAdjustments: number;
  pendingRecommendations: number;
  topApproved: { tool: string; count: number }[];
  topRejected: { tool: string; count: number }[];
}

export interface AuditEntry {
  task: unknown;
  resolvedAt: number;
}

// ── Existing Endpoints ──────────────────────────────────────────────────

export async function fetchPendingTasks(): Promise<PendingTask[]> {
  const res = await fetch('/pending');
  const data = await res.json();
  return data.pending ?? [];
}

export async function fetchHealth(): Promise<HealthStatus> {
  const res = await fetch('/health');
  return res.json();
}

export async function submitApproval(
  requestId: string,
  approverId: string,
  pool: string,
  decision: 'APPROVE' | 'REJECT',
  reason?: string,
): Promise<{ consensusReached: boolean }> {
  const res = await fetch(`${BASE_URL}/approve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      requestId,
      threshold: 1,
      signature: {
        approverId,
        pool,
        decision,
        reason,
        timestamp: new Date().toISOString(),
      },
    }),
  });
  return res.json();
}

export type DemoScenario = 'low' | 'mid' | 'high' | 'critical' | 'all';

export interface DemoResult {
  message: string;
  results: Array<{ tool: string; tier: string; status: string }>;
}

export async function triggerDemo(scenario: DemoScenario = 'all'): Promise<DemoResult> {
  const res = await fetch('/demo/trigger', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ scenario }),
  });
  return res.json();
}

// ── Settings Endpoints ──────────────────────────────────────────────────

export async function fetchPolicies(): Promise<RiskPolicyDTO[]> {
  const res = await fetch('/settings/policies');
  const data = await res.json();
  return data.policies ?? [];
}

export async function savePolicies(policies: RiskPolicyDTO[]): Promise<{ message: string; count: number }> {
  const res = await fetch('/settings/policies', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ policies }),
  });
  return res.json();
}

export async function fetchProviders(): Promise<ProviderDTO[]> {
  const res = await fetch('/settings/providers');
  const data = await res.json();
  return data.providers ?? [];
}

export async function saveProviders(providers: ProviderDTO[]): Promise<{ message: string; count: number }> {
  const res = await fetch('/settings/providers', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ providers }),
  });
  return res.json();
}

export async function fetchEnabledProviders(): Promise<ProviderDTO[]> {
  const res = await fetch('/settings/providers/enabled');
  const data = await res.json();
  return data.providers ?? [];
}

// ── AIOps Endpoints ─────────────────────────────────────────────────────

export async function fetchAIOpsStats(): Promise<AIOpsStats> {
  const res = await fetch('/aiops/stats');
  return res.json();
}

// ── Audit Endpoints ─────────────────────────────────────────────────────

export async function fetchAuditLog(): Promise<AuditEntry[]> {
  const res = await fetch('/audit/log');
  const data = await res.json();
  return data.entries ?? [];
}
