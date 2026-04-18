export const runtime = 'nodejs';

import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import Sidebar from '@/components/Sidebar';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session) redirect('/login');

  return (
    <div style={{
      display: 'flex',
      height: '100vh',        /* full viewport height — tidak lebih */
      overflow: 'hidden',     /* cegah scroll di level wrapper */
      background: '#f7f5f2',
    }}>
      {/* Sidebar: tinggi penuh viewport, scroll internal sendiri */}
      <Sidebar user={session} />

      {/* Main content: tinggi penuh viewport, scroll internal sendiri */}
      <main style={{
        flex: 1,
        minWidth: 0,
        height: '100vh',
        overflowY: 'auto',    /* hanya content yang scroll vertikal */
        overflowX: 'hidden',
      }}>
        {children}
      </main>
    </div>
  );
}
