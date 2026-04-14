'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();
  const [form, setForm] = useState({ username: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Login gagal');
      router.push('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Terjadi kesalahan');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #1c1917 0%, #292524 40%, #3b2f2a 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Decorative background */}
      <div style={{
        position: 'absolute', inset: 0,
        backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 40px, rgba(212,168,67,0.03) 40px, rgba(212,168,67,0.03) 80px)',
      }} />
      
      {/* Decorative circles */}
      <div style={{
        position: 'absolute', top: '-100px', right: '-100px',
        width: '400px', height: '400px', borderRadius: '50%',
        border: '1px solid rgba(212,168,67,0.1)',
      }} />
      <div style={{
        position: 'absolute', bottom: '-150px', left: '-150px',
        width: '500px', height: '500px', borderRadius: '50%',
        border: '1px solid rgba(196,66,35,0.08)',
      }} />

      <div style={{ width: '100%', maxWidth: '420px', position: 'relative', zIndex: 1 }}>
        {/* Logo area */}
        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
          <div style={{
            width: '72px', height: '72px', borderRadius: '20px',
            background: 'linear-gradient(135deg, #b8860b, #d4a843)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 20px',
            boxShadow: '0 8px 24px rgba(184,134,11,0.3)',
          }}>
            <svg width="36" height="36" viewBox="0 0 24 24" fill="white">
              <rect x="2" y="2" width="9" height="9" rx="1" />
              <rect x="13" y="2" width="9" height="9" rx="1" />
              <rect x="2" y="13" width="9" height="9" rx="1" />
              <rect x="13" y="13" width="9" height="9" rx="1" />
            </svg>
          </div>
          <h1 style={{
            fontFamily: 'Cormorant Garamond, Georgia, serif',
            fontSize: '2.2rem', fontWeight: 600,
            color: '#d4a843', letterSpacing: '0.05em',
            lineHeight: 1.1,
          }}>Ciomas Keramik</h1>
          <p style={{ color: '#78716c', fontSize: '0.8rem', letterSpacing: '0.15em', textTransform: 'uppercase', marginTop: '6px' }}>
            Sistem Manajemen Toko
          </p>
        </div>

        {/* Login form */}
        <div style={{
          background: 'rgba(255,255,255,0.95)',
          borderRadius: '20px',
          padding: '36px',
          boxShadow: '0 24px 48px rgba(0,0,0,0.3)',
          border: '1px solid rgba(212,168,67,0.2)',
        }}>
          <h2 style={{
            fontFamily: 'Cormorant Garamond, serif',
            fontSize: '1.6rem', fontWeight: 600,
            color: '#1c1917', marginBottom: '24px',
          }}>Masuk ke Sistem</h2>

          {error && (
            <div style={{
              background: '#fef2f2', border: '1px solid #fecaca',
              borderRadius: '8px', padding: '12px 16px',
              color: '#dc2626', fontSize: '0.85rem', marginBottom: '20px',
            }}>{error}</div>
          )}

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
            <div>
              <label className="form-label" style={{ display: 'block', marginBottom: '6px' }}>
                Username
              </label>
              <input
                className="form-input"
                type="text"
                placeholder="Masukkan username"
                value={form.username}
                onChange={e => setForm(p => ({ ...p, username: e.target.value }))}
                required
              />
            </div>

            <div>
              <label className="form-label" style={{ display: 'block', marginBottom: '6px' }}>
                Password
              </label>
              <input
                className="form-input"
                type="password"
                placeholder="Masukkan password"
                value={form.password}
                onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              style={{
                marginTop: '8px',
                background: loading ? '#d6d3d1' : 'linear-gradient(135deg, #1c1917 0%, #292524 100%)',
                color: loading ? '#a8a29e' : '#d4a843',
                border: 'none',
                borderRadius: '10px',
                padding: '14px',
                fontSize: '0.85rem',
                fontWeight: 500,
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                cursor: loading ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                transition: 'all 0.2s',
              }}
            >
              {loading ? (
                <><div className="loading-spinner" style={{ width: '16px', height: '16px' }} /> Memproses...</>
              ) : 'Masuk'}
            </button>
          </form>

          <p style={{ textAlign: 'center', marginTop: '20px', fontSize: '0.75rem', color: '#a8a29e' }}>
            Default: admin / Admin@123
          </p>
        </div>

        <p style={{ textAlign: 'center', marginTop: '24px', fontSize: '0.75rem', color: '#57534e' }}>
          © 2024 Ciomas Keramik. All rights reserved.
        </p>
      </div>
    </div>
  );
}
