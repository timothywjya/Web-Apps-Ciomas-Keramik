export const runtime = 'nodejs';
import { NextRequest } from 'next/server';
import { UserController } from '@/server/controllers/user.controller';
export const GET  = (req: NextRequest) => UserController.list(req);
export const POST = (req: NextRequest) => UserController.create(req);
