import { NextRequest, NextResponse } from 'next/server';
import { SaleService }     from '@/server/services/sale.service';
import { PurchaseService } from '@/server/services/purchase.service';
import { StockService }    from '@/server/services/stock.service';
import { ReportService }   from '@/server/services/report.service';
import { CategoryService, SupplierService, CustomerService } from '@/server/services/misc.service';
import { ok, created, requireAuth, requireRole, handle } from './base.controller';
import type { ReportType } from '@/types';

// ── Sale ──────────────────────────────────────────────────────────────────────

export const SaleController = {

  async list(req: NextRequest): Promise<NextResponse> {
    return handle(async () => {
      const auth = await requireAuth();
      if (auth instanceof NextResponse) return auth;
      const sp    = req.nextUrl.searchParams;
      const sales = await SaleService.getAll({
        search: sp.get('search') ?? '',
        status: sp.get('status') ?? '',
        from  : sp.get('from')   ?? '',
        to    : sp.get('to')     ?? '',
      });
      return ok({ sales });
    });
  },

  async getOne(req: NextRequest, id: string): Promise<NextResponse> {
    return handle(async () => {
      const auth = await requireAuth();
      if (auth instanceof NextResponse) return auth;
      return ok({ sale: await SaleService.getById(id) });
    });
  },

  async create(req: NextRequest): Promise<NextResponse> {
    return handle(async () => {
      const auth = await requireRole('admin', 'manager', 'kasir');
      if (auth instanceof NextResponse) return auth;
      return created({ sale: await SaleService.create(await req.json(), auth.id) });
    });
  },

  async update(req: NextRequest, id: string): Promise<NextResponse> {
    return handle(async () => {
      const auth = await requireRole('admin', 'manager', 'kasir');
      if (auth instanceof NextResponse) return auth;
      return ok({ sale: await SaleService.update(id, await req.json()) });
    });
  },

};

// ── Purchase ──────────────────────────────────────────────────────────────────

export const PurchaseController = {

  async list(req: NextRequest): Promise<NextResponse> {
    return handle(async () => {
      const auth = await requireAuth();
      if (auth instanceof NextResponse) return auth;
      const sp = req.nextUrl.searchParams;
      return ok({ purchases: await PurchaseService.getAll(sp.get('search') ?? '', sp.get('status') ?? '') });
    });
  },

  async create(req: NextRequest): Promise<NextResponse> {
    return handle(async () => {
      const auth = await requireRole('admin', 'manager', 'gudang');
      if (auth instanceof NextResponse) return auth;
      return created({ purchase: await PurchaseService.create(await req.json(), auth.id) });
    });
  },

};

// ── Stock ─────────────────────────────────────────────────────────────────────

export const StockController = {

  async list(req: NextRequest): Promise<NextResponse> {
    return handle(async () => {
      const auth = await requireAuth();
      if (auth instanceof NextResponse) return auth;
      const sp = req.nextUrl.searchParams;
      return ok({ movements: await StockService.getAll(sp.get('type') ?? '', sp.get('product_id') ?? '') });
    });
  },

  async create(req: NextRequest): Promise<NextResponse> {
    return handle(async () => {
      const auth = await requireRole('admin', 'manager', 'gudang');
      if (auth instanceof NextResponse) return auth;
      return created({ movement: await StockService.recordMovement(await req.json(), auth.id) });
    });
  },

};

// ── Report ────────────────────────────────────────────────────────────────────

export const ReportController = {

  async get(req: NextRequest): Promise<NextResponse> {
    return handle(async () => {
      const auth = await requireRole('admin', 'manager');
      if (auth instanceof NextResponse) return auth;
      const sp = req.nextUrl.searchParams;
      const data = await ReportService.getReport({
        type: (sp.get('type') ?? 'monthly') as ReportType,
        from: sp.get('from') ?? '',
        to  : sp.get('to')   ?? '',
      });
      return ok({ data });
    });
  },

};

// ── Category ──────────────────────────────────────────────────────────────────

export const CategoryController = {

  async list(): Promise<NextResponse> {
    return handle(async () => {
      const auth = await requireAuth();
      if (auth instanceof NextResponse) return auth;
      return ok({ categories: await CategoryService.getAll() });
    });
  },

  async create(req: NextRequest): Promise<NextResponse> {
    return handle(async () => {
      const auth = await requireRole('admin', 'manager');
      if (auth instanceof NextResponse) return auth;
      return created({ category: await CategoryService.create(await req.json()) });
    });
  },

  async update(req: NextRequest, id: string): Promise<NextResponse> {
    return handle(async () => {
      const auth = await requireRole('admin', 'manager');
      if (auth instanceof NextResponse) return auth;
      return ok({ category: await CategoryService.update(id, await req.json()) });
    });
  },

  async delete(_req: NextRequest, id: string): Promise<NextResponse> {
    return handle(async () => {
      const auth = await requireRole('admin', 'manager');
      if (auth instanceof NextResponse) return auth;
      await CategoryService.delete(id);
      return ok({ message: 'Kategori dihapus' });
    });
  },

};

// ── Supplier ──────────────────────────────────────────────────────────────────

export const SupplierController = {

  async list(req: NextRequest): Promise<NextResponse> {
    return handle(async () => {
      const auth = await requireAuth();
      if (auth instanceof NextResponse) return auth;
      return ok({ suppliers: await SupplierService.getAll(req.nextUrl.searchParams.get('search') ?? '') });
    });
  },

  async create(req: NextRequest): Promise<NextResponse> {
    return handle(async () => {
      const auth = await requireRole('admin', 'manager');
      if (auth instanceof NextResponse) return auth;
      return created({ supplier: await SupplierService.create(await req.json()) });
    });
  },

  async update(req: NextRequest, id: string): Promise<NextResponse> {
    return handle(async () => {
      const auth = await requireRole('admin', 'manager');
      if (auth instanceof NextResponse) return auth;
      return ok({ supplier: await SupplierService.update(id, await req.json()) });
    });
  },

  async delete(_req: NextRequest, id: string): Promise<NextResponse> {
    return handle(async () => {
      const auth = await requireRole('admin', 'manager');
      if (auth instanceof NextResponse) return auth;
      await SupplierService.delete(id);
      return ok({ message: 'Supplier dinonaktifkan' });
    });
  },

};

// ── Customer ──────────────────────────────────────────────────────────────────

export const CustomerController = {

  async list(req: NextRequest): Promise<NextResponse> {
    return handle(async () => {
      const auth = await requireAuth();
      if (auth instanceof NextResponse) return auth;
      const sp = req.nextUrl.searchParams;
      return ok({ customers: await CustomerService.getAll(sp.get('search') ?? '', sp.get('type') ?? '') });
    });
  },

  async create(req: NextRequest): Promise<NextResponse> {
    return handle(async () => {
      const auth = await requireRole('admin', 'manager', 'kasir');
      if (auth instanceof NextResponse) return auth;
      return created({ customer: await CustomerService.create(await req.json()) });
    });
  },

  async update(req: NextRequest, id: string): Promise<NextResponse> {
    return handle(async () => {
      const auth = await requireRole('admin', 'manager', 'kasir');
      if (auth instanceof NextResponse) return auth;
      return ok({ customer: await CustomerService.update(id, await req.json()) });
    });
  },

  async delete(_req: NextRequest, id: string): Promise<NextResponse> {
    return handle(async () => {
      const auth = await requireRole('admin', 'manager');
      if (auth instanceof NextResponse) return auth;
      await CustomerService.delete(id);
      return ok({ message: 'Pelanggan dinonaktifkan' });
    });
  },

};
