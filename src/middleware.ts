import { NextRequest, NextResponse } from 'next/server';

const PUBLIC_PATHS  = ['/login', '/api/auth/login'];
const STATIC_PREFIX = ['/_next', '/favicon', '/icons', '/images'];
const COOKIE_NAME   = 'auth_token';

/**
 * Decode JWT payload without signature verification.
 *
 * Security note:
 * Middleware runs on Edge Runtime — Node.js crypto (jsonwebtoken) is unavailable here.
 * Full signature verification is done in every API route via getSession() (Node.js runtime).
 * Here we only check presence + expiry to guard page navigation and redirect early.
 */
function decodeJwtPayload(token: string): { exp?: number } | null {
  try {
    const [, payload] = token.split('.');
    if (!payload) return null;
    const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(json) as { exp?: number };
  } catch {
    return null;
  }
}

function isExpired(exp?: number): boolean {
  return !!exp && Date.now() / 1000 > exp;
}

function redirectToLogin(req: NextRequest): NextResponse {
  const res = NextResponse.redirect(new URL('/login', req.url));
  res.cookies.delete(COOKIE_NAME);
  return res;
}

export function middleware(req: NextRequest): NextResponse {
  const { pathname } = req.nextUrl;
  const isApi = pathname.startsWith('/api/');

  if (PUBLIC_PATHS.some(p => pathname.startsWith(p))) return NextResponse.next();
  if (STATIC_PREFIX.some(p => pathname.startsWith(p))) return NextResponse.next();

  const token = req.cookies.get(COOKIE_NAME)?.value;

  if (!token) {
    return isApi
      ? NextResponse.json({ success: false, error: 'Token tidak ditemukan' }, { status: 401 })
      : redirectToLogin(req);
  }

  const payload = decodeJwtPayload(token);

  if (!payload) {
    return isApi
      ? NextResponse.json({ success: false, error: 'Token tidak valid' }, { status: 401 })
      : redirectToLogin(req);
  }

  if (isExpired(payload.exp)) {
    return isApi
      ? NextResponse.json({ success: false, error: 'Sesi telah berakhir, silakan login kembali' }, { status: 401 })
      : redirectToLogin(req);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
