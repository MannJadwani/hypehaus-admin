"use client";

import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { EventCreateSchema, type EventCreateInput } from '@/lib/validation';
import Link from 'next/link';
import { useState, useEffect } from 'react';
import { toast } from 'sonner';

const categories = ['Music', 'Tech', 'Comedy', 'Art', 'Sports'] as const;

const steps = [
  { id: 'basic', title: 'Basic Details', icon: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  )},
  { id: 'media', title: 'Event Media', icon: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  )},
  { id: 'schedule', title: 'Schedule & Venue', icon: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  )},
  { id: 'pricing', title: 'Pricing & Review', icon: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  )},
];

export default function NewEventPage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<{ role: 'admin' | 'moderator' } | null>(null);
  const [currentStep, setCurrentStep] = useState(0);
  const [isLoadingUser, setIsLoadingUser] = useState(true);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [isValidatingStep, setIsValidatingStep] = useState(false);

  useEffect(() => {
    // Load current user role
    setIsLoadingUser(true);
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
      .catch(() => {
        toast.error('Failed to load user information');
      })
      .finally(() => {
        setIsLoadingUser(false);
      });
  }, [router]);

  const { register, handleSubmit, setValue, watch, trigger, formState: { errors, isSubmitting } } = useForm<EventCreateInput>({
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
      base_price_cents: undefined,
      currency: 'INR',
      status: 'draft',
      allow_cab: false,
    },
  });

  const heroUrl = watch('hero_image_url');

  const uploadHero = async (file: File) => {
    setIsUploadingImage(true);
    try {
    const fd = new FormData();
    fd.append('file', file);
    const res = await fetch('/api/upload', { method: 'POST', body: fd });
    if (res.ok) {
      const data = await res.json();
      setValue('hero_image_url', data.url, { shouldValidate: true, shouldDirty: true });
      toast.success('Image uploaded successfully');
      } else {
        const errorData = await res.json().catch(() => ({}));
        toast.error(errorData?.error ?? 'Failed to upload image. Please try again.');
      }
    } catch (err) {
      toast.error('Failed to upload image. Please check your connection and try again.');
    } finally {
      setIsUploadingImage(false);
    }
  };

  const onSubmit = async (values: EventCreateInput) => {
    try {
      const payload = {
        ...values,
        start_at: values.start_at ? new Date(values.start_at).toISOString() : undefined,
        end_at: values.end_at ? new Date(values.end_at).toISOString() : undefined,
      };

      const res = await fetch('/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    if (res.ok) {
      const data = await res.json();
      toast.success('Event created successfully');
      router.push(`/events/${data.event.id}`);
    } else {
      const data = await res.json().catch(() => ({}));
        toast.error(data?.error ?? 'Failed to create event. Please check all fields and try again.');
      }
    } catch (err) {
      toast.error('Network error. Please check your connection and try again.');
    }
  };

  const nextStep = async () => {
    setIsValidatingStep(true);
    try {
      let fieldsToValidate: (keyof EventCreateInput)[] = [];
      
      switch (currentStep) {
        case 0: // Basic
          fieldsToValidate = ['title', 'description', 'category', 'status'];
          break;
        case 1: // Media
          fieldsToValidate = ['hero_image_url'];
          break;
        case 2: // Schedule
          fieldsToValidate = ['start_at', 'end_at', 'venue_name', 'city', 'address_line', 'latitude', 'longitude'];
          break;
        case 3: // Pricing
          // No specific validation needed to proceed, ready to submit
          break;
      }

      const isValid = await trigger(fieldsToValidate);
      if (isValid) {
        setCurrentStep((prev) => Math.min(prev + 1, steps.length - 1));
        window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      toast.error('Please fill in all required fields correctly before proceeding.');
    }
    } finally {
      setIsValidatingStep(false);
    }
  };

  const prevStep = () => {
    setCurrentStep((prev) => Math.max(prev - 1, 0));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Show loading or redirect if not admin
  if (isLoadingUser || !currentUser) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-[var(--hh-primary)] border-t-transparent rounded-full animate-spin"></div>
        <div className="text-[var(--hh-text-secondary)]">Loading...</div>
        </div>
      </div>
    );
  }

  if (currentUser.role !== 'admin') {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-6 text-center max-w-md">
          <h3 className="text-lg font-bold text-red-400 mb-2">Unauthorized Access</h3>
          <p className="text-[var(--hh-text-secondary)]">Only admins can create new events.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-[var(--hh-text)] tracking-tight">Create New Event</h1>
          <p className="text-[var(--hh-text-secondary)] mt-1">Step {currentStep + 1} of {steps.length}: {steps[currentStep].title}</p>
        </div>
        <Link href="/events" className="hh-btn-secondary flex items-center gap-2 text-sm">
          Exit
        </Link>
      </div>

      {/* Progress Steps */}
      <div className="mb-8">
        <div className="flex items-center justify-between relative">
          <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-1 bg-[var(--hh-bg-elevated)] -z-10 rounded-full"></div>
          <div 
            className="absolute left-0 top-1/2 -translate-y-1/2 h-1 bg-[var(--hh-primary)] -z-10 rounded-full transition-all duration-500 ease-out"
            style={{ width: `${(currentStep / (steps.length - 1)) * 100}%` }}
          ></div>
          
          {steps.map((step, idx) => (
            <div key={step.id} className="flex flex-col items-center gap-2">
              <div 
                className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all duration-300 ${
                  idx <= currentStep 
                    ? 'bg-[var(--hh-primary)] border-[var(--hh-primary)] text-white shadow-[0_0_15px_rgba(139,92,246,0.4)]' 
                    : 'bg-[var(--hh-bg-card)] border-[var(--hh-border)] text-[var(--hh-text-tertiary)]'
                }`}
              >
                {idx < currentStep ? (
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  <span className="font-bold text-sm">{idx + 1}</span>
                )}
              </div>
              <span className={`text-xs font-medium transition-colors duration-300 ${
                idx <= currentStep ? 'text-[var(--hh-text)]' : 'text-[var(--hh-text-tertiary)]'
              }`}>
                {step.title}
              </span>
            </div>
          ))}
        </div>
      </div>



      <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
        
        {/* Step 1: Basic Info */}
        <div className={currentStep === 0 ? 'block animate-in fade-in slide-in-from-right-4 duration-300' : 'hidden'}>
          <div className="hh-card p-6 md:p-8">
            <h2 className="text-lg font-bold text-[var(--hh-text)] mb-6 flex items-center gap-2">
              {steps[0].icon} Basic Information
            </h2>
            <div className="grid gap-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="col-span-2">
                  <label className="block text-sm font-medium mb-1.5 text-[var(--hh-text-secondary)]">Event Title</label>
                  <input 
                    className="hh-input w-full" 
                    placeholder="e.g. Summer Music Festival 2024"
                    {...register('title')} 
                  />
                  {errors.title && <p className="mt-1.5 text-xs text-red-400">{errors.title.message}</p>}
                </div>

                <div className="col-span-2">
                  <label className="block text-sm font-medium mb-1.5 text-[var(--hh-text-secondary)]">Description</label>
                  <textarea 
                    className="hh-input w-full min-h-[120px] resize-y" 
                    placeholder="Describe your event..."
                    {...register('description')} 
                  />
                </div>

          <div>
                  <label className="block text-sm font-medium mb-1.5 text-[var(--hh-text-secondary)]">Category</label>
                  <select className="hh-input w-full appearance-none" {...register('category')}>
                    <option value="">Select category...</option>
              {categories.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
                  {errors.category && <p className="mt-1.5 text-xs text-red-400">{errors.category.message}</p>}
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1.5 text-[var(--hh-text-secondary)]">Status</label>
                  <select className="hh-input w-full appearance-none" {...register('status')}>
                    <option value="draft">Draft (Hidden)</option>
                    <option value="published">Published (Visible)</option>
                    <option value="archived">Archived</option>
                  </select>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Step 2: Media */}
        <div className={currentStep === 1 ? 'block animate-in fade-in slide-in-from-right-4 duration-300' : 'hidden'}>
          <div className="hh-card p-6 md:p-8">
            <h2 className="text-lg font-bold text-[var(--hh-text)] mb-6 flex items-center gap-2">
              {steps[1].icon} Event Media
            </h2>
          <div>
              <label className="block text-sm font-medium mb-3 text-[var(--hh-text-secondary)]">Hero Image</label>
              <div className={`border-2 border-dashed rounded-xl p-6 transition-colors bg-[var(--hh-bg-elevated)]/30 ${
                isUploadingImage 
                  ? 'border-[var(--hh-primary)] cursor-wait' 
                  : 'border-[var(--hh-border)] hover:border-[var(--hh-primary)]/50'
              }`}>
                <div className="flex flex-col items-center gap-4">
                  {isUploadingImage ? (
                    <div className="w-full aspect-video rounded-lg overflow-hidden bg-black/20 flex items-center justify-center">
                      <div className="flex flex-col items-center gap-3">
                        <div className="w-8 h-8 border-2 border-[var(--hh-primary)] border-t-transparent rounded-full animate-spin"></div>
                        <p className="text-[var(--hh-text-secondary)] text-sm">Uploading image...</p>
                      </div>
                    </div>
                  ) : heroUrl ? (
                    <div className="relative w-full aspect-video rounded-lg overflow-hidden bg-black/20">
                      <img src={heroUrl} alt="Hero preview" className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-black/40 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center">
                        <p className="text-white text-sm font-medium">Click to replace</p>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <svg className="mx-auto h-12 w-12 text-[var(--hh-text-tertiary)]" stroke="currentColor" fill="none" viewBox="0 0 48 48" aria-hidden="true">
                        <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      <div className="mt-2 flex text-sm text-[var(--hh-text-secondary)] justify-center">
                        <span className="relative cursor-pointer rounded-md font-medium text-[var(--hh-primary)] hover:text-[var(--hh-primary-light)]">
                          <span>Upload a file</span>
                        </span>
                        <p className="pl-1">or drag and drop</p>
                      </div>
                      <p className="text-xs text-[var(--hh-text-tertiary)]">PNG, JPG, GIF up to 10MB</p>
                    </div>
                  )}
              <input
                type="file"
                accept="image/*"
                disabled={isUploadingImage}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-wait"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f && !isUploadingImage) uploadHero(f);
                }}
              />
                </div>
              </div>
              <input type="hidden" {...register('hero_image_url')} />
              {errors.hero_image_url && <p className="mt-1.5 text-xs text-red-400">{errors.hero_image_url.message}</p>}
            </div>
          </div>
        </div>

        {/* Step 3: Schedule & Location */}
        <div className={currentStep === 2 ? 'block animate-in fade-in slide-in-from-right-4 duration-300' : 'hidden'}>
          <div className="hh-card p-6 md:p-8">
            <h2 className="text-lg font-bold text-[var(--hh-text)] mb-6 flex items-center gap-2">
              {steps[2].icon} Schedule & Location
            </h2>
            <div className="grid gap-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
                  <label className="block text-sm font-medium mb-1.5 text-[var(--hh-text-secondary)]">Start Date & Time</label>
                  <input 
                    type="datetime-local" 
                    className="hh-input w-full" 
                    {...register('start_at')} 
                  />
                  {errors.start_at && <p className="mt-1.5 text-xs text-red-400">{errors.start_at.message}</p>}
          </div>
          <div>
                  <label className="block text-sm font-medium mb-1.5 text-[var(--hh-text-secondary)]">End Date & Time</label>
                  <input 
                    type="datetime-local" 
                    className="hh-input w-full" 
                    {...register('end_at')} 
                  />
                  {errors.end_at && <p className="mt-1.5 text-xs text-red-400">{errors.end_at.message}</p>}
          </div>
        </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
                  <label className="block text-sm font-medium mb-1.5 text-[var(--hh-text-secondary)]">Venue Name</label>
                  <input 
                    className="hh-input w-full" 
                    placeholder="e.g. The Grand Arena"
                    {...register('venue_name')} 
                  />
                  {errors.venue_name && <p className="mt-1.5 text-xs text-red-400">{errors.venue_name.message}</p>}
          </div>
          <div>
                  <label className="block text-sm font-medium mb-1.5 text-[var(--hh-text-secondary)]">City</label>
                  <input 
                    className="hh-input w-full" 
                    placeholder="e.g. Mumbai"
                    {...register('city')} 
                  />
                  {errors.city && <p className="mt-1.5 text-xs text-red-400">{errors.city.message}</p>}
          </div>
        </div>

        <div>
                <label className="block text-sm font-medium mb-1.5 text-[var(--hh-text-secondary)]">Full Address</label>
                <input 
                  className="hh-input w-full" 
                  placeholder="Street address, landmarks, etc."
                  {...register('address_line')} 
                />
                {errors.address_line && <p className="mt-1.5 text-xs text-red-400">{errors.address_line.message}</p>}
        </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-4 bg-[var(--hh-bg-elevated)]/30 rounded-xl border border-[var(--hh-border)]">
          <div>
                  <label className="block text-sm font-medium mb-1.5 text-[var(--hh-text-secondary)]">Latitude</label>
                  <input 
                    type="number" 
                    step="0.000001" 
                    className="hh-input w-full font-mono text-sm" 
                    placeholder="19.0760"
                    {...register('latitude', { valueAsNumber: true })} 
                  />
          </div>
          <div>
                  <label className="block text-sm font-medium mb-1.5 text-[var(--hh-text-secondary)]">Longitude</label>
                  <input 
                    type="number" 
                    step="0.000001" 
                    className="hh-input w-full font-mono text-sm" 
                    placeholder="72.8777"
                    {...register('longitude', { valueAsNumber: true })} 
                  />
                </div>
                <p className="col-span-2 text-xs text-[var(--hh-text-tertiary)]">
                  Coordinates are used for map integration. Use Google Maps to find exact values.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Step 4: Pricing & Review */}
        <div className={currentStep === 3 ? 'block animate-in fade-in slide-in-from-right-4 duration-300' : 'hidden'}>
          <div className="hh-card p-6 md:p-8">
            <h2 className="text-lg font-bold text-[var(--hh-text)] mb-6 flex items-center gap-2">
              {steps[3].icon} Pricing & Configuration
            </h2>
            <div className="grid gap-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
                  <label className="block text-sm font-medium mb-1.5 text-[var(--hh-text-secondary)]">Base Price (cents)</label>
                  <div className="relative">
                    <input 
                      type="number" 
                      className="hh-input w-full" 
                      placeholder="0"
                      {...register('base_price_cents', { 
                        valueAsNumber: true,
                        setValueAs: (v) => {
                          if (v === '' || v === null || v === undefined || isNaN(v)) {
                            return undefined;
                          }
                          const num = Number(v);
                          return isNaN(num) ? undefined : num;
                        }
                      })} 
                    />
                    <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                      <span className="text-[var(--hh-text-tertiary)] text-xs">paise</span>
                    </div>
                  </div>
                  <p className="mt-1 text-xs text-[var(--hh-text-tertiary)]">e.g. 1000 = ₹10.00</p>
          </div>
          <div>
                  <label className="block text-sm font-medium mb-1.5 text-[var(--hh-text-secondary)]">Currency</label>
                  <input 
                    className="hh-input w-full uppercase" 
                    {...register('currency')} 
                  />
                </div>
              </div>

              <div className="p-4 rounded-xl bg-[var(--hh-bg-elevated)]/30 border border-[var(--hh-border)] flex items-start gap-3">
                <div className="flex h-6 items-center">
                  <input 
                    id="allow_cab" 
                    type="checkbox" 
                    className="h-4 w-4 rounded border-[var(--hh-border)] text-[var(--hh-primary)] focus:ring-[var(--hh-primary)] bg-[var(--hh-bg-input)]" 
                    {...register('allow_cab')} 
                  />
                </div>
                <div className="text-sm">
                  <label htmlFor="allow_cab" className="font-medium text-[var(--hh-text)]">Cab Booking Option</label>
                  <p className="text-[var(--hh-text-secondary)] mt-0.5">Allow customers to request a cab ride when booking their tickets.</p>
                </div>
              </div>
          </div>
          </div>
        </div>

        {/* Action Bar */}
        <div className="sticky bottom-6 bg-[var(--hh-bg-card)]/90 backdrop-blur-md border border-[var(--hh-border)] p-4 rounded-2xl shadow-2xl flex justify-between items-center z-10">
          <button 
            type="button" 
            onClick={prevStep} 
            disabled={currentStep === 0 || isValidatingStep || isSubmitting}
            className={`hh-btn-secondary px-6 ${currentStep === 0 || isValidatingStep || isSubmitting ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            Back
          </button>
          
          <div className="flex gap-3">
            {currentStep < steps.length - 1 ? (
              <button 
                type="button" 
                onClick={nextStep}
                disabled={isValidatingStep}
                className="hh-btn-primary px-8 min-w-[120px] flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isValidatingStep ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    <span>Validating...</span>
                  </>
                ) : (
                  'Next Step'
                )}
              </button>
            ) : (
              <button 
                type="submit" 
                disabled={isSubmitting} 
                className="hh-btn-primary px-8 min-w-[120px] flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    <span>Creating...</span>
                  </>
                ) : (
                  'Create Event'
                )}
              </button>
            )}
          </div>
        </div>
      </form>
    </div>
  );
}
