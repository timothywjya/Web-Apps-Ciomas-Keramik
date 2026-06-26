export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import Sidebar from '@/components/Sidebar';
import SessionGuard from '@/components/SessionGuard';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const store = await cookies();
  const allCookies = store.getAll();

  const session = await getSession();

  if (!session) redirect('/login');

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: '#f7f5f2' }}>
      <Sidebar user={session!} />  {/* ? tambah ! di sini */}
      <main style={{ flex: 1, minWidth: 0, height: '100vh', overflowY: 'auto', overflowX: 'hidden' }}>
        {children}
      </main>
      <SessionGuard />
    </div>
  );
}