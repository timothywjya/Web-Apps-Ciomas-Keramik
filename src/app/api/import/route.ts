export const runtime = 'nodejs';
import { NextRequest, NextResponse } from 'next/server';
import { requireRole, ok, fail, handle } from '@/server/controllers/base.controller';
import { importCategories, importSuppliers, importProducts, generateTemplate } from '@/server/services/import.service';
import type { ImportTarget } from '@/server/services/import.service';

const VALID_TARGETS: ImportTarget[] = ['categories', 'suppliers', 'products'];

// GET /api/import?target=products  →  download CSV template
export async function GET(req: NextRequest) {
  const target = req.nextUrl.searchParams.get('target') as ImportTarget;
  if (!VALID_TARGETS.includes(target)) return fail('Target tidak valid. Gunakan: categories, suppliers, products');

  const { csv, filename } = generateTemplate(target);
  return new NextResponse(csv, {
    status : 200,
    headers: {
      'Content-Type'       : 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}

// POST /api/import?target=products  →  upload & process CSV
export async function POST(req: NextRequest) {
  return handle(async () => {
    const auth = await requireRole('admin', 'manager');
    if (auth instanceof NextResponse) return auth;

    const target = req.nextUrl.searchParams.get('target') as ImportTarget;
    if (!VALID_TARGETS.includes(target)) return fail('Target tidak valid');

    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    if (!file) return fail('File CSV tidak ditemukan');
    if (!file.name.endsWith('.csv')) return fail('Hanya file .csv yang diizinkan');
    if (file.size > 5 * 1024 * 1024) return fail('Ukuran file maksimal 5MB');

    const text = await file.text();

    let result;
    if (target === 'categories') result = await importCategories(text);
    else if (target === 'suppliers') result = await importSuppliers(text);
    else result = await importProducts(text);

    return ok({ result, target });
  });
}
