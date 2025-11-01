import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { ImageCreateSchema } from '@/lib/validation';

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  const { id: eventId } = await params;
  const { data, error } = await supabaseAdmin
    .from('event_images')
    .select('*')
    .eq('event_id', eventId)
    .order('position', { ascending: true });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ images: data ?? [] });
}

export async function POST(req: Request, { params }: Params) {
  try {
    const { id: eventId } = await params;
    const json = await req.json();
    const parsed = ImageCreateSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }

    const payload = { ...parsed.data, event_id: eventId } as Record<string, unknown>;
    const { data, error } = await supabaseAdmin
      .from('event_images')
      .insert(payload)
      .select('*')
      .single();
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ image: data }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}


