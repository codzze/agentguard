import { EventEmitter } from 'events';
import type {
  ApprovalRequest,
  SignatureEntry,
  RiskTier,
  RiskPolicy,
} from '../types/index.js';
import type { HaaSCoreConfig, ToolCallResult } from '../types/index.js';
import { RiskClassifier } from '../classifier/risk-classifier.js';
import { ApprovalStateMachine, StateMachineConfig } from '../state/state-machine.js';
import { InMemoryTaskStore } from '../state/store.js';
import { IdentityProviderFactory } from '../auth/factory.js';
import { ConsensusAggregator, ConsensusConfig } from '../consensus/aggregator.js';

export interface MCPToolCall {
  method: string;
  params: {
    name: string;
    arguments?: Record<string, unknown>;
  };
}

export interface MCPToolResult {
  content: Array<{ type: string; text: string }>;
  isError?: boolean;
}

/**
 * MCP Tool Call Interceptor
 *
 * Sits between the AI agent's MCP client and the actual MCP server.
 * Intercepts tool calls, classifies risk, and routes to human approval
 * when necessary.
 *
 * LOW risk → passthrough (auto-approve)
 * MID risk → single-sig approval
 * HIGH risk → multi-sig approval
 * CRITICAL risk → cross-pool multi-sig with executive escalation
 */
export class MCPInterceptor extends EventEmitter {
  private classifier: RiskClassifier;
  private stateMachine: ApprovalStateMachine;
  private identityFactory: IdentityProviderFactory;
  private consensus: ConsensusAggregator;
  private config: HaaSCoreConfig;

  constructor(config: HaaSCoreConfig) {
    super();
    this.config = config;

    const store = new InMemoryTaskStore();
    const policies = typeof config.policies === 'string' ? [] : (config.policies?.policies ?? []);
    this.classifier = new RiskClassifier(policies);

    const smConfig: StateMachineConfig = { store };
    this.stateMachine = new ApprovalStateMachine(smConfig);

    this.identityFactory = new IdentityProviderFactory();
    const consensusConfig: ConsensusConfig = { identityFactory: this.identityFactory };
    this.consensus = new ConsensusAggregator(consensusConfig);
  }

  /**
   * Intercept and govern a tool call.
   *
   * @returns The tool result if approved, or an error result if denied/timeout
   */
  async intercept(
    toolCall: MCPToolCall,
    executeToolFn: (call: MCPToolCall) => Promise<MCPToolResult>,
  ): Promise<MCPToolResult> {
    const toolName = toolCall.params.name;
    const toolArgs = toolCall.params.arguments ?? {};

    // 1. Classify risk
    const classification = this.classifier.classify(toolName, toolArgs);
    const tier = classification.tier;
    const policy = classification.policy;
    this.emit('tool:intercepted', toolName, tier);

    // 2. LOW risk → passthrough
    if (tier === 'LOW') {
      this.emit('tool:passthrough', toolName);
      return executeToolFn(toolCall);
    }

    // 3. Determine approval parameters
    const threshold = policy?.threshold ?? this.getDefaultThreshold(tier);
    const pools = policy?.pools ?? ['general'];
    const timeoutMs = this.parseTimeoutMs(policy?.timeout) ?? this.getDefaultTimeout(tier);

    // 4. Create approval request
    const requestId = this.generateRequestId();
    const request: ApprovalRequest = {
      id: requestId,
      agentId: 'agent-default',
      toolName,
      toolArgs,
      riskTier: tier,
      threshold,
      requiredPools: pools,
      traceId: requestId,
      createdAt: new Date().toISOString(),
      ttl: Math.round(timeoutMs / 1000),
    };

    // 5. Build a fallback policy for state machine if no explicit match
    const effectivePolicy: RiskPolicy = policy ?? {
      tool: toolName,
      tier,
      threshold,
      pools,
      timeout: `${Math.round(timeoutMs / 1000)}s`,
      onRejection: 'notify_agent',
      onTimeout: 'auto_deny',
    };

    // 6. Submit to state machine
    await this.stateMachine.createRequest(request, effectivePolicy);

    // 7. Wait for human resolution
    try {
      const result = await this.stateMachine.waitForResolution(requestId, timeoutMs);

      if (result === 'approved') {
        this.emit('tool:approved', requestId);
        return executeToolFn(toolCall);
      } else if (result === 'rejected') {
        this.emit('tool:rejected', requestId, 'Rejected by reviewer');
        return this.createErrorResult(`Tool call "${toolName}" was rejected by a reviewer.`);
      } else {
        this.emit('tool:timeout', requestId);
        return this.createErrorResult(
          `Tool call "${toolName}" timed out waiting for approval (${timeoutMs}ms)`,
        );
      }
    } catch (err: unknown) {
      return this.createErrorResult(
        `Governance error for "${toolName}": ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  /**
   * Submit an external approval/rejection signature (from P2P network or dashboard).
   */
  async submitSignature(
    requestId: string,
    signature: SignatureEntry,
    threshold: number,
  ): Promise<{ consensusReached: boolean }> {
    const result = await this.stateMachine.addSignature(requestId, signature, threshold);
    return { consensusReached: result.consensusReached };
  }

  /**
   * Get the risk classifier for external configuration.
   */
  getClassifier(): RiskClassifier {
    return this.classifier;
  }

  /**
   * Get the identity provider factory.
   */
  getIdentityFactory(): IdentityProviderFactory {
    return this.identityFactory;
  }

  /**
   * Get the state machine for status queries.
   */
  getStateMachine(): ApprovalStateMachine {
    return this.stateMachine;
  }

  // ---- Private helpers ----

  private getDefaultThreshold(tier: RiskTier): number {
    switch (tier) {
      case 'MID': return 1;
      case 'HIGH': return 2;
      case 'CRITICAL': return 3;
      default: return 1;
    }
  }

  private getDefaultTimeout(tier: RiskTier): number {
    switch (tier) {
      case 'MID': return 2 * 60 * 1000;     // 2 minutes
      case 'HIGH': return 5 * 60 * 1000;     // 5 minutes
      case 'CRITICAL': return 15 * 60 * 1000; // 15 minutes
      default: return 5 * 60 * 1000;
    }
  }

  private parseTimeoutMs(timeout?: string): number | undefined {
    if (!timeout) return undefined;
    const match = timeout.match(/^(\d+)(s|m|h)$/);
    if (!match) return undefined;
    const value = parseInt(match[1], 10);
    switch (match[2]) {
      case 's': return value * 1000;
      case 'm': return value * 60 * 1000;
      case 'h': return value * 60 * 60 * 1000;
      default: return undefined;
    }
  }

  private createErrorResult(message: string): MCPToolResult {
    return {
      content: [{ type: 'text', text: message }],
      isError: true,
    };
  }

  private generateRequestId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 10);
    return `req-${timestamp}-${random}`;
  }
}
