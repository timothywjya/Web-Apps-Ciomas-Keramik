'use client';
import { useState, useEffect, useCallback } from 'react';

interface Sale {
  id: string; invoice_number: string; customer_name: string; customer_id: string;
  sales_date: string; status: string; payment_method: string; payment_status: string;
  total_amount: number; paid_amount: number; salesperson_name: string;
}
interface Customer { id: string; name: string; customer_type: string; }
interface Product { id: string; name: string; sku: string; selling_price: number; grosir_price: number; stock_quantity: number; unit: string; }
interface SaleItem { product_id: string; product_name: string; quantity: number; unit_price: number; discount_percent: number; subtotal: number; }

function formatRp(n: number) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(n || 0);
}

export default function SalesPage() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<'add' | 'view' | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState('');
  const [items, setItems] = useState<SaleItem[]>([]);
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [notes, setNotes] = useState('');
  const [discountAmount, setDiscountAmount] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [viewSale, setViewSale] = useState<Sale | null>(null);

  const fetchSales = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (statusFilter) params.set('status', statusFilter);
    const res = await fetch(`/api/sales?${params}`);
    const data = await res.json();
    setSales(data.sales || []);
    setLoading(false);
  }, [search, statusFilter]);

  useEffect(() => { fetchSales(); }, [fetchSales]);
  useEffect(() => {
    fetch('/api/customers').then(r => r.json()).then(d => setCustomers(d.customers || []));
    fetch('/api/products?active=1').then(r => r.json()).then(d => setProducts(d.products || []));
  }, []);

  function openAdd() {
    setSelectedCustomer(''); setItems([]); setPaymentMethod('cash');
    setNotes(''); setDiscountAmount(0); setError('');
    setModal('add');
  }

  function addItem(productId: string) {
    const p = products.find(x => x.id === productId);
    if (!p) return;
    const existing = items.find(i => i.product_id === productId);
    if (existing) return;
    setItems(prev => [...prev, {
      product_id: p.id, product_name: p.name,
      quantity: 1, unit_price: p.selling_price,
      discount_percent: 0, subtotal: p.selling_price,
    }]);
  }

  function updateItem(idx: number, key: keyof SaleItem, val: string | number) {
    setItems(prev => prev.map((item, i) => {
      if (i !== idx) return item;
      const updated = { ...item, [key]: val };
      updated.subtotal = updated.quantity * updated.unit_price * (1 - updated.discount_percent / 100);
      return updated;
    }));
  }

  const subtotal = items.reduce((s, i) => s + i.subtotal, 0);
  const total = subtotal - discountAmount;

  async function handleSave() {
    if (items.length === 0) { setError('Tambahkan minimal 1 produk'); return; }
    setSaving(true); setError('');
    try {
      const res = await fetch('/api/sales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_id: selectedCustomer || null,
          items, payment_method: paymentMethod,
          discount_amount: discountAmount,
          notes,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      setModal(null);
      fetchSales();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal menyimpan');
    } finally {
      setSaving(false);
    }
  }

  const statusBadge = (s: string) => (
    <span className={`badge ${s === 'delivered' ? 'badge-success' : s === 'confirmed' ? 'badge-info' : s === 'cancelled' ? 'badge-danger' : 'badge-warning'}`}>{s}</span>
  );

  const payBadge = (s: string) => (
    <span className={`badge ${s === 'paid' ? 'badge-success' : s === 'partial' ? 'badge-warning' : 'badge-danger'}`}>{s}</span>
  );

  return (
    <div style={{ padding: '32px 28px' }}>
      <div className="page-header">
        <div>
          <h1 className="page-title">Penjualan</h1>
          <p className="page-subtitle">Manajemen transaksi penjualan</p>
        </div>
        <button className="btn-primary" onClick={openAdd}>+ Buat Invoice</button>
      </div>

      <div className="card" style={{ marginBottom: '20px', padding: '16px 20px' }}>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <input className="search-input" placeholder="Cari invoice, pelanggan..." value={search} onChange={e => setSearch(e.target.value)} />
          <select className="form-select" style={{ width: '160px' }} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
            <option value="">Semua Status</option>
            <option value="pending">Pending</option>
            <option value="confirmed">Confirmed</option>
            <option value="delivered">Delivered</option>
            <option value="cancelled">Cancelled</option>
          </select>
          <div style={{ marginLeft: 'auto', fontSize: '0.8rem', color: '#78716c' }}>{sales.length} transaksi</div>
        </div>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>No. Invoice</th><th>Pelanggan</th><th>Sales</th>
                <th>Total</th><th>Metode</th><th>Pembayaran</th><th>Status</th>
                <th>Tanggal</th><th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={9} style={{ textAlign: 'center', padding: '40px' }}><div className="loading-spinner" style={{ margin: '0 auto' }} /></td></tr>
              ) : sales.map(s => (
                <tr key={s.id}>
                  <td style={{ fontWeight: 600, color: '#1c1917', fontSize: '0.82rem' }}>
                    {s.invoice_number}
                    <button onClick={e => { e.stopPropagation(); window.open(`/api/pdf/sale/${s.id}`, '_blank'); }}
                      style={{ marginLeft: '8px', background: 'none', border: '1px solid #e7e5e4', borderRadius: '5px', padding: '2px 6px', fontSize: '0.68rem', cursor: 'pointer', color: '#57534e' }}>
                      📄
                    </button>
                  </td>
                  <td>{s.customer_name || <span style={{ color: '#a8a29e' }}>Walk-in</span>}</td>
                  <td style={{ fontSize: '0.8rem', color: '#78716c' }}>{s.salesperson_name || '—'}</td>
                  <td style={{ fontWeight: 700 }}>{formatRp(s.total_amount)}</td>
                  <td><span className="badge badge-stone">{s.payment_method}</span></td>
                  <td>{payBadge(s.payment_status)}</td>
                  <td>{statusBadge(s.status)}</td>
                  <td style={{ fontSize: '0.8rem', color: '#78716c' }}>{new Date(s.sales_date).toLocaleDateString('id-ID')}</td>
                  <td>
                    <button onClick={() => { setViewSale(s); setModal('view'); }}
                      style={{ background: '#f5f5f4', border: 'none', borderRadius: '6px', padding: '6px 12px', cursor: 'pointer', fontSize: '0.75rem', color: '#57534e' }}>
                      Detail
                    </button>
                  </td>
                </tr>
              ))}
              {!loading && sales.length === 0 && (
                <tr><td colSpan={9} style={{ textAlign: 'center', padding: '40px', color: '#a8a29e' }}>Tidak ada data penjualan</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Sale Modal */}
      {modal === 'add' && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setModal(null); }}>
          <div className="modal" style={{ maxWidth: '860px' }}>
            <div className="modal-header">
              <h2 style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '1.5rem', fontWeight: 600 }}>Buat Invoice Penjualan</h2>
              <button onClick={() => setModal(null)} style={{ background: 'none', border: 'none', fontSize: '1.2rem', cursor: 'pointer', color: '#78716c' }}>✕</button>
            </div>
            <div className="modal-body">
              {error && <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', padding: '12px', color: '#dc2626', marginBottom: '16px', fontSize: '0.85rem' }}>{error}</div>}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
                <div className="form-group">
                  <label className="form-label">Pelanggan</label>
                  <select className="form-select" value={selectedCustomer} onChange={e => setSelectedCustomer(e.target.value)}>
                    <option value="">— Walk-in Customer —</option>
                    {customers.map(c => <option key={c.id} value={c.id}>{c.name} ({c.customer_type})</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Metode Pembayaran</label>
                  <select className="form-select" value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)}>
                    <option value="cash">Cash</option>
                    <option value="transfer">Transfer Bank</option>
                    <option value="kredit">Kredit</option>
                    <option value="tempo">Tempo</option>
                  </select>
                </div>
              </div>

              {/* Product picker */}
              <div style={{ marginBottom: '16px' }}>
                <label className="form-label" style={{ display: 'block', marginBottom: '8px' }}>Tambah Produk</label>
                <select className="form-select" onChange={e => { if (e.target.value) addItem(e.target.value); e.target.value = ''; }}>
                  <option value="">— Pilih produk untuk ditambahkan —</option>
                  {products.map(p => <option key={p.id} value={p.id}>{p.name} ({p.sku}) — Stok: {p.stock_quantity}</option>)}
                </select>
              </div>

              {/* Items table */}
              {items.length > 0 && (
                <div style={{ overflowX: 'auto', marginBottom: '16px' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                    <thead>
                      <tr style={{ background: '#f5f5f4' }}>
                        <th style={{ padding: '10px 12px', textAlign: 'left', fontSize: '0.7rem', letterSpacing: '0.08em', textTransform: 'uppercase', color: '#78716c' }}>Produk</th>
                        <th style={{ padding: '10px 12px', width: '80px', textAlign: 'center', fontSize: '0.7rem', letterSpacing: '0.08em', textTransform: 'uppercase', color: '#78716c' }}>Qty</th>
                        <th style={{ padding: '10px 12px', width: '130px', fontSize: '0.7rem', letterSpacing: '0.08em', textTransform: 'uppercase', color: '#78716c' }}>Harga</th>
                        <th style={{ padding: '10px 12px', width: '70px', textAlign: 'center', fontSize: '0.7rem', letterSpacing: '0.08em', textTransform: 'uppercase', color: '#78716c' }}>Disc%</th>
                        <th style={{ padding: '10px 12px', width: '120px', textAlign: 'right', fontSize: '0.7rem', letterSpacing: '0.08em', textTransform: 'uppercase', color: '#78716c' }}>Subtotal</th>
                        <th style={{ width: '36px' }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((item, idx) => (
                        <tr key={item.product_id} style={{ borderBottom: '1px solid #f5f5f4' }}>
                          <td style={{ padding: '10px 12px', fontWeight: 500 }}>{item.product_name}</td>
                          <td style={{ padding: '10px 12px' }}>
                            <input type="number" min="1" value={item.quantity} onChange={e => updateItem(idx, 'quantity', parseInt(e.target.value) || 1)}
                              style={{ width: '60px', textAlign: 'center', border: '1px solid #e7e5e4', borderRadius: '6px', padding: '4px 6px', fontSize: '0.85rem' }} />
                          </td>
                          <td style={{ padding: '10px 12px' }}>
                            <input type="number" value={item.unit_price} onChange={e => updateItem(idx, 'unit_price', parseFloat(e.target.value) || 0)}
                              style={{ width: '120px', border: '1px solid #e7e5e4', borderRadius: '6px', padding: '4px 8px', fontSize: '0.85rem' }} />
                          </td>
                          <td style={{ padding: '10px 12px' }}>
                            <input type="number" min="0" max="100" value={item.discount_percent} onChange={e => updateItem(idx, 'discount_percent', parseFloat(e.target.value) || 0)}
                              style={{ width: '55px', textAlign: 'center', border: '1px solid #e7e5e4', borderRadius: '6px', padding: '4px 6px', fontSize: '0.85rem' }} />
                          </td>
                          <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 600 }}>{formatRp(item.subtotal)}</td>
                          <td style={{ padding: '10px 6px' }}>
                            <button onClick={() => setItems(prev => prev.filter((_, i) => i !== idx))}
                              style={{ background: '#fef2f2', border: 'none', borderRadius: '4px', color: '#dc2626', cursor: 'pointer', padding: '4px 8px' }}>✕</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Totals */}
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <div style={{ width: '280px', background: '#f9f9f8', borderRadius: '10px', padding: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '0.85rem', color: '#57534e' }}>
                    <span>Subtotal</span><span>{formatRp(subtotal)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', fontSize: '0.85rem', color: '#57534e' }}>
                    <span>Diskon Tambahan</span>
                    <input type="number" value={discountAmount} onChange={e => setDiscountAmount(parseFloat(e.target.value) || 0)}
                      style={{ width: '100px', textAlign: 'right', border: '1px solid #e7e5e4', borderRadius: '6px', padding: '4px 8px', fontSize: '0.85rem' }} />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '8px', borderTop: '1px solid #e7e5e4', fontWeight: 700, fontSize: '1rem' }}>
                    <span>Total</span><span style={{ color: '#b8860b' }}>{formatRp(total)}</span>
                  </div>
                </div>
              </div>

              <div className="form-group" style={{ marginTop: '16px' }}>
                <label className="form-label">Catatan</label>
                <textarea className="form-input" rows={2} value={notes} onChange={e => setNotes(e.target.value)} style={{ resize: 'vertical' }} />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setModal(null)}>Batal</button>
              <button className="btn-primary" onClick={handleSave} disabled={saving}>
                {saving ? 'Menyimpan...' : '✓ Simpan Invoice'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View Sale */}
      {modal === 'view' && viewSale && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setModal(null); }}>
          <div className="modal">
            <div className="modal-header">
              <h2 style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '1.5rem', fontWeight: 600 }}>
                {viewSale.invoice_number}
              </h2>
              <button onClick={() => setModal(null)} style={{ background: 'none', border: 'none', fontSize: '1.2rem', cursor: 'pointer', color: '#78716c' }}>✕</button>
            </div>
            <div className="modal-body">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                {[
                  ['Pelanggan', viewSale.customer_name || 'Walk-in'],
                  ['Tanggal', new Date(viewSale.sales_date).toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })],
                  ['Metode', viewSale.payment_method],
                  ['Total', formatRp(viewSale.total_amount)],
                  ['Dibayar', formatRp(viewSale.paid_amount)],
                  ['Status Bayar', viewSale.payment_status],
                ].map(([k, v]) => (
                  <div key={k} style={{ padding: '12px', background: '#fafaf9', borderRadius: '8px' }}>
                    <div style={{ fontSize: '0.7rem', color: '#78716c', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '4px' }}>{k}</div>
                    <div style={{ fontSize: '0.9rem', fontWeight: 500 }}>{v}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
