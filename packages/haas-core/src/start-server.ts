/**
 * AgentGuard Core — Standalone Server Start
 *
 * Starts the MCP proxy server with default risk policies and a mock identity provider.
 *
 * Usage:
 *   npm run build && npm start
 *   -- or --
 *   npx tsx src/start-server.ts
 */

import { MCPProxyServer } from './mcp/server.js';
import { MockIdentityProvider, IdentityProviderFactory } from './auth/factory.js';
import type { HaaSCoreConfig } from './types/index.js';
import type { RiskPolicy } from './types/index.js';

// ── Default risk policies (used when no YAML file is available) ──────────
const DEFAULT_POLICIES: RiskPolicy[] = [
  {
    tool: 'read_*',
    tier: 'LOW',
    threshold: 0,
    pools: [],
    timeout: '5m',
    onRejection: 'notify_agent',
    onTimeout: 'auto_deny',
    autoApprove: true,
  },
  {
    tool: 'list_*',
    tier: 'LOW',
    threshold: 0,
    pools: [],
    timeout: '5m',
    onRejection: 'notify_agent',
    onTimeout: 'auto_deny',
    autoApprove: true,
  },
  {
    tool: 'get_*',
    tier: 'LOW',
    threshold: 0,
    pools: [],
    timeout: '5m',
    onRejection: 'notify_agent',
    onTimeout: 'auto_deny',
    autoApprove: true,
  },
  {
    tool: 'search_*',
    tier: 'LOW',
    threshold: 0,
    pools: [],
    timeout: '5m',
    onRejection: 'notify_agent',
    onTimeout: 'auto_deny',
    autoApprove: true,
  },
  {
    tool: 'update_*',
    tier: 'MID',
    threshold: 1,
    pools: ['general'],
    timeout: '3m',
    onRejection: 'notify_agent',
    onTimeout: 'auto_deny',
  },
  {
    tool: 'create_*',
    tier: 'MID',
    threshold: 1,
    pools: ['general'],
    timeout: '3m',
    onRejection: 'notify_agent',
    onTimeout: 'auto_deny',
  },
  {
    tool: 'delete_*',
    tier: 'HIGH',
    threshold: 2,
    pools: ['security'],
    timeout: '5m',
    onRejection: 'abort_agent',
    onTimeout: 'escalate',
  },
  {
    tool: 'apply_discount',
    tier: 'HIGH',
    threshold: 2,
    pools: ['finance'],
    timeout: '5m',
    onRejection: 'notify_agent',
    onTimeout: 'auto_deny',
    conditions: [{ field: 'percentage', operator: '>', value: 15 }],
  },
  {
    tool: 'transfer_funds',
    tier: 'CRITICAL',
    threshold: 3,
    pools: ['finance', 'security', 'legal'],
    timeout: '15m',
    onRejection: 'abort_agent',
    onTimeout: 'escalate',
    escalationPool: 'executive',
  },
  {
    tool: 'delete_production_*',
    tier: 'CRITICAL',
    threshold: 3,
    pools: ['engineering', 'security', 'executive'],
    timeout: '15m',
    onRejection: 'abort_agent',
    onTimeout: 'escalate',
  },
];

async function main(): Promise<void> {
  console.log('🛡️  AgentGuard — Starting HaaS Core...\n');

  // Try loading policies from YAML, fall back to defaults
  let policies: RiskPolicy[] = DEFAULT_POLICIES;
  try {
    const { PolicyLoader } = await import('./classifier/policies.js');
    const loaded = await PolicyLoader.load('../../config/risk-policies.example.yml');
    if (loaded.length > 0) {
      policies = loaded;
    }
  } catch {
    console.log('📋 Using default built-in risk policies');
  }

  console.log(`📋 Loaded ${policies.length} risk policies`);

  const config: HaaSCoreConfig = {
    policies: { policies },
    identity: ['mock'],
    port: 3100,
    inMemoryStore: true,
  };

  const server = new MCPProxyServer(config);

  server.on('started', ({ port, host }: { port: number; host: string }) => {
    console.log(`\n🚀 HaaS Core running at http://${host === '0.0.0.0' ? 'localhost' : host}:${port}`);
    console.log('\nEndpoints:');
    console.log('  POST /mcp/tools/call  — Intercept tool calls');
    console.log('  POST /mcp/approve     — Submit approvals');
    console.log('  GET  /pending         — List pending tasks');
    console.log('  GET  /health          — Health check');
    console.log('\n⏳ Waiting for agent tool calls...\n');
  });

  await server.start();
}

main().catch((err) => {
  console.error('❌ Failed to start AgentGuard Core:', err);
  process.exit(1);
});
