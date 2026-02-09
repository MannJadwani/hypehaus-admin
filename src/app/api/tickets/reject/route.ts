import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { requireAuth } from '@/lib/admin-auth';
import { NextRequest } from 'next/server';

export async function POST(req: NextRequest) {
  let admin;
  try {
    admin = await requireAuth(req);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 401 });
  }

  try {
    const { ticketId } = await req.json();

    if (!ticketId || typeof ticketId !== 'string') {
      return NextResponse.json(
        { error: 'Invalid ticket ID', message: 'Ticket ID is required' },
        { status: 400 }
      );
    }

    // Fetch the ticket to check current status
    const { data: ticket, error: ticketError } = await supabaseAdmin
      .from('tickets')
      .select('*')
      .eq('id', ticketId)
      .single();

    if (ticketError || !ticket) {
      return NextResponse.json(
        { error: 'Ticket not found', message: 'No ticket found with this ID' },
        { status: 404 }
      );
    }

    // Check if ticket is already cancelled or used
    if (ticket.status === 'cancelled') {
      return NextResponse.json(
        { error: 'Ticket already cancelled', message: 'This ticket has already been cancelled' },
        { status: 400 }
      );
    }

    if (ticket.status === 'used') {
      return NextResponse.json(
        { error: 'Ticket already used', message: 'This ticket has already been scanned and cannot be rejected' },
        { status: 400 }
      );
    }

    // Update ticket status to 'cancelled'
    const { error: updateError } = await supabaseAdmin
      .from('tickets')
      .update({
        status: 'cancelled',
        updated_at: new Date().toISOString(),
      })
      .eq('id', ticketId);

    if (updateError) {
      return NextResponse.json(
        { error: 'Failed to reject ticket', message: updateError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Ticket rejected successfully',
    });
  } catch (error: any) {
    console.error('Error rejecting ticket:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: error?.message || 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}
