export const runtime = 'nodejs';

import { query } from '@/lib/db';
import { getSession } from '@/lib/auth';

async function getDashboardStats() {
  try {
    const [salesResult] = await query(`
      SELECT 
        COUNT(*) as total_transactions,
        COALESCE(SUM(total_amount), 0) as total_revenue,
        COALESCE(SUM(CASE WHEN DATE(sales_date) = CURRENT_DATE THEN total_amount ELSE 0 END), 0) as today_revenue
      FROM sales WHERE status != 'cancelled'
    `);
    
    const [productsResult] = await query(`
      SELECT 
        COUNT(*) as total_products,
        COUNT(CASE WHEN stock_quantity <= min_stock THEN 1 END) as low_stock_count
      FROM products WHERE is_active = true
    `);
    
    const [customersResult] = await query(`SELECT COUNT(*) as total FROM customers WHERE is_active = true`);
    
    const monthlySales = await query(`
      SELECT 
        TO_CHAR(sales_date, 'Mon') as month,
        COALESCE(SUM(total_amount), 0) as revenue,
        COUNT(*) as transactions
      FROM sales 
      WHERE sales_date >= CURRENT_DATE - INTERVAL '6 months' AND status != 'cancelled'
      GROUP BY DATE_TRUNC('month', sales_date), TO_CHAR(sales_date, 'Mon')
      ORDER BY DATE_TRUNC('month', sales_date)
    `);

    const topProducts = await query(`
      SELECT p.name, p.sku, SUM(si.quantity) as total_sold, SUM(si.subtotal) as total_revenue
      FROM sale_items si
      JOIN products p ON p.id = si.product_id
      JOIN sales s ON s.id = si.sale_id
      WHERE s.status != 'cancelled' AND s.sales_date >= CURRENT_DATE - INTERVAL '30 days'
      GROUP BY p.id, p.name, p.sku
      ORDER BY total_sold DESC LIMIT 5
    `);

    const recentSales = await query(`
      SELECT s.invoice_number, c.name as customer_name, s.total_amount, s.status, s.sales_date
      FROM sales s LEFT JOIN customers c ON c.id = s.customer_id
      ORDER BY s.created_at DESC LIMIT 8
    `);

    const lowStockProducts = await query(`
      SELECT name, sku, stock_quantity, min_stock
      FROM products 
      WHERE stock_quantity <= min_stock AND is_active = true
      ORDER BY stock_quantity ASC LIMIT 5
    `);

    return {
      stats: {
        revenue: parseFloat(String((salesResult as Record<string, unknown>)?.total_revenue || 0)),
        todayRevenue: parseFloat(String((salesResult as Record<string, unknown>)?.today_revenue || 0)),
        totalTransactions: parseInt(String((salesResult as Record<string, unknown>)?.total_transactions || 0)),
        totalProducts: parseInt(String((productsResult as Record<string, unknown>)?.total_products || 0)),
        lowStockCount: parseInt(String((productsResult as Record<string, unknown>)?.low_stock_count || 0)),
        totalCustomers: parseInt(String((customersResult as Record<string, unknown>)?.total || 0)),
      },
      monthlySales,
      topProducts,
      recentSales,
      lowStockProducts,
    };
  } catch {
    return {
      stats: { revenue: 0, todayRevenue: 0, totalTransactions: 0, totalProducts: 0, lowStockCount: 0, totalCustomers: 0 },
      monthlySales: [], topProducts: [], recentSales: [], lowStockProducts: [],
    };
  }
}

function formatRp(amount: number): string {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(amount);
}

