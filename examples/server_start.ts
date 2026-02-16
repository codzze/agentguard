/**
 * AgentGuard Core — Quick Start Example
 *
 * Demonstrates starting the MCP proxy server with risk policies
 * and identity providers configured.
 *
 * Usage:
 *   npx ts-node examples/server_start.ts
 */

import {
  MCPProxyServer,
  PolicyLoader,
  IdentityProviderFactory,
  MockIdentityProvider,
  GitHubIdentityProvider,
} from '@agentguard/core';
import type { HaaSCoreConfig } from '@agentguard/core';

async function main() {
  console.log('🛡️  AgentGuard — Starting HaaS Core...\n');

  // Load risk policies
  const policies = await PolicyLoader.load('./config/risk-policies.example.yml');
  console.log(`📋 Loaded ${policies.length} risk policies`);

  // Configure the server
  const config: HaaSCoreConfig = {
    policies: { policies },
    identity: ['mock', 'github'],
    port: 3100,
    inMemoryStore: true,
    telemetry: {
      endpoint: 'http://localhost:4317',
      serviceName: 'agentguard-core',
    },
  };

  // Start the MCP proxy
  const server = new MCPProxyServer(config);

  server.on('started', ({ port, host }: { port: number; host: string }) => {
    console.log(`\n🚀 HaaS Core running at http://${host}:${port}`);
    console.log('\nEndpoints:');
    console.log('  POST /mcp/tools/call  — Intercept tool calls');
    console.log('  POST /mcp/approve     — Submit approvals');
    console.log('  GET  /pending         — List pending tasks');
    console.log('  GET  /health          — Health check');
    console.log('\n⏳ Waiting for agent tool calls...');
  });

  await server.start();
}

main().catch(console.error);
