import { Outlet, NavLink } from 'react-router-dom';
import { Shield, ClipboardList, Settings, Activity, Play } from 'lucide-react';
import { cn } from '../lib/utils';

const navItems = [
  { to: '/', label: 'Dashboard', icon: ClipboardList },
  { to: '/audit', label: 'Audit Log', icon: Activity },
  { to: '/settings', label: 'Settings', icon: Settings },
];

export function Layout() {
  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* Sidebar */}
      <aside className="w-60 border-r border-gray-200 bg-white flex flex-col">
        <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-200">
          <Shield className="h-7 w-7 text-brand-600" />
          <div>
            <h1 className="text-base font-bold text-gray-900">AgentGuard</h1>
            <p className="text-[11px] text-gray-500">HaaS Admin Console</p>
          </div>
        </div>

        <nav className="flex-1 px-3 py-3 space-y-0.5">
          {navItems.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-2.5 px-3 py-2 rounded-md text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-brand-50 text-brand-700'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100',
                )
              }
            >
              <Icon className="h-4 w-4" />
              {label}
            </NavLink>
          ))}

          <div className="border-t border-gray-200 my-2" />
          <a
            href="/agent-demo.html"
            className="flex items-center gap-2.5 px-3 py-2 rounded-md text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors"
          >
            <Play className="h-4 w-4" />
            Agent Demo
          </a>
        </nav>

        <div className="px-5 py-3 border-t border-gray-200">
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-emerald-500" />
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
