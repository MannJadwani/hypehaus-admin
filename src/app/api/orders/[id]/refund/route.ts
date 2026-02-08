import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { requireAuth, getEventAccess } from '@/lib/admin-auth';
import { NextRequest } from 'next/server';
import { z } from 'zod';

type Params = { params: Promise<{ id: string }> };

const UpdateRefundSchema = z.object({
  processed: z.boolean(),
  notes: z.string().optional(),
});

export async function PATCH(req: NextRequest, { params }: Params) {
  let admin;
  try {
    admin = await requireAuth(req);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 401 });
  }

  const { id: orderId } = await params;

  // Parse and validate request body
  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = UpdateRefundSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request', details: parsed.error.issues }, { status: 400 });
  }

  const { processed, notes } = parsed.data;

  // Fetch the order to get event_id for access check
  const { data: order, error: orderError } = await supabaseAdmin
    .from('orders')
    .select('id, event_id, refund_requested')
    .eq('id', orderId)
    .single();

  if (orderError || !order) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 });
  }

  // Check if admin has access to this event
  const eventAccess = await getEventAccess(admin, order.event_id);
  if (!eventAccess) {
    return NextResponse.json({ error: 'Unauthorized: Event access denied' }, { status: 403 });
  }

  // Ensure order has refund requested
  if (!order.refund_requested) {
    return NextResponse.json({ error: 'No refund was requested for this order' }, { status: 400 });
  }

  // Prepare update data
  const updateData: Record<string, unknown> = {
    refund_processed: processed,
  };

  if (processed) {
    updateData.refund_processed_at = new Date().toISOString();
    updateData.refund_processed_by = admin.id;
  }

  if (notes !== undefined) {
    updateData.refund_notes = notes;
  }

  // Update the order
  const { data: updatedOrder, error: updateError } = await supabaseAdmin
    .from('orders')
    .update(updateData)
    .eq('id', orderId)
    .select('id, refund_processed, refund_processed_at, refund_notes')
    .single();

  if (updateError) {
    console.error('Failed to update order refund status:', updateError);
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    order: updatedOrder,
    message: processed ? 'Refund marked as processed' : 'Refund status updated',
  });
}
