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

type GateInput = {
  id?: string;
  name: string;
  code?: string;
  sort_order?: number;
  is_active?: boolean;
};

const normalizeEntryGates = (gates: unknown): GateInput[] => {
  if (!Array.isArray(gates)) return [];
  return gates
    .map((gate, index) => {
      const row = (gate ?? {}) as Record<string, unknown>;
      const name = String(row.name ?? '').trim();
      if (!name) return null;
      const code = String(row.code ?? '')
        .trim()
        .toUpperCase()
        .replace(/[^A-Z0-9_-]/g, '')
        .slice(0, 24);
      return {
        id: typeof row.id === 'string' ? row.id : undefined,
        name: name.slice(0, 64),
        code: code || undefined,
        sort_order: Number.isFinite(Number(row.sort_order)) ? Number(row.sort_order) : index,
        is_active: row.is_active === undefined ? true : Boolean(row.is_active),
      } as GateInput;
    })
    .filter((gate): gate is GateInput => !!gate);
};

async function syncEventGates(eventId: string, incomingGates: GateInput[]) {
  const normalized = incomingGates.map((gate, index) => ({
    id: gate.id,
    event_id: eventId,
    name: gate.name,
    code: gate.code ?? null,
    sort_order: gate.sort_order ?? index,
    is_active: gate.is_active !== false,
  }));

  const { data: existingGates, error: existingGatesError } = await supabaseAdmin
    .from('event_entry_gates')
    .select('id')
    .eq('event_id', eventId);

  if (existingGatesError) {
    throw new Error(existingGatesError.message);
  }

  const existingIds = new Set((existingGates ?? []).map((gate) => gate.id));
  const keepIds = new Set(normalized.filter((gate) => gate.id).map((gate) => gate.id as string));

  const toDelete = [...existingIds].filter((id) => !keepIds.has(id));
  if (toDelete.length > 0) {
    const { error: deleteError } = await supabaseAdmin
      .from('event_entry_gates')
      .delete()
      .in('id', toDelete);
    if (deleteError) {
      throw new Error(deleteError.message);
    }
  }

  for (const gate of normalized) {
    if (gate.id && existingIds.has(gate.id)) {
      const { error: updateError } = await supabaseAdmin
        .from('event_entry_gates')
        .update({
          name: gate.name,
          code: gate.code,
          sort_order: gate.sort_order,
          is_active: gate.is_active,
          updated_at: new Date().toISOString(),
        })
        .eq('id', gate.id);
      if (updateError) {
        throw new Error(updateError.message);
      }
      continue;
    }

    const { error: insertError } = await supabaseAdmin
      .from('event_entry_gates')
      .insert({
        event_id: eventId,
        name: gate.name,
        code: gate.code,
        sort_order: gate.sort_order,
        is_active: gate.is_active,
      });
    if (insertError) {
      throw new Error(insertError.message);
    }
  }
}

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

  const { data: entryGates } = await supabaseAdmin
    .from('event_entry_gates')
    .select('*')
    .eq('event_id', id)
    .order('sort_order', { ascending: true });

  return NextResponse.json({ event, tiers: tiers ?? [], images: images ?? [], entry_gates: entryGates ?? [] });
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
      .select('require_email_domain_verification, allowed_email_domains, enable_entry_gate_flow')
      .eq('id', id)
      .single();
    const json = await req.json();
    const parsed = EventUpdateSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }
    const payload = parsed.data as Record<string, unknown>;
    const requestedEntryGates = normalizeEntryGates(payload.entry_gates);
    delete payload.entry_gates;
    if (payload.start_at instanceof Date) payload.start_at = payload.start_at.toISOString();
    if (payload.end_at instanceof Date) payload.end_at = (payload.end_at as Date).toISOString();

    if (admin.role !== 'admin') {
      delete payload.vendor_id;
      delete payload.allow_cab;
      delete payload.require_instagram_verification;
      delete payload.require_email_domain_verification;
      delete payload.allowed_email_domains;
      delete payload.enable_entry_gate_flow;
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

      const resolvedEnableEntryGateFlow =
        'enable_entry_gate_flow' in payload
          ? Boolean(payload.enable_entry_gate_flow)
          : Boolean(currentEvent?.enable_entry_gate_flow);
      if (resolvedEnableEntryGateFlow) {
        if (
          ('entry_gates' in (json as Record<string, unknown>) && requestedEntryGates.length === 0) ||
          (!('entry_gates' in (json as Record<string, unknown>)) && requestedEntryGates.length === 0)
        ) {
          const { data: existingGates } = await supabaseAdmin
            .from('event_entry_gates')
            .select('id, is_active')
            .eq('event_id', id);
          const activeCount = ('entry_gates' in (json as Record<string, unknown>))
            ? requestedEntryGates.filter((gate) => gate.is_active !== false).length
            : (existingGates ?? []).filter((gate) => gate.is_active).length;
          if (activeCount === 0) {
            return NextResponse.json(
              { error: 'Add at least one active gate when entry gate flow is enabled' },
              { status: 400 }
            );
          }
        } else if (requestedEntryGates.filter((gate) => gate.is_active !== false).length === 0) {
          return NextResponse.json(
            { error: 'At least one gate must be active when entry gate flow is enabled' },
            { status: 400 }
          );
        }
      } else {
        payload.enable_entry_gate_flow = false;
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

    if (admin.role === 'admin') {
      if ('entry_gates' in (json as Record<string, unknown>)) {
        await syncEventGates(id, requestedEntryGates);
      }

      if (data.enable_entry_gate_flow === false) {
        const { error: disableError } = await supabaseAdmin
          .from('event_entry_gates')
          .update({ is_active: false, updated_at: new Date().toISOString() })
          .eq('event_id', id);
        if (disableError) {
          return NextResponse.json({ error: disableError.message }, { status: 500 });
        }
      }
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
