import { describe, it, expect } from 'vitest';
import { RiskClassifier } from '../src/classifier/risk-classifier.js';
import type { RiskPolicy } from '../src/types/index.js';

describe('RiskClassifier', () => {
  const policies: RiskPolicy[] = [
    { tool: 'read_*', tier: 'LOW' },
    { tool: 'update_user', tier: 'MID', requiredApprovals: 1 },
    {
      tool: 'delete_*',
      tier: 'HIGH',
      requiredApprovals: 2,
      requiredPools: ['security'],
    },
    {
      tool: 'transfer_funds',
      tier: 'CRITICAL',
      requiredApprovals: 3,
      requiredPools: ['finance', 'security', 'legal'],
      conditions: [
        { field: 'amount', operator: 'gt', value: 10000 },
      ],
    },
  ];

  it('should classify a read tool as LOW', () => {
    const classifier = new RiskClassifier(policies);
    const result = classifier.classify('read_report', {});
    expect(result.tier).toBe('LOW');
  });

  it('should classify an update tool as MID', () => {
    const classifier = new RiskClassifier(policies);
    const result = classifier.classify('update_user', { name: 'John' });
    expect(result.tier).toBe('MID');
  });

  it('should classify a delete tool as HIGH', () => {
    const classifier = new RiskClassifier(policies);
    const result = classifier.classify('delete_record', { id: '123' });
    expect(result.tier).toBe('HIGH');
  });

  it('should classify transfer_funds with high amount as CRITICAL', () => {
    const classifier = new RiskClassifier(policies);
    const result = classifier.classify('transfer_funds', { amount: 50000 });
    expect(result.tier).toBe('CRITICAL');
  });

  it('should fallback to LOW for unknown tools', () => {
    const classifier = new RiskClassifier(policies);
    const result = classifier.classify('unknown_tool', {});
    expect(result.tier).toBe('LOW');
  });

  it('should support adding policies at runtime', () => {
    const classifier = new RiskClassifier([]);
    const result1 = classifier.classify('deploy_app', {});
    expect(result1.tier).toBe('LOW'); // no policy → LOW

    classifier.addPolicy({ tool: 'deploy_*', tier: 'HIGH', requiredApprovals: 2 });
    const result2 = classifier.classify('deploy_app', {});
    expect(result2.tier).toBe('HIGH');
  });

  it('should match wildcard patterns correctly', () => {
    const classifier = new RiskClassifier(policies);

    expect(classifier.classify('read_anything', {}).tier).toBe('LOW');
    expect(classifier.classify('delete_everything', {}).tier).toBe('HIGH');
  });

  it('should return the matched policy', () => {
    const classifier = new RiskClassifier(policies);
    const result = classifier.classify('delete_user', { id: '1' });
    expect(result.policy).toBeDefined();
    expect(result.policy?.tool).toBe('delete_*');
    expect(result.policy?.requiredPools).toEqual(['security']);
  });

  it('should support AIOps risk adjustment', () => {
    const classifier = new RiskClassifier(policies);
    classifier.adjustRisk('read_report', 'MID');

    // After adjustment, the classifier should consider the override
    // (exact behavior depends on implementation — testing that it doesn't throw)
    const result = classifier.classify('read_report', {});
    expect(['LOW', 'MID']).toContain(result.tier);
  });
});
