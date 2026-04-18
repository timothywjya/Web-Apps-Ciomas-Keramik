export const runtime = 'nodejs';
import { NextRequest } from 'next/server';
import { CustomerController } from '@/server/controllers/all.controllers';
export const GET  = (req: NextRequest) => CustomerController.list(req);
export const POST = (req: NextRequest) => CustomerController.create(req);
