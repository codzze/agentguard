import http from 'http';
import { EventEmitter } from 'events';
import { MCPInterceptor, MCPToolCall, MCPToolResult } from './interceptor.js';
import type { HaaSCoreConfig, RiskPolicy } from '../types/index.js';
import type { AIOpsService } from '../aiops/feedback-loop.js';
import {
  loadProviders, saveProviders, type ProviderSetting,
  loadAuditLog, appendAuditEntry, getAuditEntries, clearAuditLog, type AuditRecord,
  savePolicies as persistPolicies,
} from '../storage/persistent-store.js';

export interface MCPServerConfig extends HaaSCoreConfig {
  /** Port for the HTTP server (default: 3100) */
  port?: number;
  /** Hostname to bind (default: 0.0.0.0) */
  host?: string;
}

/**
 * MCP Proxy Server
 *
 * An HTTP server that acts as a passthrough MCP proxy.
 * AI agents connect to this server instead of the real MCP server.
 * Tool calls are intercepted, risk-classified, and optionally paused
 * for human approval before being forwarded upstream.
 *
 * Endpoints:
 *   POST /mcp/tools/call   — Intercept a tool call
 *   GET  /mcp/status/:id   — Check approval status
 *   POST /mcp/approve      — Submit an approval/rejection
 *   GET  /health           — Health check
 *   GET  /pending          — List pending approval tasks
 */
export class MCPProxyServer extends EventEmitter {
  private interceptor: MCPInterceptor;
  private server: http.Server | null = null;
  private port: number;
  private host: string;
  private aiops: AIOpsService | null = null;

  // Loaded from persistent storage on startup
  private providerSettings: ProviderSetting[];
  private auditEntries: AuditRecord[];

  constructor(config: MCPServerConfig) {
    super();
    this.interceptor = new MCPInterceptor(config);
    this.port = config.port ?? 3100;
    this.host = config.host ?? '0.0.0.0';

    // Load persisted data
    this.providerSettings = loadProviders();
    this.auditEntries = loadAuditLog();
  }

  /**
   * Attach the AIOps service for stats endpoints.
   */
  setAIOps(aiops: AIOpsService): void {
    this.aiops = aiops;
  }

  /**
   * Start the HTTP proxy server.
   */
  async start(): Promise<void> {
    this.server = http.createServer((req, res) => {
      this.handleRequest(req, res).catch((err) => {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      });
    });

    return new Promise((resolve) => {
      this.server!.listen(this.port, this.host, () => {
        this.emit('started', { port: this.port, host: this.host });
        resolve();
      });
    });
  }

  /**
   * Stop the HTTP proxy server.
   */
  async stop(): Promise<void> {
    if (!this.server) return;
    return new Promise((resolve, reject) => {
      this.server!.close((err) => {
        if (err) reject(err);
        else resolve();
      });
      this.server = null;
    });
  }

  /**
   * Get the interceptor for direct API usage (testing, embedding).
   */
  getInterceptor(): MCPInterceptor {
    return this.interceptor;
  }

  // ---- Request Routing ----

