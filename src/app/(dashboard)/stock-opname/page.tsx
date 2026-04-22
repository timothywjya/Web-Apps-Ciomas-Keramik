'use client';
import { useState, useEffect, useCallback } from 'react';
import { useToast } from '@/lib/toast';
import { fetchJson, fetchJsonPost, getErrorMessage } from '@/lib/fetchJson';

interface Opname {
  id: string; opname_number: string; opname_date: string;
  status: 'draft'|'counting'|'review'|'confirmed'|'cancelled';
  notes?: string; total_items: number; total_discrepancy: number;
  created_by_name: string; confirmed_by_name?: string; confirmed_at?: string;
}
interface OpnameItem {
  id: string; product_id: string; sku: string; product_name: string;
  system_qty: number; physical_qty: number | null; difference: number;
  unit_price: number; notes?: string; counted_by_name?: string;
}

const rp = (n: number) => new Intl.NumberFormat('id-ID', { style:'currency', currency:'IDR', minimumFractionDigits:0 }).format(n||0);
const fmtDate = (d?: string) => d ? new Intl.DateTimeFormat('id-ID',{day:'2-digit',month:'short',year:'numeric'}).format(new Date(d)) : '—';

const STATUS_COLORS: Record<string,[string,string]> = {
  draft    : ['#57534e','#f5f5f4'],
  counting : ['#854d0e','#fef9c3'],
  review   : ['#1e40af','#dbeafe'],
  confirmed: ['#166534','#dcfce7'],
  cancelled: ['#991b1b','#fee2e2'],
};
const STATUS_LABELS: Record<string,string> = { draft:'Draft', counting:'Sedang Dihitung', review:'Review', confirmed:'Dikonfirmasi', cancelled:'Dibatalkan' };

