// ============================================================================
// AgentGuard Core — Consensus Aggregator
// Collects and validates multi-sig approvals for high/critical risk actions
// ============================================================================

import type {
  ApprovalRequest,
  ApprovalResponse,
  SignatureEntry,
  ConsensusBundle,
  ConsensusStatus,
} from '../types/index.js';
import type { IdentityProviderFactory } from '../auth/factory.js';

export interface ConsensusConfig {
  /** Identity provider factory for verifying proofs */
  identityFactory: IdentityProviderFactory;
}

export interface ConsensusCheckResult {
  /** Whether the threshold has been met */
  thresholdMet: boolean;
  /** Current number of valid signatures */
  currentCount: number;
  /** Required number of signatures */
  requiredCount: number;
  /** Pools that have provided valid signatures */
  resolvedPools: string[];
  /** Pools still awaiting signatures */
  pendingPools: string[];
}

export class ConsensusAggregator {
  private identityFactory: IdentityProviderFactory;

  constructor(config: ConsensusConfig) {
    this.identityFactory = config.identityFactory;
  }

  /**
   * Check whether consensus has been reached for a given request.
   */
  checkConsensus(
    request: ApprovalRequest,
    signatures: SignatureEntry[]
  ): ConsensusCheckResult {
    const requiredPools = new Set<string>(request.requiredPools);
    const resolvedPools = new Set<string>();

    // Count unique valid signatures per pool
    const seenApprovers = new Set<string>();
    for (const sig of signatures) {
      if (!seenApprovers.has(sig.approverId)) {
        seenApprovers.add(sig.approverId);
        if (requiredPools.has(sig.pool)) {
          resolvedPools.add(sig.pool);
        }
      }
    }

    const currentCount = seenApprovers.size;
    const thresholdMet = currentCount >= request.threshold;

    return {
      thresholdMet,
      currentCount,
      requiredCount: request.threshold,
      resolvedPools: Array.from(resolvedPools),
      pendingPools: Array.from(requiredPools).filter(
        (p) => !resolvedPools.has(p)
      ),
    };
  }

  /**
   * Validate an incoming approval response before adding it to the signature list.
   */
  async validateResponse(
    response: ApprovalResponse,
    request: ApprovalRequest
  ): Promise<{ valid: boolean; reason?: string }> {
    // Check that the response matches the request
    if (response.requestId !== request.id) {
      return { valid: false, reason: 'Request ID mismatch' };
    }

    // Verify the approver's pool is one of the required pools
    const pool = response.approver.pool;
    if (pool && !request.requiredPools.includes(pool)) {
      return { valid: false, reason: `Pool "${pool}" is not required for this request` };
    }

    // Verify identity proof if trust requirements exist
    if (request.trustRequirements) {
      const claims = response.approver.claims;
      if (claims) {
        const meetsRequirements = this.identityFactory.meetsTrustRequirements(
          {
            seniority: claims.seniority,
            skills: claims.skills,
          },
          request.trustRequirements
        );
        if (!meetsRequirements) {
          return {
            valid: false,
            reason: 'Approver does not meet trust requirements',
          };
        }
      }
    }

    return { valid: true };
  }

  /**
   * Convert an approval response to a signature entry.
   */
  toSignatureEntry(response: ApprovalResponse): SignatureEntry {
    return {
      pool: response.approver.pool ?? 'default',
      approverId: response.approver.peerId,
      signature: response.signature,
      identityHash: response.approver.identityHash,
      provider: response.approver.provider,
      timestamp: response.timestamp,
    };
  }

  /**
   * Build the final consensus bundle from signatures.
   */
  buildBundle(
    requestId: string,
    traceId: string,
    threshold: number,
    signatures: SignatureEntry[],
    status: ConsensusStatus = 'CONSENSUS_REACHED'
  ): ConsensusBundle {
    return {
      requestId,
      status,
      threshold,
      signatures,
      traceId,
      completedAt: new Date().toISOString(),
      totalWaitTimeMs: undefined,
    };
  }
}
