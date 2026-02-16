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
