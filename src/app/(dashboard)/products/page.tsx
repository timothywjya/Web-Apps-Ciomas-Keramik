'use client';
import { useState, useEffect, useCallback } from 'react';
import { useToast } from '@/lib/toast';
import { fetchJson, fetchJsonPost, getErrorMessage } from '@/lib/fetchJson';

interface Product {
  id: string; sku: string; name: string; category_name: string; category_id: string;
  size: string; surface_type: string; material: string; brand: string; color: string;
  purchase_price: number; selling_price: number; grosir_price: number; kontraktor_price: number;
  stock_quantity: number; min_stock: number; unit: string; is_active: boolean;
  description: string; origin_country: string;
}
interface Category { id: string; name: string; }

function formatRp(n: number) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(n || 0);
}

const EMPTY: Partial<Product> = {
  sku: '', name: '', category_id: '', size: '', surface_type: '', material: '',
  brand: '', color: '', purchase_price: 0, selling_price: 0,
  grosir_price: 0, kontraktor_price: 0, stock_quantity: 0, min_stock: 10,
  unit: 'pcs', description: '', origin_country: 'Indonesia', is_active: true,
};

export default function ProductsPage() {
  const toast = useToast();
  const [products, setProducts]     = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading]       = useState(true);
  const [search, setSearch]         = useState('');
  const [catFilter, setCatFilter]   = useState('');
  const [modal, setModal]           = useState<'add' | 'edit' | 'view' | null>(null);
  const [form, setForm]             = useState<Partial<Product>>(EMPTY);
  const [saving, setSaving]         = useState(false);
  const [error, setError]           = useState('');

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (catFilter) params.set('category', catFilter);
      const data = await fetchJson<{ products: Product[] }>(`/api/products?${params}`);
      setProducts(data.products || []);
    } catch (err) {
      toast.error('Gagal memuat produk', getErrorMessage(err));
    } finally { setLoading(false); }
  }, [search, catFilter, toast]);

  useEffect(() => { fetchProducts(); }, [fetchProducts]);
  useEffect(() => {
    fetchJson<{ categories: Category[] }>('/api/categories')
      .then(d => setCategories(d.categories || []))
      .catch(() => {});
  }, []);

  function openAdd()          { setForm(EMPTY); setError(''); setModal('add'); }
  function openEdit(p: Product) { setForm(p); setError(''); setModal('edit'); }
  function openView(p: Product) { setForm(p); setModal('view'); }

  async function handleSave() {
    if (!form.name?.trim()) { setError('Nama produk tidak boleh kosong'); return; }
    setSaving(true); setError('');
    try {
      const method = modal === 'edit' ? 'PUT' : 'POST';
      const url    = modal === 'edit' ? `/api/products/${form.id}` : '/api/products';
      await fetchJsonPost(url, form, method as 'POST' | 'PUT');
      setModal(null);
      toast.success(modal === 'edit' ? 'Produk diperbarui' : 'Produk baru ditambahkan');
      fetchProducts();
    } catch (err) {
      setError(getErrorMessage(err, 'Gagal menyimpan produk'));
    } finally { setSaving(false); }
  }

  async function handleDelete(id: string, name: string) {
    const ok = await toast.confirm({ title: 'Hapus Produk', message: `Yakin ingin menghapus "${name}"?`, confirmText: 'Ya, Hapus', danger: true });
    if (!ok) return;
    try {
      await fetchJson(`/api/products/${id}`, { method: 'DELETE' });
      toast.success('Produk dihapus');
      fetchProducts();
    } catch (err) { toast.error('Gagal menghapus', getErrorMessage(err)); }
  }

  const field = (key: keyof Product, label: string, type = 'text', opts?: string[]) => (
    <div className="form-group">
      <label className="form-label">{label}</label>
      {opts ? (
        <select className="form-select" value={String(form[key] || '')} onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))} disabled={modal === 'view'}>
          <option value="">— Pilih {label} —</option>
          {opts.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
      ) : (
        <input className="form-input" type={type} value={String(form[key] || '')}
          onChange={e => setForm(p => ({ ...p, [key]: type === 'number' ? parseFloat(e.target.value) || 0 : e.target.value }))}
          readOnly={modal === 'view'} />
      )}
    </div>
  );

  return (
    <div style={{ padding: '32px 28px' }}>
      <div className="page-header">
        <div>
          <h1 className="page-title">Master Produk</h1>
          <p className="page-subtitle">Kelola data produk keramik</p>
        </div>
        <button className="btn-primary" onClick={openAdd}>+ Tambah Produk</button>
      </div>

      <div className="card" style={{ marginBottom: '20px', padding: '16px 20px' }}>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
          <input className="search-input" placeholder="Cari SKU, nama produk..." value={search} onChange={e => setSearch(e.target.value)} />
          <select className="form-select" style={{ width: '200px' }} value={catFilter} onChange={e => setCatFilter(e.target.value)}>
            <option value="">Semua Kategori</option>
            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <div style={{ marginLeft: 'auto', fontSize: '0.8rem', color: '#78716c' }}>{products.length} produk ditemukan</div>
        </div>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr><th>SKU</th><th>Nama Produk</th><th>Kategori</th><th>Ukuran</th><th>Harga Jual</th><th>Stok</th><th>Status</th><th>Aksi</th></tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} style={{ textAlign: 'center', padding: '40px' }}><div className="loading-spinner" style={{ margin: '0 auto' }} /></td></tr>
              ) : products.length === 0 ? (
                <tr><td colSpan={8} style={{ textAlign: 'center', padding: '40px', color: '#a8a29e' }}>Tidak ada produk</td></tr>
              ) : products.map(p => (
                <tr key={p.id}>
                  <td style={{ fontFamily: 'monospace', fontSize: '0.8rem', color: '#57534e' }}>{p.sku}</td>
                  <td>
                    <div style={{ fontWeight: 500, color: '#1c1917' }}>{p.name}</div>
                    {p.brand && <div style={{ fontSize: '0.75rem', color: '#a8a29e' }}>{p.brand}</div>}
                  </td>
                  <td><span className="badge badge-stone">{p.category_name || '—'}</span></td>
                  <td style={{ color: '#57534e' }}>{p.size || '—'}</td>
                  <td style={{ fontWeight: 600, color: '#1c1917' }}>{formatRp(p.selling_price)}</td>
                  <td>
                    <span style={{ fontWeight: 700, color: p.stock_quantity <= p.min_stock ? '#c44223' : p.stock_quantity <= p.min_stock * 2 ? '#d97706' : '#065f46' }}>
                      {p.stock_quantity} {p.unit}
                    </span>
                  </td>
                  <td><span className={`badge ${p.is_active ? 'badge-success' : 'badge-stone'}`}>{p.is_active ? 'Aktif' : 'Nonaktif'}</span></td>
                  <td>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button onClick={() => openView(p)} style={{ background: '#f5f5f4', border: 'none', borderRadius: '6px', padding: '6px 10px', cursor: 'pointer', fontSize: '0.75rem', color: '#57534e' }}>Detail</button>
                      <button onClick={() => openEdit(p)} style={{ background: '#fef3c7', border: 'none', borderRadius: '6px', padding: '6px 10px', cursor: 'pointer', fontSize: '0.75rem', color: '#92400e' }}>Edit</button>
                      <button onClick={() => handleDelete(p.id, p.name)} className="btn-danger" style={{ padding: '6px 10px', fontSize: '0.75rem' }}>Hapus</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {modal && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setModal(null); }}>
          <div className="modal" style={{ maxWidth: '720px' }}>
            <div className="modal-header">
              <h2 style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '1.5rem', fontWeight: 600 }}>
                {modal === 'add' ? 'Tambah Produk Baru' : modal === 'edit' ? 'Edit Produk' : 'Detail Produk'}
              </h2>
              <button onClick={() => setModal(null)} style={{ background: 'none', border: 'none', fontSize: '1.2rem', cursor: 'pointer', color: '#78716c' }}>✕</button>
            </div>
            <div className="modal-body">
              {error && <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', padding: '12px', color: '#dc2626', marginBottom: '16px', fontSize: '0.85rem' }}>⚠ {error}</div>}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                {field('sku', 'SKU / Kode Produk')}
                {field('name', 'Nama Produk')}
                <div className="form-group">
                  <label className="form-label">Kategori</label>
                  <select className="form-select" value={form.category_id || ''} onChange={e => setForm(p => ({ ...p, category_id: e.target.value }))} disabled={modal === 'view'}>
                    <option value="">— Pilih Kategori —</option>
                    {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                {field('brand', 'Brand / Merk')}
                {field('size', 'Ukuran (cm)')}
                {field('unit', 'Satuan')}
                {field('surface_type', 'Jenis Permukaan', 'text', ['Glossy', 'Matte', 'Polished', 'Textured', 'Rustic'])}
                {field('material', 'Material', 'text', ['Keramik', 'Granit', 'Homogeneous Tile', 'Mozaik', 'Marmer'])}
                {field('color', 'Warna')}
                {field('origin_country', 'Negara Asal')}
              </div>
              <div style={{ marginTop: '20px', paddingTop: '20px', borderTop: '1px solid #f5f5f4' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 500, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#78716c', marginBottom: '14px' }}>Harga & Stok</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  {field('purchase_price', 'Harga Beli (Rp)', 'number')}
                  {field('selling_price', 'Harga Jual Retail (Rp)', 'number')}
                  {field('grosir_price', 'Harga Grosir (Rp)', 'number')}
                  {field('kontraktor_price', 'Harga Kontraktor (Rp)', 'number')}
                  {field('stock_quantity', 'Stok Awal', 'number')}
                  {field('min_stock', 'Minimum Stok', 'number')}
                </div>
              </div>
              <div style={{ marginTop: '16px' }} className="form-group">
                <label className="form-label">Deskripsi</label>
                <textarea className="form-input" rows={3} value={form.description || ''} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} readOnly={modal === 'view'} style={{ resize: 'vertical' }} />
              </div>
              {modal !== 'view' && (
                <div style={{ marginTop: '12px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                    <input type="checkbox" checked={form.is_active !== false} onChange={e => setForm(p => ({ ...p, is_active: e.target.checked }))} />
                    <span style={{ fontSize: '0.85rem', color: '#57534e' }}>Produk Aktif</span>
                  </label>
                </div>
              )}
            </div>
            {modal !== 'view' && (
              <div className="modal-footer">
                <button className="btn-secondary" onClick={() => setModal(null)}>Batal</button>
                <button className="btn-primary" onClick={handleSave} disabled={saving}>{saving ? 'Menyimpan...' : 'Simpan Produk'}</button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
