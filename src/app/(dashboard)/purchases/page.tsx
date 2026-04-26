'use client';
import { useState, useEffect, useCallback } from 'react';
import { useToast } from '@/lib/toast';
import { fetchJson, fetchJsonPost, getErrorMessage } from '@/lib/fetchJson';

interface Purchase {
  id: string; purchase_number: string; supplier_name: string; supplier_id: string;
  purchase_date: string; status: string; total_amount: number; paid_amount: number; created_by_name: string;
}
interface Supplier { id: string; name: string; }
interface Product { id: string; name: string; sku: string; purchase_price: number; stock_quantity: number; }
interface PurchaseItem { product_id: string; product_name: string; quantity: number; unit_price: number; subtotal: number; }

interface Payable {
  id: string; po_number: string; supplier_name: string;
  total_amount: number; paid_amount: number; outstanding: number;
  discount_amount: number; status: string; due_date?: string; notes?: string;
}
interface PayablePayment {
  id: string; payment_date: string; amount: number;
  payment_method: string; reference_no?: string; notes?: string;
}

function formatRp(n: number) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(n || 0);
}
function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function PurchasesPage() {
  const toast = useToast();
  const [purchases, setPurchases]         = useState<Purchase[]>([]);
  const [loading, setLoading]             = useState(true);
  const [search, setSearch]               = useState('');
  const [modal, setModal]                 = useState<'add' | 'hutang' | null>(null);
  const [suppliers, setSuppliers]         = useState<Supplier[]>([]);
  const [products, setProducts]           = useState<Product[]>([]);
  const [selectedSupplier, setSelectedSupplier] = useState('');
  const [items, setItems]                 = useState<PurchaseItem[]>([]);
  const [notes, setNotes]                 = useState('');
  const [saving, setSaving]               = useState(false);
  const [error, setError]                 = useState('');

  // Hutang state
  const [viewPurchase, setViewPurchase]   = useState<Purchase | null>(null);
  const [hutang, setHutang]               = useState<Payable | null>(null);
  const [hutangPayments, setHutangPayments] = useState<PayablePayment[]>([]);
  const [hutangLoading, setHutangLoading] = useState(false);
  const [showAddBayar, setShowAddBayar]   = useState(false);
  const [bayarAmount, setBayarAmount]     = useState('');
  const [bayarDate, setBayarDate]         = useState(new Date().toISOString().split('T')[0]);
  const [bayarMethod, setBayarMethod]     = useState('transfer');
  const [bayarRef, setBayarRef]           = useState('');
  const [poEmailTo, setPoEmailTo]               = useState('');
  const [poEmailLoading, setPoEmailLoading]   = useState(false);
  const [bayarNotes, setBayarNotes]       = useState('');
  const [bayarSaving, setBayarSaving]     = useState(false);
  const [bayarError, setBayarError]       = useState('');

  const fetchPurchases = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      const data = await fetchJson<{ purchases: Purchase[] }>(`/api/purchases?${params}`);
      setPurchases(data.purchases || []);
    } catch (err) {
      toast.error('Gagal memuat pembelian', getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [search, toast]);

  useEffect(() => { fetchPurchases(); }, [fetchPurchases]);
  useEffect(() => {
    fetchJson<{ suppliers: Supplier[] }>('/api/suppliers').then(d => setSuppliers(d.suppliers || [])).catch(() => {});
    fetchJson<{ products: Product[] }>('/api/products?active=1').then(d => setProducts(d.products || [])).catch(() => {});
  }, []);

  function openModal() {
    setSelectedSupplier(''); setItems([]); setNotes(''); setError(''); setModal('add');
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
      const updated = { ...item, [key]: typeof val === 'string' ? (parseFloat(val) || 0) : val };
      updated.subtotal = Number(updated.quantity) * Number(updated.unit_price);
      return updated;
    }));
  }

  async function sendPoEmail() {
    if (!poEmailTo) { toast.warning('Masukkan email supplier'); return; }
    if (!viewPurchase) return;
    setPoEmailLoading(true);
    try {
      await fetchJsonPost('/api/email', { type: 'purchase_order', id: viewPurchase.id, to: poEmailTo });
      toast.success('PO dikirim via email ke ' + poEmailTo);
      setPoEmailTo('');
    } catch (err) { toast.error('Gagal kirim email', getErrorMessage(err)); }
    finally { setPoEmailLoading(false); }
  }

  const total = items.reduce((s, i) => s + (Number(i.quantity) * Number(i.unit_price)), 0);

  async function handleSave() {
    if (items.length === 0) { setError('Tambahkan minimal 1 produk'); return; }
    setSaving(true); setError('');
    try {
      await fetchJsonPost<{ id: string; purchase_number: string }>('/api/purchases', { supplier_id: selectedSupplier || null, items, notes });
      setModal(null);
      fetchPurchases();
    } catch (err) { setError(getErrorMessage(err, 'Gagal menyimpan')); } finally { setSaving(false); }
  }

  // ── Open Hutang Modal ─────────────────────────────────────────────────────
  async function openHutang(po: Purchase) {
    setViewPurchase(po);
    setHutang(null);
    setHutangPayments([]);
    setShowAddBayar(false);
    setBayarAmount(''); setBayarRef(''); setBayarNotes('');
    setBayarDate(new Date().toISOString().split('T')[0]);
    setBayarMethod('transfer'); setBayarError('');
    setModal('hutang');
    setHutangLoading(true);
    
    try {
      // Mencari data Payable
      const data = await fetchJson<{ payables: Payable[] }>(`/api/payables?search=${encodeURIComponent(po.purchase_number)}`);
      
      const found = (data.payables || []).find(
        (h) => h.po_number === po.purchase_number
      );
      
      if (found) {
        setHutang(found);
        // Menggunakan interface PayablePayment yang sudah Anda definisikan di atas
        const pd = await fetchJson<{ payments: PayablePayment[] }>(`/api/payables/${found.id}`);
        setHutangPayments(pd.payments || []);
      }
    } finally {
      setHutangLoading(false);
    }
  }

  async function handleTambahBayar() {
  if (!hutang) return;
  const amt = parseFloat(bayarAmount);
  if (!amt || amt <= 0) { setBayarError('Jumlah harus lebih dari 0'); return; }
  
  setBayarSaving(true); 
  setBayarError('');
  
    try {
      const data = await fetchJsonPost<{ payable: Payable }>(`/api/payables/${hutang.id}`, {
        amount: amt, 
        payment_date: bayarDate,
        payment_method: bayarMethod, 
        reference_no: bayarRef || null, 
        notes: bayarNotes || null,
      });
      
      setHutang(data.payable);
      
      const pd = await fetchJson<{ payments: PayablePayment[] }>(`/api/payables/${hutang.id}`);
      setHutangPayments(pd.payments || []);
      
      setShowAddBayar(false);
      setBayarAmount(''); 
      setBayarRef(''); 
      setBayarNotes('');
      fetchPurchases();
      
    } catch (err) { 
      setBayarError(getErrorMessage(err, 'Gagal menyimpan'));
    } finally {
      setBayarSaving(false);
    }
  }

  const hutangBadge = (s: string) => {
    const map: Record<string, string>   = { paid: 'badge-success', partial: 'badge-warning', outstanding: 'badge-danger', overdue: 'badge-danger' };
    const label: Record<string, string> = { paid: 'Lunas', partial: 'Cicilan', outstanding: 'Belum Bayar', overdue: 'Jatuh Tempo' };
    return <span className={`badge ${map[s] || 'badge-stone'}`}>{label[s] || s}</span>;
  };

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
            <tr><th>No. PO</th><th>Supplier</th><th>Total</th><th>Dibayar</th><th>Status</th><th>Dibuat Oleh</th><th>Tanggal</th><th>Aksi</th></tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} style={{ textAlign: 'center', padding: '40px' }}><div className="loading-spinner" style={{ margin: '0 auto' }} /></td></tr>
            ) : purchases.map(p => (
              <tr key={p.id}>
                <td style={{ fontWeight: 600, color: '#1c1917', fontSize: '0.82rem' }}>
                  {p.purchase_number}
                  <button onClick={e => { e.stopPropagation(); window.open(`/api/pdf/purchase/${p.id}`, '_blank'); }}
                    style={{ marginLeft: '8px', background: 'none', border: '1px solid #e7e5e4', borderRadius: '5px', padding: '2px 6px', fontSize: '0.68rem', cursor: 'pointer', color: '#57534e' }}>
                    📄
                  </button>
                </td>
                <td>{p.supplier_name || <span style={{ color: '#a8a29e' }}>— Tanpa Supplier —</span>}</td>
                <td style={{ fontWeight: 700 }}>{formatRp(p.total_amount)}</td>
                <td style={{ color: p.paid_amount >= p.total_amount ? '#166534' : '#78716c' }}>
                  {formatRp(p.paid_amount)}
                </td>
                <td>
                  <span className={`badge ${p.status === 'received' ? 'badge-success' : p.status === 'cancelled' ? 'badge-danger' : 'badge-warning'}`}>
                    {p.status}
                  </span>
                </td>
                <td style={{ fontSize: '0.85rem', color: '#78716c' }}>{p.created_by_name || '—'}</td>
                <td style={{ fontSize: '0.8rem', color: '#a8a29e' }}>{fmtDate(p.purchase_date)}</td>
                <td>
                  <div style={{ display:'flex', gap:'6px', alignItems:'center' }}>
                    <button onClick={() => openHutang(p)}
                      style={{ background: p.paid_amount >= p.total_amount ? '#f0fdf4' : '#fef3c7', border: 'none', borderRadius: '6px', padding: '6px 12px', cursor: 'pointer', fontSize: '0.75rem', color: p.paid_amount >= p.total_amount ? '#166534' : '#92400e', fontWeight: 600 }}>
                      🏦 Hutang
                    </button>
                    <a href="/goods-receipt" style={{ background: '#f0fdf4', border: 'none', borderRadius: '6px', padding: '6px 10px', cursor: 'pointer', fontSize: '0.75rem', color: '#166534', fontWeight: 600, textDecoration: 'none' }}>
                      📦 BPB
                    </a>
                  </div>
                </td>
              </tr>
            ))}
            {!loading && purchases.length === 0 && (
              <tr><td colSpan={8} style={{ textAlign: 'center', padding: '40px', color: '#a8a29e' }}>Tidak ada data pembelian</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* ── Add Purchase Modal ── */}
      {modal === 'add' && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setModal(null); }}>
          <div className="modal" style={{ maxWidth: '820px' }}>
            <div className="modal-header">
              <h2 style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '1.5rem', fontWeight: 600 }}>Purchase Order Baru</h2>
              <button onClick={() => setModal(null)} style={{ background: 'none', border: 'none', fontSize: '1.2rem', cursor: 'pointer', color: '#78716c' }}>✕</button>
            </div>
            <div className="modal-body">
              {error && <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', padding: '12px', color: '#dc2626', marginBottom: '16px', fontSize: '0.85rem' }}>{error}</div>}

              <div style={{ background: '#fef3c7', border: '1px solid #fde68a', borderRadius: '8px', padding: '10px 14px', marginBottom: '16px', fontSize: '0.82rem', color: '#92400e' }}>
                ⚡ <strong>Hutang ke supplier otomatis dibuat</strong> saat PO ini disimpan. Catat pembayaran via tombol Hutang di daftar.
              </div>

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
              <button className="btn-secondary" onClick={() => setModal(null)}>Batal</button>
              <button className="btn-primary" onClick={handleSave} disabled={saving}>{saving ? 'Menyimpan...' : '✓ Simpan PO'}</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Hutang Modal ── */}
      {modal === 'hutang' && viewPurchase && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setModal(null); }}>
          <div className="modal" style={{ maxWidth: '680px' }}>
            <div className="modal-header">
              <div>
                <h2 style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '1.4rem', fontWeight: 600 }}>
                  🏦 Hutang — {viewPurchase.purchase_number}
                </h2>
                <p style={{ fontSize: '0.78rem', color: '#78716c', margin: 0 }}>{viewPurchase.supplier_name || 'Tanpa Supplier'}</p>
              </div>
              <button onClick={() => setModal(null)} style={{ background: 'none', border: 'none', fontSize: '1.2rem', cursor: 'pointer', color: '#78716c' }}>✕</button>
            </div>
            <div className="modal-body">
              {hutangLoading ? (
                <div style={{ textAlign: 'center', padding: '40px' }}><div className="loading-spinner" style={{ margin: '0 auto' }} /></div>
              ) : !hutang ? (
                <div style={{ textAlign: 'center', padding: '32px', color: '#78716c' }}>
                  <div style={{ fontSize: '2rem', marginBottom: '12px' }}>📋</div>
                  <p>Data hutang tidak ditemukan untuk PO ini.</p>
                </div>
              ) : (
                <>
                  {/* Summary */}
                  <div style={{ background: '#fafaf9', borderRadius: '12px', padding: '20px', marginBottom: '20px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '0.7rem', color: '#78716c', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '4px' }}>Total Hutang</div>
                        <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#1c1917' }}>{formatRp(hutang.total_amount - hutang.discount_amount)}</div>
                      </div>
                      <div style={{ textAlign: 'center', borderLeft: '1px solid #e7e5e4', borderRight: '1px solid #e7e5e4' }}>
                        <div style={{ fontSize: '0.7rem', color: '#78716c', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '4px' }}>Sudah Dibayar</div>
                        <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#166534' }}>{formatRp(hutang.paid_amount)}</div>
                      </div>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '0.7rem', color: '#78716c', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '4px' }}>Sisa Hutang</div>
                        <div style={{ fontSize: '1.1rem', fontWeight: 700, color: hutang.outstanding > 0 ? '#dc2626' : '#166534' }}>{formatRp(hutang.outstanding)}</div>
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div style={{ background: '#e7e5e4', borderRadius: '99px', height: '8px', marginBottom: '8px' }}>
                      <div style={{
                        background: hutang.status === 'paid' ? '#16a34a' : '#dc2626',
                        borderRadius: '99px', height: '8px',
                        width: `${Math.min(100, (hutang.paid_amount / (hutang.total_amount - hutang.discount_amount)) * 100)}%`,
                        transition: 'width 0.3s ease',
                      }} />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.73rem', color: '#78716c' }}>
                      <span>{hutangBadge(hutang.status)}</span>
                      <span>{Math.round((hutang.paid_amount / Math.max(1, hutang.total_amount - hutang.discount_amount)) * 100)}% terbayar</span>
                    </div>

                    {hutang.due_date && (
                      <div style={{ marginTop: '10px', fontSize: '0.78rem', color: new Date(hutang.due_date) < new Date() && hutang.status !== 'paid' ? '#dc2626' : '#78716c' }}>
                        📅 Jatuh tempo: {fmtDate(hutang.due_date)}
                        {new Date(hutang.due_date) < new Date() && hutang.status !== 'paid' && ' ⚠️ Melewati jatuh tempo'}
                      </div>
                    )}
                  </div>

                  {/* Payment History */}
                  <div style={{ marginBottom: '16px' }}>
                    <h3 style={{ fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#78716c', marginBottom: '10px' }}>
                      Riwayat Pembayaran ({hutangPayments.length})
                    </h3>
                    {hutangPayments.length === 0 ? (
                      <p style={{ color: '#a8a29e', fontSize: '0.85rem', textAlign: 'center', padding: '16px' }}>Belum ada pembayaran ke supplier</p>
                    ) : (
                      <div style={{ border: '1px solid #f0efee', borderRadius: '8px', overflow: 'hidden' }}>
                        {hutangPayments.map((p, idx) => (
                          <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderBottom: idx < hutangPayments.length - 1 ? '1px solid #f5f5f4' : 'none', background: idx % 2 === 0 ? '#fff' : '#fafaf9' }}>
                            <div>
                              <div style={{ fontWeight: 600, fontSize: '0.88rem', color: '#1c1917' }}>{formatRp(p.amount)}</div>
                              <div style={{ fontSize: '0.73rem', color: '#78716c' }}>
                                {fmtDate(p.payment_date)} · {p.payment_method}
                                {p.reference_no && ` · Ref: ${p.reference_no}`}
                              </div>
                              {p.notes && <div style={{ fontSize: '0.72rem', color: '#a8a29e', marginTop: '2px' }}>{p.notes}</div>}
                            </div>
                            <div style={{ background: '#fef2f2', color: '#dc2626', borderRadius: '6px', padding: '4px 10px', fontSize: '0.75rem', fontWeight: 600 }}>
                              ✓ Keluar
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Add Payment */}
                  {hutang.status !== 'paid' && (
                    <div>
                      {!showAddBayar ? (
                        <button onClick={() => setShowAddBayar(true)}
                          style={{ width: '100%', background: '#1c1917', color: 'white', border: 'none', borderRadius: '8px', padding: '12px', cursor: 'pointer', fontWeight: 600, fontSize: '0.9rem' }}>
                          + Catat Pembayaran ke Supplier
                        </button>
                      ) : (
                        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '10px', padding: '16px' }}>
                          <h4 style={{ margin: '0 0 14px', fontSize: '0.85rem', fontWeight: 700, color: '#991b1b' }}>Catat Pembayaran Hutang</h4>
                          {bayarError && <div style={{ background: '#fff', border: '1px solid #fecaca', borderRadius: '6px', padding: '10px', color: '#dc2626', marginBottom: '12px', fontSize: '0.82rem' }}>{bayarError}</div>}
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                            <div>
                              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#78716c', marginBottom: '4px' }}>Jumlah Bayar *</label>
                              <input type="number" placeholder={`Maks ${formatRp(hutang.outstanding)}`} value={bayarAmount} onChange={e => setBayarAmount(e.target.value)}
                                style={{ width: '100%', border: '1px solid #e7e5e4', borderRadius: '6px', padding: '8px 10px', fontSize: '0.88rem', boxSizing: 'border-box' }} />
                            </div>
                            <div>
                              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#78716c', marginBottom: '4px' }}>Tanggal Bayar</label>
                              <input type="date" value={bayarDate} onChange={e => setBayarDate(e.target.value)}
                                style={{ width: '100%', border: '1px solid #e7e5e4', borderRadius: '6px', padding: '8px 10px', fontSize: '0.88rem', boxSizing: 'border-box' }} />
                            </div>
                            <div>
                              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#78716c', marginBottom: '4px' }}>Metode</label>
                              <select value={bayarMethod} onChange={e => setBayarMethod(e.target.value)}
                                style={{ width: '100%', border: '1px solid #e7e5e4', borderRadius: '6px', padding: '8px 10px', fontSize: '0.88rem', boxSizing: 'border-box' }}>
                                <option value="transfer">Transfer</option>
                                <option value="cash">Cash</option>
                                <option value="giro">Giro</option>
                                <option value="cek">Cek</option>
                              </select>
                            </div>
                            <div>
                              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#78716c', marginBottom: '4px' }}>No. Referensi</label>
                              <input type="text" placeholder="No. transfer / cek" value={bayarRef} onChange={e => setBayarRef(e.target.value)}
                                style={{ width: '100%', border: '1px solid #e7e5e4', borderRadius: '6px', padding: '8px 10px', fontSize: '0.88rem', boxSizing: 'border-box' }} />
                            </div>
                          </div>
                          <div style={{ marginBottom: '12px' }}>
                            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#78716c', marginBottom: '4px' }}>Catatan</label>
                            <input type="text" value={bayarNotes} onChange={e => setBayarNotes(e.target.value)}
                              style={{ width: '100%', border: '1px solid #e7e5e4', borderRadius: '6px', padding: '8px 10px', fontSize: '0.88rem', boxSizing: 'border-box' }} />
                          </div>
                          <div style={{ display: 'flex', gap: '8px' }}>
                            <button onClick={() => setShowAddBayar(false)}
                              style={{ flex: 1, background: '#f5f5f4', border: 'none', borderRadius: '6px', padding: '10px', cursor: 'pointer', fontSize: '0.85rem' }}>
                              Batal
                            </button>
                            <button onClick={handleTambahBayar} disabled={bayarSaving}
                              style={{ flex: 2, background: '#1c1917', color: 'white', border: 'none', borderRadius: '6px', padding: '10px', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem' }}>
                              {bayarSaving ? 'Menyimpan...' : '✓ Simpan Pembayaran'}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {hutang.status === 'paid' && (
                    <div style={{ textAlign: 'center', padding: '16px', background: '#f0fdf4', borderRadius: '8px', color: '#166534', fontWeight: 600 }}>
                      ✅ Hutang ini sudah LUNAS
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Email PO to Supplier */}
            <div style={{ padding: '0 20px 20px' }}>
              <div style={{ padding: '12px 14px', background: '#f9f8f7', borderRadius: '8px' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#a8a29e', marginBottom: '8px' }}>📧 Kirim PO via Email ke Supplier</div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input className="form-input" style={{ flex: 1, fontSize: '0.82rem' }} type="email" placeholder="Email supplier..." value={poEmailTo} onChange={e => setPoEmailTo(e.target.value)} />
                  <button onClick={sendPoEmail} disabled={poEmailLoading} style={{ background: '#1c1917', color: '#d4a843', border: 'none', borderRadius: '8px', padding: '8px 14px', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600, whiteSpace: 'nowrap' }}>{poEmailLoading ? 'Mengirim...' : 'Kirim'}</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
