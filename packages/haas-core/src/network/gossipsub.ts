import { P2PNode } from './p2p.js';
import type { ApprovalRequest, ApprovalResponse } from '../types/index.js';

export interface GossipSubManagerConfig {
  /** Prefix for all HaaS topics (default: "haas") */
  topicPrefix: string;
  /** Message TTL in milliseconds */
  messageTTL: number;
}

const DEFAULT_CONFIG: GossipSubManagerConfig = {
  topicPrefix: 'haas',
  messageTTL: 5 * 60 * 1000, // 5 minutes
};

/**
 * Higher-level GossipSub topic management built on top of P2PNode.
 *
 * Responsibilities:
 * - Topic naming conventions (haas/finance, haas/security, etc.)
 * - Message serialization/deserialization with envelopes
 * - Message deduplication
 * - TTL enforcement for stale RFAs
 */
export class GossipSubManager {
  private node: P2PNode;
  private config: GossipSubManagerConfig;
  private seenMessages: Map<string, number> = new Map();
  private handlers: Map<string, Set<(msg: GossipMessage) => void>> = new Map();
  private cleanupInterval: ReturnType<typeof setInterval> | null = null;

  constructor(node: P2PNode, config: Partial<GossipSubManagerConfig> = {}) {
    this.node = node;
    this.config = { ...DEFAULT_CONFIG, ...config };

    // Wire up raw P2P messages
    this.node.on('message', (topic: string, data: Uint8Array, from: string) => {
      this.handleRawMessage(topic, data, from);
    });

    // Start stale-message cleanup
    this.cleanupInterval = setInterval(() => this.cleanupStaleMessages(), 60_000);
  }

  /**
   * Subscribe to a pool topic and register a handler.
   */
  onPoolMessage(pool: string, handler: (msg: GossipMessage) => void): void {
    const topic = this.toTopic(pool);
    this.node.subscribe(topic);

    if (!this.handlers.has(topic)) {
      this.handlers.set(topic, new Set());
    }
    this.handlers.get(topic)!.add(handler);
  }

  /**
   * Unsubscribe from a pool topic.
   */
  offPoolMessage(pool: string, handler?: (msg: GossipMessage) => void): void {
    const topic = this.toTopic(pool);
    if (handler && this.handlers.has(topic)) {
      this.handlers.get(topic)!.delete(handler);
      if (this.handlers.get(topic)!.size === 0) {
        this.node.unsubscribe(topic);
        this.handlers.delete(topic);
      }
    } else {
      this.node.unsubscribe(topic);
      this.handlers.delete(topic);
    }
  }

  /**
   * Publish an RFA (Request for Approval) to a pool.
   */
  async publishRFA(pool: string, request: ApprovalRequest): Promise<void> {
    const envelope: GossipEnvelope = {
      id: `rfa-${request.id}-${Date.now()}`,
      type: 'RFA',
      timestamp: Date.now(),
      ttl: this.config.messageTTL,
      payload: { ...request } as unknown as Record<string, unknown>,
    };
    const topic = this.toTopic(pool);
    const data = new TextEncoder().encode(JSON.stringify(envelope));
    await this.node.publish(topic, data);
  }

  /**
   * Publish an approval response to a pool.
   */
  async publishResponse(pool: string, response: ApprovalResponse): Promise<void> {
    const envelope: GossipEnvelope = {
      id: `resp-${response.requestId}-${response.approver.peerId}-${Date.now()}`,
      type: 'RESPONSE',
      timestamp: Date.now(),
      ttl: this.config.messageTTL,
      payload: { ...response } as unknown as Record<string, unknown>,
    };
    const topic = this.toTopic(pool);
    const data = new TextEncoder().encode(JSON.stringify(envelope));
    await this.node.publish(topic, data);
  }

  /**
   * Broadcast an RFA to multiple pools simultaneously.
   */
  async broadcastRFA(pools: string[], request: ApprovalRequest): Promise<void> {
    await Promise.allSettled(pools.map((pool) => this.publishRFA(pool, request)));
  }

  /**
   * Clean up resources.
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.handlers.clear();
    this.seenMessages.clear();
  }

  // ---- Private ----

  private handleRawMessage(topic: string, data: Uint8Array, from: string): void {
    try {
      const text = new TextDecoder().decode(data);
      const envelope: GossipEnvelope = JSON.parse(text);

      // Dedup
      if (this.seenMessages.has(envelope.id)) return;
      this.seenMessages.set(envelope.id, Date.now());

      // TTL check
      if (Date.now() - envelope.timestamp > envelope.ttl) return;

      const message: GossipMessage = {
        envelope,
        topic,
        from,
        receivedAt: Date.now(),
      };

      // Dispatch to registered handlers
      const handlers = this.handlers.get(topic);
      if (handlers) {
        for (const handler of handlers) {
          try {
            handler(message);
          } catch {
            // Individual handler failure shouldn't stop others
          }
        }
      }
    } catch {
      // Malformed messages are silently dropped
    }
  }

  private cleanupStaleMessages(): void {
    const now = Date.now();
    const maxAge = this.config.messageTTL * 2;
    for (const [id, timestamp] of this.seenMessages) {
      if (now - timestamp > maxAge) {
        this.seenMessages.delete(id);
      }
    }
  }

  private toTopic(pool: string): string {
    return `${this.config.topicPrefix}/${pool}`;
  }
}

// ---- Types ----

export interface GossipEnvelope {
  id: string;
  type: 'RFA' | 'RESPONSE' | 'HEARTBEAT';
  timestamp: number;
  ttl: number;
  payload: Record<string, unknown>;
}

export interface GossipMessage {
  envelope: GossipEnvelope;
  topic: string;
  from: string;
  receivedAt: number;
}
