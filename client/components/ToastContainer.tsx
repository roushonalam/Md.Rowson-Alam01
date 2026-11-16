import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react';
import { useSettings } from '../hooks/useSettings.tsx';

export function ToastContainer() {
  const { toasts, dismissToast } = useSettings();

  if (toasts.length === 0) return null;

  return (
    <div
      aria-live="polite"
      aria-label="Notifications"
      className="fixed bottom-4 right-4 z-50 flex w-full max-w-sm flex-col gap-2.5 px-4 sm:px-0"
    >
      {toasts.map((toast) => {
        const styleMap = {
          success: {
            border: 'border-success-emerald/35 bg-surface',
            icon: <CheckCircle2 className="h-5 w-5 text-success-emerald shrink-0" />,
            badge: 'Success',
          },
          error: {
            border: 'border-error/35 bg-surface',
            icon: <XCircle className="h-5 w-5 text-error shrink-0" />,
            badge: 'Error',
          },
          warning: {
            border: 'border-warning/35 bg-surface',
            icon: <AlertTriangle className="h-5 w-5 text-warning shrink-0" />,
            badge: 'Warning',
          },
          info: {
            border: 'border-brand-indigo/35 bg-surface',
            icon: <Info className="h-5 w-5 text-brand-indigo shrink-0" />,
            badge: 'Notice',
          },
        }[toast.variant];

        return (
          <div
            key={toast.id}
            role="status"
            className={`flex items-start gap-3 rounded-2xl border p-4 shadow-lg ${styleMap.border}`}
          >
            {styleMap.icon}
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-text-primary">{toast.title}</p>
              {toast.description && (
                <p className="mt-0.5 text-xs text-text-secondary leading-relaxed">
                  {toast.description}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={() => dismissToast(toast.id)}
              aria-label="Dismiss notification"
              className="rounded-lg p-1 text-text-muted hover:bg-surface-muted hover:text-text-primary"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
