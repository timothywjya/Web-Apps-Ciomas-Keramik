export const runtime = 'nodejs';
import { NextRequest } from 'next/server';
import { ProductController } from '@/server/controllers/product.controller';
export const GET  = (req: NextRequest) => ProductController.list(req);
export const POST = (req: NextRequest) => ProductController.create(req);
