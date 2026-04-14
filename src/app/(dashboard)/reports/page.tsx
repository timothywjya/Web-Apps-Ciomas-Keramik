'use client';
import { useState, useEffect, useCallback } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';

interface ReportData {
  [key: string]: string | number;
}

function formatRp(n: number) {
  if (n >= 1_000_000_000) return `Rp ${(n / 1_000_000_000).toFixed(1)}M`;
  if (n >= 1_000_000) return `Rp ${(n / 1_000_000).toFixed(1)}Jt`;
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(n || 0);
}

const REPORT_TYPES = [
  { key: 'sales_summary', label: 'Ringkasan Penjualan Harian' },
  { key: 'monthly', label: 'Penjualan Bulanan' },
  { key: 'product_sales', label: 'Produk Terlaris' },
  { key: 'customer_sales', label: 'Pelanggan Terbaik' },
];

export default function ReportsPage() {
  const [reportType, setReportType] = useState('monthly');
  const [from, setFrom] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d.toISOString().split('T')[0];
  });
  const [to, setTo] = useState(() => new Date().toISOString().split('T')[0]);
  const [data, setData] = useState<ReportData[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchReport = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ type: reportType, from, to });
    const res = await fetch(`/api/reports?${params}`);
    const json = await res.json();
    setData(json.data || []);
    setLoading(false);
  }, [reportType, from, to]);

  useEffect(() => { fetchReport(); }, [fetchReport]);

  const totalRevenue = data.reduce((s, d) => s + (parseFloat(String(d.revenue || 0))), 0);
  const totalTx = data.reduce((s, d) => s + (parseInt(String(d.transactions || 0))), 0);

  return (
    <div style={{ padding: '32px 28px' }}>
      <div className="page-header">
        <div>
          <h1 className="page-title">Laporan</h1>
          <p className="page-subtitle">Analisis penjualan dan performa toko</p>
        </div>
      </div>

      {/* Filters */}
      <div className="card" style={{ marginBottom: '24px', padding: '20px' }}>
        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div className="form-group" style={{ flex: '1', minWidth: '200px' }}>
            <label className="form-label">Jenis Laporan</label>
            <select className="form-select" value={reportType} onChange={e => setReportType(e.target.value)}>
              {REPORT_TYPES.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
            </select>
          </div>
          {reportType !== 'monthly' && (
            <>
              <div className="form-group">
                <label className="form-label">Dari Tanggal</label>
                <input className="form-input" type="date" value={from} onChange={e => setFrom(e.target.value)} style={{ width: '160px' }} />
              </div>
              <div className="form-group">
                <label className="form-label">Sampai Tanggal</label>
                <input className="form-input" type="date" value={to} onChange={e => setTo(e.target.value)} style={{ width: '160px' }} />
              </div>
            </>
          )}
          <button className="btn-primary" onClick={fetchReport} disabled={loading}>
            {loading ? 'Memuat...' : '↻ Muat Laporan'}
          </button>
        </div>
      </div>

      {/* Summary cards */}
      {(reportType === 'sales_summary' || reportType === 'monthly') && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px', marginBottom: '24px' }}>
          {[
            { label: 'Total Pendapatan', value: formatRp(totalRevenue), color: '#b8860b' },
            { label: 'Total Transaksi', value: totalTx.toLocaleString(), color: '#1e40af' },
            { label: 'Rata-rata per Transaksi', value: totalTx > 0 ? formatRp(totalRevenue / totalTx) : 'Rp 0', color: '#065f46' },
          ].map(s => (
            <div key={s.label} className="stat-card">
              <div style={{ fontSize: '0.7rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: '#78716c', marginBottom: '10px' }}>{s.label}</div>
              <div style={{ fontSize: '1.8rem', fontWeight: 700, color: s.color }}>{s.value}</div>
            </div>
          ))}
        </div>
      )}

      {/* Chart */}
      {(reportType === 'sales_summary' || reportType === 'monthly') && data.length > 0 && (
        <div className="card" style={{ marginBottom: '24px' }}>
          <h3 style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '1.3rem', fontWeight: 600, marginBottom: '24px' }}>
            {reportType === 'monthly' ? 'Grafik Penjualan 12 Bulan Terakhir' : 'Grafik Penjualan Harian'}
          </h3>
          <ResponsiveContainer width="100%" height={320}>
            {reportType === 'monthly' ? (
              <BarChart data={data} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f5f5f4" />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#78716c' }} />
                <YAxis tickFormatter={(v) => formatRp(v)} tick={{ fontSize: 10, fill: '#78716c' }} width={80} />
                <Tooltip formatter={(v: number) => [formatRp(v), 'Pendapatan']} labelStyle={{ color: '#1c1917', fontWeight: 600 }} />
                <Bar dataKey="revenue" fill="#b8860b" radius={[4, 4, 0, 0]} />
              </BarChart>
            ) : (
              <LineChart data={data} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f5f5f4" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#78716c' }} />
                <YAxis tickFormatter={(v) => formatRp(v)} tick={{ fontSize: 10, fill: '#78716c' }} width={80} />
                <Tooltip formatter={(v: number) => [formatRp(v), 'Pendapatan']} />
                <Line type="monotone" dataKey="revenue" stroke="#b8860b" strokeWidth={2} dot={{ fill: '#b8860b', r: 3 }} />
              </LineChart>
            )}
          </ResponsiveContainer>
        </div>
      )}

      {/* Table data */}
      {data.length > 0 && (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '20px 24px', borderBottom: '1px solid #f5f5f4' }}>
            <h3 style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '1.2rem', fontWeight: 600 }}>
              Data Detail
            </h3>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  {Object.keys(data[0]).map(k => (
                    <th key={k}>{k.replace(/_/g, ' ').toUpperCase()}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.map((row, i) => (
                  <tr key={i}>
                    {Object.entries(row).map(([k, v]) => (
                      <td key={k} style={{ fontWeight: k.includes('revenue') || k.includes('spend') ? 600 : 400 }}>
                        {k.includes('revenue') || k.includes('spend') || k.includes('amount')
                          ? formatRp(parseFloat(String(v)))
                          : String(v || '—')}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!loading && data.length === 0 && (
        <div className="card" style={{ textAlign: 'center', padding: '60px', color: '#a8a29e' }}>
          <div style={{ fontSize: '3rem', marginBottom: '16px' }}>◷</div>
          <div style={{ fontSize: '1rem', fontWeight: 500 }}>Tidak ada data untuk periode ini</div>
          <div style={{ fontSize: '0.85rem', marginTop: '8px' }}>Coba ubah rentang tanggal atau jenis laporan</div>
        </div>
      )}
    </div>
  );
}
