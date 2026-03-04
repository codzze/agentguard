/**
 * AgentGuard — MCP Server (Official SDK)
 *
 * A proper MCP server using @modelcontextprotocol/sdk that exposes
 * HaaS governance tools. Connect this to Claude Desktop, Cursor,
 * or any MCP-compatible client to secure your agentic flows.
 *
 * Tools:
 *   haas_evaluate   — Evaluate the risk level of a tool call
 *   haas_submit     — Submit a tool call for human approval
 *   haas_status     — Check the approval status of a request
 *   haas_approve    — Submit an approval/rejection for a request
 *   haas_policies   — List current risk policies
 *
 * Usage:
 *   npx tsx src/mcp/mcp-server.ts
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

import { RiskClassifier } from '../classifier/risk-classifier.js';
import { ApprovalStateMachine, StateMachineConfig } from '../state/state-machine.js';
import { InMemoryTaskStore } from '../state/store.js';
import { ConsensusAggregator, ConsensusConfig } from '../consensus/aggregator.js';
import { IdentityProviderFactory, MockIdentityProvider } from '../auth/factory.js';
import { AIOpsService } from '../aiops/feedback-loop.js';
import type { RiskPolicy, ApprovalRequest, SignatureEntry } from '../types/index.js';

// ── Default Policies ────────────────────────────────────────────────────
const DEFAULT_POLICIES: RiskPolicy[] = [
  { tool: 'read_*', tier: 'LOW', threshold: 0, pools: [], timeout: '5m', onRejection: 'notify_agent', onTimeout: 'auto_deny', autoApprove: true },
  { tool: 'list_*', tier: 'LOW', threshold: 0, pools: [], timeout: '5m', onRejection: 'notify_agent', onTimeout: 'auto_deny', autoApprove: true },
  { tool: 'get_*', tier: 'LOW', threshold: 0, pools: [], timeout: '5m', onRejection: 'notify_agent', onTimeout: 'auto_deny', autoApprove: true },
  { tool: 'update_*', tier: 'MID', threshold: 1, pools: ['general'], timeout: '3m', onRejection: 'notify_agent', onTimeout: 'auto_deny' },
  { tool: 'create_*', tier: 'MID', threshold: 1, pools: ['general'], timeout: '3m', onRejection: 'notify_agent', onTimeout: 'auto_deny' },
  { tool: 'delete_*', tier: 'HIGH', threshold: 2, pools: ['security'], timeout: '5m', onRejection: 'abort_agent', onTimeout: 'escalate' },
  { tool: 'transfer_funds', tier: 'CRITICAL', threshold: 3, pools: ['finance', 'security', 'legal'], timeout: '15m', onRejection: 'abort_agent', onTimeout: 'escalate', escalationPool: 'executive' },
];

// ── Initialize Core Components ──────────────────────────────────────────
const classifier = new RiskClassifier(DEFAULT_POLICIES);
const store = new InMemoryTaskStore();
const smConfig: StateMachineConfig = { store };
const stateMachine = new ApprovalStateMachine(smConfig);
const identityFactory = new IdentityProviderFactory();
identityFactory.register(new MockIdentityProvider());
const consensus = new ConsensusAggregator({ identityFactory });
const aiops = new AIOpsService(classifier);

// ── MCP Server ──────────────────────────────────────────────────────────
const server = new Server(
  {
    name: 'agentguard-haas',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  },
);

// ── Tool Definitions ────────────────────────────────────────────────────
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: 'haas_evaluate',
      description: 'Evaluate the risk level of a tool call before execution. Returns the risk tier (LOW/MID/HIGH/CRITICAL), the matching policy, and whether human approval is needed.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          tool_name: { type: 'string', description: 'Name of the tool being called (e.g., "transfer_funds", "delete_record")' },
          tool_args: { type: 'object', description: 'Arguments being passed to the tool', additionalProperties: true },
        },
        required: ['tool_name'],
      },
    },
    {
      name: 'haas_submit',
      description: 'Submit a tool call for human governance approval. Creates a pending approval request that human reviewers must approve before the tool can execute. Returns a request ID for tracking.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          tool_name: { type: 'string', description: 'Name of the tool to govern' },
          tool_args: { type: 'object', description: 'Tool arguments for reviewer context', additionalProperties: true },
          agent_id: { type: 'string', description: 'ID of the calling agent (optional)', default: 'mcp-agent' },
        },
        required: ['tool_name'],
      },
    },
    {
      name: 'haas_status',
      description: 'Check the current approval status of a submitted governance request. Returns the state (PENDING, WAITING_FOR_HUMAN, APPROVED, REJECTED, TIMEOUT), signatures collected, and time remaining.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          request_id: { type: 'string', description: 'The request ID returned by haas_submit' },
        },
        required: ['request_id'],
      },
    },
    {
      name: 'haas_approve',
      description: 'Submit an approval or rejection for a pending governance request. Used by human reviewers to approve or reject tool calls.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          request_id: { type: 'string', description: 'The request ID to approve/reject' },
          decision: { type: 'string', enum: ['APPROVE', 'REJECT'], description: 'Approval decision' },
          approver_id: { type: 'string', description: 'ID of the approver' },
          pool: { type: 'string', description: 'Approver pool (e.g., "finance", "security")' },
          reason: { type: 'string', description: 'Optional reason for the decision' },
        },
        required: ['request_id', 'decision', 'approver_id'],
      },
    },
    {
      name: 'haas_policies',
      description: 'List all configured risk classification policies. Shows which tools require human approval and at what level.',
      inputSchema: {
        type: 'object' as const,
        properties: {},
      },
    },
  ],
}));

// ── Tool Handlers ───────────────────────────────────────────────────────
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  switch (name) {
    case 'haas_evaluate': {
      const toolName = args?.tool_name as string;
      const toolArgs = (args?.tool_args as Record<string, unknown>) ?? {};
      const result = classifier.classify(toolName, toolArgs);

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify({
              tool: toolName,
              riskTier: result.tier,
              requiresApproval: result.tier !== 'LOW',
              policy: {
                tool: result.policy.tool,
                tier: result.policy.tier,
                threshold: result.policy.threshold,
                pools: result.policy.pools,
                timeout: result.policy.timeout,
              },
              matchedConditions: result.matchedConditions,
            }, null, 2),
          },
        ],
      };
    }

    case 'haas_submit': {
      const toolName = args?.tool_name as string;
      const toolArgs = (args?.tool_args as Record<string, unknown>) ?? {};
      const agentId = (args?.agent_id as string) ?? 'mcp-agent';

      const classification = classifier.classify(toolName, toolArgs);

      if (classification.tier === 'LOW') {
        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              status: 'auto-approved',
              riskTier: 'LOW',
              message: `Tool "${toolName}" is LOW risk and auto-approved. Proceed with execution.`,
            }, null, 2),
          }],
        };
      }

      const requestId = `req-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 10)}`;
      const request: ApprovalRequest = {
        id: requestId,
        agentId,
        toolName,
        toolArgs,
        riskTier: classification.tier,
        threshold: classification.policy.threshold,
        requiredPools: classification.policy.pools,
        traceId: requestId,
        createdAt: new Date().toISOString(),
        ttl: 300,
      };

      await stateMachine.createRequest(request, classification.policy);

      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            status: 'pending-approval',
            requestId,
            riskTier: classification.tier,
            requiredApprovals: classification.policy.threshold,
            pools: classification.policy.pools,
            timeout: classification.policy.timeout,
            message: `Tool "${toolName}" classified as ${classification.tier} risk. Awaiting human approval. Use haas_status to check progress or haas_approve to submit a decision.`,
          }, null, 2),
        }],
      };
    }

    case 'haas_status': {
      const requestId = args?.request_id as string;
      const task = await stateMachine.getState(requestId);

      if (!task) {
        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({ error: `Request ${requestId} not found` }, null, 2),
          }],
          isError: true,
        };
      }

      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            requestId,
            state: task.state,
            toolName: task.request.toolName,
            riskTier: task.request.riskTier,
            signatures: task.signatures.length,
            requiredSignatures: task.request.threshold,
            pools: task.request.requiredPools,
            timeRemainingMs: Math.max(0, task.expiresAt - Date.now()),
            createdAt: new Date(task.createdAt).toISOString(),
          }, null, 2),
        }],
      };
    }

    case 'haas_approve': {
      const requestId = args?.request_id as string;
      const decision = args?.decision as string;
      const approverId = args?.approver_id as string;
      const pool = (args?.pool as string) ?? 'general';
      const reason = args?.reason as string | undefined;

      if (decision === 'REJECT') {
        await stateMachine.handleRejection(requestId, {
          requestId,
          decision: 'REJECTED',
          reason: reason ?? 'Rejected via MCP',
          approver: { peerId: approverId, identityHash: '', provider: 'mcp', pool },
          signature: `mcp-sig-${Date.now()}`,
          timestamp: new Date().toISOString(),
        });

        const task = await stateMachine.getState(requestId);
        if (task) {
          aiops.recordRejection(task.request.toolName, task.request.riskTier, reason);
        }

        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              status: 'rejected',
              requestId,
              message: `Request ${requestId} has been REJECTED.`,
              reason,
            }, null, 2),
          }],
        };
      }

      const signature: SignatureEntry = {
        pool,
        approverId,
        signature: `mcp-sig-${Date.now()}`,
        identityHash: `mcp-hash-${approverId}`,
        provider: 'mcp',
        timestamp: new Date().toISOString(),
      };

      const task = await stateMachine.getState(requestId);
      const threshold = task?.request.threshold ?? 1;
      const result = await stateMachine.addSignature(requestId, signature, threshold);

      if (task) {
        aiops.recordApproval(task.request.toolName, task.request.riskTier);
      }

      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            status: result.consensusReached ? 'approved' : 'partial',
            requestId,
            consensusReached: result.consensusReached,
            signatures: result.task?.signatures.length ?? 0,
            required: threshold,
            message: result.consensusReached
              ? `Request ${requestId} has been APPROVED. The tool can now execute.`
              : `Signature recorded. ${result.task?.signatures.length ?? 0}/${threshold} approvals collected.`,
          }, null, 2),
        }],
      };
    }

    case 'haas_policies': {
      const policies = classifier.getPolicies();
      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            totalPolicies: policies.length,
            policies: policies.map((p) => ({
              tool: p.tool,
              tier: p.tier,
              threshold: p.threshold,
              pools: p.pools,
              timeout: p.timeout,
              autoApprove: p.autoApprove,
            })),
          }, null, 2),
        }],
      };
    }

    default:
      return {
        content: [{
          type: 'text' as const,
          text: `Unknown tool: ${name}`,
        }],
        isError: true,
      };
  }
});

// ── Start ───────────────────────────────────────────────────────────────
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('🛡️  AgentGuard HaaS MCP Server running on stdio');
}

main().catch((err) => {
  console.error('Failed to start MCP server:', err);
  process.exit(1);
});
