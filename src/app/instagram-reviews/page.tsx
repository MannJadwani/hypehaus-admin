"use client";

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { DataTable, type Column } from '@/components/DataTable';

type InstagramReviewOrder = {
  id: string;
  order_id: string;
  event_id: string;
  event_title: string;
  instagram_handle: string;
  instagram_verification_status: 'pending' | 'approved' | 'rejected';
  buyer_name: string | null;
  email: string;
  whatsapp_number: string;
  total_amount_cents: number;
  currency: string;
  created_at: string;
  attendee_names: string[];
};

type StatusFilter = 'pending' | 'approved' | 'rejected' | 'all';

export default function InstagramReviewsPage() {
  const [orders, setOrders] = useState<InstagramReviewOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('pending');
  const [searchQuery, setSearchQuery] = useState('');

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/instagram-reviews', { cache: 'no-store' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error ?? 'Failed to load Instagram reviews');
      }
      const data = await res.json();
      setOrders(data.orders ?? []);
    } catch (err: any) {
      setError(err.message ?? 'Failed to load Instagram reviews');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const updateStatus = async (orderId: string, status: 'approved' | 'rejected') => {
    setUpdatingOrderId(orderId);
    try {
      const res = await fetch(`/api/orders/${orderId}/instagram`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data?.error ?? 'Failed to update status');
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
    if (statusFilter !== 'all') {
      result = result.filter(o => o.instagram_verification_status === statusFilter);
    }
    
    // Filter by search query
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      result = result.filter(o =>
        o.instagram_handle.toLowerCase().includes(q) ||
        o.event_title.toLowerCase().includes(q) ||
        (o.buyer_name ?? '').toLowerCase().includes(q) ||
        o.email.toLowerCase().includes(q) ||
        o.whatsapp_number.includes(q)
      );
    }
    
    return result;
  }, [orders, statusFilter, searchQuery]);

  const counts = useMemo(() => ({
    pending: orders.filter(o => o.instagram_verification_status === 'pending').length,
    approved: orders.filter(o => o.instagram_verification_status === 'approved').length,
    rejected: orders.filter(o => o.instagram_verification_status === 'rejected').length,
    all: orders.length,
  }), [orders]);

  const formatPrice = (cents: number, currency: string) => {
    const value = cents / 100;
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: currency || 'INR' }).format(value);
  };

  const columns: Column<InstagramReviewOrder>[] = [
    {
      id: 'instagram',
      header: 'Instagram',
      sortable: true,
      accessor: (row) => (
        <a
          href={`https://instagram.com/${row.instagram_handle}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[var(--hh-primary)] hover:underline font-medium"
        >
          @{row.instagram_handle}
        </a>
      ),
    },
    {
      id: 'event',
      header: 'Event',
      sortable: true,
      accessor: (row) => (
        <Link href={`/events/${row.event_id}`} className="hover:text-[var(--hh-primary)] transition-colors">
          {row.event_title}
        </Link>
      ),
    },
    {
      id: 'buyer',
      header: 'Buyer',
      sortable: true,
      accessor: (row) => row.buyer_name ?? '-',
    },
    {
      id: 'email',
      header: 'Email',
      sortable: true,
      accessor: (row) => row.email,
    },
    {
      id: 'phone',
      header: 'WhatsApp',
      sortable: true,
      accessor: (row) => row.whatsapp_number,
    },
    {
      id: 'amount',
      header: 'Amount',
      sortable: true,
      accessor: (row) => formatPrice(row.total_amount_cents, row.currency),
    },
    {
      id: 'status',
      header: 'Status',
      sortable: true,
      accessor: (row) => {
        const statusColors: Record<string, string> = {
          pending: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
          approved: 'bg-green-500/20 text-green-400 border-green-500/30',
          rejected: 'bg-red-500/20 text-red-400 border-red-500/30',
        };
        return (
          <span className={`px-2 py-1 rounded-lg text-xs font-medium border ${statusColors[row.instagram_verification_status] ?? ''}`}>
            {row.instagram_verification_status}
          </span>
        );
      },
    },
    {
      id: 'date',
      header: 'Date',
      sortable: true,
      accessor: (row) => new Date(row.created_at).toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      }),
    },
    {
      id: 'actions',
      header: 'Actions',
      accessor: (row) => {
        const isPending = row.instagram_verification_status === 'pending';
        const isUpdating = updatingOrderId === row.order_id;
        
        return (
          <div className="flex items-center gap-2">
            <button
              onClick={() => updateStatus(row.order_id, 'approved')}
              disabled={isUpdating || row.instagram_verification_status === 'approved'}
              className="px-3 py-1.5 text-xs font-medium rounded-lg bg-green-500/10 text-green-400 border border-green-500/20 hover:bg-green-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isUpdating ? '...' : 'Approve'}
            </button>
            <button
              onClick={() => updateStatus(row.order_id, 'rejected')}
              disabled={isUpdating || row.instagram_verification_status === 'rejected'}
              className="px-3 py-1.5 text-xs font-medium rounded-lg bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isUpdating ? '...' : 'Reject'}
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
          <h1 className="text-xl md:text-2xl font-semibold text-[var(--hh-text)]">Instagram Reviews</h1>
          <p className="text-sm text-[var(--hh-text-secondary)] mt-1">
            Review and approve Instagram handles for gated events
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
          <div className="text-sm text-[var(--hh-text-secondary)]">Pending Review</div>
        </button>
        <button
          onClick={() => setStatusFilter('approved')}
          className={`hh-card p-4 text-left transition-all ${statusFilter === 'approved' ? 'ring-2 ring-green-500/50' : ''}`}
        >
          <div className="text-2xl font-bold text-green-400">{counts.approved}</div>
          <div className="text-sm text-[var(--hh-text-secondary)]">Approved</div>
        </button>
        <button
          onClick={() => setStatusFilter('rejected')}
          className={`hh-card p-4 text-left transition-all ${statusFilter === 'rejected' ? 'ring-2 ring-red-500/50' : ''}`}
        >
          <div className="text-2xl font-bold text-red-400">{counts.rejected}</div>
          <div className="text-sm text-[var(--hh-text-secondary)]">Rejected</div>
        </button>
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
          placeholder="Search by Instagram handle, event, buyer, email, or phone..."
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
          <p className="text-[var(--hh-text-secondary)] text-sm">Loading reviews...</p>
        </div>
      )}

      {/* Table - Desktop */}
      {!loading && (
        <div className="hidden md:block">
          <DataTable data={filtered} columns={columns} emptyLabel="No Instagram reviews found" />
        </div>
      )}

      {/* Cards - Mobile */}
      {!loading && (
        <div className="md:hidden space-y-3">
          {filtered.length === 0 && (
            <div className="hh-card p-6 text-center text-[var(--hh-text-tertiary)]">
              No Instagram reviews found
            </div>
          )}
          {filtered.map((row) => (
            <div key={row.id} className="hh-card p-4">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div>
                  <a
                    href={`https://instagram.com/${row.instagram_handle}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[var(--hh-primary)] hover:underline font-semibold text-lg"
                  >
                    @{row.instagram_handle}
                  </a>
                  <div className="text-sm text-[var(--hh-text-secondary)] mt-1">{row.event_title}</div>
                </div>
                <span className={`px-2 py-1 rounded-lg text-xs font-medium border ${
                  row.instagram_verification_status === 'pending' ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' :
                  row.instagram_verification_status === 'approved' ? 'bg-green-500/20 text-green-400 border-green-500/30' :
                  'bg-red-500/20 text-red-400 border-red-500/30'
                }`}>
                  {row.instagram_verification_status}
                </span>
              </div>
              
              <div className="space-y-1 text-sm text-[var(--hh-text-secondary)] mb-4">
                <div>Buyer: {row.buyer_name ?? '-'}</div>
                <div>Email: {row.email}</div>
                <div>WhatsApp: {row.whatsapp_number}</div>
                <div>Amount: {formatPrice(row.total_amount_cents, row.currency)}</div>
                <div>Date: {new Date(row.created_at).toLocaleDateString('en-IN')}</div>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => updateStatus(row.order_id, 'approved')}
                  disabled={updatingOrderId === row.order_id || row.instagram_verification_status === 'approved'}
                  className="flex-1 px-3 py-2 text-sm font-medium rounded-lg bg-green-500/10 text-green-400 border border-green-500/20 hover:bg-green-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Approve
                </button>
                <button
                  onClick={() => updateStatus(row.order_id, 'rejected')}
                  disabled={updatingOrderId === row.order_id || row.instagram_verification_status === 'rejected'}
                  className="flex-1 px-3 py-2 text-sm font-medium rounded-lg bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Reject
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
