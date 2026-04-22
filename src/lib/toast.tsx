'use client';
import { createContext, useContext, useState, useCallback, useEffect, useRef, ReactNode } from 'react';
import { createPortal } from 'react-dom';

type ToastType = 'success' | 'error' | 'warning' | 'info';

interface ToastItem {
  id    : string;
  type  : ToastType;
  title : string;
  message?: string;
  duration: number;
}

interface ConfirmOptions {
  title      : string;
  message    : string;
  confirmText?: string;
  cancelText ?: string;
  danger     ?: boolean;
}

interface ToastContextValue {
  success : (title: string, message?: string) => void;
  error   : (title: string, message?: string) => void;
  warning : (title: string, message?: string) => void;
  info    : (title: string, message?: string) => void;
  confirm : (options: ConfirmOptions) => Promise<boolean>;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast harus digunakan di dalam <ToastProvider>');
  return ctx;
}

let _singleton: ToastContextValue | null = null;
export function setToastSingleton(ctx: ToastContextValue) { _singleton = ctx; }
export const toast = {
  success : (title: string, message?: string) => _singleton?.success(title, message),
  error   : (title: string, message?: string) => _singleton?.error(title, message),
  warning : (title: string, message?: string) => _singleton?.warning(title, message),
  info    : (title: string, message?: string) => _singleton?.info(title, message),
  confirm : (options: ConfirmOptions) => _singleton?.confirm(options) ?? Promise.resolve(false),
};

const THEME: Record<ToastType, { bg: string; border: string; icon: string; iconBg: string; progress: string }> = {
  success: { bg: '#f0fdf4', border: '#bbf7d0', icon: '✓', iconBg: '#16a34a', progress: '#16a34a' },
  error  : { bg: '#fef2f2', border: '#fecaca', icon: '✕', iconBg: '#dc2626', progress: '#dc2626' },
  warning: { bg: '#fffbeb', border: '#fde68a', icon: '!', iconBg: '#d97706', progress: '#d97706' },
  info   : { bg: '#eff6ff', border: '#bfdbfe', icon: 'i', iconBg: '#2563eb', progress: '#2563eb' },
};

function ToastCard({ item, onRemove }: { item: ToastItem; onRemove: (id: string) => void }) {
  const [visible, setVisible] = useState(false);
  const [progress, setProgress] = useState(100);
  const t = THEME[item.type];

  useEffect(() => {
    // Animate in
    requestAnimationFrame(() => setVisible(true));

    // Progress bar
    const start = Date.now();
    const interval = setInterval(() => {
      const elapsed = Date.now() - start;
      const remaining = Math.max(0, 100 - (elapsed / item.duration) * 100);
      setProgress(remaining);
      if (remaining === 0) clearInterval(interval);
    }, 16);

    // Auto remove
    const timer = setTimeout(() => {
      setVisible(false);
      setTimeout(() => onRemove(item.id), 300);
    }, item.duration);

    return () => { clearTimeout(timer); clearInterval(interval); };
  }, [item.duration, item.id, onRemove]);

  return (
    <div style={{
      background    : t.bg,
      border        : `1px solid ${t.border}`,
      borderRadius  : '12px',
      padding       : '14px 16px',
      minWidth      : '300px',
      maxWidth      : '400px',
      boxShadow     : '0 8px 24px rgba(0,0,0,0.12)',
      transform     : visible ? 'translateX(0) scale(1)' : 'translateX(100%) scale(0.95)',
      opacity       : visible ? 1 : 0,
      transition    : 'all 0.3s cubic-bezier(0.34,1.56,0.64,1)',
      position      : 'relative',
      overflow      : 'hidden',
      cursor        : 'pointer',
    }} onClick={() => { setVisible(false); setTimeout(() => onRemove(item.id), 300); }}>

      {/* Content */}
      <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
        <div style={{
          width: '28px', height: '28px', borderRadius: '50%',
          background: t.iconBg, color: 'white',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '0.85rem', fontWeight: 700, flexShrink: 0,
        }}>
          {t.icon}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '0.875rem', fontWeight: 600, color: '#1c1917' }}>{item.title}</div>
          {item.message && (
            <div style={{ fontSize: '0.78rem', color: '#78716c', marginTop: '2px', lineHeight: 1.4 }}>{item.message}</div>
          )}
        </div>
        <div style={{ fontSize: '1rem', color: '#a8a29e', lineHeight: 1, marginTop: '2px' }}>×</div>
      </div>

      {/* Progress bar */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0,
        height: '3px', background: t.progress, opacity: 0.4,
        width: `${progress}%`, transition: 'width 0.016s linear', borderRadius: '0 0 0 12px',
      }} />
    </div>
  );
}

