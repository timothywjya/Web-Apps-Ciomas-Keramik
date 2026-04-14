'use client';
import { useState, useEffect, useCallback } from 'react';

interface Customer {
  id: string; name: string; phone: string; email: string; address: string;
  city: string; customer_type: string; total_purchases: number; is_active: boolean; created_at: string;
}

const TYPES = ['retail', 'grosir', 'kontraktor'];
const TYPE_BADGE: Record<string, string> = { retail: 'badge-info', grosir: 'badge-warning', kontraktor: 'badge-success' };
const EMPTY = { name: '', phone: '', email: '', address: '', city: '', customer_type: 'retail', notes: '', is_active: true };

function formatRp(n: number) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(n || 0);
}

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [modal, setModal] = useState<'add' | 'edit' | null>(null);
  const [form, setForm] = useState<Partial<Customer & { notes: string }>>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const fetchCustomers = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (typeFilter) params.set('type', typeFilter);
    const res = await fetch(`/api/customers?${params}`);
    const data = await res.json();
    setCustomers(data.customers || []);
    setLoading(false);
  }, [search, typeFilter]);

  useEffect(() => { fetchCustomers(); }, [fetchCustomers]);

  function openAdd() { setForm(EMPTY); setError(''); setModal('add'); }
  function openEdit(c: Customer) { setForm(c); setError(''); setModal('edit'); }

  async function handleSave() {
    setSaving(true); setError('');
    try {
      const method = modal === 'edit' ? 'PUT' : 'POST';
      const url = modal === 'edit' ? `/api/customers/${form.id}` : '/api/customers';
      const res = await fetch(url, {
        method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      setModal(null); fetchCustomers();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal menyimpan');
    } finally { setSaving(false); }
  }

  async function handleDelete(id: string) {
    if (!confirm('Nonaktifkan pelanggan ini?')) return;
    await fetch(`/api/customers/${id}`, { method: 'DELETE' });
    fetchCustomers();
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
          <h1 className="page-title">Pelanggan</h1>
          <p className="page-subtitle">Kelola data pelanggan toko</p>
        </div>
        <button className="btn-primary" onClick={openAdd}>+ Tambah Pelanggan</button>
      </div>

      {/* Type summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '24px' }}>
        {TYPES.map(t => (
          <div key={t} className="card" style={{ padding: '16px 20px', cursor: 'pointer', border: typeFilter === t ? '2px solid #b8860b' : undefined }}
            onClick={() => setTypeFilter(typeFilter === t ? '' : t)}>
            <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: '#78716c', marginBottom: '8px' }}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </div>
            <div style={{ fontSize: '1.8rem', fontWeight: 700, color: '#1c1917' }}>
              {customers.filter(c => c.customer_type === t).length}
            </div>
          </div>
        ))}
      </div>

      <div className="card" style={{ marginBottom: '20px', padding: '16px 20px' }}>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <input className="search-input" placeholder="Cari nama, telepon, email..." value={search} onChange={e => setSearch(e.target.value)} />
          <select className="form-select" style={{ width: '160px' }} value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
            <option value="">Semua Tipe</option>
            {TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <div style={{ marginLeft: 'auto', fontSize: '0.8rem', color: '#78716c' }}>{customers.length} pelanggan</div>
        </div>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <table className="data-table">
          <thead>
            <tr><th>Nama</th><th>Telepon</th><th>Email</th><th>Kota</th><th>Tipe</th><th>Total Belanja</th><th>Status</th><th>Aksi</th></tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} style={{ textAlign: 'center', padding: '40px' }}><div className="loading-spinner" style={{ margin: '0 auto' }} /></td></tr>
            ) : customers.map(c => (
              <tr key={c.id}>
                <td style={{ fontWeight: 500, color: '#1c1917' }}>{c.name}</td>
                <td style={{ color: '#57534e' }}>{c.phone || '—'}</td>
                <td style={{ color: '#57534e', fontSize: '0.85rem' }}>{c.email || '—'}</td>
                <td style={{ color: '#78716c' }}>{c.city || '—'}</td>
                <td><span className={`badge ${TYPE_BADGE[c.customer_type]}`}>{c.customer_type}</span></td>
                <td style={{ fontWeight: 600, color: '#1c1917' }}>{formatRp(c.total_purchases)}</td>
                <td><span className={`badge ${c.is_active ? 'badge-success' : 'badge-stone'}`}>{c.is_active ? 'Aktif' : 'Nonaktif'}</span></td>
                <td>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button onClick={() => openEdit(c)} style={{ background: '#fef3c7', border: 'none', borderRadius: '6px', padding: '6px 10px', cursor: 'pointer', fontSize: '0.75rem', color: '#92400e' }}>Edit</button>
                    <button onClick={() => handleDelete(c.id)} className="btn-danger" style={{ padding: '6px 10px', fontSize: '0.75rem' }}>Hapus</button>
                  </div>
                </td>
              </tr>
            ))}
            {!loading && customers.length === 0 && <tr><td colSpan={8} style={{ textAlign: 'center', padding: '40px', color: '#a8a29e' }}>Tidak ada pelanggan</td></tr>}
          </tbody>
        </table>
      </div>

      {modal && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setModal(null); }}>
          <div className="modal">
            <div className="modal-header">
              <h2 style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '1.5rem', fontWeight: 600 }}>
                {modal === 'add' ? 'Tambah Pelanggan Baru' : 'Edit Pelanggan'}
              </h2>
              <button onClick={() => setModal(null)} style={{ background: 'none', border: 'none', fontSize: '1.2rem', cursor: 'pointer', color: '#78716c' }}>✕</button>
            </div>
            <div className="modal-body">
              {error && <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', padding: '12px', color: '#dc2626', marginBottom: '16px', fontSize: '0.85rem' }}>{error}</div>}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                {inp('name', 'Nama Pelanggan')}
                {inp('phone', 'Nomor Telepon', 'tel')}
                {inp('email', 'Email', 'email')}
                {inp('city', 'Kota')}
                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                  <label className="form-label">Alamat</label>
                  <textarea className="form-input" rows={2} value={form.address || ''} onChange={e => setForm(p => ({ ...p, address: e.target.value }))} style={{ resize: 'vertical' }} />
                </div>
                <div className="form-group">
                  <label className="form-label">Tipe Pelanggan</label>
                  <select className="form-select" value={form.customer_type || 'retail'} onChange={e => setForm(p => ({ ...p, customer_type: e.target.value }))}>
                    {TYPES.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Catatan</label>
                  <input className="form-input" value={form.notes || ''} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} />
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setModal(null)}>Batal</button>
              <button className="btn-primary" onClick={handleSave} disabled={saving}>{saving ? 'Menyimpan...' : 'Simpan'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
