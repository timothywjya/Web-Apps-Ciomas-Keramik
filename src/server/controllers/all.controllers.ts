import { NextRequest, NextResponse } from 'next/server';
import { SaleService } from '@/server/services/sale.service';
import { ok, created, requireAuth, requireRole, handle } from './base.controller';
import { PurchaseService } from '@/server/services/purchase.service';

export const SaleController = {
  async list(req: NextRequest): Promise<NextResponse> {
    return handle(async () => {
      const auth = await requireAuth();
      if (auth instanceof NextResponse) return auth;
      const sp = req.nextUrl.searchParams;
      const sales = await SaleService.getAll({
        search: sp.get('search') ?? '',
        status: sp.get('status') ?? '',
        from:   sp.get('from')   ?? '',
        to:     sp.get('to')     ?? '',
      });
      return ok({ sales });
    });
  },

  async getOne(req: NextRequest, id: string): Promise<NextResponse> {
    return handle(async () => {
      const auth = await requireAuth();
      if (auth instanceof NextResponse) return auth;
      const sale = await SaleService.getById(id);
      return ok({ sale });
    });
  },

  async create(req: NextRequest): Promise<NextResponse> {
    return handle(async () => {
      const auth = await requireRole('admin', 'manager', 'kasir');
      if (auth instanceof NextResponse) return auth;
      const body = await req.json();
      const sale = await SaleService.create(body, auth.id);
      return created({ sale });
    });
  },

  async update(req: NextRequest, id: string): Promise<NextResponse> {
    return handle(async () => {
      const auth = await requireRole('admin', 'manager', 'kasir');
      if (auth instanceof NextResponse) return auth;
      const body = await req.json();
      const sale = await SaleService.update(id, body);
      return ok({ sale });
    });
  },
};



export const PurchaseController = {
  async list(req: NextRequest): Promise<NextResponse> {
    return handle(async () => {
      const auth = await requireAuth();
      if (auth instanceof NextResponse) return auth;
      const sp = req.nextUrl.searchParams;
      const purchases = await PurchaseService.getAll(
        sp.get('search') ?? '',
        sp.get('status') ?? ''
      );
      return ok({ purchases });
    });
  },

  async create(req: NextRequest): Promise<NextResponse> {
    return handle(async () => {
      const auth = await requireRole('admin', 'manager', 'gudang');
      if (auth instanceof NextResponse) return auth;
      const body     = await req.json();
      const purchase = await PurchaseService.create(body, auth.id);
      return created({ purchase });
    });
  },
};

import { StockService } from '@/server/services/stock.service';

export const StockController = {
  async list(req: NextRequest): Promise<NextResponse> {
    return handle(async () => {
      const auth = await requireAuth();
      if (auth instanceof NextResponse) return auth;
      const sp        = req.nextUrl.searchParams;
      const movements = await StockService.getAll(
        sp.get('type')       ?? '',
        sp.get('product_id') ?? ''
      );
      return ok({ movements });
    });
  },

  async create(req: NextRequest): Promise<NextResponse> {
    return handle(async () => {
      const auth = await requireRole('admin', 'manager', 'gudang');
      if (auth instanceof NextResponse) return auth;
      const body     = await req.json();
      const movement = await StockService.recordMovement(body, auth.id);
      return created({ movement });
    });
  },
};

import { ReportService } from '@/server/services/report.service';

export const ReportController = {
  async get(req: NextRequest): Promise<NextResponse> {
    return handle(async () => {
      const auth = await requireRole('admin', 'manager');
      if (auth instanceof NextResponse) return auth;
      const sp   = req.nextUrl.searchParams;
      const data = await ReportService.getReport({
        type: (sp.get('type') ?? 'monthly') as import('@/types').ReportType,
        from: sp.get('from') ?? '',
        to:   sp.get('to')   ?? '',
      });
      return ok({ data });
    });
  },
};

import { CategoryService } from '@/server/services/misc.service';

