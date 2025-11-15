"use client";

import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { EventCreateSchema, type EventCreateInput } from '@/lib/validation';
import Link from 'next/link';
import { useState, useEffect } from 'react';

const categories = ['Music', 'Tech', 'Comedy', 'Art', 'Sports'] as const;

export default function NewEventPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<{ role: 'admin' | 'moderator' } | null>(null);

  useEffect(() => {
    // Load current user role
    fetch('/api/admin/me')
      .then(res => res.json())
      .then(data => {
        if (data.admin) {
          setCurrentUser(data.admin);
          // Redirect moderators - only admins can create events
          if (data.admin.role !== 'admin') {
            router.push('/events');
          }
        }
      })
      .catch(() => {});
  }, [router]);

  const { register, handleSubmit, setValue, watch, formState: { errors, isSubmitting } } = useForm<EventCreateInput>({
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
      allow_cab: false,
    },
  });

  const heroUrl = watch('hero_image_url');

  const uploadHero = async (file: File) => {
    const fd = new FormData();
    fd.append('file', file);
    const res = await fetch('/api/upload', { method: 'POST', body: fd });
    if (res.ok) {
      const data = await res.json();
      setValue('hero_image_url', data.url, { shouldValidate: true, shouldDirty: true });
    }
  };

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
      setError(data?.error ?? 'Failed to create event. Only admins can create events.');
    }
  };

  // Show loading or redirect if not admin
  if (!currentUser) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-[var(--hh-text-secondary)]">Loading...</div>
      </div>
    );
  }

  if (currentUser.role !== 'admin') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-red-400">Unauthorized: Only admins can create events</div>
      </div>
    );
  }

  return (
    <div className="min-h-[70vh]">
      <div className="w-full max-w-3xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4 md:mb-6">
        <h1 className="text-xl md:text-2xl font-semibold text-[var(--hh-text)]">New Event</h1>
          <Link href="/events" className="text-sm text-[var(--hh-text-secondary)] hover:text-[var(--hh-text)] w-full sm:w-auto text-center sm:text-left">Back</Link>
        </div>
      {error && <p className="mb-3 text-sm text-red-400">{error}</p>}
      <form onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-1 gap-4 hh-card p-4 md:p-6">
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
            <label className="block text-sm font-medium mb-1">Hero Image</label>
            <div className="space-y-2">
              <input
                type="file"
                accept="image/*"
                className="w-full hh-input px-3 py-2 text-sm"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) uploadHero(f);
                }}
              />
              <input readOnly className="w-full hh-input px-3 py-2 text-sm" placeholder="Uploaded URL will appear here" {...register('hero_image_url')} />
              {heroUrl ? (
                <img src={heroUrl} alt="Hero preview" className="mt-1 h-28 w-full object-cover rounded-md border border-(--hh-border)" />
              ) : null}
            </div>
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
        <div>
          <label className="block text-sm font-medium mb-1">Offer cab option at checkout</label>
          <div className="flex items-center gap-2">
            <input type="checkbox" className="h-4 w-4" {...register('allow_cab')} />
            <span className="text-[var(--hh-text-secondary)] text-sm">Customers can request a cab when booking</span>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <button type="submit" disabled={isSubmitting} className="hh-btn-primary px-4 py-2 text-sm disabled:opacity-50 w-full sm:w-auto">Create</button>
          <Link href="/events" className="hh-btn-secondary px-4 py-2 text-sm w-full sm:w-auto text-center">Cancel</Link>
        </div>
      </form>
      </div>
    </div>
  );
}


