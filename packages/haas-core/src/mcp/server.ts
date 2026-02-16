import http from 'http';
import { EventEmitter } from 'events';
import { MCPInterceptor, MCPToolCall, MCPToolResult } from './interceptor.js';
import type { HaaSCoreConfig } from '../types/index.js';

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

  constructor(config: MCPServerConfig) {
    super();
    this.interceptor = new MCPInterceptor(config);
    this.port = config.port ?? 3100;
    this.host = config.host ?? '0.0.0.0';
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

    // The "upstream" execute function — in a real deployment this would forward
    // to the actual MCP server. Here we return a placeholder.
    const executeFn = async (call: MCPToolCall): Promise<MCPToolResult> => {
      return {
        content: [{ type: 'text', text: `Tool "${call.params.name}" executed successfully.` }],
      };
    };

    const result = await this.interceptor.intercept(toolCall, executeFn);
    this.sendJSON(res, result.isError ? 403 : 200, result);
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

    const result = await this.interceptor.submitSignature(requestId, signature, threshold ?? 1);
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
