import { useState } from 'react';
import { Clock, CheckCircle, XCircle, AlertTriangle, User } from 'lucide-react';
import { cn, tierColor, formatRelativeTime } from '../lib/utils';
import type { PendingTask } from '../lib/api';
import { submitApproval } from '../lib/api';

interface RequestCardProps {
  task: PendingTask;
  onActionComplete?: () => void;
}

export function RequestCard({ task, onActionComplete }: RequestCardProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [actionTaken, setActionTaken] = useState<'APPROVE' | 'REJECT' | null>(null);
  const [reason, setReason] = useState('');

  const { request, state, signatures } = task;
  const progress = signatures.length / request.threshold;
  const timeRemaining = Math.max(0, task.expiresAt - Date.now());
  const isExpired = timeRemaining <= 0;

  const handleAction = async (decision: 'APPROVE' | 'REJECT') => {
    setIsLoading(true);
    try {
      await submitApproval(
        request.id,
        'dashboard-reviewer',
        request.requiredPools[0] ?? 'general',
        decision,
        request.threshold,
        reason || undefined,
      );
      setActionTaken(decision);
      onActionComplete?.();
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={cn(
      'card transition-all hover:border-gray-700',
      actionTaken === 'APPROVE' && 'border-green-500/30',
      actionTaken === 'REJECT' && 'border-red-500/30',
    )}>
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className={cn('badge', tierColor(request.riskTier))}>
              {request.riskTier}
            </span>
            <span className="text-xs text-gray-500">
              {formatRelativeTime(task.createdAt)}
            </span>
          </div>
          <h3 className="text-base font-semibold text-white">
            {request.toolName}
          </h3>
          <p className="text-xs text-gray-500 mt-0.5">
            Agent: {request.agentId} · Request: {request.id.slice(0, 12)}…
          </p>
        </div>

        {state === 'WAITING_FOR_HUMAN' && !isExpired && (
          <div className="flex items-center gap-1 text-xs text-yellow-400">
            <Clock className="h-3.5 w-3.5" />
            {Math.ceil(timeRemaining / 60000)}m left
          </div>
        )}

        {isExpired && state === 'WAITING_FOR_HUMAN' && (
          <div className="flex items-center gap-1 text-xs text-red-400">
            <AlertTriangle className="h-3.5 w-3.5" />
            Expired
          </div>
        )}
      </div>

      {/* Tool Arguments */}
      <div className="mb-4 rounded-lg bg-gray-950/50 border border-gray-800 p-3">
        <p className="text-xs text-gray-500 mb-1 uppercase tracking-wider">Arguments</p>
        <pre className="text-xs text-gray-300 overflow-x-auto max-h-24 scrollbar-thin">
          {JSON.stringify(request.toolArgs, null, 2)}
        </pre>
      </div>

      {/* Approval Progress */}
      <div className="mb-4">
        <div className="flex items-center justify-between text-xs text-gray-400 mb-1.5">
          <span>Approvals: {signatures.length} / {request.threshold}</span>
          <span>Pools: {request.requiredPools.join(', ')}</span>
        </div>
        <div className="w-full bg-gray-800 rounded-full h-1.5">
          <div
            className={cn(
              'h-1.5 rounded-full transition-all',
              progress >= 1 ? 'bg-green-500' : 'bg-brand-500',
            )}
            style={{ width: `${Math.min(progress * 100, 100)}%` }}
          />
        </div>
      </div>

      {/* Existing Signatures */}
      {signatures.length > 0 && (
        <div className="mb-4 space-y-1">
          {signatures.map((sig, i) => (
            <div key={i} className="flex items-center gap-2 text-xs">
              <User className="h-3 w-3 text-gray-500" />
              <span className="text-gray-400">{sig.approverId}</span>
              <span className={sig.decision === 'APPROVE' ? 'text-green-400' : 'text-red-400'}>
                {sig.decision}
              </span>
              {sig.reason && (
                <span className="text-gray-600 truncate">— {sig.reason}</span>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Action Buttons */}
      {state === 'WAITING_FOR_HUMAN' && !actionTaken && !isExpired && (
        <div className="space-y-3">
          <input
            type="text"
            placeholder="Reason (optional)"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="w-full rounded-lg bg-gray-950 border border-gray-800 px-3 py-2 text-sm
                       text-gray-200 placeholder-gray-600 focus:border-brand-500 focus:outline-none"
          />
          <div className="flex gap-2">
            <button
              onClick={() => handleAction('APPROVE')}
              disabled={isLoading}
              className="btn-approve flex-1 flex items-center justify-center gap-2"
            >
              <CheckCircle className="h-4 w-4" />
              Approve
            </button>
            <button
              onClick={() => handleAction('REJECT')}
              disabled={isLoading}
              className="btn-reject flex-1 flex items-center justify-center gap-2"
            >
              <XCircle className="h-4 w-4" />
              Reject
            </button>
          </div>
        </div>
      )}

      {/* Action Taken */}
      {actionTaken && (
        <div className={cn(
          'flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium',
          actionTaken === 'APPROVE'
            ? 'bg-green-500/10 text-green-400'
            : 'bg-red-500/10 text-red-400',
        )}>
          {actionTaken === 'APPROVE' ? <CheckCircle className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
          {actionTaken === 'APPROVE' ? 'Approved' : 'Rejected'}
        </div>
      )}
    </div>
  );
}
