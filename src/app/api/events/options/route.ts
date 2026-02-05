import { NextResponse } from 'next/server';
import { NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getVendorScopeId, requireAuth } from '@/lib/admin-auth';

export async function GET(req: NextRequest) {
  let admin;
  try {
    admin = await requireAuth(req);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unauthorized';
    return NextResponse.json({ error: message }, { status: 401 });
  }

  let query = supabaseAdmin
    .from('events')
    .select('id, title, start_at, status')
    .order('created_at', { ascending: false });

  const vendorScopeId = getVendorScopeId(admin);
  if (admin.role === 'vendor' || admin.role === 'vendor_moderator') {
    if (!vendorScopeId) {
      return NextResponse.json({ events: [] });
    }
    query = query.eq('vendor_id', vendorScopeId);
  }

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ events: data || [] });
}

