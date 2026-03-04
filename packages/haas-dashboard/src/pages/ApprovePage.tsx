import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Shield, CheckCircle, XCircle, AlertTriangle, Linkedin, Github,
  Key, Lock, UserCheck, Loader2, ShieldX
} from 'lucide-react';
import { submitApproval, fetchEnabledProviders, type PendingTask, type ProviderDTO } from '../lib/api';
import { cn, tierColor, formatRelativeTime } from '../lib/utils';

type AuthStep = 'authenticate' | 'verify-skills' | 'review' | 'skill-mismatch' | 'done';
type AuthProvider = string;

const PROVIDER_UI: Record<string, { name: string; icon: typeof Linkedin; color: string }> = {
  linkedin: { name: 'LinkedIn', icon: Linkedin, color: 'bg-[#0A66C2] hover:bg-[#004182]' },
  github: { name: 'GitHub', icon: Github, color: 'bg-gray-900 hover:bg-gray-800' },
  sso: { name: 'Enterprise SSO', icon: Key, color: 'bg-brand-600 hover:bg-brand-700' },
  oidc: { name: 'OIDC', icon: Key, color: 'bg-indigo-600 hover:bg-indigo-700' },
  okta: { name: 'Okta', icon: Key, color: 'bg-blue-700 hover:bg-blue-800' },
  web3: { name: 'Web3 Wallet', icon: Key, color: 'bg-purple-700 hover:bg-purple-800' },
  mock: { name: 'Mock (Dev)', icon: Key, color: 'bg-gray-500 hover:bg-gray-600' },
};

const SKILL_POOL_MAP: Record<string, string[]> = {
  finance: ['Financial Analysis', 'Treasury', 'Budget Approval', 'Compliance'],
  security: ['Security Architecture', 'Incident Response', 'Threat Assessment', 'Access Control'],
  engineering: ['Software Engineering', 'System Administration', 'DevOps', 'Cloud Architecture'],
  legal: ['Contract Review', 'Regulatory Compliance', 'IP Law', 'Data Privacy'],
  executive: ['Strategic Planning', 'Executive Oversight', 'Risk Management'],
  general: ['General Approval'],
};

/**
 * Approval Page — Separate page for SME/specialist credential verification.
 *
 * Flow:
 * 1. SME clicks approval link from email/slack/dashboard
 * 2. Authenticates via LinkedIn/GitHub/SSO
 * 3. System verifies their skills match the required pool
 *    - If mismatch → blocked with explanation
 *    - If match → proceed to review
 * 4. They review the request details and approve/reject
 */
