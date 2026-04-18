export const runtime = 'nodejs';
import { NextRequest } from 'next/server';
import { SupplierController } from '@/server/controllers/all.controllers';
export const PUT    = (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => params.then(p => SupplierController.update(req, p.id));
export const DELETE = (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => params.then(p => SupplierController.delete(req, p.id));
