import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { TierCreateSchema } from '@/lib/validation';
import { requireAuth, requireEventEdit } from '@/lib/admin-auth';
import { NextRequest } from 'next/server';

type Params = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  try {
    await requireAuth(req); // Both admins and moderators can view tiers
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 401 });
  }

  const { id: eventId } = await params;
  const { data, error } = await supabaseAdmin
    .from('ticket_tiers')
    .select('*')
    .eq('event_id', eventId)
    .order('created_at', { ascending: true });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ tiers: data ?? [] });
}

export async function POST(req: NextRequest, { params }: Params) {
  try {
    await requireEventEdit(req); // Both admins and moderators can create tiers
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 403 });
  }

  try {
    const { id: eventId } = await params;
    const json = await req.json();
    const parsed = TierCreateSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }

    const payload = { ...parsed.data, event_id: eventId } as Record<string, unknown>;
    if (payload.sales_start instanceof Date) payload.sales_start = payload.sales_start.toISOString();
    if (payload.sales_end instanceof Date) payload.sales_end = payload.sales_end.toISOString();

    const { data, error } = await supabaseAdmin
      .from('ticket_tiers')
      .insert(payload)
      .select('*')
      .single();
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ tier: data }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}


