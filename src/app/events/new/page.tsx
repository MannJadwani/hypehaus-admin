"use client";

import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { EventCreateSchema, type EventCreateInput } from '@/lib/validation';
import Link from 'next/link';
import { useState } from 'react';

const categories = ['Music', 'Tech', 'Comedy', 'Art', 'Sports'] as const;

export default function NewEventPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<EventCreateInput>({
    resolver: zodResolver(EventCreateSchema),
    defaultValues: {
      title: '',
      description: '',
      category: undefined,
      hero_image_url: '',
      start_at: '',
      end_at: '',
      venue_name: '',
      address_line: '',
      city: '',
      latitude: undefined,
      longitude: undefined,
      base_price_cents: 0,
      currency: 'INR',
      status: 'draft',
    },
  });

  const onSubmit = async (values: EventCreateInput) => {
    setError(null);
    const res = await fetch('/api/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(values),
    });
    if (res.ok) {
      const data = await res.json();
      router.push(`/events/${data.event.id}`);
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data?.error ?? 'Failed to create event');
    }
  };

  return (
    <div className="min-h-[70vh] flex items-center justify-center">
      <div className="w-full max-w-3xl">
        <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-semibold">New Event</h1>
        <Link href="/events" className="text-sm text-[var(--hh-text-secondary)] hover:text-[var(--hh-text)]">Back</Link>
        </div>
      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
      <form onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-1 gap-4 hh-card p-4">
        <div>
          <label className="block text-sm font-medium mb-1">Title</label>
          <input className="w-full hh-input px-3 py-2 text-sm" {...register('title')} />
          {errors.title && <p className="text-xs text-red-600">{errors.title.message}</p>}
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Description</label>
          <textarea className="w-full hh-input px-3 py-2 text-sm" rows={4} {...register('description')} />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Category</label>
            <select className="w-full hh-input px-3 py-2 text-sm" {...register('category')}>
              <option value="">Select...</option>
              {categories.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Hero Image URL</label>
            <input className="w-full hh-input px-3 py-2 text-sm" {...register('hero_image_url')} />
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Start At</label>
            <input type="datetime-local" className="w-full hh-input px-3 py-2 text-sm" {...register('start_at')} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">End At</label>
            <input type="datetime-local" className="w-full hh-input px-3 py-2 text-sm" {...register('end_at')} />
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Venue</label>
            <input className="w-full hh-input px-3 py-2 text-sm" {...register('venue_name')} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">City</label>
            <input className="w-full hh-input px-3 py-2 text-sm" {...register('city')} />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Address</label>
          <input className="w-full hh-input px-3 py-2 text-sm" {...register('address_line')} />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Latitude</label>
            <input type="number" step="0.000001" className="w-full hh-input px-3 py-2 text-sm" {...register('latitude', { valueAsNumber: true })} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Longitude</label>
            <input type="number" step="0.000001" className="w-full hh-input px-3 py-2 text-sm" {...register('longitude', { valueAsNumber: true })} />
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Base Price (cents)</label>
            <input type="number" className="w-full hh-input px-3 py-2 text-sm" {...register('base_price_cents', { valueAsNumber: true })} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Currency</label>
            <input className="w-full hh-input px-3 py-2 text-sm" {...register('currency')} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Status</label>
            <select className="w-full hh-input px-3 py-2 text-sm" {...register('status')}>
              <option value="draft">Draft</option>
              <option value="published">Published</option>
              <option value="archived">Archived</option>
            </select>
          </div>
        </div>
        <div className="flex gap-2">
          <button type="submit" disabled={isSubmitting} className="hh-btn-primary px-4 py-2 text-sm disabled:opacity-50">Create</button>
          <Link href="/events" className="hh-btn-secondary px-4 py-2 text-sm">Cancel</Link>
        </div>
      </form>
      </div>
    </div>
  );
}


