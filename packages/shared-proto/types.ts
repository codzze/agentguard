// ============================================================================
// AgentGuard — Shared Protocol Types
// These types are the "contract" between the Python SDK, Node.js Core,
// and the React Dashboard. Any change here must be reflected across all packages.
// ============================================================================

// ---------------------------------------------------------------------------
// Risk Classification
// ---------------------------------------------------------------------------

export type RiskTier = 'LOW' | 'MID' | 'HIGH' | 'CRITICAL';

export type SeniorityLevel = 'associate' | 'senior' | 'lead' | 'director' | 'vp' | 'c-level';

export interface TrustRequirements {
  minSeniority?: SeniorityLevel;
  requiredSkills?: string[];
  acceptedProviders?: string[];
}

// ---------------------------------------------------------------------------
// Approval Request (RFA — Request for Approval)
// ---------------------------------------------------------------------------

export interface AgentContext {
  reasoning?: string;
  conversationSummary?: string;
  previousActions?: string[];
}

export interface ApprovalRequest {
  id: string;
  agentId: string;
  toolName: string;
  toolArgs: Record<string, unknown>;
  riskTier: RiskTier;
  requiredPools: string[];
  threshold: number;
  trustRequirements?: TrustRequirements;
  agentContext?: AgentContext;
  traceId: string;
  spanId?: string;
  createdAt: string; // ISO 8601
  ttl: number;       // seconds
  callbackUrl?: string;
}

// ---------------------------------------------------------------------------
// Approval Response (Human Reviewer Signature)
// ---------------------------------------------------------------------------

export type Decision = 'APPROVED' | 'REJECTED';

export interface ApproverClaims {
  name?: string;
  title?: string;
  org?: string;
  seniority?: SeniorityLevel;
  skills?: string[];
  verifiedAt?: string; // ISO 8601
}

export interface ApproverInfo {
  peerId: string;
  identityHash: string;
  provider: string;
  claims?: ApproverClaims;
  pool?: string;
}

export interface ApprovalResponse {
  requestId: string;
  decision: Decision;
  reason?: string | null;
  approver: ApproverInfo;
  signature: string;
  timestamp: string; // ISO 8601
}

// ---------------------------------------------------------------------------
// Consensus Bundle (Final Proof)
// ---------------------------------------------------------------------------

export type ConsensusStatus = 'CONSENSUS_REACHED' | 'PARTIAL' | 'DENIED' | 'TIMEOUT';

export interface SignatureEntry {
  pool: string;
  approverId: string;
  signature: string;
  identityHash: string;
  provider: string;
  timestamp: string; // ISO 8601
}

export interface ConsensusBundle {
  requestId: string;
  status: ConsensusStatus;
  threshold: number;
  signatures: SignatureEntry[];
  combinedProof?: string;
  traceId: string;
  completedAt: string; // ISO 8601
  totalWaitTimeMs?: number;
}

// ---------------------------------------------------------------------------
// Identity Proof
// ---------------------------------------------------------------------------

export type IdentityTokenType =
  | 'jwt'
  | 'verifiable-credential'
  | 'oauth2'
  | 'pgp-signature'
  | 'wallet-signature';

export interface IdentityClaims {
  sub?: string;
  name?: string;
  email?: string;
  title?: string;
  org?: string;
  orgVerified?: boolean;
  seniority?: SeniorityLevel;
  skills?: string[];
  groups?: string[];
}

export interface IdentityProof {
  provider: string;
  token: string;
  tokenType?: IdentityTokenType;
  claims?: IdentityClaims;
  verifiedAt: string; // ISO 8601
  expiresAt?: string; // ISO 8601
  hash?: string;      // SHA-256 of token
}

// ---------------------------------------------------------------------------
// State Machine
// ---------------------------------------------------------------------------

export type RequestState =
  | 'IDLE'
  | 'PENDING'
  | 'WAITING_FOR_HUMAN'
  | 'PARTIAL_APPROVAL'
  | 'APPROVED'
  | 'REJECTED'
  | 'TIMEOUT'
  | 'ESCALATED';

export interface PendingTask {
  request: ApprovalRequest;
  state: RequestState;
  signatures: SignatureEntry[];
  createdAt: number;    // Unix timestamp ms
  updatedAt: number;    // Unix timestamp ms
  expiresAt: number;    // Unix timestamp ms
  escalationCount: number;
}

// ---------------------------------------------------------------------------
// Risk Policy Configuration
// ---------------------------------------------------------------------------

export interface PolicyCondition {
  field: string;
  operator: '>' | '<' | '>=' | '<=' | '==' | '!=' | 'contains' | 'matches';
  value: string | number | boolean;
}

export interface RiskPolicy {
  tool: string;
  conditions?: PolicyCondition[];
  tier: RiskTier;
  threshold: number;
  pools: string[];
  timeout: string;         // e.g., "30m", "1h"
  onRejection: 'abort_agent' | 'notify_agent' | 'retry' | 'escalate';
  onTimeout: 'auto_deny' | 'escalate' | 'retry';
  escalationPool?: string;
  autoApprove?: boolean;
}

export interface PolicyConfig {
  policies: RiskPolicy[];
}

// ---------------------------------------------------------------------------
// Identity Provider Interface
// ---------------------------------------------------------------------------

export interface Challenge {
  type: string;
  provider: string;
  redirectUrl?: string;
  nonce: string;
  expiresAt: string; // ISO 8601
}

export interface VerificationResult {
  verified: boolean;
  claims?: IdentityClaims;
  hash?: string;
  error?: string;
}

// ---------------------------------------------------------------------------
// OpenTelemetry Attributes
// ---------------------------------------------------------------------------

export interface HaaSTraceAttributes {
  'haas.request.id': string;
  'haas.agent.id': string;
  'haas.tool.name': string;
  'haas.risk.tier': RiskTier;
  'haas.pools': string;        // comma-separated
  'haas.threshold': number;
  'haas.decision'?: Decision;
  'haas.approver.id'?: string;
  'haas.auth.provider'?: string;
  'haas.wait_time_ms'?: number;
}
