import { useState, useEffect, useCallback, useRef } from "react";
import { RefreshCw, ExternalLink, Clock, Copy, Check } from "lucide-react";
import { fetchPendingTasks, type PendingTask } from "../lib/api";
import { cn, tierColor } from "../lib/utils";

/**
 * Dashboard — Admin overview of pending governance requests.
 * Shows request status, approval links, and stats. No approve/reject buttons here.
 * Approvals happen on a separate page via authenticated link.
 */
export function Dashboard() {
  const [tasks, setTasks] = useState<PendingTask[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>("ALL");
  const emptyPolls = useRef(0);

  const loadTasks = useCallback(async (showLoading = true) => {
    if (showLoading) setIsLoading(true);
    try {
      const data = await fetchPendingTasks();
      if (data.length === 0) {
        emptyPolls.current += 1;
        if (emptyPolls.current >= 5) {
          setTasks([]);
        }
      } else {
        emptyPolls.current = 0;
        setTasks(data);
      }
    } catch {
      // API not available
    } finally {
      if (showLoading) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTasks(true); // Initial load shows spinner
    const interval = setInterval(() => loadTasks(false), 1500); // subsequent polls do not
    return () => clearInterval(interval);
  }, [loadTasks]);

  const filteredTasks =
    filter === "ALL"
      ? tasks
      : tasks.filter((t) => t.request.riskTier === filter);

  const stats = {
    total: tasks.length,
    mid: tasks.filter((t) => t.request.riskTier === "MID").length,
    high: tasks.filter((t) => t.request.riskTier === "HIGH").length,
    critical: tasks.filter((t) => t.request.riskTier === "CRITICAL").length,
  };

  const copyApprovalLink = (requestId: string) => {
    const link = `${window.location.origin}/approve/${requestId}`;
    navigator.clipboard.writeText(link);
    setCopiedId(requestId);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Governance Queue</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Pending tool calls awaiting human approval
          </p>
        </div>
        <div className="flex items-center gap-2">
          <a
            href="/agent-demo.html"
            target="_blank"
            className="btn-secondary flex items-center gap-1.5"
            style={{ textDecoration: "none" }}
          >
            Open Live Demo
          </a>
          <button
            onClick={() => loadTasks(true)}
            disabled={isLoading}
            className="btn-secondary flex items-center gap-1.5"
          >
            <RefreshCw
              className={cn("h-3.5 w-3.5", isLoading && "animate-spin")}
            />
            Refresh
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        {[
          {
            label: "Total Pending",
            value: stats.total,
            color: "text-gray-900",
          },
          { label: "MID Risk", value: stats.mid, color: "text-amber-600" },
          { label: "HIGH Risk", value: stats.high, color: "text-orange-600" },
          { label: "CRITICAL", value: stats.critical, color: "text-red-600" },
        ].map(({ label, value, color }) => (
          <div key={label} className="card py-4">
            <p className={cn("text-2xl font-bold", color)}>{value}</p>
            <p className="text-xs text-gray-500 mt-1">{label}</p>
          </div>
        ))}
      </div>

      {/* Filter */}
      <div className="flex gap-1">
        {["ALL", "MID", "HIGH", "CRITICAL"].map((tier) => (
          <button
            key={tier}
            onClick={() => setFilter(tier)}
            className={cn(
              "px-3 py-1.5 rounded-md text-xs font-medium transition-colors",
              filter === tier
                ? "bg-brand-600 text-white"
                : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50",
            )}
          >
            {tier}
          </button>
        ))}
      </div>

      {/* Request Table */}
      <div className="card overflow-hidden p-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 text-left text-xs uppercase tracking-wider text-gray-500 bg-gray-50">
              <th className="px-5 py-3 font-medium">Tool Call</th>
              <th className="px-5 py-3 font-medium">Agent</th>
              <th className="px-5 py-3 font-medium">Risk Tier</th>
              <th className="px-5 py-3 font-medium">Approvals</th>
              <th className="px-5 py-3 font-medium">Required Pools</th>
              <th className="px-5 py-3 font-medium">Time Left</th>
              <th className="px-5 py-3 font-medium">Approval Link</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filteredTasks.length === 0 ? (
              <tr>
                <td
                  colSpan={7}
                  className="px-5 py-12 text-center text-gray-400"
                >
                  {isLoading ? "Loading..." : "No pending requests"}
                </td>
              </tr>
            ) : (
              filteredTasks.map((task) => {
                const timeLeft = Math.max(0, task.expiresAt - Date.now());
                const isExpired = timeLeft <= 0;
                return (
                  <tr
                    key={task.request.id}
                    className="hover:bg-gray-50 transition-colors"
                  >
                    <td className="px-5 py-3">
                      <p className="font-medium text-gray-900">
                        {task.request.toolName}
                      </p>
                      <p className="text-xs text-gray-400 font-mono mt-0.5">
                        {task.request.id.slice(0, 16)}…
                      </p>
                    </td>
                    <td className="px-5 py-3 text-gray-600">
                      {task.request.agentId}
                    </td>
                    <td className="px-5 py-3">
                      <span
                        className={cn(
                          "badge",
                          tierColor(task.request.riskTier),
                        )}
                      >
                        {task.request.riskTier}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <span className="text-gray-700 font-medium">
                        {task.signatures.length}
                      </span>
                      <span className="text-gray-400">
                        {" "}
                        / {task.request.threshold}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex flex-wrap gap-1">
                        {task.request.requiredPools.map((pool) => (
                          <span
                            key={pool}
                            className="inline-block px-2 py-0.5 rounded text-xs bg-gray-100 text-gray-600 border border-gray-200"
                          >
                            {pool}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      {isExpired ? (
                        <span className="text-red-500 text-xs font-medium">
                          Expired
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-gray-500 text-xs">
                          <Clock className="h-3 w-3" />
                          {Math.ceil(timeLeft / 60000)}m
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-1.5">
                        <a
                          href={`/approve/${task.request.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-brand-600 hover:text-brand-700 text-xs font-medium"
                        >
                          <ExternalLink className="h-3 w-3" />
                          Open
                        </a>
                        <button
                          onClick={() => copyApprovalLink(task.request.id)}
                          className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600"
                          title="Copy approval link"
                        >
                          {copiedId === task.request.id ? (
                            <Check className="h-3 w-3 text-emerald-500" />
                          ) : (
                            <Copy className="h-3 w-3" />
                          )}
                        </button>
                      </div>
                    </td>
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
