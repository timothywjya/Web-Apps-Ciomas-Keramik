export const runtime = 'nodejs';
import { NextRequest } from 'next/server';
import { PurchaseController } from '@/server/controllers/all.controllers';
export const GET  = (req: NextRequest) => PurchaseController.list(req);
export const POST = (req: NextRequest) => PurchaseController.create(req);
