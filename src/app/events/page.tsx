"use client";

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { DataTable, type Column } from '@/components/DataTable';

type Event = {
  id: string;
  title: string;
  category: string | null;
  city: string | null;
  start_at: string;
  status: 'draft' | 'published' | 'archived';
  cab_opt_in_count?: number;
};

const COLS_KEY = 'events_table_cols';

export default function EventsPage() {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<'all'|'draft'|'published'|'archived'>('all');
  const [category, setCategory] = useState<string>('all');
  const [city, setCity] = useState<string>('all');
  const [from, setFrom] = useState<string>('');
  const [to, setTo] = useState<string>('');

  // Column visibility
  const defaultVisible = ['title','category','city','start','cab','status','actions'] as const;
  const [visibleCols, setVisibleCols] = useState<string[]>([...defaultVisible]);
  const [showColsPanel, setShowColsPanel] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const saved = window.localStorage.getItem(COLS_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length) setVisibleCols(parsed);
      } catch {}
    }
  }, []);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(COLS_KEY, JSON.stringify(visibleCols));
  }, [visibleCols]);

  const load = async () => {
    setLoading(true);
    setError(null);
    const res = await fetch('/api/events', { cache: 'no-store' });
    if (!res.ok) {
      setError('Failed to load events');
      setLoading(false);
      return;
    }
    const data = await res.json();
    setEvents(data.events ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const togglePublish = async (event: Event) => {
    const next = event.status === 'published' ? 'draft' : 'published';
    await fetch(`/api/events/${event.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: next }) });
    await load();
  };

  const destroy = async (event: Event) => {
    if (!confirm(`Delete event "${event.title}"?`)) return;
    await fetch(`/api/events/${event.id}`, { method: 'DELETE' });
    await load();
  };

  const uniqueCategories = useMemo(() => Array.from(new Set(events.map(e => e.category).filter(Boolean))) as string[], [events]);
  const uniqueCities = useMemo(() => Array.from(new Set(events.map(e => e.city).filter(Boolean))) as string[], [events]);

  const filtered = useMemo(() => {
    let rows = events.slice();
    if (q.trim()) {
      const s = q.trim().toLowerCase();
      rows = rows.filter(e => e.title.toLowerCase().includes(s) || (e.category ?? '').toLowerCase().includes(s) || (e.city ?? '').toLowerCase().includes(s));
    }
    if (status !== 'all') rows = rows.filter(e => e.status === status);
    if (category !== 'all') rows = rows.filter(e => (e.category ?? '') === category);
    if (city !== 'all') rows = rows.filter(e => (e.city ?? '') === city);
    if (from) rows = rows.filter(e => Date.parse(e.start_at) >= Date.parse(from));
    if (to) rows = rows.filter(e => Date.parse(e.start_at) <= Date.parse(to) + 86_400_000 - 1);
    return rows;
  }, [events, q, status, category, city, from, to]);

  const exportCsv = () => {
    // Export only visible (non-action) columns
    const headersMap: Record<string,string> = { title:'title', category:'category', city:'city', start:'start_at', status:'status', cab:'cab_opt_in_count' };
    const headers = visibleCols.filter((id) => id !== 'actions').map((id) => headersMap[id] ?? id);
    const lines = [headers.join(',')];
    for (const e of filtered) {
      const rowVals = visibleCols.filter((id)=>id!=='actions').map((id) => {
        switch (id) {
          case 'title': return e.title;
          case 'category': return e.category ?? '';
          case 'city': return e.city ?? '';
          case 'start': return new Date(e.start_at).toISOString();
          case 'status': return e.status;
          case 'cab': return String(e.cab_opt_in_count ?? 0);
          default: return '';
        }
      });
      lines.push(rowVals.map(f => `"${String(f).replace(/"/g,'""')}"`).join(','));
    }
    const csv = lines.join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `events-${new Date().toISOString().slice(0,10)}.csv`; document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
  };

  const allColumns: Column<Event>[] = useMemo(() => [
    { id: 'title', header: 'Title', sortable: true, className: 'font-medium text-(--hh-text)', accessor: (e) => (
      <Link href={`/events/${e.id}/attendees`} className="underline decoration-dotted underline-offset-4">{e.title}</Link>
    ) },
    { id: 'category', header: 'Category', field: 'category', sortable: true, className: 'text-(--hh-text-secondary)' },
    { id: 'city', header: 'City', field: 'city', sortable: true, className: 'text-(--hh-text-secondary)' },
    { id: 'start', header: 'Start', sortable: true, accessor: (e) => new Date(e.start_at).toLocaleString(), className: 'text-(--hh-text-secondary)' },
    { id: 'cab', header: 'Cab requests', sortable: true, accessor: (e) => (e.cab_opt_in_count ?? 0), className: 'text-(--hh-text-secondary)' },
    { id: 'status', header: 'Status', sortable: true, accessor: (e) => (
      <span className="rounded-full px-2 py-1 text-xs capitalize border border-(--hh-border) bg-[rgba(20,21,25,0.75)]">{e.status}</span>
    )},
    { id: 'actions', header: 'Actions', accessor: (e) => (
      <div className="flex gap-2">
        <Link href={`/events/${e.id}/attendees`} className="text-xs hh-btn-secondary">Attendees</Link>
        <button onClick={() => togglePublish(e)} className="text-xs hh-btn-secondary">{e.status === 'published' ? 'Unpublish' : 'Publish'}</button>
        <Link href={`/events/${e.id}`} className="text-xs hh-btn-secondary">Edit</Link>
        <button onClick={() => destroy(e)} className="text-xs hh-btn-secondary">Delete</button>
      </div>
    )},
  ], [togglePublish, destroy]);

  const columns = useMemo(() => allColumns.filter(c => visibleCols.includes(c.id) || c.id === 'actions'), [allColumns, visibleCols]);

  const toggleCol = (id: string) => {
    if (id === 'actions') return; // keep actions always
    setVisibleCols((prev) => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4 md:mb-6 relative">
        <h1 className="text-xl md:text-2xl font-semibold text-(--hh-text)">Events</h1>
        <div className="flex gap-2">
          <button onClick={() => setShowColsPanel((s)=>!s)} className="hh-btn-secondary text-sm">Columns</button>
          <button onClick={exportCsv} className="hh-btn-secondary text-sm">Export CSV</button>
          <Link href="/events/new" className="hh-btn-primary text-sm">New Event</Link>
        </div>
        {showColsPanel && (
          <div className="absolute right-0 top-full mt-2 z-10 hh-card p-3 w-56">
            <div className="text-(--hh-text-secondary) text-xs mb-2">Show columns</div>
            <div className="space-y-2 max-h-64 overflow-auto">
              {allColumns.filter(c=>c.id!=='actions').map((c) => (
                <label key={c.id} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" className="h-4 w-4" checked={visibleCols.includes(c.id)} onChange={() => toggleCol(c.id)} />
                  <span className="text-(--hh-text)">{c.header}</span>
                </label>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="hh-card p-3 md:p-4 mb-4">
        <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
          <input value={q} onChange={(e) => setQ(e.target.value)} className="hh-input px-3 py-2 text-sm md:col-span-2" placeholder="Search title, category, city" />
          <select value={status} onChange={(e)=>setStatus(e.target.value as any)} className="hh-input px-3 py-2 text-sm">
            <option value="all">All Statuses</option>
            <option value="draft">Draft</option>
            <option value="published">Published</option>
            <option value="archived">Archived</option>
          </select>
          <select value={category} onChange={(e)=>setCategory(e.target.value)} className="hh-input px-3 py-2 text-sm">
            <option value="all">All Categories</option>
            {uniqueCategories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <select value={city} onChange={(e)=>setCity(e.target.value)} className="hh-input px-3 py-2 text-sm">
            <option value="all">All Cities</option>
            {uniqueCities.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <div className="grid grid-cols-2 gap-2">
            <input type="date" value={from} onChange={(e)=>setFrom(e.target.value)} className="hh-input px-3 py-2 text-sm" />
            <input type="date" value={to} onChange={(e)=>setTo(e.target.value)} className="hh-input px-3 py-2 text-sm" />
          </div>
        </div>
      </div>

      {loading && <p className="text-(--hh-text-secondary)">Loading...</p>}
      {error && <p className="text-red-400">{error}</p>}
      {!loading && !error && (
        <>
          {/* Mobile Card View */}
          <div className="md:hidden space-y-4">
            {filtered.map((e) => (
              <div key={e.id} className="hh-card p-4 space-y-3">
                <div>
                  <Link href={`/events/${e.id}/attendees`} className="font-semibold text-(--hh-text) mb-1 underline decoration-dotted underline-offset-4">{e.title}</Link>
                  <div className="flex flex-wrap gap-2 text-xs text-(--hh-text-secondary)">
                    {e.category && <span>{e.category}</span>}
                    {e.city && <span>• {e.city}</span>}
                  </div>
                </div>
                <div className="text-sm text-(--hh-text-secondary)">{new Date(e.start_at).toLocaleString()}</div>
                <div className="flex items-center justify-between">
                  <span className="rounded-full px-2 py-1 text-xs capitalize border border-(--hh-border) bg-[rgba(20,21,25,0.75)]">{e.status}</span>
                  <div className="flex gap-2 items-center">
                    <Link href={`/events/${e.id}/attendees`} className="text-xs hh-btn-secondary px-3 py-1">Attendees</Link>
                    <span className="text-xs text-(--hh-text-tertiary)">Cabs: {e.cab_opt_in_count ?? 0}</span>
                    <button onClick={() => togglePublish(e)} className="text-xs hh-btn-secondary px-3 py-1">{e.status === 'published' ? 'Unpublish' : 'Publish'}</button>
                    <Link href={`/events/${e.id}`} className="text-xs hh-btn-secondary px-3 py-1">Edit</Link>
                    <button onClick={() => destroy(e)} className="text-xs hh-btn-secondary px-3 py-1">Delete</button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop DataTable */}
          <div className="hidden md:block">
            <DataTable data={filtered} columns={columns} emptyLabel="No events match your filters" />
          </div>
        </>
      )}
    </div>
  );
}


