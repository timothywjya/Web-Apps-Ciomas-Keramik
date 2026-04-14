'use client';
import { useState, useEffect, useCallback } from 'react';

interface Purchase {
  id: string; purchase_number: string; supplier_name: string; supplier_id: string;
  purchase_date: string; status: string; total_amount: number; paid_amount: number; created_by_name: string;
}
interface Supplier { id: string; name: string; }
interface Product { id: string; name: string; sku: string; purchase_price: number; stock_quantity: number; }
interface PurchaseItem { product_id: string; product_name: string; quantity: number; unit_price: number; subtotal: number; }

function formatRp(n: number) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(n || 0);
}

export default function PurchasesPage() {
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState(false);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedSupplier, setSelectedSupplier] = useState('');
  const [items, setItems] = useState<PurchaseItem[]>([]);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const fetchPurchases = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    const res = await fetch(`/api/purchases?${params}`);
    const data = await res.json();
    setPurchases(data.purchases || []);
    setLoading(false);
  }, [search]);

  useEffect(() => { fetchPurchases(); }, [fetchPurchases]);
  useEffect(() => {
    fetch('/api/suppliers').then(r => r.json()).then(d => setSuppliers(d.suppliers || []));
    fetch('/api/products?active=1').then(r => r.json()).then(d => setProducts(d.products || []));
  }, []);

  function openModal() {
    setSelectedSupplier(''); setItems([]); setNotes(''); setError(''); setModal(true);
  }

  function addItem(productId: string) {
    const p = products.find(x => x.id === productId);
    if (!p || items.find(i => i.product_id === productId)) return;
    setItems(prev => [...prev, {
      product_id: p.id, product_name: p.name,
      quantity: 1, unit_price: p.purchase_price, subtotal: p.purchase_price,
    }]);
  }

  function updateItem(idx: number, key: keyof PurchaseItem, val: string | number) {
    setItems(prev => prev.map((item, i) => {
      if (i !== idx) return item;
      const updated = { ...item, [key]: val };
      updated.subtotal = updated.quantity * updated.unit_price;
      return updated;
    }));
  }

  const total = items.reduce((s, i) => s + i.subtotal, 0);

  async function handleSave() {
    if (items.length === 0) { setError('Tambahkan minimal 1 produk'); return; }
    setSaving(true); setError('');
    try {
      const res = await fetch('/api/purchases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ supplier_id: selectedSupplier || null, items, notes }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      setModal(false);
      fetchPurchases();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal menyimpan');
    } finally { setSaving(false); }
  }

  return (
    <div style={{ padding: '32px 28px' }}>
      <div className="page-header">
        <div>
          <h1 className="page-title">Pembelian</h1>
          <p className="page-subtitle">Catat pembelian & penerimaan barang</p>
        </div>
        <button className="btn-primary" onClick={openModal}>+ Buat Purchase Order</button>
      </div>

      <div className="card" style={{ marginBottom: '20px', padding: '16px 20px' }}>
        <div style={{ display: 'flex', gap: '12px' }}>
          <input className="search-input" placeholder="Cari nomor PO, supplier..." value={search} onChange={e => setSearch(e.target.value)} />
          <div style={{ marginLeft: 'auto', fontSize: '0.8rem', color: '#78716c' }}>{purchases.length} transaksi</div>
        </div>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <table className="data-table">
          <thead>
            <tr><th>No. PO</th><th>Supplier</th><th>Total</th><th>Status</th><th>Dibuat Oleh</th><th>Tanggal</th></tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} style={{ textAlign: 'center', padding: '40px' }}><div className="loading-spinner" style={{ margin: '0 auto' }} /></td></tr>
            ) : purchases.map(p => (
              <tr key={p.id}>
                <td style={{ fontWeight: 600, color: '#1c1917', fontSize: '0.82rem' }}>{p.purchase_number}</td>
                <td>{p.supplier_name || <span style={{ color: '#a8a29e' }}>— Tanpa Supplier —</span>}</td>
                <td style={{ fontWeight: 700 }}>{formatRp(p.total_amount)}</td>
                <td>
                  <span className={`badge ${p.status === 'received' ? 'badge-success' : p.status === 'cancelled' ? 'badge-danger' : 'badge-warning'}`}>
                    {p.status}
                  </span>
                </td>
                <td style={{ fontSize: '0.85rem', color: '#78716c' }}>{p.created_by_name || '—'}</td>
                <td style={{ fontSize: '0.8rem', color: '#a8a29e' }}>{new Date(p.purchase_date).toLocaleDateString('id-ID')}</td>
              </tr>
            ))}
            {!loading && purchases.length === 0 && (
              <tr><td colSpan={6} style={{ textAlign: 'center', padding: '40px', color: '#a8a29e' }}>Tidak ada data pembelian</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {modal && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setModal(false); }}>
          <div className="modal" style={{ maxWidth: '820px' }}>
            <div className="modal-header">
              <h2 style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '1.5rem', fontWeight: 600 }}>Purchase Order Baru</h2>
              <button onClick={() => setModal(false)} style={{ background: 'none', border: 'none', fontSize: '1.2rem', cursor: 'pointer', color: '#78716c' }}>✕</button>
            </div>
            <div className="modal-body">
              {error && <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', padding: '12px', color: '#dc2626', marginBottom: '16px', fontSize: '0.85rem' }}>{error}</div>}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
                <div className="form-group">
                  <label className="form-label">Supplier</label>
                  <select className="form-select" value={selectedSupplier} onChange={e => setSelectedSupplier(e.target.value)}>
                    <option value="">— Tanpa Supplier —</option>
                    {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Catatan</label>
                  <input className="form-input" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Catatan pembelian..." />
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: '16px' }}>
                <label className="form-label">Tambah Produk</label>
                <select className="form-select" onChange={e => { if (e.target.value) addItem(e.target.value); e.target.value = ''; }}>
                  <option value="">— Pilih produk —</option>
                  {products.map(p => <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>)}
                </select>
              </div>

              {items.length > 0 && (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem', marginBottom: '16px' }}>
                  <thead>
                    <tr style={{ background: '#f5f5f4' }}>
                      {['Produk', 'Qty', 'Harga Beli', 'Subtotal', ''].map(h => (
                        <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontSize: '0.7rem', letterSpacing: '0.08em', textTransform: 'uppercase', color: '#78716c' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item, idx) => (
                      <tr key={item.product_id} style={{ borderBottom: '1px solid #f5f5f4' }}>
                        <td style={{ padding: '10px 12px', fontWeight: 500 }}>{item.product_name}</td>
                        <td style={{ padding: '10px 12px' }}>
                          <input type="number" min="1" value={item.quantity} onChange={e => updateItem(idx, 'quantity', parseInt(e.target.value) || 1)}
                            style={{ width: '70px', textAlign: 'center', border: '1px solid #e7e5e4', borderRadius: '6px', padding: '4px 6px' }} />
                        </td>
                        <td style={{ padding: '10px 12px' }}>
                          <input type="number" value={item.unit_price} onChange={e => updateItem(idx, 'unit_price', parseFloat(e.target.value) || 0)}
                            style={{ width: '120px', border: '1px solid #e7e5e4', borderRadius: '6px', padding: '4px 8px' }} />
                        </td>
                        <td style={{ padding: '10px 12px', fontWeight: 600 }}>{formatRp(item.subtotal)}</td>
                        <td style={{ padding: '10px 6px' }}>
                          <button onClick={() => setItems(prev => prev.filter((_, i) => i !== idx))}
                            style={{ background: '#fef2f2', border: 'none', borderRadius: '4px', color: '#dc2626', cursor: 'pointer', padding: '4px 8px' }}>✕</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <div style={{ background: '#f9f9f8', borderRadius: '10px', padding: '16px', width: '220px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: '1rem' }}>
                    <span>Total</span>
                    <span style={{ color: '#b8860b' }}>{formatRp(total)}</span>
                  </div>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setModal(false)}>Batal</button>
              <button className="btn-primary" onClick={handleSave} disabled={saving}>{saving ? 'Menyimpan...' : '✓ Simpan PO'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