export function ApprovePage() {
  const { requestId } = useParams<{ requestId: string }>();
  const navigate = useNavigate();

  const [step, setStep] = useState<AuthStep>('authenticate');
  const [selectedProvider, setSelectedProvider] = useState<AuthProvider | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [task, setTask] = useState<PendingTask | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [decision, setDecision] = useState<'APPROVE' | 'REJECT' | null>(null);
  const [simulateMismatch, setSimulateMismatch] = useState(false);
  const [enabledProviders, setEnabledProviders] = useState<ProviderDTO[]>([]);

  // Simulated authenticated user
  const [authenticatedUser, setAuthenticatedUser] = useState<{
    name: string;
    email: string;
    provider: string;
    skills: string[];
    missingSkills: string[];
    seniority: string;
    org: string;
    avatar: string;
    skillsMatch: boolean;
  } | null>(null);

  // Load task
  const loadTask = useCallback(async () => {
    if (!requestId) return;
    try {
      const res = await fetch(`/pending`);
      const data = await res.json();
      const found = (data.pending ?? []).find((t: PendingTask) => t.request.id === requestId);
      if (found) setTask(found);
      else setError('Request not found or already resolved');
    } catch {
      setError('Unable to connect to HaaS Core');
    }
  }, [requestId]);

  useEffect(() => {
    loadTask();
    fetchEnabledProviders().then(setEnabledProviders).catch(() => {});
  }, [loadTask]);

  // Simulate authentication
  const handleAuthenticate = async (provider: AuthProvider) => {
    setSelectedProvider(provider);
    setIsVerifying(true);

    // Simulate OAuth flow delay
    await new Promise((r) => setTimeout(r, 1500));

    const requiredPools = task?.request.requiredPools ?? [];
    const requiredSkills = requiredPools.flatMap((p) => SKILL_POOL_MAP[p] ?? []);

    if (simulateMismatch) {
      // Simulate a user who does NOT have the right skills
      const wrongSkills = ['Marketing', 'Content Writing', 'Social Media'];
      setAuthenticatedUser({
        name: 'Pat Rivera',
        email: 'pat.rivera@company.com',
        provider: PROVIDER_UI[provider]?.name ?? provider,
        skills: wrongSkills,
        missingSkills: requiredSkills.slice(0, 3),
        seniority: 'Associate',
        org: 'Acme Corp',
        avatar: `https://ui-avatars.com/api/?name=Pat+Rivera&background=ef4444&color=fff&size=80`,
        skillsMatch: false,
      });
      setIsVerifying(false);
      setStep('skill-mismatch');
    } else {
      // Simulate a user who has the right skills
      const matchedSkills = requiredPools.flatMap((p) => SKILL_POOL_MAP[p]?.slice(0, 2) ?? []);
      setAuthenticatedUser({
        name: 'Alex Johnson',
        email: 'alex.johnson@company.com',
        provider: PROVIDER_UI[provider]?.name ?? provider,
        skills: matchedSkills.length > 0 ? matchedSkills : ['General Approval'],
        missingSkills: [],
        seniority: 'Senior',
        org: 'Acme Corp',
        avatar: `https://ui-avatars.com/api/?name=Alex+Johnson&background=3b82f6&color=fff&size=80`,
        skillsMatch: true,
      });
      setIsVerifying(false);
      setStep('verify-skills');
    }
  };

  // Verify skills match
  const handleVerifySkills = async () => {
    setIsVerifying(true);
    await new Promise((r) => setTimeout(r, 1000));
    setIsVerifying(false);
    setStep('review');
  };

  // Submit decision
  const handleSubmit = async (action: 'APPROVE' | 'REJECT') => {
    if (!requestId || !authenticatedUser) return;
    setIsVerifying(true);
    setDecision(action);

    try {
      await submitApproval(
        requestId,
        authenticatedUser.email,
        task?.request.requiredPools[0] ?? 'general',
        action,
        reason || undefined,
      );
      setStep('done');
    } catch {
      setError('Failed to submit decision');
    } finally {
      setIsVerifying(false);
    }
  };

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="card max-w-md w-full text-center">
          <AlertTriangle className="h-10 w-10 text-amber-500 mx-auto mb-3" />
          <h2 className="text-lg font-semibold text-gray-900">Unable to Load Request</h2>
          <p className="text-sm text-gray-500 mt-2">{error}</p>
          <button onClick={() => navigate('/')} className="btn-primary mt-4">
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  if (!task) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-brand-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header bar */}
      <div className="bg-white border-b border-gray-200 px-6 py-3">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-brand-600" />
            <span className="text-sm font-semibold text-gray-900">AgentGuard</span>
            <span className="text-gray-300">|</span>
            <span className="text-sm text-gray-500">Approval Request</span>
          </div>
          <span className={cn('badge', tierColor(task.request.riskTier))}>
            {task.request.riskTier} RISK
          </span>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-6 py-8 space-y-6">

        {/* Progress Steps */}
        <div className="flex items-center justify-center gap-0">
          {(['authenticate', 'verify-skills', 'review'] as AuthStep[]).map((s, i) => {
            const labels = ['Authenticate', 'Verify Skills', 'Review & Decide'];
            const stepOrder = ['authenticate', 'verify-skills', 'review'];
            const currentIdx = step === 'skill-mismatch' ? 1 : step === 'done' ? 3 : stepOrder.indexOf(step);
            const isActive = (step === 'skill-mismatch' && i === 1) || s === step;
            const isDone = currentIdx > i;
            const isFailed = step === 'skill-mismatch' && i === 1;
            return (
              <div key={s} className="flex items-center">
                {i > 0 && <div className={cn('w-12 h-px', isDone ? 'bg-brand-500' : isFailed ? 'bg-red-400' : 'bg-gray-200')} />}
                <div className="flex flex-col items-center gap-1">
                  <div className={cn(
                    'w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium border-2',
                    isFailed ? 'bg-red-100 border-red-400 text-red-600' :
                    isDone ? 'bg-brand-600 border-brand-600 text-white' :
                    isActive ? 'border-brand-500 text-brand-600 bg-white' :
                    'border-gray-200 text-gray-400 bg-white',
                  )}>
                    {isFailed ? '✕' : isDone && !isActive ? '✓' : i + 1}
                  </div>
                  <span className={cn('text-[11px] font-medium',
                    isFailed ? 'text-red-500' :
                    isActive ? 'text-brand-600' : 'text-gray-400',
                  )}>
                    {labels[i]}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Request Summary Card (always visible) */}
        <div className="card">
          <div className="flex items-start justify-between mb-3">
            <div>
              <h3 className="text-base font-semibold text-gray-900">{task.request.toolName}</h3>
              <p className="text-xs text-gray-500 mt-0.5">
                Agent: {task.request.agentId} · {formatRelativeTime(task.createdAt)}
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-500">
                {task.signatures.length}/{task.request.threshold} approvals
              </p>
              <p className="text-xs text-gray-400 mt-0.5">
                Pools: {task.request.requiredPools.join(', ')}
              </p>
            </div>
          </div>
          <div className="rounded-md bg-gray-50 border border-gray-200 p-3">
            <p className="text-[11px] text-gray-500 mb-1 uppercase tracking-wider font-medium">Arguments</p>
            <pre className="text-xs text-gray-700 overflow-x-auto">
              {JSON.stringify(task.request.toolArgs, null, 2)}
            </pre>
          </div>
        </div>

        {/* Step 1: Authenticate */}
        {step === 'authenticate' && (
          <div className="card">
            <div className="flex items-center gap-2 mb-1">
              <Lock className="h-4 w-4 text-gray-600" />
              <h3 className="text-sm font-semibold text-gray-900">Verify Your Identity</h3>
            </div>
            <p className="text-xs text-gray-500 mb-4">
              Sign in with your credential provider to verify your identity before reviewing this request.
            </p>

            {/* Demo toggle for skill mismatch */}
            <div className="flex items-center gap-2 mb-4 px-3 py-2 rounded-lg bg-amber-50 border border-amber-200">
              <label className="flex items-center gap-2 text-xs text-amber-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={simulateMismatch}
                  onChange={(e) => setSimulateMismatch(e.target.checked)}
                  className="rounded border-amber-300"
                />
                <span><strong>Demo:</strong> Simulate skill mismatch (unqualified approver)</span>
              </label>
            </div>

            <div className="space-y-2">
              {enabledProviders.length === 0 ? (
                <p className="text-sm text-gray-400 italic py-2">No providers enabled. Configure in Settings.</p>
              ) : (
                enabledProviders.map((prov) => {
                  const ui = PROVIDER_UI[prov.name] ?? { name: prov.name, icon: Key, color: 'bg-gray-600 hover:bg-gray-700' };
                  const ProvIcon = ui.icon;
                  return (
                    <button
                      key={prov.name}
                      onClick={() => handleAuthenticate(prov.name)}
                      disabled={isVerifying}
                      className={cn(
                        'w-full flex items-center gap-3 px-4 py-3 rounded-lg text-white text-sm font-medium transition-colors',
                        ui.color,
                        isVerifying && selectedProvider === prov.name && 'opacity-70',
                      )}
                    >
                      {isVerifying && selectedProvider === prov.name ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <ProvIcon className="h-4 w-4" />
                      )}
                      Continue with {ui.name}
                    </button>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* Step 2a: Skill Verification — MATCH */}
        {step === 'verify-skills' && authenticatedUser && (
          <div className="card">
            <div className="flex items-center gap-2 mb-4">
              <UserCheck className="h-4 w-4 text-gray-600" />
              <h3 className="text-sm font-semibold text-gray-900">Skill Verification</h3>
            </div>

            {/* Authenticated User */}
            <div className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 border border-gray-200 mb-4">
              <img src={authenticatedUser.avatar} alt="" className="w-10 h-10 rounded-full" />
              <div>
                <p className="text-sm font-medium text-gray-900">{authenticatedUser.name}</p>
                <p className="text-xs text-gray-500">
                  {authenticatedUser.email} · via {authenticatedUser.provider}
                </p>
              </div>
              <CheckCircle className="h-4 w-4 text-emerald-500 ml-auto" />
            </div>

            {/* Skill Match */}
            <div className="space-y-3">
              <div>
                <p className="text-xs font-medium text-gray-700 mb-1.5">Required Pools</p>
                <div className="flex flex-wrap gap-1.5">
                  {task.request.requiredPools.map((pool) => (
                    <span key={pool} className="badge badge-pending">{pool}</span>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-xs font-medium text-gray-700 mb-1.5">Your Verified Skills</p>
                <div className="flex flex-wrap gap-1.5">
                  {authenticatedUser.skills.map((skill) => (
                    <span key={skill} className="badge badge-approved">{skill}</span>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-2 p-3 rounded-lg bg-emerald-50 border border-emerald-200">
                <CheckCircle className="h-4 w-4 text-emerald-600 flex-shrink-0" />
                <p className="text-xs text-emerald-700">
                  <strong>Skill match confirmed.</strong> Your credentials qualify you to review this {task.request.riskTier} risk request.
                </p>
              </div>
            </div>

            <button
              onClick={handleVerifySkills}
              disabled={isVerifying}
              className="btn-primary w-full mt-4 flex items-center justify-center gap-2"
            >
              {isVerifying ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Proceed to Review
            </button>
          </div>
        )}

        {/* Step 2b: Skill Verification — MISMATCH */}
        {step === 'skill-mismatch' && authenticatedUser && (
          <div className="card border-red-200">
            <div className="flex items-center gap-2 mb-4">
              <ShieldX className="h-4 w-4 text-red-500" />
              <h3 className="text-sm font-semibold text-red-700">Skill Verification Failed</h3>
            </div>

            {/* Authenticated User */}
            <div className="flex items-center gap-3 p-3 rounded-lg bg-red-50 border border-red-200 mb-4">
              <img src={authenticatedUser.avatar} alt="" className="w-10 h-10 rounded-full" />
              <div>
                <p className="text-sm font-medium text-gray-900">{authenticatedUser.name}</p>
                <p className="text-xs text-gray-500">
                  {authenticatedUser.email} · via {authenticatedUser.provider}
                </p>
              </div>
              <XCircle className="h-4 w-4 text-red-500 ml-auto" />
            </div>

            <div className="space-y-3">
              {/* What you have */}
              <div>
                <p className="text-xs font-medium text-gray-700 mb-1.5">Your Verified Skills</p>
                <div className="flex flex-wrap gap-1.5">
                  {authenticatedUser.skills.map((skill) => (
                    <span key={skill} className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold bg-gray-100 text-gray-500 border border-gray-200 line-through">
                      {skill}
                    </span>
                  ))}
                </div>
              </div>

              {/* What's required */}
              <div>
                <p className="text-xs font-medium text-gray-700 mb-1.5">Required Skills (Missing)</p>
                <div className="flex flex-wrap gap-1.5">
                  {authenticatedUser.missingSkills.map((skill) => (
                    <span key={skill} className="badge badge-rejected">{skill}</span>
                  ))}
                </div>
              </div>

              {/* Required pools */}
              <div>
                <p className="text-xs font-medium text-gray-700 mb-1.5">Required Pools</p>
                <div className="flex flex-wrap gap-1.5">
                  {task.request.requiredPools.map((pool) => (
                    <span key={pool} className="badge badge-pending">{pool}</span>
                  ))}
                </div>
              </div>

              {/* Blocked message */}
              <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 border border-red-200">
                <AlertTriangle className="h-4 w-4 text-red-500 flex-shrink-0 mt-0.5" />
                <div className="text-xs text-red-700">
                  <p className="font-semibold mb-1">You are not authorised to review this request.</p>
                  <p>
                    This <strong>{task.request.riskTier}</strong> risk action requires reviewers from
                    the <strong>{task.request.requiredPools.join(', ')}</strong> pool(s).
                    Your credentials ({authenticatedUser.seniority}, {authenticatedUser.org}) do not include
                    the required skills. Please contact your administrator or forward this link to a
                    qualified reviewer.
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-4 flex gap-2">
              <button
                onClick={() => { setStep('authenticate'); setSimulateMismatch(false); }}
                className="btn-secondary flex-1"
              >
                Try Different Account
              </button>
              <button
                onClick={() => navigate('/')}
                className="btn-secondary flex-1"
              >
                Back to Dashboard
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Review & Decide */}
        {step === 'review' && authenticatedUser && (
          <div className="card">
            <div className="flex items-center gap-2 mb-4">
              <Shield className="h-4 w-4 text-gray-600" />
              <h3 className="text-sm font-semibold text-gray-900">Review & Decide</h3>
            </div>

            <p className="text-xs text-gray-500 mb-3">
              As <strong>{authenticatedUser.name}</strong> ({authenticatedUser.seniority}, {authenticatedUser.org}),
              you are authorised to approve or reject this request.
            </p>

            <div className="mb-4">
              <label className="block text-xs font-medium text-gray-700 mb-1">Reason (optional)</label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={2}
                placeholder="Provide a reason for your decision..."
                className="input-field resize-none"
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => handleSubmit('APPROVE')}
                disabled={isVerifying}
                className="btn-approve flex-1 flex items-center justify-center gap-2"
              >
                {isVerifying && decision === 'APPROVE' ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle className="h-4 w-4" />
                )}
                Approve
              </button>
              <button
                onClick={() => handleSubmit('REJECT')}
                disabled={isVerifying}
                className="btn-reject flex-1 flex items-center justify-center gap-2"
              >
                {isVerifying && decision === 'REJECT' ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <XCircle className="h-4 w-4" />
                )}
                Reject
              </button>
            </div>
          </div>
        )}

        {/* Step 4: Done */}
        {step === 'done' && (
          <div className="card text-center py-8">
            {decision === 'APPROVE' ? (
              <CheckCircle className="h-12 w-12 text-emerald-500 mx-auto mb-3" />
            ) : (
              <XCircle className="h-12 w-12 text-red-500 mx-auto mb-3" />
            )}
            <h3 className="text-lg font-semibold text-gray-900">
              Request {decision === 'APPROVE' ? 'Approved' : 'Rejected'}
            </h3>
            <p className="text-sm text-gray-500 mt-1">
              Your decision has been recorded and the agent has been notified.
            </p>
            <p className="text-xs text-gray-400 mt-3">
              Reviewed by {authenticatedUser?.name} via {authenticatedUser?.provider}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
