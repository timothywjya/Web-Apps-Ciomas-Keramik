'use client';
import { useState, useEffect, useCallback } from 'react';
import { useToast } from '@/lib/toast';
import { fetchJson, fetchJsonPost, getErrorMessage } from '@/lib/fetchJson';

interface GR {
  id: string; gr_number: string; po_number: string; supplier_name: string;
  received_date: string; status: 'draft'|'confirmed'|'partial';
  created_by_name: string; confirmed_by_name?: string; confirmed_at?: string;
  notes?: string;
}
interface GRItem {
  id: string; product_name: string; sku: string;
  qty_ordered: number; qty_received: number; qty_damaged: number;
  unit_price: number; notes?: string;
}
interface Purchase { id: string; purchase_number: string; supplier_name: string; total_amount: number; status: string; }

const rp = (n: number) => new Intl.NumberFormat('id-ID', { style:'currency', currency:'IDR', minimumFractionDigits:0 }).format(n||0);
const fmtDate = (d?: string) => d ? new Intl.DateTimeFormat('id-ID',{day:'2-digit',month:'short',year:'numeric'}).format(new Date(d)) : '—';

const STATUS_COLOR: Record<string,[string,string]> = {
  draft     : ['#854d0e','#fef9c3'],
  confirmed : ['#166534','#dcfce7'],
  partial   : ['#1e40af','#dbeafe'],
};
const STATUS_LABEL: Record<string,string> = { draft:'Draft', confirmed:'Dikonfirmasi', partial:'Sebagian' };

function Badge({ status }: { status: string }) {
  const [c,bg] = STATUS_COLOR[status] ?? ['#57534e','#f5f5f4'];
  return <span style={{ background:bg, color:c, padding:'2px 10px', borderRadius:'99px', fontSize:'0.72rem', fontWeight:700 }}>{STATUS_LABEL[status] ?? status}</span>;
}

