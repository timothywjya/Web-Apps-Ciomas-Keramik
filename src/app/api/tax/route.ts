export const runtime = 'nodejs';
import { NextResponse } from 'next/server';

// GET /api/tax — Stub untuk modul perpajakan (Coming Soon)
// Endpoint ini akan diisi saat spesifikasi perpajakan diterima

export async function GET() {
  return NextResponse.json(
    { message: 'Modul perpajakan sedang dalam pengembangan', status: 'coming_soon' },
    { status: 200 }
  );
}
