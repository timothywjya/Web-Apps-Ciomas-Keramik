import { NextRequest, NextResponse } from 'next/server';

const PUBLIC_PATHS  = ['/login', '/api/auth/login'];
const STATIC_PREFIX = ['/_next', '/favicon', '/icons', '/images'];
const COOKIE_NAME = '__Host-auth_token';

interface RateEntry { count: number; resetAt: number }
const rateLimitStore = new Map<string, RateEntry>();

const RATE_LIMITS: Record<string, { max: number; windowMs: number }> = {
  '/api/auth/login' : { max: 5,   windowMs: 15 * 60 * 1000 }, 
  '/api/'           : { max: 120, windowMs: 60 * 1000 },  
  default           : { max: 200, windowMs: 60 * 1000 }, 
};

function getRateLimit(pathname: string) {
  if (pathname.startsWith('/api/auth/login')) return RATE_LIMITS['/api/auth/login'];
  if (pathname.startsWith('/api/'))           return RATE_LIMITS['/api/'];
  return RATE_LIMITS.default;
}

function checkRateLimit(ip: string, pathname: string): boolean {
  const limit = getRateLimit(pathname);
  const key   = `${ip}:${pathname.startsWith('/api/auth') ? pathname : pathname.startsWith('/api/') ? '/api/' : 'page'}`;
  const now   = Date.now();
  const entry = rateLimitStore.get(key);

  if (!entry || now > entry.resetAt) {
    rateLimitStore.set(key, { count: 1, resetAt: now + limit.windowMs });
    return true;                        // allowed
  }
  entry.count++;
  if (entry.count > limit.max) return false; // blocked
  return true;
}

// Prune expired entries periodically (runs only when a request comes in)
let lastPrune = Date.now();
function pruneIfNeeded() {
  const now = Date.now();
  if (now - lastPrune < 5 * 60 * 1000) return;
  lastPrune = now;
  for (const [key, entry] of rateLimitStore) {
    if (now > entry.resetAt) rateLimitStore.delete(key);
  }
}

function decodeJwtPayload(token: string): { exp?: number; id?: string } | null {
  try {
    const [, payload] = token.split('.');
    if (!payload) return null;
    const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(json) as { exp?: number; id?: string };
  } catch {
    return null;
  }
}

function isExpired(exp?: number): boolean {
  return !!exp && Date.now() / 1000 > exp;
}

function addSecurityHeaders(res: NextResponse): NextResponse {
  // Prevent XSS
  res.headers.set('X-Content-Type-Options', 'nosniff');
  res.headers.set('X-Frame-Options', 'DENY');
  res.headers.set('X-XSS-Protection', '1; mode=block');
  res.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');

  // Content Security Policy — tighten further if you add external CDNs
  res.headers.set(
    'Content-Security-Policy',
    [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'", // Next.js needs unsafe-eval in dev
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob:",
      "font-src 'self'",
      "connect-src 'self'",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join('; '),
  );

  // HSTS — only meaningful over HTTPS
  if (process.env.NODE_ENV === 'production') {
    res.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  }

  return res;
}

function getClientIp(req: NextRequest): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    req.headers.get('x-real-ip') ??
    'unknown'
  );
}

function redirectToLogin(req: NextRequest, reason?: string): NextResponse {
  const url = new URL('/login', req.url);
  if (reason) url.searchParams.set('reason', reason);
  const res = NextResponse.redirect(url);
  res.cookies.delete(COOKIE_NAME);
  addSecurityHeaders(res);
  return res;
}

function rateLimitedResponse(isApi: boolean): NextResponse {
  if (isApi) {
    return NextResponse.json(
      { success: false, error: 'Terlalu banyak permintaan. Coba lagi nanti.' },
      {
        status: 429,
        headers: {
          'Retry-After': '60',
          'X-RateLimit-Limit': '120',
        },
      },
    );
  }
  return new NextResponse('Too Many Requests', {
    status: 429,
    headers: { 'Retry-After': '60', 'Content-Type': 'text/plain' },
  });
}

export function proxy(req: NextRequest): NextResponse {
  const { pathname } = req.nextUrl;
  const isApi        = pathname.startsWith('/api/');

  // 1. Skip static assets
  if (STATIC_PREFIX.some(p => pathname.startsWith(p))) {
    return addSecurityHeaders(NextResponse.next());
  }

  pruneIfNeeded();
  const ip = getClientIp(req);
  if (!checkRateLimit(ip, pathname)) {
    return rateLimitedResponse(isApi);
  }

  if (PUBLIC_PATHS.some(p => pathname.startsWith(p))) {
    return addSecurityHeaders(NextResponse.next());
  }

  // 4. Auth check
  const token = req.cookies.get(COOKIE_NAME)?.value;

  if (!token) {
    return isApi
      ? addSecurityHeaders(NextResponse.json({ success: false, error: 'Token tidak ditemukan' }, { status: 401 }))
      : redirectToLogin(req);
  }

  const payload = decodeJwtPayload(token);

  if (!payload) {
    return isApi
      ? addSecurityHeaders(NextResponse.json({ success: false, error: 'Token tidak valid' }, { status: 401 }))
      : redirectToLogin(req);
  }

  if (isExpired(payload.exp)) {
    return isApi
      ? addSecurityHeaders(NextResponse.json({ success: false, error: 'Sesi telah berakhir, silakan login kembali' }, { status: 401 }))
      : redirectToLogin(req, 'timeout');
  }

  return addSecurityHeaders(NextResponse.next());
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
