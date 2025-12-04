import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { EventCreateSchema } from '@/lib/validation';
import { requireEventCreate, requireAuth } from '@/lib/admin-auth';
import { NextRequest } from 'next/server';

export async function GET(req: NextRequest) {
  try {
    await requireAuth(req); // Both admins and moderators can view events
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 401 });
  }

  // Fetch events
  const { data: events, error } = await supabaseAdmin
    .from('events')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Fetch cab-request counts per event (orders with requested_cab=true)
  const { data: cabOrders } = await supabaseAdmin
    .from('orders')
    .select('event_id, requested_cab')
    .eq('requested_cab', true);

  const map: Record<string, number> = {};
  for (const row of cabOrders ?? []) {
    if (!row.event_id) continue;
    map[row.event_id] = (map[row.event_id] ?? 0) + 1;
  }

  const withCounts = (events ?? []).map((e: any) => ({ ...e, cab_opt_in_count: map[e.id] ?? 0 }));
  return NextResponse.json({ events: withCounts });
}

export async function POST(req: NextRequest) {
  try {
    await requireEventCreate(req); // Only admins can create events
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 403 });
  }

  try {
    const json = await req.json();
    const parsed = EventCreateSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ 
        error: 'Invalid payload', 
        details: parsed.error.issues 
      }, { status: 400 });
    }

    const payload = parsed.data as Record<string, unknown>;

    // Normalize date fields to ISO strings if Date objects were passed
    if (payload.start_at instanceof Date) payload.start_at = payload.start_at.toISOString();
    if (payload.end_at instanceof Date) payload.end_at = (payload.end_at as Date).toISOString();

    // Remove null/undefined base_price_cents to avoid sending it if not needed
    if (payload.base_price_cents === null || payload.base_price_cents === undefined) {
      delete payload.base_price_cents;
    }

    const { data, error } = await supabaseAdmin.from('events').insert(payload).select('*').single();
    if (error) {
      console.error('Database error creating event:', error);
      return NextResponse.json({ 
        error: error.message,
        code: error.code 
      }, { status: 500 });
    }
    return NextResponse.json({ event: data }, { status: 201 });
  } catch (e) {
    console.error('Error creating event:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}


