'use client';
import { useState, useEffect, useCallback } from 'react';

interface Movement {
  id: string; product_name: string; sku: string; movement_type: string;
  quantity: number; quantity_before: number; quantity_after: number;
  reference_type: string; notes: string; created_by_name: string; created_at: string;
}

interface Product { id: string; name: string; sku: string; stock_quantity: number; }

function formatRp(n: number) {
  return new Intl.NumberFormat('id-ID').format(n || 0);
}

export default function StockPage() {
  const [movements, setMovements] = useState<Movement[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({ product_id: '', movement_type: 'in', quantity: 1, notes: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [typeFilter, setTypeFilter] = useState('');

  const fetchMovements = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (typeFilter) params.set('type', typeFilter);
    const res = await fetch(`/api/stock?${params}`);
    const data = await res.json();
    setMovements(data.movements || []);
    setLoading(false);
  }, [typeFilter]);

  useEffect(() => { fetchMovements(); }, [fetchMovements]);
  useEffect(() => {
    fetch('/api/products?active=1').then(r => r.json()).then(d => setProducts(d.products || []));
  }, []);

  async function handleSave() {
    setSaving(true); setError('');
    try {
      const res = await fetch('/api/stock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      setModal(false);
      setForm({ product_id: '', movement_type: 'in', quantity: 1, notes: '' });
      fetchMovements();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal');
    } finally {
      setSaving(false);
    }
  }

  const typeColor: Record<string, string> = {
    in: 'badge-success', out: 'badge-danger', adjustment: 'badge-info', return: 'badge-warning'
  };
  const typeLabel: Record<string, string> = {
    in: 'Masuk', out: 'Keluar', adjustment: 'Penyesuaian', return: 'Retur'
  };

  return (
    <div style={{ padding: '32px 28px' }}>
      <div className="page-header">
        <div>
          <h1 className="page-title">Stok & Pergerakan Barang</h1>
          <p className="page-subtitle">Pantau keluar masuk stok keramik</p>
        </div>
        <button className="btn-primary" onClick={() => { setForm({ product_id: '', movement_type: 'in', quantity: 1, notes: '' }); setError(''); setModal(true); }}>
          + Catat Pergerakan
        </button>
      </div>

      {/* Current Stock Summary */}
      <div className="card" style={{ marginBottom: '24px' }}>
        <h3 style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '1.3rem', fontWeight: 600, marginBottom: '16px' }}>
          Ringkasan Stok Saat Ini
        </h3>
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr><th>SKU</th><th>Produk</th><th>Stok</th><th>Status</th></tr>
            </thead>
            <tbody>
              {products.slice(0, 10).map(p => (
                <tr key={p.id}>
                  <td style={{ fontFamily: 'monospace', fontSize: '0.8rem', color: '#57534e' }}>{p.sku}</td>
                  <td style={{ fontWeight: 500 }}>{p.name}</td>
                  <td style={{ fontWeight: 700, fontSize: '1rem' }}>{formatRp(p.stock_quantity)}</td>
                  <td>
                    <span className={`badge ${p.stock_quantity === 0 ? 'badge-danger' : p.stock_quantity < 20 ? 'badge-warning' : 'badge-success'}`}>
                      {p.stock_quantity === 0 ? 'Habis' : p.stock_quantity < 20 ? 'Menipis' : 'Aman'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Movement History */}
      <div className="card" style={{ marginBottom: '20px', padding: '16px 20px' }}>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <span style={{ fontSize: '0.85rem', fontWeight: 500, color: '#57534e' }}>Filter:</span>
          {['', 'in', 'out', 'adjustment', 'return'].map(t => (
            <button key={t} onClick={() => setTypeFilter(t)} style={{
              padding: '6px 14px', borderRadius: '20px', border: 'none', cursor: 'pointer',
              background: typeFilter === t ? '#1c1917' : '#f5f5f4',
              color: typeFilter === t ? '#d4a843' : '#57534e',
              fontSize: '0.75rem', fontWeight: 500, transition: 'all 0.2s',
            }}>
              {t === '' ? 'Semua' : typeLabel[t]}
            </button>
          ))}
        </div>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <table className="data-table">
          <thead>
            <tr><th>Produk</th><th>Tipe</th><th>Qty</th><th>Sebelum</th><th>Sesudah</th><th>Referensi</th><th>Oleh</th><th>Waktu</th></tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} style={{ textAlign: 'center', padding: '40px' }}><div className="loading-spinner" style={{ margin: '0 auto' }} /></td></tr>
            ) : movements.map(m => (
              <tr key={m.id}>
                <td>
                  <div style={{ fontWeight: 500 }}>{m.product_name}</div>
                  <div style={{ fontSize: '0.75rem', color: '#a8a29e' }}>{m.sku}</div>
                </td>
                <td><span className={`badge ${typeColor[m.movement_type]}`}>{typeLabel[m.movement_type]}</span></td>
                <td style={{ fontWeight: 700, color: m.movement_type === 'in' || m.movement_type === 'return' ? '#065f46' : '#dc2626' }}>
                  {m.movement_type === 'in' || m.movement_type === 'return' ? '+' : '-'}{Math.abs(m.quantity)}
                </td>
                <td style={{ color: '#78716c' }}>{formatRp(m.quantity_before)}</td>
                <td style={{ fontWeight: 600 }}>{formatRp(m.quantity_after)}</td>
                <td><span className="badge badge-stone">{m.reference_type || '—'}</span></td>
                <td style={{ fontSize: '0.8rem', color: '#78716c' }}>{m.created_by_name || '—'}</td>
                <td style={{ fontSize: '0.8rem', color: '#a8a29e' }}>
                  {new Date(m.created_at).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}
                </td>
              </tr>
            ))}
            {!loading && movements.length === 0 && (
              <tr><td colSpan={8} style={{ textAlign: 'center', padding: '40px', color: '#a8a29e' }}>Tidak ada data pergerakan</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {modal && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setModal(false); }}>
          <div className="modal">
            <div className="modal-header">
              <h2 style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '1.5rem', fontWeight: 600 }}>Catat Pergerakan Stok</h2>
              <button onClick={() => setModal(false)} style={{ background: 'none', border: 'none', fontSize: '1.2rem', cursor: 'pointer', color: '#78716c' }}>✕</button>
            </div>
            <div className="modal-body">
              {error && <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', padding: '12px', color: '#dc2626', marginBottom: '16px', fontSize: '0.85rem' }}>{error}</div>}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div className="form-group">
                  <label className="form-label">Produk</label>
                  <select className="form-select" value={form.product_id} onChange={e => setForm(p => ({ ...p, product_id: e.target.value }))}>
                    <option value="">— Pilih Produk —</option>
                    {products.map(p => <option key={p.id} value={p.id}>{p.name} ({p.sku}) — Stok: {p.stock_quantity}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Tipe Pergerakan</label>
                  <select className="form-select" value={form.movement_type} onChange={e => setForm(p => ({ ...p, movement_type: e.target.value }))}>
                    <option value="in">Masuk (Barang Datang)</option>
                    <option value="out">Keluar (Manual)</option>
                    <option value="adjustment">Penyesuaian Stok</option>
                    <option value="return">Retur Barang</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Jumlah</label>
                  <input className="form-input" type="number" min="1" value={form.quantity} onChange={e => setForm(p => ({ ...p, quantity: parseInt(e.target.value) || 1 }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Catatan</label>
                  <textarea className="form-input" rows={3} value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} style={{ resize: 'vertical' }} />
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setModal(false)}>Batal</button>
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
