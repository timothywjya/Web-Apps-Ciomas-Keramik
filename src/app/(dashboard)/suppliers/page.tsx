'use client';
import { useState, useEffect, useCallback } from 'react';
import { useToast } from '@/lib/toast';
import { fetchJson, fetchJsonPost, getErrorMessage } from '@/lib/fetchJson';

interface Supplier {
  id: string; name: string; contact_person: string; phone: string;
  email: string; address: string; city: string; notes: string; is_active: boolean;
}

const EMPTY = { name: '', contact_person: '', phone: '', email: '', address: '', city: '', notes: '', is_active: true };

export default function SuppliersPage() {
  const toast = useToast();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading]     = useState(true);
  const [search, setSearch]       = useState('');
  const [modal, setModal]         = useState<'add' | 'edit' | null>(null);
  const [form, setForm]           = useState<Partial<Supplier>>(EMPTY);
  const [saving, setSaving]       = useState(false);
  const [error, setError]         = useState('');

  const fetchSuppliers = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      const data = await fetchJson<{ suppliers: Supplier[] }>(`/api/suppliers?${params}`);
      setSuppliers(data.suppliers || []);
    } catch (err) {
      toast.error('Gagal memuat supplier', getErrorMessage(err));
    } finally { setLoading(false); }
  }, [search, toast]);

  useEffect(() => { fetchSuppliers(); }, [fetchSuppliers]);

  function openAdd() { setForm(EMPTY); setError(''); setModal('add'); }
  function openEdit(s: Supplier) { setForm(s); setError(''); setModal('edit'); }

  async function handleSave() {
    if (!form.name?.trim()) { setError('Nama supplier tidak boleh kosong'); return; }
    setSaving(true); setError('');
    try {
      const method = modal === 'edit' ? 'PUT' : 'POST';
      const url    = modal === 'edit' ? `/api/suppliers/${form.id}` : '/api/suppliers';
      await fetchJsonPost(url, form, method as 'POST' | 'PUT');
      setModal(null);
      toast.success(modal === 'edit' ? 'Data supplier diperbarui' : 'Supplier baru ditambahkan');
      fetchSuppliers();
    } catch (err) {
      setError(getErrorMessage(err, 'Gagal menyimpan'));
    } finally { setSaving(false); }
  }

  async function handleDelete(id: string, name: string) {
    const ok = await toast.confirm({ title: 'Nonaktifkan Supplier', message: `Yakin ingin menonaktifkan "${name}"?`, confirmText: 'Ya, Nonaktifkan', danger: true });
    if (!ok) return;
    try {
      await fetchJson(`/api/suppliers/${id}`, { method: 'DELETE' });
      toast.success('Supplier dinonaktifkan');
      fetchSuppliers();
    } catch (err) { toast.error('Gagal menonaktifkan', getErrorMessage(err)); }
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
          <h1 className="page-title">Supplier</h1>
          <p className="page-subtitle">Kelola data pemasok keramik</p>
        </div>
        <button className="btn-primary" onClick={openAdd}>+ Tambah Supplier</button>
      </div>

      <div className="card" style={{ marginBottom: '20px', padding: '16px 20px' }}>
        <div style={{ display: 'flex', gap: '12px' }}>
          <input className="search-input" placeholder="Cari nama, kontak, telepon..." value={search} onChange={e => setSearch(e.target.value)} />
          <div style={{ marginLeft: 'auto', fontSize: '0.8rem', color: '#78716c' }}>{suppliers.length} supplier</div>
        </div>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <table className="data-table">
          <thead>
            <tr><th>Nama Supplier</th><th>Kontak Person</th><th>Telepon</th><th>Email</th><th>Kota</th><th>Status</th><th>Aksi</th></tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} style={{ textAlign: 'center', padding: '40px' }}><div className="loading-spinner" style={{ margin: '0 auto' }} /></td></tr>
            ) : suppliers.map(s => (
              <tr key={s.id}>
                <td style={{ fontWeight: 600, color: '#1c1917' }}>{s.name}</td>
                <td style={{ color: '#57534e' }}>{s.contact_person || '—'}</td>
                <td style={{ color: '#57534e' }}>{s.phone || '—'}</td>
                <td style={{ color: '#57534e', fontSize: '0.85rem' }}>{s.email || '—'}</td>
                <td style={{ color: '#78716c' }}>{s.city || '—'}</td>
                <td><span className={`badge ${s.is_active ? 'badge-success' : 'badge-stone'}`}>{s.is_active ? 'Aktif' : 'Nonaktif'}</span></td>
                <td>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button onClick={() => openEdit(s)} style={{ background: '#fef3c7', border: 'none', borderRadius: '6px', padding: '6px 10px', cursor: 'pointer', fontSize: '0.75rem', color: '#92400e' }}>Edit</button>
                    <button onClick={() => handleDelete(s.id, s.name)} className="btn-danger" style={{ padding: '6px 10px', fontSize: '0.75rem' }}>Hapus</button>
                  </div>
                </td>
              </tr>
            ))}
            {!loading && suppliers.length === 0 && <tr><td colSpan={7} style={{ textAlign: 'center', padding: '40px', color: '#a8a29e' }}>Tidak ada supplier</td></tr>}
          </tbody>
        </table>
      </div>

      {modal && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setModal(null); }}>
          <div className="modal">
            <div className="modal-header">
              <h2 style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '1.5rem', fontWeight: 600 }}>{modal === 'add' ? 'Tambah Supplier Baru' : 'Edit Supplier'}</h2>
              <button onClick={() => setModal(null)} style={{ background: 'none', border: 'none', fontSize: '1.2rem', cursor: 'pointer', color: '#78716c' }}>✕</button>
            </div>
            <div className="modal-body">
              {error && <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', padding: '12px', color: '#dc2626', marginBottom: '16px', fontSize: '0.85rem' }}>⚠ {error}</div>}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                {inp('name', 'Nama Perusahaan')}
                {inp('contact_person', 'Kontak Person')}
                {inp('phone', 'Telepon', 'tel')}
                {inp('email', 'Email', 'email')}
                {inp('city', 'Kota')}
                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                  <label className="form-label">Alamat</label>
                  <textarea className="form-input" rows={2} value={form.address || ''} onChange={e => setForm(p => ({ ...p, address: e.target.value }))} style={{ resize: 'vertical' }} />
                </div>
                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
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