// ─── Confirm Dialog ───────────────────────────────────────────────────────────
function ConfirmDialog({
  options,
  onResult,
}: {
  options : ConfirmOptions;
  onResult: (result: boolean) => void;
}) {
  const [visible, setVisible] = useState(false);

  useEffect(() => { requestAnimationFrame(() => setVisible(true)); }, []);

  function resolve(result: boolean) {
    setVisible(false);
    setTimeout(() => onResult(result), 200);
  }

  return (
    <div style={{
      position  : 'fixed', inset: 0,
      background: `rgba(0,0,0,${visible ? 0.45 : 0})`,
      backdropFilter: visible ? 'blur(4px)' : 'blur(0px)',
      transition: 'all 0.2s',
      zIndex    : 9999,
      display   : 'flex', alignItems: 'center', justifyContent: 'center',
      padding   : '20px',
    }} onClick={() => resolve(false)}>
      <div style={{
        background   : 'white',
        borderRadius : '18px',
        padding      : '32px',
        maxWidth     : '420px',
        width        : '100%',
        boxShadow    : '0 24px 64px rgba(0,0,0,0.2)',
        transform    : visible ? 'scale(1) translateY(0)' : 'scale(0.9) translateY(20px)',
        opacity      : visible ? 1 : 0,
        transition   : 'all 0.25s cubic-bezier(0.34,1.56,0.64,1)',
      }} onClick={e => e.stopPropagation()}>

        {/* Icon */}
        <div style={{
          width: '56px', height: '56px', borderRadius: '50%',
          background: options.danger ? '#fee2e2' : '#fef9c3',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '1.5rem', margin: '0 auto 20px',
        }}>
          {options.danger ? '🗑️' : '❓'}
        </div>

        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <div style={{ fontSize: '1.2rem', fontWeight: 700, color: '#1c1917', marginBottom: '8px', fontFamily: 'Cormorant Garamond, serif' }}>
            {options.title}
          </div>
          <div style={{ fontSize: '0.875rem', color: '#78716c', lineHeight: 1.5 }}>
            {options.message}
          </div>
        </div>

        <div style={{ display: 'flex', gap: '12px' }}>
          <button onClick={() => resolve(false)} style={{
            flex: 1, padding: '12px', borderRadius: '10px',
            border: '1.5px solid #e7e5e4', background: 'white',
            fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer',
            color: '#57534e', transition: 'all 0.15s',
          }}>
            {options.cancelText ?? 'Batal'}
          </button>
          <button onClick={() => resolve(true)} style={{
            flex: 1, padding: '12px', borderRadius: '10px',
            border: 'none',
            background: options.danger
              ? 'linear-gradient(135deg,#dc2626,#b91c1c)'
              : 'linear-gradient(135deg,#1c1917,#292524)',
            color  : options.danger ? 'white' : '#d4a843',
            fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer',
            boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
            transition: 'all 0.15s',
          }}>
            {options.confirmText ?? 'Ya, Lanjutkan'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Provider ─────────────────────────────────────────────────────────────────
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts,  setToasts]  = useState<ToastItem[]>([]);
  const [confirm, setConfirm] = useState<{ options: ConfirmOptions; resolve: (r: boolean) => void } | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  const addToast = useCallback((type: ToastType, title: string, message?: string) => {
    const id = Math.random().toString(36).slice(2);
    setToasts(prev => [...prev.slice(-4), { id, type, title, message: message || '', duration: type === 'error' ? 6000 : 4000 }]);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const showConfirm = useCallback((options: ConfirmOptions): Promise<boolean> => {
    return new Promise(resolve => {
      setConfirm({ options, resolve: (result: boolean) => { setConfirm(null); resolve(result); } });
    });
  }, []);

  const ctx: ToastContextValue = {
    success : (t, m) => addToast('success', t, m),
    error   : (t, m) => addToast('error', t, m),
    warning : (t, m) => addToast('warning', t, m),
    info    : (t, m) => addToast('info', t, m),
    confirm : showConfirm,
  };

  // Register singleton
  const ctxRef = useRef(ctx);
  ctxRef.current = ctx;
  useEffect(() => { setToastSingleton(ctx); }, []); // eslint-disable-line

  return (
    <ToastContext.Provider value={ctx}>
      {children}
      {mounted && createPortal(
        <>
          {/* Toast stack */}
          <div style={{
            position  : 'fixed', bottom: '24px', right: '24px',
            zIndex    : 9998,
            display   : 'flex', flexDirection: 'column-reverse', gap: '10px',
            pointerEvents: 'none',
          }}>
            {toasts.map(item => (
              <div key={item.id} style={{ pointerEvents: 'auto' }}>
                <ToastCard item={item} onRemove={removeToast} />
              </div>
            ))}
          </div>

          {/* Confirm dialog */}
          {confirm && (
            <ConfirmDialog options={confirm.options} onResult={confirm.resolve} />
          )}
        </>,
        document.body
      )}
    </ToastContext.Provider>
  );
}
