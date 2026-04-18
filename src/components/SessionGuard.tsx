'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';

// 3 jam dalam milidetik
const TIMEOUT_MS    = 3 * 60 * 60 * 1000;
// Peringatan 5 menit sebelum timeout
const WARNING_MS    = 5 * 60 * 1000;
// Refresh cookie setiap 30 menit aktivitas
const REFRESH_MS    = 30 * 60 * 1000;

const EVENTS = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart', 'click'];

export default function SessionGuard() {
  const router   = useRouter();
  const pathname = usePathname();

  const [showWarning, setShowWarning]   = useState(false);
  const [showExpired, setShowExpired]   = useState(false);
  const [countdown,   setCountdown]     = useState(300); // seconds

  const timeoutRef  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const warningRef  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const refreshRef  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownRef= useRef<ReturnType<typeof setInterval> | null>(null);
  const lastActivity= useRef<number>(Date.now());

  // ── Refresh cookie ───────────────────────────
  const refreshSession = useCallback(async () => {
    try {
      await fetch('/api/auth/refresh', { method: 'POST' });
    } catch { /* ignore */ }
  }, []);

  // ── Countdown timer ──────────────────────────
  const startCountdown = useCallback(() => {
    setCountdown(Math.floor(WARNING_MS / 1000));
    countdownRef.current = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(countdownRef.current!);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  // ── Perform logout ───────────────────────────
  const doLogout = useCallback(async () => {
    clearTimeout(timeoutRef.current!);
    clearTimeout(warningRef.current!);
    clearTimeout(refreshRef.current!);
    clearInterval(countdownRef.current!);
    setShowWarning(false);
    setShowExpired(true);

    await fetch('/api/auth/logout', { method: 'POST' });

    // Redirect after 3s so user can read the message
    setTimeout(() => {
      router.push('/login?reason=timeout');
    }, 3000);
  }, [router]);

  // ── Reset timers on activity ─────────────────
  const resetTimers = useCallback(() => {
    lastActivity.current = Date.now();

    clearTimeout(timeoutRef.current!);
    clearTimeout(warningRef.current!);
    clearInterval(countdownRef.current!);
    setShowWarning(false);

    // Warning: 5 min before timeout
    warningRef.current = setTimeout(() => {
      setShowWarning(true);
      startCountdown();
    }, TIMEOUT_MS - WARNING_MS);

    // Hard logout
    timeoutRef.current = setTimeout(() => {
      doLogout();
    }, TIMEOUT_MS);
  }, [doLogout, startCountdown]);

  // ── Periodic session refresh ─────────────────
  const scheduleRefresh = useCallback(() => {
    clearTimeout(refreshRef.current!);
    refreshRef.current = setTimeout(async () => {
      await refreshSession();
      scheduleRefresh();
    }, REFRESH_MS);
  }, [refreshSession]);

  // ── Bootstrap ────────────────────────────────
  useEffect(() => {
    resetTimers();
    scheduleRefresh();

    const handler = () => resetTimers();
    EVENTS.forEach(e => window.addEventListener(e, handler, { passive: true }));

    return () => {
      EVENTS.forEach(e => window.removeEventListener(e, handler));
      clearTimeout(timeoutRef.current!);
      clearTimeout(warningRef.current!);
      clearTimeout(refreshRef.current!);
      clearInterval(countdownRef.current!);
    };
  }, [pathname, resetTimers, scheduleRefresh]);

  const fmt = (s: number) => `${Math.floor(s / 60).toString().padStart(2,'0')}:${(s % 60).toString().padStart(2,'0')}`;

  return (
    <>
      {/* ── Peringatan: sesi hampir habis ── */}
      {showWarning && (
        <div style={{
          position: 'fixed', bottom: '24px', right: '24px', zIndex: 9999,
          background: 'white', border: '1px solid #fcd34d',
          borderLeft: '4px solid #d97706', borderRadius: '12px',
          padding: '16px 20px', maxWidth: '320px',
          boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
          animation: 'slideInRight 0.3s ease',
        }}>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
            <div style={{ fontSize: '1.4rem', lineHeight: 1, flexShrink: 0 }}>⚠️</div>
            <div>
              <div style={{ fontWeight: 600, fontSize: '0.85rem', color: '#92400e', marginBottom: '4px' }}>
                Sesi Hampir Berakhir
              </div>
              <div style={{ fontSize: '0.78rem', color: '#78716c', lineHeight: 1.5 }}>
                Tidak ada aktivitas terdeteksi. Sesi akan berakhir dalam:
              </div>
              <div style={{
                fontFamily: 'monospace', fontSize: '1.5rem', fontWeight: 700,
                color: countdown < 60 ? '#dc2626' : '#d97706',
                margin: '8px 0', letterSpacing: '0.05em',
              }}>
                {fmt(countdown)}
              </div>
              <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                <button
                  onClick={() => { resetTimers(); refreshSession(); }}
                  style={{
                    background: 'linear-gradient(135deg,#1c1917,#292524)',
                    color: '#d4a843', border: 'none', borderRadius: '7px',
                    padding: '7px 14px', fontSize: '0.75rem', fontWeight: 600,
                    letterSpacing: '0.05em', textTransform: 'uppercase',
                    cursor: 'pointer',
                  }}
                >
                  Tetap Aktif
                </button>
                <button
                  onClick={doLogout}
                  style={{
                    background: 'transparent', color: '#78716c',
                    border: '1px solid #e7e5e4', borderRadius: '7px',
                    padding: '7px 14px', fontSize: '0.75rem',
                    cursor: 'pointer',
                  }}
                >
                  Keluar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Sesi sudah berakhir ── */}
      {showExpired && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 99999,
          background: 'rgba(28,23,20,0.85)', backdropFilter: 'blur(8px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '24px',
        }}>
          <div style={{
            background: 'white', borderRadius: '20px', padding: '40px 48px',
            maxWidth: '420px', width: '100%', textAlign: 'center',
            boxShadow: '0 24px 64px rgba(0,0,0,0.4)',
            animation: 'fadeInScale 0.4s ease',
          }}>
            <div style={{
              width: '64px', height: '64px', borderRadius: '50%',
              background: 'linear-gradient(135deg,#fef3c7,#fde68a)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '1.8rem', margin: '0 auto 20px',
            }}>
              🔒
            </div>
            <h2 style={{
              fontFamily: 'Cormorant Garamond, Georgia, serif',
              fontSize: '1.8rem', fontWeight: 600, color: '#1c1917',
              marginBottom: '12px',
            }}>
              Sesi Berakhir
            </h2>
            <p style={{ color: '#78716c', fontSize: '0.9rem', lineHeight: 1.6, marginBottom: '8px' }}>
              Tidak ada aktivitas selama <strong>3 jam</strong>.
            </p>
            <p style={{ color: '#a8a29e', fontSize: '0.85rem', marginBottom: '24px' }}>
              Anda akan diarahkan ke halaman login...
            </p>
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
              color: '#b8860b', fontSize: '0.8rem',
            }}>
              <div style={{
                width: '16px', height: '16px', border: '2px solid #d4a843',
                borderTopColor: 'transparent', borderRadius: '50%',
                animation: 'spin 0.8s linear infinite',
              }} />
              Mengalihkan ke halaman login...
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes slideInRight {
          from { transform: translateX(110%); opacity: 0; }
          to   { transform: translateX(0);    opacity: 1; }
        }
        @keyframes fadeInScale {
          from { transform: scale(0.92); opacity: 0; }
          to   { transform: scale(1);    opacity: 1; }
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </>
  );
}
