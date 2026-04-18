export const runtime = 'nodejs';
import { NextRequest } from 'next/server';
import { ReportController } from '@/server/controllers/all.controllers';
export const GET = (req: NextRequest) => ReportController.get(req);
