'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';

const navGroups = [
  {
    section: 'Utama', defaultOpen: true,
    items: [
      { href: '/dashboard', label: 'Dashboard', icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg> },
    ]
  },
  {
    section: 'Transaksi', defaultOpen: true,
    items: [
      { href: '/sales', label: 'Penjualan', icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg> },
      { href: '/purchases', label: 'Pembelian', icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg> },
    ]
  },
  {
    section: 'Inventori', defaultOpen: true,
    items: [
      { href: '/products', label: 'Produk', icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg> },
      { href: '/stock', label: 'Stok & Pergerakan', icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg> },
      { href: '/categories', label: 'Kategori', icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg> },
    ]
  },
  {
    section: 'Relasi', defaultOpen: false,
    items: [
      { href: '/customers', label: 'Pelanggan', icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg> },
      { href: '/suppliers', label: 'Supplier', icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg> },
    ]
  },
  {
    section: 'Master', defaultOpen: false,
    items: [
      { href: '/users', label: 'Master User', icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg> },
      { href: '/reports', label: 'Laporan', icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg> },
    ]
  },
];

function NavContent({ collapsed, pathname, openSections, toggleSection, user, handleLogout }: {
  collapsed: boolean;
  pathname: string;
  openSections: Record<string, boolean>;
  toggleSection: (s: string) => void;
  user?: { full_name: string; role: string };
  handleLogout: () => void;
}) {
  return (
    <>
      {/* Navigation */}
      <nav style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: '8px 0' }}>
        {navGroups.map(group => {
          const isOpen = openSections[group.section] ?? group.defaultOpen;
          const hasActive = group.items.some(i => pathname.startsWith(i.href));
          return (
            <div key={group.section}>
              <button
                onClick={() => toggleSection(group.section)}
                style={{
                  width: '100%', background: 'none', border: 'none',
                  cursor: collapsed ? 'default' : 'pointer',
                  display: 'flex', alignItems: 'center',
                  justifyContent: collapsed ? 'center' : 'space-between',
                  padding: collapsed ? '8px 0' : '10px 20px 5px',
                }}
              >
                {collapsed ? (
                  <div style={{ width: '20px', height: '1px', background: '#2c2825' }} />
                ) : (
                  <>
                    <span style={{ fontSize: '0.6rem', letterSpacing: '0.15em', textTransform: 'uppercase', color: hasActive ? '#a08050' : '#474340', fontWeight: 600 }}>
                      {group.section}
                    </span>
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={hasActive ? '#a08050' : '#474340'} strokeWidth="2.5"
                      style={{ transition: 'transform 0.2s', transform: isOpen ? 'rotate(0)' : 'rotate(-90deg)', flexShrink: 0 }}>
                      <polyline points="6 9 12 15 18 9"/>
                    </svg>
                  </>
                )}
              </button>

              <div style={{ overflow: 'hidden', maxHeight: (collapsed || isOpen) ? '400px' : '0', transition: 'max-height 0.22s ease' }}>
                {group.items.map(item => {
                  const active = pathname.startsWith(item.href);
                  return (
                    <Link key={item.href} href={item.href} title={collapsed ? item.label : undefined}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '10px',
                        padding: collapsed ? '9px 0' : '8px 16px',
                        margin: collapsed ? '1px 8px' : '1px 8px',
                        borderRadius: '8px', textDecoration: 'none',
                        justifyContent: collapsed ? 'center' : 'flex-start',
                        background: active ? 'rgba(212,168,67,0.11)' : 'transparent',
                        borderLeft: active && !collapsed ? '2px solid #d4a843' : '2px solid transparent',
                        color: active ? '#d4a843' : '#786e68',
                        transition: 'all 0.15s',
                      }}
                      onMouseEnter={e => { if (!active) { const el = e.currentTarget as HTMLElement; el.style.background = 'rgba(255,255,255,0.05)'; el.style.color = '#b0a090'; }}}
                      onMouseLeave={e => { if (!active) { const el = e.currentTarget as HTMLElement; el.style.background = 'transparent'; el.style.color = '#786e68'; }}}
                    >
                      <span style={{ flexShrink: 0, display: 'flex', opacity: active ? 1 : 0.65 }}>{item.icon}</span>
                      {!collapsed && (
                        <span style={{ fontSize: '0.82rem', fontWeight: active ? 500 : 400, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {item.label}
                        </span>
                      )}
                      {collapsed && active && (
                        <div style={{ position: 'absolute', right: '4px', width: '3px', height: '3px', borderRadius: '50%', background: '#d4a843' }} />
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
      </nav>

      {/* User footer */}
      <div style={{ padding: collapsed ? '10px 8px' : '12px 16px', borderTop: '1px solid #272320', background: 'rgba(0,0,0,0.18)' }}>
        {collapsed ? (
          <div title={`${user?.full_name} — ${user?.role}`} style={{ width: '36px', height: '36px', borderRadius: '50%', margin: '0 auto', background: 'rgba(212,168,67,0.12)', border: '1px solid rgba(212,168,67,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#d4a843', fontWeight: 700, fontSize: '0.85rem', cursor: 'default' }}>
            {user?.full_name?.charAt(0).toUpperCase() || 'A'}
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: '9px', marginBottom: '9px' }}>
              <div style={{ width: '32px', height: '32px', borderRadius: '50%', flexShrink: 0, background: 'rgba(212,168,67,0.12)', border: '1px solid rgba(212,168,67,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#d4a843', fontWeight: 700, fontSize: '0.8rem' }}>
                {user?.full_name?.charAt(0).toUpperCase() || 'A'}
              </div>
              <div style={{ overflow: 'hidden' }}>
                <div style={{ color: '#ccc6bc', fontSize: '0.78rem', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user?.full_name}</div>
                <div style={{ color: '#504844', fontSize: '0.6rem', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{user?.role}</div>
              </div>
            </div>
            <button onClick={handleLogout} style={{ width: '100%', background: 'transparent', border: '1px solid #272320', borderRadius: '7px', color: '#504844', padding: '6px 10px', fontSize: '0.68rem', letterSpacing: '0.08em', textTransform: 'uppercase', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', transition: 'all 0.2s' }}
              onMouseEnter={e => { const el = e.currentTarget; el.style.borderColor = '#b03820'; el.style.color = '#d04828'; el.style.background = 'rgba(176,56,32,0.08)'; }}
              onMouseLeave={e => { const el = e.currentTarget; el.style.borderColor = '#272320'; el.style.color = '#504844'; el.style.background = 'transparent'; }}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
              Keluar
            </button>
          </>
        )}
      </div>
    </>
  );
}

export default function Sidebar({ user }: { user?: { full_name: string; role: string } }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>(
    Object.fromEntries(navGroups.map(g => [g.section, g.defaultOpen]))
  );

  useEffect(() => { setMobileOpen(false); }, [pathname]);

  function toggleSection(section: string) {
    if (collapsed) return;
    setOpenSections(prev => ({ ...prev, [section]: !prev[section] }));
  }

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.href = '/login';
  }

  const W = collapsed ? '68px' : '272px';

  const logoBlock = (showToggle: boolean) => (
    <div style={{ padding: collapsed ? '18px 0' : '18px 16px', borderBottom: '1px solid #272320', display: 'flex', alignItems: 'center', justifyContent: collapsed ? 'center' : 'space-between', gap: '8px', minHeight: '68px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', overflow: 'hidden' }}>
        <div style={{ width: '34px', height: '34px', borderRadius: '8px', flexShrink: 0, background: 'linear-gradient(135deg, #b8860b, #e0b84a)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 8px rgba(184,134,11,0.3)' }}>
          <svg width="17" height="17" viewBox="0 0 24 24" fill="white"><rect x="2" y="2" width="9" height="9" rx="1.5"/><rect x="13" y="2" width="9" height="9" rx="1.5"/><rect x="2" y="13" width="9" height="9" rx="1.5"/><rect x="13" y="13" width="9" height="9" rx="1.5"/></svg>
        </div>
        {!collapsed && (
          <div style={{ overflow: 'hidden' }}>
            <div style={{ fontFamily: 'Cormorant Garamond, Georgia, serif', fontSize: '1.05rem', fontWeight: 600, color: '#d4a843', whiteSpace: 'nowrap' }}>Ciomas Keramik</div>
            <div style={{ fontSize: '0.58rem', color: '#474340', letterSpacing: '0.14em', textTransform: 'uppercase' }}>Management System</div>
          </div>
        )}
      </div>
      {showToggle && (
        <button onClick={() => setCollapsed(c => !c)}
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid #272320', borderRadius: '6px', cursor: 'pointer', color: '#5a5450', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '26px', height: '26px', flexShrink: 0, transition: 'all 0.2s' }}
          onMouseEnter={e => { const el = e.currentTarget; el.style.color = '#d4a843'; el.style.borderColor = 'rgba(212,168,67,0.3)'; }}
          onMouseLeave={e => { const el = e.currentTarget; el.style.color = '#5a5450'; el.style.borderColor = '#272320'; }}
          title={collapsed ? 'Perlebar' : 'Perkecil'}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            {collapsed ? <polyline points="9 18 15 12 9 6"/> : <polyline points="15 18 9 12 15 6"/>}
          </svg>
        </button>
      )}
    </div>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside style={{ width: W, minHeight: '100vh', background: 'linear-gradient(180deg,#1a1714 0%,#211d1a 60%,#1a1714 100%)', borderRight: '1px solid #272320', display: 'flex', flexDirection: 'column', transition: 'width 0.25s cubic-bezier(0.4,0,0.2,1)', overflow: 'hidden', flexShrink: 0, position: 'relative' }} className="sidebar-desktop">
        {logoBlock(true)}
        <NavContent collapsed={collapsed} pathname={pathname} openSections={openSections} toggleSection={toggleSection} user={user} handleLogout={handleLogout} />
      </aside>

      {/* Mobile toggle button */}
      <button className="sidebar-mobile-btn" onClick={() => setMobileOpen(true)}
        style={{ position: 'fixed', top: '14px', left: '14px', zIndex: 60, background: '#1a1714', border: '1px solid #272320', borderRadius: '8px', color: '#d4a843', padding: '8px', cursor: 'pointer', boxShadow: '0 4px 12px rgba(0,0,0,0.35)', display: 'none', alignItems: 'center', justifyContent: 'center' }}>
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
      </button>

      {/* Mobile overlay */}
      {mobileOpen && <div onClick={() => setMobileOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', zIndex: 65, backdropFilter: 'blur(3px)' }} />}

      {/* Mobile drawer */}
      <aside className="sidebar-mobile-drawer" style={{ position: 'fixed', top: 0, left: 0, bottom: 0, zIndex: 66, width: '272px', background: 'linear-gradient(180deg,#1a1714 0%,#211d1a 60%,#1a1714 100%)', borderRight: '1px solid #272320', display: 'flex', flexDirection: 'column', overflow: 'hidden', transition: 'transform 0.28s cubic-bezier(0.4,0,0.2,1)', transform: mobileOpen ? 'translateX(0)' : 'translateX(-100%)' }}>
        <div style={{ position: 'relative' }}>
          {logoBlock(false)}
          <button onClick={() => setMobileOpen(false)} style={{ position: 'absolute', top: '18px', right: '14px', background: 'rgba(255,255,255,0.05)', border: '1px solid #272320', borderRadius: '6px', color: '#6b6460', cursor: 'pointer', width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        <NavContent collapsed={false} pathname={pathname} openSections={Object.fromEntries(navGroups.map(g => [g.section, true]))} toggleSection={() => {}} user={user} handleLogout={handleLogout} />
      </aside>

      <style>{`
        @media (min-width: 768px) { .sidebar-desktop { display: flex !important; } .sidebar-mobile-btn { display: none !important; } .sidebar-mobile-drawer { display: none !important; } }
        @media (max-width: 767px) { .sidebar-desktop { display: none !important; } .sidebar-mobile-btn { display: flex !important; } }
      `}</style>
    </>
  );
}
