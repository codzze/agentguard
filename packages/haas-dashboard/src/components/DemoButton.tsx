import { useState, useRef, useEffect } from 'react';
import { Play, ChevronDown, Zap, Shield, AlertTriangle, Flame } from 'lucide-react';
import { triggerDemo, type DemoScenario, type DemoResult } from '../lib/api';
import { cn } from '../lib/utils';

interface DemoButtonProps {
  onTriggered?: () => void;
}

const scenarios: { value: DemoScenario; label: string; icon: React.ReactNode; color: string }[] = [
  { value: 'all',      label: 'All Tiers',  icon: <Play className="h-3.5 w-3.5" />,           color: 'text-brand-400' },
  { value: 'low',      label: 'LOW',         icon: <Zap className="h-3.5 w-3.5" />,            color: 'text-green-400' },
  { value: 'mid',      label: 'MID',         icon: <Shield className="h-3.5 w-3.5" />,         color: 'text-yellow-400' },
  { value: 'high',     label: 'HIGH',        icon: <AlertTriangle className="h-3.5 w-3.5" />,  color: 'text-orange-400' },
  { value: 'critical', label: 'CRITICAL',    icon: <Flame className="h-3.5 w-3.5" />,          color: 'text-red-400' },
];

export function DemoButton({ onTriggered }: DemoButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<DemoResult | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Auto-hide result after 4 seconds
  useEffect(() => {
    if (result) {
      const timer = setTimeout(() => setResult(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [result]);

  const handleTrigger = async (scenario: DemoScenario) => {
    setIsOpen(false);
    setIsLoading(true);
    setResult(null);
    try {
      const res = await triggerDemo(scenario);
      setResult(res);
      onTriggered?.();
    } catch {
      setResult({ message: 'Failed to trigger demo', results: [] });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Main button */}
      <div className="flex items-center">
        <button
          onClick={() => handleTrigger('all')}
          disabled={isLoading}
          className={cn(
            'flex items-center gap-2 px-4 py-2 rounded-l-lg font-medium text-sm transition-all',
            'bg-gradient-to-r from-brand-600 to-purple-600 hover:from-brand-500 hover:to-purple-500',
            'text-white shadow-lg shadow-brand-600/20',
            isLoading && 'opacity-70 cursor-not-allowed',
          )}
        >
          <Play className={cn('h-4 w-4', isLoading && 'animate-pulse')} />
          {isLoading ? 'Triggering…' : 'Run Demo'}
        </button>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className={cn(
            'px-2 py-2 rounded-r-lg border-l border-brand-700 transition-all',
            'bg-gradient-to-r from-brand-600 to-purple-600 hover:from-brand-500 hover:to-purple-500',
            'text-white',
          )}
        >
          <ChevronDown className={cn('h-4 w-4 transition-transform', isOpen && 'rotate-180')} />
        </button>
      </div>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-48 bg-gray-900 border border-gray-700 rounded-lg shadow-xl z-50 overflow-hidden">
          <div className="px-3 py-2 border-b border-gray-800">
            <p className="text-xs text-gray-500 uppercase tracking-wider font-medium">
              Select Scenario
            </p>
          </div>
          {scenarios.map((s) => (
            <button
              key={s.value}
              onClick={() => handleTrigger(s.value)}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-gray-300 hover:bg-gray-800 hover:text-white transition-colors"
            >
              <span className={s.color}>{s.icon}</span>
              {s.label}
            </button>
          ))}
        </div>
      )}

      {/* Result Toast */}
      {result && (
        <div className="absolute right-0 top-full mt-2 w-72 bg-gray-900 border border-gray-700 rounded-lg shadow-xl z-50 p-4 animate-in fade-in slide-in-from-top-2">
          <p className="text-sm font-medium text-white mb-2">{result.message}</p>
          {result.results.length > 0 && (
            <div className="space-y-1.5">
              {result.results.map((r, i) => (
                <div key={i} className="flex items-center justify-between text-xs">
                  <span className="text-gray-400">{r.tool}</span>
                  <div className="flex items-center gap-2">
                    <span className={cn(
                      'badge',
                      r.tier === 'LOW' ? 'badge-low' :
                      r.tier === 'MID' ? 'badge-mid' :
                      r.tier === 'HIGH' ? 'badge-high' : 'badge-critical',
                    )}>
                      {r.tier}
                    </span>
                    <span className={r.status === 'queued' ? 'text-yellow-400' : 'text-green-400'}>
                      {r.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
