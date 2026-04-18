export const runtime = 'nodejs';
import { NextRequest } from 'next/server';
import { CategoryController } from '@/server/controllers/all.controllers';
export const GET  = () => CategoryController.list();
export const POST = (req: NextRequest) => CategoryController.create(req);
