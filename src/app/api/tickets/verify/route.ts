import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getEventAccess, requireAuth } from '@/lib/admin-auth';
import { NextRequest } from 'next/server';

interface QRCodeData {
  order_id: string;
  ticket_index: number;
  event_id: string;
  tier_id: string;
  attendee_name: string;
  timestamp: number;
}

type VerifyRequestBody = {
  qrData: string;
  eventId?: string;
  gateId?: string;
};

type GateScanItem = {
  gateId: string;
  gateName: string;
  scannedAt: string;
  scannedBy: string | null;
};

type GateScanProgress = {
  completedCount: number;
  totalCount: number;
  completedGateIds: string[];
};

async function getEventGates(eventId: string) {
  const { data, error } = await supabaseAdmin
    .from('event_entry_gates')
    .select('id, name, sort_order, is_active')
    .eq('event_id', eventId)
    .order('sort_order', { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return data ?? [];
}

async function getTicketGateScans(ticketId: string): Promise<GateScanItem[]> {
  const { data: scans, error } = await supabaseAdmin
    .from('ticket_gate_scans')
    .select('gate_id, scanned_at, scanned_by_admin_id')
    .eq('ticket_id', ticketId)
    .order('scanned_at', { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  if (!scans || scans.length === 0) {
    return [];
  }

  const gateIds = [...new Set(scans.map((scan) => scan.gate_id).filter(Boolean))];
  const adminIds = [...new Set(scans.map((scan) => scan.scanned_by_admin_id).filter(Boolean))];

  const { data: gates } = gateIds.length
    ? await supabaseAdmin.from('event_entry_gates').select('id, name').in('id', gateIds)
    : { data: [] as { id: string; name: string }[] };

  const { data: admins } = adminIds.length
    ? await supabaseAdmin.from('admin_users').select('id, email').in('id', adminIds)
    : { data: [] as { id: string; email: string }[] };

  const gateMap = new Map((gates ?? []).map((gate) => [gate.id, gate.name]));
  const adminMap = new Map((admins ?? []).map((item) => [item.id, item.email]));

  return scans.map((scan) => ({
    gateId: scan.gate_id,
    gateName: gateMap.get(scan.gate_id) ?? 'Gate',
    scannedAt: scan.scanned_at,
    scannedBy: scan.scanned_by_admin_id ? adminMap.get(scan.scanned_by_admin_id) ?? null : null,
  }));
}

function buildGateProgress(activeGates: { id: string }[], gateScans: GateScanItem[]): GateScanProgress {
  const completedSet = new Set(gateScans.map((scan) => scan.gateId));
  const activeGateIds = activeGates.map((gate) => gate.id);
  const completedGateIds = activeGateIds.filter((gateId) => completedSet.has(gateId));

  return {
    completedCount: completedGateIds.length,
    totalCount: activeGateIds.length,
    completedGateIds,
  };
}

export async function POST(req: NextRequest) {
  let admin;
  try {
    admin = await requireAuth(req);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 401 });
  }

  try {
    const { qrData, eventId, gateId } = (await req.json()) as VerifyRequestBody;

    if (!qrData || typeof qrData !== 'string') {
      return NextResponse.json(
        { error: 'Invalid QR code data', message: 'QR code data is required' },
        { status: 400 },
      );
    }

    let qrCodeData: QRCodeData;
    try {
      qrCodeData = JSON.parse(qrData);
    } catch {
      return NextResponse.json(
        { error: 'Invalid QR code format', message: 'QR code is not valid JSON' },
        { status: 400 },
      );
    }

    if (!qrCodeData.order_id || qrCodeData.ticket_index === undefined || !qrCodeData.event_id) {
      return NextResponse.json(
        { error: 'Invalid QR code structure', message: 'Missing required fields in QR code' },
        { status: 400 },
      );
    }

    let ticketQuery = supabaseAdmin.from('tickets').select('*').eq('qr_code_data', qrData).single();
    let { data: ticket, error: ticketError } = await ticketQuery;

    if (ticketError || !ticket) {
      const { data: tickets, error: ticketsError } = await supabaseAdmin
        .from('tickets')
        .select('*')
        .eq('order_id', qrCodeData.order_id)
        .order('created_at', { ascending: true });

      if (ticketsError || !tickets || tickets.length === 0) {
        return NextResponse.json(
          { error: 'Ticket not found', message: 'No ticket found matching this QR code' },
          { status: 404 },
        );
      }

      ticket = tickets[qrCodeData.ticket_index] || tickets[0];
    }

    if (!ticket) {
      return NextResponse.json(
        { error: 'Ticket not found', message: 'No ticket found matching this QR code' },
        { status: 404 },
      );
    }

    if (eventId && ticket.event_id !== eventId) {
      return NextResponse.json(
        { error: 'Wrong event selected', message: 'Ticket does not belong to selected event.' },
        { status: 400 },
      );
    }

    const eventAccess = await getEventAccess(admin, ticket.event_id);
    if (!eventAccess) {
      return NextResponse.json({ error: 'Unauthorized: Event access denied' }, { status: 403 });
    }

    const { data: order, error: orderError } = await supabaseAdmin
      .from('orders')
      .select('*')
      .eq('id', ticket.order_id)
      .single();

    if (orderError || !order) {
      return NextResponse.json(
        { error: 'Order not found', message: 'Associated order not found' },
        { status: 404 },
      );
    }

    const { data: eventConfig, error: eventConfigError } = await supabaseAdmin
      .from('events')
      .select('enable_entry_gate_flow, require_instagram_verification, require_email_domain_verification')
      .eq('id', ticket.event_id)
      .single();

    if (eventConfigError || !eventConfig) {
      return NextResponse.json(
        { error: 'Event not found', message: 'Unable to load event gate configuration' },
        { status: 404 },
      );
    }

    if (eventConfig.require_instagram_verification && order.instagram_verification_status !== 'approved') {
      const fullData = await fetchFullTicketData(ticket.id);
      return NextResponse.json(
        {
          error: 'Instagram verification required',
          message: 'This order has not been approved for Instagram verification yet',
          ...fullData,
        },
        { status: 400 },
      );
    }

    if (eventConfig.require_email_domain_verification && order.email_domain_status !== 'approved') {
      const fullData = await fetchFullTicketData(ticket.id);
      return NextResponse.json(
        {
          error: 'Email domain verification failed',
          message: 'This order email is not approved for this event',
          ...fullData,
        },
        { status: 400 },
      );
    }

    if (ticket.status === 'cancelled') {
      const fullData = await fetchFullTicketData(ticket.id);
      return NextResponse.json(
        {
          error: 'Ticket cancelled',
          message: 'This ticket has been cancelled',
          ...fullData,
        },
        { status: 400 },
      );
    }

    if (order.status !== 'paid') {
      const fullData = await fetchFullTicketData(ticket.id);
      return NextResponse.json(
        {
          error: 'Payment not completed',
          message: `Order status is ${order.status}, payment must be completed`,
          ...fullData,
        },
        { status: 400 },
      );
    }

    const activeEventGates = eventConfig.enable_entry_gate_flow
      ? (await getEventGates(ticket.event_id)).filter((gate) => gate.is_active)
      : [];

    let currentGateResult: 'scanned' | 'already_scanned' | 'not_applicable' = 'not_applicable';

    if (ticket.status === 'used') {
      const fullData = await fetchFullTicketData(ticket.id);
      return NextResponse.json(
        {
          error: 'Ticket already used',
          message: 'This ticket has already been scanned and used',
          ...fullData,
        },
        { status: 400 },
      );
    }

    if (eventConfig.enable_entry_gate_flow && activeEventGates.length > 0) {
      if (!gateId) {
        return NextResponse.json(
          { error: 'Gate required', message: 'Select event and gate to start scanning.' },
          { status: 400 },
        );
      }

      const targetGate = activeEventGates.find((gate) => gate.id === gateId);
      if (!targetGate) {
        return NextResponse.json(
          { error: 'Invalid gate', message: 'Selected gate is not active for this event.' },
          { status: 400 },
        );
      }

      const { data: existingScan } = await supabaseAdmin
        .from('ticket_gate_scans')
        .select('id')
        .eq('ticket_id', ticket.id)
        .eq('gate_id', gateId)
        .maybeSingle();

      if (existingScan) {
        currentGateResult = 'already_scanned';
      } else {
        const { error: insertScanError } = await supabaseAdmin.from('ticket_gate_scans').insert({
          ticket_id: ticket.id,
          event_id: ticket.event_id,
          gate_id: gateId,
          scanned_by_admin_id: admin.id,
          scanned_at: new Date().toISOString(),
          scan_source: 'admin_scanner',
        });

        if (insertScanError) {
          return NextResponse.json(
            { error: 'Failed to record gate scan', message: insertScanError.message },
            { status: 500 },
          );
        }

        currentGateResult = 'scanned';
      }

      const gateScansAfter = await getTicketGateScans(ticket.id);
      const gateScanProgress = buildGateProgress(activeEventGates, gateScansAfter);

      const isCompleted =
        gateScanProgress.totalCount > 0 &&
        gateScanProgress.completedCount >= gateScanProgress.totalCount;

      if (isCompleted && ticket.status === 'active') {
        const { error: updateError } = await supabaseAdmin
          .from('tickets')
          .update({
            status: 'used',
            scanned_at: new Date().toISOString(),
          })
          .eq('id', ticket.id);

        if (updateError) {
          return NextResponse.json(
            { error: 'Failed to update ticket', message: updateError.message },
            { status: 500 },
          );
        }
      }

      const fullData = await fetchFullTicketData(ticket.id);
      const completionText = `${gateScanProgress.completedCount} of ${gateScanProgress.totalCount} gates scanned.`;

      return NextResponse.json({
        success: true,
        message: isCompleted
          ? 'Entry complete. Ticket marked used.'
          : currentGateResult === 'already_scanned'
            ? `Already scanned at this gate. ${completionText}`
            : `Gate scanned successfully. ${completionText}`,
        ...fullData,
        entryGateFlowEnabled: true,
        gateScanProgress,
        gateScans: gateScansAfter,
        currentGateResult,
      });
    }

    if (ticket.status === 'active') {
      const { error: updateError } = await supabaseAdmin
        .from('tickets')
        .update({
          status: 'used',
          scanned_at: new Date().toISOString(),
        })
        .eq('id', ticket.id);

      if (updateError) {
        return NextResponse.json(
          { error: 'Failed to update ticket', message: updateError.message },
          { status: 500 },
        );
      }
    }

    const fullData = await fetchFullTicketData(ticket.id);

    return NextResponse.json({
      success: true,
      message: 'Ticket verified and marked as used',
      ...fullData,
      entryGateFlowEnabled: false,
      gateScanProgress: {
        completedCount: 0,
        totalCount: 0,
        completedGateIds: [],
      },
      gateScans: [],
      currentGateResult,
    });
  } catch (error: any) {
    console.error('Error verifying ticket:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: error?.message || 'An unexpected error occurred' },
      { status: 500 },
    );
  }
}

async function fetchFullTicketData(ticketId: string) {
  const { data: ticket, error: ticketError } = await supabaseAdmin
    .from('tickets')
    .select('*')
    .eq('id', ticketId)
    .single();

  if (ticketError || !ticket) {
    throw new Error('Ticket not found');
  }

  const { data: order, error: orderError } = await supabaseAdmin
    .from('orders')
    .select('*')
    .eq('id', ticket.order_id)
    .single();

  if (orderError || !order) {
    throw new Error('Order not found');
  }

  const { data: event, error: eventError } = await supabaseAdmin
    .from('events')
    .select('*')
    .eq('id', ticket.event_id)
    .single();

  if (eventError || !event) {
    throw new Error('Event not found');
  }

  let tier = null;
  if (ticket.tier_id) {
    const { data: tierData } = await supabaseAdmin
      .from('ticket_tiers')
      .select('*')
      .eq('id', ticket.tier_id)
      .single();
    tier = tierData;
  }

  const { data: allTickets } = await supabaseAdmin
    .from('tickets')
    .select(`
      *,
      ticket_tiers (
        id,
        name,
        price_cents
      )
    `)
    .eq('order_id', ticket.order_id)
    .order('created_at', { ascending: true });

  const ticketsWithTiers = (allTickets || []).map((t: any) => ({
    id: t.id,
    attendee_name: t.attendee_name,
    status: t.status,
    created_at: t.created_at,
    scanned_at: t.scanned_at,
    tier: t.ticket_tiers
      ? {
          id: t.ticket_tiers.id,
          name: t.ticket_tiers.name,
          price_cents: t.ticket_tiers.price_cents,
        }
      : null,
  }));

  const eventGates = event.enable_entry_gate_flow ? await getEventGates(ticket.event_id) : [];
  const activeEventGates = eventGates.filter((gate) => gate.is_active);
  const gateScans = await getTicketGateScans(ticket.id);
  const gateScanProgress = buildGateProgress(activeEventGates, gateScans);

  return {
    ticket: {
      ...ticket,
      tier: tier
        ? {
            id: tier.id,
            name: tier.name,
            price_cents: tier.price_cents,
          }
        : null,
    },
    order: {
      id: order.id,
      user_id: order.user_id,
      status: order.status,
      total_amount_cents: order.total_amount_cents,
      currency: order.currency,
      email: order.email,
      whatsapp_number: order.whatsapp_number,
      attendee_names: order.attendee_names,
      notes: order.notes,
      created_at: order.created_at,
      razorpay_order_id: order.razorpay_order_id,
      razorpay_payment_id: order.razorpay_payment_id,
      requested_cab: order.requested_cab ?? false,
      instagram_handle: order.instagram_handle ?? null,
      instagram_verification_status: order.instagram_verification_status ?? 'not_required',
      email_domain: order.email_domain ?? null,
      email_domain_status: order.email_domain_status ?? 'not_required',
    },
    event: {
      id: event.id,
      title: event.title,
      description: event.description,
      start_at: event.start_at,
      end_at: event.end_at,
      venue_name: event.venue_name,
      address_line: event.address_line,
      city: event.city,
      hero_image_url: event.hero_image_url,
      enable_entry_gate_flow: !!event.enable_entry_gate_flow,
    },
    allTickets: ticketsWithTiers,
    entryGateFlowEnabled: !!event.enable_entry_gate_flow,
    gateScanProgress,
    gateScans,
  };
}
