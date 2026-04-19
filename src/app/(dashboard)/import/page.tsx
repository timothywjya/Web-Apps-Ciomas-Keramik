'use client';
import { useState, useRef, useCallback } from 'react';

type Target = 'categories' | 'suppliers' | 'products';
type ImportResult = { inserted: number; updated: number; skipped: number; errors: { row: number; message: string }[] };
type DupGroup    = { field: string; value: string; count: number; keep_id: string; ids: string[] };
type SyncPreview = { categories: DupGroup[]; suppliers: DupGroup[]; products: DupGroup[]; total: number };
type SyncResult  = { categories: { duplicates_found: number; merged: number }; suppliers: { duplicates_found: number; merged: number }; products: { duplicates_found: number; merged: number } };

const TARGETS: { key: Target; label: string; desc: string; icon: string }[] = [
  { key: 'products',   label: 'Produk',    desc: 'sku, name, category_name, harga, stok …',     icon: '📦' },
  { key: 'categories', label: 'Kategori',  desc: 'name, description',                           icon: '📁' },
  { key: 'suppliers',  label: 'Supplier',  desc: 'name, contact_person, phone, email, city …',  icon: '🏭' },
];

function Badge({ n, color }: { n: number; color: string }) {
  const colors: Record<string, string> = {
    green : 'background:#dcfce7;color:#166534',
    yellow: 'background:#fef9c3;color:#854d0e',
    red   : 'background:#fee2e2;color:#991b1b',
    blue  : 'background:#dbeafe;color:#1e40af',
  };
  return (
    <span style={{ ...parseStyle(colors[color] ?? colors.blue), borderRadius: '99px', padding: '2px 10px', fontSize: '0.75rem', fontWeight: 600 }}>
      {n}
    </span>
  );
}

function parseStyle(s: string): React.CSSProperties {
  return Object.fromEntries(s.split(';').map(p => { const [k, v] = p.split(':'); return [k.trim().replace(/-([a-z])/g, (_,c) => c.toUpperCase()), v?.trim()]; }));
}

