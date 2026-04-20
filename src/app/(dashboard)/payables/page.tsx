'use client';
import { useState, useEffect, useCallback } from 'react';

// =============================================================================
// Hutang — Kewajiban Ciomas Keramik ke Supplier
// Sumber: Purchase Order atau Rekapan Pribadi (tanpa PO di sistem)
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
  notes          : string;
};

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

const inputStyle = (borderColor = '#e7e5e4'): React.CSSProperties => ({
  width: '100%', border: `1.5px solid ${borderColor}`,
  borderRadius: '8px', padding: '8px 10px', fontSize: '0.85rem',
  boxSizing: 'border-box',
});

// ─── Main Component ───────────────────────────────────────────────────────────

export default function PayablesPage() {
  const [list,         setList]         = useState<Payable[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [search,       setSearch]       = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [summary,      setSummary]      = useState<Summary>({ total_outstanding: 0, total_overdue: 0, count: 0 });

  const [detail,       setDetail]       = useState<{ pay: Payable; payments: Payment[] } | null>(null);
  const [payForm,      setPayForm]      = useState<PayForm>({
    amount: '', payment_date: today(), payment_method: 'transfer',
    bank_name: '', reference_no: '', notes: '',
  });
  const [discountVal,  setDiscountVal]  = useState('');
  const [saving,       setSaving]       = useState(false);
  const [error,        setError]        = useState('');

  const [showManual,   setShowManual]   = useState(false);
  const [manualForm,   setManualForm]   = useState<ManualForm>({
    po_number: '', po_date: today(), supplier_id: '',
    due_date: '', ref_number: '', total_amount: '', discount_amount: '', notes: '',
  });

  // ── Fetch ──────────────────────────────────────────────────────────────────

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const p = new URLSearchParams();
    if (search)       p.set('search', search);
    if (statusFilter) p.set('status', statusFilter);
    const [r1, r2] = await Promise.all([
      fetch(`/api/payables?${p}`).then(r => r.json()),
      fetch('/api/payables?summary=1').then(r => r.json()),
    ]);
    setList(r1.payables ?? []);
    setSummary(r2.summary ?? { total_outstanding: 0, total_overdue: 0, count: 0 });
    setLoading(false);
  }, [search, statusFilter]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // ── Detail modal ───────────────────────────────────────────────────────────

  async function openDetail(id: string) {
    setError('');
    const r = await fetch(`/api/payables/${id}`).then(r => r.json());
    if (!r.payable) return;
    setDetail({ pay: r.payable, payments: r.payments ?? [] });
    setDiscountVal(String(r.payable.discount_amount));
    setPayForm(p => ({ ...p, amount: '', bank_name: '', reference_no: '', notes: '' }));
  }

  // ── Payment ────────────────────────────────────────────────────────────────

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

  // ── Discount ───────────────────────────────────────────────────────────────

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

  // ── Manual Entry ───────────────────────────────────────────────────────────

  async function handleManualCreate() {
    setSaving(true); setError('');
    try {
      const res  = await fetch('/api/payables', {
        method : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body   : JSON.stringify({
          ...manualForm,
          total_amount   : parseFloat(manualForm.total_amount),
          discount_amount: parseFloat(manualForm.discount_amount || '0'),
          supplier_id    : manualForm.supplier_id || undefined,
          due_date       : manualForm.due_date    || undefined,
          ref_number     : manualForm.ref_number  || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setShowManual(false);
      setManualForm({
        po_number: '', po_date: today(), supplier_id: '',
        due_date: '', ref_number: '', total_amount: '', discount_amount: '', notes: '',
      });
      fetchAll();
    } catch (e) { setError(e instanceof Error ? e.message : 'Gagal'); }
    finally     { setSaving(false); }
  }

  const isOverdue = (p: Payable) =>
    !!p.due_date && new Date(p.due_date) < new Date() && p.status !== 'paid';

  const showBankField = payForm.payment_method === 'transfer';

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div style={{ padding: '32px 28px' }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '2.2rem', fontWeight: 600, color: '#1c1917' }}>
            Hutang
          </h1>
          <p style={{ color: '#78716c', marginTop: '4px', fontSize: '0.88rem' }}>
            Kewajiban Ciomas Keramik ke Supplier — dari PO maupun Rekapan Pribadi
          </p>
        </div>
        <button
          onClick={() => { setShowManual(true); setError(''); }}
          style={{ background: '#1c1917', color: '#d4a843', border: 'none', borderRadius: '9px', padding: '10px 18px', fontWeight: 700, cursor: 'pointer', fontSize: '0.85rem' }}>
          + Tambah Manual
        </button>
      </div>

      {/* Summary cards */}
      <div style={{ display: 'flex', gap: '14px', marginBottom: '24px', flexWrap: 'wrap' }}>
        <SummaryCard label="Total Hutang Aktif" value={rp(summary.total_outstanding)} sub={`${summary.count} hutang belum lunas`} color="#1c1917" />
        <SummaryCard label="Sudah Jatuh Tempo"  value={rp(summary.total_overdue)}     sub="Perlu segera dibayar ke supplier"      color="#c44223" />
      </div>

      {/* Filters */}
      <div style={{ background: 'white', borderRadius: '12px', padding: '14px 18px', marginBottom: '18px', border: '1px solid #f0ece8', display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
        <input
          style={{ flex: 1, minWidth: '200px', border: '1.5px solid #e7e5e4', borderRadius: '8px', padding: '8px 12px', fontSize: '0.85rem' }}
          placeholder="Cari No. PO, nama supplier..." value={search}
          onChange={e => setSearch(e.target.value)} />
        <select
          style={{ border: '1.5px solid #e7e5e4', borderRadius: '8px', padding: '8px 12px', fontSize: '0.85rem' }}
          value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="">Semua Status</option>
          <option value="outstanding">Outstanding</option>
          <option value="partial">Cicilan</option>
          <option value="overdue">Jatuh Tempo</option>
          <option value="paid">Lunas</option>
        </select>
        <span style={{ fontSize: '0.8rem', color: '#a8a29e', marginLeft: 'auto' }}>{list.length} data</span>
      </div>

      {/* Table */}
      <div style={{ background: 'white', borderRadius: '14px', border: '1px solid #f0ece8', overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['No. Ref', 'Supplier', 'Tgl', 'Jatuh Tempo', 'Ref. Transaksi', 'Total', 'Diskon', 'Dibayar', 'Outstanding', 'Status', 'Aksi'].map(h => (
                  <th key={h} style={{
                    background: '#1c1917', color: '#d4a843', padding: '10px 12px',
                    whiteSpace: 'nowrap', fontSize: '0.72rem', fontWeight: 700,
                    textTransform: 'uppercase', letterSpacing: '0.5px',
                    textAlign: ['Total', 'Diskon', 'Dibayar', 'Outstanding'].includes(h) ? 'right' : 'left',
                  }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={11} style={{ textAlign: 'center', padding: '48px', color: '#a8a29e' }}>Memuat...</td></tr>
              ) : list.length === 0 ? (
                <tr><td colSpan={11} style={{ textAlign: 'center', padding: '48px', color: '#a8a29e' }}>Tidak ada data hutang</td></tr>
              ) : list.map(p => (
                <tr key={p.id} onClick={() => openDetail(p.id)}
                  style={{ borderBottom: '1px solid #f5f5f4', cursor: 'pointer', background: isOverdue(p) ? '#fffbf5' : 'white' }}>
                  <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontSize: '0.8rem', fontWeight: 700, color: '#1c1917' }}>{p.po_number}</td>
                  <td style={{ padding: '10px 12px', fontSize: '0.85rem' }}>{p.supplier_name || '—'}</td>
                  <td style={{ padding: '10px 12px', fontSize: '0.82rem', color: '#57534e' }}>{fmtDate(p.po_date)}</td>
                  <td style={{ padding: '10px 12px', fontSize: '0.82rem', color: isOverdue(p) ? '#c44223' : '#57534e', fontWeight: isOverdue(p) ? 700 : 400 }}>{fmtDate(p.due_date)}</td>
                  <td style={{ padding: '10px 12px', fontSize: '0.78rem', color: '#78716c', fontFamily: 'monospace' }}>{p.ref_number || '—'}</td>
                  <td style={{ padding: '10px 12px', textAlign: 'right', fontSize: '0.82rem' }}>{rp(p.total_amount)}</td>
                  <td style={{ padding: '10px 12px', textAlign: 'right', fontSize: '0.82rem', color: '#16a34a' }}>{p.discount_amount > 0 ? rp(p.discount_amount) : '—'}</td>
                  <td style={{ padding: '10px 12px', textAlign: 'right', fontSize: '0.82rem', color: '#16a34a' }}>{rp(p.paid_amount)}</td>
                  <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: p.outstanding > 0 ? '#c44223' : '#166534' }}>{rp(p.outstanding)}</td>
                  <td style={{ padding: '10px 12px' }}><Badge status={p.status} /></td>
                  <td style={{ padding: '10px 12px' }}>
                    {p.purchase_id && (
                      <button
                        onClick={e => { e.stopPropagation(); window.open(`/api/pdf/purchase/${p.purchase_id}`, '_blank'); }}
                        style={{ background: 'none', border: '1px solid #e7e5e4', borderRadius: '6px', padding: '4px 8px', fontSize: '0.72rem', cursor: 'pointer', color: '#57534e' }}>
                        📄 PO PDF
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Detail Modal ─────────────────────────────────────────────────── */}
      {detail && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}
          onClick={e => { if (e.target === e.currentTarget) setDetail(null); }}>
          <div style={{ background: 'white', borderRadius: '18px', width: '100%', maxWidth: '640px', maxHeight: '90vh', overflowY: 'auto', padding: '28px' }}>

            {/* Modal header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
              <div>
                <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '1.5rem', fontWeight: 600, color: '#1c1917' }}>
                  {detail.pay.po_number}
                </div>
                <div style={{ fontSize: '0.83rem', color: '#78716c', marginTop: '3px' }}>
                  {detail.pay.supplier_name || 'Tanpa Supplier'}
                </div>
                {detail.pay.ref_number && (
                  <div style={{ fontSize: '0.75rem', color: '#a8a29e', marginTop: '2px', fontFamily: 'monospace' }}>
                    Ref. Transaksi: {detail.pay.ref_number}
                  </div>
                )}
                {!detail.pay.purchase_id && (
                  <span style={{ fontSize: '0.72rem', background: '#fef9c3', color: '#854d0e', borderRadius: '4px', padding: '2px 7px', fontWeight: 700, marginTop: '4px', display: 'inline-block' }}>
                    Rekapan Manual
                  </span>
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

            {/* Summary */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '10px', marginBottom: '20px' }}>
              {[
                { l: 'Total Hutang',  v: rp(detail.pay.total_amount), c: '#1c1917' },
                { l: 'Sudah Dibayar', v: rp(detail.pay.paid_amount),  c: '#16a34a' },
                { l: 'Sisa Hutang',   v: rp(detail.pay.outstanding),  c: '#c44223' },
              ].map(s => (
                <div key={s.l} style={{ background: '#fafaf9', borderRadius: '9px', padding: '14px', textAlign: 'center', border: '1px solid #f0ece8' }}>
                  <div style={{ fontSize: '0.72rem', color: '#78716c', marginBottom: '6px', fontWeight: 600 }}>{s.l}</div>
                  <div style={{ fontWeight: 700, color: s.c, fontSize: '1rem' }}>{s.v}</div>
                </div>
              ))}
            </div>

            {/* Diskon */}
            <div style={{ background: '#fafaf9', borderRadius: '10px', padding: '14px 16px', marginBottom: '18px', border: '1px solid #f0ece8' }}>
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
                        <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#166534' }}>{rp(p.amount)}</div>
                        <div style={{ fontSize: '0.75rem', color: '#78716c', marginTop: '2px' }}>
                          {fmtDate(p.payment_date)} · {p.payment_method.toUpperCase()}
                          {p.bank_name    && <span style={{ marginLeft: '6px', color: '#1e40af' }}>🏦 {p.bank_name}</span>}
                          {p.reference_no && <span style={{ marginLeft: '6px', fontFamily: 'monospace' }}>#{p.reference_no}</span>}
                        </div>
                        {p.notes && <div style={{ fontSize: '0.72rem', color: '#a8a29e', marginTop: '2px' }}>{p.notes}</div>}
                      </div>
                      <div style={{ fontSize: '0.78rem', color: '#a8a29e', background: '#f5f5f4', borderRadius: '99px', padding: '2px 8px', whiteSpace: 'nowrap' }}>
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
                      style={inputStyle('#fed7aa')} />
                  </FieldRow>
                  <FieldRow label="Tanggal Bayar">
                    <input type="date" value={payForm.payment_date}
                      onChange={e => setPayForm(p => ({ ...p, payment_date: e.target.value }))}
                      style={inputStyle('#fed7aa')} />
                  </FieldRow>
                  <FieldRow label="Metode Bayar">
                    <select value={payForm.payment_method}
                      onChange={e => setPayForm(p => ({ ...p, payment_method: e.target.value }))}
                      style={inputStyle('#fed7aa')}>
                      <option value="transfer">Transfer Bank</option>
                      <option value="cash">Cash</option>
                      <option value="giro">Giro</option>
                      <option value="cek">Cek</option>
                    </select>
                  </FieldRow>
                  <FieldRow label="No. Referensi Transaksi">
                    <input value={payForm.reference_no}
                      onChange={e => setPayForm(p => ({ ...p, reference_no: e.target.value }))}
                      placeholder="No. transfer / cek / giro"
                      style={inputStyle('#fed7aa')} />
                  </FieldRow>
                  {showBankField && (
                    <FieldRow label="Nama Bank Tujuan">
                      <input value={payForm.bank_name}
                        onChange={e => setPayForm(p => ({ ...p, bank_name: e.target.value }))}
                        placeholder="BCA, Mandiri, BRI, BNI..."
                        style={inputStyle('#fed7aa')} />
                    </FieldRow>
                  )}
                  <FieldRow label="Catatan">
                    <input value={payForm.notes}
                      onChange={e => setPayForm(p => ({ ...p, notes: e.target.value }))}
                      placeholder="Opsional"
                      style={inputStyle('#fed7aa')} />
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

      {/* ── Modal Tambah Manual ───────────────────────────────────────────── */}
      {showManual && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}
          onClick={e => { if (e.target === e.currentTarget) setShowManual(false); }}>
          <div style={{ background: 'white', borderRadius: '18px', width: '100%', maxWidth: '560px', maxHeight: '90vh', overflowY: 'auto', padding: '28px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <div>
                <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '1.4rem', fontWeight: 600, color: '#1c1917' }}>
                  Tambah Hutang Manual
                </div>
                <div style={{ fontSize: '0.78rem', color: '#78716c', marginTop: '3px' }}>Rekapan pribadi Ciomas ke Supplier</div>
              </div>
              <button onClick={() => setShowManual(false)} style={{ background: 'none', border: 'none', fontSize: '1.3rem', cursor: 'pointer', color: '#78716c' }}>✕</button>
            </div>

            {error && (
              <div style={{ background: '#fee2e2', color: '#dc2626', borderRadius: '8px', padding: '9px 12px', fontSize: '0.82rem', marginBottom: '14px' }}>
                ⚠ {error}
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
              <FieldRow label="No. Referensi *">
                <input value={manualForm.po_number}
                  onChange={e => setManualForm(f => ({ ...f, po_number: e.target.value }))}
                  placeholder="REF-XXXX / Nama Nota" style={inputStyle()} />
              </FieldRow>
              <FieldRow label="Tanggal *">
                <input type="date" value={manualForm.po_date}
                  onChange={e => setManualForm(f => ({ ...f, po_date: e.target.value }))}
                  style={inputStyle()} />
              </FieldRow>
              <FieldRow label="Total Hutang (Rp) *">
                <input type="number" value={manualForm.total_amount}
                  onChange={e => setManualForm(f => ({ ...f, total_amount: e.target.value }))}
                  placeholder="0" style={inputStyle()} />
              </FieldRow>
              <FieldRow label="Diskon (Rp)">
                <input type="number" value={manualForm.discount_amount}
                  onChange={e => setManualForm(f => ({ ...f, discount_amount: e.target.value }))}
                  placeholder="0" style={inputStyle()} />
              </FieldRow>
              <FieldRow label="No. Transaksi Bank">
                <input value={manualForm.ref_number}
                  onChange={e => setManualForm(f => ({ ...f, ref_number: e.target.value }))}
                  placeholder="No. transfer / kwitansi" style={inputStyle()} />
              </FieldRow>
              <FieldRow label="Jatuh Tempo">
                <input type="date" value={manualForm.due_date}
                  onChange={e => setManualForm(f => ({ ...f, due_date: e.target.value }))}
                  style={inputStyle()} />
              </FieldRow>
            </div>
            <FieldRow label="Catatan">
              <input value={manualForm.notes}
                onChange={e => setManualForm(f => ({ ...f, notes: e.target.value }))}
                placeholder="Opsional" style={{ ...inputStyle(), marginBottom: '14px' }} />
            </FieldRow>

            <button onClick={handleManualCreate} disabled={saving || !manualForm.po_number || !manualForm.total_amount}
              style={{ width: '100%', background: '#1c1917', color: '#d4a843', border: 'none', borderRadius: '9px', padding: '12px', fontWeight: 700, cursor: 'pointer', fontSize: '0.9rem', opacity: saving ? 0.6 : 1 }}>
              {saving ? '⏳ Menyimpan...' : '✓ Simpan Hutang'}
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
