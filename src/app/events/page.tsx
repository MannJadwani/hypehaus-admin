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
    <div className="">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-semibold">Events</h1>
        <Link href="/events/new" className="hh-btn-primary text-sm">New Event</Link>
      </div>
      {loading && <p>Loading...</p>}
      {error && <p className="text-red-600">{error}</p>}
      {!loading && !error && (
        <div className="overflow-x-auto hh-card p-2">
          <table className="min-w-full text-sm">
            <thead className="text-left">
              <tr>
                <th className="px-3 py-2">Title</th>
                <th className="px-3 py-2">Category</th>
                <th className="px-3 py-2">City</th>
                <th className="px-3 py-2">Start</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {events.map((e) => (
                <tr key={e.id} className="hover:bg-[rgba(255,255,255,0.03)]">
                  <td className="px-3 py-2 font-medium">{e.title}</td>
                  <td className="px-3 py-2">{e.category ?? '-'}</td>
                  <td className="px-3 py-2">{e.city ?? '-'}</td>
                  <td className="px-3 py-2">{new Date(e.start_at).toLocaleString()}</td>
                  <td className="px-3 py-2">
                    <span className="rounded-full px-2 py-1 text-xs capitalize border border-[var(--hh-border)] bg-[rgba(20,21,25,0.75)]">{e.status}</span>
                  </td>
                  <td className="px-3 py-2 space-x-2">
                    <button onClick={() => togglePublish(e)} className="text-xs hh-btn-secondary">
                      {e.status === 'published' ? 'Unpublish' : 'Publish'}
                    </button>
                    <Link href={`/events/${e.id}`} className="text-xs hh-btn-secondary">Edit</Link>
                    <button onClick={() => destroy(e)} className="text-xs hh-btn-secondary">Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}


