import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, KeyRound, RotateCcw } from 'lucide-react';

interface BilingualErrorCardProps {
  code?: string;
  messageEn: string;
  messageBn: string;
  retryAfterSeconds?: number;
  onRetry?: () => void;
}

export function BilingualErrorCard({
  code,
  messageEn,
  messageBn,
  retryAfterSeconds,
  onRetry,
}: BilingualErrorCardProps) {
  const [countdown, setCountdown] = useState<number>(retryAfterSeconds ?? 0);

  useEffect(() => {
    setCountdown(retryAfterSeconds ?? 0);
  }, [retryAfterSeconds]);

  useEffect(() => {
    if (countdown <= 0) return;
    const timer = window.setInterval(() => {
      setCountdown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [countdown]);

  const isMissingKey = code === 'MISSING_API_KEY' || code === 'INVALID_API_KEY';

  return (
    <div
      role="alert"
      className="rounded-2xl border border-error/30 bg-error-soft p-5 text-text-primary"
    >
      <div className="flex items-start gap-3.5">
        <AlertCircle className="mt-0.5 h-5 w-5 text-error shrink-0" />
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-error">
            <span>Unable to complete request</span>
            {code && (
              <>
                <span aria-hidden="true">·</span>
                <span className="font-mono">{code}</span>
              </>
            )}
          </div>
          <p className="text-sm font-medium text-text-primary leading-relaxed">{messageEn}</p>
          <p className="font-bengali text-sm text-text-secondary leading-relaxed">
            {messageBn}
          </p>

          <div className="flex flex-wrap items-center gap-3 pt-1">
            {onRetry && (
              <button
                type="button"
                onClick={onRetry}
                disabled={countdown > 0}
                className="inline-flex min-h-[40px] items-center gap-2 rounded-xl bg-error px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-error/90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                {countdown > 0 ? `Retry in ${countdown}s` : 'Retry'}
              </button>
            )}

            {isMissingKey && (
              <Link
                to="/settings"
                className="inline-flex min-h-[40px] items-center gap-2 rounded-xl border border-border-strong bg-surface px-4 py-2 text-xs font-semibold text-primary-dark hover:bg-surface-muted"
              >
                <KeyRound className="h-3.5 w-3.5" />
                Open Settings
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
