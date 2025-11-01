import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { ImageUpdateSchema } from '@/lib/validation';

type Params = { params: { id: string } };

export async function PATCH(req: Request, context: Promise<Params>) {
  try {
    const { params } = await context;
    const { id } = params;
    const json = await req.json();
    const parsed = ImageUpdateSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }
    const payload = parsed.data as Record<string, unknown>;
    const { data, error } = await supabaseAdmin
      .from('event_images')
      .update(payload)
      .eq('id', id)
      .select('*')
      .single();
    if (error || !data) {
      return NextResponse.json({ error: error?.message ?? 'Update failed' }, { status: 500 });
    }
    return NextResponse.json({ image: data });
  } catch (e) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(_req: Request, context: Promise<Params>) {
  const { params } = await context;
  const { id } = params;
  const { error } = await supabaseAdmin.from('event_images').delete().eq('id', id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}


