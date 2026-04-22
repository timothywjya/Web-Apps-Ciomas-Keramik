'use client';
import { useState, useEffect, useCallback } from 'react';
import { useToast } from '@/lib/toast';
import { fetchJson, fetchJsonPost, getErrorMessage } from '@/lib/fetchJson';

interface DR {
  id: string; report_number: string; reference_number: string; reference_type: string;
  report_date: string; issue_type: string; status: string;
  party_name: string; party_type: string; party_email?: string;
  description: string; resolution?: string;
  created_by_name: string; resolved_by_name?: string; resolved_at?: string;
}
interface DRItem {
  id: string; product_name: string; sku: string;
  qty_expected: number; qty_actual: number; qty_damaged: number; issue_note?: string;
}

const rp = (n: number) => new Intl.NumberFormat('id-ID', { minimumFractionDigits:0 }).format(n||0);
const fmtDate = (d?: string) => d ? new Intl.DateTimeFormat('id-ID',{day:'2-digit',month:'short',year:'numeric'}).format(new Date(d)) : '—';

const ISSUE_LABELS: Record<string,string> = {
  kurang:'Barang Kurang', lebih:'Barang Lebih', rusak:'Barang Rusak',
  salah_produk:'Produk Salah', campuran:'Kendala Campuran',
};
const ISSUE_COLORS: Record<string,string> = {
  kurang:'#854d0e', lebih:'#1e40af', rusak:'#991b1b', salah_produk:'#6b21a8', campuran:'#374151',
};
const STATUS_COLORS: Record<string,[string,string]> = {
  open    : ['#991b1b','#fee2e2'],
  proses  : ['#854d0e','#fef9c3'],
  resolved: ['#166534','#dcfce7'],
  closed  : ['#57534e','#f5f5f4'],
};
const STATUS_LABELS: Record<string,string> = { open:'Open', proses:'Diproses', resolved:'Selesai', closed:'Ditutup' };

const EMPTY_FORM = {
  reference_type:'purchase', reference_id:'', reference_number:'',
  issue_type:'kurang', party_name:'', party_type:'supplier', party_email:'',
  description:'', items: [] as Partial<DRItem>[],
};

