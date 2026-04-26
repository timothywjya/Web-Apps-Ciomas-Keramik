'use client';
import { useState, useRef, useCallback } from 'react';
import { useToast } from '@/lib/toast';
import { getErrorMessage } from '@/lib/fetchJson';
import { toast } from '@/lib/toast';

type Target      = 'categories' | 'suppliers' | 'customers' | 'products';
type ImportError = { row: number; message: string };
type ImportResult = { inserted: number; updated: number; skipped: number; errors: ImportError[] };
type DupGroup    = { field: string; value: string; count: number; keep_id: string; ids: string[] };
type SyncPreview = { categories: DupGroup[]; suppliers: DupGroup[]; products: DupGroup[]; total: number };
type SyncResult  = Record<'categories' | 'suppliers' | 'products', { duplicates_found: number; merged: number }>;

interface ImportResponse {
  error?: string;
  result?: ImportResult; 
}

interface SyncPreviewResponse {
  preview?: SyncPreview;
  error?: string;
}

interface SyncMergeResponse {
  result?: SyncResult;
  error?: string;
}

const TARGETS: { key: Target; label: string; icon: string; hint: string }[] = [
  { key: 'categories', label: 'Kategori',  icon: '📁', hint: 'name, description' },
  { key: 'suppliers',  label: 'Supplier',  icon: '🏭', hint: 'name, contact_person, phone, email, city …' },
  { key: 'customers',  label: 'Pelanggan', icon: '👤', hint: 'name, phone, email, city, customer_type …' },
  { key: 'products',   label: 'Produk',    icon: '📦', hint: 'sku, name, category_name, harga, stok …' },
];

const SYNC_LABELS: Record<string, string> = {
  categories: 'Kategori',
  suppliers : 'Supplier',
  products  : 'Produk',
};

const S = {
  card: {
    background: 'white', borderRadius: '16px', padding: '28px',
    boxShadow: '0 1px 4px rgba(0,0,0,0.06)', border: '1px solid #f0ece8',
  } as React.CSSProperties,

  badge: (color: 'green' | 'blue' | 'yellow' | 'red'): React.CSSProperties => ({
    borderRadius: '99px', padding: '2px 10px', fontSize: '0.75rem', fontWeight: 600,
    ...(color === 'green'  && { background: '#dcfce7', color: '#166534' }),
    ...(color === 'blue'   && { background: '#dbeafe', color: '#1e40af' }),
    ...(color === 'yellow' && { background: '#fef9c3', color: '#854d0e' }),
    ...(color === 'red'    && { background: '#fee2e2', color: '#991b1b' }),
  }),

  btn: (variant: 'primary' | 'ghost' | 'danger', disabled = false): React.CSSProperties => ({
    border: 'none', borderRadius: '9px', fontWeight: 700, cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.6 : 1, transition: 'opacity .15s',
    ...(variant === 'primary' && { background: '#1c1917', color: '#d4a843', padding: '12px 24px', fontSize: '0.9rem' }),
    ...(variant === 'ghost'   && { background: 'none', color: '#1c1917', border: '1.5px solid #1c1917', padding: '8px 16px', fontSize: '0.8rem' }),
    ...(variant === 'danger'  && { background: '#c44223', color: 'white', padding: '10px 20px', fontSize: '0.85rem' }),
  }),
} as const;

function StatBox({ label, n, color }: { label: string; n: number; color: 'green' | 'blue' | 'yellow' }) {
  return (
    <div style={{ textAlign: 'center', minWidth: '80px' }}>
      <div style={{ fontSize: '1.8rem', fontWeight: 700, color: '#1c1917' }}>{n}</div>
      <span style={S.badge(color)}>{label}</span>
    </div>
  );
}

