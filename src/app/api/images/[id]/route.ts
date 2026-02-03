import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { ImageUpdateSchema } from '@/lib/validation';
import { getEventAccess, requireEventEdit } from '@/lib/admin-auth';
import { NextRequest } from 'next/server';

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const admin = await requireEventEdit(req); // Admins, moderators, vendors (no vendor_moderator)
    const { id } = await params;
    const { data: image, error: imageError } = await supabaseAdmin
      .from('event_images')
      .select('id, event_id')
      .eq('id', id)
      .single();
    if (imageError || !image) {
      return NextResponse.json({ error: 'Image not found' }, { status: 404 });
    }
    const eventAccess = await getEventAccess(admin, image.event_id);
    if (!eventAccess) {
      return NextResponse.json({ error: 'Unauthorized: Event access denied' }, { status: 403 });
    }
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

export async function DELETE(req: NextRequest, { params }: Params) {
  try {
    const admin = await requireEventEdit(req); // Admins, moderators, vendors (no vendor_moderator)
    const { id } = await params;
    const { data: image, error: imageError } = await supabaseAdmin
      .from('event_images')
      .select('id, event_id')
      .eq('id', id)
      .single();
    if (imageError || !image) {
      return NextResponse.json({ error: 'Image not found' }, { status: 404 });
    }
    const eventAccess = await getEventAccess(admin, image.event_id);
    if (!eventAccess) {
      return NextResponse.json({ error: 'Unauthorized: Event access denied' }, { status: 403 });
    }

    const { error } = await supabaseAdmin.from('event_images').delete().eq('id', id);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}

