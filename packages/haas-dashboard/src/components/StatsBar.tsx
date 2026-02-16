import { Shield, Users, AlertTriangle, CheckCircle } from 'lucide-react';

interface StatsBarProps {
  pending: number;
  approved: number;
  rejected: number;
  critical: number;
}

export function StatsBar({ pending, approved, rejected, critical }: StatsBarProps) {
  const stats = [
    {
      label: 'Pending',
      value: pending,
      icon: Shield,
      color: 'text-blue-400',
      bg: 'bg-blue-500/10',
    },
    {
      label: 'Approved',
      value: approved,
      icon: CheckCircle,
      color: 'text-green-400',
      bg: 'bg-green-500/10',
    },
    {
      label: 'Rejected',
      value: rejected,
      icon: AlertTriangle,
      color: 'text-red-400',
      bg: 'bg-red-500/10',
    },
    {
      label: 'Critical',
      value: critical,
      icon: Users,
      color: 'text-orange-400',
      bg: 'bg-orange-500/10',
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {stats.map(({ label, value, icon: Icon, color, bg }) => (
        <div key={label} className="card flex items-center gap-4">
          <div className={`rounded-lg p-2.5 ${bg}`}>
            <Icon className={`h-5 w-5 ${color}`} />
          </div>
          <div>
            <p className="text-2xl font-bold text-white">{value}</p>
            <p className="text-xs text-gray-500">{label}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
