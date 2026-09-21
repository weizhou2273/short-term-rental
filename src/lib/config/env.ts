import { z } from 'zod';

/**
 * Environment access is centralised here so that every integration fails loudly
 * and in one place rather than at a random `process.env.X!` deep in a request.
 *
 * Nothing is required at import time: the site is designed to boot and render
 * with demo content so that design work, previews and CI never depend on live
 * OwnerRez or WordPress credentials. Integrations announce themselves as
 * "configured" only when their full credential set is present.
 */

const optionalUrl = z
  .string()
  .trim()
  .url()
  .optional()
  .or(z.literal('').transform(() => undefined));

const rawSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),

  NEXT_PUBLIC_SITE_URL: z.string().trim().url().default('http://localhost:3000'),

  // --- OwnerRez (property management, availability, quotes, bookings) -------
  OWNERREZ_API_BASE_URL: z
    .string()
    .trim()
    .url()
    .default('https://api.ownerrez.com/v2'),
  OWNERREZ_USERNAME: z.string().trim().min(1).optional(),
  OWNERREZ_ACCESS_TOKEN: z.string().trim().min(1).optional(),
  OWNERREZ_WEBHOOK_SECRET: z.string().trim().min(1).optional(),
  /** Restrict the public site to these OwnerRez property ids (comma separated). */
  OWNERREZ_PROPERTY_IDS: z.string().trim().optional(),

  // --- WordPress (headless CMS for editorial content) ----------------------
  WORDPRESS_API_URL: optionalUrl,
  WORDPRESS_APP_USER: z.string().trim().min(1).optional(),
  WORDPRESS_APP_PASSWORD: z.string().trim().min(1).optional(),
  WORDPRESS_PREVIEW_SECRET: z.string().trim().min(1).optional(),

  // --- Payments ------------------------------------------------------------
  PAYMENT_PROVIDER: z.enum(['stripe', 'ownerrez', 'auto']).default('auto'),
  STRIPE_SECRET_KEY: z.string().trim().min(1).optional(),
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: z.string().trim().min(1).optional(),
  STRIPE_WEBHOOK_SECRET: z.string().trim().min(1).optional(),

  // --- Operational ---------------------------------------------------------
  /** HMAC key for booking draft tokens. Required once payments are enabled. */
  BOOKING_SIGNING_SECRET: z.string().trim().min(32).optional(),
  REVALIDATE_SECRET: z.string().trim().min(1).optional(),
  /** Seconds of ISR/data cache for OwnerRez + WordPress reads. */
  CONTENT_REVALIDATE_SECONDS: z.coerce.number().int().positive().default(300),
  AVAILABILITY_REVALIDATE_SECONDS: z.coerce.number().int().positive().default(60),
});

export type Env = z.infer<typeof rawSchema>;

function load(): Env {
  const parsed = rawSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `  - ${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  return parsed.data;
}

let cached: Env | null = null;

export function env(): Env {
  cached ??= load();
  return cached;
}

export function ownerRezConfigured(): boolean {
  const e = env();
  return Boolean(e.OWNERREZ_USERNAME && e.OWNERREZ_ACCESS_TOKEN);
}

export function wordPressConfigured(): boolean {
  return Boolean(env().WORDPRESS_API_URL);
}

export function stripeConfigured(): boolean {
  const e = env();
  return Boolean(e.STRIPE_SECRET_KEY && e.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY);
}

/** Property ids the site is allowed to surface, or `null` for "all of them". */
export function propertyAllowList(): Set<number> | null {
  const raw = env().OWNERREZ_PROPERTY_IDS;
  if (!raw) return null;
  const ids = raw
    .split(',')
    .map((part) => Number.parseInt(part.trim(), 10))
    .filter((id) => Number.isFinite(id));
  return ids.length > 0 ? new Set(ids) : null;
}
