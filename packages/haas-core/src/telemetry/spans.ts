import { Span, SpanStatusCode, context, trace } from '@opentelemetry/api';
import { getTracer } from './tracer.js';
import type { RiskTier, HaaSTraceAttributes } from '../types/index.js';

/**
 * Creates a governance span that wraps the entire approval lifecycle.
 *
 * Span name: "haas.governance.<toolName>"
 * Attributes include risk tier, agent ID, required approvals, etc.
 */
export function startGovernanceSpan(
  toolName: string,
  agentId: string,
  riskTier: RiskTier,
  requestId: string,
  requiredApprovals: number,
  pools: string[],
): Span {
  const tracer = getTracer();
  const span = tracer.startSpan(`haas.governance.${toolName}`);

  span.setAttributes({
    'haas.tool_name': toolName,
    'haas.agent_id': agentId,
    'haas.risk_tier': riskTier,
    'haas.request_id': requestId,
    'haas.required_approvals': requiredApprovals,
    'haas.pools': pools.join(','),
    'haas.timestamp': new Date().toISOString(),
  });

  return span;
}

/**
 * Record an approval event on a governance span.
 */
export function recordApprovalEvent(
  span: Span,
  approverId: string,
  pool: string,
  decision: string,
  signatureIndex: number,
  totalRequired: number,
): void {
  span.addEvent('haas.approval.signature', {
    'haas.approver_id': approverId,
    'haas.pool': pool,
    'haas.decision': decision,
    'haas.signature_index': signatureIndex,
    'haas.total_required': totalRequired,
  });
}

/**
 * Record a rejection event on a governance span.
 */
export function recordRejectionEvent(
  span: Span,
  approverId: string,
  pool: string,
  reason: string,
): void {
  span.addEvent('haas.approval.rejected', {
    'haas.approver_id': approverId,
    'haas.pool': pool,
    'haas.rejection_reason': reason,
  });
  span.setStatus({ code: SpanStatusCode.ERROR, message: `Rejected: ${reason}` });
}

/**
 * Record a timeout event on a governance span.
 */
export function recordTimeoutEvent(
  span: Span,
  requestId: string,
  timeoutMs: number,
): void {
  span.addEvent('haas.approval.timeout', {
    'haas.request_id': requestId,
    'haas.timeout_ms': timeoutMs,
  });
  span.setStatus({ code: SpanStatusCode.ERROR, message: 'Approval timed out' });
}

/**
 * Record a consensus-reached event on a governance span.
 */
export function recordConsensusEvent(
  span: Span,
  requestId: string,
  totalSignatures: number,
  pools: string[],
): void {
  span.addEvent('haas.approval.consensus', {
    'haas.request_id': requestId,
    'haas.total_signatures': totalSignatures,
    'haas.consensus_pools': pools.join(','),
  });
  span.setStatus({ code: SpanStatusCode.OK });
}

/**
 * Record an escalation event on a governance span.
 */
export function recordEscalationEvent(
  span: Span,
  requestId: string,
  fromPool: string,
  toPool: string,
  escalationCount: number,
): void {
  span.addEvent('haas.approval.escalated', {
    'haas.request_id': requestId,
    'haas.from_pool': fromPool,
    'haas.to_pool': toPool,
    'haas.escalation_count': escalationCount,
  });
}

/**
 * End a governance span with final attributes.
 */
export function endGovernanceSpan(
  span: Span,
  result: 'approved' | 'rejected' | 'timeout' | 'error',
  waitTimeMs: number,
): void {
  span.setAttributes({
    'haas.result': result,
    'haas.wait_time_ms': waitTimeMs,
  });
  span.end();
}

/**
 * Extract trace context from the current context for propagation.
 * Used when sending RFA messages over P2P to maintain trace continuity.
 */
export function extractTraceContext(): Record<string, string> {
  const activeSpan = trace.getActiveSpan();
  if (!activeSpan) return {};

  const spanContext = activeSpan.spanContext();
  return {
    traceId: spanContext.traceId,
    spanId: spanContext.spanId,
    traceFlags: String(spanContext.traceFlags),
  };
}
