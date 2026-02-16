import { Outlet, NavLink } from 'react-router-dom';
import { Shield, ClipboardList, Settings, Activity } from 'lucide-react';
import { cn } from '../lib/utils';

const navItems = [
  { to: '/', label: 'Dashboard', icon: ClipboardList },
  { to: '/audit', label: 'Audit Log', icon: Activity },
  { to: '/settings', label: 'Settings', icon: Settings },
];

export function Layout() {
  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside className="w-64 border-r border-gray-800 bg-gray-900/40 backdrop-blur-xl flex flex-col">
        <div className="flex items-center gap-3 px-6 py-5 border-b border-gray-800">
          <Shield className="h-8 w-8 text-brand-500" />
          <div>
            <h1 className="text-lg font-bold text-white">AgentGuard</h1>
            <p className="text-xs text-gray-500">Human-as-a-Service</p>
          </div>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1">
          {navItems.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-brand-600/10 text-brand-400 border border-brand-500/20'
                    : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/50',
                )
              }
            >
              <Icon className="h-4 w-4" />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="px-6 py-4 border-t border-gray-800">
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-green-400 animate-pulse-slow" />
            <span className="text-xs text-gray-500">Core Connected</span>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
}
