import { EventEmitter } from 'events';
import type { P2PConfig } from '../types/index.js';

export interface P2PNodeEvents {
  'peer:connect': (peerId: string) => void;
  'peer:disconnect': (peerId: string) => void;
  'message': (topic: string, data: Uint8Array, from: string) => void;
  'error': (error: Error) => void;
}

/**
 * Wraps LibP2P with GossipSub for decentralized RFA broadcasting.
 *
 * Responsibilities:
 * - Bootstrap a LibP2P node (TCP + Noise + Yamux)
 * - Manage GossipSub topic subscriptions
 * - Broadcast and receive encrypted RFA messages
 * - Emit events for upstream consumption (state machine, consensus)
 */
export class P2PNode extends EventEmitter {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private node: any = null;
  private config: P2PConfig;
  private subscribedTopics: Set<string> = new Set();

  constructor(config: P2PConfig) {
    super();
    this.config = config;
  }

  /**
   * Start the LibP2P node with GossipSub.
   */
  async start(): Promise<void> {
    // Dynamic imports for ESM-only libp2p packages
    const { createLibp2p } = await import('libp2p');
    const { gossipsub } = await import('@chainsafe/libp2p-gossipsub');
    const { noise } = await import('@chainsafe/libp2p-noise');
    const { yamux } = await import('@chainsafe/libp2p-yamux');
    const { tcp } = await import('@libp2p/tcp');
    const { identify } = await import('@libp2p/identify');

    this.node = await createLibp2p({
      addresses: {
        listen: this.config.listenAddresses ?? ['/ip4/0.0.0.0/tcp/0'],
      },
      transports: [tcp()],
      streamMuxers: [yamux()],
      connectionEncrypters: [noise()],
      services: {
        identify: identify(),
        pubsub: gossipsub({
          emitSelf: false,
          fallbackToFloodsub: true,
          allowPublishToZeroTopicPeers: true,
        }) as any,
      },
    });

    // Wire peer events
    this.node.addEventListener('peer:connect', (evt: any) => {
      const peerId = evt.detail.toString();
      this.emit('peer:connect', peerId);
    });

    this.node.addEventListener('peer:disconnect', (evt: any) => {
      const peerId = evt.detail.toString();
      this.emit('peer:disconnect', peerId);
    });

    // Wire GossipSub message handler
    const pubsub = this.getPubsub();
    pubsub.addEventListener('message', (evt: any) => {
      const { topic, data } = evt.detail;
      const from = evt.detail.from?.toString() ?? 'unknown';
      this.emit('message', topic, data, from);
    });

    // Connect to bootstrap peers
    if (this.config.bootstrapPeers?.length) {
      await this.connectToBootstrapPeers(this.config.bootstrapPeers);
    }

    await this.node.start();
  }

  /**
   * Stop the LibP2P node and clean up resources.
   */
  async stop(): Promise<void> {
    if (!this.node) return;

    // Unsubscribe all topics
    const pubsub = this.getPubsub();
    for (const topic of this.subscribedTopics) {
      pubsub.unsubscribe(topic);
    }
    this.subscribedTopics.clear();

    await this.node.stop();
    this.node = null;
  }

  /**
   * Subscribe to a GossipSub topic (e.g., "haas/finance").
   */
  subscribe(topic: string): void {
    const pubsub = this.getPubsub();
    pubsub.subscribe(topic);
    this.subscribedTopics.add(topic);
  }

  /**
   * Unsubscribe from a GossipSub topic.
   */
  unsubscribe(topic: string): void {
    const pubsub = this.getPubsub();
    pubsub.unsubscribe(topic);
    this.subscribedTopics.delete(topic);
  }

  /**
   * Publish a message to a GossipSub topic.
   */
  async publish(topic: string, data: Uint8Array): Promise<void> {
    const pubsub = this.getPubsub();
    await pubsub.publish(topic, data);
  }

  /**
   * Broadcast an RFA (Request for Approval) to one or more pool topics.
   */
  async broadcastRFA(pools: string[], payload: Record<string, unknown>): Promise<void> {
    const data = new TextEncoder().encode(JSON.stringify(payload));
    const publishPromises = pools.map((pool) => {
      const topic = this.poolToTopic(pool);
      if (!this.subscribedTopics.has(topic)) {
        this.subscribe(topic);
      }
      return this.publish(topic, data);
    });
    await Promise.allSettled(publishPromises);
  }

  /**
   * Get the local peer ID.
   */
  getPeerId(): string {
    this.assertStarted();
    return this.node!.peerId.toString();
  }

  /**
   * Get the list of connected peers.
   */
  getConnectedPeers(): string[] {
    this.assertStarted();
    return this.node!.getPeers().map((p: any) => p.toString());
  }

  /**
   * Get subscribed topics.
   */
  getSubscribedTopics(): string[] {
    return Array.from(this.subscribedTopics);
  }

  /**
   * Convert pool name to GossipSub topic.
   */
  poolToTopic(pool: string): string {
    return `haas/${pool}`;
  }

  // ---- Private helpers ----

  private getPubsub(): any {
    this.assertStarted();
    return (this.node as any).services.pubsub;
  }

  private assertStarted(): void {
    if (!this.node) {
      throw new Error('P2P node is not started. Call start() first.');
    }
  }

  private async connectToBootstrapPeers(peers: string[]): Promise<void> {
    const { multiaddr } = await import('@multiformats/multiaddr');
    for (const addr of peers) {
      try {
        const ma = multiaddr(addr);
        await this.node!.dial(ma);
      } catch (err) {
        this.emit('error', new Error(`Failed to connect to bootstrap peer ${addr}: ${err}`));
      }
    }
  }
}