function AlertBox({ type, children }: { type: 'success' | 'error' | 'warn'; children: React.ReactNode }) {
  const styles = {
    success: { background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#166534' },
    error  : { background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626' },
    warn   : { background: '#fff7ed', border: '1px solid #fed7aa', color: '#92400e' },
  };
  return (
    <div style={{ ...styles[type], borderRadius: '10px', padding: '12px 16px', fontSize: '0.85rem' }}>
      {children}
    </div>
  );
}

// ── Result card ───────────────────────────────────────────────────────────────

function ResultCard({ result }: { result: ImportResult }) {
  return (
    <div style={{ marginTop: '16px' }}>
      <AlertBox type="success">
        <div style={{ fontWeight: 700, marginBottom: '12px' }}>✅ Import Selesai</div>
        <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
          <StatBox label="Inserted" n={result.inserted} color="green" />
          <StatBox label="Updated"  n={result.updated}  color="blue"  />
          <StatBox label="Skipped"  n={result.skipped}  color="yellow" />
        </div>
      </AlertBox>

      {result.errors.length > 0 && (
        <div style={{ marginTop: '10px', maxHeight: '140px', overflowY: 'auto', border: '1px solid #fecaca', borderRadius: '8px', padding: '10px' }}>
          {result.errors.map((e, i) => (
            <div key={i} style={{ fontSize: '0.78rem', color: '#dc2626', padding: '3px 0', borderBottom: i < result.errors.length - 1 ? '1px solid #fee2e2' : 'none' }}>
              ⚠ {e.message}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Drop zone ─────────────────────────────────────────────────────────────────

function DropZone({ file, onFile }: {
  file   : File | null;
  onFile : (f: File) => void;
}) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f?.name.endsWith('.csv')) onFile(f);
  }, [onFile]);

  return (
    <div
      onDragOver={e => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      onClick={() => inputRef.current?.click()}
      style={{
        border       : `2px dashed ${dragging ? '#1c1917' : file ? '#16a34a' : '#d4d0cb'}`,
        borderRadius : '14px',
        padding      : '40px 24px',
        textAlign    : 'center',
        background   : dragging ? '#f5f5f4' : file ? '#f0fdf4' : '#fafaf9',
        cursor       : 'pointer',
        transition   : 'all .2s',
      }}>
      <input ref={inputRef} type="file" accept=".csv" style={{ display: 'none' }}
        onChange={e => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = ''; }} />

      <div style={{ fontSize: '2.2rem', marginBottom: '8px' }}>{file ? '📄' : '📂'}</div>

      {file ? (
        <>
          <div style={{ fontWeight: 600, color: '#166534' }}>{file.name}</div>
          <div style={{ fontSize: '0.78rem', color: '#78716c', marginTop: '4px' }}>
            {(file.size / 1024).toFixed(1)} KB — klik untuk ganti
          </div>
        </>
      ) : (
        <>
          <div style={{ fontWeight: 600, color: '#57534e' }}>Drag & drop file CSV di sini</div>
          <div style={{ fontSize: '0.78rem', color: '#a8a29e', marginTop: '4px' }}>atau klik untuk pilih (maks. 5 MB)</div>
        </>
      )}
    </div>
  );
}

// ── Import panel ──────────────────────────────────────────────────────────────

function ImportPanel() {
  const [target,  setTarget]  = useState<Target>('products');
  const [file,    setFile]    = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result,  setResult]  = useState<ImportResult | null>(null);
  const [error,   setError]   = useState('');

  const selected = TARGETS.find(t => t.key === target)!;

  function selectTarget(t: Target) {
    setTarget(t); setFile(null); setResult(null); setError('');
  }

  async function downloadTemplate() {
    try {
      let res: Response;
      try { res = await fetch(`/api/import?target=${target}`); }
      catch (netErr) { throw new Error(getErrorMessage(netErr, 'Koneksi gagal')); }
      if (!res.ok) throw new Error(`Gagal mengunduh template (${res.status})`);
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a    = Object.assign(document.createElement('a'), {
        href: url, download: `template_import_${target}.csv`,
      });
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast.error('Gagal mengunduh template', getErrorMessage(err, 'Coba lagi'));
    }
  }

  async function handleImport() {
    if (!file) return;
    setLoading(true); setError(''); setResult(null);
    
    try {
      const fd = new FormData(); 
      fd.append('file', file);
      
      let res: Response;
      try { 
        res = await fetch(`/api/import?target=${target}`, { method: 'POST', body: fd }); 
      } catch (netErr) { 
        throw new Error(getErrorMessage(netErr, 'Koneksi gagal')); 
      }

      // Gunakan ImportResponse agar TypeScript tahu tipe result
      const json = await res.json() as ImportResponse;
      
      if (!res.ok) throw new Error(json.error ?? `Error ${res.status}: Import gagal`);
      
      // Sekarang TypeScript tahu json.result adalah ImportResult
      setResult(json.result ?? null);
      setFile(null);
      
    } catch (err) { 
      setError(getErrorMessage(err, 'Import gagal')); 
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      {/* Target selector */}
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '20px' }}>
        {TARGETS.map(t => (
          <button key={t.key} onClick={() => selectTarget(t.key)}
            style={{
              padding: '9px 16px', borderRadius: '9px', fontWeight: 600,
              fontSize: '0.83rem', cursor: 'pointer', transition: 'all .15s',
              border      : `2px solid ${target === t.key ? '#1c1917' : '#e7e5e4'}`,
              background  : target === t.key ? '#1c1917' : 'white',
              color       : target === t.key ? '#d4a843' : '#57534e',
            }}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* Info bar */}
      <div style={{
        background: '#fafaf9', border: '1px solid #e7e5e4', borderRadius: '10px',
        padding: '12px 16px', marginBottom: '18px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px',
      }}>
        <div>
          <div style={{ fontWeight: 600, fontSize: '0.85rem', color: '#1c1917' }}>
            Kolom wajib: {selected.label}
          </div>
          <div style={{ fontSize: '0.78rem', color: '#78716c', marginTop: '2px', fontFamily: 'monospace' }}>
            {selected.hint}
          </div>
        </div>
        <button style={S.btn('ghost')} onClick={downloadTemplate}>
          ⬇ Download Template
        </button>
      </div>

      {/* Upsert info */}
      <div style={{ marginBottom: '14px' }}>
        <AlertBox type="warn">
          <strong>Insert or Update:</strong> Data yang sudah ada akan di-<em>update</em> (bukan di-skip).
          Data baru akan di-<em>insert</em>. Duplikat ditentukan berdasarkan:&nbsp;
          {target === 'products' ? <><strong>SKU</strong></> : <><strong>nama</strong> (case-insensitive)</>}.
        </AlertBox>
      </div>

      {/* Drop zone */}
      <DropZone file={file} onFile={f => { setFile(f); setResult(null); setError(''); }} />

      {error && (
        <div style={{ marginTop: '10px' }}>
          <AlertBox type="error">⚠ {error}</AlertBox>
        </div>
      )}

      {file && !result && (
        <button style={{ ...S.btn('primary', loading), width: '100%', marginTop: '14px' }}
          onClick={handleImport} disabled={loading}>
          {loading ? '⏳ Memproses...' : `⚡ Import ${selected.label}`}
        </button>
      )}

      {result && <ResultCard result={result} />}
    </div>
  );
}

function SyncPanel() {
  const [preview, setPreview] = useState<SyncPreview | null>(null);
  const [result, setResult] = useState<SyncResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [merging, setMerging] = useState(false);
  const [error, setError] = useState('');

  async function handlePreview() {
    setLoading(true); setError(''); setResult(null); setPreview(null);
    try {
      const res = await fetch('/api/sync');
      if (!res.ok) throw new Error(`Error ${res.status}`);
      
      // 2. Gunakan interface respons
      const json = await res.json() as SyncPreviewResponse;
      setPreview(json.preview ?? null);
    } catch (err) { 
      setError(getErrorMessage(err, 'Gagal memuat preview')); 
    } finally {
      setLoading(false);
    }
  }

  async function handleMerge() {
    const ok = await toast.confirm({
      title: 'Konfirmasi Merge Duplikat',
      message: 'Merge semua duplikat? Aksi ini tidak bisa dibatalkan.',
      confirmText: 'Ya, Merge Sekarang',
      danger: true,
    });
    if (!ok) return;

    setMerging(true); setError('');
    try {
      const res = await fetch('/api/sync', { method: 'POST' });
      if (!res.ok) throw new Error(`Error ${res.status}`);
      
      // 2. Gunakan interface respons
      const json = await res.json() as SyncMergeResponse;
      setResult(json.result ?? null); 
      setPreview(null);
    } catch (err) { 
      setError(getErrorMessage(err, 'Merge gagal')); 
    } finally {
      setMerging(false);
    }
  }

  const hasDups = preview && preview.total > 0;

  return (
    <div style={{ width: '100%', boxSizing: 'border-box' }}>

      {/* Description */}
      <div style={{
        background: '#fafaf9', border: '1px solid #e7e5e4', borderRadius: '10px',
        padding: '14px 18px', marginBottom: '20px',
        display: 'flex', alignItems: 'flex-start', gap: '12px',
      }}>
        <span style={{ fontSize: '1.2rem', flexShrink: 0 }}>🔍</span>
        <div style={{ fontSize: '0.85rem', color: '#57534e', lineHeight: 1.65 }}>
          Deteksi dan gabungkan data duplikat berdasarkan <strong>konten</strong> (bukan UUID).
          <br />
          <span style={{ color: '#78716c' }}>
            Kategori &amp; Supplier: duplikat berdasarkan <strong>nama</strong>.
            Produk: duplikat berdasarkan <strong>nama + ukuran + brand</strong>.
          </span>
        </div>
      </div>

      {/* Scan button */}
      <button
        style={{ ...S.btn('primary', loading || merging), width: '100%', marginBottom: '16px' }}
        onClick={handlePreview}
        disabled={loading || merging}
      >
        {loading ? '🔍 Scanning duplikat...' : '🔍 Scan Duplikat Sekarang'}
      </button>

      {error && <div style={{ marginBottom: '14px' }}><AlertBox type="error">⚠ {error}</AlertBox></div>}

      {/* No duplicates */}
      {preview && !hasDups && (
        <AlertBox type="success">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '1.8rem' }}>✅</span>
            <div>
              <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>Data sudah bersih</div>
              <div style={{ fontSize: '0.8rem', marginTop: '2px', opacity: 0.8 }}>Tidak ada duplikat ditemukan di semua kategori</div>
            </div>
          </div>
        </AlertBox>
      )}

      {/* Duplicate summary cards */}
      {hasDups && (
        <div style={{ width: '100%' }}>

          {/* Summary stat cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '20px' }}>
            {(['categories', 'suppliers', 'products'] as const).map(key => {
              const n = preview[key].length;
              return (
                <div key={key} style={{
                  borderRadius: '12px', padding: '18px 16px', textAlign: 'center',
                  background: n > 0 ? '#fff7ed' : '#f0fdf4',
                  border    : `1px solid ${n > 0 ? '#fed7aa' : '#bbf7d0'}`,
                }}>
                  <div style={{ fontSize: '2rem', fontWeight: 700, color: n > 0 ? '#c2410c' : '#166534', lineHeight: 1 }}>{n}</div>
                  <div style={{ fontSize: '0.72rem', color: '#78716c', marginTop: '6px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Duplikat {SYNC_LABELS[key]}
                  </div>
                  <span style={S.badge(n > 0 ? 'yellow' : 'green')}>{n > 0 ? 'Perlu merge' : 'Bersih'}</span>
                </div>
              );
            })}
          </div>

          {/* Detail lists */}
          {(['categories', 'suppliers', 'products'] as const).map(key => {
            const groups = preview[key];
            if (!groups.length) return null;
            return (
              <div key={key} style={{ marginBottom: '18px', width: '100%' }}>
                <div style={{
                  fontWeight: 700, fontSize: '0.75rem', color: '#57534e',
                  textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px',
                  display: 'flex', alignItems: 'center', gap: '8px',
                }}>
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#f59e0b', flexShrink: 0, display: 'inline-block' }} />
                  {SYNC_LABELS[key]} — {groups.length} grup duplikat
                </div>
                <div style={{ border: '1px solid #e7e5e4', borderRadius: '10px', overflow: 'hidden', width: '100%' }}>
                  {groups.map((g, i) => (
                    <div key={i} style={{
                      padding: '10px 16px',
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px',
                      borderBottom: i < groups.length - 1 ? '1px solid #f5f5f4' : 'none',
                      background: i % 2 === 0 ? 'white' : '#fafaf9',
                    }}>
                      <span style={{ fontFamily: 'monospace', fontSize: '0.83rem', color: '#1c1917', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        &ldquo;{g.value}&rdquo;
                      </span>
                      <span style={{ ...S.badge('yellow'), flexShrink: 0 }}>{g.count} duplikat</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}

          {/* Merge action */}
          <AlertBox type="warn">
            <div style={{ marginBottom: '10px' }}>
              <div style={{ fontWeight: 700, fontSize: '0.95rem', marginBottom: '4px' }}>
                ⚡ {preview.total} grup duplikat siap di-merge
              </div>
              <div style={{ fontSize: '0.8rem', opacity: 0.85, lineHeight: 1.5 }}>
                Record tertua dipertahankan sebagai master. Semua foreign key (penjualan, pembelian, stok)
                akan dialihkan otomatis ke record master. Aksi ini <strong>tidak bisa dibatalkan</strong>.
              </div>
            </div>
            <button
              style={{ ...S.btn('danger', merging), width: '100%' }}
              onClick={handleMerge}
              disabled={merging}
            >
              {merging ? '⏳ Sedang merge...' : '🔗 Merge Semua Duplikat Sekarang'}
            </button>
          </AlertBox>
        </div>
      )}

      {/* Merge result */}
      {result && (
        <div style={{ marginTop: '4px' }}>
          <AlertBox type="success">
            <div style={{ fontWeight: 700, fontSize: '0.95rem', marginBottom: '14px' }}>✅ Merge Selesai</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {(['categories', 'suppliers', 'products'] as const).map(key => (
                <div key={key} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '10px 14px', background: 'white', borderRadius: '8px',
                  border: '1px solid #dcfce7', fontSize: '0.85rem',
                }}>
                  <div style={{ fontWeight: 600, color: '#1c1917' }}>{SYNC_LABELS[key]}</div>
                  <div style={{ color: '#78716c', textAlign: 'right' }}>
                    <span>{result[key].duplicates_found} grup ditemukan</span>
                    <span style={{ margin: '0 6px' }}>→</span>
                    <strong style={{ color: '#166534' }}>{result[key].merged} berhasil di-merge</strong>
                  </div>
                </div>
              ))}
            </div>
            <button style={{ ...S.btn('ghost'), width: '100%', marginTop: '14px' }} onClick={handlePreview}>
              🔍 Scan Ulang
            </button>
          </AlertBox>
        </div>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ImportSyncPage() {
  const toast = useToast();
  const [tab, setTab] = useState<'import' | 'sync'>('import');

  return (
    <div style={{ padding: '32px 28px', maxWidth: '820px' }}>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '2.2rem', fontWeight: 600, color: '#1c1917', lineHeight: 1.1 }}>
          Import & Sync Data
        </h1>
        <p style={{ color: '#78716c', marginTop: '6px', fontSize: '0.9rem' }}>
          Import massal dari CSV dengan Insert-or-Update, dan bersihkan duplikat otomatis
        </p>
      </div>

      {/* Tab nav */}
      <div style={{ display: 'flex', gap: '4px', background: '#f5f5f4', borderRadius: '12px', padding: '4px', marginBottom: '24px', width: 'fit-content' }}>
        {([
          { key: 'import', label: '⬆ Import CSV'   },
          { key: 'sync',   label: '🔗 Sync & Merge' },
        ] as const).map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            style={{
              padding: '10px 22px', borderRadius: '9px', border: 'none',
              background : tab === t.key ? 'white' : 'transparent',
              color      : tab === t.key ? '#1c1917' : '#78716c',
              fontWeight : tab === t.key ? 700 : 500,
              boxShadow  : tab === t.key ? '0 1px 4px rgba(0,0,0,0.1)' : 'none',
              cursor: 'pointer', fontSize: '0.88rem', transition: 'all .15s',
            }}>
            {t.label}
          </button>
        ))}
      </div>

      <div style={S.card}>
        {tab === 'import' ? <ImportPanel /> : <SyncPanel />}
      </div>
    </div>
  );
}
