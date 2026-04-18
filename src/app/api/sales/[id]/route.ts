export const runtime = 'nodejs';
import { NextRequest } from 'next/server';
import { SaleController } from '@/server/controllers/all.controllers';
export const GET = (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => params.then(p => SaleController.getOne(req, p.id));
export const PUT = (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => params.then(p => SaleController.update(req, p.id));
