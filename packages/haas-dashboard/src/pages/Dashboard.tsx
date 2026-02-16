import { useState, useEffect, useCallback } from 'react';
import { RefreshCw } from 'lucide-react';
import { fetchPendingTasks, type PendingTask } from '../lib/api';
import { RequestCard } from '../components/RequestCard';
import { StatsBar } from '../components/StatsBar';
import { DemoButton } from '../components/DemoButton';

export function Dashboard() {
  const [tasks, setTasks] = useState<PendingTask[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<string>('ALL');

  const loadTasks = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await fetchPendingTasks();
      setTasks(data);
    } catch {
      // API not available — show empty state
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTasks();
    const interval = setInterval(loadTasks, 5000); // poll every 5s
    return () => clearInterval(interval);
  }, [loadTasks]);

  const filteredTasks = filter === 'ALL'
    ? tasks
    : tasks.filter((t) => t.request.riskTier === filter);

  const pending = tasks.filter((t) => t.state === 'WAITING_FOR_HUMAN').length;
  const approved = tasks.filter((t) => t.state === 'APPROVED').length;
  const rejected = tasks.filter((t) => t.state === 'REJECTED').length;
  const critical = tasks.filter((t) => t.request.riskTier === 'CRITICAL').length;

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Approval Queue</h2>
          <p className="text-sm text-gray-500 mt-1">
            Review and approve pending AI agent tool calls
          </p>
        </div>
        <div className="flex items-center gap-3">
          <DemoButton onTriggered={loadTasks} />
          <button onClick={loadTasks} className="btn-primary flex items-center gap-2">
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Stats */}
      <StatsBar
        pending={pending}
        approved={approved}
        rejected={rejected}
        critical={critical}
      />

      {/* Filters */}
      <div className="flex gap-2">
        {['ALL', 'LOW', 'MID', 'HIGH', 'CRITICAL'].map((tier) => (
          <button
            key={tier}
            onClick={() => setFilter(tier)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              filter === tier
                ? 'bg-brand-600 text-white'
                : 'bg-gray-800 text-gray-400 hover:text-gray-200'
            }`}
          >
            {tier}
          </button>
        ))}
      </div>

      {/* Task Grid */}
      {filteredTasks.length > 0 ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredTasks.map((task) => (
            <RequestCard
              key={task.request.id}
              task={task}
              onActionComplete={loadTasks}
            />
          ))}
        </div>
      ) : (
        <div className="card text-center py-16">
          <p className="text-gray-500 text-lg">
            {isLoading ? 'Loading…' : 'No pending approval requests'}
          </p>
          <p className="text-gray-600 text-sm mt-2">
            Requests will appear here when AI agents invoke governed tools.
          </p>
        </div>
      )}
    </div>
  );
}
