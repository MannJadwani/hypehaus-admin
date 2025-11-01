import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { TierUpdateSchema } from '@/lib/validation';

type Params = { params: { id: string } };

export async function PATCH(req: Request, context: Promise<Params>) {
  try {
    const { params } = await context;
    const { id } = params;
    const json = await req.json();
    const parsed = TierUpdateSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }
    const payload = parsed.data as Record<string, unknown>;
    if (payload.sales_start instanceof Date) payload.sales_start = payload.sales_start.toISOString();
    if (payload.sales_end instanceof Date) payload.sales_end = payload.sales_end.toISOString();

    const { data, error } = await supabaseAdmin
      .from('ticket_tiers')
      .update(payload)
      .eq('id', id)
      .select('*')
      .single();
    if (error || !data) {
      return NextResponse.json({ error: error?.message ?? 'Update failed' }, { status: 500 });
    }
    return NextResponse.json({ tier: data });
  } catch (e) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(_req: Request, context: Promise<Params>) {
  const { params } = await context;
  const { id } = params;
  const { error } = await supabaseAdmin.from('ticket_tiers').delete().eq('id', id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}


