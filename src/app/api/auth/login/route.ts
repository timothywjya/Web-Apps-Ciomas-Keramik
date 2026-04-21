export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { setAuthCookie } from '@/lib/auth';
import { AuthService }   from '@/server/services/auth.service';
import { ok, fail }      from '@/server/controllers/base.controller';
import {
  validateLoginPayload,
  assertBodySize,
  ValidationError,
} from '@/lib/validation';

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
  
    assertBodySize(req, 4 * 1024);
    const body    = await req.json();
    const payload = validateLoginPayload(body);

    const { token, user } = await AuthService.login(payload.username, payload.password);
    await setAuthCookie(token);
    return ok({ user });

  } catch (err) {
    if (err instanceof ValidationError) {
      return fail(err.message, 400);
    }
    if (err instanceof SyntaxError) {
      return fail('Format request tidak valid.', 400);
    }

      console.error('[LOGIN]', err instanceof Error ? err.message : err);
    return fail('Username atau password salah.', 401);
  }
}
