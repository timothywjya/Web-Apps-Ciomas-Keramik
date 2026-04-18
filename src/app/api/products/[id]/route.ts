export const runtime = 'nodejs';
import { NextRequest } from 'next/server';
import { ProductController } from '@/server/controllers/product.controller';
export const GET    = (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => params.then(p => ProductController.getOne(req, p.id));
export const PUT    = (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => params.then(p => ProductController.update(req, p.id));
export const DELETE = (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => params.then(p => ProductController.delete(req, p.id));
