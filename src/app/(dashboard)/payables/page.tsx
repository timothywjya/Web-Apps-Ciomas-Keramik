'use client';
import { useState, useEffect, useCallback } from 'react';

// =============================================================================
// Hutang — Kewajiban Ciomas Keramik ke Supplier
// Sumber:
//   1. AUTO  → Purchase Order (PO) — muncul otomatis setiap PO dibuat
//   2. MANUAL → Rekapan pribadi tanpa PO di sistem
// =============================================================================

// ─── Types ────────────────────────────────────────────────────────────────────

type Payable = {
  id             : string;
  purchase_id   ?: string;
  po_number      : string;
  po_date        : string;
  due_date      ?: string;
  supplier_name  : string;
  supplier_phone?: string;
  ref_number    ?: string;
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
  po_number      : string;
  po_date        : string;
  supplier_id    : string;
  due_date       : string;
  ref_number     : string;
  total_amount   : string;
  discount_amount: string;
  dp_amount      : string;
  notes          : string;
};

type Supplier = { id: string; name: string; phone?: string; city?: string; };

type Summary = { total_outstanding: number; total_overdue: number; count: number };

// ─── Helpers ──────────────────────────────────────────────────────────────────

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
        <div style={{ height: '100%', width: `${pct}%`, background: pct >= 100 ? '#16a34a' : '#f59e0b', borderRadius: '99px', transition: 'width 0.4s' }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: '#a8a29e', marginTop: '4px' }}>
        <span>{rp(paid)} dibayar</span>
        <span>{Math.round(pct)}% lunas</span>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function PayablesPage() {
  const [list,         setList]         = useState<Payable[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [search,       setSearch]       = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [sourceFilter, setSourceFilter] = useState('');
  const [summary,      setSummary]      = useState<Summary>({ total_outstanding: 0, total_overdue: 0, count: 0 });
  const [suppliers,    setSuppliers]    = useState<Supplier[]>([]);

  const [detail,      setDetail]      = useState<{ pay: Payable; payments: Payment[] } | null>(null);
  const [payForm,     setPayForm]     = useState<PayForm>({
    amount: '', payment_date: today(), payment_method: 'transfer',
    bank_name: '', reference_no: '', notes: '',
  });
  const [discountVal, setDiscountVal] = useState('');
  const [saving,      setSaving]      = useState(false);
  const [error,       setError]       = useState('');

  const [showManual,   setShowManual]   = useState(false);
  const [manualForm,   setManualForm]   = useState<ManualForm>({
    po_number: '', po_date: today(), supplier_id: '',
    due_date: '', ref_number: '', total_amount: '',
    discount_amount: '', dp_amount: '', notes: '',
  });
  const [manualSaving, setManualSaving] = useState(false);
  const [manualError,  setManualError]  = useState('');

  // ── Fetch Suppliers ─────────────────────────────────────────────────────────
  useEffect(() => {
    fetch('/api/suppliers').then(r => r.json()).then(d => setSuppliers(d.suppliers ?? []));
  }, []);

  // ── Fetch Hutang List ───────────────────────────────────────────────────────
  const fetchAll = useCallback(async () => {
    setLoading(true);
    const p = new URLSearchParams();
    if (search)       p.set('search', search);
    if (statusFilter) p.set('status', statusFilter);
    if (sourceFilter) p.set('source', sourceFilter);
    const [r1, r2] = await Promise.all([
      fetch(`/api/payables?${p}`).then(r => r.json()),
      fetch('/api/payables?summary=1').then(r => r.json()),
    ]);
    setList(r1.payables ?? []);
    setSummary(r2.summary ?? { total_outstanding: 0, total_overdue: 0, count: 0 });
    setLoading(false);
  }, [search, statusFilter, sourceFilter]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // ── Open Detail ─────────────────────────────────────────────────────────────
  async function openDetail(id: string) {
    setError('');
    const r = await fetch(`/api/payables/${id}`).then(r => r.json());
    if (!r.payable) return;
    setDetail({ pay: r.payable, payments: r.payments ?? [] });
    setDiscountVal(String(r.payable.discount_amount));
    setPayForm(p => ({ ...p, amount: '', bank_name: '', reference_no: '', notes: '' }));
  }

  // ── Catat Pembayaran ke Supplier ────────────────────────────────────────────
  async function handlePayment() {
    if (!detail || !payForm.amount) return;
    setSaving(true); setError('');
    try {
      const res  = await fetch(`/api/payables/${detail.pay.id}`, {
        method : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body   : JSON.stringify({ ...payForm, amount: parseFloat(payForm.amount) }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setDetail({ pay: json.payable, payments: [...detail.payments, json.payment] });
      setPayForm(p => ({ ...p, amount: '', bank_name: '', reference_no: '', notes: '' }));
      fetchAll();
    } catch (e) { setError(e instanceof Error ? e.message : 'Gagal menyimpan'); }
    finally     { setSaving(false); }
  }

  // ── Update Diskon ───────────────────────────────────────────────────────────
  async function handleDiscount() {
    if (!detail) return;
    setSaving(true); setError('');
    try {
      const res  = await fetch(`/api/payables/${detail.pay.id}`, {
        method : 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body   : JSON.stringify({ discount_amount: parseFloat(discountVal) || 0 }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setDetail(d => d ? { ...d, pay: json.payable } : null);
      fetchAll();
    } catch (e) { setError(e instanceof Error ? e.message : 'Gagal'); }
    finally     { setSaving(false); }
  }

  // ── Manual Entry ────────────────────────────────────────────────────────────
  async function handleManualCreate() {
    if (!manualForm.po_number) { setManualError('No. Referensi wajib diisi'); return; }
    if (!manualForm.total_amount || parseFloat(manualForm.total_amount) <= 0) {
      setManualError('Total hutang harus lebih dari 0');
      return;
    }
    setManualSaving(true); setManualError('');
    try {
      const res  = await fetch('/api/payables', {
        method : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body   : JSON.stringify({
          po_number      : manualForm.po_number,
          po_date        : manualForm.po_date,
          supplier_id    : manualForm.supplier_id    || undefined,
          due_date       : manualForm.due_date        || undefined,
          ref_number     : manualForm.ref_number      || undefined,
          total_amount   : parseFloat(manualForm.total_amount),
          discount_amount: parseFloat(manualForm.discount_amount || '0'),
          notes          : manualForm.notes,
          source         : 'manual',
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);

      // Jika ada DP / uang muka, langsung catat sebagai cicilan pertama
      const dpAmt = parseFloat(manualForm.dp_amount || '0');
      if (dpAmt > 0 && json.payable?.id) {
        await fetch(`/api/payables/${json.payable.id}`, {
          method : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body   : JSON.stringify({
            amount        : dpAmt,
            payment_date  : manualForm.po_date,
            payment_method: 'transfer',
            notes         : 'DP / Cicilan Awal (dicatat saat buat hutang)',
          }),
        });
      }

      setShowManual(false);
      setManualForm({
        po_number: '', po_date: today(), supplier_id: '',
        due_date: '', ref_number: '', total_amount: '',
        discount_amount: '', dp_amount: '', notes: '',
      });
      fetchAll();
    } catch (e) { setManualError(e instanceof Error ? e.message : 'Gagal'); }
    finally     { setManualSaving(false); }
  }

  const isOverdue   = (p: Payable) =>
    !!p.due_date && new Date(p.due_date) < new Date() && p.status !== 'paid';
  const showBankField = payForm.payment_method === 'transfer';

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <div style={{ padding: '32px 28px' }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '2.2rem', fontWeight: 600, color: '#1c1917' }}>
            Hutang
          </h1>
          <p style={{ color: '#78716c', marginTop: '4px', fontSize: '0.88rem' }}>
            Kewajiban Ciomas ke Supplier — muncul otomatis dari setiap Pembelian (PO) atau entri manual
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
        background: 'linear-gradient(135deg, #fff7ed 0%, #fef3c7 100%)',
        border: '1px solid #fed7aa', borderRadius: '12px',
        padding: '14px 18px', marginBottom: '20px',
        display: 'flex', alignItems: 'flex-start', gap: '12px',
      }}>
        <span style={{ fontSize: '1.2rem', flexShrink: 0 }}>⚡</span>
        <div style={{ fontSize: '0.83rem', color: '#78350f', lineHeight: 1.6 }}>
          <strong>Alur Otomatis:</strong> Setiap kali <strong>Pembelian (PO)</strong> dibuat,
          sistem langsung membuat entri Hutang ke Supplier di halaman ini secara otomatis.
          Entri manual hanya diperlukan untuk hutang di luar sistem PO (pembelian tunai, pinjaman, dll.)
        </div>
      </div>

      {/* Summary cards */}
      <div style={{ display: 'flex', gap: '14px', marginBottom: '24px', flexWrap: 'wrap' }}>
        <SummaryCard
          label="Total Hutang Aktif"
          value={rp(summary.total_outstanding)}
          sub={`${summary.count} PO belum lunas`}
          color="#1c1917"
        />
        <SummaryCard
          label="Sudah Jatuh Tempo"
          value={rp(summary.total_overdue)}
          sub="Perlu segera dibayar ke supplier"
          color="#c44223"
        />
        <SummaryCard
          label="Total Entri"
          value={String(list.length)}
          sub="Ditampilkan sesuai filter"
          color="#78716c"
        />
      </div>

      {/* Filters */}
      <div style={{ background: 'white', borderRadius: '12px', padding: '14px 18px', marginBottom: '18px', border: '1px solid #f0ece8', display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
        <input
          style={{ flex: 1, minWidth: '180px', border: '1.5px solid #e7e5e4', borderRadius: '8px', padding: '8px 12px', fontSize: '0.85rem' }}
          placeholder="Cari No. PO, nama supplier..."
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
          value={sourceFilter} onChange={e => setSourceFilter(e.target.value)}>
          <option value="">Auto + Manual</option>
          <option value="auto">Otomatis (dari PO)</option>
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
                {['No. PO / Ref', 'Sumber', 'Supplier', 'Tgl PO', 'Jatuh Tempo', 'Total', 'Dibayar', 'Outstanding', 'Status', ''].map(h => (
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
                  <div style={{ fontSize: '1.5rem', marginBottom: '8px' }}>⏳</div>Memuat data hutang...
                </td></tr>
              ) : list.length === 0 ? (
                <tr><td colSpan={10} style={{ textAlign: 'center', padding: '48px', color: '#a8a29e' }}>
                  <div style={{ fontSize: '1.5rem', marginBottom: '8px' }}>📋</div>Tidak ada data hutang
                </td></tr>
              ) : list.map(p => (
                <tr key={p.id} onClick={() => openDetail(p.id)}
                  style={{
                    borderBottom: '1px solid #f5f5f4', cursor: 'pointer',
                    background: isOverdue(p) ? '#fffbf5' : 'white',
                    transition: 'background 0.15s',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = isOverdue(p) ? '#fff7ed' : '#fafaf9')}
                  onMouseLeave={e => (e.currentTarget.style.background = isOverdue(p) ? '#fffbf5' : 'white')}
                >
                  <td style={{ padding: '10px 12px' }}>
                    <div style={{ fontFamily: 'monospace', fontSize: '0.82rem', fontWeight: 700, color: '#1c1917' }}>{p.po_number}</div>
                    {p.ref_number && <div style={{ fontSize: '0.7rem', color: '#a8a29e', marginTop: '1px' }}>Ref: {p.ref_number}</div>}
                  </td>
                  <td style={{ padding: '10px 12px' }}>
                    <span style={{
                      background: p.source === 'auto' ? '#dbeafe' : '#f5f5f4',
                      color: p.source === 'auto' ? '#1e40af' : '#57534e',
                      padding: '2px 8px', borderRadius: '6px', fontSize: '0.7rem', fontWeight: 600,
                    }}>
                      {p.source === 'auto' ? '⚡ Auto' : '✏️ Manual'}
                    </span>
                  </td>
                  <td style={{ padding: '10px 12px', fontSize: '0.85rem' }}>
                    <div>{p.supplier_name || '—'}</div>
                    {p.supplier_phone && <div style={{ fontSize: '0.72rem', color: '#a8a29e' }}>{p.supplier_phone}</div>}
                  </td>
                  <td style={{ padding: '10px 12px', fontSize: '0.82rem', color: '#57534e' }}>{fmtDate(p.po_date)}</td>
                  <td style={{ padding: '10px 12px', fontSize: '0.82rem', color: isOverdue(p) ? '#c44223' : '#57534e', fontWeight: isOverdue(p) ? 700 : 400 }}>
                    {fmtDate(p.due_date)}
                    {isOverdue(p) && <div style={{ fontSize: '0.7rem', color: '#c44223' }}>⚠ Jatuh Tempo</div>}
                  </td>
                  <td style={{ padding: '10px 12px', textAlign: 'right', fontSize: '0.82rem', fontWeight: 600 }}>{rp(p.total_amount)}</td>
                  <td style={{ padding: '10px 12px', textAlign: 'right', fontSize: '0.82rem', color: '#16a34a', fontWeight: 600 }}>{rp(p.paid_amount)}</td>
                  <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: p.outstanding > 0 ? '#c44223' : '#166534' }}>{rp(p.outstanding)}</td>
                  <td style={{ padding: '10px 12px' }}><Badge status={p.status} /></td>
                  <td style={{ padding: '10px 12px' }}>
                    <button
                      onClick={e => { e.stopPropagation(); openDetail(p.id); }}
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

      {/* ══ DETAIL MODAL ═══════════════════════════════════════════════════════ */}
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
                    {detail.pay.po_number}
                  </div>
                  {detail.pay.source === 'auto'
                    ? <span style={{ background: '#dbeafe', color: '#1e40af', padding: '2px 8px', borderRadius: '6px', fontSize: '0.7rem', fontWeight: 600 }}>⚡ Auto dari PO</span>
                    : <span style={{ background: '#f5f5f4', color: '#57534e', padding: '2px 8px', borderRadius: '6px', fontSize: '0.7rem', fontWeight: 600 }}>✏️ Manual</span>
                  }
                </div>
                <div style={{ fontSize: '0.85rem', color: '#78716c' }}>
                  {detail.pay.supplier_name || 'Tanpa Supplier'}
                  {detail.pay.due_date && (
                    <span style={{ marginLeft: '10px', fontSize: '0.8rem', color: isOverdue(detail.pay) ? '#c44223' : '#78716c' }}>
                      · Jatuh Tempo: {fmtDate(detail.pay.due_date)}
                      {isOverdue(detail.pay) && ' ⚠'}
                    </span>
                  )}
                </div>
                {detail.pay.ref_number && (
                  <div style={{ fontSize: '0.75rem', color: '#a8a29e', marginTop: '2px', fontFamily: 'monospace' }}>
                    Ref: {detail.pay.ref_number}
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                {detail.pay.purchase_id && (
                  <button
                    onClick={() => window.open(`/api/pdf/purchase/${detail.pay.purchase_id}`, '_blank')}
                    style={{ background: '#1c1917', color: '#d4a843', border: 'none', borderRadius: '8px', padding: '8px 14px', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer' }}>
                    📄 PO PDF
                  </button>
                )}
                <button onClick={() => setDetail(null)} style={{ background: 'none', border: 'none', fontSize: '1.3rem', cursor: 'pointer', color: '#78716c' }}>✕</button>
              </div>
            </div>

            {/* Summary 3 boxes */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '10px', marginBottom: '18px' }}>
              {[
                { l: 'Total Hutang',  v: rp(detail.pay.total_amount), c: '#1c1917' },
                { l: 'Sudah Dibayar', v: rp(detail.pay.paid_amount),  c: '#16a34a' },
                { l: 'Sisa Hutang',   v: rp(detail.pay.outstanding),  c: '#c44223' },
              ].map(s => (
                <div key={s.l} style={{ background: '#fafaf9', borderRadius: '9px', padding: '14px', textAlign: 'center', border: '1px solid #f0ece8' }}>
                  <div style={{ fontSize: '0.72rem', color: '#78716c', marginBottom: '6px', fontWeight: 600 }}>{s.l}</div>
                  <div style={{ fontWeight: 700, color: s.c, fontSize: '1.05rem' }}>{s.v}</div>
                </div>
              ))}
            </div>

            {/* Progress */}
            <ProgressBar
              paid={detail.pay.paid_amount}
              total={detail.pay.total_amount}
              discount={detail.pay.discount_amount}
            />

            {/* Diskon */}
            <div style={{ background: '#fafaf9', borderRadius: '10px', padding: '14px 16px', marginTop: '16px', marginBottom: '16px', border: '1px solid #f0ece8' }}>
              <div style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: '#78716c', marginBottom: '10px' }}>
                Diskon / Potongan Harga
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input type="number" value={discountVal}
                  onChange={e => setDiscountVal(e.target.value)}
                  disabled={detail.pay.status === 'paid'} placeholder="0"
                  style={{ flex: 1, border: '1.5px solid #e7e5e4', borderRadius: '8px', padding: '8px 12px', fontSize: '0.85rem' }} />
                <button onClick={handleDiscount} disabled={saving || detail.pay.status === 'paid'}
                  style={{ background: '#1c1917', color: '#d4a843', border: 'none', borderRadius: '8px', padding: '8px 16px', fontWeight: 700, cursor: 'pointer', fontSize: '0.82rem', opacity: detail.pay.status === 'paid' ? 0.5 : 1 }}>
                  Simpan
                </button>
              </div>
            </div>

            {/* Riwayat pembayaran */}
            <div style={{ marginBottom: '18px' }}>
              <div style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: '#78716c', marginBottom: '10px' }}>
                Riwayat Pembayaran ke Supplier ({detail.payments.length})
              </div>
              {detail.payments.length === 0 ? (
                <div style={{ textAlign: 'center', color: '#a8a29e', padding: '20px', background: '#fafaf9', borderRadius: '8px', fontSize: '0.85rem', border: '1px solid #f0ece8' }}>
                  Belum ada pembayaran keluar
                </div>
              ) : (
                <div style={{ border: '1px solid #f0ece8', borderRadius: '10px', overflow: 'hidden' }}>
                  {detail.payments.map((p, i) => (
                    <div key={p.id} style={{ padding: '11px 14px', borderBottom: i < detail.payments.length - 1 ? '1px solid #f5f5f4' : 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: '0.92rem', color: '#c44223' }}>{rp(p.amount)}</div>
                        <div style={{ fontSize: '0.75rem', color: '#78716c', marginTop: '2px' }}>
                          {fmtDate(p.payment_date)} · {p.payment_method.toUpperCase()}
                          {p.bank_name    && <span style={{ marginLeft: '6px', color: '#1e40af' }}>🏦 {p.bank_name}</span>}
                          {p.reference_no && <span style={{ marginLeft: '6px', fontFamily: 'monospace' }}>#{p.reference_no}</span>}
                        </div>
                        {p.notes && <div style={{ fontSize: '0.72rem', color: '#a8a29e', marginTop: '2px' }}>{p.notes}</div>}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#a8a29e', background: '#f5f5f4', borderRadius: '99px', padding: '2px 10px', whiteSpace: 'nowrap', flexShrink: 0 }}>
                        Bayar #{i + 1}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Form tambah pembayaran */}
            {detail.pay.status !== 'paid' ? (
              <div style={{ background: '#fff7ed', borderRadius: '12px', padding: '18px', border: '1px solid #fed7aa' }}>
                <div style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: '#92400e', marginBottom: '14px' }}>
                  + Catat Pembayaran ke Supplier
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
                      placeholder={`Maks: ${rp(detail.pay.outstanding)}`}
                      style={inp('#fed7aa')} />
                  </FieldRow>
                  <FieldRow label="Tanggal Bayar">
                    <input type="date" value={payForm.payment_date}
                      onChange={e => setPayForm(p => ({ ...p, payment_date: e.target.value }))}
                      style={inp('#fed7aa')} />
                  </FieldRow>
                  <FieldRow label="Metode Bayar">
                    <select value={payForm.payment_method}
                      onChange={e => setPayForm(p => ({ ...p, payment_method: e.target.value }))}
                      style={inp('#fed7aa')}>
                      <option value="transfer">Transfer Bank</option>
                      <option value="cash">Cash</option>
                      <option value="giro">Giro</option>
                      <option value="cek">Cek</option>
                    </select>
                  </FieldRow>
                  <FieldRow label="No. Referensi">
                    <input value={payForm.reference_no}
                      onChange={e => setPayForm(p => ({ ...p, reference_no: e.target.value }))}
                      placeholder="No. transfer / cek / giro"
                      style={inp('#fed7aa')} />
                  </FieldRow>
                  {showBankField && (
                    <FieldRow label="Nama Bank Tujuan">
                      <input value={payForm.bank_name}
                        onChange={e => setPayForm(p => ({ ...p, bank_name: e.target.value }))}
                        placeholder="BCA, Mandiri, BRI, BNI..."
                        style={inp('#fed7aa')} />
                    </FieldRow>
                  )}
                  <FieldRow label="Catatan">
                    <input value={payForm.notes}
                      onChange={e => setPayForm(p => ({ ...p, notes: e.target.value }))}
                      placeholder="Opsional"
                      style={inp('#fed7aa')} />
                  </FieldRow>
                </div>
                <button onClick={handlePayment} disabled={saving || !payForm.amount}
                  style={{ width: '100%', background: '#92400e', color: 'white', border: 'none', borderRadius: '9px', padding: '12px', fontWeight: 700, cursor: saving || !payForm.amount ? 'not-allowed' : 'pointer', fontSize: '0.9rem', opacity: saving || !payForm.amount ? 0.6 : 1 }}>
                  {saving ? '⏳ Menyimpan...' : '✓ Catat Pembayaran ke Supplier'}
                </button>
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '18px', background: '#f0fdf4', borderRadius: '10px', border: '1px solid #bbf7d0' }}>
                <div style={{ fontSize: '1.5rem', marginBottom: '4px' }}>✅</div>
                <div style={{ fontWeight: 700, color: '#166534' }}>Hutang ke Supplier Lunas</div>
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
                Tambah Hutang Manual
              </div>
              <button onClick={() => setShowManual(false)} style={{ background: 'none', border: 'none', fontSize: '1.3rem', cursor: 'pointer', color: '#78716c' }}>✕</button>
            </div>
            <p style={{ fontSize: '0.8rem', color: '#a8a29e', marginBottom: '18px' }}>
              Gunakan ini untuk hutang di luar sistem PO (pembelian tunai, rekapan nota, pinjaman ke supplier, dll.)
            </p>

            {manualError && (
              <div style={{ background: '#fee2e2', color: '#dc2626', borderRadius: '8px', padding: '9px 12px', fontSize: '0.82rem', marginBottom: '14px' }}>
                ⚠ {manualError}
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
              <FieldRow label="No. Referensi *">
                <input value={manualForm.po_number}
                  onChange={e => setManualForm(f => ({ ...f, po_number: e.target.value }))}
                  placeholder="REF-XXXX / Nama Nota" style={inp()} />
              </FieldRow>
              <FieldRow label="Tanggal *">
                <input type="date" value={manualForm.po_date}
                  onChange={e => setManualForm(f => ({ ...f, po_date: e.target.value }))}
                  style={inp()} />
              </FieldRow>
              <div style={{ gridColumn: '1 / -1' }}>
                <FieldRow label="Supplier">
                  <select value={manualForm.supplier_id}
                    onChange={e => setManualForm(f => ({ ...f, supplier_id: e.target.value }))}
                    style={inp()}>
                    <option value="">— Tanpa Supplier —</option>
                    {suppliers.map(s => (
                      <option key={s.id} value={s.id}>{s.name}{s.city ? ` — ${s.city}` : ''}</option>
                    ))}
                  </select>
                </FieldRow>
              </div>
              <FieldRow label="Total Hutang (Rp) *">
                <input type="number" value={manualForm.total_amount}
                  onChange={e => setManualForm(f => ({ ...f, total_amount: e.target.value }))}
                  placeholder="0" style={inp()} />
              </FieldRow>
              <FieldRow label="Diskon (Rp)">
                <input type="number" value={manualForm.discount_amount}
                  onChange={e => setManualForm(f => ({ ...f, discount_amount: e.target.value }))}
                  placeholder="0" style={inp()} />
              </FieldRow>
              <FieldRow label="No. Referensi Bank">
                <input value={manualForm.ref_number}
                  onChange={e => setManualForm(f => ({ ...f, ref_number: e.target.value }))}
                  placeholder="No. transfer / kwitansi" style={inp()} />
              </FieldRow>
              <FieldRow label="Jatuh Tempo">
                <input type="date" value={manualForm.due_date}
                  onChange={e => setManualForm(f => ({ ...f, due_date: e.target.value }))}
                  style={inp()} />
              </FieldRow>
            </div>

            {/* DP / cicilan awal */}
            <div style={{ background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: '10px', padding: '14px', marginBottom: '14px' }}>
              <div style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', color: '#c2410c', marginBottom: '8px' }}>
                💰 DP / Cicilan Awal (Opsional)
              </div>
              <FieldRow label="Jumlah yang Sudah Dibayar ke Supplier">
                <input type="number" value={manualForm.dp_amount}
                  onChange={e => setManualForm(f => ({ ...f, dp_amount: e.target.value }))}
                  placeholder="0 — kosongkan jika belum ada pembayaran"
                  style={inp('#fed7aa')} />
              </FieldRow>
              <div style={{ fontSize: '0.75rem', color: '#92400e', marginTop: '6px' }}>
                Akan otomatis dicatat sebagai pembayaran pertama dengan tanggal PO
              </div>
            </div>

            <FieldRow label="Catatan">
              <input value={manualForm.notes}
                onChange={e => setManualForm(f => ({ ...f, notes: e.target.value }))}
                placeholder="Opsional" style={{ ...inp(), marginBottom: '16px' }} />
            </FieldRow>

            <button onClick={handleManualCreate}
              disabled={manualSaving || !manualForm.po_number || !manualForm.total_amount}
              style={{ width: '100%', background: '#1c1917', color: '#d4a843', border: 'none', borderRadius: '9px', padding: '12px', fontWeight: 700, cursor: 'pointer', fontSize: '0.9rem', opacity: manualSaving ? 0.6 : 1 }}>
              {manualSaving ? '⏳ Menyimpan...' : '✓ Simpan Hutang'}
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
