
import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import type { UserPayload } from '@/types';

export function ok<T extends object>(data: T, status = 200) {
  return NextResponse.json({ success: true, ...data }, { status });
}

export function created<T extends object>(data: T) {
  return ok(data, 201);
}

export function noContent() {
  return new NextResponse(null, { status: 204 });
}

export function fail(message: string, status = 400) {
  return NextResponse.json({ success: false, error: message }, { status });
}

export function unauthorized(message = 'Unauthorized') {
  return fail(message, 401);
}

export function forbidden(message = 'Akses ditolak') {
  return fail(message, 403);
}

export function serverError(err: unknown) {
  const msg = err instanceof Error ? err.message : 'Terjadi kesalahan server';
  console.error('[SERVER ERROR]', err);
  return fail(msg, 500);
}

/** Require authenticated session; return user or 401 response. */
export async function requireAuth(): Promise<UserPayload | NextResponse> {
  const session = await getSession();
  if (!session) return unauthorized('Sesi tidak ditemukan, silakan login kembali');
  return session;
}

/** Require specific roles. */
export async function requireRole(
  ...roles: string[]
): Promise<UserPayload | NextResponse> {
  const session = await getSession();
  if (!session) return unauthorized('Sesi tidak ditemukan, silakan login kembali');
  if (!roles.includes(session.role)) {
    return forbidden(`Hanya ${roles.join(' / ')} yang dapat mengakses fitur ini`);
  }
  return session;
}

/** Helper: run a controller action with automatic error handling. */
export async function handle(fn: () => Promise<NextResponse>): Promise<NextResponse> {
  try {
    return await fn();
  } catch (err) {
    return serverError(err);
  }
}
