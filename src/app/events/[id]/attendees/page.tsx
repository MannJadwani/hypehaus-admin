"use client";

import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { DataTable, type Column } from '@/components/DataTable';

type Attendee = {
  id: string; // required by DataTable
  ticket_id: string;
  attendee_name: string | null;
  ticket_status: 'active' | 'used' | 'cancelled';
  scanned_at: string | null;
  order_id: string;
  order_status: string | null;
  user_id: string | null;
  buyer_name: string | null;
  email: string | null;
  whatsapp_number: string | null;
  created_at: string | null;
  cab_requested?: boolean;
  instagram_handle?: string | null;
  instagram_verification_status?: 'not_required' | 'pending' | 'approved' | 'rejected';
  email_domain?: string | null;
  email_domain_status?: 'not_required' | 'approved' | 'rejected';
};

type EventGate = {
  id: string;
  require_instagram_verification: boolean;
  require_email_domain_verification: boolean;
  allowed_email_domains: string[] | null;
};

export default function AttendeesPage() {
  const params = useParams<{ id: string }>();
  const eventId = params.id;
  const [rows, setRows] = useState<Attendee[]>([]);
  const [eventGate, setEventGate] = useState<EventGate | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<'all'|'active'|'used'|'cancelled'>('all');

  // Column visibility (persisted per event)
  const COLS_KEY = `attendees_table_cols_${eventId}`;
  const defaultVisible = ['attendee','buyer','email','phone','instagram','ig_status','ig_action','email_domain','email_status','cab','status','scan'] as const;
  const [visibleCols, setVisibleCols] = useState<string[]>([...defaultVisible]);
  const [showColsPanel, setShowColsPanel] = useState(false);

  useEffect(() => {
    const loadCols = () => {
      try {
        const saved = typeof window !== 'undefined' ? window.localStorage.getItem(COLS_KEY) : null;
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length) setVisibleCols(parsed);
        }
      } catch {}
    };
    loadCols();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId]);
  useEffect(() => {
    try { if (typeof window !== 'undefined') window.localStorage.setItem(COLS_KEY, JSON.stringify(visibleCols)); } catch {}
  }, [visibleCols, COLS_KEY]);

  const load = async () => {
    setLoading(true); setError(null);
    const res = await fetch(`/api/events/${eventId}/attendees`, { cache: 'no-store' });
    if (!res.ok) { setError('Failed to load attendees'); setLoading(false); return; }
    const data = await res.json();
    const withId: Attendee[] = (data.attendees ?? []).map((r: any) => ({ id: r.ticket_id, ...r }));
    setRows(withId);
    setEventGate(data.event ?? null);
    setLoading(false);
  };

  const updateInstagramStatus = async (orderId: string, nextStatus: 'approved' | 'rejected') => {
    setUpdatingOrderId(orderId);
    try {
      const res = await fetch(`/api/orders/${orderId}/instagram`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body?.error ?? 'Failed to update Instagram verification status');
        return;
      }
      await load();
    } finally {
      setUpdatingOrderId(null);
    }
  };

  useEffect(() => { load(); }, [eventId]);

  const filtered = useMemo(() => {
    let out = rows.slice();
    if (q.trim()) {
      const s = q.trim().toLowerCase();
      out = out.filter(r => (r.attendee_name ?? '').toLowerCase().includes(s) || (r.buyer_name ?? '').toLowerCase().includes(s) || (r.email ?? '').toLowerCase().includes(s) || (r.whatsapp_number ?? '').toLowerCase().includes(s) || (r.instagram_handle ?? '').toLowerCase().includes(s) || (r.email_domain ?? '').toLowerCase().includes(s));
    }
    if (status !== 'all') out = out.filter(r => r.ticket_status === status);
    return out;
  }, [rows, q, status]);

  const exportCsv = () => {
    const headersMap: Record<string,string> = {
      attendee:'attendee_name',
      buyer:'buyer_name',
      email:'email',
      phone:'whatsapp_number',
      instagram:'instagram_handle',
      ig_status:'instagram_verification_status',
      ig_action:'instagram_review_action',
      email_domain:'email_domain',
      email_status:'email_domain_status',
      cab:'cab_requested',
      status:'ticket_status',
      scan:'scanned_at',
    };
    const headers = visibleCols.map((id) => headersMap[id] ?? id);
    const lines = [headers.join(',')];
    for (const r of filtered) {
      const rowVals = visibleCols.map((id) => {
        switch (id) {
          case 'attendee': return r.attendee_name ?? '';
          case 'buyer': return r.buyer_name ?? '';
          case 'email': return r.email ?? '';
          case 'phone': return r.whatsapp_number ?? '';
          case 'instagram': return r.instagram_handle ?? '';
          case 'ig_status': return r.instagram_verification_status ?? 'not_required';
          case 'ig_action': return '';
          case 'email_domain': return r.email_domain ?? '';
          case 'email_status': return r.email_domain_status ?? 'not_required';
          case 'cab': return r.cab_requested ? 'Yes' : 'No';
          case 'status': return r.ticket_status;
          case 'scan': return r.scanned_at ?? '';
          default: return '';
        }
      });
      lines.push(rowVals.map(f => `"${String(f).replace(/"/g,'""')}"`).join(','));
    }
    const csv = lines.join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `attendees-${eventId}.csv`; document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
  };

  const allColumns: Column<Attendee>[] = [
    { id: 'attendee', header: 'Attendee', sortable: true, accessor: (r) => r.attendee_name ?? '-' },
    { id: 'buyer', header: 'Buyer', sortable: true, accessor: (r) => r.buyer_name ?? '-' },
    { id: 'email', header: 'Email', sortable: true, accessor: (r) => r.email ?? '-' },
    { id: 'phone', header: 'WhatsApp', sortable: true, accessor: (r) => r.whatsapp_number ?? '-' },
    { id: 'instagram', header: 'Instagram', sortable: true, accessor: (r) => r.instagram_handle ?? '-' },
    { id: 'ig_status', header: 'IG Status', sortable: true, accessor: (r) => r.instagram_verification_status ?? 'not_required' },
    { id: 'email_domain', header: 'Email Domain', sortable: true, accessor: (r) => r.email_domain ?? '-' },
    { id: 'email_status', header: 'Email Gate', sortable: true, accessor: (r) => r.email_domain_status ?? 'not_required' },
    { id: 'cab', header: 'Cab', sortable: true, accessor: (r) => (r.cab_requested ? 'Yes' : 'No') },
    { id: 'status', header: 'Ticket', sortable: true, accessor: (r) => r.ticket_status },
    { id: 'scan', header: 'Scanned', sortable: true, accessor: (r) => (r.scanned_at ? new Date(r.scanned_at).toLocaleString() : '-') },
    {
      id: 'ig_action',
      header: 'IG Review',
      accessor: (r) => {
        if (!eventGate?.require_instagram_verification) return '-';
        const disabled = updatingOrderId === r.order_id;
        return (
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="hh-btn-secondary text-xs"
              disabled={disabled || r.instagram_verification_status === 'approved'}
              onClick={() => updateInstagramStatus(r.order_id, 'approved')}
            >
              Approve
            </button>
            <button
              type="button"
              className="hh-btn-secondary text-xs"
              disabled={disabled || r.instagram_verification_status === 'rejected'}
              onClick={() => updateInstagramStatus(r.order_id, 'rejected')}
            >
              Reject
            </button>
          </div>
        );
      },
    },
  ];

  const columns = useMemo(() => allColumns.filter(c => visibleCols.includes(c.id)), [allColumns, visibleCols]);

  const toggleCol = (id: string) => {
    setVisibleCols((prev) => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4 md:mb-6 relative">
        <h1 className="text-xl md:text-2xl font-semibold text-(--hh-text)">Attendees</h1>
        <div className="flex gap-2">
          <button onClick={() => setShowColsPanel((s)=>!s)} className="hh-btn-secondary text-sm">Columns</button>
          <button onClick={exportCsv} className="hh-btn-secondary text-sm">Export CSV</button>
          <Link href="/events" className="hh-btn-primary text-sm">Back to Events</Link>
        </div>
        {showColsPanel && (
          <div className="absolute right-0 top-full mt-2 z-10 hh-card p-3 w-56">
            <div className="text-(--hh-text-secondary) text-xs mb-2">Show columns</div>
            <div className="space-y-2 max-h-64 overflow-auto">
              {allColumns.map((c) => (
                <label key={c.id} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" className="h-4 w-4" checked={visibleCols.includes(c.id)} onChange={() => toggleCol(c.id)} />
                  <span className="text-(--hh-text)">{c.header}</span>
                </label>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="hh-card p-3 md:p-4 mb-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <input value={q} onChange={(e)=>setQ(e.target.value)} className="hh-input px-3 py-2 text-sm md:col-span-2" placeholder="Search attendee, buyer, email, phone" />
          <select value={status} onChange={(e)=>setStatus(e.target.value as any)} className="hh-input px-3 py-2 text-sm">
            <option value="all">All tickets</option>
            <option value="active">Active</option>
            <option value="used">Used</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
      </div>

      {eventGate && (eventGate.require_instagram_verification || eventGate.require_email_domain_verification) && (
        <div className="hh-card p-3 mb-4 text-sm text-(--hh-text-secondary)">
          {eventGate.require_instagram_verification && (
            <div>Instagram gate: enabled (tickets require Instagram approval before scan)</div>
          )}
          {eventGate.require_email_domain_verification && (
            <div>
              Email-domain gate: enabled
              {eventGate.allowed_email_domains?.length ? ` (${eventGate.allowed_email_domains.join(', ')})` : ''}
            </div>
          )}
        </div>
      )}

      {loading && <p className="text-(--hh-text-secondary)">Loading…</p>}
      {error && <p className="text-red-400">{error}</p>}
      {!loading && !error && (
        <div className="hidden md:block">
          <DataTable data={filtered} columns={columns} emptyLabel="No attendees found" />
        </div>
      )}

      {!loading && !error && (
        <div className="md:hidden space-y-3">
          {filtered.map((r) => (
            <div key={r.id} className="hh-card p-3">
              <div className="font-semibold text-(--hh-text)">{r.attendee_name ?? '-'}</div>
              <div className="text-(--hh-text-secondary) text-sm">Buyer: {r.buyer_name ?? '-'}</div>
              <div className="text-(--hh-text-secondary) text-sm">Email: {r.email ?? '-'}</div>
              <div className="text-(--hh-text-secondary) text-sm">WhatsApp: {r.whatsapp_number ?? '-'}</div>
              <div className="text-(--hh-text-secondary) text-sm">Instagram: {r.instagram_handle ?? '-'}</div>
              <div className="text-(--hh-text-secondary) text-sm">IG Status: {r.instagram_verification_status ?? 'not_required'}</div>
              <div className="text-(--hh-text-secondary) text-sm">Email Domain: {r.email_domain ?? '-'}</div>
              <div className="text-(--hh-text-secondary) text-sm">Email Gate: {r.email_domain_status ?? 'not_required'}</div>
              <div className="text-(--hh-text-secondary) text-sm">Cab: {r.cab_requested ? 'Yes' : 'No'}</div>
              <div className="text-(--hh-text-secondary) text-sm">Ticket: {r.ticket_status}</div>
              <div className="text-(--hh-text-secondary) text-sm">Scanned: {r.scanned_at ? new Date(r.scanned_at).toLocaleString() : '-'}</div>
              {eventGate?.require_instagram_verification && (
                <div className="mt-2 flex items-center gap-2">
                  <button
                    type="button"
                    className="hh-btn-secondary text-xs"
                    disabled={updatingOrderId === r.order_id || r.instagram_verification_status === 'approved'}
                    onClick={() => updateInstagramStatus(r.order_id, 'approved')}
                  >
                    Approve
                  </button>
                  <button
                    type="button"
                    className="hh-btn-secondary text-xs"
                    disabled={updatingOrderId === r.order_id || r.instagram_verification_status === 'rejected'}
                    onClick={() => updateInstagramStatus(r.order_id, 'rejected')}
                  >
                    Reject
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
