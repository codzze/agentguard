// ============================================================================
// AgentGuard Core — Type Definitions
// Re-exports shared types and defines core-internal interfaces
// ============================================================================

// Re-export all shared protocol types
export type {
  RiskTier,
  SeniorityLevel,
  TrustRequirements,
  AgentContext,
  ApprovalRequest,
  Decision,
  ApproverClaims,
  ApproverInfo,
  ApprovalResponse,
  ConsensusStatus,
  SignatureEntry,
  ConsensusBundle,
  IdentityTokenType,
  IdentityClaims,
  IdentityProof,
  RequestState,
  PendingTask,
  PolicyCondition,
  RiskPolicy,
  PolicyConfig,
  Challenge,
  VerificationResult,
  HaaSTraceAttributes,
} from '@agentguard/shared-proto/types.js';

// ---------------------------------------------------------------------------
// Core Configuration
// ---------------------------------------------------------------------------

export interface HaaSCoreConfig {
  /** Path to risk policy YAML/JSON file, or inline policy object */
  policies: string | import('@agentguard/shared-proto/types.js').PolicyConfig;

  /** Redis connection string for state persistence */
  redis?: string;

  /** Use in-memory store instead of Redis (dev/testing only) */
  inMemoryStore?: boolean;

  /** Accepted identity providers */
  identity: string[];

  /** OpenTelemetry configuration */
  telemetry?: TelemetryConfig;

  /** HTTP server port for the MCP proxy and REST API */
  port?: number;

  /** LibP2P configuration */
  p2p?: P2PConfig;
}

export interface TelemetryConfig {
  /** OTel collector endpoint */
  endpoint: string;
  /** Service name for traces */
  serviceName?: string;
}

export interface P2PConfig {
  /** LibP2P listen addresses */
  listenAddresses?: string[];
  /** Bootstrap peer multiaddrs */
  bootstrapPeers?: string[];
  /** GossipSub topic prefix (default: "haas") */
  topicPrefix?: string;
}

// ---------------------------------------------------------------------------
// Identity Provider Interface (Pluggable)
// ---------------------------------------------------------------------------

export interface IIdentityProvider {
  /** Unique name for this provider (e.g., "linkedin", "github") */
  readonly name: string;

  /** Generate a challenge for the reviewer to prove identity */
  getChallenge(
    requirements: import('@agentguard/shared-proto/types.js').TrustRequirements
  ): import('@agentguard/shared-proto/types.js').Challenge;

  /** Verify the proof submitted by the reviewer */
  verifyProof(
    proof: import('@agentguard/shared-proto/types.js').IdentityProof
  ): Promise<import('@agentguard/shared-proto/types.js').VerificationResult>;

  /** Extract standardized claims from the verified proof */
  extractClaims(
    proof: import('@agentguard/shared-proto/types.js').IdentityProof
  ): import('@agentguard/shared-proto/types.js').IdentityClaims;
}

// ---------------------------------------------------------------------------
// Store Interface (Redis or In-Memory)
// ---------------------------------------------------------------------------

export interface ITaskStore {
  /** Save a pending task */
  set(id: string, task: import('@agentguard/shared-proto/types.js').PendingTask): Promise<void>;

  /** Retrieve a pending task */
  get(id: string): Promise<import('@agentguard/shared-proto/types.js').PendingTask | null>;

  /** Delete a completed/expired task */
  delete(id: string): Promise<void>;

  /** List all pending tasks (for dashboard) */
  listPending(): Promise<import('@agentguard/shared-proto/types.js').PendingTask[]>;

  /** Update task state */
  updateState(
    id: string,
    state: import('@agentguard/shared-proto/types.js').RequestState
  ): Promise<void>;

  /** Add a signature to a pending task */
  addSignature(
    id: string,
    signature: import('@agentguard/shared-proto/types.js').SignatureEntry
  ): Promise<import('@agentguard/shared-proto/types.js').PendingTask | null>;
}

// ---------------------------------------------------------------------------
// Event Emitter Types
// ---------------------------------------------------------------------------

export interface HaaSEvents {
  'request:created': (request: import('@agentguard/shared-proto/types.js').ApprovalRequest) => void;
  'request:approved': (bundle: import('@agentguard/shared-proto/types.js').ConsensusBundle) => void;
  'request:rejected': (response: import('@agentguard/shared-proto/types.js').ApprovalResponse) => void;
  'request:timeout': (requestId: string) => void;
  'request:escalated': (requestId: string, newPool: string) => void;
  'signature:received': (requestId: string, signature: import('@agentguard/shared-proto/types.js').SignatureEntry) => void;
  'identity:verified': (provider: string, claims: import('@agentguard/shared-proto/types.js').IdentityClaims) => void;
  'identity:failed': (provider: string, error: string) => void;
}

// ---------------------------------------------------------------------------
// API Response Types
// ---------------------------------------------------------------------------

export interface ToolCallResult {
  status: 'approved' | 'rejected' | 'timeout' | 'error';
  requestId: string;
  proof?: import('@agentguard/shared-proto/types.js').ConsensusBundle;
  reason?: string;
  waitTimeMs?: number;
}
