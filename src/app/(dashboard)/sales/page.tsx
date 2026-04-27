'use client';
import { useState, useEffect, useCallback } from 'react';
import { useToast } from '@/lib/toast';
import { fetchJson, fetchJsonPost, getErrorMessage } from '@/lib/fetchJson';

interface Sale {
  id: string; invoice_number: string; customer_name: string; customer_id: string;
  sales_date: string; status: string; payment_method: string; payment_status: string;
  total_amount: number; paid_amount: number; salesperson_name: string;
}
interface Customer { id: string; name: string; customer_type: string; }
interface Product { id: string; name: string; sku: string; selling_price: number; grosir_price: number; stock_quantity: number; unit: string; }
interface SaleItem { product_id: string; product_name: string; quantity: number; unit_price: number; discount_percent: number; subtotal: number; }

interface ReceivableResponse {
  receivable: Receivable;
}

interface GetPaymentsResponse {
  payments: ReceivablePayment[];
}

interface ReceivableListResponse {
  receivables: Receivable[];
}

interface PaymentListResponse {
  payments: ReceivablePayment[];
}

interface SalesListResponse {
  sales: Sale[];
}

interface Receivable {
  id: string; invoice_number: string; customer_name: string;
  total_amount: number; paid_amount: number; outstanding: number;
  discount_amount: number; status: string; due_date?: string;
  payment_type: string; notes?: string;
}

interface ReceivablePayment {
  id: string; payment_date: string; amount: number;
  payment_method: string; reference_no?: string; notes?: string;
}

