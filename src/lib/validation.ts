import { z } from 'zod';

export const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export const EventBaseSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional().nullable(),
  category: z.enum(['Music', 'Tech', 'Comedy', 'Art', 'Sports']).optional().nullable(),
  hero_image_url: z.string().url().optional().nullable(),
  start_at: z.string().or(z.date()),
  end_at: z.string().or(z.date()).optional().nullable(),
  venue_name: z.string().optional().nullable(),
  address_line: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  latitude: z.number().optional().nullable(),
  longitude: z.number().optional().nullable(),
  vendor_id: z.string().uuid().optional().nullable(),
  base_price_cents: z
    .number()
    .int()
    .nonnegative()
    .max(2147483647)
    .optional()
    .nullable(),
  currency: z.string().length(3).optional(),
  status: z.enum(['draft', 'published', 'archived']).optional(),
  allow_cab: z.boolean().optional(),
});

export const EventCreateSchema = EventBaseSchema.extend({
  title: z.string().min(1),
  start_at: z.string().or(z.date()),
});

export const EventUpdateSchema = EventBaseSchema.partial();

export const TierCreateSchema = z.object({
  name: z.string().min(1),
  price_cents: z.number().int().nonnegative(),
  currency: z.string().length(3).default('INR'),
  total_quantity: z.number().int().nonnegative(),
  sold_quantity: z.number().int().nonnegative().optional(),
  sales_start: z.string().or(z.date()).optional().nullable(),
  sales_end: z.string().or(z.date()).optional().nullable(),
});

export const TierUpdateSchema = TierCreateSchema.partial();

export const ImageCreateSchema = z.object({
  url: z.string().url(),
  position: z.number().int().nonnegative().optional(),
});

export const ImageUpdateSchema = ImageCreateSchema.partial();

export const AdBaseSchema = z.object({
  title: z.string().min(1),
  subtitle: z.string().optional().nullable(),
  image_url: z.string().url(),
  cta_text: z.string().min(1).optional(),
  target_url: z.string().url().optional().nullable(),
  event_id: z.string().uuid().optional().nullable(),
  placement: z.enum(['home_feed']).optional(),
  status: z.enum(['pending', 'approved', 'rejected', 'paused']).optional(),
  start_at: z.string().or(z.date()).optional(),
  end_at: z.string().or(z.date()).optional().nullable(),
  priority: z.number().int().optional(),
  vendor_id: z.string().uuid().optional().nullable(),
});

export const AdCreateSchema = AdBaseSchema.superRefine((data, ctx) => {
  if (!data.target_url && !data.event_id) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Either target_url or event_id is required',
      path: ['target_url'],
    });
  }

  if (data.start_at && data.end_at) {
    const start = data.start_at instanceof Date ? data.start_at.getTime() : Date.parse(data.start_at);
    const end = data.end_at instanceof Date ? data.end_at.getTime() : Date.parse(data.end_at);
    if (!Number.isNaN(start) && !Number.isNaN(end) && end < start) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'end_at must be after start_at',
        path: ['end_at'],
      });
    }
  }
});

export const AdUpdateSchema = AdBaseSchema.partial();

export const AdminUserCreateSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  role: z.enum(['admin', 'moderator', 'vendor', 'vendor_moderator']),
  vendor_id: z.string().uuid().optional().nullable(),
}).superRefine((data, ctx) => {
  if (data.role === 'vendor_moderator' && !data.vendor_id) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'vendor_id is required for vendor moderators',
      path: ['vendor_id'],
    });
  }
  if (data.role !== 'vendor_moderator' && data.vendor_id) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'vendor_id is only allowed for vendor moderators',
      path: ['vendor_id'],
    });
  }
});

export const AdminUserUpdateSchema = z.object({
  email: z.string().email().optional(),
  password: z.string().min(6).optional(),
  role: z.enum(['admin', 'moderator', 'vendor', 'vendor_moderator']).optional(),
  vendor_id: z.string().uuid().optional().nullable(),
}).superRefine((data, ctx) => {
  if (data.role === 'vendor_moderator' && !data.vendor_id) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'vendor_id is required for vendor moderators',
      path: ['vendor_id'],
    });
  }
  if (data.role && data.role !== 'vendor_moderator' && data.vendor_id) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'vendor_id is only allowed for vendor moderators',
      path: ['vendor_id'],
    });
  }
});

export type LoginInput = z.infer<typeof LoginSchema>;
export type EventCreateInput = z.infer<typeof EventCreateSchema>;
export type EventUpdateInput = z.infer<typeof EventUpdateSchema>;
export type TierCreateInput = z.infer<typeof TierCreateSchema>;
export type TierUpdateInput = z.infer<typeof TierUpdateSchema>;
export type ImageCreateInput = z.infer<typeof ImageCreateSchema>;
export type ImageUpdateInput = z.infer<typeof ImageUpdateSchema>;
export type AdCreateInput = z.infer<typeof AdCreateSchema>;
export type AdUpdateInput = z.infer<typeof AdUpdateSchema>;
export type AdminUserCreateInput = z.infer<typeof AdminUserCreateSchema>;
export type AdminUserUpdateInput = z.infer<typeof AdminUserUpdateSchema>;