export default function DeliveryReportPage() {
  const toast = useToast();
  const [reports, setReports]   = useState<DR[]>([]);
  const [loading, setLoading]   = useState(true);
  const [modal, setModal]       = useState<'add'|'view'|null>(null);
  const [selected, setSelected] = useState<DR|null>(null);
  const [drItems, setDrItems]   = useState<DRItem[]>([]);
  const [form, setForm]         = useState({ ...EMPTY_FORM });
  const [saving, setSaving]     = useState(false);
  const [filterStatus, setFilterStatus] = useState('');
  const [resolution, setResolution]     = useState('');
  const [emailTo, setEmailTo]   = useState('');
  const [emailLoading, setEmailLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterStatus) params.set('status', filterStatus);
      const d = await fetchJson<{ reports: DR[] }>(`/api/delivery-report?${params}`);
      setReports(d.reports || []);
    } catch (err) { toast.error('Gagal memuat data', getErrorMessage(err)); }
    finally { setLoading(false); }
  }, [filterStatus, toast]);

  useEffect(() => { load(); }, [load]);

  function addItem() {
    setForm(f => ({ ...f, items: [...f.items, { product_name:'', sku:'', qty_expected:0, qty_actual:0, qty_damaged:0, issue_note:'' }] }));
  }
  function removeItem(idx: number) {
    setForm(f => ({ ...f, items: f.items.filter((_,i) => i !== idx) }));
  }
  function updateItem(idx: number, key: string, val: string | number) {
    setForm(f => ({ ...f, items: f.items.map((item, i) => i === idx ? { ...item, [key]: val } : item) }));
  }

  async function openView(dr: DR) {
    setSelected(dr);
    setResolution(dr.resolution ?? '');
    setEmailTo(dr.party_email ?? '');
    try {
      const d = await fetchJson<{ items: DRItem[] }>(`/api/delivery-report/${dr.id}`);
      setDrItems(d.items || []);
    } catch (err) { toast.error('Gagal memuat detail', getErrorMessage(err)); }
    setModal('view');
  }

  async function handleCreate() {
    if (!form.description.trim()) { toast.warning('Deskripsi masalah wajib diisi'); return; }
    if (form.items.length === 0)  { toast.warning('Tambahkan minimal 1 item barang'); return; }
    setSaving(true);
    try {
      await fetchJsonPost('/api/delivery-report', {
        ...form,
        items: form.items.map(i => ({
          product_id  : '',
          product_name: i.product_name, sku: i.sku,
          qty_expected: Number(i.qty_expected), qty_actual: Number(i.qty_actual),
          qty_damaged : Number(i.qty_damaged), issue_note: i.issue_note,
        })),
      });
      toast.success('Berita Acara berhasil dibuat');
      setModal(null); setForm({ ...EMPTY_FORM }); load();
    } catch (err) { toast.error('Gagal membuat BA', getErrorMessage(err)); }
    finally { setSaving(false); }
  }

  async function handleUpdateStatus(dr: DR, newStatus: string) {
    try {
      await fetchJsonPost(`/api/delivery-report/${dr.id}`, { status: newStatus, resolution }, 'PATCH');
      toast.success(`Status diperbarui: ${STATUS_LABELS[newStatus]}`);
      load(); setModal(null);
    } catch (err) { toast.error('Gagal update status', getErrorMessage(err)); }
  }

  async function handleSendEmail(dr: DR) {
    if (!emailTo) { toast.warning('Masukkan email tujuan'); return; }
    setEmailLoading(true);
    try {
      await fetchJsonPost('/api/email', { type:'delivery_report', id: dr.id, to: emailTo, toName: dr.party_name });
      toast.success(`Email Berita Acara dikirim ke ${emailTo}`);
    } catch (err) { toast.error('Gagal kirim email', getErrorMessage(err)); }
    finally { setEmailLoading(false); }
  }

  return (
    <div style={{ padding:'32px 28px' }}>
      <div className="page-header">
        <div>
          <h1 className="page-title">Berita Acara Pengiriman</h1>
          <p className="page-subtitle">Kendala pengiriman — barang kurang, lebih, atau rusak</p>
        </div>
        <button className="btn-primary" onClick={() => { setForm({ ...EMPTY_FORM }); setModal('add'); }}>+ Buat Berita Acara</button>
      </div>

      {/* Filter */}
      <div className="card" style={{ marginBottom:'16px', padding:'12px 16px' }}>
        <div style={{ display:'flex', gap:'8px', alignItems:'center', flexWrap:'wrap' }}>
          <span style={{ fontSize:'0.8rem', color:'#78716c', fontWeight:500 }}>Filter Status:</span>
          {['', 'open', 'proses', 'resolved', 'closed'].map(s => (
            <button key={s} onClick={() => setFilterStatus(s)} style={{
              padding:'5px 12px', borderRadius:'20px', border:'none', cursor:'pointer', fontSize:'0.75rem', fontWeight:500, transition:'all 0.2s',
              background: filterStatus === s ? '#1c1917' : '#f5f5f4',
              color: filterStatus === s ? '#d4a843' : '#57534e',
            }}>
              {s === '' ? 'Semua' : STATUS_LABELS[s]}
            </button>
          ))}
          <div style={{ marginLeft:'auto', fontSize:'0.8rem', color:'#78716c' }}>{reports.length} laporan</div>
        </div>
      </div>

      <div className="card" style={{ padding:0, overflow:'hidden' }}>
        <table className="data-table">
          <thead>
            <tr><th>No. Laporan</th><th>Ref. Dokumen</th><th>Pihak</th><th>Jenis Kendala</th><th>Tanggal</th><th>Status</th><th>Aksi</th></tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} style={{ textAlign:'center', padding:'40px' }}><div className="loading-spinner" style={{ margin:'0 auto' }} /></td></tr>
            ) : reports.map(dr => {
              const [c,bg] = STATUS_COLORS[dr.status] ?? ['#57534e','#f5f5f4'];
              return (
                <tr key={dr.id}>
                  <td style={{ fontFamily:'monospace', fontWeight:600 }}>{dr.report_number}</td>
                  <td>
                    <div style={{ fontWeight:500 }}>{dr.reference_number}</div>
                    <div style={{ fontSize:'0.75rem', color:'#a8a29e' }}>{dr.reference_type === 'purchase' ? 'Pembelian' : 'Penjualan'}</div>
                  </td>
                  <td>
                    <div style={{ fontWeight:500 }}>{dr.party_name}</div>
                    <div style={{ fontSize:'0.75rem', color:'#a8a29e' }}>{dr.party_type === 'supplier' ? 'Supplier' : 'Pelanggan'}</div>
                  </td>
                  <td>
                    <span style={{ background:`${ISSUE_COLORS[dr.issue_type]}15`, color:ISSUE_COLORS[dr.issue_type], padding:'2px 9px', borderRadius:'99px', fontSize:'0.72rem', fontWeight:700 }}>
                      {ISSUE_LABELS[dr.issue_type] ?? dr.issue_type}
                    </span>
                  </td>
                  <td>{fmtDate(dr.report_date)}</td>
                  <td><span style={{ background:bg, color:c, padding:'2px 10px', borderRadius:'99px', fontSize:'0.72rem', fontWeight:700 }}>{STATUS_LABELS[dr.status]}</span></td>
                  <td>
                    <div style={{ display:'flex', gap:'6px' }}>
                      <button onClick={() => openView(dr)} style={{ background:'#f5f5f4', border:'none', borderRadius:'6px', padding:'6px 10px', cursor:'pointer', fontSize:'0.75rem' }}>Detail</button>
                      <button onClick={() => window.open(`/api/pdf/delivery-report/${dr.id}`, '_blank')} style={{ background:'#dbeafe', border:'none', borderRadius:'6px', padding:'6px 10px', cursor:'pointer', fontSize:'0.75rem', color:'#1e40af' }}>PDF</button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {!loading && reports.length === 0 && <tr><td colSpan={7} style={{ textAlign:'center', padding:'40px', color:'#a8a29e' }}>Tidak ada berita acara</td></tr>}
          </tbody>
        </table>
      </div>

      {/* ADD Modal */}
      {modal === 'add' && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setModal(null); }}>
          <div className="modal" style={{ maxWidth:'820px' }}>
            <div className="modal-header">
              <h2 style={{ fontFamily:'Cormorant Garamond,serif', fontSize:'1.5rem', fontWeight:600 }}>Buat Berita Acara Kendala Pengiriman</h2>
              <button onClick={() => setModal(null)} style={{ background:'none', border:'none', fontSize:'1.2rem', cursor:'pointer' }}>✕</button>
            </div>
            <div className="modal-body" style={{ display:'flex', flexDirection:'column', gap:'14px' }}>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'12px' }}>
                <div className="form-group">
                  <label className="form-label">Tipe Referensi</label>
                  <select className="form-select" value={form.reference_type} onChange={e => setForm(f => ({ ...f, reference_type:e.target.value }))}>
                    <option value="purchase">Purchase Order</option>
                    <option value="sale">Sales Invoice</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">No. Dokumen Referensi</label>
                  <input className="form-input" value={form.reference_number} onChange={e => setForm(f => ({ ...f, reference_number:e.target.value }))} placeholder="PO-2024-001" />
                </div>
                <div className="form-group">
                  <label className="form-label">Jenis Kendala</label>
                  <select className="form-select" value={form.issue_type} onChange={e => setForm(f => ({ ...f, issue_type:e.target.value }))}>
                    {Object.entries(ISSUE_LABELS).map(([k,v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'12px' }}>
                <div className="form-group">
                  <label className="form-label">Nama Pihak (Supplier/Pelanggan)</label>
                  <input className="form-input" value={form.party_name} onChange={e => setForm(f => ({ ...f, party_name:e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Tipe Pihak</label>
                  <select className="form-select" value={form.party_type} onChange={e => setForm(f => ({ ...f, party_type:e.target.value }))}>
                    <option value="supplier">Supplier</option>
                    <option value="customer">Pelanggan</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Email Pihak</label>
                  <input className="form-input" type="email" value={form.party_email} onChange={e => setForm(f => ({ ...f, party_email:e.target.value }))} />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Deskripsi Masalah</label>
                <textarea className="form-input" rows={3} value={form.description} onChange={e => setForm(f => ({ ...f, description:e.target.value }))} placeholder="Jelaskan kendala pengiriman secara detail..." style={{ resize:'vertical' }} />
              </div>

              {/* Items */}
              <div>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'8px' }}>
                  <div style={{ fontSize:'0.75rem', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.08em', color:'#78716c' }}>Daftar Barang Bermasalah</div>
                  <button onClick={addItem} style={{ background:'none', border:'1.5px solid #1c1917', borderRadius:'6px', padding:'4px 12px', cursor:'pointer', fontSize:'0.75rem', fontWeight:600 }}>+ Tambah Item</button>
                </div>
                {form.items.map((item, idx) => (
                  <div key={idx} style={{ display:'grid', gridTemplateColumns:'2fr 1fr 80px 80px 80px 1fr 32px', gap:'8px', marginBottom:'8px', alignItems:'center' }}>
                    <input className="form-input" placeholder="Nama produk" value={item.product_name ?? ''} onChange={e => updateItem(idx, 'product_name', e.target.value)} style={{ fontSize:'0.82rem' }} />
                    <input className="form-input" placeholder="SKU" value={item.sku ?? ''} onChange={e => updateItem(idx, 'sku', e.target.value)} style={{ fontSize:'0.82rem', fontFamily:'monospace' }} />
                    <input className="form-input" type="number" placeholder="Harusnya" value={item.qty_expected ?? 0} onChange={e => updateItem(idx, 'qty_expected', e.target.value)} style={{ fontSize:'0.82rem', textAlign:'right' }} />
                    <input className="form-input" type="number" placeholder="Aktual" value={item.qty_actual ?? 0} onChange={e => updateItem(idx, 'qty_actual', e.target.value)} style={{ fontSize:'0.82rem', textAlign:'right' }} />
                    <input className="form-input" type="number" placeholder="Rusak" value={item.qty_damaged ?? 0} onChange={e => updateItem(idx, 'qty_damaged', e.target.value)} style={{ fontSize:'0.82rem', textAlign:'right', borderColor:'#fecaca' }} />
                    <input className="form-input" placeholder="Keterangan" value={item.issue_note ?? ''} onChange={e => updateItem(idx, 'issue_note', e.target.value)} style={{ fontSize:'0.82rem' }} />
                    <button onClick={() => removeItem(idx)} style={{ background:'#fee2e2', border:'none', borderRadius:'6px', width:'32px', height:'32px', cursor:'pointer', color:'#dc2626', fontSize:'1rem' }}>×</button>
                  </div>
                ))}
                {form.items.length === 0 && <div style={{ fontSize:'0.82rem', color:'#a8a29e', padding:'12px', background:'#f9f8f7', borderRadius:'6px', textAlign:'center' }}>Klik "+ Tambah Item" untuk menambah barang bermasalah</div>}
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setModal(null)}>Batal</button>
              <button className="btn-primary" onClick={handleCreate} disabled={saving}>{saving ? 'Menyimpan...' : 'Buat Berita Acara'}</button>
            </div>
          </div>
        </div>
      )}

      {/* VIEW Modal */}
      {modal === 'view' && selected && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setModal(null); }}>
          <div className="modal" style={{ maxWidth:'820px' }}>
            <div className="modal-header">
              <div>
                <h2 style={{ fontFamily:'Cormorant Garamond,serif', fontSize:'1.5rem', fontWeight:600 }}>{selected.report_number}</h2>
                <div style={{ marginTop:'4px' }}>
                  <span style={{ background:`${ISSUE_COLORS[selected.issue_type]}15`, color:ISSUE_COLORS[selected.issue_type], padding:'2px 9px', borderRadius:'99px', fontSize:'0.72rem', fontWeight:700, marginRight:'6px' }}>{ISSUE_LABELS[selected.issue_type]}</span>
                  <span style={{ background:STATUS_COLORS[selected.status]?.[1], color:STATUS_COLORS[selected.status]?.[0], padding:'2px 9px', borderRadius:'99px', fontSize:'0.72rem', fontWeight:700 }}>{STATUS_LABELS[selected.status]}</span>
                </div>
              </div>
              <button onClick={() => setModal(null)} style={{ background:'none', border:'none', fontSize:'1.2rem', cursor:'pointer' }}>✕</button>
            </div>
            <div className="modal-body" style={{ display:'flex', flexDirection:'column', gap:'14px' }}>
              <div style={{ padding:'12px', background:'#fafaf9', borderRadius:'8px', fontSize:'0.85rem', lineHeight:1.7 }}>
                <strong>Ref:</strong> {selected.reference_number} ({selected.reference_type === 'purchase' ? 'Pembelian' : 'Penjualan'}) ·
                <strong> Pihak:</strong> {selected.party_name} ({selected.party_type === 'supplier' ? 'Supplier' : 'Pelanggan'}) ·
                <strong> Tanggal:</strong> {fmtDate(selected.report_date)}
              </div>
              <div style={{ padding:'12px', background:'#fef9c3', borderRadius:'8px', fontSize:'0.85rem', borderLeft:'3px solid #d97706' }}>
                <strong>Deskripsi:</strong> {selected.description}
              </div>

              <table className="data-table">
                <thead><tr><th>Produk</th><th>SKU</th><th style={{ textAlign:'right' }}>Seharusnya</th><th style={{ textAlign:'right' }}>Aktual</th><th style={{ textAlign:'right' }}>Rusak</th><th style={{ textAlign:'right' }}>Selisih</th></tr></thead>
                <tbody>
                  {drItems.map(item => {
                    const diff = item.qty_actual - item.qty_expected;
                    return (
                      <tr key={item.id}>
                        <td style={{ fontWeight:500 }}>{item.product_name}</td>
                        <td style={{ fontFamily:'monospace', fontSize:'0.8rem' }}>{item.sku}</td>
                        <td style={{ textAlign:'right' }}>{rp(item.qty_expected)}</td>
                        <td style={{ textAlign:'right' }}>{rp(item.qty_actual)}</td>
                        <td style={{ textAlign:'right', color:'#dc2626' }}>{item.qty_damaged > 0 ? item.qty_damaged : '—'}</td>
                        <td style={{ textAlign:'right', fontWeight:700, color: diff < 0 ? '#c44223' : diff > 0 ? '#1e40af' : '#166534' }}>
                          {diff > 0 ? '+' : ''}{diff}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {/* Resolution */}
              {selected.status !== 'resolved' && selected.status !== 'closed' && (
                <div className="form-group">
                  <label className="form-label">Resolusi / Tindak Lanjut</label>
                  <textarea className="form-input" rows={2} value={resolution} onChange={e => setResolution(e.target.value)} placeholder="Jelaskan tindakan yang diambil..." style={{ resize:'vertical' }} />
                </div>
              )}
              {selected.resolution && (
                <div style={{ padding:'12px', background:'#f0fdf4', borderRadius:'8px', fontSize:'0.85rem', borderLeft:'3px solid #bbf7d0' }}>
                  <strong>✅ Resolusi:</strong> {selected.resolution}
                </div>
              )}

              {/* Email */}
              <div style={{ padding:'12px', background:'#f9f8f7', borderRadius:'8px' }}>
                <div style={{ fontSize:'0.75rem', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.08em', color:'#a8a29e', marginBottom:'8px' }}>Kirim Berita Acara via Email</div>
                <div style={{ display:'flex', gap:'8px' }}>
                  <input className="form-input" style={{ flex:1 }} type="email" placeholder={`Email ${selected.party_type === 'supplier' ? 'supplier' : 'pelanggan'}...`} value={emailTo} onChange={e => setEmailTo(e.target.value)} />
                  <button onClick={() => handleSendEmail(selected)} disabled={emailLoading} style={{ background:'#1c1917', color:'#d4a843', border:'none', borderRadius:'8px', padding:'8px 16px', cursor:'pointer', fontSize:'0.82rem', fontWeight:600, whiteSpace:'nowrap' }}>
                    {emailLoading ? 'Mengirim...' : '📧 Kirim'}
                  </button>
                </div>
              </div>
            </div>
            <div className="modal-footer" style={{ flexWrap:'wrap', gap:'8px' }}>
              <button onClick={() => window.open(`/api/pdf/delivery-report/${selected.id}`, '_blank')} style={{ background:'#dbeafe', border:'none', borderRadius:'8px', padding:'10px 16px', cursor:'pointer', color:'#1e40af', fontWeight:600, fontSize:'0.82rem' }}>🖨 Cetak PDF</button>
              {selected.status === 'open' && <button onClick={() => handleUpdateStatus(selected, 'proses')} style={{ background:'#fef9c3', border:'none', borderRadius:'8px', padding:'10px 16px', cursor:'pointer', color:'#854d0e', fontWeight:600, fontSize:'0.82rem' }}>⚙ Tandai Diproses</button>}
              {(selected.status === 'open' || selected.status === 'proses') && <button onClick={() => handleUpdateStatus(selected, 'resolved')} className="btn-primary" style={{ background:'linear-gradient(135deg,#16a34a,#15803d)' }}>✓ Tandai Selesai</button>}
              {selected.status === 'resolved' && <button onClick={() => handleUpdateStatus(selected, 'closed')} className="btn-primary">🔒 Tutup Laporan</button>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