function ResultCard({ result }: { result: ImportResult }) {
  return (
    <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '12px', padding: '20px', marginTop: '16px' }}>
      <div style={{ fontWeight: 600, color: '#166534', marginBottom: '12px' }}>✅ Import Selesai</div>
      <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
        {[
          { label: 'Inserted', n: result.inserted, color: 'green' },
          { label: 'Updated',  n: result.updated,  color: 'blue'  },
          { label: 'Skipped',  n: result.skipped,  color: 'yellow'},
        ].map(s => (
          <div key={s.label} style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '1.8rem', fontWeight: 700, color: '#1c1917' }}>{s.n}</div>
            <div style={{ fontSize: '0.75rem', color: '#78716c' }}>{s.label}</div>
          </div>
        ))}
      </div>
      {result.errors.length > 0 && (
        <div style={{ marginTop: '14px', maxHeight: '120px', overflowY: 'auto' }}>
          {result.errors.map((e, i) => (
            <div key={i} style={{ fontSize: '0.78rem', color: '#dc2626', padding: '3px 0', borderBottom: '1px solid #fecaca' }}>
              ⚠ {e.message}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Import Panel ──────────────────────────────────────────────────────────────

function ImportPanel() {
  const [target,   setTarget]   = useState<Target>('products');
  const [dragging, setDragging] = useState(false);
  const [file,     setFile]     = useState<File | null>(null);
  const [loading,  setLoading]  = useState(false);
  const [result,   setResult]   = useState<ImportResult | null>(null);
  const [error,    setError]    = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f?.name.endsWith('.csv')) { setFile(f); setResult(null); setError(''); }
    else setError('Hanya file .csv yang diizinkan');
  }, []);

  async function downloadTemplate() {
    const res = await fetch(`/api/import?target=${target}`);
    const blob = await res.blob();
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = `template_${target}.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  async function handleImport() {
    if (!file) return;
    setLoading(true); setError(''); setResult(null);
    try {
      const fd = new FormData(); fd.append('file', file);
      const res  = await fetch(`/api/import?target=${target}`, { method: 'POST', body: fd });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Import gagal');
      setResult(json.result);
      setFile(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Import gagal');
    } finally {
      setLoading(false);
    }
  }

  const selected = TARGETS.find(t => t.key === target)!;

  return (
    <div>
      {/* Target selector */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '24px', flexWrap: 'wrap' }}>
        {TARGETS.map(t => (
          <button key={t.key} onClick={() => { setTarget(t.key); setResult(null); setFile(null); setError(''); }}
            style={{
              padding: '10px 18px', borderRadius: '10px', border: '2px solid',
              borderColor: target === t.key ? '#1c1917' : '#e7e5e4',
              background : target === t.key ? '#1c1917' : 'white',
              color      : target === t.key ? '#d4a843' : '#57534e',
              fontWeight : 600, cursor: 'pointer', fontSize: '0.85rem',
              transition : 'all .15s',
            }}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* Info & download template */}
      <div style={{ background: '#fafaf9', border: '1px solid #e7e5e4', borderRadius: '10px', padding: '14px 18px', marginBottom: '20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
        <div>
          <div style={{ fontWeight: 600, fontSize: '0.85rem', color: '#1c1917' }}>Kolom CSV: {selected.label}</div>
          <div style={{ fontSize: '0.78rem', color: '#78716c', marginTop: '2px', fontFamily: 'monospace' }}>{selected.desc}</div>
        </div>
        <button onClick={downloadTemplate}
          style={{ background: 'none', border: '1.5px solid #1c1917', borderRadius: '8px', padding: '8px 16px', fontWeight: 600, fontSize: '0.8rem', cursor: 'pointer', color: '#1c1917', display: 'flex', alignItems: 'center', gap: '6px' }}>
          ⬇ Download Template
        </button>
      </div>

      {/* Drop zone */}
      <div
        onDragOver={e => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        style={{
          border: `2px dashed ${dragging ? '#1c1917' : file ? '#16a34a' : '#d4d0cb'}`,
          borderRadius: '14px', padding: '40px 24px', textAlign: 'center',
          background: dragging ? '#f5f5f4' : file ? '#f0fdf4' : '#fafaf9',
          cursor: 'pointer', transition: 'all .2s',
        }}>
        <input ref={inputRef} type="file" accept=".csv" style={{ display: 'none' }}
          onChange={e => { const f = e.target.files?.[0]; if (f) { setFile(f); setResult(null); setError(''); } }} />
        <div style={{ fontSize: '2.5rem', marginBottom: '10px' }}>{file ? '📄' : '📂'}</div>
        {file ? (
          <>
            <div style={{ fontWeight: 600, color: '#166534' }}>{file.name}</div>
            <div style={{ fontSize: '0.78rem', color: '#78716c', marginTop: '4px' }}>
              {(file.size / 1024).toFixed(1)} KB — klik untuk ganti file
            </div>
          </>
        ) : (
          <>
            <div style={{ fontWeight: 600, color: '#57534e' }}>Drag & drop file CSV di sini</div>
            <div style={{ fontSize: '0.78rem', color: '#a8a29e', marginTop: '4px' }}>atau klik untuk pilih file (maks. 5MB)</div>
          </>
        )}
      </div>

      {error && (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', padding: '10px 14px', color: '#dc2626', fontSize: '0.83rem', marginTop: '12px' }}>
          ⚠ {error}
        </div>
      )}

      {file && !result && (
        <button onClick={handleImport} disabled={loading}
          style={{ width: '100%', marginTop: '16px', padding: '14px', background: loading ? '#a8a29e' : '#1c1917', color: '#d4a843', border: 'none', borderRadius: '10px', fontWeight: 700, fontSize: '0.95rem', cursor: loading ? 'not-allowed' : 'pointer', letterSpacing: '0.05em' }}>
          {loading ? '⏳ Memproses...' : `⚡ Import ${selected.label} Sekarang`}
        </button>
      )}

      {result && <ResultCard result={result} />}
    </div>
  );
}

// ── Sync Panel ────────────────────────────────────────────────────────────────

function SyncPanel() {
  const [preview,  setPreview]  = useState<SyncPreview | null>(null);
  const [result,   setResult]   = useState<SyncResult | null>(null);
  const [loading,  setLoading]  = useState(false);
  const [merging,  setMerging]  = useState(false);
  const [error,    setError]    = useState('');

  async function handlePreview() {
    setLoading(true); setError(''); setResult(null);
    try {
      const res  = await fetch('/api/sync');
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setPreview(json.preview);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal memuat preview');
    } finally {
      setLoading(false);
    }
  }

  async function handleMerge() {
    if (!confirm('Merge semua duplikat? Aksi ini tidak bisa dibatalkan.')) return;
    setMerging(true); setError('');
    try {
      const res  = await fetch('/api/sync', { method: 'POST' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setResult(json.result); setPreview(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Merge gagal');
    } finally {
      setMerging(false);
    }
  }

  const hasDups = preview && preview.total > 0;

  return (
    <div>
      <p style={{ color: '#78716c', fontSize: '0.88rem', marginBottom: '20px', lineHeight: 1.6 }}>
        Deteksi dan gabungkan data duplikat berdasarkan konten (bukan UUID).
        Kategori & Supplier: duplikat berdasarkan <b>nama</b>.
        Produk: duplikat berdasarkan <b>nama + ukuran + brand</b>.
      </p>

      {/* Step 1: Scan */}
      <button onClick={handlePreview} disabled={loading || merging}
        style={{ padding: '12px 24px', background: '#1c1917', color: '#d4a843', border: 'none', borderRadius: '10px', fontWeight: 700, cursor: 'pointer', fontSize: '0.9rem', marginBottom: '20px' }}>
        {loading ? '🔍 Scanning...' : '🔍 Scan Duplikat'}
      </button>

      {error && (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', padding: '10px 14px', color: '#dc2626', fontSize: '0.83rem', marginBottom: '16px' }}>
          ⚠ {error}
        </div>
      )}

      {/* Preview result */}
      {preview && (
        <div>
          {!hasDups ? (
            <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '12px', padding: '20px', textAlign: 'center' }}>
              <div style={{ fontSize: '2rem' }}>✅</div>
              <div style={{ fontWeight: 600, color: '#166534', marginTop: '8px' }}>Data sudah bersih, tidak ada duplikat</div>
            </div>
          ) : (
            <>
              <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', flexWrap: 'wrap' }}>
                {[
                  { label: 'Duplikat Kategori', count: preview.categories.length, icon: '📁' },
                  { label: 'Duplikat Supplier',  count: preview.suppliers.length,  icon: '🏭' },
                  { label: 'Duplikat Produk',    count: preview.products.length,   icon: '📦' },
                ].map(s => (
                  <div key={s.label} style={{ flex: 1, minWidth: '160px', background: s.count > 0 ? '#fff7ed' : '#f0fdf4', border: `1px solid ${s.count > 0 ? '#fed7aa' : '#bbf7d0'}`, borderRadius: '10px', padding: '16px', textAlign: 'center' }}>
                    <div style={{ fontSize: '1.5rem' }}>{s.icon}</div>
                    <div style={{ fontSize: '1.6rem', fontWeight: 700, color: '#1c1917' }}>{s.count}</div>
                    <div style={{ fontSize: '0.75rem', color: '#78716c' }}>{s.label}</div>
                  </div>
                ))}
              </div>

              {/* Detail groups */}
              {(['categories', 'suppliers', 'products'] as const).map(key => {
                const groups = preview[key];
                if (!groups.length) return null;
                const labels: Record<string, string> = { categories: 'Kategori', suppliers: 'Supplier', products: 'Produk' };
                return (
                  <div key={key} style={{ marginBottom: '16px' }}>
                    <div style={{ fontWeight: 600, fontSize: '0.85rem', color: '#57534e', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{labels[key]}</div>
                    <div style={{ border: '1px solid #e7e5e4', borderRadius: '10px', overflow: 'hidden' }}>
                      {groups.map((g, i) => (
                        <div key={i} style={{ padding: '10px 14px', borderBottom: i < groups.length - 1 ? '1px solid #f5f5f4' : 'none', display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                          <span style={{ fontFamily: 'monospace', fontSize: '0.82rem', color: '#1c1917', flex: 1 }}>"{g.value}"</span>
                          <Badge n={g.count} color="yellow" />
                          <span style={{ fontSize: '0.75rem', color: '#a8a29e' }}>duplikat</span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}

              {/* Merge button */}
              <div style={{ background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: '12px', padding: '16px 20px', marginTop: '8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
                <div>
                  <div style={{ fontWeight: 600, color: '#92400e' }}>⚡ Merge {preview.total} grup duplikat</div>
                  <div style={{ fontSize: '0.78rem', color: '#78716c', marginTop: '2px' }}>
                    Data lama akan diarahkan ke record tertua. Histori penjualan & stok tetap aman.
                  </div>
                </div>
                <button onClick={handleMerge} disabled={merging}
                  style={{ padding: '10px 20px', background: merging ? '#a8a29e' : '#c44223', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 700, fontSize: '0.85rem', cursor: merging ? 'not-allowed' : 'pointer' }}>
                  {merging ? '⏳ Merging...' : '🔗 Merge Sekarang'}
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* Merge result */}
      {result && (
        <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '12px', padding: '20px', marginTop: '16px' }}>
          <div style={{ fontWeight: 600, color: '#166534', marginBottom: '14px' }}>✅ Merge Selesai</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {(['categories', 'suppliers', 'products'] as const).map(key => {
              const r = result[key];
              const labels: Record<string, string> = { categories: 'Kategori', suppliers: 'Supplier', products: 'Produk' };
              return (
                <div key={key} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: 'white', borderRadius: '8px', border: '1px solid #dcfce7' }}>
                  <span style={{ fontSize: '0.85rem', color: '#1c1917' }}>{labels[key]}</span>
                  <span style={{ fontSize: '0.82rem', color: '#78716c' }}>
                    {r.duplicates_found} grup ditemukan → <b style={{ color: '#166534' }}>{r.merged} record di-merge</b>
                  </span>
                </div>
              );
            })}
          </div>
          <button onClick={handlePreview} style={{ marginTop: '14px', padding: '8px 16px', background: '#1c1917', color: '#d4a843', border: 'none', borderRadius: '8px', fontWeight: 600, fontSize: '0.8rem', cursor: 'pointer' }}>
            🔍 Scan Ulang
          </button>
        </div>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function ImportSyncPage() {
  const [tab, setTab] = useState<'import' | 'sync'>('import');

  return (
    <div style={{ padding: '32px 28px', maxWidth: '820px' }}>
      <div style={{ marginBottom: '28px' }}>
        <h1 style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '2.2rem', fontWeight: 600, color: '#1c1917', lineHeight: 1.1 }}>
          Import & Sync Data
        </h1>
        <p style={{ color: '#78716c', marginTop: '6px', fontSize: '0.9rem' }}>
          Import massal dari CSV dan bersihkan data duplikat
        </p>
      </div>

      {/* Tab nav */}
      <div style={{ display: 'flex', gap: '4px', background: '#f5f5f4', borderRadius: '12px', padding: '4px', marginBottom: '28px', width: 'fit-content' }}>
        {([
          { key: 'import', label: '⬆ Import CSV' },
          { key: 'sync',   label: '🔗 Sync & Merge' },
        ] as const).map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            style={{
              padding: '10px 22px', borderRadius: '9px', border: 'none',
              background: tab === t.key ? 'white' : 'transparent',
              color: tab === t.key ? '#1c1917' : '#78716c',
              fontWeight: tab === t.key ? 700 : 500,
              boxShadow: tab === t.key ? '0 1px 4px rgba(0,0,0,0.1)' : 'none',
              cursor: 'pointer', fontSize: '0.88rem', transition: 'all .15s',
            }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ background: 'white', borderRadius: '16px', padding: '28px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', border: '1px solid #f0ece8' }}>
        {tab === 'import' ? <ImportPanel /> : <SyncPanel />}
      </div>
    </div>
  );
}
