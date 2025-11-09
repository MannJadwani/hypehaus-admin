"use client";

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { EventUpdateSchema, type EventUpdateInput, TierCreateSchema, ImageCreateSchema } from '@/lib/validation';
import Link from 'next/link';

type Tier = {
  id: string;
  name: string;
  price_cents: number;
  currency: string;
  total_quantity: number;
  sold_quantity: number;
};

type Image = {
  id: string;
  url: string;
  position: number;
};

type EventDetail = {
  id: string;
  title: string;
  description: string | null;
  category: string | null;
  hero_image_url: string | null;
  start_at: string;
  end_at: string | null;
  venue_name: string | null;
  address_line: string | null;
  city: string | null;
  latitude: number | null;
  longitude: number | null;
  base_price_cents: number | null;
  currency: string | null;
  status: 'draft' | 'published' | 'archived';
};

const categories = ['Music', 'Tech', 'Comedy', 'Art', 'Sports'] as const;

export default function EditEventPage() {
  const params = useParams<{ id: string }>();
  const eventId = params.id;
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [event, setEvent] = useState<EventDetail | null>(null);
  const [tiers, setTiers] = useState<Tier[]>([]);
  const [images, setImages] = useState<Image[]>([]);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<EventUpdateInput>({ resolver: zodResolver(EventUpdateSchema) });

  const tierForm = useForm<z.input<typeof TierCreateSchema>>({
    resolver: zodResolver(TierCreateSchema),
    defaultValues: { name: '', price_cents: 0, currency: 'INR', total_quantity: 0 },
  });

  const imageForm = useForm<z.input<typeof ImageCreateSchema>>({
    resolver: zodResolver(ImageCreateSchema),
    defaultValues: { url: '', position: undefined },
  });

  const load = async () => {
    setLoading(true);
    setError(null);
    const res = await fetch(`/api/events/${eventId}`, { cache: 'no-store' });
    if (!res.ok) {
      setError('Failed to load event');
      setLoading(false);
      return;
    }
    const data = await res.json();
    setEvent(data.event);
    setTiers(data.tiers);
    setImages(data.images);
    reset({
      title: data.event.title,
      description: data.event.description ?? '',
      category: data.event.category ?? undefined,
      hero_image_url: data.event.hero_image_url ?? '',
      start_at: data.event.start_at?.slice(0, 16),
      end_at: data.event.end_at ? data.event.end_at.slice(0, 16) : '',
      venue_name: data.event.venue_name ?? '',
      address_line: data.event.address_line ?? '',
      city: data.event.city ?? '',
      latitude: data.event.latitude ?? undefined,
      longitude: data.event.longitude ?? undefined,
      base_price_cents: data.event.base_price_cents ?? 0,
      currency: data.event.currency ?? 'INR',
      status: data.event.status,
    });
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId]);

  const onSubmit = async (values: EventUpdateInput) => {
    setError(null);
    const res = await fetch(`/api/events/${eventId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(values),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data?.error ?? 'Update failed');
      return;
    }
    await load();
  };

  const addTier = async (values: z.input<typeof TierCreateSchema>) => {
    const res = await fetch(`/api/events/${eventId}/tiers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(values),
    });
    if (res.ok) {
      tierForm.reset();
      await load();
    }
  };

  const deleteTier = async (tierId: string) => {
    await fetch(`/api/tiers/${tierId}`, { method: 'DELETE' });
    await load();
  };

  const addImage = async (values: z.input<typeof ImageCreateSchema>) => {
    const res = await fetch(`/api/events/${eventId}/images`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(values),
    });
    if (res.ok) {
      imageForm.reset();
      await load();
    }
  };

  const uploadImage = async (file: File, position?: number) => {
    const fd = new FormData();
    fd.append('file', file);
    fd.append('event_id', eventId);
    if (typeof position === 'number') fd.append('position', String(position));
    const res = await fetch('/api/upload', { method: 'POST', body: fd });
    if (res.ok) {
      await load();
    }
  };

  const uploadHero = async (file: File) => {
    const fd = new FormData();
    fd.append('file', file);
    fd.append('event_id', eventId);
    const res = await fetch('/api/upload', { method: 'POST', body: fd });
    if (res.ok) {
      const data = await res.json();
      await fetch(`/api/events/${eventId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hero_image_url: data.url }),
      });
      await load();
    }
  };

  const moveImage = async (index: number, direction: -1 | 1) => {
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= images.length) return;
    const current = images[index];
    const target = images[newIndex];
    // swap positions
    await Promise.all([
      fetch(`/api/images/${current.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ position: target.position }),
      }),
      fetch(`/api/images/${target.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ position: current.position }),
      }),
    ]);
    await load();
  };

  const deleteImage = async (imageId: string) => {
    await fetch(`/api/images/${imageId}`, { method: 'DELETE' });
    await load();
  };

  if (loading) return <div>Loading...</div>;
  if (error) return <div className="text-red-600">{error}</div>;
  if (!event) return <div>Not found</div>;

  return (
    <div className="max-w-4xl">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4 md:mb-6">
        <h1 className="text-xl md:text-2xl font-semibold text-[var(--hh-text)]">Edit Event</h1>
        <div className="flex gap-2">
          <Link href={`/events/${eventId}/attendees`} className="hh-btn-secondary text-sm">View Attendees</Link>
          <Link href="/events" className="text-sm text-[var(--hh-text-secondary)] hover:text-[var(--hh-text)] w-full sm:w-auto text-center sm:text-left">Back</Link>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-1 gap-4 mb-6 md:mb-8 hh-card p-4 md:p-6">
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
              <input className="w-full hh-input px-3 py-2 text-sm" {...register('hero_image_url')} />
              {event.hero_image_url ? (
                <img src={event.hero_image_url} alt="Hero preview" className="mt-1 h-28 w-full object-cover rounded-md border border-(--hh-border)" />
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
          <button type="submit" disabled={isSubmitting} className="hh-btn-primary px-4 py-2 text-sm disabled:opacity-50 w-full sm:w-auto">Save</button>
          <Link href="/events" className="hh-btn-secondary px-4 py-2 text-sm w-full sm:w-auto text-center">Back</Link>
        </div>
      </form>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-8">
        <section>
          <h2 className="text-base md:text-lg font-semibold mb-3 md:mb-4 text-[var(--hh-text)]">Ticket Tiers</h2>
          <div className="space-y-2 mb-4">
            {tiers.map((t) => (
              <div key={t.id} className="flex items-center justify-between hh-card p-3">
                <div className="text-sm">
                  <div className="font-medium">{t.name}</div>
                  <div className="text-gray-600">{t.currency} {t.price_cents} • Qty {t.total_quantity} • Sold {t.sold_quantity}</div>
                </div>
                <button onClick={() => deleteTier(t.id)} className="text-xs hh-btn-secondary">Delete</button>
              </div>
            ))}
            {tiers.length === 0 && <p className="text-sm text-gray-600">No tiers yet.</p>}
          </div>
          <form onSubmit={tierForm.handleSubmit(addTier)} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input placeholder="Name" className="hh-input px-3 py-2 text-sm col-span-1 sm:col-span-2" {...tierForm.register('name')} />
            <input type="number" placeholder="Price (cents)" className="hh-input px-3 py-2 text-sm" {...tierForm.register('price_cents', { valueAsNumber: true })} />
            <input placeholder="Currency" className="hh-input px-3 py-2 text-sm" {...tierForm.register('currency')} />
            <input type="number" placeholder="Total Qty" className="hh-input px-3 py-2 text-sm" {...tierForm.register('total_quantity', { valueAsNumber: true })} />
            <button className="hh-btn-primary px-3 py-2 text-sm col-span-1 sm:col-span-2 w-full sm:w-auto">Add Tier</button>
          </form>
        </section>

        <section>
          <h2 className="text-base md:text-lg font-semibold mb-3 md:mb-4 text-[var(--hh-text)]">Images</h2>
          <div className="space-y-2 mb-4">
            {images.map((img, idx) => (
              <div key={img.id} className="flex items-center justify-between hh-card p-3">
                <div className="text-sm break-all max-w-[70%]">
                  <div className="font-medium">Position {img.position}</div>
                  <div className="text-gray-600">{img.url}</div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => moveImage(idx, -1)} className="text-xs hh-btn-secondary">Up</button>
                  <button onClick={() => moveImage(idx, 1)} className="text-xs hh-btn-secondary">Down</button>
                  <button onClick={() => deleteImage(img.id)} className="text-xs hh-btn-secondary">Delete</button>
                </div>
              </div>
            ))}
            {images.length === 0 && <p className="text-sm text-gray-600">No images yet.</p>}
          </div>
          <form onSubmit={imageForm.handleSubmit(addImage)} className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <input placeholder="Image URL" className="hh-input px-3 py-2 text-sm col-span-1 sm:col-span-2" {...imageForm.register('url')} />
            <input type="number" placeholder="Position" className="hh-input px-3 py-2 text-sm" {...imageForm.register('position', { valueAsNumber: true })} />
            <button className="hh-btn-primary px-3 py-2 text-sm col-span-1 sm:col-span-3 w-full sm:w-auto">Add Image</button>
          </form>

          <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-3 items-center">
            <input type="file" accept="image/*" className="col-span-1 sm:col-span-2 hh-input px-3 py-2 text-sm"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) uploadImage(f);
              }}
            />
            <button onClick={(e) => {
              e.preventDefault();
              const input = (e.currentTarget.previousSibling as HTMLInputElement);
              input?.click?.();
            }} className="hh-btn-secondary px-3 py-2 text-sm">Upload</button>
          </div>
        </section>
      </div>
    </div>
  );
}


