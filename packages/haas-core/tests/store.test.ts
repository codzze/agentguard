import { describe, it, expect, beforeEach } from 'vitest';
import { InMemoryTaskStore } from '../src/state/store.js';
import type { PendingTask, ApprovalRequest, SignatureEntry } from '../src/types/index.js';

describe('InMemoryTaskStore', () => {
  let store: InMemoryTaskStore;

  beforeEach(() => {
    store = new InMemoryTaskStore();
  });

  const createTask = (id: string): PendingTask => ({
    request: {
      id,
      agentId: 'test-agent',
      toolName: 'test_tool',
      toolArgs: { key: 'value' },
      riskTier: 'MID',
      requiredApprovals: 1,
      pools: ['general'],
      timestamp: new Date().toISOString(),
      ttlMs: 300000,
      metadata: {},
    } as ApprovalRequest,
    state: 'PENDING',
    signatures: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
    expiresAt: Date.now() + 300000,
    escalationCount: 0,
  });

  it('should store and retrieve a task', async () => {
    const task = createTask('task-1');
    await store.set('task-1', task);

    const retrieved = await store.get('task-1');
    expect(retrieved).toBeDefined();
    expect(retrieved?.request.id).toBe('task-1');
  });

  it('should return null for missing tasks', async () => {
    const result = await store.get('nonexistent');
    expect(result).toBeNull();
  });

  it('should delete tasks', async () => {
    const task = createTask('task-2');
    await store.set('task-2', task);
    await store.delete('task-2');

    const result = await store.get('task-2');
    expect(result).toBeNull();
  });

  it('should list pending tasks', async () => {
    await store.set('t1', createTask('t1'));
    await store.set('t2', createTask('t2'));

    const pending = await store.listPending();
    expect(pending.length).toBe(2);
  });

  it('should update task state', async () => {
    await store.set('t1', createTask('t1'));
    await store.updateState('t1', 'APPROVED');

    const task = await store.get('t1');
    expect(task?.state).toBe('APPROVED');
  });

  it('should add a signature to a task', async () => {
    await store.set('t1', createTask('t1'));

    const signature: SignatureEntry = {
      approverId: 'reviewer-1',
      pool: 'general',
      decision: 'APPROVE',
      timestamp: new Date().toISOString(),
    };

    const updated = await store.addSignature('t1', signature);
    expect(updated).toBeDefined();
    expect(updated?.signatures.length).toBe(1);
    expect(updated?.signatures[0].approverId).toBe('reviewer-1');
  });

  it('should return isolated copies (no shared references)', async () => {
    const task = createTask('t1');
    await store.set('t1', task);

    const copy1 = await store.get('t1');
    const copy2 = await store.get('t1');

    // Mutating one copy should not affect the other
    if (copy1) {
      copy1.state = 'APPROVED';
    }

    expect(copy2?.state).toBe('PENDING');
  });
});
