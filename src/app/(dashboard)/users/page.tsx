'use client';
import { useState, useEffect, useCallback } from 'react';

interface User {
  id: string; username: string; email: string; full_name: string;
  role: string; phone: string; is_active: boolean; created_at: string; last_login: string;
}

const ROLES = ['admin', 'manager', 'kasir', 'gudang'];
const EMPTY = { username: '', email: '', full_name: '', role: 'kasir', phone: '', is_active: true, password: '' };

const roleBadge: Record<string, string> = {
  admin: 'badge-danger', manager: 'badge-info', kasir: 'badge-success', gudang: 'badge-warning'
};

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<'add' | 'edit' | null>(null);
  const [form, setForm] = useState<Partial<User & { password: string }>>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    const res = await fetch(`/api/users?${params}`);
    const data = await res.json();
    setUsers(data.users || []);
    setLoading(false);
  }, [search]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  function openAdd() { setForm(EMPTY); setError(''); setModal('add'); }
  function openEdit(u: User) { setForm({ ...u, password: '' }); setError(''); setModal('edit'); }

  async function handleSave() {
    setSaving(true); setError('');
    try {
      const method = modal === 'edit' ? 'PUT' : 'POST';
      const url = modal === 'edit' ? `/api/users/${form.id}` : '/api/users';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      setModal(null);
      fetchUsers();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal menyimpan');
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(id: string, current: boolean) {
    await fetch(`/api/users/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: !current }),
    });
    fetchUsers();
  }

  const inp = (key: string, label: string, type = 'text') => (
    <div className="form-group">
      <label className="form-label">{label}</label>
      <input className="form-input" type={type} value={String(form[key as keyof typeof form] || '')}
        onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))} />
    </div>
  );

  return (
    <div style={{ padding: '32px 28px' }}>
      <div className="page-header">
        <div>
          <h1 className="page-title">Master User</h1>
          <p className="page-subtitle">Kelola akun pengguna sistem</p>
        </div>
        <button className="btn-primary" onClick={openAdd}>+ Tambah User</button>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' }}>
        {ROLES.map(role => (
          <div key={role} className="card" style={{ padding: '16px 20px' }}>
            <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: '#78716c', marginBottom: '8px' }}>{role}</div>
            <div style={{ fontSize: '1.8rem', fontWeight: 700, color: '#1c1917' }}>
              {users.filter(u => u.role === role && u.is_active).length}
            </div>
            <div style={{ fontSize: '0.75rem', color: '#a8a29e' }}>aktif</div>
          </div>
        ))}
      </div>

      <div className="card" style={{ marginBottom: '20px', padding: '16px 20px' }}>
        <div style={{ display: 'flex', gap: '12px' }}>
          <input className="search-input" placeholder="Cari nama, username, email..." value={search} onChange={e => setSearch(e.target.value)} />
          <div style={{ marginLeft: 'auto', fontSize: '0.8rem', color: '#78716c' }}>{users.length} pengguna</div>
        </div>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>Pengguna</th><th>Username</th><th>Email</th>
              <th>Role</th><th>Telepon</th><th>Login Terakhir</th><th>Status</th><th>Aksi</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} style={{ textAlign: 'center', padding: '40px' }}><div className="loading-spinner" style={{ margin: '0 auto' }} /></td></tr>
            ) : users.map(u => (
              <tr key={u.id}>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{
                      width: '36px', height: '36px', borderRadius: '50%',
                      background: 'linear-gradient(135deg, #b8860b30, #d4a84330)',
                      border: '1px solid #d4a84340',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: '#b8860b', fontWeight: 600, fontSize: '0.9rem',
                    }}>
                      {u.full_name.charAt(0).toUpperCase()}
                    </div>
                    <span style={{ fontWeight: 500, color: '#1c1917' }}>{u.full_name}</span>
                  </div>
                </td>
                <td style={{ fontFamily: 'monospace', fontSize: '0.85rem', color: '#57534e' }}>{u.username}</td>
                <td style={{ color: '#57534e', fontSize: '0.85rem' }}>{u.email}</td>
                <td><span className={`badge ${roleBadge[u.role] || 'badge-stone'}`}>{u.role}</span></td>
                <td style={{ color: '#78716c', fontSize: '0.85rem' }}>{u.phone || '—'}</td>
                <td style={{ fontSize: '0.8rem', color: '#a8a29e' }}>
                  {u.last_login ? new Date(u.last_login).toLocaleDateString('id-ID') : 'Belum pernah'}
                </td>
                <td>
                  <span className={`badge ${u.is_active ? 'badge-success' : 'badge-stone'}`}>
                    {u.is_active ? 'Aktif' : 'Nonaktif'}
                  </span>
                </td>
                <td>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button onClick={() => openEdit(u)} style={{ background: '#fef3c7', border: 'none', borderRadius: '6px', padding: '6px 10px', cursor: 'pointer', fontSize: '0.75rem', color: '#92400e' }}>Edit</button>
                    <button onClick={() => toggleActive(u.id, u.is_active)}
                      style={{ background: u.is_active ? '#fee2e2' : '#d1fae5', border: 'none', borderRadius: '6px', padding: '6px 10px', cursor: 'pointer', fontSize: '0.75rem', color: u.is_active ? '#dc2626' : '#065f46' }}>
                      {u.is_active ? 'Nonaktifkan' : 'Aktifkan'}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {modal && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setModal(null); }}>
          <div className="modal">
            <div className="modal-header">
              <h2 style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '1.5rem', fontWeight: 600 }}>
                {modal === 'add' ? 'Tambah Pengguna Baru' : 'Edit Pengguna'}
              </h2>
              <button onClick={() => setModal(null)} style={{ background: 'none', border: 'none', fontSize: '1.2rem', cursor: 'pointer', color: '#78716c' }}>✕</button>
            </div>
            <div className="modal-body">
              {error && <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', padding: '12px', color: '#dc2626', marginBottom: '16px', fontSize: '0.85rem' }}>{error}</div>}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                {inp('full_name', 'Nama Lengkap')}
                {inp('username', 'Username')}
                {inp('email', 'Email', 'email')}
                {inp('phone', 'Nomor Telepon', 'tel')}
                <div className="form-group">
                  <label className="form-label">Role</label>
                  <select className="form-select" value={form.role || 'kasir'} onChange={e => setForm(p => ({ ...p, role: e.target.value }))}>
                    {ROLES.map(r => <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Password {modal === 'edit' && <span style={{ color: '#a8a29e', fontWeight: 300 }}>(kosongkan jika tidak diubah)</span>}</label>
                  <input className="form-input" type="password" value={form.password || ''} onChange={e => setForm(p => ({ ...p, password: e.target.value }))} />
                </div>
              </div>
              {modal === 'edit' && (
                <div style={{ marginTop: '16px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                    <input type="checkbox" checked={form.is_active !== false} onChange={e => setForm(p => ({ ...p, is_active: e.target.checked }))} />
                    <span style={{ fontSize: '0.85rem', color: '#57534e' }}>Pengguna Aktif</span>
                  </label>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setModal(null)}>Batal</button>
              <button className="btn-primary" onClick={handleSave} disabled={saving}>
                {saving ? 'Menyimpan...' : 'Simpan'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
