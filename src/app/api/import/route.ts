export const runtime = 'nodejs';
import { NextRequest, NextResponse } from 'next/server';
import { requireRole, ok, fail, handle } from '@/server/controllers/base.controller';
import {
  importCategories, importSuppliers, importCustomers, importProducts,
  generateTemplate, ImportTarget,
} from '@/server/services/import.service';

const VALID_TARGETS = new Set<ImportTarget>(['categories', 'suppliers', 'customers', 'products']);

const IMPORTERS: Record<ImportTarget, (text: string) => Promise<unknown>> = {
  categories: importCategories,
  suppliers : importSuppliers,
  customers : importCustomers,
  products  : importProducts,
};

function getTarget(req: NextRequest): ImportTarget | null {
  const t = req.nextUrl.searchParams.get('target');
  return VALID_TARGETS.has(t as ImportTarget) ? (t as ImportTarget) : null;
}

// GET /api/import?target=products  →  download CSV template
export async function GET(req: NextRequest) {
  const target = getTarget(req);
  if (!target) return fail('target tidak valid. Gunakan: categories | suppliers | customers | products');

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

    const target = getTarget(req);
    if (!target) return fail('target tidak valid');

    const formData = await req.formData();
    const file     = formData.get('file') as File | null;

    if (!file)                           return fail('File CSV tidak ditemukan');
    if (!file.name.endsWith('.csv'))     return fail('Hanya file .csv yang diizinkan');
    if (file.size > 5 * 1024 * 1024)    return fail('Ukuran file maksimal 5 MB');
    if (file.size === 0)                 return fail('File tidak boleh kosong');

    const result = await IMPORTERS[target](await file.text());
    return ok({ target, result });
  });
}
