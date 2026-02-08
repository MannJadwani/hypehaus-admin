"use client";

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { DataTable, type Column } from '@/components/DataTable';

type RefundOrder = {
  id: string;
  order_id: string;
  event_id: string;
  event_title: string;
  buyer_name: string | null;
  email: string;
  whatsapp_number: string;
  total_amount_cents: number;
  currency: string;
  refund_reason: string | null;
  refund_requested_at: string;
  refund_processed: boolean;
  refund_processed_at: string | null;
  refund_notes: string | null;
  instagram_handle: string | null;
};

type StatusFilter = 'pending' | 'processed' | 'all';

export default function RefundsPage() {
  const [orders, setOrders] = useState<RefundOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('pending');
  const [searchQuery, setSearchQuery] = useState('');
  const [refundNotes, setRefundNotes] = useState<Record<string, string>>({});

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/refunds', { cache: 'no-store' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error ?? 'Failed to load refunds');
      }
      const data = await res.json();
      setOrders(data.orders ?? []);
    } catch (err: any) {
      setError(err.message ?? 'Failed to load refunds');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const markAsProcessed = async (orderId: string) => {
    setUpdatingOrderId(orderId);
    try {
      const notes = refundNotes[orderId] || '';
      const res = await fetch(`/api/orders/${orderId}/refund`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ processed: true, notes }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data?.error ?? 'Failed to mark as processed');
        return;
      }
      await load();
    } finally {
      setUpdatingOrderId(null);
    }
  };

  const filtered = useMemo(() => {
    let result = orders;
    
    // Filter by status
    if (statusFilter === 'pending') {
      result = result.filter(o => !o.refund_processed);
    } else if (statusFilter === 'processed') {
      result = result.filter(o => o.refund_processed);
    }
    
    // Filter by search query
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      result = result.filter(o =>
        o.event_title.toLowerCase().includes(q) ||
        (o.buyer_name ?? '').toLowerCase().includes(q) ||
        o.email.toLowerCase().includes(q) ||
        o.whatsapp_number.includes(q) ||
        (o.instagram_handle ?? '').toLowerCase().includes(q)
      );
    }
    
    return result;
  }, [orders, statusFilter, searchQuery]);

  const counts = useMemo(() => ({
    pending: orders.filter(o => !o.refund_processed).length,
    processed: orders.filter(o => o.refund_processed).length,
    all: orders.length,
  }), [orders]);

  const totalPendingAmount = useMemo(() => {
    return orders
      .filter(o => !o.refund_processed)
      .reduce((sum, o) => sum + o.total_amount_cents, 0);
  }, [orders]);

  const formatPrice = (cents: number, currency: string) => {
    const value = cents / 100;
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: currency || 'INR' }).format(value);
  };

  const columns: Column<RefundOrder>[] = [
    {
      id: 'event',
      header: 'Event',
      sortable: true,
      accessor: (row) => (
        <Link href={`/events/${row.event_id}`} className="hover:text-[var(--hh-primary)] transition-colors font-medium">
          {row.event_title}
        </Link>
      ),
    },
    {
      id: 'buyer',
      header: 'Buyer',
      sortable: true,
      accessor: (row) => (
        <div>
          <div className="font-medium">{row.buyer_name ?? '-'}</div>
          <div className="text-xs text-[var(--hh-text-tertiary)]">{row.email}</div>
        </div>
      ),
    },
    {
      id: 'phone',
      header: 'WhatsApp',
      sortable: true,
      accessor: (row) => row.whatsapp_number,
    },
    {
      id: 'instagram',
      header: 'Instagram',
      sortable: true,
      accessor: (row) => row.instagram_handle ? (
        <a
          href={`https://instagram.com/${row.instagram_handle}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[var(--hh-primary)] hover:underline"
        >
          @{row.instagram_handle}
        </a>
      ) : '-',
    },
    {
      id: 'amount',
      header: 'Amount',
      sortable: true,
      accessor: (row) => (
        <span className="font-semibold text-red-400">
          {formatPrice(row.total_amount_cents, row.currency)}
        </span>
      ),
    },
    {
      id: 'reason',
      header: 'Reason',
      sortable: true,
      accessor: (row) => (
        <span className="text-sm text-[var(--hh-text-secondary)]">
          {row.refund_reason ?? 'Not specified'}
        </span>
      ),
    },
    {
      id: 'requested',
      header: 'Requested',
      sortable: true,
      accessor: (row) => new Date(row.refund_requested_at).toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      }),
    },
    {
      id: 'status',
      header: 'Status',
      sortable: true,
      accessor: (row) => row.refund_processed ? (
        <span className="px-2 py-1 rounded-lg text-xs font-medium border bg-green-500/20 text-green-400 border-green-500/30">
          Processed
        </span>
      ) : (
        <span className="px-2 py-1 rounded-lg text-xs font-medium border bg-yellow-500/20 text-yellow-400 border-yellow-500/30">
          Pending
        </span>
      ),
    },
    {
      id: 'actions',
      header: 'Actions',
      accessor: (row) => {
        if (row.refund_processed) {
          return (
            <span className="text-xs text-[var(--hh-text-tertiary)]">
              {row.refund_processed_at ? new Date(row.refund_processed_at).toLocaleDateString('en-IN') : 'Done'}
            </span>
          );
        }
        
        const isUpdating = updatingOrderId === row.order_id;
        
        return (
          <div className="flex items-center gap-2">
            <input
              type="text"
              placeholder="Notes (optional)"
              value={refundNotes[row.order_id] ?? ''}
              onChange={(e) => setRefundNotes(prev => ({ ...prev, [row.order_id]: e.target.value }))}
              className="hh-input px-2 py-1 text-xs w-28"
            />
            <button
              onClick={() => markAsProcessed(row.order_id)}
              disabled={isUpdating}
              className="px-3 py-1.5 text-xs font-medium rounded-lg bg-green-500/10 text-green-400 border border-green-500/20 hover:bg-green-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
            >
              {isUpdating ? '...' : 'Mark Done'}
            </button>
          </div>
        );
      },
    },
  ];

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl md:text-2xl font-semibold text-[var(--hh-text)]">Refund Queue</h1>
          <p className="text-sm text-[var(--hh-text-secondary)] mt-1">
            Process refunds for rejected Instagram verifications and other cases
          </p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="hh-btn-secondary text-sm px-4 py-2"
        >
          {loading ? 'Loading...' : 'Refresh'}
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <button
          onClick={() => setStatusFilter('pending')}
          className={`hh-card p-4 text-left transition-all ${statusFilter === 'pending' ? 'ring-2 ring-yellow-500/50' : ''}`}
        >
          <div className="text-2xl font-bold text-yellow-400">{counts.pending}</div>
          <div className="text-sm text-[var(--hh-text-secondary)]">Pending Refunds</div>
        </button>
        <button
          onClick={() => setStatusFilter('processed')}
          className={`hh-card p-4 text-left transition-all ${statusFilter === 'processed' ? 'ring-2 ring-green-500/50' : ''}`}
        >
          <div className="text-2xl font-bold text-green-400">{counts.processed}</div>
          <div className="text-sm text-[var(--hh-text-secondary)]">Processed</div>
        </button>
        <div className="hh-card p-4">
          <div className="text-2xl font-bold text-red-400">{formatPrice(totalPendingAmount, 'INR')}</div>
          <div className="text-sm text-[var(--hh-text-secondary)]">Pending Amount</div>
        </div>
        <button
          onClick={() => setStatusFilter('all')}
          className={`hh-card p-4 text-left transition-all ${statusFilter === 'all' ? 'ring-2 ring-[var(--hh-primary)]/50' : ''}`}
        >
          <div className="text-2xl font-bold text-[var(--hh-text)]">{counts.all}</div>
          <div className="text-sm text-[var(--hh-text-secondary)]">Total</div>
        </button>
      </div>

      {/* Search */}
      <div className="hh-card p-4 mb-4">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search by event, buyer, email, phone, or Instagram..."
          className="w-full hh-input px-4 py-2.5 text-sm"
        />
      </div>

      {/* Error */}
      {error && (
        <div className="hh-card p-4 mb-4 border-red-500/30 bg-red-500/10">
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="hh-card p-8 text-center">
          <div className="inline-block w-6 h-6 border-2 border-[var(--hh-primary)] border-t-transparent rounded-full animate-spin mb-2"></div>
          <p className="text-[var(--hh-text-secondary)] text-sm">Loading refunds...</p>
        </div>
      )}

      {/* Table - Desktop */}
      {!loading && (
        <div className="hidden md:block">
          <DataTable data={filtered} columns={columns} emptyLabel="No refunds found" />
        </div>
      )}

      {/* Cards - Mobile */}
      {!loading && (
        <div className="md:hidden space-y-3">
          {filtered.length === 0 && (
            <div className="hh-card p-6 text-center text-[var(--hh-text-tertiary)]">
              No refunds found
            </div>
          )}
          {filtered.map((row) => (
            <div key={row.id} className="hh-card p-4">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div>
                  <Link href={`/events/${row.event_id}`} className="font-semibold text-lg hover:text-[var(--hh-primary)]">
                    {row.event_title}
                  </Link>
                  <div className="text-sm text-[var(--hh-text-secondary)] mt-1">{row.buyer_name ?? '-'}</div>
                </div>
                <span className="font-bold text-red-400 text-lg">
                  {formatPrice(row.total_amount_cents, row.currency)}
                </span>
              </div>
              
              <div className="space-y-1 text-sm text-[var(--hh-text-secondary)] mb-4">
                <div>Email: {row.email}</div>
                <div>WhatsApp: {row.whatsapp_number}</div>
                {row.instagram_handle && (
                  <div>Instagram: @{row.instagram_handle}</div>
                )}
                <div>Reason: {row.refund_reason ?? 'Not specified'}</div>
                <div>Requested: {new Date(row.refund_requested_at).toLocaleDateString('en-IN')}</div>
              </div>

              {row.refund_processed ? (
                <div className="flex items-center gap-2">
                  <span className="px-3 py-2 rounded-lg text-sm font-medium bg-green-500/20 text-green-400 border border-green-500/30 flex-1 text-center">
                    Processed {row.refund_processed_at ? `on ${new Date(row.refund_processed_at).toLocaleDateString('en-IN')}` : ''}
                  </span>
                </div>
              ) : (
                <div className="space-y-2">
                  <input
                    type="text"
                    placeholder="Notes (e.g., transaction ID)"
                    value={refundNotes[row.order_id] ?? ''}
                    onChange={(e) => setRefundNotes(prev => ({ ...prev, [row.order_id]: e.target.value }))}
                    className="w-full hh-input px-3 py-2 text-sm"
                  />
                  <button
                    onClick={() => markAsProcessed(row.order_id)}
                    disabled={updatingOrderId === row.order_id}
                    className="w-full px-3 py-2 text-sm font-medium rounded-lg bg-green-500/10 text-green-400 border border-green-500/20 hover:bg-green-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {updatingOrderId === row.order_id ? 'Processing...' : 'Mark as Processed'}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
