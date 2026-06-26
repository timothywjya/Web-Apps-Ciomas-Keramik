export const runtime = 'nodejs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function GET() {
  const store = await cookies();
  const all = store.getAll();
  const token = store.get('auth_token')?.value;
  return NextResponse.json({ 
    cookies: all.map(c => c.name),
    hasToken: !!token,
    tokenPreview: token?.slice(0, 30)
  });
}