export default async function DashboardPage() {
  const session = await getSession();
  const data = await getDashboardStats();
  const { stats, recentSales, lowStockProducts, topProducts } = data;

  const now = new Date();
  const greeting = now.getHours() < 12 ? 'Selamat Pagi' : now.getHours() < 17 ? 'Selamat Siang' : 'Selamat Malam';

  return (
    <div style={{ padding: '32px 28px' }}>
      {/* Header */}
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '2.4rem', fontWeight: 600, color: '#1c1917', lineHeight: 1.1 }}>
          {greeting}, {session?.full_name?.split(' ')[0]}
        </h1>
        <p style={{ color: '#78716c', marginTop: '6px', fontSize: '0.9rem' }}>
          {now.toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </p>
      </div>

      {/* Stats Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '20px', marginBottom: '32px' }}>
        {[
          {
            label: 'Total Pendapatan',
            value: formatRp(stats.revenue),
            sub: 'Semua waktu',
            color: '#b8860b',
            bg: '#fffbeb',
            icon: '◈',
          },
          {
            label: 'Pendapatan Hari Ini',
            value: formatRp(stats.todayRevenue),
            sub: 'Hari ini',
            color: '#065f46',
            bg: '#d1fae5',
            icon: '◉',
          },
          {
            label: 'Total Produk',
            value: stats.totalProducts.toLocaleString(),
            sub: stats.lowStockCount > 0 ? `${stats.lowStockCount} stok menipis` : 'Stok aman',
            color: stats.lowStockCount > 0 ? '#c44223' : '#1e40af',
            bg: stats.lowStockCount > 0 ? '#fef2f2' : '#dbeafe',
            icon: '◫',
          },
          {
            label: 'Total Pelanggan',
            value: stats.totalCustomers.toLocaleString(),
            sub: 'Pelanggan aktif',
            color: '#7c3aed',
            bg: '#f5f3ff',
            icon: '◎',
          },
        ].map((s) => (
          <div key={s.label} className="stat-card" style={{ padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
              <span style={{ fontSize: '0.7rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: '#78716c', fontWeight: 500 }}>
                {s.label}
              </span>
              <div style={{
                width: '36px', height: '36px', borderRadius: '10px',
                background: s.bg, display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: s.color, fontSize: '1.3rem',
              }}>
                {s.icon}
              </div>
            </div>
            <div style={{ fontSize: '1.6rem', fontWeight: 700, color: '#1c1917', marginBottom: '4px', letterSpacing: '-0.02em' }}>
              {s.value}
            </div>
            <div style={{ fontSize: '0.75rem', color: s.color }}>
              {s.sub}
            </div>
          </div>
        ))}
      </div>

      {/* Content Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: '24px', marginBottom: '24px' }}>
        {/* Recent Sales */}
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h3 style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '1.3rem', fontWeight: 600 }}>
              Transaksi Terbaru
            </h3>
            <a href="/sales" style={{ fontSize: '0.75rem', color: '#b8860b', textDecoration: 'none', letterSpacing: '0.05em' }}>
              Lihat semua →
            </a>
          </div>
          <table className="data-table">
            <thead>
              <tr>
                <th>No. Invoice</th>
                <th>Pelanggan</th>
                <th>Total</th>
                <th>Status</th>
                <th>Tanggal</th>
              </tr>
            </thead>
            <tbody>
              {(recentSales as Record<string, unknown>[]).map((sale) => (
                <tr key={String(sale.invoice_number)}>
                  <td style={{ fontWeight: 500, color: '#1c1917', fontSize: '0.8rem' }}>{String(sale.invoice_number)}</td>
                  <td>{String(sale.customer_name || '— Walk-in —')}</td>
                  <td style={{ fontWeight: 600 }}>{formatRp(parseFloat(String(sale.total_amount)))}</td>
                  <td>
                    <span className={`badge ${
                      sale.status === 'delivered' ? 'badge-success' :
                      sale.status === 'confirmed' ? 'badge-info' :
                      sale.status === 'cancelled' ? 'badge-danger' : 'badge-warning'
                    }`}>
                      {String(sale.status)}
                    </span>
                  </td>
                  <td style={{ color: '#78716c', fontSize: '0.8rem' }}>
                    {new Date(String(sale.sales_date)).toLocaleDateString('id-ID', { day: '2-digit', month: 'short' })}
                  </td>
                </tr>
              ))}
              {recentSales.length === 0 && (
                <tr><td colSpan={5} style={{ textAlign: 'center', padding: '32px', color: '#a8a29e' }}>Belum ada transaksi</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Right column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Low Stock Alert */}
          <div className="card" style={{ borderLeft: '3px solid #c44223' }}>
            <h3 style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '1.2rem', fontWeight: 600, marginBottom: '16px', color: '#c44223' }}>
              ⚠ Stok Menipis
            </h3>
            {(lowStockProducts as Record<string, unknown>[]).length === 0 ? (
              <p style={{ color: '#a8a29e', fontSize: '0.85rem', textAlign: 'center', padding: '16px 0' }}>
                ✓ Semua stok aman
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {(lowStockProducts as Record<string, unknown>[]).map(p => (
                  <div key={String(p.sku)} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '10px 12px', background: '#fef2f2', borderRadius: '8px',
                  }}>
                    <div>
                      <div style={{ fontSize: '0.8rem', fontWeight: 500, color: '#1c1917' }}>{String(p.name)}</div>
                      <div style={{ fontSize: '0.7rem', color: '#78716c' }}>{String(p.sku)}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div className="low-stock" style={{ fontSize: '1.1rem', fontWeight: 700 }}>{String(p.stock_quantity)}</div>
                      <div style={{ fontSize: '0.65rem', color: '#a8a29e' }}>min: {String(p.min_stock)}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Top Products */}
          <div className="card">
            <h3 style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '1.2rem', fontWeight: 600, marginBottom: '16px' }}>
              Produk Terlaris (30 Hari)
            </h3>
            {(topProducts as Record<string, unknown>[]).length === 0 ? (
              <p style={{ color: '#a8a29e', fontSize: '0.85rem', textAlign: 'center', padding: '16px 0' }}>Belum ada data</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {(topProducts as Record<string, unknown>[]).map((p, i) => (
                  <div key={String(p.sku)} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{
                      width: '28px', height: '28px', borderRadius: '50%',
                      background: i === 0 ? 'linear-gradient(135deg, #b8860b, #d4a843)' : '#f5f5f4',
                      color: i === 0 ? 'white' : '#78716c',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '0.75rem', fontWeight: 700, flexShrink: 0,
                    }}>
                      {i + 1}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '0.8rem', fontWeight: 500, color: '#1c1917', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {String(p.name)}
                      </div>
                    </div>
                    <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#b8860b', flexShrink: 0 }}>
                      {String(p.total_sold)} pcs
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
