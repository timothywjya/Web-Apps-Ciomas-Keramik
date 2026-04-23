'use client';
import { useState, useEffect, useCallback } from 'react';
import { useToast } from '@/lib/toast';
import { fetchJson, fetchJsonPost, getErrorMessage } from '@/lib/fetchJson';

interface DeliveryReport {
  id: string;
  report_number: string;
  reference_number: string;
  reference_type: 'purchase' | 'sale';
  report_date: string;
  issue_type: string;
  status: 'open' | 'proses' | 'resolved' | 'closed';
  party_name: string;
  party_type: 'supplier' | 'customer';
  party_email?: string;
  description: string;
  resolution?: string;
  created_by_name: string;
  resolved_by_name?: string;
  resolved_at?: string;
}

interface ReportItem {
  id: string;
  product_name: string;
  sku: string;
  qty_expected: number;
  qty_actual: number;
  qty_damaged: number;
  issue_note?: string;
}

interface ItemDraft {
  product_name: string;
  sku: string;
  qty_expected: string;
  qty_actual: string;
  qty_damaged: string;
  issue_note: string;
}

interface RefDoc {
  id: string;
  number: string;
  party_name: string;
  party_email: string;
  party_type: 'supplier' | 'customer';
  items: { product_name: string; sku: string; quantity: number }[];
}

const ISSUE_LABELS: Record<string, string> = {
  kurang: 'Barang Kurang', lebih: 'Barang Lebih', rusak: 'Barang Rusak',
  salah_produk: 'Produk Salah', campuran: 'Kendala Campuran',
};
const ISSUE_COLORS: Record<string, string> = {
  kurang: '#854d0e', lebih: '#1e40af', rusak: '#991b1b', salah_produk: '#6b21a8', campuran: '#374151',
};
const STATUS_MAP: Record<string, { label: string; color: string; bg: string }> = {
  open:     { label: 'Open',     color: '#991b1b', bg: '#fee2e2' },
  proses:   { label: 'Diproses', color: '#854d0e', bg: '#fef9c3' },
  resolved: { label: 'Selesai',  color: '#166534', bg: '#dcfce7' },
  closed:   { label: 'Ditutup',  color: '#57534e', bg: '#f5f5f4' },
};

const fmtDate = (d?: string) =>
  d ? new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(d)) : '—';

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_MAP[status] ?? { label: status, color: '#57534e', bg: '#f5f5f4' };
  return <span style={{ background: s.bg, color: s.color, padding: '2px 10px', borderRadius: '99px', fontSize: '0.72rem', fontWeight: 700 }}>{s.label}</span>;
}
function IssueBadge({ type }: { type: string }) {
  const color = ISSUE_COLORS[type] ?? '#374151';
  return <span style={{ background: `${color}18`, color, padding: '2px 9px', borderRadius: '99px', fontSize: '0.72rem', fontWeight: 700 }}>{ISSUE_LABELS[type] ?? type}</span>;
}