function formatRp(n: number) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(n || 0);
}
function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function SalesPage() {
  const toast = useToast();
  const [sales, setSales]                 = useState<Sale[]>([]);
  const [loading, setLoading]             = useState(true);
  const [modal, setModal]                 = useState<'add' | 'view' | 'piutang' | null>(null);
  const [search, setSearch]               = useState('');
  const [statusFilter, setStatusFilter]   = useState('');
  const [customers, setCustomers]         = useState<Customer[]>([]);
  const [products, setProducts]           = useState<Product[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState('');
  const [items, setItems]                 = useState<SaleItem[]>([]);
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [dueDate, setDueDate]             = useState('');
  const [notes, setNotes]                 = useState('');
  const [discountAmount, setDiscountAmount] = useState(0);
  const [downPayment, setDownPayment]       = useState(0);
  const [saving, setSaving]               = useState(false);
  const [error, setError]                 = useState('');
  const [viewSale, setViewSale]           = useState<Sale | null>(null);

  // Piutang state
  const [piutang, setPiutang]             = useState<Receivable | null>(null);
  const [piutangPayments, setPiutangPayments] = useState<ReceivablePayment[]>([]);
  const [sendEmailTo, setSendEmailTo]           = useState('');
  const [emailLoading, setEmailLoading]         = useState(false);
  const [piutangLoading, setPiutangLoading]   = useState(false);
  const [showAddCicilan, setShowAddCicilan]   = useState(false);
  const [cicilanAmount, setCicilanAmount]     = useState('');
  const [cicilanDate, setCicilanDate]         = useState(new Date().toISOString().split('T')[0]);
  const [cicilanMethod, setCicilanMethod]     = useState('cash');
  const [cicilanRef, setCicilanRef]           = useState('');
  const [cicilanNotes, setCicilanNotes]       = useState('');
  const [cicilanSaving, setCicilanSaving]     = useState(false);
  const [cicilanError, setCicilanError]       = useState('');

  const fetchSales = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (statusFilter) params.set('status', statusFilter);
      
      // Gunakan interface SalesListResponse sebagai generic type
      const data = await fetchJson<SalesListResponse>(`/api/sales?${params}`);
      
      // TypeScript sekarang tahu data.sales adalah Sale[]
      setSales(data.sales || []);
    } catch (err) {
      toast.error('Gagal memuat data', getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter]);

  useEffect(() => { fetchSales(); }, [fetchSales]);
  useEffect(() => {
    fetchJson<{ customers: Customer[] }>('/api/customers').then(d => setCustomers(d.customers || [])).catch(() => {});
    fetchJson<{ products: Product[] }>('/api/products?active=1').then(d => setProducts(d.products || [])).catch(() => {});
  }, []);

  function openAdd() {
    setSelectedCustomer(''); setItems([]); setPaymentMethod('cash');
    setNotes(''); setDiscountAmount(0); setDueDate(''); setError('');
    setModal('add');
  }

  function addItem(productId: string) {
    const p = products.find(x => x.id === productId);
    if (!p) return;
    if (items.find(i => i.product_id === productId)) return;
    setItems(prev => [...prev, {
      product_id: p.id, product_name: p.name,
      quantity: 1, unit_price: p.selling_price,
      discount_percent: 0, subtotal: p.selling_price,
    }]);
  }

  function updateItem(idx: number, key: keyof SaleItem, val: string | number) {
    setItems(prev => prev.map((item, i) => {
      if (i !== idx) return item;
      const updated = { ...item, [key]: typeof val === 'string' ? (parseFloat(val) || 0) : val };
      updated.subtotal = Number(updated.quantity) * Number(updated.unit_price) * (1 - Number(updated.discount_percent) / 100);
      return updated;
    }));
  }

  const subtotal = items.reduce((s, i) => s + (Number(i.quantity) * Number(i.unit_price) * (1 - Number(i.discount_percent) / 100)), 0);
  const total    = subtotal - discountAmount;

  async function handleSave() {
    if (items.length === 0) { setError('Tambahkan minimal 1 produk'); return; }

    // Validasi DP untuk metode cash/transfer
    if ((paymentMethod === 'cash' || paymentMethod === 'transfer') && downPayment > 0) {
      if (downPayment > total) {
        setError(`DP (${formatRp(downPayment)}) tidak boleh melebihi total harga (${formatRp(total)})`);
        return;
      }
    }

    setSaving(true); setError('');
    try {
      await fetchJsonPost<{ id: string; invoice_number: string }>('/api/sales', {
        customer_id: selectedCustomer || null,
        payment_method: paymentMethod,
        discount_amount: discountAmount,
        down_payment: downPayment,
        due_date: dueDate || null,
        notes,
        items,
      });
      setModal(null);
      fetchSales();
    } catch (err) {
      setError(getErrorMessage(err, 'Gagal menyimpan'));
    } finally {
      setSaving(false);
    }
  }

  async function openPiutang(sale: Sale) {
    setViewSale(sale);
    setPiutang(null);
    setPiutangPayments([]);
    setShowAddCicilan(false);
    setCicilanAmount(''); setCicilanRef(''); setCicilanNotes('');
    setCicilanDate(new Date().toISOString().split('T')[0]);
    setCicilanMethod('cash'); setCicilanError('');
    setModal('piutang');
    setPiutangLoading(true);
    try {
    const data = await fetchJson<ReceivableListResponse>(`/api/receivables?search=${encodeURIComponent(sale.invoice_number)}`);
    
    const found = (data.receivables || []).find(
      (r) => r.invoice_number === sale.invoice_number
    );

    if (found) {
      setPiutang(found);
      
      const pd = await fetchJson<PaymentListResponse>(`/api/receivables/${found.id}`);
      setPiutangPayments(pd.payments || []);
    }
  } catch (err) {
    console.error("Gagal memuat piutang:", err);
  } finally {
    setPiutangLoading(false);
  }
}

  async function handleTambahCicilan() {
    if (!piutang) return;
    const amt = parseFloat(cicilanAmount);
    if (!amt || amt <= 0) { 
      setCicilanError('Jumlah harus lebih dari 0'); 
      return; 
    }
    
    setCicilanSaving(true); 
    setCicilanError('');
    
    try {
      // 1. Update piutang (Gunakan interface yang sudah ada)
      const data = await fetchJsonPost<ReceivableResponse>(
        `/api/receivables/${piutang.id}`, 
        { amount: amt, payment_date: cicilanDate, payment_method: cicilanMethod, reference_no: cicilanRef, notes: cicilanNotes }
      );
      setPiutang(data.receivable);

      // 2. Refresh daftar pembayaran
      const pd = await fetchJson<GetPaymentsResponse>(`/api/receivables/${piutang.id}`);
      setPiutangPayments(pd.payments || []);

      // 3. Reset state
      setShowAddCicilan(false);
      setCicilanAmount(''); setCicilanRef(''); setCicilanNotes('');
      
      fetchSales();
      
    } catch (err) {
      setCicilanError(err instanceof Error ? err.message : 'Gagal menyimpan');
    } finally {
      setCicilanSaving(false);
    }
  }

  async function handleBuatPiutangManual() {
    if (!viewSale) return;
    setPiutangLoading(true);
    try {
      const data = await fetchJsonPost<ReceivableResponse>('/api/receivables', {sale_id: viewSale!.id, payment_type: 'kredit'});
      
      setPiutang(data.receivable);
    } catch (err) {
      setCicilanError(err instanceof Error ? err.message : 'Gagal membuat piutang');
    } finally {
      setPiutangLoading(false);
    }
  }

  // ── Badge helpers ─────────────────────────────────────────────────────────
  const statusBadge = (s: string) => (
    <span className={`badge ${s === 'delivered' ? 'badge-success' : s === 'confirmed' ? 'badge-info' : s === 'cancelled' ? 'badge-danger' : 'badge-warning'}`}>{s}</span>
  );
  const payBadge = (s: string) => (
    <span className={`badge ${s === 'paid' ? 'badge-success' : s === 'partial' ? 'badge-warning' : 'badge-danger'}`}>{s}</span>
  );
  async function sendReceiptEmail(sale: Sale) {
    if (!sendEmailTo) { toast.warning('Masukkan email pelanggan'); return; }
    setEmailLoading(true);
    try {
      await fetchJsonPost('/api/email', { type: 'sale_receipt', id: sale.id, to: sendEmailTo, toName: sale.customer_name });
      toast.success('Struk dikirim via email ke ' + sendEmailTo);
      setSendEmailTo('');
    } catch (err) { toast.error('Gagal kirim email', getErrorMessage(err)); }
    finally { setEmailLoading(false); }
  }

  const piutangBadge = (s: string) => {
    const map: Record<string, string> = { paid: 'badge-success', partial: 'badge-warning', outstanding: 'badge-danger', overdue: 'badge-danger' };
    const label: Record<string, string> = { paid: 'Lunas', partial: 'Cicilan', outstanding: 'Belum Bayar', overdue: 'Jatuh Tempo' };
    return <span className={`badge ${map[s] || 'badge-stone'}`}>{label[s] || s}</span>;
  };

  const isKredit = (pm: string) => pm === 'kredit' || pm === 'tempo';

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
                      style={{ background:'#f5f5f4', border:'none', borderRadius:'6px', padding:'6px 10px', cursor:'pointer', fontSize:'0.75rem', color:'#57534e' }}>PDF A4</button>
                    <button onClick={e => { e.stopPropagation(); window.open(`/api/pdf/sale-thermal/${s.id}`, '_blank'); }}
                      style={{ marginLeft: '8px', background: 'none', border: '1px solid #e7e5e4', borderRadius: '5px', padding: '2px 6px', fontSize: '0.68rem', cursor: 'pointer', color: '#57534e' }}>
                      📄
                    </button>
                  </td>
                  <td>{s.customer_name || <span style={{ color: '#a8a29e' }}>Walk-in</span>}</td>
                  <td style={{ fontSize: '0.8rem', color: '#78716c' }}>{s.salesperson_name || '—'}</td>
                  <td style={{ fontWeight: 700 }}>{formatRp(s.total_amount)}</td>
                  <td>
                    <span className={`badge ${isKredit(s.payment_method) ? 'badge-warning' : 'badge-stone'}`}>
                      {s.payment_method}
                    </span>
                  </td>
                  <td>{payBadge(s.payment_status)}</td>
                  <td>{statusBadge(s.status)}</td>
                  <td style={{ fontSize: '0.8rem', color: '#78716c' }}>{new Date(s.sales_date).toLocaleDateString('id-ID')}</td>
                  <td style={{ display: 'flex', gap: '6px' }}>
                    <button onClick={() => { setViewSale(s); setModal('view'); }}
                      style={{ background: '#f5f5f4', border: 'none', borderRadius: '6px', padding: '6px 10px', cursor: 'pointer', fontSize: '0.75rem', color: '#57534e' }}>
                      Detail
                    </button>
                    {isKredit(s.payment_method) && (
                      <button onClick={() => openPiutang(s)}
                        style={{ background: s.payment_status === 'paid' ? '#f0fdf4' : '#fef3c7', border: 'none', borderRadius: '6px', padding: '6px 10px', cursor: 'pointer', fontSize: '0.75rem', color: s.payment_status === 'paid' ? '#166534' : '#92400e', fontWeight: 600 }}>
                        💰 Piutang
                      </button>
                    )}
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

      {/* ── Add Sale Modal ── */}
      {modal === 'add' && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setModal(null); }}>
          <div className="modal" style={{ maxWidth: '860px' }}>
            <div className="modal-header">
              <h2 style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '1.5rem', fontWeight: 600 }}>Buat Invoice Penjualan</h2>
              <button onClick={() => setModal(null)} style={{ background: 'none', border: 'none', fontSize: '1.2rem', cursor: 'pointer', color: '#78716c' }}>✕</button>
            </div>
            <div className="modal-body">
              {error && <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', padding: '12px', color: '#dc2626', marginBottom: '16px', fontSize: '0.85rem' }}>{error}</div>}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
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

              {isKredit(paymentMethod) && (
                <div style={{ background: '#fef3c7', border: '1px solid #fde68a', borderRadius: '8px', padding: '12px 16px', marginBottom: '16px', fontSize: '0.83rem', color: '#92400e' }}>
                  ⚡ <strong>Piutang otomatis dibuat</strong> saat invoice ini disimpan. Anda bisa menambah cicilan pembayaran dari kolom Aksi.
                  <div className="form-group" style={{ marginTop: '10px', marginBottom: 0 }}>
                    <label className="form-label" style={{ color: '#92400e' }}>Jatuh Tempo (opsional)</label>
                    <input type="date" className="form-input" value={dueDate} onChange={e => setDueDate(e.target.value)} style={{ width: '180px' }} />
                  </div>
                </div>
              )}

              {(paymentMethod === 'cash' || paymentMethod === 'transfer') && (
                <div style={{ background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: '8px', padding: '12px 16px', marginBottom: '16px', fontSize: '0.83rem', color: '#92400e' }}>
                  <div style={{ fontWeight: 700, marginBottom: '8px' }}>💰 DP / Uang Muka (Opsional)</div>
                  <div style={{ fontSize: '0.8rem', color: '#78716c', marginBottom: '10px' }}>
                    Jika customer membayar sebagian sebagai DP, isi kolom di bawah.
                    Piutang akan <strong>otomatis dibuat</strong> dengan tipe DP dan cicilan pertama sudah tercatat.
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                    <div className="form-group" style={{ marginBottom: 0, flex: 1, minWidth: '160px' }}>
                      <label className="form-label" style={{ color: '#92400e' }}>Jumlah DP (Rp)</label>
                      <input type="number" className="form-input" placeholder="0 jika tidak ada DP"
                        value={downPayment || ''} onChange={e => setDownPayment(parseFloat(e.target.value) || 0)}
                        style={{ width: '100%' }} />
                    </div>
                    {downPayment > 0 && total > 0 && downPayment > total && (
                      <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', padding: '10px 14px', flex: 1, minWidth: '160px' }}>
                        <div style={{ fontSize: '0.75rem', color: '#dc2626', fontWeight: 700 }}>❌ DP Melebihi Total</div>
                        <div style={{ fontSize: '0.82rem', color: '#dc2626' }}>DP tidak boleh lebih dari {formatRp(total)}</div>
                      </div>
                    )}
                    {downPayment > 0 && total > 0 && downPayment === total && (
                      <div style={{ background: '#dcfce7', border: '1px solid #bbf7d0', borderRadius: '8px', padding: '10px 14px', flex: 1, minWidth: '160px' }}>
                        <div style={{ fontSize: '0.75rem', color: '#166534', fontWeight: 700 }}>✅ Lunas (Paid)</div>
                        <div style={{ fontSize: '0.82rem', color: '#166534' }}>Invoice akan langsung berstatus Paid & Done</div>
                      </div>
                    )}
                    {downPayment > 0 && total > 0 && downPayment < total && (
                      <div style={{ background: '#dcfce7', border: '1px solid #bbf7d0', borderRadius: '8px', padding: '10px 14px', flex: 1, minWidth: '160px' }}>
                        <div style={{ fontSize: '0.75rem', color: '#166534', fontWeight: 600 }}>Sisa Tagihan → Piutang</div>
                        <div style={{ fontWeight: 700, color: '#166534', fontSize: '1rem' }}>
                          {formatRp(total - downPayment)}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div style={{ marginBottom: '16px' }}>
                <label className="form-label" style={{ display: 'block', marginBottom: '8px' }}>Tambah Produk</label>
                <select className="form-select" onChange={e => { if (e.target.value) addItem(e.target.value); e.target.value = ''; }}>
                  <option value="">— Pilih produk untuk ditambahkan —</option>
                  {products.map(p => <option key={p.id} value={p.id}>{p.name} ({p.sku}) — Stok: {p.stock_quantity}</option>)}
                </select>
              </div>

              {items.length > 0 && (
                <div style={{ overflowX: 'auto', marginBottom: '16px' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                    <thead>
                      <tr style={{ background: '#f5f5f4' }}>
                        {['Produk','Qty','Harga','Disc%','Subtotal',''].map(h => (
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

      {/* ── View Sale Modal ── */}
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
                  ['Tanggal', fmtDate(viewSale.sales_date)],
                  ['Metode', viewSale.payment_method],
                  ['Total', formatRp(viewSale.total_amount)],
                  ['Dibayar', formatRp(viewSale.paid_amount)],
                  ['Sisa', formatRp(viewSale.total_amount - viewSale.paid_amount)],
                ].map(([k, v]) => (
                  <div key={k} style={{ padding: '12px', background: '#fafaf9', borderRadius: '8px' }}>
                    <div style={{ fontSize: '0.7rem', color: '#78716c', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '4px' }}>{k}</div>
                    <div style={{ fontSize: '0.9rem', fontWeight: 500 }}>{v}</div>
                  </div>
                ))}
              </div>
              {isKredit(viewSale.payment_method) && (
                <div style={{ marginTop: '16px', textAlign: 'center' }}>
                  <button onClick={() => openPiutang(viewSale)}
                    style={{ background: '#fef3c7', border: '1px solid #fde68a', borderRadius: '8px', padding: '10px 24px', cursor: 'pointer', fontSize: '0.85rem', color: '#92400e', fontWeight: 600 }}>
                    💰 Lihat & Kelola Piutang
                  </button>
                </div>
              )}
              {/* Thermal + Email actions */}
              <div style={{ marginTop:'16px', padding:'12px 14px', background:'#f9f8f7', borderRadius:'8px' }}>
                <div style={{ fontSize:'0.75rem', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.08em', color:'#a8a29e', marginBottom:'10px' }}>Cetak & Kirim</div>
                <div style={{ display:'flex', gap:'8px', flexWrap:'wrap', marginBottom:'10px' }}>
                  <button onClick={() => window.open(`/api/pdf/sale/${viewSale.id}`, '_blank')} style={{ background:'#dbeafe', border:'none', borderRadius:'8px', padding:'8px 14px', cursor:'pointer', fontSize:'0.82rem', color:'#1e40af', fontWeight:600 }}>🖨 Struk A4</button>
                  <button onClick={() => window.open(`/api/pdf/sale-thermal/${viewSale.id}`, '_blank')} style={{ background:'#dcfce7', border:'none', borderRadius:'8px', padding:'8px 14px', cursor:'pointer', fontSize:'0.82rem', color:'#166534', fontWeight:600 }}>🧾 Struk Kasir</button>
                </div>
                <div style={{ display:'flex', gap:'8px' }}>
                  <input className="form-input" style={{ flex:1, fontSize:'0.82rem' }} type="email" placeholder="Email pelanggan..." value={sendEmailTo} onChange={e => setSendEmailTo(e.target.value)} />
                  <button onClick={() => sendReceiptEmail(viewSale)} disabled={emailLoading} style={{ background:'#1c1917', color:'#d4a843', border:'none', borderRadius:'8px', padding:'8px 14px', cursor:'pointer', fontSize:'0.82rem', fontWeight:600, whiteSpace:'nowrap' }}>
                    {emailLoading ? '...' : '📧 Kirim'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Piutang Modal ── */}
      {modal === 'piutang' && viewSale && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setModal(null); }}>
          <div className="modal" style={{ maxWidth: '680px' }}>
            <div className="modal-header">
              <div>
                <h2 style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '1.4rem', fontWeight: 600 }}>
                  💰 Piutang — {viewSale.invoice_number}
                </h2>
                <p style={{ fontSize: '0.78rem', color: '#78716c', margin: 0 }}>{viewSale.customer_name || 'Walk-in'}</p>
              </div>
              <button onClick={() => setModal(null)} style={{ background: 'none', border: 'none', fontSize: '1.2rem', cursor: 'pointer', color: '#78716c' }}>✕</button>
            </div>
            <div className="modal-body">
              {piutangLoading ? (
                <div style={{ textAlign: 'center', padding: '40px' }}><div className="loading-spinner" style={{ margin: '0 auto' }} /></div>
              ) : !piutang ? (
                <div style={{ textAlign: 'center', padding: '32px' }}>
                  <div style={{ fontSize: '2rem', marginBottom: '12px' }}>📋</div>
                  <p style={{ color: '#78716c', marginBottom: '16px' }}>Piutang belum dibuat untuk invoice ini.</p>
                  {cicilanError && <div style={{ color: '#dc2626', fontSize: '0.83rem', marginBottom: '12px' }}>{cicilanError}</div>}
                  <button onClick={handleBuatPiutangManual} style={{ background: '#b8860b', color: 'white', border: 'none', borderRadius: '8px', padding: '10px 24px', cursor: 'pointer', fontWeight: 600 }}>
                    Buat Piutang Sekarang
                  </button>
                </div>
              ) : (
                <>
                  {/* Summary Card */}
                  <div style={{ background: '#fafaf9', borderRadius: '12px', padding: '20px', marginBottom: '20px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '0.7rem', color: '#78716c', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '4px' }}>Total Tagihan</div>
                        <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#1c1917' }}>{formatRp(piutang.total_amount - piutang.discount_amount)}</div>
                      </div>
                      <div style={{ textAlign: 'center', borderLeft: '1px solid #e7e5e4', borderRight: '1px solid #e7e5e4' }}>
                        <div style={{ fontSize: '0.7rem', color: '#78716c', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '4px' }}>Sudah Dibayar</div>
                        <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#166534' }}>{formatRp(piutang.paid_amount)}</div>
                      </div>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '0.7rem', color: '#78716c', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '4px' }}>Sisa Tagihan</div>
                        <div style={{ fontSize: '1.1rem', fontWeight: 700, color: piutang.outstanding > 0 ? '#dc2626' : '#166534' }}>{formatRp(piutang.outstanding)}</div>
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div style={{ background: '#e7e5e4', borderRadius: '99px', height: '8px', marginBottom: '8px' }}>
                      <div style={{
                        background: piutang.status === 'paid' ? '#16a34a' : '#b8860b',
                        borderRadius: '99px', height: '8px',
                        width: `${Math.min(100, (piutang.paid_amount / (piutang.total_amount - piutang.discount_amount)) * 100)}%`,
                        transition: 'width 0.3s ease',
                      }} />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.73rem', color: '#78716c' }}>
                      <span>{piutangBadge(piutang.status)}</span>
                      <span>{Math.round((piutang.paid_amount / Math.max(1, piutang.total_amount - piutang.discount_amount)) * 100)}% lunas</span>
                    </div>

                    {piutang.due_date && (
                      <div style={{ marginTop: '10px', fontSize: '0.78rem', color: new Date(piutang.due_date) < new Date() && piutang.status !== 'paid' ? '#dc2626' : '#78716c' }}>
                        📅 Jatuh tempo: {fmtDate(piutang.due_date)}
                        {new Date(piutang.due_date) < new Date() && piutang.status !== 'paid' && ' ⚠️ Melewati jatuh tempo'}
                      </div>
                    )}
                  </div>

                  {/* Payment History */}
                  <div style={{ marginBottom: '16px' }}>
                    <h3 style={{ fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#78716c', marginBottom: '10px' }}>
                      Riwayat Pembayaran ({piutangPayments.length})
                    </h3>
                    {piutangPayments.length === 0 ? (
                      <p style={{ color: '#a8a29e', fontSize: '0.85rem', textAlign: 'center', padding: '16px' }}>Belum ada pembayaran</p>
                    ) : (
                      <div style={{ border: '1px solid #f0efee', borderRadius: '8px', overflow: 'hidden' }}>
                        {piutangPayments.map((p, idx) => (
                          <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderBottom: idx < piutangPayments.length - 1 ? '1px solid #f5f5f4' : 'none', background: idx % 2 === 0 ? '#fff' : '#fafaf9' }}>
                            <div>
                              <div style={{ fontWeight: 600, fontSize: '0.88rem', color: '#1c1917' }}>{formatRp(p.amount)}</div>
                              <div style={{ fontSize: '0.73rem', color: '#78716c' }}>
                                {fmtDate(p.payment_date)} · {p.payment_method}
                                {p.reference_no && ` · Ref: ${p.reference_no}`}
                              </div>
                              {p.notes && <div style={{ fontSize: '0.72rem', color: '#a8a29e', marginTop: '2px' }}>{p.notes}</div>}
                            </div>
                            <div style={{ background: '#f0fdf4', color: '#166534', borderRadius: '6px', padding: '4px 10px', fontSize: '0.75rem', fontWeight: 600 }}>
                              ✓ Masuk
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Add Cicilan */}
                  {piutang.status !== 'paid' && (
                    <div>
                      {!showAddCicilan ? (
                        <button onClick={() => setShowAddCicilan(true)}
                          style={{ width: '100%', background: '#b8860b', color: 'white', border: 'none', borderRadius: '8px', padding: '12px', cursor: 'pointer', fontWeight: 600, fontSize: '0.9rem' }}>
                          + Tambah Cicilan / Pembayaran
                        </button>
                      ) : (
                        <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '10px', padding: '16px' }}>
                          <h4 style={{ margin: '0 0 14px', fontSize: '0.85rem', fontWeight: 700, color: '#92400e' }}>Tambah Pembayaran</h4>
                          {cicilanError && <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '6px', padding: '10px', color: '#dc2626', marginBottom: '12px', fontSize: '0.82rem' }}>{cicilanError}</div>}
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                            <div>
                              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#78716c', marginBottom: '4px' }}>Jumlah Bayar *</label>
                              <input type="number" placeholder={`Maks ${formatRp(piutang.outstanding)}`} value={cicilanAmount} onChange={e => setCicilanAmount(e.target.value)}
                                style={{ width: '100%', border: '1px solid #e7e5e4', borderRadius: '6px', padding: '8px 10px', fontSize: '0.88rem', boxSizing: 'border-box' }} />
                            </div>
                            <div>
                              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#78716c', marginBottom: '4px' }}>Tanggal Bayar</label>
                              <input type="date" value={cicilanDate} onChange={e => setCicilanDate(e.target.value)}
                                style={{ width: '100%', border: '1px solid #e7e5e4', borderRadius: '6px', padding: '8px 10px', fontSize: '0.88rem', boxSizing: 'border-box' }} />
                            </div>
                            <div>
                              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#78716c', marginBottom: '4px' }}>Metode</label>
                              <select value={cicilanMethod} onChange={e => setCicilanMethod(e.target.value)}
                                style={{ width: '100%', border: '1px solid #e7e5e4', borderRadius: '6px', padding: '8px 10px', fontSize: '0.88rem', boxSizing: 'border-box' }}>
                                <option value="cash">Cash</option>
                                <option value="transfer">Transfer</option>
                                <option value="giro">Giro</option>
                                <option value="cek">Cek</option>
                              </select>
                            </div>
                            <div>
                              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#78716c', marginBottom: '4px' }}>No. Referensi</label>
                              <input type="text" placeholder="No. transfer / cek" value={cicilanRef} onChange={e => setCicilanRef(e.target.value)}
                                style={{ width: '100%', border: '1px solid #e7e5e4', borderRadius: '6px', padding: '8px 10px', fontSize: '0.88rem', boxSizing: 'border-box' }} />
                            </div>
                          </div>
                          <div style={{ marginBottom: '12px' }}>
                            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#78716c', marginBottom: '4px' }}>Catatan</label>
                            <input type="text" value={cicilanNotes} onChange={e => setCicilanNotes(e.target.value)}
                              style={{ width: '100%', border: '1px solid #e7e5e4', borderRadius: '6px', padding: '8px 10px', fontSize: '0.88rem', boxSizing: 'border-box' }} />
                          </div>
                          <div style={{ display: 'flex', gap: '8px' }}>
                            <button onClick={() => setShowAddCicilan(false)}
                              style={{ flex: 1, background: '#f5f5f4', border: 'none', borderRadius: '6px', padding: '10px', cursor: 'pointer', fontSize: '0.85rem' }}>
                              Batal
                            </button>
                            <button onClick={handleTambahCicilan} disabled={cicilanSaving}
                              style={{ flex: 2, background: '#b8860b', color: 'white', border: 'none', borderRadius: '6px', padding: '10px', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem' }}>
                              {cicilanSaving ? 'Menyimpan...' : '✓ Simpan Pembayaran'}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {piutang.status === 'paid' && (
                    <div style={{ textAlign: 'center', padding: '16px', background: '#f0fdf4', borderRadius: '8px', color: '#166534', fontWeight: 600 }}>
                      ✅ Piutang ini sudah LUNAS
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
