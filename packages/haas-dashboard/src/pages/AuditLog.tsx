import { Search } from 'lucide-react';

/**
 * Audit Log page — displays a timeline of all governance decisions.
 * In production, this would query the OTel collector or a dedicated
 * audit database for historical approval/rejection/timeout events.
 */
export function AuditLog() {
  // Placeholder data — in production, fetch from OTel collector
  const entries = [
    {
      id: 'log-001',
      timestamp: '2024-01-15T10:30:00Z',
      toolName: 'apply_discount',
      agentId: 'sales-agent-1',
      tier: 'HIGH',
      decision: 'APPROVED',
      approvers: ['finance-director', 'finance-manager'],
      pool: 'finance',
    },
    {
      id: 'log-002',
      timestamp: '2024-01-15T10:25:00Z',
      toolName: 'delete_record',
      agentId: 'cleanup-agent',
      tier: 'CRITICAL',
      decision: 'REJECTED',
      approvers: ['security-lead'],
      pool: 'security',
    },
    {
      id: 'log-003',
      timestamp: '2024-01-15T10:20:00Z',
      toolName: 'read_report',
      agentId: 'analytics-agent',
      tier: 'LOW',
      decision: 'AUTO_APPROVED',
      approvers: [],
      pool: 'general',
    },
  ];

  return (
    <div className="p-8 space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white">Audit Log</h2>
        <p className="text-sm text-gray-500 mt-1">
          Complete governance decision history with OpenTelemetry trace IDs
        </p>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
        <input
          type="text"
          placeholder="Search by tool name, agent ID, or trace ID…"
          className="w-full rounded-lg bg-gray-900 border border-gray-800 pl-10 pr-4 py-2.5 text-sm
                     text-gray-200 placeholder-gray-600 focus:border-brand-500 focus:outline-none"
        />
      </div>

      {/* Audit Table */}
      <div className="card overflow-hidden p-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800 text-left text-xs uppercase tracking-wider text-gray-500">
              <th className="px-6 py-3">Timestamp</th>
              <th className="px-6 py-3">Tool</th>
              <th className="px-6 py-3">Agent</th>
              <th className="px-6 py-3">Tier</th>
              <th className="px-6 py-3">Decision</th>
              <th className="px-6 py-3">Approvers</th>
              <th className="px-6 py-3">Pool</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800/50">
            {entries.map((entry) => (
              <tr key={entry.id} className="hover:bg-gray-800/30 transition-colors">
                <td className="px-6 py-3 text-gray-400 font-mono text-xs">
                  {new Date(entry.timestamp).toLocaleString()}
                </td>
                <td className="px-6 py-3 text-gray-200 font-medium">{entry.toolName}</td>
                <td className="px-6 py-3 text-gray-400">{entry.agentId}</td>
                <td className="px-6 py-3">
                  <span className={`badge badge-${entry.tier.toLowerCase()}`}>
                    {entry.tier}
                  </span>
                </td>
                <td className="px-6 py-3">
                  <span className={
                    entry.decision === 'APPROVED' || entry.decision === 'AUTO_APPROVED'
                      ? 'text-green-400'
                      : 'text-red-400'
                  }>
                    {entry.decision}
                  </span>
                </td>
                <td className="px-6 py-3 text-gray-500 text-xs">
                  {entry.approvers.length > 0 ? entry.approvers.join(', ') : '—'}
                </td>
                <td className="px-6 py-3 text-gray-400">{entry.pool}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
