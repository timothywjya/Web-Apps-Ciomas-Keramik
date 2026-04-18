export const runtime = 'nodejs';
import { NextRequest } from 'next/server';
import { AuthController } from '@/server/controllers/auth.controller';
export const POST = (req: NextRequest) => AuthController.login(req);
