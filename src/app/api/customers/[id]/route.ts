export const runtime = 'nodejs';
import { NextRequest } from 'next/server';
import { CustomerController } from '@/server/controllers/all.controllers';
export const PUT    = (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => params.then(p => CustomerController.update(req, p.id));
export const DELETE = (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => params.then(p => CustomerController.delete(req, p.id));
