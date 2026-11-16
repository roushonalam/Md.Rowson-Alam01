import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  CheckCircle2,
  Lock,
  RefreshCw,
  Save,
  Sliders,
  XCircle,
  Zap,
} from 'lucide-react';
import { BilingualErrorCard } from '../components/BilingualErrorCard.tsx';
import { useSettings } from '../hooks/useSettings.tsx';
import { ClientApiError, testApiConnection } from '../lib/api.ts';
import type { TestConnectionResponse } from '../types/index.ts';

export function SettingsPage() {
  const {
    settings,
    health,
    connectionState,
    models,
    modelsLoading,
    defaultModel,
    updateDraftSettings,
    saveSettings,
    refreshHealthAndModels,
    addToast,
  } = useSettings();

  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<TestConnectionResponse | null>(null);
  const [testError, setTestError] = useState<{
    code?: string;
    messageEn: string;
    messageBn: string;
    retryAfterSeconds?: number;
  } | null>(null);

  async function handleTestConnection() {
    setTesting(true);
    setTestError(null);
    setTestResult(null);

    try {
      const res = await testApiConnection(settings.model || undefined);
      setTestResult(res);
      addToast({
        variant: 'success',
        title: 'API Connection Verified',
        description: `${res.model} responded in ${res.latencyMs}ms.`,
      });
      await refreshHealthAndModels();
    } catch (err) {
      if (err instanceof ClientApiError) {
        setTestError({
          code: err.code,
          messageEn: err.messageEn,
          messageBn: err.messageBn,
          retryAfterSeconds: err.retryAfterSeconds,
        });
        addToast({
          variant: 'error',
          title: 'Connection test failed',
          description: err.messageEn,
        });
      } else {
        setTestError({
          messageEn: 'Failed to test Gemini API connection.',
          messageBn: 'Gemini API সংযোগ পরীক্ষা করা যায়নি।',
        });
      }
    } finally {
      setTesting(false);
    }
  }

  const statusConfig = {
    connected: {
      icon: CheckCircle2,
      label: 'Connected',
      classes: 'border-success-emerald/35 bg-success-soft text-success-emerald',
      detail: health?.hasAdminKey
        ? 'Active via server-side Admin runtime configuration.'
        : 'Server GEMINI_API_KEY is configured and ready.',
    },
    not_configured: {
      icon: AlertTriangle,
      label: 'Not configured',
      classes: 'border-warning/35 bg-warning-soft text-warning',
      detail:
        'No active Gemini API key detected on the server. Administrators can configure it in the Admin Portal or platform secrets.',
    },
    error: {
      icon: XCircle,
      label: 'Error',
      classes: 'border-error/35 bg-error-soft text-error',
      detail: 'Unable to verify backend health status.',
    },
  }[connectionState];

  const StatusIcon = statusConfig.icon;

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8 space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight text-primary-dark sm:text-3xl">
          AI Settings &amp; Connection
        </h1>
        <p className="mt-1.5 text-sm text-text-secondary sm:text-base">
          Inspect live backend connectivity, select an available Gemini model, and tune response
          creativity.
        </p>
      </div>

      {/* Live Connection Status Card */}
      <section className="rounded-2xl border border-border-subtle bg-surface p-6 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1.5">
            <h2 className="font-display text-base font-bold text-primary-dark">
              Backend Connection Status
            </h2>
            <p className="text-sm text-text-secondary">{statusConfig.detail}</p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <div
              className={`inline-flex items-center gap-2 rounded-xl border px-3.5 py-2 text-xs font-semibold ${statusConfig.classes}`}
            >
              <StatusIcon className="h-4 w-4 shrink-0" />
              <span>{statusConfig.label}</span>
            </div>

            <button
              type="button"
              onClick={() => void refreshHealthAndModels()}
              aria-label="Refresh connection health"
              className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-border-strong bg-surface text-text-secondary hover:bg-surface-muted hover:text-primary-dark"
            >
              <RefreshCw className={`h-4 w-4 ${modelsLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-border-subtle pt-5">
          <button
            type="button"
            disabled={testing}
            onClick={() => void handleTestConnection()}
            className="inline-flex min-h-[42px] items-center gap-2 rounded-xl bg-primary-dark px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-indigo disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Zap className="h-4 w-4" />
            {testing ? 'Testing Connection...' : 'Test API Connection'}
          </button>

          {testResult && (
            <div className="flex flex-wrap items-center gap-2 text-xs text-success-emerald font-medium">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              <span>Verified {testResult.model}</span>
              <span aria-hidden="true">·</span>
              <span className="tabular-nums">{testResult.latencyMs}ms</span>
              <span aria-hidden="true">·</span>
              <span className="text-text-secondary truncate max-w-xs">
                &ldquo;{testResult.sampleReply}&rdquo;
              </span>
            </div>
          )}
        </div>

        {testError && (
          <div className="mt-4">
            <BilingualErrorCard
              code={testError.code}
              messageEn={testError.messageEn}
              messageBn={testError.messageBn}
              retryAfterSeconds={testError.retryAfterSeconds}
              onRetry={() => void handleTestConnection()}
            />
          </div>
        )}
      </section>

      {/* Model & Temperature Preferences */}
      <section className="rounded-2xl border border-border-subtle bg-surface p-6 shadow-sm space-y-6">
        <div className="flex items-center gap-2">
          <Sliders className="h-5 w-5 text-brand-indigo" />
          <h2 className="font-display text-base font-bold text-primary-dark">
            Model &amp; Generation Preferences
          </h2>
        </div>

        <div>
          <label
            htmlFor="settings-model"
            className="block text-xs font-semibold text-text-secondary"
          >
            Active Gemini Model
          </label>
          <select
            id="settings-model"
            value={settings.model || defaultModel}
            disabled={modelsLoading || models.length === 0}
            onChange={(e) => updateDraftSettings({ model: e.target.value })}
            className="mt-1.5 w-full min-h-[44px] rounded-xl border border-border-strong bg-surface px-3 text-sm text-text-primary focus:border-brand-indigo focus:outline-none disabled:bg-surface-muted disabled:text-text-muted"
          >
            {models.length === 0 ? (
              <option value={defaultModel || ''}>
                {modelsLoading
                  ? 'Loading live models...'
                  : defaultModel
                    ? `${defaultModel} (connect API key to fetch full live list)`
                    : 'No models loaded'}
              </option>
            ) : (
              models.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.displayName} ({m.id}){m.isDefault ? ' — Default' : ''}
                </option>
              ))
            )}
          </select>
          <p className="mt-1.5 text-xs text-text-muted">
            Populated directly from the Gemini SDK model-list endpoint filtered to models
            supporting <code className="font-mono">generateContent</code>.
          </p>
        </div>

        <div>
          <div className="flex items-center justify-between">
            <label
              htmlFor="settings-temperature"
              className="block text-xs font-semibold text-text-secondary"
            >
              Response Temperature
            </label>
            <span className="font-mono text-sm font-semibold text-primary-dark tabular-nums">
              {settings.temperature.toFixed(2)}
            </span>
          </div>
          <input
            id="settings-temperature"
            type="range"
            min={0.2}
            max={0.7}
            step={0.05}
            value={settings.temperature}
            onChange={(e) =>
              updateDraftSettings({ temperature: Number(e.target.value) })
            }
            className="mt-2 w-full accent-brand-indigo"
          />
          <div className="mt-1 flex justify-between text-xs text-text-muted tabular-nums">
            <span>0.20 · Focused &amp; factual</span>
            <span>0.40 · Balanced default</span>
            <span>0.70 · More creative analogies</span>
          </div>
          <p className="mt-2 text-xs text-text-secondary leading-relaxed">
            Lower temperatures (0.2–0.4) keep definitions, math derivations, and quiz facts
            strictly grounded. Higher values (0.5–0.7) encourage varied real-world analogies.
          </p>
        </div>

        <div className="flex items-center justify-between border-t border-border-subtle pt-5">
          <p className="text-xs text-text-muted">
            Saved locally in browser preferences (non-secret settings only).
          </p>
          <button
            type="button"
            onClick={() => saveSettings()}
            className="inline-flex min-h-[42px] items-center gap-2 rounded-xl bg-brand-indigo px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary-dark"
          >
            <Save className="h-4 w-4" />
            Save Settings
          </button>
        </div>
      </section>

      {/* Admin Portal Access */}
      <section className="rounded-2xl border border-border-subtle bg-surface p-6 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Lock className="h-4 w-4 text-brand-indigo" />
              <h2 className="font-display text-base font-bold text-primary-dark">
                Administrator Key &amp; Runtime Console
              </h2>
            </div>
            <p className="text-sm text-text-secondary">
              Server API key management and live runtime diagnostics are available to authorized
              administrators.
            </p>
          </div>

          <Link
            to="/admin"
            className="inline-flex min-h-[42px] items-center justify-center gap-2 rounded-xl border border-border-strong bg-canvas px-4 py-2 text-sm font-semibold text-primary-dark hover:bg-surface-muted whitespace-nowrap shrink-0"
          >
            Open Admin Portal
          </Link>
        </div>
      </section>
    </div>
  );
}
