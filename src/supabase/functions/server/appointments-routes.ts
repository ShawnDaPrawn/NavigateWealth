/**
 * Appointment Booking — routes (Phase 1)
 *
 * Mounted at /appointments (see mount-modules.ts). Three access tiers:
 *
 *   Admin  — requireAuth, advisor books/reschedules/cancels and manages
 *            reschedule requests.
 *   Public — tokenized, no login: the client manage page (view details,
 *            propose new times, cancel). Rate-limited like the esign signer
 *            endpoints; callers use the anon key.
 *   Cron   — POST /cron/process-emails drains the scheduled email queue.
 *            Accepts the pg_cron shared header (Vault-seeded, mirrored in KV)
 *            or a Bearer service-role key / super-admin password so it can be
 *            triggered manually for testing.
 */

import { Hono } from 'npm:hono';
import * as kv from './kv_store.tsx';
import { requireAuth } from './auth-mw.ts';
import { asyncHandler } from './error.middleware.ts';
import { rateLimit } from './esign-rate-limit.ts';
import { formatZodError } from './shared-validation-utils.ts';
import { createModuleLogger } from './stderr-logger.ts';
import { constantTimeEqual } from './crypto-utils.ts';
import { AppointmentsService } from './appointments-service.ts';
import {
  CreateAppointmentSchema,
  RescheduleAppointmentSchema,
  CancelAppointmentSchema,
  PublicManageSchema,
  PublicRescheduleRequestSchema,
  PublicCancelSchema,
} from './appointments-validation.ts';

const app = new Hono();
const log = createModuleLogger('appointments-routes');
const service = new AppointmentsService();

export const APPOINTMENTS_CRON_AUTH_KEY = 'system:appointments:cron_auth_token';
export const APPOINTMENTS_CRON_SHARED_HEADER = 'x-appointments-cron-auth';

app.get('/', (c) => c.json({ service: 'appointments', status: 'active' }));

// ── Admin routes ─────────────────────────────────────────────────────────────

/** POST /appointments — book an appointment (event + queue + emails). */
app.post(
  '/',
  requireAuth,
  asyncHandler(async (c) => {
    const body = await c.req.json();
    const parsed = CreateAppointmentSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: 'Validation failed', ...formatZodError(parsed.error) }, 400);
    }
    const userId = c.get('userId') as string;
    const appointment = await service.createAppointment(userId, parsed.data);
    return c.json(appointment);
  }),
);

/** GET /appointments/reschedule-requests?status=open */
app.get(
  '/reschedule-requests',
  requireAuth,
  asyncHandler(async (c) => {
    const status = (c.req.query('status') || 'open') as 'open' | 'resolved' | 'dismissed';
    const userId = c.get('userId') as string;
    const requests = await service.getRescheduleRequests(userId, status);
    return c.json(requests);
  }),
);

/** POST /appointments/reschedule-requests/:id/dismiss */
app.post(
  '/reschedule-requests/:id/dismiss',
  requireAuth,
  asyncHandler(async (c) => {
    const userId = c.get('userId') as string;
    await service.dismissRescheduleRequest(userId, c.req.param('id')!);
    return c.json({ success: true });
  }),
);

/** GET /appointments/by-event/:eventId — appointment details for a calendar event. */
app.get(
  '/by-event/:eventId',
  requireAuth,
  asyncHandler(async (c) => {
    const userId = c.get('userId') as string;
    const appointment = await service.getAppointmentByEventId(userId, c.req.param('eventId')!);
    return c.json(appointment);
  }),
);

/** PUT /appointments/:id/reschedule — new time (and optionally link/location). */
app.put(
  '/:id/reschedule',
  requireAuth,
  asyncHandler(async (c) => {
    const body = await c.req.json();
    const parsed = RescheduleAppointmentSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: 'Validation failed', ...formatZodError(parsed.error) }, 400);
    }
    const userId = c.get('userId') as string;
    const appointment = await service.rescheduleAppointment(
      userId,
      c.req.param('id')!,
      parsed.data,
    );
    return c.json(appointment);
  }),
);

