"use client";

import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { AdCreateSchema, AdUpdateSchema, type AdCreateInput, type AdUpdateInput } from '@/lib/validation';

type Role = 'admin' | 'moderator' | 'vendor' | 'vendor_moderator';

type EventOption = {
  id: string;
  title: string;
  start_at: string | null;
  status: 'draft' | 'published' | 'archived';
};

type Ad = {
  id: string;
  vendor_id: string | null;
  created_by: string | null;
  status: 'pending' | 'approved' | 'rejected' | 'paused';
  placement: 'home_feed';
  title: string;
  subtitle: string | null;
  image_url: string;
  cta_text: string;
  event_id: string | null;
  target_url: string | null;
  start_at: string;
  end_at: string | null;
  priority: number;
  created_at: string;
  updated_at: string;
};

const toDatetimeLocal = (iso?: string | null) => {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  const yyyy = d.getFullYear();
  const mm = pad(d.getMonth() + 1);
  const dd = pad(d.getDate());
  const hh = pad(d.getHours());
  const min = pad(d.getMinutes());
  return `${yyyy}-${mm}-${dd}T${hh}:${min}`;
};

const fromDatetimeLocalToIso = (v?: string) => {
  if (!v) return undefined;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return undefined;
  return d.toISOString();
};

export default function AdsPage() {
  const [currentUser, setCurrentUser] = useState<{ role: Role; id?: string } | null>(null);
  const [ads, setAds] = useState<Ad[]>([]);
  const [vendors, setVendors] = useState<{ id: string; email: string }[]>([]);
  const [eventOptions, setEventOptions] = useState<EventOption[]>([]);
  const [eventOptionsLoading, setEventOptionsLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [q, setQ] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | Ad['status']>('all');

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingAd, setEditingAd] = useState<Ad | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const [createEventSearch, setCreateEventSearch] = useState('');
  const [editEventSearch, setEditEventSearch] = useState('');

  useEffect(() => {
    fetch('/api/admin/me')
      .then((res) => res.json())
      .then((data) => {
        if (!data.admin) return;
        setCurrentUser(data.admin);
        if (data.admin.role === 'vendor_moderator') {
          window.location.href = '/events';
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (currentUser?.role !== 'admin') return;
    fetch('/api/admin/vendors')
      .then((res) => res.json())
      .then((data) => setVendors(data.vendors ?? []))
      .catch(() => {});
  }, [currentUser?.role]);

  const loadEventOptions = async () => {
    // /api/events is already vendor-scoped for vendor roles
    try {
      setEventOptionsLoading(true);
      const res = await fetch('/api/events/options', { cache: 'no-store' });
      if (!res.ok) return;
      const data = await res.json().catch(() => ({}));
      const events = (data.events ?? []) as any[];
      const mapped: EventOption[] = events.map((e) => ({
        id: e.id,
        title: e.title,
        start_at: e.start_at ?? null,
        status: e.status,
      }));
      setEventOptions(mapped);
    } catch {
      // ignore
    } finally {
      setEventOptionsLoading(false);
    }
  };

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/ads', { cache: 'no-store' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data?.error || 'Failed to load ads');
        setLoading(false);
        return;
      }
      const data = await res.json();
      setAds(data.ads ?? []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load ads');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!currentUser) return;
    load();
  }, [currentUser]);

  const createForm = useForm<AdCreateInput>({
    resolver: zodResolver(AdCreateSchema),
    defaultValues: {
      placement: 'home_feed',
      title: '',
      subtitle: undefined,
      image_url: '',
      cta_text: 'Learn more',
      target_url: undefined,
      event_id: undefined,
      start_at: undefined,
      end_at: undefined,
      priority: 0,
      vendor_id: undefined,
      status: 'pending',
    },
  });

  const updateForm = useForm<AdUpdateInput>({
    resolver: zodResolver(AdUpdateSchema),
  });

  const createEventId = createForm.watch('event_id');
  const createTargetUrl = createForm.watch('target_url');
  const editEventId = updateForm.watch('event_id');
  const editTargetUrl = updateForm.watch('target_url');

  const filtered = useMemo(() => {
    let rows = ads.slice();
    if (q.trim()) {
      const s = q.trim().toLowerCase();
      rows = rows.filter((a) => a.title.toLowerCase().includes(s) || (a.subtitle ?? '').toLowerCase().includes(s));
    }
    if (statusFilter !== 'all') rows = rows.filter((a) => a.status === statusFilter);
    return rows;
  }, [ads, q, statusFilter]);

  const vendorEmailById = useMemo(() => {
    const map = new Map<string, string>();
    for (const v of vendors) map.set(v.id, v.email);
    return map;
  }, [vendors]);

  const uploadImage = async (file: File) => {
    const form = new FormData();
    form.append('file', file);
    const res = await fetch('/api/upload', { method: 'POST', body: form });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.error || 'Image upload failed');
    return data.url as string;
  };

  const visibleCreateEvents = useMemo(() => {
    const s = createEventSearch.trim().toLowerCase();
    if (!s) return eventOptions;
    return eventOptions.filter((e) => e.title.toLowerCase().includes(s));
  }, [createEventSearch, eventOptions]);

  const visibleEditEvents = useMemo(() => {
    const s = editEventSearch.trim().toLowerCase();
    if (!s) return eventOptions;
    return eventOptions.filter((e) => e.title.toLowerCase().includes(s));
  }, [editEventSearch, eventOptions]);

  useEffect(() => {
    if (!showCreateModal) return;
    loadEventOptions();
    setCreateEventSearch('');
  }, [showCreateModal]);

  useEffect(() => {
    if (!editingAd) return;
    loadEventOptions();
    setEditEventSearch('');
  }, [editingAd?.id]);

  const onCreate = async (values: AdCreateInput) => {
    const payload: Record<string, unknown> = { ...values };
    const startIso = typeof values.start_at === 'string' ? fromDatetimeLocalToIso(values.start_at) : undefined;
    const endIso = typeof values.end_at === 'string' ? fromDatetimeLocalToIso(values.end_at) : undefined;
    if (startIso) payload.start_at = startIso;
    if (endIso) payload.end_at = endIso;
    if (values.start_at === '' || values.start_at === undefined) delete payload.start_at;
    if (values.end_at === '' || values.end_at === undefined) delete payload.end_at;

    if (currentUser?.role === 'vendor') {
      delete payload.vendor_id;
      delete payload.status;
    }

    try {
      const res = await fetch('/api/ads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(data?.error || 'Failed to create ad');
        return;
      }
      createForm.reset();
      setShowCreateModal(false);
      await load();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Failed to create ad');
    }
  };

  const startEdit = (ad: Ad) => {
    setEditingAd(ad);
    updateForm.reset({
      title: ad.title,
      subtitle: ad.subtitle ?? undefined,
      image_url: ad.image_url,
      cta_text: ad.cta_text,
      target_url: ad.target_url ?? undefined,
      event_id: ad.event_id ?? undefined,
      placement: ad.placement,
      status: ad.status,
      vendor_id: ad.vendor_id ?? undefined,
      start_at: toDatetimeLocal(ad.start_at),
      end_at: toDatetimeLocal(ad.end_at),
      priority: ad.priority,
    });
  };

  const onUpdate = async (values: AdUpdateInput) => {
    if (!editingAd) return;

    const payload: Record<string, unknown> = { ...values };
    if (typeof values.start_at === 'string') {
      if (!values.start_at) {
        delete payload.start_at;
      } else {
        payload.start_at = fromDatetimeLocalToIso(values.start_at) ?? values.start_at;
      }
    }
    if (typeof values.end_at === 'string') {
      if (!values.end_at) {
        payload.end_at = null;
      } else {
        payload.end_at = fromDatetimeLocalToIso(values.end_at) ?? values.end_at;
      }
    }
    if (values.end_at === '') payload.end_at = null;

    if (currentUser?.role === 'vendor') {
      delete payload.vendor_id;
      delete payload.status;
    }

    try {
      const res = await fetch(`/api/ads/${editingAd.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(data?.error || 'Failed to update ad');
        return;
      }
      updateForm.reset();
      setEditingAd(null);
      await load();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Failed to update ad');
    }
  };

  const setStatus = async (ad: Ad, status: Ad['status']) => {
    const res = await fetch(`/api/ads/${ad.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      alert(data?.error || 'Failed to update status');
      return;
    }
    await load();
  };

  const onDelete = async (id: string) => {
    const res = await fetch(`/api/ads/${id}`, { method: 'DELETE' });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      alert(data?.error || 'Failed to delete ad');
      return;
    }
    setDeleteConfirm(null);
    await load();
  };

  if (loading || !currentUser) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-[var(--hh-primary)] border-t-transparent rounded-full animate-spin"></div>
          <p className="text-[var(--hh-text-secondary)]">Loading ads...</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-[var(--hh-text)] tracking-tight">Ads</h1>
          <p className="text-[var(--hh-text-secondary)] mt-1">
            {currentUser.role === 'admin'
              ? 'Approve vendor ad requests and publish ads to the website.'
              : 'Request an ad. Once approved, it will appear on the website.'}
          </p>
        </div>
        {(currentUser.role === 'admin' || currentUser.role === 'vendor') && (
          <button onClick={() => setShowCreateModal(true)} className="hh-btn-primary flex items-center gap-2">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New Ad
          </button>
        )}
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 flex items-center gap-3">
          <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {error}
        </div>
      )}

      <div className="hh-card p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
          <div className="md:col-span-6">
            <label className="block text-xs font-medium text-[var(--hh-text-tertiary)] mb-1">Search</label>
            <input value={q} onChange={(e) => setQ(e.target.value)} className="hh-input px-3 py-2" placeholder="Search ads" />
          </div>
          <div className="md:col-span-3">
            <label className="block text-xs font-medium text-[var(--hh-text-tertiary)] mb-1">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as 'all' | Ad['status'])}
              className="hh-input px-3 py-2"
            >
              <option value="all">All</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="paused">Paused</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>
          <div className="md:col-span-3 flex gap-2">
            <button onClick={load} className="hh-btn-secondary px-4 py-2 w-full">Refresh</button>
          </div>
        </div>
      </div>

      <div className="hh-card overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-[var(--hh-bg-elevated)]/50 border-b border-[var(--hh-border)]">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-semibold text-[var(--hh-text-tertiary)] uppercase tracking-wider">Ad</th>
                {currentUser.role === 'admin' && (
                  <th className="px-6 py-4 text-left text-xs font-semibold text-[var(--hh-text-tertiary)] uppercase tracking-wider">Vendor</th>
                )}
                <th className="px-6 py-4 text-left text-xs font-semibold text-[var(--hh-text-tertiary)] uppercase tracking-wider">Status</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-[var(--hh-text-tertiary)] uppercase tracking-wider">Schedule</th>
                <th className="px-6 py-4 text-right text-xs font-semibold text-[var(--hh-text-tertiary)] uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--hh-border)]">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={currentUser.role === 'admin' ? 5 : 4} className="px-6 py-12 text-center text-[var(--hh-text-secondary)]">
                    No ads found.
                  </td>
                </tr>
              ) : (
                filtered.map((ad) => (
                  <tr key={ad.id} className="hover:bg-[var(--hh-bg-elevated)]/30 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-14 h-14 rounded-xl bg-[var(--hh-bg-elevated)] border border-[var(--hh-border)] overflow-hidden shrink-0">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={ad.image_url} alt="" className="w-full h-full object-cover" />
                        </div>
                        <div className="min-w-0">
                          <div className="text-[var(--hh-text)] font-medium truncate">{ad.title}</div>
                          <div className="text-xs text-[var(--hh-text-tertiary)] truncate">
                            {ad.target_url ? ad.target_url : ad.event_id ? `Event: ${ad.event_id}` : '—'}
                          </div>
                        </div>
                      </div>
                    </td>
                    {currentUser.role === 'admin' && (
                      <td className="px-6 py-4 text-sm text-[var(--hh-text-secondary)]">
                        {ad.vendor_id ? (vendorEmailById.get(ad.vendor_id) ?? ad.vendor_id.slice(0, 8)) : '—'}
                      </td>
                    )}
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                          ad.status === 'approved'
                            ? 'bg-green-500/10 text-green-400 border-green-500/20'
                            : ad.status === 'rejected'
                              ? 'bg-red-500/10 text-red-400 border-red-500/20'
                              : ad.status === 'paused'
                                ? 'bg-[var(--hh-bg-elevated)] text-[var(--hh-text-tertiary)] border-[var(--hh-border)]'
                                : 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20'
                        }`}
                      >
                        {ad.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-[var(--hh-text-secondary)]">
                      <div className="flex flex-col">
                        <span>{new Date(ad.start_at).toLocaleDateString()}</span>
                        <span className="text-xs text-[var(--hh-text-tertiary)]">{ad.end_at ? `Ends ${new Date(ad.end_at).toLocaleDateString()}` : 'No end date'}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => startEdit(ad)}
                          className="p-2 hover:bg-[var(--hh-bg-elevated)] rounded-lg text-[var(--hh-text-secondary)] transition-colors"
                          title="Edit"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>

                        {currentUser.role === 'admin' && ad.status === 'pending' && (
                          <>
                            <button onClick={() => setStatus(ad, 'approved')} className="p-2 hover:bg-green-500/10 rounded-lg text-green-400 transition-colors" title="Approve">
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                            </button>
                            <button onClick={() => setStatus(ad, 'rejected')} className="p-2 hover:bg-red-500/10 rounded-lg text-red-400 transition-colors" title="Reject">
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          </>
                        )}

                        {currentUser.role === 'admin' && ad.status === 'approved' && (
                          <button onClick={() => setStatus(ad, 'paused')} className="p-2 hover:bg-[var(--hh-bg-elevated)] rounded-lg text-[var(--hh-text-secondary)] transition-colors" title="Pause">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6" />
                            </svg>
                          </button>
                        )}

                        {currentUser.role === 'admin' && ad.status === 'paused' && (
                          <button onClick={() => setStatus(ad, 'approved')} className="p-2 hover:bg-green-500/10 rounded-lg text-green-400 transition-colors" title="Resume">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                            </svg>
                          </button>
                        )}

                        {currentUser.role === 'admin' && (
                          <button onClick={() => setDeleteConfirm(ad.id)} className="p-2 hover:bg-red-500/10 rounded-lg text-[var(--hh-text-secondary)] hover:text-red-400 transition-colors" title="Delete">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <>
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40" onClick={() => setShowCreateModal(false)} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="w-full max-w-2xl bg-[var(--hh-bg-card)] border border-[var(--hh-border)] rounded-2xl shadow-2xl max-h-[90vh] overflow-hidden flex flex-col min-h-0">
              <div className="p-6 border-b border-[var(--hh-border)] flex items-center justify-between">
                <h2 className="text-lg font-semibold text-[var(--hh-text)]">New Ad</h2>
                <button onClick={() => setShowCreateModal(false)} className="p-2 rounded-lg hover:bg-[var(--hh-bg-elevated)] text-[var(--hh-text-secondary)]">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <form className="flex-1 overflow-hidden flex flex-col min-h-0" onSubmit={createForm.handleSubmit(onCreate)}>
                <div className="p-6 space-y-4 overflow-y-auto min-h-0">
                  {currentUser.role === 'admin' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-[var(--hh-text-tertiary)] mb-1">Vendor</label>
                        <select className="hh-input px-3 py-2" {...createForm.register('vendor_id')}>
                          <option value="">—</option>
                          {vendors.map((v) => (
                            <option key={v.id} value={v.id}>{v.email}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-[var(--hh-text-tertiary)] mb-1">Status</label>
                        <select className="hh-input px-3 py-2" {...createForm.register('status')}>
                          <option value="pending">pending</option>
                          <option value="approved">approved</option>
                          <option value="paused">paused</option>
                          <option value="rejected">rejected</option>
                        </select>
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-[var(--hh-text-tertiary)] mb-1">Title</label>
                      <input className="hh-input px-3 py-2" {...createForm.register('title')} placeholder="Ad title" />
                      {createForm.formState.errors.title && (
                        <p className="mt-1 text-xs text-red-400">{createForm.formState.errors.title.message}</p>
                      )}
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-[var(--hh-text-tertiary)] mb-1">CTA</label>
                      <input className="hh-input px-3 py-2" {...createForm.register('cta_text')} placeholder="Learn more" />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-[var(--hh-text-tertiary)] mb-1">Subtitle (optional)</label>
                    <input className="hh-input px-3 py-2" {...createForm.register('subtitle')} placeholder="Short supporting line" />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-[var(--hh-text-tertiary)] mb-1">Image</label>
                    <div className="flex items-center gap-3">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          try {
                            const url = await uploadImage(file);
                            createForm.setValue('image_url', url, { shouldValidate: true });
                          } catch (err: unknown) {
                            alert(err instanceof Error ? err.message : 'Failed to upload image');
                          }
                        }}
                        className="block w-full text-sm text-[var(--hh-text-secondary)] file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-[var(--hh-bg-elevated)] file:text-[var(--hh-text)] hover:file:bg-[var(--hh-bg-elevated)]/80"
                      />
                    </div>
                    <input className="hh-input px-3 py-2 mt-2" {...createForm.register('image_url')} placeholder="https://..." />
                    {createForm.formState.errors.image_url && (
                      <p className="mt-1 text-xs text-red-400">{createForm.formState.errors.image_url.message}</p>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-[var(--hh-text-tertiary)] mb-1">Promote Event (optional)</label>
                      <input
                        value={createEventSearch}
                        onChange={(e) => setCreateEventSearch(e.target.value)}
                        className="hh-input px-3 py-2 mb-2"
                        placeholder="Search your events..."
                      />
                      <select
                        className="hh-input px-3 py-2"
                        value={createEventId ?? ''}
                        onChange={(e) => {
                          const v = e.target.value || undefined;
                          createForm.setValue('event_id', v, { shouldValidate: true });
                          if (v) {
                            createForm.setValue('target_url', undefined, { shouldValidate: true });
                          }
                        }}
                        disabled={eventOptionsLoading}
                      >
                        <option value="">{eventOptionsLoading ? 'Loading events…' : '— Select an event —'}</option>
                        {visibleCreateEvents.map((ev) => (
                          <option key={ev.id} value={ev.id}>
                            {ev.title}{ev.start_at ? ` • ${new Date(ev.start_at).toLocaleDateString()}` : ''}{ev.status !== 'published' ? ` • ${ev.status}` : ''}
                          </option>
                        ))}
                      </select>
                      {createEventId && (
                        <p className="mt-1 text-xs text-[var(--hh-text-tertiary)]">
                          Linking to an event will override any external URL.
                        </p>
                      )}
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-[var(--hh-text-tertiary)] mb-1">External URL (optional)</label>
                      <input
                        className="hh-input px-3 py-2"
                        {...createForm.register('target_url')}
                        placeholder="https://..."
                        onChange={(e) => {
                          createForm.setValue('target_url', e.target.value || undefined, { shouldValidate: true });
                          if (e.target.value) {
                            createForm.setValue('event_id', undefined, { shouldValidate: true });
                          }
                        }}
                        value={createTargetUrl ?? ''}
                      />
                      {createTargetUrl && (
                        <p className="mt-1 text-xs text-[var(--hh-text-tertiary)]">
                          Adding an external URL will clear the event selection.
                        </p>
                      )}
                    </div>
                  </div>
                  {(createForm.formState.errors.target_url || createForm.formState.errors.event_id) && (
                    <p className="text-xs text-red-400">Provide either a target URL or an event.</p>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-[var(--hh-text-tertiary)] mb-1">Start</label>
                      <input type="datetime-local" className="hh-input px-3 py-2" {...createForm.register('start_at')} />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-[var(--hh-text-tertiary)] mb-1">End (optional)</label>
                      <input type="datetime-local" className="hh-input px-3 py-2" {...createForm.register('end_at')} />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-[var(--hh-text-tertiary)] mb-1">Priority</label>
                      <input type="number" className="hh-input px-3 py-2" {...createForm.register('priority', { valueAsNumber: true })} />
                    </div>
                  </div>
                </div>

                <div className="p-6 border-t border-[var(--hh-border)] bg-[var(--hh-bg-card)]/95 flex items-center justify-end gap-3"
                  style={{ paddingBottom: 'calc(1.5rem + env(safe-area-inset-bottom))' }}
                >
                  <button type="button" className="hh-btn-secondary" onClick={() => setShowCreateModal(false)}>Cancel</button>
                  <button type="submit" className="hh-btn-primary">Create</button>
                </div>
              </form>
            </div>
          </div>
        </>
      )}

      {/* Edit Modal */}
      {editingAd && (
        <>
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40" onClick={() => setEditingAd(null)} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="w-full max-w-2xl bg-[var(--hh-bg-card)] border border-[var(--hh-border)] rounded-2xl shadow-2xl max-h-[90vh] overflow-hidden flex flex-col min-h-0">
              <div className="p-6 border-b border-[var(--hh-border)] flex items-center justify-between">
                <h2 className="text-lg font-semibold text-[var(--hh-text)]">Edit Ad</h2>
                <button onClick={() => setEditingAd(null)} className="p-2 rounded-lg hover:bg-[var(--hh-bg-elevated)] text-[var(--hh-text-secondary)]">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <form className="flex-1 overflow-hidden flex flex-col min-h-0" onSubmit={updateForm.handleSubmit(onUpdate)}>
                <div className="p-6 space-y-4 overflow-y-auto min-h-0">
                  {currentUser.role === 'admin' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-[var(--hh-text-tertiary)] mb-1">Vendor</label>
                        <select className="hh-input px-3 py-2" {...updateForm.register('vendor_id')}>
                          <option value="">—</option>
                          {vendors.map((v) => (
                            <option key={v.id} value={v.id}>{v.email}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-[var(--hh-text-tertiary)] mb-1">Status</label>
                        <select className="hh-input px-3 py-2" {...updateForm.register('status')}>
                          <option value="pending">pending</option>
                          <option value="approved">approved</option>
                          <option value="paused">paused</option>
                          <option value="rejected">rejected</option>
                        </select>
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-[var(--hh-text-tertiary)] mb-1">Title</label>
                      <input className="hh-input px-3 py-2" {...updateForm.register('title')} />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-[var(--hh-text-tertiary)] mb-1">CTA</label>
                      <input className="hh-input px-3 py-2" {...updateForm.register('cta_text')} />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-[var(--hh-text-tertiary)] mb-1">Subtitle</label>
                    <input className="hh-input px-3 py-2" {...updateForm.register('subtitle')} />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-[var(--hh-text-tertiary)] mb-1">Image</label>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        try {
                          const url = await uploadImage(file);
                          updateForm.setValue('image_url', url, { shouldValidate: true });
                        } catch (err: unknown) {
                          alert(err instanceof Error ? err.message : 'Failed to upload image');
                        }
                      }}
                      className="block w-full text-sm text-[var(--hh-text-secondary)] file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-[var(--hh-bg-elevated)] file:text-[var(--hh-text)] hover:file:bg-[var(--hh-bg-elevated)]/80"
                    />
                    <input className="hh-input px-3 py-2 mt-2" {...updateForm.register('image_url')} />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-[var(--hh-text-tertiary)] mb-1">Promote Event (optional)</label>
                      <input
                        value={editEventSearch}
                        onChange={(e) => setEditEventSearch(e.target.value)}
                        className="hh-input px-3 py-2 mb-2"
                        placeholder="Search events..."
                      />
                      <select
                        className="hh-input px-3 py-2"
                        value={editEventId ?? ''}
                        onChange={(e) => {
                          const v = e.target.value || undefined;
                          updateForm.setValue('event_id', v, { shouldValidate: true });
                          if (v) {
                            updateForm.setValue('target_url', undefined, { shouldValidate: true });
                          }
                        }}
                        disabled={eventOptionsLoading}
                      >
                        <option value="">{eventOptionsLoading ? 'Loading events…' : '— Select an event —'}</option>
                        {visibleEditEvents.map((ev) => (
                          <option key={ev.id} value={ev.id}>
                            {ev.title}{ev.start_at ? ` • ${new Date(ev.start_at).toLocaleDateString()}` : ''}{ev.status !== 'published' ? ` • ${ev.status}` : ''}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-[var(--hh-text-tertiary)] mb-1">External URL (optional)</label>
                      <input
                        className="hh-input px-3 py-2"
                        {...updateForm.register('target_url')}
                        onChange={(e) => {
                          updateForm.setValue('target_url', e.target.value || undefined, { shouldValidate: true });
                          if (e.target.value) {
                            updateForm.setValue('event_id', undefined, { shouldValidate: true });
                          }
                        }}
                        value={editTargetUrl ?? ''}
                      />
                    </div>
                  </div>

                  {(updateForm.formState.errors.target_url || updateForm.formState.errors.event_id) && (
                    <p className="text-xs text-red-400">Provide either a target URL or an event.</p>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-[var(--hh-text-tertiary)] mb-1">Start</label>
                      <input type="datetime-local" className="hh-input px-3 py-2" {...updateForm.register('start_at')} />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-[var(--hh-text-tertiary)] mb-1">End</label>
                      <input type="datetime-local" className="hh-input px-3 py-2" {...updateForm.register('end_at')} />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-[var(--hh-text-tertiary)] mb-1">Priority</label>
                      <input type="number" className="hh-input px-3 py-2" {...updateForm.register('priority', { valueAsNumber: true })} />
                    </div>
                  </div>
                </div>

                <div className="p-6 border-t border-[var(--hh-border)] bg-[var(--hh-bg-card)]/95 flex items-center justify-end gap-3"
                  style={{ paddingBottom: 'calc(1.5rem + env(safe-area-inset-bottom))' }}
                >
                  <button type="button" className="hh-btn-secondary" onClick={() => setEditingAd(null)}>Cancel</button>
                  <button type="submit" className="hh-btn-primary">Save</button>
                </div>
              </form>
            </div>
          </div>
        </>
      )}

      {/* Delete confirm */}
      {deleteConfirm && (
        <>
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40" onClick={() => setDeleteConfirm(null)} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="w-full max-w-md bg-[var(--hh-bg-card)] border border-[var(--hh-border)] rounded-2xl shadow-2xl p-6">
              <h3 className="text-lg font-semibold text-[var(--hh-text)]">Delete Ad?</h3>
              <p className="text-[var(--hh-text-secondary)] mt-2">This cannot be undone.</p>
              <div className="mt-6 flex items-center justify-end gap-3">
                <button className="hh-btn-secondary" onClick={() => setDeleteConfirm(null)}>Cancel</button>
                <button className="hh-btn-primary bg-red-600 hover:bg-red-700 border-red-600" onClick={() => onDelete(deleteConfirm)}>Delete</button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
