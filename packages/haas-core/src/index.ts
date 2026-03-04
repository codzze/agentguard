// ============================================================================
// AgentGuard Core — Main Entry Point
// Orchestrates all subsystems: Risk Classifier, State Machine, Consensus,
// Identity Adapters, and OpenTelemetry
// ============================================================================

export { RiskClassifier } from './classifier/risk-classifier.js';
export type { ClassificationResult } from './classifier/risk-classifier.js';

export { ApprovalStateMachine } from './state/state-machine.js';
export { InMemoryTaskStore } from './state/store.js';

export { ConsensusAggregator } from './consensus/aggregator.js';
export type { ConsensusCheckResult, ConsensusConfig } from './consensus/aggregator.js';

export { IdentityProviderFactory, MockIdentityProvider } from './auth/factory.js';

// Identity Providers
export { GitHubIdentityProvider } from './auth/providers/github.js';
export { LinkedInIdentityProvider } from './auth/providers/linkedin.js';
export { OIDCIdentityProvider } from './auth/providers/oidc.js';
export { OktaIdentityProvider } from './auth/providers/okta.js';
export { Web3IdentityProvider } from './auth/providers/web3.js';

// MCP Layer
export { MCPInterceptor } from './mcp/interceptor.js';
export type { MCPToolCall, MCPToolResult } from './mcp/interceptor.js';
export { MCPProxyServer } from './mcp/server.js';

// Network (P2P)
export { P2PNode } from './network/p2p.js';
export { GossipSubManager } from './network/gossipsub.js';
export type { GossipMessage, GossipEnvelope } from './network/gossipsub.js';

// Telemetry
export { initTracer, getTracer, shutdownTracer } from './telemetry/tracer.js';
export {
  startGovernanceSpan,
  recordApprovalEvent,
  recordRejectionEvent,
  recordTimeoutEvent,
  recordConsensusEvent,
  recordEscalationEvent,
  endGovernanceSpan,
  extractTraceContext,
} from './telemetry/spans.js';

// Policy Loader
export { PolicyLoader } from './classifier/policies.js';

// AIOps
export { AIOpsService } from './aiops/feedback-loop.js';
export type { AIOpsConfig, ToolStats, TierAdjustment } from './aiops/feedback-loop.js';

// Skill Framework
export { SkillFramework } from './aiops/skill-framework.js';
export type { SkillMapping, SkillMatchCriteria, SkillFrameworkConfig, PoolResolution } from './aiops/skill-framework.js';

// Re-export shared protocol types
export type {
  RiskTier,
  SeniorityLevel,
  TrustRequirements,
  ApprovalRequest,
  ApprovalResponse,
  Decision,
  ConsensusBundle,
  ConsensusStatus,
  SignatureEntry,
  IdentityProof,
  IdentityClaims,
  RequestState,
  PendingTask,
  RiskPolicy,
  PolicyConfig,
  PolicyCondition,
  Challenge,
  VerificationResult,
  HaaSTraceAttributes,
  IIdentityProvider,
  ITaskStore,
  HaaSCoreConfig,
  ToolCallResult,
} from './types/index.js';
