import { NextRequest, NextResponse } from 'next/server';

const PUBLIC_PATHS = ['/login', '/api/auth/login'];

/**
 * Decode JWT payload tanpa verifikasi signature.
 * Verifikasi signature dilakukan di API routes (Node.js runtime).
 * Middleware hanya cek keberadaan & expiry token — aman untuk Edge Runtime.
 */
function decodeJwtPayload(token: string): { exp?: number; role?: string } | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    // Base64url decode the payload (part index 1)
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const json = atob(base64);
    return JSON.parse(json);
  } catch {
    return null;
  }
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Allow public paths
  if (PUBLIC_PATHS.some(p => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // Allow static files & Next.js internals
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname.startsWith('/icons') ||
    pathname.startsWith('/images')
  ) {
    return NextResponse.next();
  }

  // Check auth token
  const token = req.cookies.get('auth_token')?.value;

  if (!token) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Unauthorized — token tidak ditemukan' }, { status: 401 });
    }
    return NextResponse.redirect(new URL('/login', req.url));
  }

  // Decode payload (edge-safe, no crypto)
  const payload = decodeJwtPayload(token);

  if (!payload) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Token tidak valid' }, { status: 401 });
    }
    const res = NextResponse.redirect(new URL('/login', req.url));
    res.cookies.delete('auth_token');
    return res;
  }

  // Check expiry
  if (payload.exp && Date.now() / 1000 > payload.exp) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Token sudah kadaluarsa, silakan login ulang' }, { status: 401 });
    }
    const res = NextResponse.redirect(new URL('/login', req.url));
    res.cookies.delete('auth_token');
    return res;
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
