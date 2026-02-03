import { NextResponse } from 'next/server';
import { NextRequest } from 'next/server';
import { getCurrentAdmin } from '@/lib/admin-auth';

export async function GET(req: NextRequest) {
  const admin = await getCurrentAdmin(req);
  if (!admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return NextResponse.json({ admin: { id: admin.id, email: admin.email, role: admin.role, vendor_id: admin.vendor_id } });
}
