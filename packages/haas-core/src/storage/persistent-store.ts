// ============================================================================
// AgentGuard Core — Persistent File Store
// Stores settings and audit data as JSON files on disk.
// ============================================================================

import fs from 'fs';
import path from 'path';

const DATA_DIR = path.resolve(process.cwd(), '.agentguard');

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function filePath(name: string): string {
  return path.join(DATA_DIR, `${name}.json`);
}

// ── Generic read/write ──────────────────────────────────────────────────

function readJSON<T>(name: string, fallback: T): T {
  ensureDir();
  const p = filePath(name);
  if (!fs.existsSync(p)) return fallback;
  try {
    return JSON.parse(fs.readFileSync(p, 'utf-8')) as T;
  } catch {
    return fallback;
  }
}

function writeJSON<T>(name: string, data: T): void {
  ensureDir();
  fs.writeFileSync(filePath(name), JSON.stringify(data, null, 2), 'utf-8');
}

// ── Identity Providers ──────────────────────────────────────────────────

export interface ProviderSetting {
  name: string;
  enabled: boolean;
  clientId?: string;
  clientSecret?: string;
}

export function loadProviders(): ProviderSetting[] {
  return readJSON<ProviderSetting[]>('providers', [
    { name: 'github', enabled: true },
    { name: 'linkedin', enabled: true },
    { name: 'sso', enabled: true },
    { name: 'oidc', enabled: false },
    { name: 'okta', enabled: false },
    { name: 'web3', enabled: false },
    { name: 'mock', enabled: false },
  ]);
}

export function saveProviders(providers: ProviderSetting[]): void {
  writeJSON('providers', providers);
}

// ── Risk Policies ──────────────────────────────────────────────────────

export function loadPolicies<T>(): T | null {
  return readJSON<T | null>('policies', null);
}

export function savePolicies<T>(policies: T): void {
  writeJSON('policies', policies);
}

// ── Audit Log ───────────────────────────────────────────────────────────

export interface AuditRecord {
  task: unknown;
  resolvedAt: number;
}

export function loadAuditLog(): AuditRecord[] {
  return readJSON<AuditRecord[]>('audit-log', []);
}

export function appendAuditEntry(entry: AuditRecord): void {
  const log = loadAuditLog();
  log.push(entry);
  // Keep last 5000 entries
  const trimmed = log.length > 5000 ? log.slice(-5000) : log;
  writeJSON('audit-log', trimmed);
}

export function getAuditEntries(limit: number = 100): AuditRecord[] {
  const log = loadAuditLog();
  return log.slice(-limit);
}
