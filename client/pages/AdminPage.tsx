import { useCallback, useEffect, useState, type FormEvent } from 'react';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  KeyRound,
  Lock,
  LogOut,
  RefreshCw,
  Server,
  ShieldCheck,
  Trash2,
  Zap,
} from 'lucide-react';
import { BilingualErrorCard } from '../components/BilingualErrorCard.tsx';
import { useSettings } from '../hooks/useSettings.tsx';
import {
  ClientApiError,
  adminLogin,
  adminLogout,
  clearAdminRuntimeApiKey,
  fetchAdminStatus,
  getInMemoryAdminToken,
  setAdminDefaultModel,
  setAdminRuntimeApiKey,
  testApiConnection,
} from '../lib/api.ts';
import type { AdminStatusResponse, TestConnectionResponse } from '../types/index.ts';

function formatUptime(seconds: number): string {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  if (hrs > 0) return `${hrs}h ${mins}m`;
  if (mins > 0) return `${mins}m ${secs}s`;
  return `${secs}s`;
}

export function AdminPage() {
  const { models, refreshHealthAndModels, addToast } = useSettings();

  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() =>
    Boolean(getInMemoryAdminToken())
  );
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loginBusy, setLoginBusy] = useState(false);
  const [loginError, setLoginError] = useState<{
    code?: string;
    messageEn: string;
    messageBn: string;
  } | null>(null);

  const [status, setStatus] = useState<AdminStatusResponse | null>(null);
  const [statusLoading, setStatusLoading] = useState(false);

  const [apiKeyInput, setApiKeyInput] = useState('');
  const [keyBusy, setKeyBusy] = useState(false);
  const [keyError, setKeyError] = useState<{
    code?: string;
    messageEn: string;
    messageBn: string;
  } | null>(null);

  const [selectedDefaultModel, setSelectedDefaultModel] = useState('');
  const [modelBusy, setModelBusy] = useState(false);

  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<TestConnectionResponse | null>(null);
  const [testError, setTestError] = useState<{
    code?: string;
    messageEn: string;
    messageBn: string;
    retryAfterSeconds?: number;
  } | null>(null);

  const loadAdminStatus = useCallback(async () => {
    setStatusLoading(true);
    try {
      const data = await fetchAdminStatus();
      setStatus(data);
      setSelectedDefaultModel(data.defaultModel);
      setIsAuthenticated(true);
    } catch (err) {
      if (err instanceof ClientApiError && err.status === 401) {
        setIsAuthenticated(false);
        setStatus(null);
      }
    } finally {
      setStatusLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      void loadAdminStatus();
    }
  }, [isAuthenticated, loadAdminStatus]);

  async function handleLoginSubmit(e: FormEvent) {
    e.preventDefault();
    setLoginBusy(true);
    setLoginError(null);

    try {
      await adminLogin(username.trim(), password);
      setPassword('');
      setIsAuthenticated(true);
      addToast({
        variant: 'success',
        title: 'Admin signed in',
        description: `Welcome, ${username.trim()}.`,
      });
      await loadAdminStatus();
    } catch (err) {
      if (err instanceof ClientApiError) {
        setLoginError({
          code: err.code,
          messageEn: err.messageEn,
          messageBn: err.messageBn,
        });
      } else {
        setLoginError({
          messageEn: 'Unable to sign in. Please try again.',
          messageBn: 'লগইন করা যায়নি। অনুগ্রহ করে আবার চেষ্টা করুন।',
        });
      }
    } finally {
      setLoginBusy(false);
    }
  }

  async function handleLogout() {
    await adminLogout();
    setIsAuthenticated(false);
    setStatus(null);
    setTestResult(null);
    addToast({ variant: 'info', title: 'Signed out of Admin Portal' });
  }

  async function handleSaveRuntimeKey(e: FormEvent) {
    e.preventDefault();
    const trimmed = apiKeyInput.trim();
    if (trimmed.length < 16) {
      setKeyError({
        code: 'VALIDATION_ERROR',
        messageEn: 'Please enter a valid Gemini API key (at least 16 characters).',
        messageBn: 'অনুগ্রহ করে সঠিক Gemini API কী লিখুন (কমপক্ষে ১৬ অক্ষর)।',
      });
      return;
    }

    setKeyBusy(true);
    setKeyError(null);
    try {
      const res = await setAdminRuntimeApiKey(trimmed, false);
      setApiKeyInput('');
      addToast({
        variant: 'success',
        title: 'Server Runtime Key Activated',
        description: `Verified and active in server RAM (${res.maskedHint}).`,
      });
      await Promise.all([loadAdminStatus(), refreshHealthAndModels()]);
    } catch (err) {
      if (err instanceof ClientApiError) {
        setKeyError({
          code: err.code,
          messageEn: err.messageEn,
          messageBn: err.messageBn,
        });
      } else {
        setKeyError({
          messageEn: 'Could not verify and activate the API key.',
          messageBn: 'API কী যাচাই ও সক্রিয় করা যায়নি।',
        });
      }
    } finally {
      setKeyBusy(false);
    }
  }

  async function handleClearRuntimeKey() {
    setKeyBusy(true);
    setKeyError(null);
    try {
      await clearAdminRuntimeApiKey();
      addToast({
        variant: 'info',
        title: 'Admin runtime key cleared',
        description: 'Falling back to server environment GEMINI_API_KEY if configured.',
      });
      await Promise.all([loadAdminStatus(), refreshHealthAndModels()]);
    } finally {
      setKeyBusy(false);
    }
  }

  async function handleUpdateDefaultModel() {
    if (!selectedDefaultModel) return;
    setModelBusy(true);
    try {
      const res = await setAdminDefaultModel(selectedDefaultModel);
      addToast({
        variant: 'success',
        title: 'Server default model updated',
        description: res.defaultModel,
      });
      await Promise.all([loadAdminStatus(), refreshHealthAndModels()]);
    } catch (err) {
      addToast({
        variant: 'error',
        title: 'Failed to update default model',
        description: err instanceof ClientApiError ? err.messageEn : 'Unexpected error',
      });
    } finally {
      setModelBusy(false);
    }
  }

  async function handleTestConnection() {
    setTesting(true);
    setTestResult(null);
    setTestError(null);
    try {
      const res = await testApiConnection(selectedDefaultModel || undefined);
      setTestResult(res);
      addToast({
        variant: 'success',
        title: 'Live Gemini connection verified',
        description: `${res.model} · ${res.latencyMs}ms`,
      });
    } catch (err) {
      if (err instanceof ClientApiError) {
        setTestError({
          code: err.code,
          messageEn: err.messageEn,
          messageBn: err.messageBn,
          retryAfterSeconds: err.retryAfterSeconds,
        });
      } else {
        setTestError({
          messageEn: 'Connection test failed.',
          messageBn: 'সংযোগ পরীক্ষা ব্যর্থ হয়েছে।',
        });
      }
    } finally {
      setTesting(false);
    }
  }

  if (!isAuthenticated) {
    return (
      <div className="mx-auto max-w-md px-4 py-12 sm:px-6">
        <div className="rounded-2xl border border-border-subtle bg-surface p-6 sm:p-8 shadow-sm">
          <div className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-primary-dark/10 text-primary-dark">
            <Lock className="h-5 w-5" />
          </div>
          <h1 className="mt-4 font-display text-2xl font-bold text-primary-dark">
            Admin Portal
          </h1>
          <p className="mt-1.5 text-sm text-text-secondary">
            Sign in to inspect system health, test Gemini connectivity, and manage server runtime
            configuration.
          </p>

          {loginError && (
            <div className="mt-5">
              <BilingualErrorCard
                code={loginError.code}
                messageEn={loginError.messageEn}
                messageBn={loginError.messageBn}
              />
            </div>
          )}

          <form onSubmit={(e) => void handleLoginSubmit(e)} className="mt-6 space-y-4">
            <div>
              <label
                htmlFor="admin-username"
                className="block text-xs font-semibold text-text-secondary"
              >
                Admin Username
              </label>
              <input
                id="admin-username"
                type="text"
                autoComplete="username"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter admin username"
                className="mt-1.5 w-full min-h-[44px] rounded-xl border border-border-strong bg-surface px-3.5 text-sm text-text-primary placeholder:text-text-muted focus:border-brand-indigo focus:outline-none"
              />
            </div>

            <div>
              <label
                htmlFor="admin-password"
                className="block text-xs font-semibold text-text-secondary"
              >
                Password
              </label>
              <input
                id="admin-password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter admin password"
                className="mt-1.5 w-full min-h-[44px] rounded-xl border border-border-strong bg-surface px-3.5 text-sm text-text-primary placeholder:text-text-muted focus:border-brand-indigo focus:outline-none"
              />
            </div>

            <button
              type="submit"
              disabled={loginBusy || !username.trim() || !password}
              className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-brand-indigo px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-60"
            >
              <ShieldCheck className="h-4 w-4" />
              {loginBusy ? 'Signing In...' : 'Sign In'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold text-brand-indigo">
            Signed in as {status?.username || 'Admin'}
          </p>
          <h1 className="mt-0.5 font-display text-2xl font-bold tracking-tight text-primary-dark sm:text-3xl">
            EduGenius Admin Console
          </h1>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => void loadAdminStatus()}
            className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border border-border-strong bg-surface px-3.5 py-2 text-xs font-semibold text-text-primary hover:bg-surface-muted"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${statusLoading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            type="button"
            onClick={() => void handleLogout()}
            className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border border-border-strong bg-surface px-3.5 py-2 text-xs font-semibold text-error hover:bg-error-soft"
          >
            <LogOut className="h-3.5 w-3.5" />
            Sign Out
          </button>
        </div>
      </div>

      {/* Live Server Overview */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-border-subtle bg-surface p-5">
          <div className="flex items-center justify-between text-xs text-text-muted">
            <span>AI Status</span>
            <Server className="h-4 w-4 text-brand-indigo" />
          </div>
          <div className="mt-2 flex items-center gap-2">
            {status?.connectionStatus === 'connected' ? (
              <>
                <CheckCircle2 className="h-5 w-5 text-success-emerald shrink-0" />
                <span className="font-display text-lg font-bold text-primary-dark">
                  Connected
                </span>
              </>
            ) : (
              <>
                <AlertTriangle className="h-5 w-5 text-warning shrink-0" />
                <span className="font-display text-lg font-bold text-primary-dark">
                  Not configured
                </span>
              </>
            )}
          </div>
          <p className="mt-1 text-xs text-text-secondary">
            Source:{' '}
            {status?.activeKeySource === 'admin'
              ? `Admin Runtime (${status.adminKeyMask})`
              : status?.activeKeySource === 'env'
                ? 'Server Environment Secret'
                : 'None active'}
          </p>
        </div>

        <div className="rounded-2xl border border-border-subtle bg-surface p-5">
          <div className="flex items-center justify-between text-xs text-text-muted">
            <span>Default Model</span>
            <Zap className="h-4 w-4 text-ai-violet" />
          </div>
          <p className="mt-2 font-mono text-sm font-bold text-primary-dark truncate">
            {status?.defaultModel || '—'}
          </p>
          <p className="mt-1 text-xs text-text-secondary">Active server-side fallback</p>
        </div>

        <div className="rounded-2xl border border-border-subtle bg-surface p-5">
          <div className="flex items-center justify-between text-xs text-text-muted">
            <span>Active Quiz Sessions</span>
            <Activity className="h-4 w-4 text-success-emerald" />
          </div>
          <p className="mt-2 font-display text-2xl font-bold text-primary-dark tabular-nums">
            {status?.activeQuizSessions ?? 0}
          </p>
          <p className="mt-1 text-xs text-text-secondary">Stored securely in server RAM</p>
        </div>

        <div className="rounded-2xl border border-border-subtle bg-surface p-5">
          <div className="flex items-center justify-between text-xs text-text-muted">
            <span>API Requests / Uptime</span>
            <Activity className="h-4 w-4 text-brand-indigo" />
          </div>
          <p className="mt-2 font-display text-2xl font-bold text-primary-dark tabular-nums">
            {status?.totalApiRequests ?? 0}
          </p>
          <p className="mt-1 text-xs text-text-secondary tabular-nums">
            Uptime: {formatUptime(status?.uptimeSeconds ?? 0)}
          </p>
        </div>
      </section>

      {/* Server Runtime Gemini API Key Management */}
      <section className="rounded-2xl border border-border-subtle bg-surface p-6 shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-brand-indigo" />
            <h2 className="font-display text-base font-bold text-primary-dark">
              Server Runtime Gemini API Key
            </h2>
          </div>

          {status?.hasAdminKey && (
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-success-emerald">
              <ShieldCheck className="h-4 w-4" />
              Runtime key active ({status.adminKeyMask})
            </span>
          )}
        </div>

        <p className="text-sm text-text-secondary leading-relaxed">
          Set or rotate a live Gemini API key in server memory for all EduGenius AI users. The
          key is verified directly against Gemini before activation and is{' '}
          <strong>never</strong> stored in browser storage, logs, or disk. For permanent
          persistence across restarts, configure <code className="font-mono">GEMINI_API_KEY</code>{' '}
          in <strong>Settings &gt; Secrets</strong> or platform environment secrets.
        </p>

        {keyError && (
          <BilingualErrorCard
            code={keyError.code}
            messageEn={keyError.messageEn}
            messageBn={keyError.messageBn}
          />
        )}

        <form onSubmit={(e) => void handleSaveRuntimeKey(e)} className="flex flex-col gap-3 sm:flex-row">
          <label htmlFor="admin-gemini-key" className="sr-only">
            Gemini API Key
          </label>
          <input
            id="admin-gemini-key"
            type="password"
            autoComplete="off"
            value={apiKeyInput}
            onChange={(e) => setApiKeyInput(e.target.value)}
            placeholder="Paste Gemini API key to verify & activate on server..."
            className="min-h-[44px] flex-1 rounded-xl border border-border-strong bg-surface px-3.5 text-sm text-text-primary placeholder:text-text-muted focus:border-brand-indigo focus:outline-none"
          />
          <button
            type="submit"
            disabled={keyBusy || !apiKeyInput.trim()}
            className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-brand-indigo px-5 py-2 text-sm font-semibold text-white hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-50 whitespace-nowrap"
          >
            {keyBusy ? 'Verifying & Saving...' : 'Verify & Activate Key'}
          </button>

          {status?.hasAdminKey && (
            <button
              type="button"
              disabled={keyBusy}
              onClick={() => void handleClearRuntimeKey()}
              className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-error/40 bg-error-soft px-4 py-2 text-sm font-semibold text-error hover:bg-error/10 whitespace-nowrap"
            >
              <Trash2 className="h-4 w-4" />
              Clear Runtime Key
            </button>
          )}
        </form>
      </section>

      {/* Default Model & Connection Diagnostics */}
      <section className="rounded-2xl border border-border-subtle bg-surface p-6 shadow-sm space-y-5">
        <h2 className="font-display text-base font-bold text-primary-dark">
          Default Model &amp; Live Diagnostics
        </h2>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <label
              htmlFor="admin-default-model"
              className="block text-xs font-semibold text-text-secondary"
            >
              Server Default Model
            </label>
            <select
              id="admin-default-model"
              value={selectedDefaultModel}
              onChange={(e) => setSelectedDefaultModel(e.target.value)}
              className="mt-1.5 w-full min-h-[42px] rounded-xl border border-border-strong bg-surface px-3 text-sm text-text-primary focus:border-brand-indigo focus:outline-none"
            >
              {models.length === 0 ? (
                <option value={status?.defaultModel || 'gemini-4-hydrogen'}>
                  {status?.defaultModel || 'gemini-4-hydrogen'}
                </option>
              ) : (
                models.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.displayName} ({m.id})
                  </option>
                ))
              )}
            </select>
          </div>

          <button
            type="button"
            disabled={modelBusy || !selectedDefaultModel}
            onClick={() => void handleUpdateDefaultModel()}
            className="inline-flex min-h-[42px] items-center justify-center rounded-xl border border-border-strong bg-surface px-4 py-2 text-sm font-semibold text-primary-dark hover:bg-surface-muted disabled:opacity-50 whitespace-nowrap"
          >
            {modelBusy ? 'Saving...' : 'Set Server Default'}
          </button>

          <button
            type="button"
            disabled={testing}
            onClick={() => void handleTestConnection()}
            className="inline-flex min-h-[42px] items-center justify-center gap-2 rounded-xl bg-primary-dark px-5 py-2 text-sm font-semibold text-white hover:bg-brand-indigo disabled:opacity-60 whitespace-nowrap"
          >
            <Zap className="h-4 w-4" />
            {testing ? 'Testing...' : 'Test Active Key'}
          </button>
        </div>

        {testResult && (
          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-success-emerald/35 bg-success-soft px-4 py-3 text-xs font-medium text-success-emerald">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>Verified {testResult.model}</span>
            <span aria-hidden="true">·</span>
            <span className="tabular-nums">{testResult.latencyMs}ms</span>
            <span aria-hidden="true">·</span>
            <span className="text-text-primary">&ldquo;{testResult.sampleReply}&rdquo;</span>
          </div>
        )}

        {testError && (
          <BilingualErrorCard
            code={testError.code}
            messageEn={testError.messageEn}
            messageBn={testError.messageBn}
            retryAfterSeconds={testError.retryAfterSeconds}
            onRetry={() => void handleTestConnection()}
          />
        )}
      </section>
    </div>
  );
}
