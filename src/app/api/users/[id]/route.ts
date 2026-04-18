export const runtime = 'nodejs';
import { NextRequest } from 'next/server';
import { UserController } from '@/server/controllers/user.controller';
export const PUT = (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => params.then(p => UserController.update(req, p.id));
