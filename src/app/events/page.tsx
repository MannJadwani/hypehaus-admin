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
  const [currentUser, setCurrentUser] = useState<{ role: 'admin' | 'moderator' } | null>(null);

  // Filters
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<'all'|'draft'|'published'|'archived'>('all');
  const [category, setCategory] = useState<string>('all');
  const [city, setCity] = useState<string>('all');
  const [from, setFrom] = useState<string>('');
  const [to, setTo] = useState<string>('');

  // Column visibility
  const defaultVisible = ['title','category','city','start','status','actions'] as const;
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

  useEffect(() => {
    // Load current user role
    fetch('/api/admin/me')
      .then(res => res.json())
      .then(data => {
        if (data.admin) {
          setCurrentUser(data.admin);
        }
      })
      .catch(() => {});
  }, []);

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
    const res = await fetch(`/api/events/${event.id}`, { method: 'DELETE' });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      alert(data?.error || 'Failed to delete event. Only admins can delete events.');
      return;
    }
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
    { id: 'title', header: 'Event', sortable: true, className: 'font-medium text-(--hh-text) min-w-[200px]', accessor: (e) => (
      <div className="flex flex-col">
        <Link href={`/events/${e.id}/attendees`} className="hover:text-(--hh-primary) transition-colors font-semibold">{e.title}</Link>
        <span className="text-xs text-(--hh-text-tertiary)">ID: {e.id.slice(0,8)}...</span>
      </div>
    ) },
    { id: 'category', header: 'Category', field: 'category', sortable: true, className: 'text-(--hh-text-secondary)' },
    { id: 'city', header: 'Location', field: 'city', sortable: true, className: 'text-(--hh-text-secondary)', accessor: (e) => (
        <div className="flex items-center gap-1">
            <svg className="w-3 h-3 text-(--hh-text-tertiary)" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            {e.city || 'N/A'}
        </div>
    ) },
    { id: 'start', header: 'Date & Time', sortable: true, className: 'text-(--hh-text-secondary)', accessor: (e) => (
      <div className="flex flex-col">
        <span className="text-sm">{new Date(e.start_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</span>
        <span className="text-xs text-(--hh-text-tertiary)">{new Date(e.start_at).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}</span>
      </div>
    ) },
    { id: 'cab', header: 'Cabs', sortable: true, accessor: (e) => (e.cab_opt_in_count ?? 0), className: 'text-(--hh-text-secondary)' },
    { id: 'status', header: 'Status', sortable: true, accessor: (e) => (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${
        e.status === 'published' 
          ? 'bg-green-500/10 text-green-400 border-green-500/20' 
          : e.status === 'archived'
            ? 'bg-[var(--hh-bg-elevated)] text-[var(--hh-text-tertiary)] border-[var(--hh-border)]'
            : 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20'
      }`}>
        <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${
             e.status === 'published' ? 'bg-green-400' : e.status === 'archived' ? 'bg-[var(--hh-text-tertiary)]' : 'bg-yellow-400'
        }`}></span>
        {e.status.charAt(0).toUpperCase() + e.status.slice(1)}
      </span>
    )},
    { id: 'actions', header: '', className: 'w-[50px]', accessor: (e) => (
      <div className="flex items-center justify-end gap-2">
        <Link href={`/events/${e.id}/attendees`} className="p-2 hover:bg-[var(--hh-bg-elevated)] rounded-lg text-[var(--hh-text-secondary)] transition-colors" title="View Attendees">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
        </Link>
        <button onClick={() => togglePublish(e)} className={`p-2 hover:bg-[var(--hh-bg-elevated)] rounded-lg transition-colors ${e.status === 'published' ? 'text-green-400' : 'text-[var(--hh-text-secondary)]'}`} title={e.status === 'published' ? 'Unpublish' : 'Publish'}>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={e.status === 'published' ? "M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" : "M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"} />
            </svg>
        </button>
        <Link href={`/events/${e.id}`} className="p-2 hover:bg-[var(--hh-bg-elevated)] rounded-lg text-[var(--hh-text-secondary)] transition-colors" title="Edit Event">
             <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
        </Link>
        {currentUser?.role === 'admin' && (
          <button onClick={() => destroy(e)} className="p-2 hover:bg-red-500/10 rounded-lg text-[var(--hh-text-secondary)] hover:text-red-400 transition-colors" title="Delete Event">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        )}
      </div>
    )},
  ], [togglePublish, destroy, currentUser]);

  const columns = useMemo(() => allColumns.filter(c => visibleCols.includes(c.id) || c.id === 'actions'), [allColumns, visibleCols]);

  const toggleCol = (id: string) => {
    if (id === 'actions') return; // keep actions always
    setVisibleCols((prev) => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  return (
    <div>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-[var(--hh-text)] tracking-tight">Events</h1>
          <p className="text-[var(--hh-text-secondary)] mt-1">Manage your event listings and attendees.</p>
        </div>
        <div className="flex flex-wrap gap-3">
            <div className="relative">
                <button 
                    onClick={() => setShowColsPanel((s)=>!s)} 
                    className="hh-btn-secondary flex items-center gap-2 text-sm"
                >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
                    </svg>
                    Columns
                </button>
        {showColsPanel && (
                <>
                    <div className="fixed inset-0 z-10" onClick={() => setShowColsPanel(false)}></div>
                    <div className="absolute right-0 top-full mt-2 z-20 hh-card p-4 w-64 shadow-xl shadow-black/50 animate-in fade-in zoom-in-95 duration-100">
                        <div className="text-[var(--hh-text)] font-medium text-sm mb-3">Visible Columns</div>
                        <div className="space-y-2">
              {allColumns.filter(c=>c.id!=='actions').map((c) => (
                            <label key={c.id} className="flex items-center gap-3 text-sm p-2 hover:bg-[var(--hh-bg-elevated)] rounded-lg cursor-pointer transition-colors">
                            <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${visibleCols.includes(c.id) ? 'bg-[var(--hh-primary)] border-[var(--hh-primary)]' : 'border-[var(--hh-text-tertiary)]'}`}>
                                {visibleCols.includes(c.id) && (
                                    <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                    </svg>
                                )}
                            </div>
                            <input type="checkbox" className="hidden" checked={visibleCols.includes(c.id)} onChange={() => toggleCol(c.id)} />
                            <span className="text-[var(--hh-text-secondary)]">{c.header}</span>
                </label>
              ))}
            </div>
          </div>
                </>
        )}
            </div>
          <button onClick={exportCsv} className="hh-btn-secondary flex items-center gap-2 text-sm">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Export CSV
          </button>
          {currentUser?.role === 'admin' && (
            <Link href="/events/new" className="hh-btn-primary flex items-center gap-2 text-sm">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                New Event
            </Link>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="hh-card p-4 md:p-5 mb-6 space-y-4">
        <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <svg className="h-5 w-5 text-[var(--hh-text-tertiary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                </div>
                <input 
                    value={q} 
                    onChange={(e) => setQ(e.target.value)} 
                    className="hh-input w-full pl-10" 
                    placeholder="Search events by title, category, or city..." 
                />
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
                <select value={status} onChange={(e)=>setStatus(e.target.value as any)} className="hh-input min-w-[140px]">
                    <option value="all">Status: All</option>
            <option value="draft">Draft</option>
            <option value="published">Published</option>
            <option value="archived">Archived</option>
          </select>
                <select value={category} onChange={(e)=>setCategory(e.target.value)} className="hh-input min-w-[140px]">
                    <option value="all">Category: All</option>
            {uniqueCategories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
            </div>
        </div>
        
        <div className="flex flex-wrap gap-3 pt-3 border-t border-[var(--hh-border)]">
             <div className="flex items-center gap-2 text-sm text-[var(--hh-text-secondary)]">
                <svg className="w-4 h-4 text-[var(--hh-text-tertiary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                </svg>
                <span>More Filters:</span>
             </div>
             <select value={city} onChange={(e)=>setCity(e.target.value)} className="hh-input py-1.5 text-sm min-w-[120px]">
                <option value="all">City: All</option>
            {uniqueCities.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
            <div className="flex items-center gap-2 bg-[var(--hh-bg-input)] border border-[var(--hh-border)] rounded-xl px-3 py-1.5">
                <span className="text-xs text-[var(--hh-text-tertiary)] uppercase font-bold">From</span>
                <input type="date" value={from} onChange={(e)=>setFrom(e.target.value)} className="bg-transparent text-sm text-[var(--hh-text)] outline-none w-[110px] appearance-none" />
            </div>
            <div className="flex items-center gap-2 bg-[var(--hh-bg-input)] border border-[var(--hh-border)] rounded-xl px-3 py-1.5">
                <span className="text-xs text-[var(--hh-text-tertiary)] uppercase font-bold">To</span>
                <input type="date" value={to} onChange={(e)=>setTo(e.target.value)} className="bg-transparent text-sm text-[var(--hh-text)] outline-none w-[110px] appearance-none" />
          </div>
            {(q || status !== 'all' || category !== 'all' || city !== 'all' || from || to) && (
                <button 
                    onClick={() => {
                        setQ(''); setStatus('all'); setCategory('all'); setCity('all'); setFrom(''); setTo('');
                    }}
                    className="text-sm text-red-400 hover:text-red-300 ml-auto flex items-center gap-1 px-2 py-1 rounded hover:bg-red-400/10 transition-colors"
                >
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                    Clear Filters
                </button>
            )}
        </div>
      </div>

      {loading && (
        <div className="flex flex-col items-center justify-center py-20">
            <div className="w-10 h-10 border-2 border-[var(--hh-primary)] border-t-transparent rounded-full animate-spin mb-4"></div>
            <p className="text-[var(--hh-text-secondary)]">Loading events...</p>
        </div>
      )}
      
      {error && (
          <div className="p-6 bg-red-500/10 border border-red-500/20 rounded-2xl text-center">
              <p className="text-red-400 font-medium mb-2">Error Loading Data</p>
              <p className="text-sm text-red-400/80">{error}</p>
              <button onClick={load} className="mt-4 hh-btn-secondary text-sm">Try Again</button>
          </div>
      )}
      
      {!loading && !error && (
        <>
          {/* Mobile Card View */}
          <div className="md:hidden space-y-4">
            {filtered.length === 0 ? (
                <div className="text-center py-12 bg-[var(--hh-bg-card)] rounded-2xl border border-[var(--hh-border)]">
                    <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-[var(--hh-bg-elevated)] mb-3">
                        <svg className="w-6 h-6 text-[var(--hh-text-tertiary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                  </div>
                    <h3 className="text-[var(--hh-text)] font-medium">No events found</h3>
                    <p className="text-[var(--hh-text-secondary)] text-sm mt-1">Try adjusting your search or filters</p>
                </div>
            ) : (
                filtered.map((e) => (
                <div key={e.id} className="hh-card p-4 space-y-3">
                    <div className="flex justify-between items-start">
                        <div>
                            <Link href={`/events/${e.id}/attendees`} className="font-semibold text-[var(--hh-text)] mb-1 block text-lg">{e.title}</Link>
                            <div className="flex flex-wrap gap-2 text-xs text-[var(--hh-text-secondary)] mt-1">
                                <span className="bg-[var(--hh-bg-elevated)] px-2 py-0.5 rounded border border-[var(--hh-border)]">{e.category || 'Uncategorized'}</span>
                                {e.city && <span className="bg-[var(--hh-bg-elevated)] px-2 py-0.5 rounded border border-[var(--hh-border)]">{e.city}</span>}
                            </div>
                        </div>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${
                            e.status === 'published' 
                            ? 'bg-green-500/10 text-green-400 border-green-500/20' 
                            : e.status === 'archived'
                                ? 'bg-[var(--hh-bg-elevated)] text-[var(--hh-text-tertiary)] border-[var(--hh-border)]'
                                : 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20'
                        }`}>
                            {e.status}
                        </span>
                    </div>
                    
                    <div className="flex items-center gap-4 text-sm text-[var(--hh-text-secondary)] py-2 border-y border-[var(--hh-border)] border-dashed">
                        <div className="flex items-center gap-1.5">
                            <svg className="w-4 h-4 text-[var(--hh-text-tertiary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            {new Date(e.start_at).toLocaleDateString()}
                        </div>
                        <div className="flex items-center gap-1.5">
                             <svg className="w-4 h-4 text-[var(--hh-text-tertiary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            {new Date(e.start_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                    </div>

                    <div className="flex items-center justify-between pt-1">
                        <div className="flex gap-2">
                            <button onClick={() => togglePublish(e)} className="p-2 rounded-lg bg-[var(--hh-bg-elevated)] text-[var(--hh-text)] border border-[var(--hh-border)]">
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                     <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={e.status === 'published' ? "M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" : "M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"} />
                                </svg>
                            </button>
                            <Link href={`/events/${e.id}`} className="p-2 rounded-lg bg-[var(--hh-bg-elevated)] text-[var(--hh-text)] border border-[var(--hh-border)]">
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                </svg>
                            </Link>
                    {currentUser?.role === 'admin' && (
                                <button onClick={() => destroy(e)} className="p-2 rounded-lg bg-red-500/10 text-red-400 border border-red-500/20">
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                    </svg>
                                </button>
                    )}
                        </div>
                        <Link href={`/events/${e.id}/attendees`} className="hh-btn-primary text-xs px-4 py-2">View Attendees</Link>
                  </div>
                </div>
                ))
            )}
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
