import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { EventUpdateSchema } from '@/lib/validation';
import { getEventAccess, requireAuth, requireEventDelete, requireEventEdit } from '@/lib/admin-auth';
import { NextRequest } from 'next/server';

type Params = { params: Promise<{ id: string }> };

const normalizeAllowedDomains = (domains: unknown): string[] => {
  if (!Array.isArray(domains)) return [];
  return Array.from(
    new Set(
      domains
        .map((domain) => String(domain).trim().toLowerCase().replace(/^@/, ''))
        .filter(Boolean)
    )
  );
};

export async function GET(req: NextRequest, { params }: Params) {
  let admin;
  try {
    admin = await requireAuth(req); // All authenticated roles can view events (scoped for vendors)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 401 });
  }

  const { id } = await params;
  const eventAccess = await getEventAccess(admin, id);
  if (!eventAccess) {
    return NextResponse.json({ error: 'Unauthorized: Event access denied' }, { status: 403 });
  }
  const { data: event, error } = await supabaseAdmin.from('events').select('*').eq('id', id).single();
  if (error || !event) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const { data: tiers } = await supabaseAdmin
    .from('ticket_tiers')
    .select('*')
    .eq('event_id', id)
    .order('created_at', { ascending: true });

  const { data: images } = await supabaseAdmin
    .from('event_images')
    .select('*')
    .eq('event_id', id)
    .order('position', { ascending: true });

  return NextResponse.json({ event, tiers: tiers ?? [], images: images ?? [] });
}

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const admin = await requireEventEdit(req); // Admins, moderators, vendors (no vendor_moderator)
    const { id } = await params;
    const eventAccess = await getEventAccess(admin, id);
    if (!eventAccess) {
      return NextResponse.json({ error: 'Unauthorized: Event access denied' }, { status: 403 });
    }
    const { data: currentEvent } = await supabaseAdmin
      .from('events')
      .select('require_email_domain_verification, allowed_email_domains')
      .eq('id', id)
      .single();
    const json = await req.json();
    const parsed = EventUpdateSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }
    const payload = parsed.data as Record<string, unknown>;
    if (payload.start_at instanceof Date) payload.start_at = payload.start_at.toISOString();
    if (payload.end_at instanceof Date) payload.end_at = (payload.end_at as Date).toISOString();

    if (admin.role !== 'admin') {
      delete payload.vendor_id;
      delete payload.allow_cab;
      delete payload.require_instagram_verification;
      delete payload.require_email_domain_verification;
      delete payload.allowed_email_domains;
    } else if ('vendor_id' in payload) {
      const nextVendorId = payload.vendor_id ?? null;
      if (eventAccess.vendor_id && eventAccess.vendor_id !== nextVendorId) {
        return NextResponse.json({ error: 'Vendor reassignment is not allowed' }, { status: 400 });
      }
    }

    if (admin.role === 'admin') {
      if ('allowed_email_domains' in payload) {
        payload.allowed_email_domains = normalizeAllowedDomains(payload.allowed_email_domains);
      }
      if ('require_email_domain_verification' in payload && !payload.require_email_domain_verification) {
        payload.allowed_email_domains = [];
      }
      const resolvedRequireEmailDomain =
        'require_email_domain_verification' in payload
          ? Boolean(payload.require_email_domain_verification)
          : Boolean(currentEvent?.require_email_domain_verification);
      const resolvedAllowedDomains =
        'allowed_email_domains' in payload
          ? ((payload.allowed_email_domains as string[]) ?? [])
          : ((currentEvent?.allowed_email_domains as string[] | null) ?? []);
      if (resolvedRequireEmailDomain && resolvedAllowedDomains.length === 0) {
        return NextResponse.json(
          { error: 'Add at least one allowed email domain when email-domain gate is enabled' },
          { status: 400 }
        );
      }
    }

    if (admin.role === 'vendor') {
      if (payload.status && payload.status !== 'draft') {
        return NextResponse.json({ error: 'Vendors cannot publish events' }, { status: 403 });
      }
    }

    const { data, error } = await supabaseAdmin
      .from('events')
      .update(payload)
      .eq('id', id)
      .select('*')
      .single();
    if (error || !data) {
      return NextResponse.json({ error: error?.message ?? 'Update failed' }, { status: 500 });
    }
    return NextResponse.json({ event: data });
  } catch (e) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: Params) {
  try {
    await requireEventDelete(req); // Only admins can delete events
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 403 });
  }

  const { id } = await params;
  const { error } = await supabaseAdmin.from('events').delete().eq('id', id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}