/** POST /appointments/:id/cancel */
app.post(
  '/:id/cancel',
  requireAuth,
  asyncHandler(async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const parsed = CancelAppointmentSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: 'Validation failed', ...formatZodError(parsed.error) }, 400);
    }
    const userId = c.get('userId') as string;
    const appointment = await service.cancelAppointment(
      userId,
      c.req.param('id')!,
      parsed.data.reason,
    );
    return c.json(appointment);
  }),
);

/** POST /appointments/:id/resend-confirmation */
app.post(
  '/:id/resend-confirmation',
  requireAuth,
  asyncHandler(async (c) => {
    const userId = c.get('userId') as string;
    await service.resendConfirmation(userId, c.req.param('id')!);
    return c.json({ success: true });
  }),
);

// ── Public (tokenized) routes ────────────────────────────────────────────────

/** POST /appointments/public/manage — sanitized appointment details. */
app.post(
  '/public/manage',
  rateLimit('SIGNER_ACCESS'),
  asyncHandler(async (c) => {
    const body = await c.req.json();
    const parsed = PublicManageSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: 'Invalid request' }, 400);
    }
    const view = await service.getPublicView(parsed.data.token);
    return c.json(view);
  }),
);

/** POST /appointments/public/reschedule-request — client proposes new times. */
app.post(
  '/public/reschedule-request',
  rateLimit('SIGNER_SUBMIT'),
  asyncHandler(async (c) => {
    const body = await c.req.json();
    const parsed = PublicRescheduleRequestSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: 'Validation failed', ...formatZodError(parsed.error) }, 400);
    }
    await service.createRescheduleRequest(
      parsed.data.token,
      parsed.data.proposed_times,
      parsed.data.note,
    );
    return c.json({ success: true });
  }),
);

/** POST /appointments/public/cancel — client self-service cancellation. */
app.post(
  '/public/cancel',
  rateLimit('SIGNER_SUBMIT'),
  asyncHandler(async (c) => {
    const body = await c.req.json();
    const parsed = PublicCancelSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: 'Invalid request' }, 400);
    }
    await service.publicCancel(parsed.data.token, parsed.data.reason);
    return c.json({ success: true });
  }),
);

// ── Cron ─────────────────────────────────────────────────────────────────────

async function isAuthorizedCronRequest(
  authToken: string,
  sharedToken: string | null,
): Promise<boolean> {
  const normalizedAuth = authToken.trim();
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
  const superAdminPw = Deno.env.get('SUPER_ADMIN_PASSWORD') || '';
  if (
    (serviceRoleKey && constantTimeEqual(normalizedAuth, serviceRoleKey)) ||
    (superAdminPw && constantTimeEqual(normalizedAuth, superAdminPw))
  ) {
    return true;
  }

  const normalizedShared = (sharedToken || '').trim();
  if (!normalizedShared) return false;
  try {
    const stored = await kv.get(APPOINTMENTS_CRON_AUTH_KEY);
    return (
      typeof stored === 'string' &&
      stored.trim().length > 0 &&
      constantTimeEqual(normalizedShared, stored.trim())
    );
  } catch (error) {
    log.warn('Unable to load appointments cron auth token from KV', { error: String(error) });
    return false;
  }
}

/**
 * POST /appointments/cron/process-emails — drain due queue rows.
 * Body (optional, cron-auth only): { nowOverride?: ISO string } to exercise
 * day-before / morning-of sends in tests without waiting.
 */
app.post(
  '/cron/process-emails',
  asyncHandler(async (c) => {
    const authHeader = c.req.header('Authorization') || '';
    const bearer = authHeader.replace(/^Bearer\s+/i, '');
    const shared = c.req.header(APPOINTMENTS_CRON_SHARED_HEADER) || null;
    if (!(await isAuthorizedCronRequest(bearer, shared))) {
      return c.json({ error: 'Unauthorized — cron auth required' }, 401);
    }

    const body = await c.req.json().catch(() => ({}));
    const nowOverride =
      typeof body?.nowOverride === 'string' ? new Date(body.nowOverride).getTime() : undefined;
    const result = await service.processDueEmails({
      nowMs: Number.isFinite(nowOverride) ? nowOverride : undefined,
    });
    return c.json(result);
  }),
);

export default app;
