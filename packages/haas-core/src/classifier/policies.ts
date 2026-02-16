import * as fs from 'fs';
import * as path from 'path';
import type { RiskPolicy, PolicyConfig } from '../types/index.js';

/**
 * YAML/JSON Policy Loader
 *
 * Loads risk classification policies from YAML or JSON files.
 * Supports:
 * - JSON files (.json)
 * - YAML files (.yml, .yaml) — requires optional `js-yaml` dependency
 * - Inline policy objects
 */
export class PolicyLoader {
  /**
   * Load policies from a file path or inline config.
   */
  static async load(source: string | PolicyConfig): Promise<RiskPolicy[]> {
    if (typeof source !== 'string') {
      return source.policies;
    }

    const filePath = path.resolve(source);
    const content = fs.readFileSync(filePath, 'utf-8');
    const ext = path.extname(filePath).toLowerCase();

    if (ext === '.json') {
      return PolicyLoader.parseJSON(content);
    } else if (ext === '.yml' || ext === '.yaml') {
      return PolicyLoader.parseYAML(content);
    } else {
      throw new Error(`Unsupported policy file format: ${ext}. Use .json, .yml, or .yaml`);
    }
  }

  /**
   * Parse JSON policy content.
   */
  private static parseJSON(content: string): RiskPolicy[] {
    const parsed = JSON.parse(content);
    return PolicyLoader.extractPolicies(parsed);
  }

  /**
   * Parse YAML policy content.
   * Requires `js-yaml` to be installed as an optional dependency.
   */
  private static async parseYAML(content: string): Promise<RiskPolicy[]> {
    try {
      // Dynamic import for optional dependency
      const { parse } = await import('yaml');
      const parsed = parse(content) as Record<string, unknown>;
      return PolicyLoader.extractPolicies(parsed);
    } catch (err: unknown) {
      if (err instanceof Error && err.message.includes('Cannot find module')) {
        throw new Error(
          'YAML support requires the "yaml" package. Install it with: npm install yaml',
        );
      }
      throw err;
    }
  }

  /**
   * Extract risk policies from a parsed configuration object.
   * Supports both { policies: [...] } and direct array format.
   */
  private static extractPolicies(parsed: unknown): RiskPolicy[] {
    if (Array.isArray(parsed)) {
      return PolicyLoader.validatePolicies(parsed);
    }

    if (parsed && typeof parsed === 'object' && 'policies' in parsed) {
      const config = parsed as PolicyConfig;
      return PolicyLoader.validatePolicies(config.policies);
    }

    throw new Error('Invalid policy format. Expected { policies: [...] } or a direct array.');
  }

  /**
   * Validate an array of policy objects.
   */
  private static validatePolicies(policies: unknown[]): RiskPolicy[] {
    return policies.map((p, i) => {
      if (!p || typeof p !== 'object') {
        throw new Error(`Policy at index ${i} is not an object`);
      }

      const policy = p as Record<string, unknown>;

      if (!policy.tool || typeof policy.tool !== 'string') {
        throw new Error(`Policy at index ${i} is missing required "tool" field (string)`);
      }

      if (!policy.tier || !['LOW', 'MID', 'HIGH', 'CRITICAL'].includes(policy.tier as string)) {
        throw new Error(
          `Policy at index ${i} has invalid "tier" (must be LOW, MID, HIGH, or CRITICAL)`,
        );
      }

      return {
        tool: policy.tool as string,
        tier: policy.tier as RiskPolicy['tier'],
        threshold: typeof policy.threshold === 'number'
          ? policy.threshold
          : 1,
        pools: Array.isArray(policy.pools)
          ? policy.pools as string[]
          : ['general'],
        timeout: typeof policy.timeout === 'string' ? policy.timeout : '5m',
        onRejection: typeof policy.onRejection === 'string'
          ? policy.onRejection as RiskPolicy['onRejection']
          : 'notify_agent',
        onTimeout: typeof policy.onTimeout === 'string'
          ? policy.onTimeout as RiskPolicy['onTimeout']
          : 'auto_deny',
        conditions: Array.isArray(policy.conditions) ? policy.conditions : undefined,
        escalationPool: typeof policy.escalationPool === 'string' ? policy.escalationPool : undefined,
        autoApprove: typeof policy.autoApprove === 'boolean' ? policy.autoApprove : undefined,
      };
    });
  }

  /**
   * Watch a policy file for changes and reload automatically.
   */
  static watch(
    filePath: string,
    onChange: (policies: RiskPolicy[]) => void,
  ): fs.FSWatcher {
    const resolvedPath = path.resolve(filePath);
    return fs.watch(resolvedPath, async (eventType) => {
      if (eventType === 'change') {
        try {
          const policies = await PolicyLoader.load(resolvedPath);
          onChange(policies);
        } catch {
          // Ignore reload errors (file may be mid-write)
        }
      }
    });
  }
}
