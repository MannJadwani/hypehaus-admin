import { NextResponse } from 'next/server';
import { NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getVendorScopeId, requireAuth } from '@/lib/admin-auth';
import { AdUpdateSchema } from '@/lib/validation';

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
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

  const { id } = await params;

  const { data: current, error: currentErr } = await supabaseAdmin
    .from('ads')
    .select('*')
    .eq('id', id)
    .single();

  if (currentErr || !current) {
    return NextResponse.json({ error: 'Ad not found' }, { status: 404 });
  }

  const vendorScopeId = getVendorScopeId(admin);
  if (admin.role === 'vendor') {
    if (!vendorScopeId || current.vendor_id !== vendorScopeId) {
      return NextResponse.json({ error: 'Unauthorized: Ad access denied' }, { status: 403 });
    }
    if (current.status !== 'pending') {
      return NextResponse.json({ error: 'Only pending ads can be edited by vendors' }, { status: 403 });
    }
  }

  try {
    const json = await req.json();
    const parsed = AdUpdateSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid payload', details: parsed.error.issues }, { status: 400 });
    }

    const updates = parsed.data as Record<string, unknown>;

    // Vendors cannot change workflow state or ownership.
    if (admin.role === 'vendor') {
      delete updates.status;
      delete updates.vendor_id;
      delete updates.created_by;
    }

    // Normalize date fields to ISO strings if Date objects were passed
    if (updates.start_at instanceof Date) updates.start_at = updates.start_at.toISOString();
    if (updates.end_at instanceof Date) updates.end_at = (updates.end_at as Date).toISOString();

    const { data, error } = await supabaseAdmin.from('ads').update(updates).eq('id', id).select('*').single();
    if (error) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: 500 });
    }
    return NextResponse.json({ ad: data });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: Params) {
  let admin;
  try {
    admin = await requireAuth(req);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unauthorized';
    return NextResponse.json({ error: message }, { status: 401 });
  }

  if (admin.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized: Admin role required' }, { status: 403 });
  }

  const { id } = await params;
  const { error } = await supabaseAdmin.from('ads').delete().eq('id', id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}
