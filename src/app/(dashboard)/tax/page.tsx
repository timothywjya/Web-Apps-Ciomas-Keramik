'use client';

// =============================================================================
// Perpajakan — Coming Soon
// Placeholder halaman yang akan diisi sesuai kebutuhan Ciomas Keramik
// =============================================================================

export default function TaxPage() {
  return (
    <div style={{ padding: '32px 28px', minHeight: '80vh', display: 'flex', flexDirection: 'column' }}>

      {/* Header */}
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '2.2rem', fontWeight: 600, color: '#1c1917' }}>
          Perpajakan
        </h1>
        <p style={{ color: '#78716c', marginTop: '4px', fontSize: '0.88rem' }}>
          Manajemen pajak — PPN, PPh, dan e-Faktur Ciomas Keramik
        </p>
      </div>

      {/* Coming soon card */}
      <div style={{
        flex: 1,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <div style={{
          background: 'white', borderRadius: '20px',
          border: '1px solid #f0ece8',
          padding: '60px 48px', textAlign: 'center',
          maxWidth: '560px', width: '100%',
          boxShadow: '0 2px 12px rgba(0,0,0,0.04)',
        }}>

          {/* Icon */}
          <div style={{
            width: '80px', height: '80px', borderRadius: '20px',
            background: 'linear-gradient(135deg, #1c1917 0%, #44403c 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 24px',
            fontSize: '2rem',
          }}>
            🧾
          </div>

          {/* Badge */}
          <div style={{ marginBottom: '16px' }}>
            <span style={{
              background: '#fef9c3', color: '#854d0e',
              padding: '4px 14px', borderRadius: '99px',
              fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.5px',
              textTransform: 'uppercase',
            }}>
              ⏳ Segera Hadir
            </span>
          </div>

          <h2 style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '1.8rem', fontWeight: 600, color: '#1c1917', marginBottom: '12px' }}>
            Modul Perpajakan
          </h2>
          <p style={{ color: '#78716c', fontSize: '0.9rem', lineHeight: 1.7, marginBottom: '28px' }}>
            Fitur ini sedang dalam pengembangan dan akan segera tersedia.
            Modul ini akan mencakup pengelolaan pajak secara terintegrasi dengan
            data penjualan dan pembelian yang sudah ada.
          </p>

          {/* Feature list */}
          <div style={{ textAlign: 'left', marginBottom: '28px' }}>
            <div style={{ fontSize: '0.75rem', color: '#a8a29e', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '12px' }}>
              Fitur yang akan tersedia
            </div>
            {[
              { icon: '🧾', label: 'Faktur Pajak (e-Faktur)', desc: 'Buat dan kelola faktur pajak digital terintegrasi' },
              { icon: '📊', label: 'PPN — Pajak Pertambahan Nilai', desc: 'Rekap PPN masukan dan keluaran per periode' },
              { icon: '💼', label: 'PPh Pasal 21 & 23', desc: 'Hitung & lapor PPh karyawan dan jasa' },
              { icon: '📅', label: 'SPT Masa', desc: 'Rekap data untuk SPT Masa PPN bulanan' },
              { icon: '📤', label: 'Ekspor ke e-SPT', desc: 'Export data siap upload ke e-SPT DJP' },
            ].map((f, i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'flex-start', gap: '12px',
                padding: '10px 14px', borderRadius: '10px',
                background: i % 2 === 0 ? '#fafaf9' : 'white',
                marginBottom: '4px',
              }}>
                <span style={{ fontSize: '1.1rem', flexShrink: 0, marginTop: '1px' }}>{f.icon}</span>
                <div>
                  <div style={{ fontWeight: 600, fontSize: '0.85rem', color: '#1c1917' }}>{f.label}</div>
                  <div style={{ fontSize: '0.78rem', color: '#78716c', marginTop: '2px' }}>{f.desc}</div>
                </div>
                <span style={{
                  marginLeft: 'auto', flexShrink: 0,
                  background: '#f5f5f4', color: '#a8a29e',
                  padding: '2px 8px', borderRadius: '6px', fontSize: '0.68rem', fontWeight: 600,
                }}>
                  Soon
                </span>
              </div>
            ))}
          </div>

          {/* Info box */}
          <div style={{
            background: '#fafaf9', border: '1px solid #e7e5e4', borderRadius: '12px',
            padding: '14px 16px', fontSize: '0.82rem', color: '#57534e', lineHeight: 1.6,
          }}>
            <strong>💡 Database sudah siap.</strong> Tabel <code style={{ background: '#f0ece8', padding: '1px 5px', borderRadius: '4px', fontSize: '0.78rem' }}>tax_records</code>{' '}
            sudah dibuat di database. Fitur UI akan diaktifkan setelah spesifikasi diterima.
          </div>
        </div>
      </div>

    </div>
  );
}
