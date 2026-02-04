import { NextResponse } from 'next/server';
import { NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getVendorScopeId, requireAuth } from '@/lib/admin-auth';
import { AdCreateSchema } from '@/lib/validation';

export async function GET(req: NextRequest) {
  let admin;
  try {
    admin = await requireAuth(req);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unauthorized';
    return NextResponse.json({ error: message }, { status: 401 });
  }

  if (admin.role === 'vendor_moderator') {
    return NextResponse.json({ error: 'Unauthorized: Insufficient permissions' }, { status: 403 });
  }

  let query = supabaseAdmin.from('ads').select('*').order('created_at', { ascending: false });
  const vendorScopeId = getVendorScopeId(admin);
  if (admin.role === 'vendor') {
    query = query.eq('vendor_id', vendorScopeId);
  }

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ads: data || [] });
}

export async function POST(req: NextRequest) {
  let admin;
  try {
    admin = await requireAuth(req);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unauthorized';
    return NextResponse.json({ error: message }, { status: 401 });
  }

  if (admin.role !== 'admin' && admin.role !== 'vendor') {
    return NextResponse.json({ error: 'Unauthorized: Only admins and vendors can create ads' }, { status: 403 });
  }

  try {
    const json = await req.json();
    const parsed = AdCreateSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid payload', details: parsed.error.issues }, { status: 400 });
    }

    const payload = parsed.data as Record<string, unknown>;
    payload.created_by = admin.id;

    if (admin.role === 'vendor') {
      payload.vendor_id = admin.id;
      payload.status = 'pending';
    }

    // Normalize date fields to ISO strings if Date objects were passed
    if (payload.start_at instanceof Date) payload.start_at = payload.start_at.toISOString();
    if (payload.end_at instanceof Date) payload.end_at = (payload.end_at as Date).toISOString();

    const { data, error } = await supabaseAdmin.from('ads').insert(payload).select('*').single();
    if (error) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: 500 });
    }

    return NextResponse.json({ ad: data }, { status: 201 });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
