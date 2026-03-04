import { useState, useEffect, useCallback } from 'react';
import { Search } from 'lucide-react';
import { fetchAuditLog, type AuditEntry } from '../lib/api';
import { cn, tierColor } from '../lib/utils';

/**
 * Audit Log page — displays governance decision history.
 * Shows all resolved requests fetched from the server.
 */
export function AuditLog() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const loadEntries = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await fetchAuditLog();
      setEntries(data);
    } catch {
      // API not available — show empty
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadEntries();
    const interval = setInterval(loadEntries, 10000);
    return () => clearInterval(interval);
  }, [loadEntries]);

  // Extract display data from audit entries
  const displayEntries = entries.map((entry) => {
    const task = entry.task as Record<string, unknown> | null;
    const request = (task?.request ?? {}) as Record<string, unknown>;
    return {
      id: String(request.id ?? 'unknown'),
      toolName: String(request.toolName ?? 'unknown'),
      agentId: String(request.agentId ?? 'unknown'),
      tier: String(request.riskTier ?? 'LOW'),
      state: String(task?.state ?? 'UNKNOWN'),
      pools: (request.requiredPools as string[]) ?? [],
      resolvedAt: entry.resolvedAt,
    };
  });

  const filtered = search
    ? displayEntries.filter(
        (e) =>
          e.toolName.toLowerCase().includes(search.toLowerCase()) ||
          e.agentId.toLowerCase().includes(search.toLowerCase()) ||
          e.id.toLowerCase().includes(search.toLowerCase()),
      )
    : displayEntries;

  const stateDisplay = (state: string) => {
    switch (state) {
      case 'APPROVED': return { label: 'Approved', cls: 'badge-approved' };
      case 'REJECTED': return { label: 'Rejected', cls: 'badge-rejected' };
      case 'TIMEOUT': return { label: 'Timeout', cls: 'badge-timeout' };
      default: return { label: state, cls: 'badge-pending' };
    }
  };

  return (
    <div className="p-6 space-y-5">
      <div>
        <h2 className="text-xl font-bold text-gray-900">Audit Log</h2>
        <p className="text-sm text-gray-500 mt-0.5">
          Governance decision history
        </p>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by tool name, agent, or ID…"
          className="input-field pl-9"
        />
      </div>

      {/* Table */}
      <div className="card overflow-hidden p-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 text-left text-xs uppercase tracking-wider text-gray-500 bg-gray-50">
              <th className="px-5 py-3 font-medium">Timestamp</th>
              <th className="px-5 py-3 font-medium">Tool</th>
              <th className="px-5 py-3 font-medium">Agent</th>
              <th className="px-5 py-3 font-medium">Tier</th>
              <th className="px-5 py-3 font-medium">Decision</th>
              <th className="px-5 py-3 font-medium">Pools</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-5 py-12 text-center text-gray-400">
                  {isLoading ? 'Loading...' : 'No audit entries yet'}
                </td>
              </tr>
            ) : (
              filtered.map((entry, i) => {
                const sd = stateDisplay(entry.state);
                return (
                  <tr key={`${entry.id}-${i}`} className="hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-3 text-gray-500 text-xs font-mono">
                      {new Date(entry.resolvedAt).toLocaleString()}
                    </td>
                    <td className="px-5 py-3 font-medium text-gray-900">{entry.toolName}</td>
                    <td className="px-5 py-3 text-gray-600">{entry.agentId}</td>
                    <td className="px-5 py-3">
                      <span className={cn('badge', tierColor(entry.tier))}>{entry.tier}</span>
                    </td>
                    <td className="px-5 py-3">
                      <span className={cn('badge', sd.cls)}>{sd.label}</span>
                    </td>
                    <td className="px-5 py-3 text-gray-500 text-xs">{entry.pools.join(', ') || '—'}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
