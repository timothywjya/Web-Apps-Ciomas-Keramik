'use client';
import { useState, useEffect, useCallback } from 'react';
import { useToast } from '@/lib/toast';
import { fetchJson, fetchJsonPost, getErrorMessage } from '@/lib/fetchJson';

type PaymentType = 'kredit' | 'tempo' | 'dp' | 'cash';

type Receivable = {
  id             : string;
  sale_id       ?: string;
  invoice_number : string;
  invoice_date   : string;
  due_date      ?: string;
  customer_name  : string;
  customer_phone?: string;
  customer_type ?: string;
  payment_type   : PaymentType;
  total_amount   : number;
  discount_amount: number;
  paid_amount    : number;
  outstanding    : number;
  status         : 'outstanding' | 'partial' | 'paid' | 'overdue';
  source        ?: 'auto' | 'manual';
  notes         ?: string;
};

type Payment = {
  id            : string;
  payment_date  : string;
  amount        : number;
  payment_method: string;
  bank_name    ?: string;
  reference_no ?: string;
  notes        ?: string;
};

type PayForm = {
  amount        : string;
  payment_date  : string;
  payment_method: string;
  bank_name     : string;
  reference_no  : string;
  notes         : string;
};

type ManualForm = {
  invoice_number : string;
  invoice_date   : string;
  customer_id    : string;
  due_date       : string;
  payment_type   : PaymentType;
  total_amount   : string;
  discount_amount: string;
  dp_amount      : string;   // DP yang langsung dicatat sebagai cicilan pertama
  notes          : string;
};

type Customer = { id: string; name: string; customer_type: string; };

type Summary = { total_outstanding: number; total_overdue: number; count: number };

export interface ReceivableListResponse {
  receivables: Receivable[];
}

export interface ReceivableSummaryResponse {
  summary: {
    total_outstanding: number;
    total_overdue: number;
    count: number;
  };
}

interface CreateReceivableResponse {
  receivable: Receivable; 
}

export interface ReceivableDetailResponse {
  receivable: Receivable; 
  payments: Payment[]; 
}

const rp = (n: number) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(n || 0);

const fmtDate = (d?: string) =>
  d ? new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(d)) : '—';

const today = () => new Date().toISOString().split('T')[0];

const STATUS_LABEL: Record<string, string> = {
  outstanding: 'Outstanding',
  partial    : 'Cicilan',
  paid       : 'Lunas',
  overdue    : 'Jatuh Tempo',
};

const STATUS_COLOR: Record<string, [string, string]> = {
  outstanding: ['#854d0e', '#fef9c3'],
  partial    : ['#1e40af', '#dbeafe'],
  paid       : ['#166534', '#dcfce7'],
  overdue    : ['#991b1b', '#fee2e2'],
};

const PAYMENT_TYPE_LABEL: Record<PaymentType, string> = {
  kredit: 'Kredit',
  tempo : 'Tempo',
  dp    : 'DP',
  cash  : 'Cash',
};

const PT_COLOR: Record<PaymentType, string> = {
  kredit: '#1e40af',
  tempo : '#7c3aed',
  dp    : '#c2410c',
  cash  : '#166534',
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function Badge({ status }: { status: string }) {
  const [color, bg] = STATUS_COLOR[status] ?? ['#57534e', '#f5f5f4'];
  return (
    <span style={{
      background: bg, color, padding: '2px 10px',
      borderRadius: '99px', fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.3px',
    }}>
      {STATUS_LABEL[status] ?? status}
    </span>
  );
}

function TypeBadge({ type }: { type: PaymentType }) {
  return (
    <span style={{
      background: PT_COLOR[type] + '18',
      color: PT_COLOR[type],
      padding: '2px 8px', borderRadius: '6px',
      fontSize: '0.7rem', fontWeight: 700,
    }}>
      {PAYMENT_TYPE_LABEL[type]}
    </span>
  );
}

function SummaryCard({ label, value, sub, color }: { label: string; value: string; sub: string; color: string }) {
  return (
    <div style={{ background: 'white', borderRadius: '12px', padding: '18px 22px', border: '1px solid #f0ece8', flex: 1, minWidth: '200px' }}>
      <div style={{ fontSize: '0.72rem', color: '#78716c', textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 600, marginBottom: '8px' }}>{label}</div>
      <div style={{ fontSize: '1.5rem', fontWeight: 700, color }}>{value}</div>
      <div style={{ fontSize: '0.75rem', color: '#a8a29e', marginTop: '4px' }}>{sub}</div>
    </div>
  );
}

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ fontSize: '0.75rem', color: '#57534e', display: 'block', marginBottom: '4px', fontWeight: 600 }}>
        {label}
      </label>
      {children}
    </div>
  );
}

