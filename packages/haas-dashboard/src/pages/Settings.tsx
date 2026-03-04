import { useState, useEffect, useCallback } from 'react';
import { Save, RefreshCw, Shield, Key, Brain, Activity } from 'lucide-react';
import {
  fetchPolicies,
  savePolicies,
  fetchProviders,
  saveProviders,
  fetchAIOpsStats,
  type RiskPolicyDTO,
  type ProviderDTO,
  type AIOpsStats,
} from '../lib/api';
import { cn } from '../lib/utils';

export function Settings() {
  const [coreUrl, setCoreUrl] = useState('http://localhost:3100');
  const [wsUrl, setWsUrl] = useState('ws://localhost:3100/ws');

  const [policies, setPolicies] = useState<RiskPolicyDTO[]>([]);
  const [policyText, setPolicyText] = useState('');
  const [policySaveStatus, setPolicySaveStatus] = useState<string | null>(null);

  const [providers, setProviders] = useState<ProviderDTO[]>([]);
  const [providerSaveStatus, setProviderSaveStatus] = useState<string | null>(null);
  const [aiopsStats, setAiopsStats] = useState<AIOpsStats | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const loadSettings = useCallback(async () => {
    setIsLoading(true);
    try {
      const [p, provs, stats] = await Promise.all([
        fetchPolicies().catch(() => []),
        fetchProviders().catch(() => []),
        fetchAIOpsStats().catch(() => null),
      ]);
      setPolicies(p);
      setPolicyText(JSON.stringify(p, null, 2));
      setProviders(provs);
      setAiopsStats(stats);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const handleSavePolicies = async () => {
    try {
      const parsed = JSON.parse(policyText) as RiskPolicyDTO[];
      if (!Array.isArray(parsed)) {
        setPolicySaveStatus('❌ Policies must be a JSON array');
        return;
      }
      const result = await savePolicies(parsed);
      setPolicySaveStatus(`✅ ${result.message} (${result.count} policies)`);
      setPolicies(parsed);
      setTimeout(() => setPolicySaveStatus(null), 3000);
    } catch (err) {
      setPolicySaveStatus(`❌ ${err instanceof Error ? err.message : 'Invalid JSON'}`);
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Settings</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Configure HaaS Core, identity providers, and risk policies
          </p>
        </div>
        <button
          onClick={loadSettings}
          disabled={isLoading}
          className="btn-secondary flex items-center gap-1.5"
        >
          <RefreshCw className={cn('h-3.5 w-3.5', isLoading && 'animate-spin')} />
          Reload
        </button>
      </div>

      {/* Connection */}
      <section className="card">
        <div className="flex items-center gap-2 mb-4">
          <Activity className="h-4 w-4 text-brand-600" />
          <h3 className="text-sm font-semibold text-gray-900">HaaS Core Connection</h3>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Core URL</label>
            <input
              type="text"
              value={coreUrl}
              onChange={(e) => setCoreUrl(e.target.value)}
              className="input-field"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">WebSocket URL</label>
            <input
              type="text"
              value={wsUrl}
              onChange={(e) => setWsUrl(e.target.value)}
              className="input-field"
            />
          </div>
        </div>
      </section>

      {/* Identity Providers */}
      <section className="card">
        <div className="flex items-center gap-2 mb-4">
          <Key className="h-4 w-4 text-brand-600" />
          <h3 className="text-sm font-semibold text-gray-900">Identity Providers</h3>
        </div>
        <p className="text-xs text-gray-500 mb-3">
          Credential providers used for approver authentication on the approval page.
        </p>
        <div className="space-y-2">
          {(['github', 'linkedin', 'oidc', 'okta', 'web3', 'mock'] as const).map((provider) => {
            const isActive = providers.some((p) => p.name === provider && p.enabled);
            return (
              <div
                key={provider}
                className="flex items-center justify-between px-4 py-2.5 rounded-lg border border-gray-200 bg-gray-50"
              >
                <div className="flex items-center gap-2.5">
                  <div className={cn('h-2 w-2 rounded-full', isActive ? 'bg-emerald-500' : 'bg-gray-300')} />
                  <span className="text-sm text-gray-700 capitalize">{provider}</span>
                  {isActive && (
                    <span className="text-[11px] text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                      Active
                    </span>
                  )}
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isActive}
                    onChange={() => {
                      setProviders((prev) => {
                        const existing = prev.find((p) => p.name === provider);
                        if (existing) {
                          return prev.map((p) =>
                            p.name === provider ? { ...p, enabled: !p.enabled } : p,
                          );
                        }
                        return [...prev, { name: provider, enabled: true }];
                      });
                    }}
                    className="sr-only peer"
                  />
                  <div className="w-8 h-[18px] rounded-full bg-gray-300 peer-checked:bg-brand-600 transition-colors after:content-[''] after:absolute after:top-[1px] after:left-[1px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-[14px] after:shadow-sm" />
                </label>
              </div>
            );
          })}
        </div>

        {/* Save Providers Button */}
        <div className="flex items-center justify-between mt-3">
          <div className="text-sm">
            {providerSaveStatus && (
              <span className={providerSaveStatus.startsWith('✅') ? 'text-emerald-600' : 'text-red-600'}>
                {providerSaveStatus}
              </span>
            )}
          </div>
          <button
            onClick={async () => {
              try {
                const result = await saveProviders(providers);
                setProviderSaveStatus(`✅ ${result.message}`);
                setTimeout(() => setProviderSaveStatus(null), 3000);
              } catch {
                setProviderSaveStatus('❌ Failed to save providers');
              }
            }}
            className="btn-primary flex items-center gap-1.5"
          >
            <Save className="h-3.5 w-3.5" />
            Save Providers
          </button>
        </div>
      </section>

      {/* Risk Policies */}
      <section className="card">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-brand-600" />
            <h3 className="text-sm font-semibold text-gray-900">Risk Policies</h3>
          </div>
          <span className="text-xs text-gray-400">{policies.length} policies</span>
        </div>
        <p className="text-xs text-gray-500 mb-3">
          Edit risk classification policies (JSON array). Each policy maps a tool pattern to a risk tier.
        </p>
        <textarea
          value={policyText}
          onChange={(e) => setPolicyText(e.target.value)}
          rows={14}
          spellCheck={false}
          className="input-field font-mono text-xs resize-y"
          placeholder='[{"tool": "read_*", "tier": "LOW", ...}]'
        />
        <div className="flex items-center justify-between mt-3">
          <div className="text-sm">
            {policySaveStatus && (
              <span className={policySaveStatus.startsWith('✅') ? 'text-emerald-600' : 'text-red-600'}>
                {policySaveStatus}
              </span>
            )}
          </div>
          <button onClick={handleSavePolicies} className="btn-primary flex items-center gap-1.5">
            <Save className="h-3.5 w-3.5" />
            Save Policies
          </button>
        </div>
      </section>

      {/* AIOps */}
      <section className="card">
        <div className="flex items-center gap-2 mb-4">
          <Brain className="h-4 w-4 text-brand-600" />
          <h3 className="text-sm font-semibold text-gray-900">AIOps Learning</h3>
        </div>
        <p className="text-xs text-gray-500 mb-4">
          AgentGuard learns from approval patterns to self-adjust risk classifications.
        </p>
        {aiopsStats ? (
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-center">
              <p className="text-xl font-bold text-gray-900">{aiopsStats.totalTrackedTools}</p>
              <p className="text-xs text-gray-500 mt-1">Tracked Tools</p>
            </div>
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-center">
              <p className="text-xl font-bold text-gray-900">{aiopsStats.totalAdjustments}</p>
              <p className="text-xs text-gray-500 mt-1">Auto-Adjustments</p>
            </div>
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-center">
              <p className="text-xl font-bold text-amber-700">{aiopsStats.pendingRecommendations}</p>
              <p className="text-xs text-gray-500 mt-1">Pending</p>
            </div>
          </div>
        ) : (
          <p className="text-sm text-gray-400 italic">
            No data yet. Stats appear after tool calls are processed.
          </p>
        )}
      </section>
    </div>
  );
}
