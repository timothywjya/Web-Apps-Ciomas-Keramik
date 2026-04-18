export const runtime = 'nodejs';
import { NextRequest } from 'next/server';
import { SupplierController } from '@/server/controllers/all.controllers';
export const GET  = (req: NextRequest) => SupplierController.list(req);
export const POST = (req: NextRequest) => SupplierController.create(req);
