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
  base_price_cents: z.number().int().nonnegative().optional(),
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

export type LoginInput = z.infer<typeof LoginSchema>;
export type EventCreateInput = z.infer<typeof EventCreateSchema>;
export type EventUpdateInput = z.infer<typeof EventUpdateSchema>;
export type TierCreateInput = z.infer<typeof TierCreateSchema>;
export type TierUpdateInput = z.infer<typeof TierUpdateSchema>;
export type ImageCreateInput = z.infer<typeof ImageCreateSchema>;
export type ImageUpdateInput = z.infer<typeof ImageUpdateSchema>;


