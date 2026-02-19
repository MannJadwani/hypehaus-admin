import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { EventCreateSchema } from '@/lib/validation';
import { getVendorScopeId, requireEventCreate, requireAuth } from '@/lib/admin-auth';
import { NextRequest } from 'next/server';

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

export async function GET(req: NextRequest) {
  let admin;
  try {
    admin = await requireAuth(req); // All authenticated roles can view events (scoped for vendors)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 401 });
  }

  // Fetch events
  let query = supabaseAdmin.from('events').select('*').order('created_at', { ascending: false });
  const vendorScopeId = getVendorScopeId(admin);
  if (admin.role === 'vendor' || admin.role === 'vendor_moderator') {
    if (!vendorScopeId) {
      return NextResponse.json({ events: [] });
    }
    query = query.eq('vendor_id', vendorScopeId);
  }

  const { data: events, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Fetch cab-request counts per event (orders with requested_cab=true)
  const eventIds = (events ?? []).map((e: any) => e.id);
  const { data: cabOrders } = eventIds.length
    ? await supabaseAdmin
        .from('orders')
        .select('event_id, requested_cab')
        .eq('requested_cab', true)
        .in('event_id', eventIds)
    : { data: [] as { event_id: string; requested_cab: boolean }[] };

  const map: Record<string, number> = {};
  for (const row of cabOrders ?? []) {
    if (!row.event_id) continue;
    map[row.event_id] = (map[row.event_id] ?? 0) + 1;
  }

  const withCounts = (events ?? []).map((e: any) => ({ ...e, cab_opt_in_count: map[e.id] ?? 0 }));
  return NextResponse.json({ events: withCounts });
}

export async function POST(req: NextRequest) {
  let admin;
  try {
    admin = await requireEventCreate(req); // Admins and vendors can create events
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
    const requestedEntryGates = normalizeEntryGates(payload.entry_gates);
    delete payload.entry_gates;

    if (admin.role === 'vendor') {
      payload.vendor_id = admin.id;
      payload.status = 'draft';
    }

    if (admin.role !== 'admin') {
      delete payload.allow_cab;
      delete payload.require_instagram_verification;
      delete payload.require_email_domain_verification;
      delete payload.allowed_email_domains;
      delete payload.enable_entry_gate_flow;
    } else {
      payload.allowed_email_domains = normalizeAllowedDomains(payload.allowed_email_domains);
      if (!payload.require_email_domain_verification) {
        payload.allowed_email_domains = [];
      } else if ((payload.allowed_email_domains as string[]).length === 0) {
        return NextResponse.json(
          { error: 'Add at least one allowed email domain when email-domain gate is enabled' },
          { status: 400 }
        );
      }
      payload.enable_entry_gate_flow = Boolean(payload.enable_entry_gate_flow);
      if (payload.enable_entry_gate_flow && requestedEntryGates.length === 0) {
        return NextResponse.json(
          { error: 'Add at least one gate when entry gate flow is enabled' },
          { status: 400 }
        );
      }
      if (
        payload.enable_entry_gate_flow &&
        requestedEntryGates.filter((gate) => gate.is_active !== false).length === 0
      ) {
        return NextResponse.json(
          { error: 'At least one gate must be active when entry gate flow is enabled' },
          { status: 400 }
        );
      }
    }

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

    if (admin.role === 'admin' && data.enable_entry_gate_flow) {
      const gateRows = requestedEntryGates.map((gate, index) => ({
        event_id: data.id,
        name: gate.name,
        code: gate.code ?? null,
        sort_order: gate.sort_order ?? index,
        is_active: gate.is_active !== false,
      }));
      if (gateRows.length > 0) {
        const { error: gateInsertError } = await supabaseAdmin
          .from('event_entry_gates')
          .insert(gateRows);
        if (gateInsertError) {
          return NextResponse.json(
            { error: gateInsertError.message, code: gateInsertError.code },
            { status: 500 }
          );
        }
      }
    }
    return NextResponse.json({ event: data }, { status: 201 });
  } catch (e) {
    console.error('Error creating event:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
