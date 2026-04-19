export const runtime = 'nodejs';
import { NextRequest, NextResponse } from 'next/server';
import { requireRole, ok, handle } from '@/server/controllers/base.controller';
import { SyncService } from '@/server/services/sync.service';

// GET /api/sync  →  preview duplicates
export async function GET(req: NextRequest) {
  return handle(async () => {
    const auth = await requireRole('admin', 'manager');
    if (auth instanceof NextResponse) return auth;
    const preview = await SyncService.preview();
    return ok({ preview });
  });
}

// POST /api/sync  →  merge/fix all duplicates
export async function POST(req: NextRequest) {
  return handle(async () => {
    const auth = await requireRole('admin', 'manager');
    if (auth instanceof NextResponse) return auth;
    const result = await SyncService.merge();
    return ok({ result });
  });
}
