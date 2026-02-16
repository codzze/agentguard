import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatRelativeTime(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (seconds < 60) return `${seconds}s ago`;
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export function tierColor(tier: string): string {
  switch (tier) {
    case 'LOW': return 'badge-low';
    case 'MID': return 'badge-mid';
    case 'HIGH': return 'badge-high';
    case 'CRITICAL': return 'badge-critical';
    default: return 'badge-low';
  }
}

export function stateColor(state: string): string {
  switch (state) {
    case 'APPROVED': return 'text-green-400';
    case 'REJECTED': return 'text-red-400';
    case 'TIMEOUT': return 'text-yellow-400';
    case 'WAITING_FOR_HUMAN': return 'text-blue-400';
    case 'PENDING': return 'text-gray-400';
    default: return 'text-gray-500';
  }
}
