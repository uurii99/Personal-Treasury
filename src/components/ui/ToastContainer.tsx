import { CheckCircle, XCircle, Info, AlertTriangle, X } from 'lucide-react';
import { useToast } from '@/contexts/ToastContext';
import type { ToastType } from '@/types';

const icons: Record<ToastType, React.ReactNode> = {
  success: <CheckCircle className="h-5 w-5 text-success-500" />,
  error: <XCircle className="h-5 w-5 text-danger-500" />,
  info: <Info className="h-5 w-5 text-brand-500" />,
  warning: <AlertTriangle className="h-5 w-5 text-warning-500" />,
};

const borderColors: Record<ToastType, string> = {
  success: 'border-l-success-500',
  error: 'border-l-danger-500',
  info: 'border-l-brand-500',
  warning: 'border-l-warning-500',
};

export function ToastContainer() {
  const { toasts, removeToast } = useToast();

  if (toasts.length === 0) return null;

  return (
    <div
      className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 max-w-sm w-full"
      aria-live="polite"
      aria-label="Notificaciones"
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`
            flex items-start gap-3 p-4
            bg-white dark:bg-surface-900
            border border-surface-200 dark:border-surface-800
            border-l-4 ${borderColors[toast.type]}
            rounded-lg shadow-dropdown
            animate-[slide-up_300ms_cubic-bezier(0.16,1,0.3,1)]
          `}
          role="alert"
        >
          <div className="shrink-0 mt-0.5">{icons[toast.type]}</div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-surface-900 dark:text-surface-100">
              {toast.title}
            </p>
            {toast.description && (
              <p className="text-xs text-surface-500 mt-0.5">{toast.description}</p>
            )}
          </div>
          <button
            onClick={() => removeToast(toast.id)}
            className="shrink-0 p-1 rounded text-surface-400 hover:text-surface-600 dark:hover:text-surface-300 transition-colors"
            aria-label="Cerrar notificación"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}
