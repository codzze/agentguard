// ============================================================================
// AgentGuard Core — State Machine
// Manages the lifecycle of approval requests:
// IDLE → PENDING → WAITING_FOR_HUMAN → APPROVED | REJECTED | TIMEOUT
// ============================================================================

import { EventEmitter } from 'events';
import type {
  RequestState,
  PendingTask,
  ApprovalRequest,
  ApprovalResponse,
  SignatureEntry,
  ConsensusBundle,
  RiskPolicy,
} from '../types/index.js';
import type { ITaskStore } from '../types/index.js';

export interface StateMachineConfig {
  store: ITaskStore;
  /** Default timeout in ms if not specified in policy */
  defaultTimeoutMs?: number;
  /** Polling interval for timeout checks (ms) */
  timeoutCheckIntervalMs?: number;
}

export class ApprovalStateMachine extends EventEmitter {
  private store: ITaskStore;
  private defaultTimeoutMs: number;
  private timeoutCheckInterval: ReturnType<typeof setInterval> | null = null;
  private waitingResolvers: Map<string, {
    resolve: (result: 'approved' | 'rejected' | 'timeout') => void;
    timer: ReturnType<typeof setTimeout>;
  }> = new Map();

  constructor(config: StateMachineConfig) {
    super();
    this.store = config.store;
    this.defaultTimeoutMs = config.defaultTimeoutMs ?? 300_000; // 5 min default
  }

  /**
   * Create a new pending approval request.
   * Transitions: IDLE → PENDING → WAITING_FOR_HUMAN
   */
  async createRequest(
    request: ApprovalRequest,
    policy: RiskPolicy
  ): Promise<PendingTask> {
    const now = Date.now();
    const timeoutMs = this.parseTimeout(policy.timeout) ?? this.defaultTimeoutMs;

    const task: PendingTask = {
      request,
      state: 'PENDING',
      signatures: [],
      createdAt: now,
      updatedAt: now,
      expiresAt: now + timeoutMs,
      escalationCount: 0,
    };

    await this.store.set(request.id, task);
    this.emit('request:created', request);

    // Transition to WAITING
    task.state = 'WAITING_FOR_HUMAN';
    task.updatedAt = Date.now();
    await this.store.set(request.id, task);

    return task;
  }

  /**
   * Wait for a request to be resolved (approved, rejected, or timeout).
   * This is the blocking call used by the MCP proxy to pause the agent.
   */
  async waitForResolution(requestId: string, timeoutMs?: number): Promise<'approved' | 'rejected' | 'timeout'> {
    const task = await this.store.get(requestId);
    if (!task) throw new Error(`Request ${requestId} not found`);

    // Already resolved?
    if (task.state === 'APPROVED') return 'approved';
    if (task.state === 'REJECTED') return 'rejected';
    if (task.state === 'TIMEOUT') return 'timeout';

    const effectiveTimeout = timeoutMs ?? (task.expiresAt - Date.now());

    return new Promise((resolve) => {
      const timer = setTimeout(async () => {
        this.waitingResolvers.delete(requestId);
        await this.transitionToTimeout(requestId);
        resolve('timeout');
      }, Math.max(effectiveTimeout, 0));

      this.waitingResolvers.set(requestId, { resolve, timer });
    });
  }

  /**
   * Add a signature to a pending request.
   * Checks if consensus threshold is met.
   */
  async addSignature(
    requestId: string,
    signature: SignatureEntry,
    threshold: number
  ): Promise<{ consensusReached: boolean; task: PendingTask | null }> {
    const task = await this.store.addSignature(requestId, signature);
    if (!task) {
      return { consensusReached: false, task: null };
    }

    this.emit('signature:received', requestId, signature);

    // Check if we have signatures from enough distinct pools
    const uniquePools = new Set(task.signatures.map((s: SignatureEntry) => s.pool));
    const consensusReached = task.signatures.length >= threshold;

    if (consensusReached) {
      await this.transitionToApproved(requestId, task);
    } else {
      // Update state to PARTIAL
      task.state = 'PARTIAL_APPROVAL';
      task.updatedAt = Date.now();
      await this.store.set(requestId, task);
    }

    return { consensusReached, task };
  }

