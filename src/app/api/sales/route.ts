export const runtime = 'nodejs';
import { NextRequest } from 'next/server';
import { SaleController } from '@/server/controllers/all.controllers';
export const GET  = (req: NextRequest) => SaleController.list(req);
export const POST = (req: NextRequest) => SaleController.create(req);
