export const runtime = 'nodejs';
import { NextRequest } from 'next/server';
import { StockController } from '@/server/controllers/all.controllers';
export const GET  = (req: NextRequest) => StockController.list(req);
export const POST = (req: NextRequest) => StockController.create(req);
