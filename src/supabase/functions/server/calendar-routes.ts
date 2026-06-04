/**
 * Calendar Module - Routes
 * Fresh file moved to root to fix bundling issues
 */

import { Hono } from 'npm:hono';
import { requireAuth } from './auth-mw.ts';
import { asyncHandler } from './error.middleware.ts';

import { CalendarService } from './calendar-service.ts';
import {
  CreateEventSchema,
  UpdateEventSchema,
  CreateReminderSchema,
  UpdateReminderSchema,
} from './shared-calendar-validation.ts';
import { formatZodError } from './shared-validation-utils.ts';
import type { EventType, EventStatus, ReminderStatus } from './shared-calendar-types.ts';
import type { EventCreate, EventUpdate } from './calendar-types.ts';

const app = new Hono();
const service = new CalendarService();

// Root handlers
app.get('/', (c) => c.json({ service: 'calendar', status: 'active' }));

/**
 * GET /calendar/events
 * Get calendar events
 */
app.get(
  '/events',
  requireAuth,
  asyncHandler(async (c) => {
    const start = c.req.query('start');
    const end = c.req.query('end');
    const search = c.req.query('search');
    const clientId = c.req.query('clientId');
    const eventTypes = c.req.query('eventTypes')?.split(',') as EventType[] | undefined;
    const eventStatuses = c.req.query('eventStatuses')?.split(',') as EventStatus[] | undefined;

    const userId = c.get('userId') as string;

    const events = await service.getEvents(userId, {
      start: start ? new Date(start) : undefined,
      end: end ? new Date(end) : undefined,
      search,
      clientId,
      eventTypes,
      eventStatuses,
    });

    return c.json(events);
  }),
);

/**
 * POST /calendar/events
 * Create new event
 */
app.post(
  '/events',
  requireAuth,
  asyncHandler(async (c) => {
    const body = await c.req.json();
    const parsed = CreateEventSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: 'Validation failed', ...formatZodError(parsed.error) }, 400);
    }
    const userId = c.get('userId') as string;
    const event = await service.createEvent(userId, parsed.data as EventCreate);
    return c.json(event);
  }),
);

/**
 * PUT /calendar/events/:id
 * Update event
 */
app.put(
  '/events/:id',
  requireAuth,
  asyncHandler(async (c) => {
    const id = c.req.param('id')!;
    const body = await c.req.json();
    const parsed = UpdateEventSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: 'Validation failed', ...formatZodError(parsed.error) }, 400);
    }
    const userId = c.get('userId') as string;
    const event = await service.updateEvent(userId, id, parsed.data as EventUpdate);
    return c.json(event);
  }),
);

/**
 * DELETE /calendar/events/:id
 * Delete event
 */
app.delete(
  '/events/:id',
  requireAuth,
  asyncHandler(async (c) => {
    const id = c.req.param('id')!;
    const userId = c.get('userId') as string;
    await service.deleteEvent(userId, id);
    return c.json({ success: true });
  }),
);

/**
 * GET /calendar/reminders
 * Get reminders
 */
app.get(
  '/reminders',
  requireAuth,
  asyncHandler(async (c) => {
    const status = c.req.query('status') as ReminderStatus | undefined;
    const userId = c.get('userId') as string;

    const reminders = await service.getReminders(userId, { status });
    return c.json(reminders);
  }),
);

/**
 * POST /calendar/reminders
 * Create new reminder
 */
app.post(
  '/reminders',
  requireAuth,
  asyncHandler(async (c) => {
    const body = await c.req.json();
    const parsed = CreateReminderSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: 'Validation failed', ...formatZodError(parsed.error) }, 400);
    }
    const userId = c.get('userId') as string;
    const reminder = await service.createReminder(userId, parsed.data);
    return c.json(reminder);
  }),
);

/**
 * PUT /calendar/reminders/:id
 * Update reminder
 */
app.put(
  '/reminders/:id',
  requireAuth,
  asyncHandler(async (c) => {
    const id = c.req.param('id')!;
    const body = await c.req.json();
    const parsed = UpdateReminderSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: 'Validation failed', ...formatZodError(parsed.error) }, 400);
    }
    const userId = c.get('userId') as string;
    const reminder = await service.updateReminder(userId, id, parsed.data);
    return c.json(reminder);
  }),
);

/**
 * DELETE /calendar/reminders/:id
 * Delete reminder
 */
app.delete(
  '/reminders/:id',
  requireAuth,
  asyncHandler(async (c) => {
    const id = c.req.param('id')!;
    const userId = c.get('userId') as string;
    await service.deleteReminder(userId, id);
    return c.json({ success: true });
  }),
);

export default app;
