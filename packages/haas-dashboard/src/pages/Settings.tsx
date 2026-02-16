/**
 * Settings page — configure identity providers, risk policies,
 * and HaaS Core connection.
 */
export function Settings() {
  return (
    <div className="p-8 space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white">Settings</h2>
        <p className="text-sm text-gray-500 mt-1">
          Configure identity providers, risk policies, and connection settings
        </p>
      </div>

      {/* Core Connection */}
      <div className="card space-y-4">
        <h3 className="text-lg font-semibold text-white">HaaS Core Connection</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Core URL</label>
            <input
              type="text"
              defaultValue="http://localhost:3100"
              className="w-full rounded-lg bg-gray-950 border border-gray-800 px-3 py-2 text-sm
                         text-gray-200 focus:border-brand-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">WebSocket URL</label>
            <input
              type="text"
              defaultValue="ws://localhost:3100/ws"
              className="w-full rounded-lg bg-gray-950 border border-gray-800 px-3 py-2 text-sm
                         text-gray-200 focus:border-brand-500 focus:outline-none"
            />
          </div>
        </div>
      </div>

      {/* Identity Providers */}
      <div className="card space-y-4">
        <h3 className="text-lg font-semibold text-white">Identity Providers</h3>
        <p className="text-sm text-gray-500">
          Configure which identity providers are accepted for reviewer verification.
        </p>
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
          {['GitHub', 'LinkedIn', 'OIDC', 'Okta', 'Web3 Wallet', 'PGP Key'].map((provider) => (
            <div
              key={provider}
              className="flex items-center justify-between rounded-lg border border-gray-800 bg-gray-950/50 px-4 py-3"
            >
              <span className="text-sm text-gray-300">{provider}</span>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" defaultChecked className="sr-only peer" />
                <div className="w-9 h-5 bg-gray-700 peer-focus:outline-none rounded-full
                                peer-checked:after:translate-x-full peer-checked:bg-brand-600
                                after:content-[''] after:absolute after:top-[2px] after:start-[2px]
                                after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all" />
              </label>
            </div>
          ))}
        </div>
      </div>

      {/* Risk Policy */}
      <div className="card space-y-4">
        <h3 className="text-lg font-semibold text-white">Risk Policy</h3>
        <p className="text-sm text-gray-500">
          Upload or edit risk classification policies (JSON/YAML).
        </p>
        <textarea
          rows={12}
          defaultValue={JSON.stringify(
            {
              policies: [
                { tool: 'read_*', tier: 'LOW' },
                { tool: 'update_*', tier: 'MID', requiredApprovals: 1 },
                { tool: 'delete_*', tier: 'HIGH', requiredApprovals: 2, requiredPools: ['security'] },
                { tool: 'transfer_funds', tier: 'CRITICAL', requiredApprovals: 3, requiredPools: ['finance', 'security', 'legal'] },
              ],
            },
            null,
            2,
          )}
          className="w-full rounded-lg bg-gray-950 border border-gray-800 px-4 py-3 text-sm
                     text-gray-300 font-mono focus:border-brand-500 focus:outline-none resize-y"
        />
        <button className="btn-primary">Save Policy</button>
      </div>
    </div>
  );
}
