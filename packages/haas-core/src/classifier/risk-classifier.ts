// ============================================================================
// AgentGuard Core — Risk Classifier Engine
// Evaluates tool calls against configured policies and assigns risk tiers
// ============================================================================

import type {
  RiskTier,
  RiskPolicy,
  PolicyConfig,
  PolicyCondition,
  ApprovalRequest,
} from '../types/index.js';

export interface ClassificationResult {
  tier: RiskTier;
  policy: RiskPolicy;
  matchedConditions: PolicyCondition[];
}

export class RiskClassifier {
  private policies: RiskPolicy[];

  constructor(config: PolicyConfig | RiskPolicy[]) {
    this.policies = Array.isArray(config) ? config : config.policies;
  }

  /**
   * Classify a tool call based on configured policies.
   * Returns the highest-matching risk tier and associated policy.
   */
  classify(toolName: string, toolArgs: Record<string, unknown>): ClassificationResult {
    const matchingPolicies = this.policies
      .filter((policy) => this.matchesTool(policy, toolName))
      .map((policy) => ({
        policy,
        matchedConditions: this.evaluateConditions(policy.conditions ?? [], toolArgs),
      }))
      .filter(({ policy, matchedConditions }) => {
        // If policy has conditions, at least one must match
        if (policy.conditions && policy.conditions.length > 0) {
          return matchedConditions.length > 0;
        }
        // If no conditions, the tool name match alone is sufficient
        return true;
      });

    if (matchingPolicies.length === 0) {
      // Default: LOW risk for unclassified tools
      return {
        tier: 'LOW',
        policy: {
          tool: toolName,
          tier: 'LOW',
          threshold: 0,
          pools: [],
          timeout: '5m',
          onRejection: 'notify_agent',
          onTimeout: 'auto_deny',
          autoApprove: true,
        },
        matchedConditions: [],
      };
    }

    // Return the highest risk tier match
    const tierOrder: RiskTier[] = ['LOW', 'MID', 'HIGH', 'CRITICAL'];
    matchingPolicies.sort(
      (a, b) => tierOrder.indexOf(b.policy.tier) - tierOrder.indexOf(a.policy.tier)
    );

    const highest = matchingPolicies[0];
    return {
      tier: highest.policy.tier,
      policy: highest.policy,
      matchedConditions: highest.matchedConditions,
    };
  }

  /**
   * Check if a policy matches the given tool name.
   * Supports wildcards: "execute_*" matches "execute_transfer"
   */
  private matchesTool(policy: RiskPolicy, toolName: string): boolean {
    if (policy.tool === '*') return true;
    if (policy.tool.includes('*')) {
      const regex = new RegExp('^' + policy.tool.replace(/\*/g, '.*') + '$');
      return regex.test(toolName);
    }
    return policy.tool === toolName;
  }

  /**
   * Evaluate policy conditions against the tool arguments.
   * Returns the list of conditions that matched.
   */
  private evaluateConditions(
    conditions: PolicyCondition[],
    toolArgs: Record<string, unknown>
  ): PolicyCondition[] {
    return conditions.filter((condition) => {
      const value = this.resolveField(condition.field, toolArgs);
      if (value === undefined) return false;
      return this.evaluateOperator(value, condition.operator, condition.value);
    });
  }

  /**
   * Resolve a dot-notation field path (e.g., "args.amount") from the tool arguments.
   */
  private resolveField(field: string, obj: Record<string, unknown>): unknown {
    // Strip "args." prefix if present (conditions reference tool args)
    const path = field.startsWith('args.') ? field.slice(5) : field;
    const parts = path.split('.');

    let current: unknown = obj;
    for (const part of parts) {
      if (current === null || current === undefined || typeof current !== 'object') {
        return undefined;
      }
      current = (current as Record<string, unknown>)[part];
    }
    return current;
  }

  /**
   * Evaluate a single condition operator.
   */
  private evaluateOperator(
    actual: unknown,
    operator: PolicyCondition['operator'],
    expected: string | number | boolean
  ): boolean {
    switch (operator) {
      case '>':
        return typeof actual === 'number' && actual > (expected as number);
      case '<':
        return typeof actual === 'number' && actual < (expected as number);
      case '>=':
        return typeof actual === 'number' && actual >= (expected as number);
      case '<=':
        return typeof actual === 'number' && actual <= (expected as number);
      case '==':
        return actual === expected;
      case '!=':
        return actual !== expected;
      case 'contains':
        return typeof actual === 'string' && actual.includes(String(expected));
      case 'matches':
        return typeof actual === 'string' && new RegExp(String(expected)).test(actual);
      default:
        return false;
    }
  }

  /**
   * Add a new policy at runtime (for AIOps feedback loop).
   */
  addPolicy(policy: RiskPolicy): void {
    this.policies.push(policy);
  }

  /**
   * Update the risk tier for a specific tool (AIOps auto-tuning).
   */
  adjustRisk(toolName: string, newTier: RiskTier): void {
    const policy = this.policies.find((p) => p.tool === toolName);
    if (policy) {
      policy.tier = newTier;
    }
  }

  /**
   * Get all configured policies (for dashboard display).
   */
  getPolicies(): RiskPolicy[] {
    return [...this.policies];
  }
}
