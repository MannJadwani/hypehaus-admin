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

  // Build query for orders with Instagram verification required
  let query = supabaseAdmin
    .from('orders')
    .select(`
      id,
      event_id,
      user_id,
      instagram_handle,
      instagram_verification_status,
      email,
      whatsapp_number,
      total_amount_cents,
      currency,
      attendee_names,
      created_at,
      events:events(id, title, vendor_id)
    `)
    .not('instagram_handle', 'is', null)
    .neq('instagram_handle', '')
    .eq('status', 'paid')
    .order('created_at', { ascending: false });

  // Scope to vendor's events if not admin/moderator
  const vendorScopeId = getVendorScopeId(admin);
  
  const { data: orders, error } = await query;

  if (error) {
    console.error('Failed to fetch Instagram reviews:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Filter by vendor scope if applicable
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
    instagram_handle: order.instagram_handle,
    instagram_verification_status: order.instagram_verification_status ?? 'pending',
    buyer_name: order.user_id ? profileMap[order.user_id] ?? null : null,
    email: order.email,
    whatsapp_number: order.whatsapp_number,
    total_amount_cents: order.total_amount_cents,
    currency: order.currency ?? 'INR',
    attendee_names: order.attendee_names ?? [],
    created_at: order.created_at,
  }));

  return NextResponse.json({ orders: transformedOrders });
}
