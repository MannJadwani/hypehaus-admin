import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { requireAuth, getVendorScopeId } from '@/lib/admin-auth';
import { NextRequest } from 'next/server';

export async function GET(req: NextRequest) {
  let admin;
  try {
    admin = await requireAuth(req);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 401 });
  }

  // Build query for orders with refunds requested
  let query = supabaseAdmin
    .from('orders')
    .select(`
      id,
      event_id,
      user_id,
      email,
      whatsapp_number,
      total_amount_cents,
      currency,
      instagram_handle,
      refund_reason,
      refund_requested_at,
      refund_processed,
      refund_processed_at,
      refund_notes,
      events:events(id, title, vendor_id)
    `)
    .eq('refund_requested', true)
    .order('refund_requested_at', { ascending: false });

  const { data: orders, error } = await query;

  if (error) {
    console.error('Failed to fetch refunds:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Scope to vendor's events if not admin/moderator
  const vendorScopeId = getVendorScopeId(admin);
  let filteredOrders = orders ?? [];
  if (vendorScopeId) {
    filteredOrders = filteredOrders.filter((order: any) => 
      order.events?.vendor_id === vendorScopeId
    );
  }

  // Get user profiles for buyer names
  const userIds = Array.from(new Set(filteredOrders.map((o: any) => o.user_id).filter(Boolean)));
  let profileMap: Record<string, string | null> = {};
  
  if (userIds.length > 0) {
    const { data: profiles } = await supabaseAdmin
      .from('profiles')
      .select('id, full_name')
      .in('id', userIds as string[]);
    
    if (profiles) {
      profileMap = Object.fromEntries(profiles.map((p: any) => [p.id, p.full_name]));
    }
  }

  // Transform data for response
  const transformedOrders = filteredOrders.map((order: any) => ({
    id: order.id,
    order_id: order.id,
    event_id: order.event_id,
    event_title: order.events?.title ?? 'Unknown Event',
    buyer_name: order.user_id ? profileMap[order.user_id] ?? null : null,
    email: order.email,
    whatsapp_number: order.whatsapp_number,
    total_amount_cents: order.total_amount_cents,
    currency: order.currency ?? 'INR',
    instagram_handle: order.instagram_handle,
    refund_reason: order.refund_reason,
    refund_requested_at: order.refund_requested_at,
    refund_processed: order.refund_processed ?? false,
    refund_processed_at: order.refund_processed_at,
    refund_notes: order.refund_notes,
  }));

  return NextResponse.json({ orders: transformedOrders });
}
