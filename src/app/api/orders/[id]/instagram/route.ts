import { NextRequest, NextResponse } from 'next/server';
import { getEventAccess, requireAuth } from '@/lib/admin-auth';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

type Params = { params: Promise<{ id: string }> };
type InstagramStatus = 'pending' | 'approved' | 'rejected' | 'not_required';

const ALLOWED_STATUSES: InstagramStatus[] = ['pending', 'approved', 'rejected', 'not_required'];

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const admin = await requireAuth(req);
    const { id } = await params;
    const body = await req.json();
    const status = String(body?.status ?? '') as InstagramStatus;

    if (!ALLOWED_STATUSES.includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
    }

    const { data: order, error: orderError } = await supabaseAdmin
      .from('orders')
      .select('id, event_id, instagram_handle')
      .eq('id', id)
      .single();

    if (orderError || !order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    const eventAccess = await getEventAccess(admin, order.event_id);
    if (!eventAccess) {
      return NextResponse.json({ error: 'Unauthorized: Event access denied' }, { status: 403 });
    }

    if (status === 'approved' && !order.instagram_handle) {
      return NextResponse.json({ error: 'Cannot approve without an Instagram handle' }, { status: 400 });
    }

    const shouldStamp = status === 'approved' || status === 'rejected';
    const { data: updated, error: updateError } = await supabaseAdmin
      .from('orders')
      .update({
        instagram_verification_status: status,
        instagram_verified_at: shouldStamp ? new Date().toISOString() : null,
        instagram_verified_by: shouldStamp ? admin.id : null,
      })
      .eq('id', id)
      .select('id, instagram_verification_status, instagram_verified_at, instagram_verified_by')
      .single();

    if (updateError || !updated) {
      return NextResponse.json({ error: updateError?.message ?? 'Failed to update status' }, { status: 500 });
    }

    return NextResponse.json({ order: updated });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
