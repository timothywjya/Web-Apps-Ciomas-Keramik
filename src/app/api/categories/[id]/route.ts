export const runtime = 'nodejs';
import { NextRequest } from 'next/server';
import { CategoryController } from '@/server/controllers/all.controllers';
export const PUT    = (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => params.then(p => CategoryController.update(req, p.id));
export const DELETE = (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => params.then(p => CategoryController.delete(req, p.id));
