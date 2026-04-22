'use client';
import { useState, useEffect, useCallback } from 'react';
import { useToast } from '@/lib/toast';
import { fetchJson, fetchJsonPost, getErrorMessage } from '@/lib/fetchJson';

interface Category { id: string; name: string; description: string; created_at: string; }

export default function CategoriesPage() {
  const toast = useToast();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading]       = useState(true);
  const [modal, setModal]           = useState<'add' | 'edit' | null>(null);
  const [form, setForm]             = useState({ name: '', description: '', id: '' });
  const [saving, setSaving]         = useState(false);
  const [error, setError]           = useState('');

  const fetchCategories = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchJson<{ categories: Category[] }>('/api/categories');
      setCategories(data.categories || []);
    } catch (err) {
      toast.error('Gagal memuat data', getErrorMessage(err));
    } finally { setLoading(false); }
  }, [toast]);

  useEffect(() => { fetchCategories(); }, [fetchCategories]);

  function openAdd() { setForm({ name: '', description: '', id: '' }); setError(''); setModal('add'); }
  function openEdit(c: Category) { setForm({ name: c.name, description: c.description || '', id: c.id }); setError(''); setModal('edit'); }

  async function handleSave() {
    if (!form.name.trim()) { setError('Nama kategori tidak boleh kosong'); return; }
    setSaving(true); setError('');
    try {
      const method = modal === 'edit' ? 'PUT' : 'POST';
      const url    = modal === 'edit' ? `/api/categories/${form.id}` : '/api/categories';
      await fetchJsonPost(url, form, method as 'POST' | 'PUT');
      setModal(null);
      toast.success(modal === 'edit' ? 'Kategori diperbarui' : 'Kategori ditambahkan');
      fetchCategories();
    } catch (err) {
      setError(getErrorMessage(err, 'Gagal menyimpan kategori'));
    } finally { setSaving(false); }
  }

  async function handleDelete(id: string, name: string) {
    const ok = await toast.confirm({ title: 'Hapus Kategori', message: `Yakin ingin menghapus "${name}"?`, confirmText: 'Ya, Hapus', danger: true });
    if (!ok) return;
    try {
      await fetchJson(`/api/categories/${id}`, { method: 'DELETE' });
      toast.success('Kategori dihapus');
      fetchCategories();
    } catch (err) { toast.error('Gagal menghapus', getErrorMessage(err)); }
  }

  const categoryIcons = ['◈', '◉', '◫', '◳', '◻', '◎', '◑', '◐'];

  return (
    <div style={{ padding: '32px 28px' }}>
      <div className="page-header">
        <div>
          <h1 className="page-title">Kategori Keramik</h1>
          <p className="page-subtitle">Kelola jenis-jenis kategori produk</p>
        </div>
        <button className="btn-primary" onClick={openAdd}>+ Tambah Kategori</button>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '60px' }}><div className="loading-spinner" /></div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '20px' }}>
          {categories.map((c, i) => (
            <div key={c.id} className="card" style={{ position: 'relative', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', top: 0, right: 0, fontSize: '5rem', opacity: 0.04, lineHeight: 1, transform: 'translate(10px, -10px)' }}>{categoryIcons[i % categoryIcons.length]}</div>
              <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: 'linear-gradient(135deg, #1c1917, #44403c)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#d4a843', fontSize: '1.4rem', marginBottom: '16px' }}>
                {categoryIcons[i % categoryIcons.length]}
              </div>
              <h3 style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '1.25rem', fontWeight: 600, marginBottom: '6px' }}>{c.name}</h3>
              <p style={{ fontSize: '0.82rem', color: '#78716c', marginBottom: '20px', minHeight: '36px' }}>{c.description || 'Tidak ada deskripsi'}</p>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={() => openEdit(c)} style={{ background: '#fef3c7', border: 'none', borderRadius: '6px', padding: '7px 14px', cursor: 'pointer', fontSize: '0.75rem', color: '#92400e', fontWeight: 500 }}>Edit</button>
                <button onClick={() => handleDelete(c.id, c.name)} className="btn-danger" style={{ padding: '7px 14px' }}>Hapus</button>
              </div>
            </div>
          ))}
          <div onClick={openAdd} style={{ border: '2px dashed #e7e5e4', borderRadius: '12px', padding: '24px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all 0.2s', minHeight: '180px', color: '#a8a29e' }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = '#d4a843'; (e.currentTarget as HTMLElement).style.color = '#d4a843'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = '#e7e5e4'; (e.currentTarget as HTMLElement).style.color = '#a8a29e'; }}>
            <div style={{ fontSize: '2rem', marginBottom: '8px' }}>+</div>
            <div style={{ fontSize: '0.85rem', fontWeight: 500 }}>Tambah Kategori</div>
          </div>
        </div>
      )}

      {modal && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setModal(null); }}>
          <div className="modal" style={{ maxWidth: '480px' }}>
            <div className="modal-header">
              <h2 style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '1.5rem', fontWeight: 600 }}>{modal === 'add' ? 'Tambah Kategori' : 'Edit Kategori'}</h2>
              <button onClick={() => setModal(null)} style={{ background: 'none', border: 'none', fontSize: '1.2rem', cursor: 'pointer', color: '#78716c' }}>✕</button>
            </div>
            <div className="modal-body">
              {error && <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', padding: '12px', color: '#dc2626', marginBottom: '16px', fontSize: '0.85rem' }}>⚠ {error}</div>}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div className="form-group">
                  <label className="form-label">Nama Kategori</label>
                  <input className="form-input" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="cth: Keramik Lantai" />
                </div>
                <div className="form-group">
                  <label className="form-label">Deskripsi</label>
                  <textarea className="form-input" rows={3} value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} style={{ resize: 'vertical' }} />
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
