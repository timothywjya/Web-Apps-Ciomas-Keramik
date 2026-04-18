import { NextRequest, NextResponse } from 'next/server';
import { ProductService } from '@/server/services/product.service';
import { ok, created, requireAuth, requireRole, handle } from './base.controller';

export const ProductController = {

  async list(req: NextRequest): Promise<NextResponse> {
    return handle(async () => {
      const auth = await requireAuth();
      if (auth instanceof NextResponse) return auth;

      const sp       = req.nextUrl.searchParams;
      const products = await ProductService.getAll({
        search:   sp.get('search') ?? '',
        category: sp.get('category') ?? '',
        active:   sp.get('active') !== 'false' ? true : undefined,
      });
      return ok({ products });
    });
  },

  async getOne(req: NextRequest, id: string): Promise<NextResponse> {
    return handle(async () => {
      const auth = await requireAuth();
      if (auth instanceof NextResponse) return auth;

      const product = await ProductService.getById(id);
      return ok({ product });
    });
  },

  async create(req: NextRequest): Promise<NextResponse> {
    return handle(async () => {
      const auth = await requireRole('admin', 'manager', 'gudang');
      if (auth instanceof NextResponse) return auth;

      const body    = await req.json();
      const product = await ProductService.create(body, auth.id);
      return created({ product });
    });
  },

  async update(req: NextRequest, id: string): Promise<NextResponse> {
    return handle(async () => {
      const auth = await requireRole('admin', 'manager', 'gudang');
      if (auth instanceof NextResponse) return auth;

      const body    = await req.json();
      const product = await ProductService.update(id, body, auth.id);
      return ok({ product });
    });
  },

  async delete(req: NextRequest, id: string): Promise<NextResponse> {
    return handle(async () => {
      const auth = await requireRole('admin', 'manager');
      if (auth instanceof NextResponse) return auth;

      await ProductService.delete(id);
      return ok({ message: 'Produk dinonaktifkan' });
    });
  },

};
