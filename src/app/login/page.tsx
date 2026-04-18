'use client';
import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [form, setForm]       = useState({ username: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');
  const [timeoutMsg, setTimeoutMsg] = useState(false);

  useEffect(() => {
    if (searchParams.get('reason') === 'timeout') {
      setTimeoutMsg(true);
    }
  }, [searchParams]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      const res  = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Login gagal');
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
      background: 'linear-gradient(135deg,#1a1714 0%,#231f1c 45%,#2e2520 100%)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '20px', position: 'relative', overflow: 'hidden',
    }}>
      {/* Decorative tile grid */}
      <div style={{
        position: 'absolute', inset: 0, opacity: 0.04,
        backgroundImage:
          'linear-gradient(rgba(212,168,67,1) 1px,transparent 1px),' +
          'linear-gradient(90deg,rgba(212,168,67,1) 1px,transparent 1px)',
        backgroundSize: '60px 60px',
      }} />
      {/* Glow blobs */}
      <div style={{ position:'absolute', top:'-120px', right:'-120px', width:'400px', height:'400px', borderRadius:'50%', background:'radial-gradient(circle,rgba(184,134,11,0.08) 0%,transparent 70%)' }} />
      <div style={{ position:'absolute', bottom:'-150px', left:'-150px',  width:'500px', height:'500px', borderRadius:'50%', background:'radial-gradient(circle,rgba(196,66,35,0.06) 0%,transparent 70%)' }} />

      <div style={{ width:'100%', maxWidth:'400px', position:'relative', zIndex:1 }}>

        {/* Logo */}
        <div style={{ textAlign:'center', marginBottom:'36px' }}>
          <div style={{ width:'68px', height:'68px', borderRadius:'18px', background:'linear-gradient(135deg,#b8860b,#e0b84a)', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 18px', boxShadow:'0 8px 24px rgba(184,134,11,0.35)' }}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="white">
              <rect x="2" y="2" width="9" height="9" rx="1.5"/>
              <rect x="13" y="2" width="9" height="9" rx="1.5"/>
              <rect x="2" y="13" width="9" height="9" rx="1.5"/>
              <rect x="13" y="13" width="9" height="9" rx="1.5"/>
            </svg>
          </div>
          <h1 style={{ fontFamily:'Cormorant Garamond,Georgia,serif', fontSize:'2.1rem', fontWeight:600, color:'#d4a843', letterSpacing:'0.04em', lineHeight:1.1 }}>
            Ciomas Keramik
          </h1>
          <p style={{ color:'#4a4540', fontSize:'0.72rem', letterSpacing:'0.16em', textTransform:'uppercase', marginTop:'6px' }}>
            Sistem Manajemen Toko
          </p>
        </div>

        {/* Session timeout notice */}
        {timeoutMsg && (
          <div style={{
            background:'rgba(251,191,36,0.08)', border:'1px solid rgba(251,191,36,0.25)',
            borderRadius:'10px', padding:'14px 16px', marginBottom:'18px',
            display:'flex', gap:'10px', alignItems:'flex-start',
          }}>
            <span style={{ fontSize:'1.1rem', flexShrink:0 }}>🔒</span>
            <div>
              <div style={{ color:'#d97706', fontSize:'0.82rem', fontWeight:600, marginBottom:'2px' }}>
                Sesi Telah Berakhir
              </div>
              <div style={{ color:'#6b6460', fontSize:'0.78rem', lineHeight:1.5 }}>
                Tidak ada aktivitas selama 3 jam. Silakan login kembali untuk melanjutkan.
              </div>
            </div>
          </div>
        )}

        {/* Card */}
        <div style={{
          background:'rgba(255,255,255,0.97)', borderRadius:'18px',
          padding:'32px 36px', boxShadow:'0 24px 56px rgba(0,0,0,0.3)',
          border:'1px solid rgba(212,168,67,0.15)',
        }}>
          <h2 style={{ fontFamily:'Cormorant Garamond,serif', fontSize:'1.5rem', fontWeight:600, color:'#1c1917', marginBottom:'24px' }}>
            Masuk ke Sistem
          </h2>

          {error && (
            <div style={{ background:'#fef2f2', border:'1px solid #fecaca', borderRadius:'8px', padding:'11px 14px', color:'#dc2626', fontSize:'0.82rem', marginBottom:'18px', display:'flex', gap:'8px', alignItems:'center' }}>
              <span>⚠</span> {error}
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display:'flex', flexDirection:'column', gap:'16px' }}>
            <div className="form-group">
              <label className="form-label">Username</label>
              <input className="form-input" type="text" placeholder="Masukkan username"
                value={form.username} onChange={e => setForm(p => ({ ...p, username: e.target.value }))} required autoFocus />
            </div>
            <div className="form-group">
              <label className="form-label">Password</label>
              <input className="form-input" type="password" placeholder="Masukkan password"
                value={form.password} onChange={e => setForm(p => ({ ...p, password: e.target.value }))} required />
            </div>

            <button type="submit" disabled={loading} style={{
              marginTop:'8px',
              background: loading ? '#d6d3d1' : 'linear-gradient(135deg,#1c1917 0%,#2e2926 100%)',
              color: loading ? '#a8a29e' : '#d4a843',
              border:'none', borderRadius:'10px', padding:'13px',
              fontSize:'0.8rem', fontWeight:600, letterSpacing:'0.1em',
              textTransform:'uppercase', cursor: loading ? 'not-allowed' : 'pointer',
              display:'flex', alignItems:'center', justifyContent:'center', gap:'8px',
              transition:'all 0.2s', boxShadow: loading ? 'none' : '0 4px 12px rgba(0,0,0,0.25)',
            }}>
              {loading
                ? <><div style={{ width:'15px', height:'15px', border:'2px solid #a8a29e', borderTopColor:'transparent', borderRadius:'50%', animation:'spin 0.7s linear infinite' }} /> Memproses...</>
                : '→ Masuk'}
            </button>
          </form>

          <p style={{ textAlign:'center', marginTop:'18px', fontSize:'0.72rem', color:'#c0bab4' }}>
            Default login: <strong>admin</strong> / <strong>password</strong>
          </p>
        </div>

        <p style={{ textAlign:'center', marginTop:'20px', fontSize:'0.7rem', color:'#3a3532' }}>
          © {new Date().getFullYear()} Ciomas Keramik · All rights reserved
        </p>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div style={{ minHeight:'100vh', background:'#1a1714' }} />}>
      <LoginForm />
    </Suspense>
  );
}