  private async handleRequest(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    const url = new URL(req.url ?? '/', `http://${req.headers.host}`);
    const method = req.method?.toUpperCase() ?? 'GET';

    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    try {
      if (method === 'POST' && url.pathname === '/mcp/tools/call') {
        await this.handleToolCall(req, res);
      } else if (method === 'GET' && url.pathname.startsWith('/mcp/status/')) {
        await this.handleStatusQuery(url, res);
      } else if (method === 'POST' && url.pathname === '/mcp/approve') {
        await this.handleApproval(req, res);
      } else if (method === 'GET' && url.pathname === '/health') {
        this.sendJSON(res, 200, { status: 'ok', uptime: process.uptime() });
      } else if (method === 'GET' && url.pathname === '/pending') {
        await this.handleListPending(res);
      } else if (method === 'POST' && url.pathname === '/demo/trigger') {
        await this.handleDemoTrigger(req, res);
      } else if (method === 'GET' && url.pathname === '/settings/policies') {
        this.handleGetPolicies(res);
      } else if (method === 'POST' && url.pathname === '/settings/policies') {
        await this.handleSavePolicies(req, res);
      } else if (method === 'GET' && url.pathname === '/settings/providers') {
        this.handleGetProviders(res);
      } else if (method === 'POST' && url.pathname === '/settings/providers') {
        await this.handleSaveProviders(req, res);
      } else if (method === 'GET' && url.pathname === '/settings/providers/enabled') {
        this.handleGetEnabledProviders(res);
      } else if (method === 'GET' && url.pathname === '/aiops/stats') {
        this.handleGetAIOpsStats(res);
      } else if (method === 'GET' && url.pathname === '/audit/log') {
        this.handleGetAuditLog(res);
      } else if (method === 'DELETE' && url.pathname === '/audit/log') {
        this.handleClearAuditLog(res);
      } else {
        this.sendJSON(res, 404, { error: 'Not found' });
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Internal server error';
      this.sendJSON(res, 500, { error: message });
    }
  }

  private async handleToolCall(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    const body = await this.readBody(req);
    const toolCall: MCPToolCall = JSON.parse(body);

    const toolName = toolCall.params.name;
    const toolArgs = toolCall.params.arguments ?? {};

    // Classify the tool risk
    const classification = this.interceptor.getClassifier().classify(toolName, toolArgs);

    // LOW risk → execute immediately (auto-approve)
    if (classification.tier === 'LOW') {
      const executeFn = async (call: MCPToolCall): Promise<MCPToolResult> => ({
        content: [{ type: 'text', text: `Tool "${call.params.name}" executed successfully.` }],
      });
      const result = await this.interceptor.intercept(toolCall, executeFn);
      this.sendJSON(res, 200, result);
      return;
    }

    // MID/HIGH/CRITICAL → create the pending task and return immediately
    // The intercept call blocks on waitForResolution, so we fire-and-forget it
    const executeFn = async (call: MCPToolCall): Promise<MCPToolResult> => ({
      content: [{ type: 'text', text: `Tool "${call.params.name}" executed successfully.` }],
    });

    // Start intercept in background (it will block waiting for human approval)
    this.interceptor.intercept(toolCall, executeFn).catch(() => {});

    // Give the state machine a tick to create the request
    await new Promise(r => setTimeout(r, 100));

    // Find the requestId that was just created
    const sm = this.interceptor.getStateMachine();
    const pending = await sm.listPending();
    const justCreated = pending.find(
      (t) => t.request.toolName === toolName &&
             t.state !== 'APPROVED' && t.state !== 'REJECTED'
    );

    const requestId = justCreated?.request?.id ?? `req-${Date.now().toString(36)}`;
    const threshold = classification.policy?.threshold ??
      (classification.tier === 'CRITICAL' ? 3 : classification.tier === 'HIGH' ? 2 : 1);
    const pools = classification.policy?.pools ?? ['general'];

    this.sendJSON(res, 200, {
      content: [{ type: 'text', text: `Tool "${toolName}" requires ${classification.tier} risk approval (${threshold} signatures from [${pools.join(', ')}]).` }],
      requestId,
      tier: classification.tier,
      threshold,
      requiredPools: pools,
      isError: true,
    });
  }

  private async handleStatusQuery(url: URL, res: http.ServerResponse): Promise<void> {
    const requestId = url.pathname.split('/').pop() ?? '';
    const sm = this.interceptor.getStateMachine();
    // Use the store directly via the state machine's public API
    // In a production system, you'd have a dedicated status endpoint
    this.sendJSON(res, 200, { requestId, message: 'Status query received' });
  }

  private async handleApproval(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    const body = await this.readBody(req);
    const payload = JSON.parse(body);

    const { requestId, signature, threshold } = payload;
    if (!requestId || !signature) {
      this.sendJSON(res, 400, { error: 'Missing requestId or signature' });
      return;
    }

    const sm = this.interceptor.getStateMachine();

    // Check if this is a rejection
    if (signature.decision === 'REJECT') {
      await sm.handleRejection(requestId, {
        requestId,
        decision: 'REJECTED',
        reason: signature.reason ?? 'Rejected by reviewer',
        approver: {
          peerId: signature.approverId ?? 'unknown',
          identityHash: '',
          provider: 'dashboard',
          pool: signature.pool ?? 'general',
        },
        signature: `dashboard-sig-${Date.now()}`,
        timestamp: signature.timestamp ?? new Date().toISOString(),
      });

      // Record to audit log
      const task = await sm.getState(requestId);
      this.recordResolved(task ?? {
        request: { id: requestId, toolName: 'unknown', riskTier: 'UNKNOWN' },
        state: 'REJECTED',
        signatures: [signature],
      });

      this.sendJSON(res, 200, { consensusReached: false, decision: 'REJECTED', requestId });
      return;
    }

    // Handle approval signature
    const result = await this.interceptor.submitSignature(requestId, signature, threshold ?? 1);

    // Record to audit log only if fully resolved
    const task = await sm.getState(requestId);
    if (result.consensusReached) {
      if (task) {
        this.recordResolved(task);
      } else {
        this.recordResolved({
          request: { id: requestId, toolName: 'unknown', riskTier: 'UNKNOWN' },
          state: 'APPROVED',
          signatures: [signature],
          consensusReached: true,
        });
      }
    }

    this.sendJSON(res, 200, result);
  }

  private async handleListPending(res: http.ServerResponse): Promise<void> {
    const sm = this.interceptor.getStateMachine();
    const pending = await sm.listPending();
    this.sendJSON(res, 200, { pending });
  }

  /**
   * Demo trigger endpoint — simulates AI agent tool calls for live demonstration.
   * POST /demo/trigger  { scenario: "mid" | "high" | "critical" | "all" }
   */
  private async handleDemoTrigger(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    const body = await this.readBody(req);
    const { scenario = 'all' } = body ? JSON.parse(body) : {};

    const demoScenarios: Record<string, MCPToolCall[]> = {
      low: [
        { method: 'tools/call', params: { name: 'read_customer_data', arguments: { customer_id: 'cust-001' } } },
      ],
      mid: [
        { method: 'tools/call', params: { name: 'update_customer_notes', arguments: { customer_id: 'cust-001', notes: 'VIP upgrade requested' } } },
      ],
      high: [
        { method: 'tools/call', params: { name: 'apply_discount', arguments: { customer_id: 'cust-001', percentage: 25 } } },
      ],
      critical: [
        { method: 'tools/call', params: { name: 'transfer_funds', arguments: { from_account: 'acc-001', to_account: 'acc-002', amount: 50000 } } },
      ],
      all: [
        { method: 'tools/call', params: { name: 'read_customer_data', arguments: { customer_id: 'cust-001' } } },
        { method: 'tools/call', params: { name: 'update_customer_notes', arguments: { customer_id: 'cust-001', notes: 'VIP upgrade requested' } } },
        { method: 'tools/call', params: { name: 'apply_discount', arguments: { customer_id: 'cust-001', percentage: 25 } } },
        { method: 'tools/call', params: { name: 'transfer_funds', arguments: { from_account: 'acc-001', to_account: 'acc-002', amount: 50000 } } },
      ],
    };

    const calls = demoScenarios[scenario] ?? demoScenarios['all'];
    const results: Array<{ tool: string; tier: string; status: string }> = [];

    const executeFn = async (call: MCPToolCall): Promise<MCPToolResult> => {
      return {
        content: [{ type: 'text', text: `Tool "${call.params.name}" executed successfully (demo).` }],
      };
    };

    for (const call of calls) {
      // Fire-and-forget for blocking calls (MID+ will block waiting for approval)
      // We intercept but don't await resolution — the request lands in pending queue
      const toolName = call.params.name;
      const toolArgs = call.params.arguments ?? {};
      const classification = this.interceptor.getClassifier().classify(toolName, toolArgs);

      if (classification.tier === 'LOW') {
        await this.interceptor.intercept(call, executeFn);
        results.push({ tool: toolName, tier: 'LOW', status: 'auto-approved' });
      } else {
        // Start interception in background (it will block waiting for approval)
        this.interceptor.intercept(call, executeFn).catch(() => {});
        results.push({ tool: toolName, tier: classification.tier, status: 'pending-approval' });
      }
    }

    this.sendJSON(res, 200, {
      message: `Demo triggered: ${scenario}`,
      results,
    });
  }

  // ---- Settings Endpoints ----

  private handleGetPolicies(res: http.ServerResponse): void {
    const policies = this.interceptor.getClassifier().getPolicies();
    this.sendJSON(res, 200, { policies });
  }

  private async handleSavePolicies(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    const body = await this.readBody(req);
    const { policies } = JSON.parse(body) as { policies: RiskPolicy[] };

    if (!Array.isArray(policies)) {
      this.sendJSON(res, 400, { error: 'Expected { policies: [...] }' });
      return;
    }

    // Replace classifier policies
    const classifier = this.interceptor.getClassifier();
    for (const policy of policies) {
      classifier.addPolicy(policy);
    }

    this.sendJSON(res, 200, { message: 'Policies updated', count: policies.length });
  }

  private handleGetProviders(res: http.ServerResponse): void {
    this.sendJSON(res, 200, { providers: this.providerSettings });
  }

  private async handleSaveProviders(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    const body = await this.readBody(req);
    const { providers } = JSON.parse(body) as { providers: ProviderSetting[] };

    if (!Array.isArray(providers)) {
      this.sendJSON(res, 400, { error: 'Expected { providers: [...] }' });
      return;
    }

    this.providerSettings = providers;
    saveProviders(providers);
    this.sendJSON(res, 200, { message: 'Providers saved', count: providers.length });
  }

  /**
   * Returns only enabled providers — used by the approval page to show auth buttons.
   */
  private handleGetEnabledProviders(res: http.ServerResponse): void {
    const enabled = this.providerSettings.filter((p) => p.enabled);
    this.sendJSON(res, 200, { providers: enabled });
  }

  private handleGetAIOpsStats(res: http.ServerResponse): void {
    if (!this.aiops) {
      this.sendJSON(res, 200, {
        totalTrackedTools: 0,
        totalAdjustments: 0,
        pendingRecommendations: 0,
        topApproved: [],
        topRejected: [],
      });
      return;
    }
    this.sendJSON(res, 200, this.aiops.getSummary());
  }

  private handleGetAuditLog(res: http.ServerResponse): void {
    // Return from persistent storage
    const entries = getAuditEntries(100);
    this.sendJSON(res, 200, { entries });
  }

  private handleClearAuditLog(res: http.ServerResponse): void {
    clearAuditLog();
    this.auditEntries = [];
    this.sendJSON(res, 200, { message: 'Audit log cleared' });
  }

  /**
   * Record a resolved task for audit log purposes.
   * Persists to disk so entries survive server restarts.
   */
  recordResolved(task: unknown): void {
    const entry: AuditRecord = { task, resolvedAt: Date.now() };
    this.auditEntries.push(entry);
    appendAuditEntry(entry);
  }

  // ---- Helpers ----

  private readBody(req: http.IncomingMessage): Promise<string> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      req.on('data', (chunk: Buffer) => chunks.push(chunk));
      req.on('end', () => resolve(Buffer.concat(chunks).toString()));
      req.on('error', reject);
    });
  }

  private sendJSON(res: http.ServerResponse, status: number, data: unknown): void {
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data));
  }
}
