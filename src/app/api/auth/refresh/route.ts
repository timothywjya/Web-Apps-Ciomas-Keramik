export const runtime = 'nodejs';
import { AuthController } from '@/server/controllers/auth.controller';
export const POST = () => AuthController.refresh();