const inp = (border = '#e7e5e4'): React.CSSProperties => ({
  width: '100%', border: `1.5px solid ${border}`,
  borderRadius: '8px', padding: '8px 10px', fontSize: '0.85rem',
  boxSizing: 'border-box', outline: 'none',
});


function ProgressBar({ paid, total, discount }: { paid: number; total: number; discount: number }) {
  const net = Math.max(0, total - discount);
  const pct = net > 0 ? Math.min(100, (paid / net) * 100) : 0;
  return (
    <div style={{ marginTop: '10px' }}>
      <div style={{ height: '6px', background: '#f0ece8', borderRadius: '99px', overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: pct >= 100 ? '#16a34a' : '#d4a843', borderRadius: '99px', transition: 'width 0.4s' }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: '#a8a29e', marginTop: '4px' }}>
        <span>{rp(paid)} dibayar</span>
        <span>{Math.round(pct)}% lunas</span>
      </div>
    </div>
  );
} 

export default function ReceivablesPage() {
  const toast = useToast();
  const [list,         setList]         = useState<Receivable[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [search,       setSearch]       = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter,   setTypeFilter]   = useState('');
  const [sourceFilter, setSourceFilter] = useState('');
  const [summary,      setSummary]      = useState<Summary>({ total_outstanding: 0, total_overdue: 0, count: 0 });
  const [customers,    setCustomers]    = useState<Customer[]>([]);

  const [detail,      setDetail]      = useState<{ recv: Receivable; payments: Payment[] } | null>(null);
  const [payForm,     setPayForm]     = useState<PayForm>({
    amount: '', payment_date: today(), payment_method: 'cash',
    bank_name: '', reference_no: '', notes: '',
  });
  const [discountVal, setDiscountVal] = useState('');
  const [saving,      setSaving]      = useState(false);
  const [error,       setError]       = useState('');

  const [showManual, setShowManual] = useState(false);
  const [manualForm, setManualForm] = useState<ManualForm>({
    invoice_number: '', invoice_date: today(), customer_id: '',
    due_date: '', payment_type: 'cash', total_amount: '',
    discount_amount: '', dp_amount: '', notes: '',
  });
  const [manualSaving, setManualSaving] = useState(false);
  const [manualError,  setManualError]  = useState('');

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const p = new URLSearchParams();
      if (search)       p.set('search', search);
      if (statusFilter) p.set('status', statusFilter);
      if (typeFilter)   p.set('payment_type', typeFilter);
      if (sourceFilter) p.set('source', sourceFilter);

      const response = await fetchJson<ReceivableListResponse>(`/api/receivables?${p.toString()}`);
      setList(response.receivables ?? []);
    } catch (err) {
      console.error("Fetch Error:", err);
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, typeFilter, sourceFilter]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  async function openDetail(id: string) {
    setError('');
    try {
      const r = await fetchJson<ReceivableDetailResponse>(`/api/receivables/${id}`);
      
      if (!r.receivable) return;

      setDetail({ 
        recv: r.receivable, 
        payments: r.payments ?? [] 
      });

      setDiscountVal(String(r.receivable.discount_amount));
      setPayForm(p => ({ 
        ...p, 
        amount: '', 
        bank_name: '', 
        reference_no: '', 
        notes: '' 
      }));
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal memuat detail piutang');
    }
  }

  async function handlePayment() {
    if (!detail || !payForm.amount) return;
    setSaving(true); 
    setError('');
    
    try {
      const result = await fetchJsonPost<{ 
        receivable: Receivable; 
        payment: Payment 
      }>(`/api/receivables/${detail.recv.id}`, {
        amount: parseFloat(payForm.amount), 
        payment_date: payForm.payment_date,
        payment_method: payForm.payment_method, 
        bank_name: payForm.bank_name || null,
        reference_no: payForm.reference_no || null, 
        notes: payForm.notes || null,
      });

      // Update state using the validated 'result' object
      setDetail({ 
        recv: result.receivable, 
        payments: [...detail.payments, result.payment] 
      });

      setPayForm(p => ({ ...p, amount: '', bank_name: '', reference_no: '', notes: '' }));
      
      // Refresh the main list to update statuses/totals
      fetchAll();
    } catch (err) { 
      setError(getErrorMessage(err, 'Gagal menyimpan')); 
    } finally { 
      setSaving(false); 
    }
  }

  async function handleDiscount() {
    if (!detail) return;
    setSaving(true); setError('');
    try {
      const json = await fetchJsonPost<{ receivable?: unknown; success?: boolean }>(`/api/receivables/${detail.recv.id}`, { discount_amount: parseFloat(discountVal) || 0 }, 'PATCH');
      setDetail(d => d ? { ...d, recv: json.receivable as never } : null);
      fetchAll();
    } catch (err) { setError(getErrorMessage(err, 'Gagal')); }
    finally     { setSaving(false); }
  }

  async function handleManualCreate() {
    if (!manualForm.invoice_number) { setManualError('No. Invoice wajib diisi'); return; }
    if (!manualForm.total_amount || parseFloat(manualForm.total_amount) <= 0) {
      setManualError('Total tagihan harus lebih dari 0');
      return;
    }

    const manualPayload = {
      invoice_number: manualForm.invoice_number,
      invoice_date: manualForm.invoice_date,
      customer_id: manualForm.customer_id,
      due_date: manualForm.due_date,
      payment_type: manualForm.payment_type,
      total_amount: parseFloat(manualForm.total_amount),
      discount_amount: parseFloat(manualForm.discount_amount || '0'),
      notes: manualForm.notes,
    };

    setManualSaving(true); 
    setManualError('');

    try {
      const json = await fetchJsonPost<CreateReceivableResponse>('/api/receivables', manualPayload);

      const dpAmt = parseFloat(manualForm.dp_amount || '0');
      
      if (dpAmt > 0 && json.receivable?.id) {
        await fetchJsonPost(`/api/receivables/${json.receivable.id}`, {
          amount: dpAmt,
          payment_date: manualForm.invoice_date,
          payment_method: 'cash',
          notes: 'DP / Uang Muka (dicatat saat buat piutang)',
        });
      }

      setShowManual(false);
      setManualForm({
        invoice_number: '', 
        invoice_date: today(), 
        customer_id: '',
        due_date: '', 
        payment_type: 'cash', 
        total_amount: '',
        discount_amount: '', 
        dp_amount: '', 
        notes: '',
      });
      fetchAll();
    } catch (err) { 
      setManualError(getErrorMessage(err, 'Gagal menyimpan piutang')); 
    } finally { 
      setManualSaving(false); 
    }
  }

  const isOverdue   = (r: Receivable) =>
    !!r.due_date && new Date(r.due_date) < new Date() && r.status !== 'paid';
  const showBankField = payForm.payment_method === 'transfer';

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <div style={{ padding: '32px 28px' }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '2.2rem', fontWeight: 600, color: '#1c1917' }}>
            Piutang
          </h1>
          <p style={{ color: '#78716c', marginTop: '4px', fontSize: '0.88rem' }}>
            Tagihan ke Customer — muncul otomatis dari Penjualan (Kredit / Tempo / DP) atau entri manual
          </p>
        </div>
        <button
          onClick={() => { setShowManual(true); setManualError(''); }}
          style={{ background: '#1c1917', color: '#d4a843', border: 'none', borderRadius: '9px', padding: '10px 18px', fontWeight: 700, cursor: 'pointer', fontSize: '0.85rem' }}>
          + Tambah Manual
        </button>
      </div>

      {/* Banner info alur otomatis */}
      <div style={{
        background: 'linear-gradient(135deg, #fef9c3 0%, #fef3c7 100%)',
        border: '1px solid #fde68a', borderRadius: '12px',
        padding: '14px 18px', marginBottom: '20px',
        display: 'flex', alignItems: 'flex-start', gap: '12px',
      }}>
        <span style={{ fontSize: '1.2rem', flexShrink: 0 }}>⚡</span>
        <div style={{ fontSize: '0.83rem', color: '#78350f', lineHeight: 1.6 }}>
          <strong>Alur Otomatis:</strong> Setiap Penjualan dengan metode <strong>Kredit</strong> atau <strong>Tempo</strong>{' '}
          akan langsung membuat entri Piutang di halaman ini. Untuk Penjualan tunai dengan <strong>DP (Uang Muka)</strong>,
          buat piutang manual dengan tipe DP lalu catat cicilan DP-nya.
        </div>
      </div>

      {/* Summary cards */}
      <div style={{ display: 'flex', gap: '14px', marginBottom: '24px', flexWrap: 'wrap' }}>
        <SummaryCard
          label="Total Piutang Aktif"
          value={rp(summary.total_outstanding)}
          sub={`${summary.count} invoice belum lunas`}
          color="#1c1917"
        />
        <SummaryCard
          label="Sudah Jatuh Tempo"
          value={rp(summary.total_overdue)}
          sub="Perlu segera ditagih"
          color="#c44223"
        />
        <SummaryCard
          label="Total Invoice"
          value={String(list.length)}
          sub="Ditampilkan sesuai filter"
          color="#78716c"
        />
      </div>

      {/* Filters */}
      <div style={{ background: 'white', borderRadius: '12px', padding: '14px 18px', marginBottom: '18px', border: '1px solid #f0ece8', display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
        <input
          style={{ flex: 1, minWidth: '180px', border: '1.5px solid #e7e5e4', borderRadius: '8px', padding: '8px 12px', fontSize: '0.85rem' }}
          placeholder="Cari invoice, nama customer..."
          value={search} onChange={e => setSearch(e.target.value)}
        />
        <select
          style={{ border: '1.5px solid #e7e5e4', borderRadius: '8px', padding: '8px 12px', fontSize: '0.85rem' }}
          value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="">Semua Status</option>
          <option value="outstanding">Outstanding</option>
          <option value="partial">Cicilan</option>
          <option value="overdue">Jatuh Tempo</option>
          <option value="paid">Lunas</option>
        </select>
        <select
          style={{ border: '1.5px solid #e7e5e4', borderRadius: '8px', padding: '8px 12px', fontSize: '0.85rem' }}
          value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
          <option value="">Semua Tipe</option>
          <option value="kredit">Kredit</option>
          <option value="tempo">Tempo</option>
          <option value="dp">DP</option>
          <option value="cash">Cash</option>
        </select>
        <select
          style={{ border: '1.5px solid #e7e5e4', borderRadius: '8px', padding: '8px 12px', fontSize: '0.85rem' }}
          value={sourceFilter} onChange={e => setSourceFilter(e.target.value)}>
          <option value="">Auto + Manual</option>
          <option value="auto">Otomatis (dari Penjualan)</option>
          <option value="manual">Manual</option>
        </select>
        <span style={{ fontSize: '0.8rem', color: '#a8a29e', marginLeft: 'auto' }}>{list.length} data</span>
      </div>

      {/* Table */}
      <div style={{ background: 'white', borderRadius: '14px', border: '1px solid #f0ece8', overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['Invoice', 'Sumber', 'Customer', 'Tipe', 'Jatuh Tempo', 'Total', 'Dibayar', 'Outstanding', 'Status', ''].map(h => (
                  <th key={h} style={{
                    background: '#1c1917', color: '#d4a843', padding: '10px 12px',
                    whiteSpace: 'nowrap', fontSize: '0.72rem', fontWeight: 700,
                    textTransform: 'uppercase', letterSpacing: '0.5px',
                    textAlign: ['Total', 'Dibayar', 'Outstanding'].includes(h) ? 'right' : 'left',
                  }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={10} style={{ textAlign: 'center', padding: '48px', color: '#a8a29e' }}>
                  <div style={{ fontSize: '1.5rem', marginBottom: '8px' }}>⏳</div>Memuat data piutang...
                </td></tr>
              ) : list.length === 0 ? (
                <tr><td colSpan={10} style={{ textAlign: 'center', padding: '48px', color: '#a8a29e' }}>
                  <div style={{ fontSize: '1.5rem', marginBottom: '8px' }}>📋</div>Tidak ada data piutang
                </td></tr>
              ) : list.map(r => (
                <tr key={r.id} onClick={() => openDetail(r.id)}
                  style={{
                    borderBottom: '1px solid #f5f5f4', cursor: 'pointer',
                    background: isOverdue(r) ? '#fffbf5' : 'white',
                    transition: 'background 0.15s',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = isOverdue(r) ? '#fff7ed' : '#fafaf9')}
                  onMouseLeave={e => (e.currentTarget.style.background = isOverdue(r) ? '#fffbf5' : 'white')}
                >
                  <td style={{ padding: '10px 12px' }}>
                    <div style={{ fontFamily: 'monospace', fontSize: '0.82rem', fontWeight: 700, color: '#1c1917' }}>{r.invoice_number}</div>
                    <div style={{ fontSize: '0.72rem', color: '#a8a29e', marginTop: '1px' }}>{fmtDate(r.invoice_date)}</div>
                  </td>
                  <td style={{ padding: '10px 12px' }}>
                    <span style={{
                      background: r.source === 'auto' ? '#dbeafe' : '#f5f5f4',
                      color: r.source === 'auto' ? '#1e40af' : '#57534e',
                      padding: '2px 8px', borderRadius: '6px', fontSize: '0.7rem', fontWeight: 600,
                    }}>
                      {r.source === 'auto' ? '⚡ Auto' : '✏️ Manual'}
                    </span>
                  </td>
                  <td style={{ padding: '10px 12px', fontSize: '0.85rem' }}>
                    <div>{r.customer_name || '—'}</div>
                    {r.customer_phone && <div style={{ fontSize: '0.72rem', color: '#a8a29e' }}>{r.customer_phone}</div>}
                  </td>
                  <td style={{ padding: '10px 12px' }}>
                    <TypeBadge type={r.payment_type} />
                  </td>
                  <td style={{ padding: '10px 12px', fontSize: '0.82rem', color: isOverdue(r) ? '#c44223' : '#57534e', fontWeight: isOverdue(r) ? 700 : 400 }}>
                    {fmtDate(r.due_date)}
                    {isOverdue(r) && <div style={{ fontSize: '0.7rem', color: '#c44223' }}>⚠ Jatuh Tempo</div>}
                  </td>
                  <td style={{ padding: '10px 12px', textAlign: 'right', fontSize: '0.82rem', fontWeight: 600 }}>{rp(r.total_amount)}</td>
                  <td style={{ padding: '10px 12px', textAlign: 'right', fontSize: '0.82rem', color: '#16a34a', fontWeight: 600 }}>{rp(r.paid_amount)}</td>
                  <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: r.outstanding > 0 ? '#c44223' : '#166534' }}>{rp(r.outstanding)}</td>
                  <td style={{ padding: '10px 12px' }}><Badge status={r.status} /></td>
                  <td style={{ padding: '10px 12px' }}>
                    <button
                      onClick={e => { e.stopPropagation(); openDetail(r.id); }}
                      style={{ background: 'none', border: '1px solid #e7e5e4', borderRadius: '6px', padding: '4px 10px', fontSize: '0.75rem', cursor: 'pointer', color: '#1c1917', fontWeight: 600 }}>
                      Detail
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {detail && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}
          onClick={e => { if (e.target === e.currentTarget) setDetail(null); }}>
          <div style={{ background: 'white', borderRadius: '18px', width: '100%', maxWidth: '680px', maxHeight: '90vh', overflowY: 'auto', padding: '28px' }}>

            {/* Modal header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
                  <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '1.6rem', fontWeight: 600, color: '#1c1917' }}>
                    {detail.recv.invoice_number}
                  </div>
                  <TypeBadge type={detail.recv.payment_type} />
                  {detail.recv.source === 'auto'
                    ? <span style={{ background: '#dbeafe', color: '#1e40af', padding: '2px 8px', borderRadius: '6px', fontSize: '0.7rem', fontWeight: 600 }}>⚡ Auto dari Penjualan</span>
                    : <span style={{ background: '#f5f5f4', color: '#57534e', padding: '2px 8px', borderRadius: '6px', fontSize: '0.7rem', fontWeight: 600 }}>✏️ Manual</span>
                  }
                </div>
                <div style={{ fontSize: '0.85rem', color: '#78716c' }}>
                  {detail.recv.customer_name || 'Tanpa Customer'}
                  {detail.recv.due_date && (
                    <span style={{ marginLeft: '10px', fontSize: '0.8rem', color: isOverdue(detail.recv) ? '#c44223' : '#78716c' }}>
                      · Jatuh Tempo: {fmtDate(detail.recv.due_date)}
                      {isOverdue(detail.recv) && ' ⚠'}
                    </span>
                  )}
                </div>
              </div>
              <button onClick={() => setDetail(null)} style={{ background: 'none', border: 'none', fontSize: '1.3rem', cursor: 'pointer', color: '#78716c' }}>✕</button>
            </div>

            {/* Summary 3 boxes */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '10px', marginBottom: '18px' }}>
              {[
                { l: 'Total Tagihan', v: rp(detail.recv.total_amount),  c: '#1c1917' },
                { l: 'Sudah Dibayar', v: rp(detail.recv.paid_amount),   c: '#16a34a' },
                { l: 'Sisa Tagihan',  v: rp(detail.recv.outstanding),   c: '#c44223' },
              ].map(s => (
                <div key={s.l} style={{ background: '#fafaf9', borderRadius: '9px', padding: '14px', textAlign: 'center', border: '1px solid #f0ece8' }}>
                  <div style={{ fontSize: '0.72rem', color: '#78716c', marginBottom: '6px', fontWeight: 600 }}>{s.l}</div>
                  <div style={{ fontWeight: 700, color: s.c, fontSize: '1.05rem' }}>{s.v}</div>
                </div>
              ))}
            </div>

            {/* Progress */}
            <ProgressBar
              paid={detail.recv.paid_amount}
              total={detail.recv.total_amount}
              discount={detail.recv.discount_amount}
            />

            {/* Diskon */}
            <div style={{ background: '#fafaf9', borderRadius: '10px', padding: '14px 16px', marginTop: '16px', marginBottom: '16px', border: '1px solid #f0ece8' }}>
              <div style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: '#78716c', marginBottom: '10px' }}>
                Diskon Tagihan
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input type="number" value={discountVal}
                  onChange={e => setDiscountVal(e.target.value)}
                  disabled={detail.recv.status === 'paid'} placeholder="0"
                  style={{ flex: 1, border: '1.5px solid #e7e5e4', borderRadius: '8px', padding: '8px 12px', fontSize: '0.85rem' }} />
                <button onClick={handleDiscount} disabled={saving || detail.recv.status === 'paid'}
                  style={{ background: '#1c1917', color: '#d4a843', border: 'none', borderRadius: '8px', padding: '8px 16px', fontWeight: 700, cursor: 'pointer', fontSize: '0.82rem', opacity: detail.recv.status === 'paid' ? 0.5 : 1 }}>
                  Simpan
                </button>
              </div>
            </div>

            {/* Riwayat cicilan */}
            <div style={{ marginBottom: '18px' }}>
              <div style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: '#78716c', marginBottom: '10px' }}>
                Riwayat Cicilan & DP ({detail.payments.length} pembayaran)
              </div>
              {detail.payments.length === 0 ? (
                <div style={{ textAlign: 'center', color: '#a8a29e', padding: '20px', background: '#fafaf9', borderRadius: '8px', fontSize: '0.85rem', border: '1px solid #f0ece8' }}>
                  Belum ada pembayaran masuk
                </div>
              ) : (
                <div style={{ border: '1px solid #f0ece8', borderRadius: '10px', overflow: 'hidden' }}>
                  {detail.payments.map((p, i) => (
                    <div key={p.id} style={{ padding: '11px 14px', borderBottom: i < detail.payments.length - 1 ? '1px solid #f5f5f4' : 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: '0.92rem', color: '#166534' }}>{rp(p.amount)}</div>
                        <div style={{ fontSize: '0.75rem', color: '#78716c', marginTop: '2px' }}>
                          {fmtDate(p.payment_date)} · {p.payment_method.toUpperCase()}
                          {p.bank_name    && <span style={{ marginLeft: '6px', color: '#1e40af' }}>🏦 {p.bank_name}</span>}
                          {p.reference_no && <span style={{ marginLeft: '6px', fontFamily: 'monospace' }}>#{p.reference_no}</span>}
                        </div>
                        {p.notes && <div style={{ fontSize: '0.72rem', color: '#a8a29e', marginTop: '2px' }}>{p.notes}</div>}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#a8a29e', background: '#f5f5f4', borderRadius: '99px', padding: '2px 10px', whiteSpace: 'nowrap', flexShrink: 0 }}>
                        {i === 0 && detail.recv.payment_type === 'dp' ? '💰 DP' : `Cicilan #${i + 1}`}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Form tambah cicilan */}
            {detail.recv.status !== 'paid' ? (
              <div style={{ background: '#f0fdf4', borderRadius: '12px', padding: '18px', border: '1px solid #bbf7d0' }}>
                <div style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: '#166534', marginBottom: '14px' }}>
                  + Catat Pembayaran / Cicilan
                </div>
                {error && (
                  <div style={{ background: '#fee2e2', color: '#dc2626', borderRadius: '8px', padding: '9px 12px', fontSize: '0.82rem', marginBottom: '12px' }}>
                    ⚠ {error}
                  </div>
                )}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '12px' }}>
                  <FieldRow label="Jumlah (Rp)">
                    <input type="number" value={payForm.amount}
                      onChange={e => setPayForm(p => ({ ...p, amount: e.target.value }))}
                      placeholder={`Maks: ${rp(detail.recv.outstanding)}`}
                      style={inp('#bbf7d0')} />
                  </FieldRow>
                  <FieldRow label="Tanggal Bayar">
                    <input type="date" value={payForm.payment_date}
                      onChange={e => setPayForm(p => ({ ...p, payment_date: e.target.value }))}
                      style={inp('#bbf7d0')} />
                  </FieldRow>
                  <FieldRow label="Metode Bayar">
                    <select value={payForm.payment_method}
                      onChange={e => setPayForm(p => ({ ...p, payment_method: e.target.value }))}
                      style={inp('#bbf7d0')}>
                      <option value="cash">Cash</option>
                      <option value="transfer">Transfer Bank</option>
                      <option value="giro">Giro</option>
                      <option value="cek">Cek</option>
                    </select>
                  </FieldRow>
                  <FieldRow label="No. Referensi">
                    <input value={payForm.reference_no}
                      onChange={e => setPayForm(p => ({ ...p, reference_no: e.target.value }))}
                      placeholder="No. transfer / cek / giro"
                      style={inp('#bbf7d0')} />
                  </FieldRow>
                  {showBankField && (
                    <FieldRow label="Nama Bank Pengirim">
                      <input value={payForm.bank_name}
                        onChange={e => setPayForm(p => ({ ...p, bank_name: e.target.value }))}
                        placeholder="BCA, Mandiri, BRI, BNI..."
                        style={inp('#bbf7d0')} />
                    </FieldRow>
                  )}
                  <FieldRow label="Catatan">
                    <input value={payForm.notes}
                      onChange={e => setPayForm(p => ({ ...p, notes: e.target.value }))}
                      placeholder="Opsional"
                      style={inp('#bbf7d0')} />
                  </FieldRow>
                </div>
                <button onClick={handlePayment} disabled={saving || !payForm.amount}
                  style={{ width: '100%', background: '#166534', color: 'white', border: 'none', borderRadius: '9px', padding: '12px', fontWeight: 700, cursor: saving || !payForm.amount ? 'not-allowed' : 'pointer', fontSize: '0.9rem', opacity: saving || !payForm.amount ? 0.6 : 1 }}>
                  {saving ? '⏳ Menyimpan...' : '✓ Catat Pembayaran'}
                </button>
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '18px', background: '#f0fdf4', borderRadius: '10px', border: '1px solid #bbf7d0' }}>
                <div style={{ fontSize: '1.5rem', marginBottom: '4px' }}>✅</div>
                <div style={{ fontWeight: 700, color: '#166534' }}>Piutang Lunas</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══ MODAL TAMBAH MANUAL ════════════════════════════════════════════════ */}
      {showManual && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}
          onClick={e => { if (e.target === e.currentTarget) setShowManual(false); }}>
          <div style={{ background: 'white', borderRadius: '18px', width: '100%', maxWidth: '580px', maxHeight: '90vh', overflowY: 'auto', padding: '28px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '1.4rem', fontWeight: 600, color: '#1c1917' }}>
                Tambah Piutang Manual
              </div>
              <button onClick={() => setShowManual(false)} style={{ background: 'none', border: 'none', fontSize: '1.3rem', cursor: 'pointer', color: '#78716c' }}>✕</button>
            </div>
            <p style={{ fontSize: '0.8rem', color: '#a8a29e', marginBottom: '18px' }}>
              Gunakan ini untuk piutang yang tidak muncul dari Penjualan otomatis (misalnya: DP tunai, pinjaman internal, dsb.)
            </p>

            {manualError && (
              <div style={{ background: '#fee2e2', color: '#dc2626', borderRadius: '8px', padding: '9px 12px', fontSize: '0.82rem', marginBottom: '14px' }}>
                ⚠ {manualError}
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
              <FieldRow label="No. Invoice *">
                <input value={manualForm.invoice_number}
                  onChange={e => setManualForm(f => ({ ...f, invoice_number: e.target.value }))}
                  placeholder="INV-XXXX" style={inp()} />
              </FieldRow>
              <FieldRow label="Tanggal Invoice *">
                <input type="date" value={manualForm.invoice_date}
                  onChange={e => setManualForm(f => ({ ...f, invoice_date: e.target.value }))}
                  style={inp()} />
              </FieldRow>
              <div style={{ gridColumn: '1 / -1' }}>
                <FieldRow label="Customer">
                  <select value={manualForm.customer_id}
                    onChange={e => setManualForm(f => ({ ...f, customer_id: e.target.value }))}
                    style={inp()}>
                    <option value="">— Tanpa Customer —</option>
                    {customers.map(c => (
                      <option key={c.id} value={c.id}>{c.name} ({c.customer_type})</option>
                    ))}
                  </select>
                </FieldRow>
              </div>
              <FieldRow label="Tipe Piutang *">
                <select value={manualForm.payment_type}
                  onChange={e => setManualForm(f => ({ ...f, payment_type: e.target.value as PaymentType }))}
                  style={inp()}>
                  <option value="cash">Cash</option>
                  <option value="dp">DP (Uang Muka)</option>
                  <option value="kredit">Kredit</option>
                  <option value="tempo">Tempo</option>
                </select>
              </FieldRow>
              <FieldRow label="Jatuh Tempo">
                <input type="date" value={manualForm.due_date}
                  onChange={e => setManualForm(f => ({ ...f, due_date: e.target.value }))}
                  style={inp()} />
              </FieldRow>
              <FieldRow label="Total Tagihan (Rp) *">
                <input type="number" value={manualForm.total_amount}
                  onChange={e => setManualForm(f => ({ ...f, total_amount: e.target.value }))}
                  placeholder="0" style={inp()} />
              </FieldRow>
              <FieldRow label="Diskon (Rp)">
                <input type="number" value={manualForm.discount_amount}
                  onChange={e => setManualForm(f => ({ ...f, discount_amount: e.target.value }))}
                  placeholder="0" style={inp()} />
              </FieldRow>
            </div>

            {/* DP section */}
            <div style={{ background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: '10px', padding: '14px', marginBottom: '14px' }}>
              <div style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', color: '#c2410c', marginBottom: '8px' }}>
                💰 DP / Uang Muka (Opsional)
              </div>
              <FieldRow label="Jumlah DP yang Sudah Diterima">
                <input type="number" value={manualForm.dp_amount}
                  onChange={e => setManualForm(f => ({ ...f, dp_amount: e.target.value }))}
                  placeholder="0 — kosongkan jika belum ada DP"
                  style={inp('#fed7aa')} />
              </FieldRow>
              <div style={{ fontSize: '0.75rem', color: '#92400e', marginTop: '6px' }}>
                DP akan otomatis dicatat sebagai cicilan pertama dengan tanggal invoice
              </div>
            </div>

            <FieldRow label="Catatan">
              <input value={manualForm.notes}
                onChange={e => setManualForm(f => ({ ...f, notes: e.target.value }))}
                placeholder="Opsional" style={{ ...inp(), marginBottom: '16px' }} />
            </FieldRow>

            <button onClick={handleManualCreate}
              disabled={manualSaving || !manualForm.invoice_number || !manualForm.total_amount}
              style={{ width: '100%', background: '#1c1917', color: '#d4a843', border: 'none', borderRadius: '9px', padding: '12px', fontWeight: 700, cursor: 'pointer', fontSize: '0.9rem', opacity: manualSaving ? 0.6 : 1 }}>
              {manualSaving ? '⏳ Menyimpan...' : '✓ Simpan Piutang'}
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
