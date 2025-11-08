import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

interface QRCodeData {
  order_id: string;
  ticket_index: number;
  event_id: string;
  tier_id: string;
  attendee_name: string;
  timestamp: number;
}

export async function POST(req: Request) {
  try {
    const { qrData } = await req.json();

    if (!qrData || typeof qrData !== 'string') {
      return NextResponse.json(
        { error: 'Invalid QR code data', message: 'QR code data is required' },
        { status: 400 }
      );
    }

    // Parse QR code JSON
    let qrCodeData: QRCodeData;
    try {
      qrCodeData = JSON.parse(qrData);
    } catch (e) {
      return NextResponse.json(
        { error: 'Invalid QR code format', message: 'QR code is not valid JSON' },
        { status: 400 }
      );
    }

    // Validate QR code structure
    if (!qrCodeData.order_id || qrCodeData.ticket_index === undefined || !qrCodeData.event_id) {
      return NextResponse.json(
        { error: 'Invalid QR code structure', message: 'Missing required fields in QR code' },
        { status: 400 }
      );
    }

    // Look up ticket by qr_code_data (exact match) or by order_id + ticket_index (fallback)
    let ticketQuery = supabaseAdmin
      .from('tickets')
      .select('*')
      .eq('qr_code_data', qrData)
      .single();

    let { data: ticket, error: ticketError } = await ticketQuery;

    // Fallback: try matching by order_id and ticket_index if exact match fails
    if (ticketError || !ticket) {
      const { data: tickets, error: ticketsError } = await supabaseAdmin
        .from('tickets')
        .select('*')
        .eq('order_id', qrCodeData.order_id)
        .order('created_at', { ascending: true });

      if (ticketsError || !tickets || tickets.length === 0) {
        return NextResponse.json(
          { error: 'Ticket not found', message: 'No ticket found matching this QR code' },
          { status: 404 }
        );
      }

      // Find ticket by index (assuming tickets are created in order)
      ticket = tickets[qrCodeData.ticket_index] || tickets[0];
    }

    if (!ticket) {
      return NextResponse.json(
        { error: 'Ticket not found', message: 'No ticket found matching this QR code' },
        { status: 404 }
      );
    }

    // Check ticket status BEFORE updating
    if (ticket.status === 'used') {
      // Still fetch full details to show in UI
      const fullData = await fetchFullTicketData(ticket.id);
      return NextResponse.json(
        {
          error: 'Ticket already used',
          message: 'This ticket has already been scanned and used',
          ticket: fullData.ticket,
          order: fullData.order,
          event: fullData.event,
          allTickets: fullData.allTickets,
        },
        { status: 400 }
      );
    }

    if (ticket.status === 'cancelled') {
      const fullData = await fetchFullTicketData(ticket.id);
      return NextResponse.json(
        {
          error: 'Ticket cancelled',
          message: 'This ticket has been cancelled',
          ticket: fullData.ticket,
          order: fullData.order,
          event: fullData.event,
          allTickets: fullData.allTickets,
        },
        { status: 400 }
      );
    }

    // Fetch order to check payment status
    const { data: order, error: orderError } = await supabaseAdmin
      .from('orders')
      .select('*')
      .eq('id', ticket.order_id)
      .single();

    if (orderError || !order) {
      return NextResponse.json(
        { error: 'Order not found', message: 'Associated order not found' },
        { status: 404 }
      );
    }

    if (order.status !== 'paid') {
      const fullData = await fetchFullTicketData(ticket.id);
      return NextResponse.json(
        {
          error: 'Payment not completed',
          message: `Order status is ${order.status}, payment must be completed`,
          ticket: fullData.ticket,
          order: fullData.order,
          event: fullData.event,
          allTickets: fullData.allTickets,
        },
        { status: 400 }
      );
    }

    // Update ticket status to 'used' if currently 'active'
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
          { status: 500 }
        );
      }

      // Refresh ticket data
      const { data: updatedTicket } = await supabaseAdmin
        .from('tickets')
        .select('*')
        .eq('id', ticket.id)
        .single();
      ticket = updatedTicket || ticket;
    }

    // Fetch comprehensive data
    const fullData = await fetchFullTicketData(ticket.id);

    return NextResponse.json({
      success: true,
      message: 'Ticket verified and marked as used',
      ticket: fullData.ticket,
      order: fullData.order,
      event: fullData.event,
      allTickets: fullData.allTickets,
    });
  } catch (error: any) {
    console.error('Error verifying ticket:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: error?.message || 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}

async function fetchFullTicketData(ticketId: string) {
  // Fetch ticket with tier info
  const { data: ticket, error: ticketError } = await supabaseAdmin
    .from('tickets')
    .select('*')
    .eq('id', ticketId)
    .single();

  if (ticketError || !ticket) {
    throw new Error('Ticket not found');
  }

  // Fetch order details
  const { data: order, error: orderError } = await supabaseAdmin
    .from('orders')
    .select('*')
    .eq('id', ticket.order_id)
    .single();

  if (orderError || !order) {
    throw new Error('Order not found');
  }

  // Fetch event details
  const { data: event, error: eventError } = await supabaseAdmin
    .from('events')
    .select('*')
    .eq('id', ticket.event_id)
    .single();

  if (eventError || !event) {
    throw new Error('Event not found');
  }

  // Fetch tier details
  let tier = null;
  if (ticket.tier_id) {
    const { data: tierData } = await supabaseAdmin
      .from('ticket_tiers')
      .select('*')
      .eq('id', ticket.tier_id)
      .single();
    tier = tierData;
  }

  // Fetch all tickets in the same order
  const { data: allTickets, error: allTicketsError } = await supabaseAdmin
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
    tier: t.ticket_tiers ? {
      id: t.ticket_tiers.id,
      name: t.ticket_tiers.name,
      price_cents: t.ticket_tiers.price_cents,
    } : null,
  }));

  return {
    ticket: {
      ...ticket,
      tier: tier ? {
        id: tier.id,
        name: tier.name,
        price_cents: tier.price_cents,
      } : null,
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
    },
    allTickets: ticketsWithTiers,
  };
}

