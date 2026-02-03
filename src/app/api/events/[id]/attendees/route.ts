import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getEventAccess, requireAuth } from '@/lib/admin-auth';
import { NextRequest } from 'next/server';

type Params = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  let admin;
  try {
    admin = await requireAuth(req); // All authenticated roles can view attendees (scoped for vendors)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 401 });
  }

  const { id } = await params;
  const eventAccess = await getEventAccess(admin, id);
  if (!eventAccess) {
    return NextResponse.json({ error: 'Unauthorized: Event access denied' }, { status: 403 });
  }

  // Fetch tickets for this event and join to orders for buyer data
  const { data: tickets, error } = await supabaseAdmin
    .from('tickets')
    .select(`
      id,
      attendee_name,
      status,
      scanned_at,
      order_id,
      orders:orders(id, user_id, email, whatsapp_number, status, created_at, requested_cab)
    `)
    .eq('event_id', id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const userIds = Array.from(new Set((tickets ?? []).map((t: any) => t.orders?.user_id).filter(Boolean)));
  let profileMap: Record<string, { full_name: string | null; email: string | null }> = {};
  if (userIds.length > 0) {
    const { data: profiles, error: pErr } = await supabaseAdmin
      .from('profiles')
      .select('id, full_name, email')
      .in('id', userIds as string[]);
    if (!pErr) {
      profileMap = Object.fromEntries((profiles ?? []).map((p: any) => [p.id, { full_name: p.full_name ?? null, email: p.email ?? null }]));
    }
  }

  const rows = (tickets ?? []).map((row: any) => {
    const prof = row.orders?.user_id ? profileMap[row.orders.user_id] : undefined;
    return {
      ticket_id: row.id,
      attendee_name: row.attendee_name,
      ticket_status: row.status,
      scanned_at: row.scanned_at ?? null,
      order_id: row.orders?.id ?? row.order_id,
      order_status: row.orders?.status ?? null,
      user_id: row.orders?.user_id ?? null,
      buyer_name: prof?.full_name ?? null,
      email: row.orders?.email ?? prof?.email ?? null,
      whatsapp_number: row.orders?.whatsapp_number ?? null,
      cab_requested: !!row.orders?.requested_cab,
      created_at: row.orders?.created_at ?? null,
    };
  });

  return NextResponse.json({ attendees: rows });
}
