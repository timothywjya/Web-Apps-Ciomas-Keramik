'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const navItems = [
  {
    section: 'Utama',
    items: [
      { href: '/dashboard', label: 'Dashboard', icon: '⬡' },
    ]
  },
  {
    section: 'Transaksi',
    items: [
      { href: '/sales', label: 'Penjualan', icon: '◈' },
      { href: '/purchases', label: 'Pembelian', icon: '◉' },
    ]
  },
  {
    section: 'Inventori',
    items: [
      { href: '/products', label: 'Produk', icon: '◫' },
      { href: '/stock', label: 'Stok & Pergerakan', icon: '◳' },
      { href: '/categories', label: 'Kategori', icon: '◻' },
    ]
  },
  {
    section: 'Relasi',
    items: [
      { href: '/customers', label: 'Pelanggan', icon: '◎' },
      { href: '/suppliers', label: 'Supplier', icon: '◑' },
    ]
  },
  {
    section: 'Master',
    items: [
      { href: '/users', label: 'Master User', icon: '◐' },
      { href: '/reports', label: 'Laporan', icon: '◷' },
    ]
  },
];

export default function Sidebar({ user }: { user?: { full_name: string; role: string } }) {
  const pathname = usePathname();

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.href = '/login';
  }

  return (
    <aside className="sidebar">
      {/* Logo */}
      <div style={{
        padding: '28px 20px 20px',
        borderBottom: '1px solid #292524',
        display: 'flex', alignItems: 'center', gap: '12px',
      }}>
        <div style={{
          width: '40px', height: '40px', borderRadius: '10px',
          background: 'linear-gradient(135deg, #b8860b, #d4a843)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
            <rect x="2" y="2" width="9" height="9" rx="1" />
            <rect x="13" y="2" width="9" height="9" rx="1" />
            <rect x="2" y="13" width="9" height="9" rx="1" />
            <rect x="13" y="13" width="9" height="9" rx="1" />
          </svg>
        </div>
        <div>
          <div className="sidebar-logo" style={{ fontSize: '1.1rem' }}>Ciomas Keramik</div>
          <div style={{ fontSize: '0.65rem', color: '#57534e', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
            Management System
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav style={{ padding: '12px 0', flex: 1, overflowY: 'auto' }}>
        {navItems.map(group => (
          <div key={group.section}>
            <div className="nav-section">{group.section}</div>
            {group.items.map(item => (
              <Link
                key={item.href}
                href={item.href}
                className={`nav-item ${pathname.startsWith(item.href) ? 'active' : ''}`}
              >
                <span style={{ fontSize: '1.1rem', lineHeight: 1 }}>{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            ))}
          </div>
        ))}
      </nav>

      {/* User info */}
      <div style={{
        padding: '16px 20px',
        borderTop: '1px solid #292524',
        background: 'rgba(0,0,0,0.2)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
          <div style={{
            width: '36px', height: '36px', borderRadius: '50%',
            background: 'linear-gradient(135deg, #b8860b40, #d4a84340)',
            border: '1px solid #d4a84360',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#d4a843', fontSize: '0.9rem', fontWeight: 600,
          }}>
            {user?.full_name?.charAt(0) || 'A'}
          </div>
          <div>
            <div style={{ color: '#e7e5e4', fontSize: '0.8rem', fontWeight: 500 }}>
              {user?.full_name || 'Administrator'}
            </div>
            <div style={{ color: '#78716c', fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
              {user?.role || 'admin'}
            </div>
          </div>
        </div>
        <button
          onClick={handleLogout}
          style={{
            width: '100%', background: 'transparent',
            border: '1px solid #44403c', borderRadius: '6px',
            color: '#78716c', padding: '7px 12px',
            fontSize: '0.7rem', letterSpacing: '0.08em',
            textTransform: 'uppercase', cursor: 'pointer',
            transition: 'all 0.2s',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
          }}
          onMouseEnter={e => {
            (e.target as HTMLElement).style.borderColor = '#c44223';
            (e.target as HTMLElement).style.color = '#c44223';
          }}
          onMouseLeave={e => {
            (e.target as HTMLElement).style.borderColor = '#44403c';
            (e.target as HTMLElement).style.color = '#78716c';
          }}
        >
          ✕ Keluar
        </button>
      </div>
    </aside>
  );
}