export const CategoryController = {
  async list(): Promise<NextResponse> {
    return handle(async () => {
      const auth = await requireAuth();
      if (auth instanceof NextResponse) return auth;
      const categories = await CategoryService.getAll();
      return ok({ categories });
    });
  },
  async create(req: NextRequest): Promise<NextResponse> {
    return handle(async () => {
      const auth = await requireRole('admin', 'manager');
      if (auth instanceof NextResponse) return auth;
      const body     = await req.json();
      const category = await CategoryService.create(body);
      return created({ category });
    });
  },
  async update(req: NextRequest, id: string): Promise<NextResponse> {
    return handle(async () => {
      const auth = await requireRole('admin', 'manager');
      if (auth instanceof NextResponse) return auth;
      const body     = await req.json();
      const category = await CategoryService.update(id, body);
      return ok({ category });
    });
  },
  async delete(req: NextRequest, id: string): Promise<NextResponse> {
    return handle(async () => {
      const auth = await requireRole('admin', 'manager');
      if (auth instanceof NextResponse) return auth;
      await CategoryService.delete(id);
      return ok({ message: 'Kategori dihapus' });
    });
  },
};

import { SupplierService } from '@/server/services/misc.service';

export const SupplierController = {
  async list(req: NextRequest): Promise<NextResponse> {
    return handle(async () => {
      const auth = await requireAuth();
      if (auth instanceof NextResponse) return auth;
      const suppliers = await SupplierService.getAll(req.nextUrl.searchParams.get('search') ?? '');
      return ok({ suppliers });
    });
  },
  async create(req: NextRequest): Promise<NextResponse> {
    return handle(async () => {
      const auth = await requireRole('admin', 'manager');
      if (auth instanceof NextResponse) return auth;
      const body     = await req.json();
      const supplier = await SupplierService.create(body);
      return created({ supplier });
    });
  },
  async update(req: NextRequest, id: string): Promise<NextResponse> {
    return handle(async () => {
      const auth = await requireRole('admin', 'manager');
      if (auth instanceof NextResponse) return auth;
      const body     = await req.json();
      const supplier = await SupplierService.update(id, body);
      return ok({ supplier });
    });
  },
  async delete(req: NextRequest, id: string): Promise<NextResponse> {
    return handle(async () => {
      const auth = await requireRole('admin', 'manager');
      if (auth instanceof NextResponse) return auth;
      await SupplierService.delete(id);
      return ok({ message: 'Supplier dinonaktifkan' });
    });
  },
};

import { CustomerService } from '@/server/services/misc.service';

export const CustomerController = {
  async list(req: NextRequest): Promise<NextResponse> {
    return handle(async () => {
      const auth = await requireAuth();
      if (auth instanceof NextResponse) return auth;
      const sp        = req.nextUrl.searchParams;
      const customers = await CustomerService.getAll(
        sp.get('search') ?? '',
        sp.get('type')   ?? ''
      );
      return ok({ customers });
    });
  },
  async create(req: NextRequest): Promise<NextResponse> {
    return handle(async () => {
      const auth = await requireRole('admin', 'manager', 'kasir');
      if (auth instanceof NextResponse) return auth;
      const body     = await req.json();
      const customer = await CustomerService.create(body);
      return created({ customer });
    });
  },
  async update(req: NextRequest, id: string): Promise<NextResponse> {
    return handle(async () => {
      const auth = await requireRole('admin', 'manager', 'kasir');
      if (auth instanceof NextResponse) return auth;
      const body     = await req.json();
      const customer = await CustomerService.update(id, body);
      return ok({ customer });
    });
  },
  async delete(req: NextRequest, id: string): Promise<NextResponse> {
    return handle(async () => {
      const auth = await requireRole('admin', 'manager');
      if (auth instanceof NextResponse) return auth;
      await CustomerService.delete(id);
      return ok({ message: 'Pelanggan dinonaktifkan' });
    });
  },
};
