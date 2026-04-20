import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

export type ToastKind = 'success' | 'error' | 'info';

export type Toast = {
  id: number;
  kind: ToastKind;
  message: string;
  durationMs: number;
};

type ToastContextValue = {
  showToast: (message: string, kind?: ToastKind, durationMs?: number) => void;
  success: (message: string, durationMs?: number) => void;
  error: (message: string, durationMs?: number) => void;
  info: (message: string, durationMs?: number) => void;
  dismiss: (id: number) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

const DEFAULT_DURATIONS: Record<ToastKind, number> = {
  success: 3500,
  info: 4000,
  // Errors stay until the user dismisses — silent auto-hide for an
  // error the user may not have seen would be worse than no toast.
  error: 8000,
};

const KIND_STYLES: Record<ToastKind, { background: string; border: string; icon: React.ReactNode; color: string }> = {
  success: {
    background: '#e6f4ea',
    border: '#007f3b',
    color: '#004d1f',
    icon: <CheckCircle2 size={20} color="#007f3b" aria-hidden="true" />,
  },
  error: {
    background: '#fde8e8',
    border: '#d5281b',
    color: '#7a1811',
    icon: <AlertCircle size={20} color="#d5281b" aria-hidden="true" />,
  },
  info: {
    background: '#eef7ff',
    border: '#005eb8',
    color: '#003a73',
    icon: <Info size={20} color="#005eb8" aria-hidden="true" />,
  },
};

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const idRef = useRef(0);

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback(
    (message: string, kind: ToastKind = 'info', durationMs?: number) => {
      idRef.current += 1;
      const id = idRef.current;
      const duration = durationMs ?? DEFAULT_DURATIONS[kind];
      setToasts((current) => [...current, { id, kind, message, durationMs: duration }]);
    },
    [],
  );

  const value = useMemo<ToastContextValue>(
    () => ({
      showToast,
      dismiss,
      success: (message, durationMs) => showToast(message, 'success', durationMs),
      error: (message, durationMs) => showToast(message, 'error', durationMs),
      info: (message, durationMs) => showToast(message, 'info', durationMs),
    }),
    [showToast, dismiss],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastViewport toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
};

const ToastViewport: React.FC<{ toasts: Toast[]; onDismiss: (id: number) => void }> = ({ toasts, onDismiss }) => {
  if (toasts.length === 0) return null;
  return (
    <div
      aria-live="polite"
      aria-atomic="false"
      className="no-print"
      style={{
        position: 'fixed',
        top: '1rem',
        right: '1rem',
        zIndex: 2000,
        display: 'flex',
        flexDirection: 'column',
        gap: '0.5rem',
        maxWidth: 'min(420px, calc(100vw - 2rem))',
        pointerEvents: 'none',
      }}
    >
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onDismiss={onDismiss} />
      ))}
    </div>
  );
};

const ToastItem: React.FC<{ toast: Toast; onDismiss: (id: number) => void }> = ({ toast, onDismiss }) => {
  const style = KIND_STYLES[toast.kind];

  useEffect(() => {
    if (toast.durationMs <= 0) return;
    const timer = window.setTimeout(() => onDismiss(toast.id), toast.durationMs);
    return () => window.clearTimeout(timer);
  }, [toast.id, toast.durationMs, onDismiss]);

  return (
    <div
      role={toast.kind === 'error' ? 'alert' : 'status'}
      style={{
        background: style.background,
        border: `1px solid ${style.border}`,
        borderLeft: `4px solid ${style.border}`,
        borderRadius: '8px',
        padding: '0.75rem 0.875rem',
        boxShadow: '0 6px 20px rgba(0,0,0,0.15)',
        color: style.color,
        display: 'flex',
        alignItems: 'flex-start',
        gap: '0.625rem',
        pointerEvents: 'auto',
      }}
    >
      <div style={{ flexShrink: 0, marginTop: '0.125rem' }}>{style.icon}</div>
      <div style={{ flex: 1, fontSize: '0.9rem', lineHeight: 1.4, fontWeight: 500 }}>
        {toast.message}
      </div>
      <button
        type="button"
        onClick={() => onDismiss(toast.id)}
        aria-label="Dismiss notification"
        style={{
          background: 'none',
          border: 'none',
          color: style.color,
          padding: '0.125rem',
          cursor: 'pointer',
          display: 'flex',
          flexShrink: 0,
          opacity: 0.7,
        }}
        onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
        onMouseLeave={(e) => (e.currentTarget.style.opacity = '0.7')}
      >
        <X size={16} />
      </button>
    </div>
  );
};

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast must be used inside a <ToastProvider>');
  }
  return ctx;
}