export default function DeliveryReportPage() {
  const toast = useToast();

  const [reports, setReports]           = useState<DeliveryReport[]>([]);
  const [loading, setLoading]           = useState(true);
  const [filterStatus, setFilterStatus] = useState('');
  const [showAdd, setShowAdd]           = useState(false);
  const [refType, setRefType]           = useState<'purchase' | 'sale'>('purchase');
  const [refNumber, setRefNumber]       = useState('');
  const [refLoading, setRefLoading]     = useState(false);
  const [refDoc, setRefDoc]             = useState<RefDoc | null>(null);
  const [issueType, setIssueType]       = useState('kurang');
  const [description, setDescription]  = useState('');
  const [itemDrafts, setItemDrafts]     = useState<ItemDraft[]>([]);
  const [saving, setSaving]             = useState(false);
  const [selected, setSelected]         = useState<DeliveryReport | null>(null);
  const [drItems, setDrItems]           = useState<ReportItem[]>([]);
  const [resolution, setResolution]     = useState('');
  const [emailTo, setEmailTo]           = useState('');
  const [emailLoading, setEmailLoading] = useState(false);

  const loadReports = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterStatus) params.set('status', filterStatus);
      const data = await fetchJson<{ reports: DeliveryReport[] }>(`/api/delivery-report?${params}`);
      setReports(data.reports ?? []);
    } catch (err) {
      toast.error('Gagal memuat data', getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [filterStatus, toast]);

  useEffect(() => { loadReports(); }, [loadReports]);

  async function lookupRefDoc() {
    if (!refNumber.trim()) { toast.warning('Masukkan nomor ' + (refType === 'purchase' ? 'PO' : 'Invoice')); return; }
    setRefLoading(true);
    setRefDoc(null);
    setItemDrafts([]);
    try {
      const endpoint = refType === 'purchase'
        ? `/api/purchases?search=${encodeURIComponent(refNumber)}`
        : `/api/sales?search=${encodeURIComponent(refNumber)}`;
      const data = await fetchJson<Record<string, unknown[]>>(endpoint);
      const list = ((refType === 'purchase' ? data.purchases : data.sales) ?? []) as Record<string, unknown>[];
      const match = list.find(d => String(d.purchase_number ?? d.invoice_number).toLowerCase() === refNumber.toLowerCase()) ?? list[0];
      if (!match) { toast.warning('Dokumen tidak ditemukan'); return; }

      const docId = String(match.id);
      const detail = await fetchJson<Record<string, unknown>>(
        refType === 'purchase' ? `/api/purchases/${docId}` : `/api/sales/${docId}`
      );
      const rawItems = (detail.items as Record<string, unknown>[] ?? []);
      const doc: RefDoc = {
        id: docId,
        number: String(match.purchase_number ?? match.invoice_number ?? refNumber),
        party_name: String(match.supplier_name ?? match.customer_name ?? ''),
        party_email: String(match.supplier_email ?? match.customer_email ?? ''),
        party_type: refType === 'purchase' ? 'supplier' : 'customer',
        items: rawItems.map(i => ({ product_name: String(i.product_name ?? ''), sku: String(i.sku ?? ''), quantity: Number(i.quantity ?? 0) })),
      };
      setRefDoc(doc);
      setItemDrafts(doc.items.map(i => ({ product_name: i.product_name, sku: i.sku, qty_expected: String(i.quantity), qty_actual: String(i.quantity), qty_damaged: '0', issue_note: '' })));
      toast.success(`Ditemukan: ${doc.number} — ${doc.party_name} (${doc.items.length} produk)`);
    } catch (err) {
      toast.error('Gagal mencari dokumen', getErrorMessage(err));
    } finally {
      setRefLoading(false);
    }
  }

  function updateDraft(idx: number, key: keyof ItemDraft, val: string) {
    setItemDrafts(prev => prev.map((d, i) => i === idx ? { ...d, [key]: val } : d));
  }

  function resetAdd() {
    setShowAdd(false); setRefType('purchase'); setRefNumber(''); setRefDoc(null);
    setIssueType('kurang'); setDescription(''); setItemDrafts([]);
  }

  async function handleCreate() {
    if (!description.trim()) { toast.warning('Deskripsi masalah wajib diisi'); return; }
    const validItems = itemDrafts.filter(d => d.product_name.trim());
    if (validItems.length === 0) { toast.warning('Tambahkan minimal 1 item produk'); return; }
    setSaving(true);
    try {
      await fetchJsonPost('/api/delivery-report', {
        reference_type: refType, reference_id: refDoc?.id ?? '', reference_number: refDoc?.number ?? refNumber,
        issue_type: issueType, party_name: refDoc?.party_name ?? '', party_type: refDoc?.party_type ?? 'supplier',
        party_email: refDoc?.party_email ?? '', description,
        items: validItems.map(d => ({
          product_id: '', product_name: d.product_name, sku: d.sku,
          qty_expected: Number(d.qty_expected) || 0, qty_actual: Number(d.qty_actual) || 0,
          qty_damaged: Number(d.qty_damaged) || 0, issue_note: d.issue_note,
        })),
      });
      toast.success('Berita Acara berhasil dibuat');
      resetAdd(); loadReports();
    } catch (err) {
      toast.error('Gagal membuat Berita Acara', getErrorMessage(err));
    } finally { setSaving(false); }
  }

  async function openView(dr: DeliveryReport) {
    setSelected(dr); setResolution(dr.resolution ?? ''); setEmailTo(dr.party_email ?? '');
    try {
      const data = await fetchJson<{ items: ReportItem[] }>(`/api/delivery-report/${dr.id}`);
      setDrItems(data.items ?? []);
    } catch (err) { toast.error('Gagal memuat detail', getErrorMessage(err)); }
  }

  async function handleUpdateStatus(dr: DeliveryReport, newStatus: string) {
    try {
      await fetchJsonPost(`/api/delivery-report/${dr.id}`, { status: newStatus, resolution }, 'PATCH');
      toast.success(`Status: ${STATUS_MAP[newStatus]?.label ?? newStatus}`);
      setSelected(null); loadReports();
    } catch (err) { toast.error('Gagal update status', getErrorMessage(err)); }
  }

  async function handleSendEmail(dr: DeliveryReport) {
    if (!emailTo) { toast.warning('Masukkan email tujuan'); return; }
    setEmailLoading(true);
    try {
      await fetchJsonPost('/api/email', { type: 'delivery_report', id: dr.id, to: emailTo, toName: dr.party_name });
      toast.success(`Berita Acara dikirim ke ${emailTo}`);
    } catch (err) { toast.error('Gagal mengirim email', getErrorMessage(err)); }
    finally { setEmailLoading(false); }
  }

  return (
    <div style={{ padding: '32px 28px' }}>
      <div className="page-header">
        <div>
          <h1 className="page-title">Berita Acara Pengiriman</h1>
          <p className="page-subtitle">Dokumentasi kendala pengiriman — barang kurang, lebih, atau rusak</p>
        </div>
        <button className="btn-primary" onClick={() => { resetAdd(); setShowAdd(true); }}>+ Buat Berita Acara</button>
      </div>

      <div className="card" style={{ marginBottom: '16px', padding: '12px 16px' }}>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.8rem', color: '#78716c', fontWeight: 500 }}>Status:</span>
          {['', 'open', 'proses', 'resolved', 'closed'].map(s => (
            <button key={s} onClick={() => setFilterStatus(s)} style={{ padding: '5px 12px', borderRadius: '20px', border: 'none', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 500, background: filterStatus === s ? '#1c1917' : '#f5f5f4', color: filterStatus === s ? '#d4a843' : '#57534e', transition: 'all 0.15s' }}>
              {s === '' ? 'Semua' : STATUS_MAP[s]?.label}
            </button>
          ))}
          <span style={{ marginLeft: 'auto', fontSize: '0.8rem', color: '#78716c' }}>{reports.length} laporan</span>
        </div>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <table className="data-table">
          <thead>
            <tr><th>No. Laporan</th><th>Ref. Dokumen</th><th>Pihak</th><th>Jenis Kendala</th><th>Tanggal</th><th>Status</th><th>Aksi</th></tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} style={{ textAlign: 'center', padding: '40px' }}><div className="loading-spinner" style={{ margin: '0 auto' }} /></td></tr>
            ) : reports.map(dr => (
              <tr key={dr.id}>
                <td style={{ fontFamily: 'monospace', fontWeight: 600, color: '#1c1917' }}>{dr.report_number}</td>
                <td>
                  <div style={{ fontWeight: 500 }}>{dr.reference_number}</div>
                  <div style={{ fontSize: '0.75rem', color: '#a8a29e' }}>{dr.reference_type === 'purchase' ? 'Purchase Order' : 'Sales Invoice'}</div>
                </td>
                <td>
                  <div style={{ fontWeight: 500 }}>{dr.party_name}</div>
                  <div style={{ fontSize: '0.75rem', color: '#a8a29e' }}>{dr.party_type === 'supplier' ? 'Supplier' : 'Pelanggan'}</div>
                </td>
                <td><IssueBadge type={dr.issue_type} /></td>
                <td style={{ color: '#57534e' }}>{fmtDate(dr.report_date)}</td>
                <td><StatusBadge status={dr.status} /></td>
                <td>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button onClick={() => openView(dr)} style={{ background: '#f5f5f4', border: 'none', borderRadius: '6px', padding: '6px 10px', cursor: 'pointer', fontSize: '0.75rem' }}>Detail</button>
                    <button onClick={() => window.open(`/api/pdf/delivery-report/${dr.id}`, '_blank')} style={{ background: '#dbeafe', border: 'none', borderRadius: '6px', padding: '6px 10px', cursor: 'pointer', fontSize: '0.75rem', color: '#1e40af' }}>PDF</button>
                  </div>
                </td>
              </tr>
            ))}
            {!loading && reports.length === 0 && <tr><td colSpan={7} style={{ textAlign: 'center', padding: '40px', color: '#a8a29e' }}>Tidak ada berita acara</td></tr>}
          </tbody>
        </table>
      </div>

      {/* ADD Modal */}
      {showAdd && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) resetAdd(); }}>
          <div className="modal" style={{ maxWidth: '880px' }}>
            <div className="modal-header">
              <h2 style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '1.4rem', fontWeight: 600 }}>Buat Berita Acara Kendala Pengiriman</h2>
              <button onClick={resetAdd} style={{ background: 'none', border: 'none', fontSize: '1.2rem', cursor: 'pointer', color: '#78716c' }}>✕</button>
            </div>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

              {/* Lookup */}
              <div style={{ background: '#f9f8f7', borderRadius: '10px', padding: '14px 16px' }}>
                <div style={{ fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#a8a29e', marginBottom: '10px' }}>
                  Langkah 1 — Cari Nomor PO atau Invoice
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '150px 1fr auto', gap: '10px', alignItems: 'flex-end' }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Tipe</label>
                    <select className="form-select" value={refType} onChange={e => { setRefType(e.target.value as 'purchase' | 'sale'); setRefDoc(null); setItemDrafts([]); }}>
                      <option value="purchase">Purchase Order</option>
                      <option value="sale">Sales Invoice</option>
                    </select>
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Nomor {refType === 'purchase' ? 'PO' : 'Invoice'}</label>
                    <input className="form-input" value={refNumber} onChange={e => setRefNumber(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') lookupRefDoc(); }} placeholder={refType === 'purchase' ? 'PO-2024-001' : 'INV-2024-001'} />
                  </div>
                  <button onClick={lookupRefDoc} disabled={refLoading} style={{ background: '#1c1917', color: '#d4a843', border: 'none', borderRadius: '8px', padding: '10px 18px', cursor: refLoading ? 'not-allowed' : 'pointer', fontSize: '0.85rem', fontWeight: 600, whiteSpace: 'nowrap', opacity: refLoading ? 0.7 : 1 }}>
                    {refLoading ? 'Mencari...' : '🔍 Cari'}
                  </button>
                </div>
                {refDoc && (
                  <div style={{ marginTop: '10px', padding: '10px 12px', background: '#f0fdf4', borderRadius: '8px', border: '1px solid #bbf7d0', fontSize: '0.85rem' }}>
                    ✅ <strong>{refDoc.number}</strong> — {refDoc.party_name}
                    {refDoc.party_email && <span style={{ color: '#78716c' }}> · {refDoc.party_email}</span>}
                    <span style={{ marginLeft: '8px', fontSize: '0.75rem', color: '#166534' }}>({refDoc.items.length} produk dimuat)</span>
                  </div>
                )}
              </div>

              {/* Issue info */}
              <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: '12px' }}>
                <div className="form-group">
                  <label className="form-label">Jenis Kendala</label>
                  <select className="form-select" value={issueType} onChange={e => setIssueType(e.target.value)}>
                    {Object.entries(ISSUE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Deskripsi Masalah</label>
                  <input className="form-input" value={description} onChange={e => setDescription(e.target.value)} placeholder="Jelaskan kendala secara singkat dan jelas..." />
                </div>
              </div>

              {/* Items */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <div style={{ fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#78716c' }}>
                    Langkah 2 — Rincian Barang Bermasalah
                  </div>
                  <button onClick={() => setItemDrafts(p => [...p, { product_name: '', sku: '', qty_expected: '', qty_actual: '', qty_damaged: '0', issue_note: '' }])} style={{ background: 'none', border: '1.5px solid #1c1917', borderRadius: '6px', padding: '4px 12px', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600 }}>
                    + Tambah Manual
                  </button>
                </div>

                {itemDrafts.length > 0 && (
                  <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 90px 90px 80px 1fr 32px', gap: '8px', marginBottom: '4px', padding: '0 4px' }}>
                    {['Nama Produk', 'SKU', 'Qty Pesan', 'Qty Terima', 'Rusak', 'Keterangan', ''].map(h => (
                      <div key={h} style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#a8a29e' }}>{h}</div>
                    ))}
                  </div>
                )}

                {itemDrafts.map((draft, idx) => {
                  const expected = Number(draft.qty_expected) || 0;
                  const actual   = Number(draft.qty_actual)   || 0;
                  const damaged  = Number(draft.qty_damaged)  || 0;
                  const diff     = actual - expected;
                  return (
                    <div key={idx} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 90px 90px 80px 1fr 32px', gap: '8px', marginBottom: '6px', alignItems: 'flex-start', background: diff !== 0 ? (diff < 0 ? '#fef2f2' : '#eff6ff') : 'transparent', borderRadius: '6px', padding: diff !== 0 ? '6px 4px' : '0 4px' }}>
                      <input className="form-input" placeholder="Nama produk" value={draft.product_name} onChange={e => updateDraft(idx, 'product_name', e.target.value)} style={{ fontSize: '0.82rem' }} />
                      <input className="form-input" placeholder="SKU" value={draft.sku} onChange={e => updateDraft(idx, 'sku', e.target.value)} style={{ fontSize: '0.82rem', fontFamily: 'monospace' }} />
                      <input className="form-input" type="number" min="0" value={draft.qty_expected} onChange={e => updateDraft(idx, 'qty_expected', e.target.value)} style={{ fontSize: '0.82rem', textAlign: 'right' }} />
                      <input className="form-input" type="number" min="0" value={draft.qty_actual} onChange={e => updateDraft(idx, 'qty_actual', e.target.value)} style={{ fontSize: '0.82rem', textAlign: 'right', borderColor: diff !== 0 ? (diff < 0 ? '#fca5a5' : '#93c5fd') : undefined }} />
                      <input className="form-input" type="number" min="0" value={draft.qty_damaged} onChange={e => updateDraft(idx, 'qty_damaged', e.target.value)} style={{ fontSize: '0.82rem', textAlign: 'right', borderColor: damaged > 0 ? '#fca5a5' : undefined }} />
                      <div>
                        <input className="form-input" placeholder="Keterangan" value={draft.issue_note} onChange={e => updateDraft(idx, 'issue_note', e.target.value)} style={{ fontSize: '0.82rem' }} />
                        {diff !== 0 && <div style={{ fontSize: '0.68rem', fontWeight: 700, color: diff < 0 ? '#dc2626' : '#1e40af', marginTop: '3px', paddingLeft: '2px' }}>{diff < 0 ? `⬇ Kurang ${Math.abs(diff)}` : `⬆ Lebih ${diff}`}</div>}
                        {damaged > 0 && <div style={{ fontSize: '0.68rem', fontWeight: 700, color: '#dc2626', paddingLeft: '2px' }}>⚠ {damaged} rusak</div>}
                      </div>
                      <button onClick={() => setItemDrafts(p => p.filter((_, i) => i !== idx))} style={{ background: '#fee2e2', border: 'none', borderRadius: '6px', width: '32px', height: '32px', cursor: 'pointer', color: '#dc2626', fontSize: '1rem', flexShrink: 0 }}>×</button>
                    </div>
                  );
                })}

                {itemDrafts.length === 0 && (
                  <div style={{ padding: '20px', background: '#f9f8f7', borderRadius: '8px', textAlign: 'center', fontSize: '0.82rem', color: '#a8a29e' }}>
                    Cari nomor PO/Invoice di atas untuk memuat produk secara otomatis, atau klik "+ Tambah Manual"
                  </div>
                )}
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={resetAdd}>Batal</button>
              <button className="btn-primary" onClick={handleCreate} disabled={saving || itemDrafts.length === 0}>{saving ? 'Menyimpan...' : 'Buat Berita Acara'}</button>
            </div>
          </div>
        </div>
      )}

      {/* VIEW Modal */}
      {selected && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setSelected(null); }}>
          <div className="modal" style={{ maxWidth: '820px' }}>
            <div className="modal-header">
              <div>
                <h2 style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '1.5rem', fontWeight: 600 }}>{selected.report_number}</h2>
                <div style={{ marginTop: '4px', display: 'flex', gap: '6px' }}>
                  <IssueBadge type={selected.issue_type} />
                  <StatusBadge status={selected.status} />
                </div>
              </div>
              <button onClick={() => setSelected(null)} style={{ background: 'none', border: 'none', fontSize: '1.2rem', cursor: 'pointer', color: '#78716c' }}>✕</button>
            </div>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div style={{ padding: '12px 14px', background: '#f9f8f7', borderRadius: '8px', fontSize: '0.85rem', lineHeight: 1.7 }}>
                  <div style={{ fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#a8a29e', marginBottom: '4px' }}>Referensi</div>
                  <strong>{selected.reference_number}</strong> ({selected.reference_type === 'purchase' ? 'PO' : 'Invoice'})<br />
                  {selected.party_type === 'supplier' ? 'Supplier' : 'Pelanggan'}: <strong>{selected.party_name}</strong><br />
                  Tanggal: {fmtDate(selected.report_date)}
                </div>
                <div style={{ padding: '12px 14px', background: '#fef9c3', borderRadius: '8px', fontSize: '0.85rem', borderLeft: '3px solid #d97706', lineHeight: 1.6 }}>
                  <div style={{ fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#92400e', marginBottom: '4px' }}>Deskripsi Masalah</div>
                  {selected.description}
                </div>
              </div>

              <table className="data-table">
                <thead>
                  <tr><th>Produk</th><th>SKU</th><th style={{ textAlign: 'right' }}>Seharusnya</th><th style={{ textAlign: 'right' }}>Aktual</th><th style={{ textAlign: 'right' }}>Rusak</th><th style={{ textAlign: 'right' }}>Selisih</th><th>Keterangan</th></tr>
                </thead>
                <tbody>
                  {drItems.map(item => {
                    const diff = item.qty_actual - item.qty_expected;
                    return (
                      <tr key={item.id} style={{ background: diff < 0 ? '#fef2f2' : diff > 0 ? '#eff6ff' : undefined }}>
                        <td style={{ fontWeight: 500 }}>{item.product_name}</td>
                        <td style={{ fontFamily: 'monospace', fontSize: '0.8rem', color: '#57534e' }}>{item.sku}</td>
                        <td style={{ textAlign: 'right' }}>{item.qty_expected}</td>
                        <td style={{ textAlign: 'right' }}>{item.qty_actual}</td>
                        <td style={{ textAlign: 'right', color: '#dc2626', fontWeight: item.qty_damaged > 0 ? 700 : 400 }}>{item.qty_damaged > 0 ? item.qty_damaged : '—'}</td>
                        <td style={{ textAlign: 'right', fontWeight: 700, color: diff < 0 ? '#c44223' : diff > 0 ? '#1e40af' : '#166534' }}>{diff === 0 ? '✓' : diff > 0 ? `+${diff}` : diff}</td>
                        <td style={{ fontSize: '0.82rem', color: '#78716c' }}>{item.issue_note ?? '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {selected.status !== 'resolved' && selected.status !== 'closed' && (
                <div className="form-group">
                  <label className="form-label">Resolusi / Tindak Lanjut</label>
                  <textarea className="form-input" rows={2} value={resolution} onChange={e => setResolution(e.target.value)} placeholder="Jelaskan tindakan yang diambil..." style={{ resize: 'vertical' }} />
                </div>
              )}

              {selected.resolution && (
                <div style={{ padding: '12px', background: '#f0fdf4', borderRadius: '8px', fontSize: '0.85rem', borderLeft: '3px solid #bbf7d0' }}>
                  <strong>✅ Resolusi:</strong> {selected.resolution}
                  {selected.resolved_by_name && <span style={{ color: '#78716c' }}> — {selected.resolved_by_name}, {fmtDate(selected.resolved_at)}</span>}
                </div>
              )}

              <div style={{ padding: '12px 14px', background: '#f9f8f7', borderRadius: '8px' }}>
                <div style={{ fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#a8a29e', marginBottom: '8px' }}>Kirim Berita Acara via Email</div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input className="form-input" style={{ flex: 1 }} type="email" placeholder={`Email ${selected.party_type === 'supplier' ? 'supplier' : 'pelanggan'}...`} value={emailTo} onChange={e => setEmailTo(e.target.value)} />
                  <button onClick={() => handleSendEmail(selected)} disabled={emailLoading} style={{ background: '#1c1917', color: '#d4a843', border: 'none', borderRadius: '8px', padding: '8px 16px', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600, whiteSpace: 'nowrap' }}>{emailLoading ? 'Mengirim...' : '📧 Kirim'}</button>
                </div>
              </div>
            </div>
            <div className="modal-footer" style={{ flexWrap: 'wrap', gap: '8px' }}>
              <button onClick={() => window.open(`/api/pdf/delivery-report/${selected.id}`, '_blank')} style={{ background: '#dbeafe', border: 'none', borderRadius: '8px', padding: '10px 16px', cursor: 'pointer', color: '#1e40af', fontWeight: 600, fontSize: '0.82rem' }}>🖨 Cetak PDF</button>
              {selected.status === 'open' && <button onClick={() => handleUpdateStatus(selected, 'proses')} style={{ background: '#fef9c3', border: 'none', borderRadius: '8px', padding: '10px 16px', cursor: 'pointer', color: '#854d0e', fontWeight: 600, fontSize: '0.82rem' }}>⚙ Tandai Diproses</button>}
              {(selected.status === 'open' || selected.status === 'proses') && <button onClick={() => handleUpdateStatus(selected, 'resolved')} className="btn-primary" style={{ background: 'linear-gradient(135deg,#16a34a,#15803d)' }}>✓ Tandai Selesai</button>}
              {selected.status === 'resolved' && <button onClick={() => handleUpdateStatus(selected, 'closed')} className="btn-primary">🔒 Tutup Laporan</button>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