export default function GoodsReceiptPage() {
  const toast = useToast();
  const [receipts, setReceipts]   = useState<GR[]>([]);
  const [loading, setLoading]     = useState(true);
  const [modal, setModal]         = useState<'add'|'view'|null>(null);
  const [selected, setSelected]   = useState<GR|null>(null);
  const [grItems, setGrItems]     = useState<GRItem[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [poId, setPoId]           = useState('');
  const [receivedDate, setReceivedDate] = useState(new Date().toISOString().split('T')[0]);
  const [notes, setNotes]         = useState('');
  const [editItems, setEditItems] = useState<Partial<GRItem>[]>([]);
  const [saving, setSaving]       = useState(false);
  const [emailTo, setEmailTo]     = useState('');
  const [emailLoading, setEmailLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const d = await fetchJson<{ receipts: GR[] }>('/api/goods-receipt');
      setReceipts(d.receipts || []);
    } catch (err) { toast.error('Gagal memuat BPB', getErrorMessage(err)); }
    finally { setLoading(false); }
  }, [toast]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    fetchJson<{ purchases: Purchase[] }>('/api/purchases?status=pending')
      .then(d => setPurchases(d.purchases || [])).catch(() => {});
  }, []);

  async function openView(gr: GR) {
    setSelected(gr);
    try {
      const d = await fetchJson<{ items: GRItem[] }>(`/api/goods-receipt/${gr.id}`);
      setGrItems(d.items || []);
    } catch (err) { toast.error('Gagal memuat detail', getErrorMessage(err)); }
    setModal('view');
  }

  async function loadPoItems(id: string) {
    if (!id) { setEditItems([]); return; }
    try {
      const d = await fetchJson<{ purchase: Purchase; items: GRItem[] }>(`/api/purchases/${id}`);
      setEditItems((d.items || []).map((i: GRItem) => ({
        ...i, qty_received: i.qty_ordered, qty_damaged: 0, notes: '',
      })));
    } catch (err) { toast.error('Gagal memuat PO', getErrorMessage(err)); }
  }

  function updateEditItem(idx: number, key: string, val: string | number) {
    setEditItems(prev => prev.map((item, i) => i === idx ? { ...item, [key]: Number(val) || 0 } : item));
  }

  async function handleCreate() {
    if (!poId) { toast.warning('Pilih Purchase Order terlebih dahulu'); return; }
    setSaving(true);
    try {
      await fetchJsonPost('/api/goods-receipt', {
        purchase_id: poId, received_date: receivedDate, notes,
        items: editItems.map(i => ({
          product_id: i.id, qty_ordered: i.qty_ordered,
          qty_received: i.qty_received, qty_damaged: i.qty_damaged,
          unit_price: i.unit_price, notes: i.notes,
        })),
      });
      toast.success('BPB berhasil dibuat');
      setModal(null); setPoId(''); setNotes(''); setEditItems([]);
      load();
    } catch (err) { toast.error('Gagal membuat BPB', getErrorMessage(err)); }
    finally { setSaving(false); }
  }

  async function handleConfirm(gr: GR) {
    const ok = await toast.confirm({
      title: 'Konfirmasi Penerimaan Barang',
      message: `Konfirmasi BPB ${gr.gr_number}? Stok produk akan diperbarui secara otomatis dan tidak bisa dibatalkan.`,
      confirmText: 'Ya, Konfirmasi', danger: false,
    });
    if (!ok) return;
    try {
      await fetchJsonPost(`/api/goods-receipt/${gr.id}`, { action: 'confirm' }, 'PATCH');
      toast.success('BPB dikonfirmasi! Stok telah diperbarui.');
      load(); setModal(null);
    } catch (err) { toast.error('Gagal konfirmasi', getErrorMessage(err)); }
  }

  async function handleSendEmail(gr: GR) {
    if (!emailTo) { toast.warning('Masukkan email supplier'); return; }
    setEmailLoading(true);
    try {
      await fetchJsonPost('/api/email', { type: 'goods_receipt', id: gr.id, to: emailTo });
      toast.success(`Email BPB dikirim ke ${emailTo}`);
      setEmailTo('');
    } catch (err) { toast.error('Gagal kirim email', getErrorMessage(err)); }
    finally { setEmailLoading(false); }
  }

  return (
    <div style={{ padding: '32px 28px' }}>
      <div className="page-header">
        <div>
          <h1 className="page-title">Bukti Penerimaan Barang</h1>
          <p className="page-subtitle">Validasi penerimaan PO sebelum stok ditambahkan</p>
        </div>
        <button className="btn-primary" onClick={() => setModal('add')}>+ Buat BPB</button>
      </div>

      {/* Info box */}
      <div style={{ background:'#eff6ff', border:'1px solid #bfdbfe', borderRadius:'10px', padding:'12px 16px', marginBottom:'20px', fontSize:'0.85rem', color:'#1e40af' }}>
        ℹ️ <strong>Alur Baru:</strong> PO tidak lagi otomatis menambah stok. Buat Bukti Penerimaan Barang (BPB) setelah barang datang, lakukan pengecekan fisik, lalu <strong>Konfirmasi</strong> untuk memperbarui stok.
      </div>

      <div className="card" style={{ padding:0, overflow:'hidden' }}>
        <table className="data-table">
          <thead>
            <tr><th>No. BPB</th><th>Referensi PO</th><th>Supplier</th><th>Tgl Terima</th><th>Status</th><th>Dibuat Oleh</th><th>Aksi</th></tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} style={{ textAlign:'center', padding:'40px' }}><div className="loading-spinner" style={{ margin:'0 auto' }} /></td></tr>
            ) : receipts.map(gr => (
              <tr key={gr.id}>
                <td style={{ fontFamily:'monospace', fontWeight:600, color:'#1c1917' }}>{gr.gr_number}</td>
                <td style={{ color:'#57534e' }}>{gr.po_number}</td>
                <td style={{ fontWeight:500 }}>{gr.supplier_name || '—'}</td>
                <td>{fmtDate(gr.received_date)}</td>
                <td><Badge status={gr.status} /></td>
                <td style={{ fontSize:'0.82rem', color:'#78716c' }}>{gr.created_by_name}</td>
                <td>
                  <div style={{ display:'flex', gap:'6px' }}>
                    <button onClick={() => openView(gr)} style={{ background:'#f5f5f4', border:'none', borderRadius:'6px', padding:'6px 10px', cursor:'pointer', fontSize:'0.75rem', color:'#57534e' }}>Detail</button>
                    <button onClick={() => window.open(`/api/pdf/goods-receipt/${gr.id}`, '_blank')} style={{ background:'#dbeafe', border:'none', borderRadius:'6px', padding:'6px 10px', cursor:'pointer', fontSize:'0.75rem', color:'#1e40af' }}>PDF</button>
                    {gr.status !== 'confirmed' && (
                      <button onClick={() => handleConfirm(gr)} style={{ background:'#dcfce7', border:'none', borderRadius:'6px', padding:'6px 10px', cursor:'pointer', fontSize:'0.75rem', color:'#166534', fontWeight:600 }}>✓ Konfirmasi</button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {!loading && receipts.length === 0 && <tr><td colSpan={7} style={{ textAlign:'center', padding:'40px', color:'#a8a29e' }}>Belum ada BPB</td></tr>}
          </tbody>
        </table>
      </div>

      {/* Add Modal */}
      {modal === 'add' && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setModal(null); }}>
          <div className="modal" style={{ maxWidth:'820px' }}>
            <div className="modal-header">
              <h2 style={{ fontFamily:'Cormorant Garamond,serif', fontSize:'1.5rem', fontWeight:600 }}>Buat Bukti Penerimaan Barang</h2>
              <button onClick={() => setModal(null)} style={{ background:'none', border:'none', fontSize:'1.2rem', cursor:'pointer' }}>✕</button>
            </div>
            <div className="modal-body" style={{ display:'flex', flexDirection:'column', gap:'16px' }}>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'12px' }}>
                <div className="form-group">
                  <label className="form-label">Purchase Order</label>
                  <select className="form-select" value={poId} onChange={e => { setPoId(e.target.value); loadPoItems(e.target.value); }}>
                    <option value="">— Pilih PO —</option>
                    {purchases.map(p => <option key={p.id} value={p.id}>{p.purchase_number} — {p.supplier_name}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Tanggal Terima</label>
                  <input className="form-input" type="date" value={receivedDate} onChange={e => setReceivedDate(e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">Catatan</label>
                  <input className="form-input" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Opsional" />
                </div>
              </div>

              {editItems.length > 0 && (
                <div>
                  <div style={{ fontSize:'0.75rem', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.08em', color:'#78716c', marginBottom:'8px' }}>Detail Penerimaan</div>
                  <table className="data-table">
                    <thead>
                      <tr><th>Produk</th><th>SKU</th><th style={{ textAlign:'right' }}>Dipesan</th><th style={{ textAlign:'right' }}>Diterima</th><th style={{ textAlign:'right' }}>Rusak</th><th>Catatan</th></tr>
                    </thead>
                    <tbody>
                      {editItems.map((item, idx) => (
                        <tr key={idx}>
                          <td style={{ fontWeight:500 }}>{item.product_name}</td>
                          <td style={{ fontFamily:'monospace', fontSize:'0.8rem' }}>{item.sku}</td>
                          <td style={{ textAlign:'right', color:'#78716c' }}>{item.qty_ordered}</td>
                          <td style={{ textAlign:'right' }}>
                            <input type="number" min={0} max={item.qty_ordered} value={item.qty_received ?? 0}
                              onChange={e => updateEditItem(idx, 'qty_received', e.target.value)}
                              style={{ width:'70px', padding:'4px 8px', border:'1px solid #e7e5e4', borderRadius:'6px', textAlign:'right' }} />
                          </td>
                          <td style={{ textAlign:'right' }}>
                            <input type="number" min={0} value={item.qty_damaged ?? 0}
                              onChange={e => updateEditItem(idx, 'qty_damaged', e.target.value)}
                              style={{ width:'70px', padding:'4px 8px', border:'1px solid #fecaca', borderRadius:'6px', textAlign:'right', color:'#dc2626' }} />
                          </td>
                          <td>
                            <input type="text" value={String(item.notes ?? '')}
                              onChange={e => setEditItems(prev => prev.map((p, i) => i === idx ? {...p, notes: e.target.value} : p))}
                              style={{ width:'100%', padding:'4px 8px', border:'1px solid #e7e5e4', borderRadius:'6px', fontSize:'0.82rem' }} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setModal(null)}>Batal</button>
              <button className="btn-primary" onClick={handleCreate} disabled={saving || !poId}>{saving ? 'Menyimpan...' : 'Simpan BPB'}</button>
            </div>
          </div>
        </div>
      )}

      {/* View Modal */}
      {modal === 'view' && selected && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setModal(null); }}>
          <div className="modal" style={{ maxWidth:'820px' }}>
            <div className="modal-header">
              <div>
                <h2 style={{ fontFamily:'Cormorant Garamond,serif', fontSize:'1.5rem', fontWeight:600 }}>{selected.gr_number}</h2>
                <div style={{ marginTop:'4px' }}><Badge status={selected.status} /></div>
              </div>
              <button onClick={() => setModal(null)} style={{ background:'none', border:'none', fontSize:'1.2rem', cursor:'pointer' }}>✕</button>
            </div>
            <div className="modal-body">
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px', marginBottom:'16px' }}>
                <div style={{ background:'#f9f8f7', borderRadius:'8px', padding:'12px 14px' }}>
                  <div style={{ fontSize:'0.7rem', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.08em', color:'#a8a29e', marginBottom:'6px' }}>Info BPB</div>
                  <div style={{ fontSize:'0.85rem', lineHeight:1.7 }}>
                    PO: <strong>{selected.po_number}</strong><br/>
                    Supplier: <strong>{selected.supplier_name || '—'}</strong><br/>
                    Tgl Terima: {fmtDate(selected.received_date)}<br/>
                    Dibuat: {selected.created_by_name}
                  </div>
                </div>
                <div style={{ background:'#f9f8f7', borderRadius:'8px', padding:'12px 14px' }}>
                  <div style={{ fontSize:'0.7rem', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.08em', color:'#a8a29e', marginBottom:'6px' }}>Status Validasi</div>
                  <div style={{ fontSize:'0.85rem', lineHeight:1.7 }}>
                    {selected.status === 'confirmed'
                      ? <><span style={{ color:'#166534', fontWeight:700 }}>✅ Dikonfirmasi</span><br/>Oleh: {selected.confirmed_by_name}<br/>Tgl: {fmtDate(selected.confirmed_at)}</>
                      : <span style={{ color:'#854d0e' }}>⏳ Menunggu konfirmasi — stok belum ditambahkan</span>}
                  </div>
                </div>
              </div>

              <table className="data-table">
                <thead><tr><th>Produk</th><th>SKU</th><th style={{ textAlign:'right' }}>Dipesan</th><th style={{ textAlign:'right' }}>Diterima</th><th style={{ textAlign:'right' }}>Rusak</th><th style={{ textAlign:'right' }}>Baik</th></tr></thead>
                <tbody>
                  {grItems.map((item) => (
                    <tr key={item.id}>
                      <td style={{ fontWeight:500 }}>{item.product_name}</td>
                      <td style={{ fontFamily:'monospace', fontSize:'0.8rem' }}>{item.sku}</td>
                      <td style={{ textAlign:'right' }}>{item.qty_ordered}</td>
                      <td style={{ textAlign:'right' }}>{item.qty_received}</td>
                      <td style={{ textAlign:'right', color:'#dc2626' }}>{item.qty_damaged > 0 ? item.qty_damaged : '—'}</td>
                      <td style={{ textAlign:'right', fontWeight:700, color:'#166534' }}>{item.qty_received - item.qty_damaged}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Email section */}
              <div style={{ marginTop:'16px', padding:'14px', background:'#f9f8f7', borderRadius:'8px' }}>
                <div style={{ fontSize:'0.75rem', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.08em', color:'#a8a29e', marginBottom:'8px' }}>Kirim Email ke Supplier</div>
                <div style={{ display:'flex', gap:'8px' }}>
                  <input className="form-input" style={{ flex:1 }} type="email" placeholder="Email supplier..." value={emailTo} onChange={e => setEmailTo(e.target.value)} />
                  <button onClick={() => handleSendEmail(selected)} disabled={emailLoading} style={{ background:'#1c1917', color:'#d4a843', border:'none', borderRadius:'8px', padding:'8px 16px', cursor:'pointer', fontSize:'0.82rem', fontWeight:600, whiteSpace:'nowrap' }}>
                    {emailLoading ? 'Mengirim...' : '📧 Kirim'}
                  </button>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => window.open(`/api/pdf/goods-receipt/${selected.id}`, '_blank')}>🖨 Cetak BPB</button>
              {selected.status !== 'confirmed' && (
                <button className="btn-primary" style={{ background:'linear-gradient(135deg,#16a34a,#15803d)' }} onClick={() => handleConfirm(selected)}>✓ Konfirmasi & Update Stok</button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