  /**
   * Handle a rejection from a human reviewer.
   */
  async handleRejection(requestId: string, response: ApprovalResponse): Promise<void> {
    const task = await this.store.get(requestId);
    if (!task) return;

    task.state = 'REJECTED';
    task.updatedAt = Date.now();
    await this.store.set(requestId, task);

    this.emit('request:rejected', response);

    // Resolve any waiting promise
    const resolver = this.waitingResolvers.get(requestId);
    if (resolver) {
      clearTimeout(resolver.timer);
      resolver.resolve('rejected');
      this.waitingResolvers.delete(requestId);
    }
  }

  /**
   * Build the consensus bundle from collected signatures.
   */
  async buildConsensusBundle(requestId: string): Promise<ConsensusBundle | null> {
    const task = await this.store.get(requestId);
    if (!task || task.state !== 'APPROVED') return null;

    const bundle: ConsensusBundle = {
      requestId,
      status: 'CONSENSUS_REACHED',
      threshold: task.request.threshold,
      signatures: task.signatures,
      traceId: task.request.traceId,
      completedAt: new Date().toISOString(),
      totalWaitTimeMs: Date.now() - task.createdAt,
    };

    return bundle;
  }

  /**
   * Escalate a request to a backup pool.
   */
  async escalate(requestId: string, newPool: string): Promise<void> {
    const task = await this.store.get(requestId);
    if (!task) return;

    task.state = 'ESCALATED';
    task.escalationCount += 1;
    task.updatedAt = Date.now();
    // Extend the timeout
    task.expiresAt = Date.now() + this.defaultTimeoutMs;
    await this.store.set(requestId, task);

    this.emit('request:escalated', requestId, newPool);
  }

  /**
   * Get the current state of a request.
   */
  async getState(requestId: string): Promise<PendingTask | null> {
    return this.store.get(requestId);
  }

  /**
   * List all pending tasks.
   */
  async listPending(): Promise<PendingTask[]> {
    return this.store.listPending();
  }

  // ── Private Helpers ──────────────────────────────────────────────────

  private async transitionToApproved(requestId: string, task: PendingTask): Promise<void> {
    task.state = 'APPROVED';
    task.updatedAt = Date.now();
    await this.store.set(requestId, task);

    const bundle = await this.buildConsensusBundle(requestId);
    if (bundle) {
      this.emit('request:approved', bundle);
    }

    // Resolve any waiting promise
    const resolver = this.waitingResolvers.get(requestId);
    if (resolver) {
      clearTimeout(resolver.timer);
      resolver.resolve('approved');
      this.waitingResolvers.delete(requestId);
    }
  }

  private async transitionToTimeout(requestId: string): Promise<void> {
    const task = await this.store.get(requestId);
    if (!task) return;

    task.state = 'TIMEOUT';
    task.updatedAt = Date.now();
    await this.store.set(requestId, task);

    this.emit('request:timeout', requestId);
  }

  private parseTimeout(timeout: string): number | null {
    const match = timeout.match(/^(\d+)(s|m|h)$/);
    if (!match) return null;

    const value = parseInt(match[1], 10);
    const unit = match[2];

    switch (unit) {
      case 's': return value * 1_000;
      case 'm': return value * 60_000;
      case 'h': return value * 3_600_000;
      default: return null;
    }
  }

  /**
   * Clean up resources.
   */
  destroy(): void {
    if (this.timeoutCheckInterval) {
      clearInterval(this.timeoutCheckInterval);
    }
    for (const [, resolver] of this.waitingResolvers) {
      clearTimeout(resolver.timer);
    }
    this.waitingResolvers.clear();
    this.removeAllListeners();
  }
}
