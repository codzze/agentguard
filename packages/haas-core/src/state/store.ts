// ============================================================================
// AgentGuard Core — In-Memory Task Store
// Development/testing implementation of ITaskStore
// For production, use the Redis-backed store
// ============================================================================

import type { ITaskStore } from '../types/index.js';
import type { PendingTask, RequestState, SignatureEntry } from '../types/index.js';

export class InMemoryTaskStore implements ITaskStore {
  private tasks: Map<string, PendingTask> = new Map();

  async set(id: string, task: PendingTask): Promise<void> {
    this.tasks.set(id, structuredClone(task));
  }

  async get(id: string): Promise<PendingTask | null> {
    const task = this.tasks.get(id);
    return task ? structuredClone(task) : null;
  }

  async delete(id: string): Promise<void> {
    this.tasks.delete(id);
  }

  async listPending(): Promise<PendingTask[]> {
    const pending: PendingTask[] = [];
    for (const task of this.tasks.values()) {
      if (
        task.state === 'PENDING' ||
        task.state === 'WAITING_FOR_HUMAN' ||
        task.state === 'PARTIAL_APPROVAL'
      ) {
        pending.push(structuredClone(task));
      }
    }
    return pending;
  }

  async updateState(id: string, state: RequestState): Promise<void> {
    const task = this.tasks.get(id);
    if (task) {
      task.state = state;
      task.updatedAt = Date.now();
    }
  }

  async addSignature(id: string, signature: SignatureEntry): Promise<PendingTask | null> {
    const task = this.tasks.get(id);
    if (!task) return null;

    // Prevent duplicate signatures from the same approver
    const alreadySigned = task.signatures.some(
      (s: SignatureEntry) => s.approverId === signature.approverId
    );
    if (alreadySigned) return task;

    task.signatures.push(signature);
    task.updatedAt = Date.now();
    return structuredClone(task);
  }

  /** Clear all tasks (testing utility) */
  clear(): void {
    this.tasks.clear();
  }
}
