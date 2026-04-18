import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { AuthService } from '@/server/services/auth.service';
import { ok, fail, handle } from './base.controller';

const COOKIE_NAME  = 'auth_token';

const SESSION_SECS = 60 * 60 * 3;

export const AuthController = {

  async login(req: NextRequest): Promise<NextResponse> {
    return handle(async () => {
      const { username, password } = await req.json();
      const { token, user } = await AuthService.login(username, password);

      const cookieStore = await cookies();
      cookieStore.set(COOKIE_NAME, token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: SESSION_SECS,
        path: '/',
      });

      return ok({ user });
    });
  },

  async logout(): Promise<NextResponse> {
    const cookieStore = await cookies();
    cookieStore.delete(COOKIE_NAME);
    return ok({ message: 'Berhasil keluar' });
  },

  async refresh(): Promise<NextResponse> {
    // Called by the client heartbeat — just resets the cookie TTL.
    return handle(async () => {
      const cookieStore = await cookies();
      const existing = cookieStore.get(COOKIE_NAME)?.value;
      if (!existing) return fail('Token tidak ditemukan', 401);

      cookieStore.set(COOKIE_NAME, existing, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: SESSION_SECS,
        path: '/',
      });

      return ok({ refreshed: true });
    });
  },

};
