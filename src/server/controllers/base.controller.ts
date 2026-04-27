import { NextResponse }         from 'next/server';
import { getSession }           from '@/lib/auth';
import { isValidUUID }          from '@/lib/validation';
import type { UserPayload }     from '@/types';

type Role = UserPayload['role'];

export function ok<T extends object>(data: T, status = 200) {
  return NextResponse.json({ success: true, ...data }, { status });
}

export const created   = <T extends object>(data: T) => ok(data, 201);
export const noContent = () => new NextResponse(null, { status: 204 });

export function fail(message: string, status = 400) {
  return NextResponse.json({ success: false, error: message }, { status });
}

export const unauthorized = (msg = 'Sesi tidak ditemukan, silakan login kembali') => fail(msg, 401);
export const forbidden     = (msg = 'Akses ditolak')                               => fail(msg, 403);

export function serverError(err: unknown): NextResponse {
  console.error('[SERVER ERROR]', err);
  
  const message = process.env.NODE_ENV !== 'production'
    ? (err instanceof Error ? err.message : 'Unknown error')
    : 'Terjadi kesalahan server. Silakan coba lagi.';
  return fail(message, 500);
}

export async function requireAuth(): Promise<UserPayload | NextResponse> {
  const session = await getSession();
  return session ?? unauthorized();
}

export async function requireRole(...roles: Role[]): Promise<UserPayload | NextResponse> {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!roles.includes(session.role)) {
    return forbidden(`Hanya ${roles.join(' / ')} yang dapat mengakses fitur ini`);
  }
  return session;
}

export function validateId(id: string): NextResponse | null {
  if (!isValidUUID(id)) {
    return fail('ID tidak valid.', 400);
  }
  return null;
}

export async function handle(fn: () => Promise<NextResponse>): Promise<NextResponse> {
  try {
    return await fn();
  } catch (err) {
    // Let ValidationError surface with its own 400 message
    if (err instanceof Error && err.name === 'ValidationError') {
      return fail(err.message, 400);
    }
    return serverError(err);
  }
}