export default function StockOpnamePage() {
  const toast = useToast();
  const [opnames, setOpnames]     = useState<Opname[]>([]);
  const [loading, setLoading]     = useState(true);
  const [modal, setModal]         = useState<'add'|'count'|null>(null);
  const [selected, setSelected]   = useState<Opname|null>(null);
  const [opItems, setOpItems]     = useState<OpnameItem[]>([]);
  const [opnameDate, setOpnameDate] = useState(new Date().toISOString().split('T')[0]);
  const [opNotes, setOpNotes]     = useState('');
  const [saving, setSaving]       = useState(false);
  const [countEdits, setCountEdits] = useState<Record<string,{ physical_qty:string; notes:string }>>({});
  const [searchTerm, setSearchTerm] = useState('');
  const [filterDiff, setFilterDiff] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const d = await fetchJson<{ opnames: Opname[] }>('/api/stock-opname');
      setOpnames(d.opnames || []);
    } catch (err) { toast.error('Gagal memuat data', getErrorMessage(err)); }
    finally { setLoading(false); }
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  async function openCount(op: Opname) {
    setSelected(op);
    setSearchTerm(''); setFilterDiff(false);
    try {
      const d = await fetchJson<{ items: OpnameItem[] }>(`/api/stock-opname/${op.id}`);
      const items = d.items || [];
      setOpItems(items);
      const edits: Record<string,{ physical_qty:string; notes:string }> = {};
      items.forEach(i => {
        edits[i.id] = { physical_qty: i.physical_qty !== null ? String(i.physical_qty) : '', notes: i.notes ?? '' };
      });
      setCountEdits(edits);
    } catch (err) { toast.error('Gagal memuat detail', getErrorMessage(err)); }
    setModal('count');
  }

  async function handleCreate() {
    setSaving(true);
    try {
      const d = await fetchJsonPost<{ opname: { opname_number: string; total_items: number } }>('/api/stock-opname', { opname_date: opnameDate, notes: opNotes });
      toast.success(`Opname ${d.opname.opname_number} dibuat — ${d.opname.total_items} produk di-snapshot`);
      setModal(null); setOpNotes(''); load();
    } catch (err) { toast.error('Gagal membuat opname', getErrorMessage(err)); }
    finally { setSaving(false); }
  }

  async function handleSaveCount(itemId: string) {
    const edit = countEdits[itemId];
    if (edit.physical_qty === '') return;
    try {
      await fetchJsonPost(`/api/stock-opname/${selected!.id}`, {
        item_id: itemId, physical_qty: Number(edit.physical_qty), notes: edit.notes,
      }, 'PUT');
      // Update local state
      setOpItems(prev => prev.map(i => i.id === itemId
        ? { ...i, physical_qty: Number(edit.physical_qty), difference: Number(edit.physical_qty) - i.system_qty }
        : i
      ));
    } catch (err) { toast.error('Gagal simpan hitungan', getErrorMessage(err)); }
  }

  async function handleSaveAllCounts() {
    setSaving(true);
    let saved = 0;
    for (const [itemId, edit] of Object.entries(countEdits)) {
      if (edit.physical_qty === '') continue;
      try {
        await fetchJsonPost(`/api/stock-opname/${selected!.id}`, {
          item_id: itemId, physical_qty: Number(edit.physical_qty), notes: edit.notes,
        }, 'PUT');
        saved++;
      } catch { /* ignore individual errors */ }
    }
    toast.success(`${saved} item berhasil disimpan`);
    setSaving(false);
  }

  async function handleConfirm(op: Opname) {
    const uncounted = opItems.filter(i => i.physical_qty === null).length;
    const confirmMsg = uncounted > 0
      ? `Masih ada ${uncounted} item yang belum dihitung. Lanjutkan konfirmasi? Item yang belum dihitung tidak akan disesuaikan.`
      : `Konfirmasi Stock Opname ${op.opname_number}? Semua selisih akan diterapkan ke stok aktual. Tindakan ini tidak bisa dibatalkan.`;

    const ok = await toast.confirm({ title:'Konfirmasi Stock Opname', message: confirmMsg, confirmText:'Ya, Konfirmasi', danger: false });
    if (!ok) return;
    try {
      const d = await fetchJsonPost<{ message: string }>(`/api/stock-opname/${op.id}`, { action:'confirm' }, 'PATCH');
      toast.success(d.message ?? 'Opname dikonfirmasi');
      load(); setModal(null);
    } catch (err) { toast.error('Gagal konfirmasi', getErrorMessage(err)); }
  }

  const filteredItems = opItems.filter(i => {
    if (filterDiff && i.difference === 0 && i.physical_qty !== null) return false;
    if (searchTerm && !i.product_name.toLowerCase().includes(searchTerm.toLowerCase()) && !i.sku.toLowerCase().includes(searchTerm.toLowerCase())) return false;
    return true;
  });

  const countedCount = opItems.filter(i => i.physical_qty !== null).length;
  const diffCount    = opItems.filter(i => i.difference !== 0).length;

  return (
    <div style={{ padding:'32px 28px' }}>
      <div className="page-header">
        <div>
          <h1 className="page-title">Stock Opname</h1>
          <p className="page-subtitle">Penghitungan fisik stok dan penyesuaian</p>
        </div>
        <button className="btn-primary" onClick={() => setModal('add')}>+ Mulai Opname Baru</button>
      </div>

      <div className="card" style={{ padding:0, overflow:'hidden' }}>
        <table className="data-table">
          <thead>
            <tr><th>No. Opname</th><th>Tanggal</th><th>Status</th><th style={{ textAlign:'right' }}>Total SKU</th><th style={{ textAlign:'right' }}>Selisih</th><th>Dibuat Oleh</th><th>Dikonfirmasi Oleh</th><th>Aksi</th></tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} style={{ textAlign:'center', padding:'40px' }}><div className="loading-spinner" style={{ margin:'0 auto' }} /></td></tr>
            ) : opnames.map(op => {
              const [c,bg] = STATUS_COLORS[op.status] ?? ['#57534e','#f5f5f4'];
              return (
                <tr key={op.id}>
                  <td style={{ fontFamily:'monospace', fontWeight:600 }}>{op.opname_number}</td>
                  <td>{fmtDate(op.opname_date)}</td>
                  <td><span style={{ background:bg, color:c, padding:'2px 10px', borderRadius:'99px', fontSize:'0.72rem', fontWeight:700 }}>{STATUS_LABELS[op.status]}</span></td>
                  <td style={{ textAlign:'right', fontWeight:600 }}>{op.total_items}</td>
                  <td style={{ textAlign:'right', color: op.total_discrepancy > 0 ? '#c44223' : '#78716c', fontWeight: op.total_discrepancy > 0 ? 700 : 400 }}>
                    {op.total_discrepancy > 0 ? `⚠ ${op.total_discrepancy}` : '—'}
                  </td>
                  <td style={{ fontSize:'0.82rem', color:'#78716c' }}>{op.created_by_name}</td>
                  <td style={{ fontSize:'0.82rem', color:'#78716c' }}>{op.confirmed_by_name ?? '—'}</td>
                  <td>
                    <div style={{ display:'flex', gap:'6px' }}>
                      {op.status !== 'confirmed' && op.status !== 'cancelled' && (
                        <button onClick={() => openCount(op)} style={{ background:'#fef9c3', border:'none', borderRadius:'6px', padding:'6px 10px', cursor:'pointer', fontSize:'0.75rem', color:'#854d0e', fontWeight:600 }}>📋 Hitung</button>
                      )}
                      {op.status === 'confirmed' && (
                        <button onClick={() => openCount(op)} style={{ background:'#f5f5f4', border:'none', borderRadius:'6px', padding:'6px 10px', cursor:'pointer', fontSize:'0.75rem' }}>Detail</button>
                      )}
                      <button onClick={() => window.open(`/api/pdf/stock-opname/${op.id}`, '_blank')} style={{ background:'#dbeafe', border:'none', borderRadius:'6px', padding:'6px 10px', cursor:'pointer', fontSize:'0.75rem', color:'#1e40af' }}>PDF</button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {!loading && opnames.length === 0 && <tr><td colSpan={8} style={{ textAlign:'center', padding:'40px', color:'#a8a29e' }}>Belum ada stock opname</td></tr>}
          </tbody>
        </table>
      </div>

      {/* Create Modal */}
      {modal === 'add' && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setModal(null); }}>
          <div className="modal" style={{ maxWidth:'480px' }}>
            <div className="modal-header">
              <h2 style={{ fontFamily:'Cormorant Garamond,serif', fontSize:'1.5rem', fontWeight:600 }}>Mulai Stock Opname Baru</h2>
              <button onClick={() => setModal(null)} style={{ background:'none', border:'none', fontSize:'1.2rem', cursor:'pointer' }}>✕</button>
            </div>
            <div className="modal-body">
              <div style={{ background:'#eff6ff', borderRadius:'8px', padding:'12px 14px', marginBottom:'16px', fontSize:'0.85rem', color:'#1e40af' }}>
                ℹ️ Saat opname dibuat, sistem akan mengambil <strong>snapshot stok semua produk aktif</strong> sebagai acuan penghitungan fisik.
              </div>
              <div style={{ display:'flex', flexDirection:'column', gap:'14px' }}>
                <div className="form-group">
                  <label className="form-label">Tanggal Opname</label>
                  <input className="form-input" type="date" value={opnameDate} onChange={e => setOpnameDate(e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">Catatan</label>
                  <textarea className="form-input" rows={3} value={opNotes} onChange={e => setOpNotes(e.target.value)} placeholder="cth: Opname akhir bulan Q1..." style={{ resize:'vertical' }} />
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setModal(null)}>Batal</button>
              <button className="btn-primary" onClick={handleCreate} disabled={saving}>{saving ? 'Membuat...' : 'Buat Opname'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Count Modal */}
      {modal === 'count' && selected && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', backdropFilter:'blur(4px)', zIndex:100, display:'flex', alignItems:'flex-start', justifyContent:'center', padding:'16px', overflowY:'auto' }}>
          <div style={{ background:'white', borderRadius:'16px', width:'100%', maxWidth:'1100px', boxShadow:'0 24px 48px rgba(0,0,0,0.2)', marginTop:'16px' }}>
            {/* Header */}
            <div style={{ padding:'20px 28px', borderBottom:'1px solid #f0ece8', display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
              <div>
                <h2 style={{ fontFamily:'Cormorant Garamond,serif', fontSize:'1.5rem', fontWeight:600 }}>{selected.opname_number}</h2>
                <div style={{ fontSize:'0.82rem', color:'#78716c', marginTop:'4px' }}>
                  Tanggal: {fmtDate(selected.opname_date)} ·
                  Dihitung: <strong style={{ color:'#166534' }}>{countedCount}/{opItems.length}</strong> ·
                  Selisih: <strong style={{ color: diffCount > 0 ? '#c44223' : '#166534' }}>{diffCount} item</strong>
                </div>
              </div>
              <button onClick={() => setModal(null)} style={{ background:'none', border:'none', fontSize:'1.2rem', cursor:'pointer', color:'#78716c' }}>✕</button>
            </div>

            {/* Toolbar */}
            <div style={{ padding:'12px 24px', borderBottom:'1px solid #f0ece8', display:'flex', gap:'10px', alignItems:'center', flexWrap:'wrap' }}>
              <input className="search-input" style={{ width:'240px' }} placeholder="Cari produk / SKU..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
              <label style={{ display:'flex', alignItems:'center', gap:'6px', fontSize:'0.82rem', cursor:'pointer', color:'#57534e' }}>
                <input type="checkbox" checked={filterDiff} onChange={e => setFilterDiff(e.target.checked)} />
                Tampilkan hanya yang belum/berbeda
              </label>
              <div style={{ marginLeft:'auto', display:'flex', gap:'8px' }}>
                {selected.status !== 'confirmed' && (
                  <>
                    <button onClick={handleSaveAllCounts} disabled={saving} style={{ background:'#1c1917', color:'#d4a843', border:'none', borderRadius:'8px', padding:'8px 16px', cursor:'pointer', fontSize:'0.82rem', fontWeight:600 }}>
                      {saving ? 'Menyimpan...' : '💾 Simpan Semua'}
                    </button>
                    <button onClick={() => handleConfirm(selected)} style={{ background:'linear-gradient(135deg,#16a34a,#15803d)', color:'white', border:'none', borderRadius:'8px', padding:'8px 16px', cursor:'pointer', fontSize:'0.82rem', fontWeight:600 }}>
                      ✓ Konfirmasi & Terapkan
                    </button>
                  </>
                )}
                <button onClick={() => window.open(`/api/pdf/stock-opname/${selected.id}`, '_blank')} style={{ background:'#dbeafe', border:'none', borderRadius:'8px', padding:'8px 16px', cursor:'pointer', fontSize:'0.82rem', color:'#1e40af', fontWeight:600 }}>
                  🖨 PDF
                </button>
              </div>
            </div>

            {/* Items Table */}
            <div style={{ overflowY:'auto', maxHeight:'calc(100vh - 280px)' }}>
              <table className="data-table">
                <thead style={{ position:'sticky', top:0, zIndex:1 }}>
                  <tr>
                    <th>SKU</th><th>Nama Produk</th>
                    <th style={{ textAlign:'right' }}>Stok Sistem</th>
                    <th style={{ textAlign:'right' }}>Hitungan Fisik</th>
                    <th style={{ textAlign:'right' }}>Selisih</th>
                    <th style={{ textAlign:'right' }}>Nilai Selisih</th>
                    <th>Catatan</th>
                    {selected.status !== 'confirmed' && <th>Simpan</th>}
                  </tr>
                </thead>
                <tbody>
                  {filteredItems.map(item => {
                    const edit = countEdits[item.id] ?? { physical_qty: '', notes: '' };
                    const physQty = edit.physical_qty !== '' ? Number(edit.physical_qty) : item.physical_qty;
                    const diff = physQty !== null ? physQty - item.system_qty : null;
                    const diffColor = diff === null ? '#a8a29e' : diff === 0 ? '#166534' : diff > 0 ? '#1e40af' : '#dc2626';
                    const rowBg = diff !== null && diff !== 0 ? (diff > 0 ? '#eff6ff' : '#fef2f2') : diff === 0 ? '#f0fdf4' : 'white';
                    return (
                      <tr key={item.id} style={{ background: rowBg }}>
                        <td style={{ fontFamily:'monospace', fontSize:'0.8rem', color:'#57534e' }}>{item.sku}</td>
                        <td style={{ fontWeight:500 }}>{item.product_name}</td>
                        <td style={{ textAlign:'right', fontWeight:600 }}>{item.system_qty}</td>
                        <td style={{ textAlign:'right' }}>
                          {selected.status === 'confirmed' ? (
                            <span style={{ fontWeight:700 }}>{item.physical_qty ?? '—'}</span>
                          ) : (
                            <input
                              type="number" min={0}
                              value={edit.physical_qty}
                              onChange={e => setCountEdits(prev => ({ ...prev, [item.id]: { ...prev[item.id], physical_qty: e.target.value } }))}
                              placeholder="—"
                              style={{ width:'80px', padding:'4px 8px', border:'1.5px solid #e7e5e4', borderRadius:'6px', textAlign:'right', fontSize:'0.9rem', fontWeight:600, background:'white' }}
                            />
                          )}
                        </td>
                        <td style={{ textAlign:'right', fontWeight:700, color:diffColor, fontSize:'0.9rem' }}>
                          {diff === null ? '—' : diff === 0 ? '✓' : `${diff > 0 ? '+' : ''}${diff}`}
                        </td>
                        <td style={{ textAlign:'right', color:diffColor, fontSize:'0.82rem' }}>
                          {diff !== null && diff !== 0 ? rp(Math.abs(diff) * item.unit_price) : '—'}
                        </td>
                        <td>
                          {selected.status === 'confirmed' ? (
                            <span style={{ fontSize:'0.82rem', color:'#78716c' }}>{item.notes ?? ''}</span>
                          ) : (
                            <input
                              type="text"
                              value={edit.notes}
                              onChange={e => setCountEdits(prev => ({ ...prev, [item.id]: { ...prev[item.id], notes: e.target.value } }))}
                              style={{ width:'100%', padding:'4px 8px', border:'1px solid #e7e5e4', borderRadius:'6px', fontSize:'0.82rem' }}
                            />
                          )}
                        </td>
                        {selected.status !== 'confirmed' && (
                          <td>
                            <button onClick={() => handleSaveCount(item.id)} disabled={edit.physical_qty === ''} style={{ background: edit.physical_qty !== '' ? '#dcfce7' : '#f5f5f4', border:'none', borderRadius:'6px', padding:'5px 10px', cursor: edit.physical_qty !== '' ? 'pointer' : 'not-allowed', fontSize:'0.75rem', color: edit.physical_qty !== '' ? '#166534' : '#a8a29e' }}>
                              Simpan
                            </button>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {filteredItems.length === 0 && <div style={{ textAlign:'center', padding:'40px', color:'#a8a29e' }}>Tidak ada item yang cocok</div>}
            </div>

            {/* Bottom summary */}
            <div style={{ padding:'14px 28px', borderTop:'1px solid #f0ece8', display:'flex', gap:'24px', fontSize:'0.82rem', color:'#57534e', background:'#fafaf9' }}>
              <span>Total item: <strong>{opItems.length}</strong></span>
              <span>Sudah dihitung: <strong style={{ color:'#166534' }}>{countedCount}</strong></span>
              <span>Belum dihitung: <strong style={{ color:'#854d0e' }}>{opItems.length - countedCount}</strong></span>
              <span>Selisih: <strong style={{ color: diffCount > 0 ? '#c44223' : '#166534' }}>{diffCount}</strong></span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
