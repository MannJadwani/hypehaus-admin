"use client";

import Link from 'next/link';
import { useEffect, useState } from 'react';

type Event = {
  id: string;
  title: string;
  category: string | null;
  city: string | null;
  start_at: string;
  status: 'draft' | 'published' | 'archived';
};

export default function EventsPage() {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  useEffect(() => {
    load();
  }, []);

  const togglePublish = async (event: Event) => {
    const next = event.status === 'published' ? 'draft' : 'published';
    await fetch(`/api/events/${event.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: next }),
    });
    await load();
  };

  const destroy = async (event: Event) => {
    if (!confirm(`Delete event "${event.title}"?`)) return;
    await fetch(`/api/events/${event.id}`, { method: 'DELETE' });
    await load();
  };

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4 md:mb-6">
        <h1 className="text-xl md:text-2xl font-semibold text-[var(--hh-text)]">Events</h1>
        <Link href="/events/new" className="hh-btn-primary text-sm w-full sm:w-auto text-center">New Event</Link>
      </div>
      {loading && <p className="text-[var(--hh-text-secondary)]">Loading...</p>}
      {error && <p className="text-red-400">{error}</p>}
      {!loading && !error && (
        <>
          {/* Mobile Card View */}
          <div className="md:hidden space-y-4">
            {events.map((e) => (
              <div key={e.id} className="hh-card p-4 space-y-3">
                <div>
                  <h3 className="font-semibold text-[var(--hh-text)] mb-1">{e.title}</h3>
                  <div className="flex flex-wrap gap-2 text-xs text-[var(--hh-text-secondary)]">
                    {e.category && <span>{e.category}</span>}
                    {e.city && <span>• {e.city}</span>}
                  </div>
                </div>
                <div className="text-sm text-[var(--hh-text-secondary)]">
                  {new Date(e.start_at).toLocaleString()}
                </div>
                <div className="flex items-center justify-between">
                  <span className="rounded-full px-2 py-1 text-xs capitalize border border-[var(--hh-border)] bg-[rgba(20,21,25,0.75)]">
                    {e.status}
                  </span>
                  <div className="flex gap-2">
                    <button onClick={() => togglePublish(e)} className="text-xs hh-btn-secondary px-3 py-1">
                      {e.status === 'published' ? 'Unpublish' : 'Publish'}
                    </button>
                    <Link href={`/events/${e.id}`} className="text-xs hh-btn-secondary px-3 py-1">Edit</Link>
                    <button onClick={() => destroy(e)} className="text-xs hh-btn-secondary px-3 py-1">Delete</button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop Table View */}
          <div className="hidden md:block overflow-x-auto hh-card p-2">
            <table className="min-w-full text-sm">
              <thead className="text-left">
                <tr>
                  <th className="px-3 py-2 text-[var(--hh-text-secondary)]">Title</th>
                  <th className="px-3 py-2 text-[var(--hh-text-secondary)]">Category</th>
                  <th className="px-3 py-2 text-[var(--hh-text-secondary)]">City</th>
                  <th className="px-3 py-2 text-[var(--hh-text-secondary)]">Start</th>
                  <th className="px-3 py-2 text-[var(--hh-text-secondary)]">Status</th>
                  <th className="px-3 py-2 text-[var(--hh-text-secondary)]">Actions</th>
                </tr>
              </thead>
              <tbody>
                {events.map((e) => (
                  <tr key={e.id} className="hover:bg-[rgba(255,255,255,0.03)]">
                    <td className="px-3 py-2 font-medium text-[var(--hh-text)]">{e.title}</td>
                    <td className="px-3 py-2 text-[var(--hh-text-secondary)]">{e.category ?? '-'}</td>
                    <td className="px-3 py-2 text-[var(--hh-text-secondary)]">{e.city ?? '-'}</td>
                    <td className="px-3 py-2 text-[var(--hh-text-secondary)]">{new Date(e.start_at).toLocaleString()}</td>
                    <td className="px-3 py-2">
                      <span className="rounded-full px-2 py-1 text-xs capitalize border border-[var(--hh-border)] bg-[rgba(20,21,25,0.75)]">
                        {e.status}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex gap-2">
                        <button onClick={() => togglePublish(e)} className="text-xs hh-btn-secondary">
                          {e.status === 'published' ? 'Unpublish' : 'Publish'}
                        </button>
                        <Link href={`/events/${e.id}`} className="text-xs hh-btn-secondary">Edit</Link>
                        <button onClick={() => destroy(e)} className="text-xs hh-btn-secondary">Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}


