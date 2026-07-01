/**
 * Appointment Booking — service layer (Phase 1)
 *
 * Orchestrates the appointment lifecycle around the existing calendar events
 * table:
 *
 *   book       → events row (via CalendarService) + appointments row +
 *                scheduled email queue (confirmation now, day-before,
 *                morning-of 07:00 SAST, starting-soon T−5min)
 *   reschedule → event times updated, ICS SEQUENCE bumped, pending queue rows
 *                cancelled and recomputed, 'rescheduled' email queued
 *   cancel     → statuses flipped, pending queue rows cancelled, 'cancelled'
 *                email (ICS METHOD:CANCEL) queued
 *
 * Every client email flows through the appointment_emails queue and is sent
 * by processDueEmails() (driven by pg_cron every minute) — one idempotent
 * send path, no inline sends to keep in sync.
 *
 * All access uses the service-role client with created_by ownership checks in
 * code, same as CalendarService.
 */

import { createClient, type SupabaseClient } from 'jsr:@supabase/supabase-js@2.49.8';
import { createModuleLogger } from './stderr-logger.ts';
import { ValidationError, NotFoundError } from './error.middleware.ts';
import { CalendarService } from './calendar-service.ts';
import {
  sendAppointmentClientEmail,
  sendRescheduleRequestedAdvisorEmail,
  sendAppointmentCancelledAdvisorEmail,
  formatSastDate,
  formatSastTime,
  type AppointmentClientEmailType,
} from './email-senders-appointments.ts';
import type {
  AppointmentRecord,
  AppointmentEmailRecord,
  AppointmentEmailType,
  MeetingKind,
  ProposedTime,
  PublicAppointmentView,
  RescheduleRequestRecord,
} from './appointments-types.ts';

const log = createModuleLogger('appointments-service');

const MANAGE_PAGE_BASE = 'https://www.navigatewealth.co/appointment';
const ICS_UID_DOMAIN = 'navigatewealth.co';
const SAST_OFFSET_MS = 2 * 60 * 60 * 1000;
const MANAGE_TOKEN_GRACE_MS = 7 * 24 * 60 * 60 * 1000; // token lives until end_at + 7d
const MAX_SEND_ATTEMPTS = 3;
const RETRY_DELAY_MS = 2 * 60 * 1000;
/** starting_soon is pointless once the meeting is well underway. */
const STARTING_SOON_GRACE_MS = 10 * 60 * 1000;

function createServiceClient(): SupabaseClient {
  return createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
}

/** 32 random bytes, base64url — the public manage-page credential. */
export function generateManageToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// ── Email schedule computation ───────────────────────────────────────────────

export interface ScheduledEmailPlan {
  email_type: AppointmentEmailType;
  scheduled_at: string;
}

/** 07:00 SAST on the SAST calendar date of `startMs`, expressed in UTC. */
export function morningOfUtcMs(startMs: number): number {
  const sast = new Date(startMs + SAST_OFFSET_MS);
  // 07:00 SAST == 05:00 UTC
  return Date.UTC(sast.getUTCFullYear(), sast.getUTCMonth(), sast.getUTCDate(), 5, 0, 0);
}

/**
 * Compute which lifecycle emails to queue for an appointment starting at
 * `startAtIso`, as seen from `nowMs`. Pure — unit tested.
 *
 * Rules:
 *   • immediate email first: 'confirmation' on booking, 'rescheduled' on
 *     reschedule
 *   • reminders only when they still fit: scheduled_at must be >60s away and
 *     before the appointment starts (late bookings simply skip past-due ones)
 *   • morning_of is dropped for early-morning meetings where it would land
 *     within 35 minutes of the start — it would arrive on top of
 *     starting_soon and read as spam
 */
export function computeEmailSchedule(
  startAtIso: string,
  nowMs: number,
  immediateType: 'confirmation' | 'rescheduled' = 'confirmation',
): ScheduledEmailPlan[] {
  const startMs = new Date(startAtIso).getTime();
  const plans: ScheduledEmailPlan[] = [
    { email_type: immediateType, scheduled_at: new Date(nowMs).toISOString() },
  ];

  const dayBeforeMs = startMs - 24 * 60 * 60 * 1000;
  const morningMs = morningOfUtcMs(startMs);
  const startingSoonMs = startMs - 5 * 60 * 1000;

  const fits = (ts: number) => ts > nowMs + 60_000 && ts < startMs;

  if (fits(dayBeforeMs)) {
    plans.push({ email_type: 'day_before', scheduled_at: new Date(dayBeforeMs).toISOString() });
  }
  if (fits(morningMs) && startMs - morningMs > 35 * 60 * 1000) {
    plans.push({ email_type: 'morning_of', scheduled_at: new Date(morningMs).toISOString() });
  }
  if (fits(startingSoonMs)) {
    plans.push({
      email_type: 'starting_soon',
      scheduled_at: new Date(startingSoonMs).toISOString(),
    });
  }

  return plans;
}

// ── Inputs ───────────────────────────────────────────────────────────────────

export interface CreateAppointmentInput {
  title: string;
  description?: string | null;
  start_at: string;
  end_at: string;
  meeting_kind: MeetingKind;
  join_url?: string | null;
  location?: string | null;
  client: { id: string; name: string; email: string };
}

export interface RescheduleAppointmentInput {
  start_at: string;
  end_at: string;
  join_url?: string | null;
  location?: string | null;
}

interface EventRow {
  id: string;
  title: string;
  description: string | null;
  start_at: string;
  end_at: string;
}

const LOCATION_TYPE_BY_KIND: Record<MeetingKind, 'video' | 'in_person' | 'phone'> = {
  // 'video' rather than 'virtual': the live location_type enum predates the
  // 'virtual' value (added in migration 20260701000001) and 'video' is safe
  // on both old and new databases.
  virtual: 'video',
  in_person: 'in_person',
  phone: 'phone',
};

export class AppointmentsService {
  private supabase = createServiceClient();
  private calendar = new CalendarService();

  // ── Advisor contact lookup ────────────────────────────────────────────────

  private async getAdvisorContact(userId: string): Promise<{ email: string | null; name: string }> {
    try {
      const {
        data: { user },
        error,
      } = await this.supabase.auth.admin.getUserById(userId);
      if (error || !user) return { email: null, name: 'Navigate Wealth' };
      const meta = (user.user_metadata || {}) as Record<string, unknown>;
      const name =
        [meta.firstName, meta.surname].filter(Boolean).join(' ') ||
        (meta.name as string) ||
        'Navigate Wealth';
      return { email: user.email ?? null, name };
    } catch (error) {
      log.warn('Failed to resolve advisor contact', { userId, error: String(error) });
      return { email: null, name: 'Navigate Wealth' };
    }
  }

  // ── Booking ───────────────────────────────────────────────────────────────

  async createAppointment(
    userId: string,
    input: CreateAppointmentInput,
  ): Promise<AppointmentRecord> {
    log.info('Creating appointment', { userId });

    if (input.meeting_kind === 'in_person' && !input.location?.trim()) {
      throw new ValidationError('Location is required for in-person appointments');
    }

    // The events.client_id FK targets public.clients, but clients live in
    // auth.users — upsert the snapshot row first so the FK holds. If the
    // upsert fails we still book, just without the event→client link (the
    // appointment row keeps its own snapshot).
    let eventClientId: string | null = input.client.id;
    const { error: clientUpsertError } = await this.supabase.from('clients').upsert(
      {
        id: input.client.id,
        full_name: input.client.name,
        email: input.client.email,
        created_by: userId,
      },
      { onConflict: 'id' },
    );
    if (clientUpsertError) {
      log.warn('Client upsert failed; creating event without client link', {
        error: clientUpsertError.message,
      });
      eventClientId = null;
    }

    const event = await this.calendar.createEvent(userId, {
      title: input.title,
      description: input.description ?? null,
      event_type: 'appointment',
      start_at: input.start_at,
      end_at: input.end_at,
      location_type: LOCATION_TYPE_BY_KIND[input.meeting_kind],
      location: input.location ?? null,
      video_link: input.meeting_kind === 'virtual' ? (input.join_url ?? null) : null,
      client_id: eventClientId,
    });

    const appointmentId = crypto.randomUUID();
    const appointment: Partial<AppointmentRecord> = {
      id: appointmentId,
      event_id: event.id,
      client_id: input.client.id,
      client_email: input.client.email,
      client_name: input.client.name,
      meeting_kind: input.meeting_kind,
      join_url: input.meeting_kind === 'virtual' ? (input.join_url ?? null) : null,
      location: input.location ?? null,
      ics_uid: `${appointmentId}@${ICS_UID_DOMAIN}`,
      ics_sequence: 0,
      manage_token: generateManageToken(),
      manage_token_expires_at: new Date(
        new Date(input.end_at).getTime() + MANAGE_TOKEN_GRACE_MS,
      ).toISOString(),
      status: 'confirmed',
      created_by: userId,
    };

    const { data: created, error } = await this.supabase
      .from('appointments')
      .insert(appointment)
      .select('*')
      .single();

    if (error) {
      // Don't leave an orphan calendar event behind.
      await this.calendar.deleteEvent(userId, event.id).catch(() => undefined);
      log.error('Error creating appointment', error);
      throw error;
    }

    await this.queueEmails(created.id, computeEmailSchedule(input.start_at, Date.now()));

    log.success('Appointment created', { userId, appointmentId: created.id, eventId: event.id });
    return created;
  }

  // ── Reschedule / cancel (advisor) ─────────────────────────────────────────

  async rescheduleAppointment(
    userId: string,
    appointmentId: string,
    input: RescheduleAppointmentInput,
  ): Promise<AppointmentRecord> {
    const appointment = await this.getOwnedAppointment(userId, appointmentId);
    if (appointment.status === 'cancelled') {
      throw new ValidationError('Cannot reschedule a cancelled appointment');
    }

    await this.calendar.updateEvent(userId, appointment.event_id, {
      start_at: input.start_at,
      end_at: input.end_at,
      ...(input.join_url !== undefined && appointment.meeting_kind === 'virtual'
        ? { video_link: input.join_url }
        : {}),
      ...(input.location !== undefined ? { location: input.location } : {}),
    });

    const updates: Partial<AppointmentRecord> = {
      status: 'confirmed',
      ics_sequence: appointment.ics_sequence + 1,
      manage_token_expires_at: new Date(
        new Date(input.end_at).getTime() + MANAGE_TOKEN_GRACE_MS,
      ).toISOString(),
    };
    if (input.join_url !== undefined && appointment.meeting_kind === 'virtual') {
      updates.join_url = input.join_url;
    }
    if (input.location !== undefined) {
      updates.location = input.location;
    }

    const { data: updated, error } = await this.supabase
      .from('appointments')
      .update(updates)
      .eq('id', appointmentId)
      .select('*')
      .single();
    if (error) {
      log.error('Error updating appointment', error);
      throw error;
    }

    // Resolve any open reschedule request — this reschedule is the answer.
    await this.supabase
      .from('appointment_reschedule_requests')
      .update({ status: 'resolved', resolved_at: new Date().toISOString(), resolved_by: userId })
      .eq('appointment_id', appointmentId)
      .eq('status', 'open');

    await this.cancelPendingEmails(appointmentId);
    await this.queueEmails(
      appointmentId,
      computeEmailSchedule(input.start_at, Date.now(), 'rescheduled'),
    );

    log.success('Appointment rescheduled', { userId, appointmentId });
    return updated;
  }

  async cancelAppointment(
    userId: string,
    appointmentId: string,
    _reason?: string | null,
  ): Promise<AppointmentRecord> {
    const appointment = await this.getOwnedAppointment(userId, appointmentId);
    return await this.doCancel(appointment, { notifyAdvisor: false });
  }

  async resendConfirmation(userId: string, appointmentId: string): Promise<void> {
    const appointment = await this.getOwnedAppointment(userId, appointmentId);
    if (appointment.status === 'cancelled') {
      throw new ValidationError('Cannot resend a cancelled appointment');
    }
    // The partial unique index tolerates only one live row per type; clear any
    // still-pending confirmation first.
    await this.supabase
      .from('appointment_emails')
      .update({ status: 'cancelled' })
      .eq('appointment_id', appointmentId)
      .in('email_type', ['confirmation', 'rescheduled'])
      .in('status', ['pending', 'processing']);

    const type = appointment.ics_sequence > 0 ? 'rescheduled' : 'confirmation';
    await this.queueEmails(appointmentId, [
      { email_type: type, scheduled_at: new Date().toISOString() },
    ]);
  }

  async getAppointmentByEventId(userId: string, eventId: string): Promise<AppointmentRecord> {
    const { data, error } = await this.supabase
      .from('appointments')
      .select(
        'id, event_id, client_id, client_email, client_name, timezone, meeting_kind, join_url, location, meeting_provider, ics_uid, ics_sequence, status, cancelled_at, created_by, created_at, updated_at',
      )
      .eq('event_id', eventId)
      .eq('created_by', userId)
      .single();
    if (error || !data) throw new NotFoundError('Appointment not found');
    return data as AppointmentRecord;
  }

  // ── Reschedule requests (advisor) ─────────────────────────────────────────

  async getRescheduleRequests(
    userId: string,
    status: 'open' | 'resolved' | 'dismissed' = 'open',
  ): Promise<Array<RescheduleRequestRecord & { appointment: Record<string, unknown> }>> {
    const { data, error } = await this.supabase
      .from('appointment_reschedule_requests')
      .select(
        '*, appointment:appointments!inner(id, event_id, client_name, client_email, meeting_kind, status, created_by)',
      )
      .eq('status', status)
      .eq('appointment.created_by', userId)
      .order('created_at', { ascending: false });
    if (error) {
      log.error('Error fetching reschedule requests', error);
      throw error;
    }

    const requests = (data || []) as Array<
      RescheduleRequestRecord & { appointment: Record<string, unknown> }
    >;

    // Attach event title/times for display (batch, avoids a deep nested join).
    const eventIds = [
      ...new Set(requests.map((r) => r.appointment?.event_id).filter(Boolean)),
    ] as string[];
    if (eventIds.length > 0) {
      const { data: events } = await this.supabase
        .from('events')
        .select('id, title, start_at, end_at')
        .in('id', eventIds);
      const byId = new Map((events || []).map((e: EventRow) => [e.id, e]));
      for (const request of requests) {
        request.appointment.event = byId.get(request.appointment.event_id as string) ?? null;
      }
    }

    return requests;
  }

  async dismissRescheduleRequest(userId: string, requestId: string): Promise<void> {
    const { data, error } = await this.supabase
      .from('appointment_reschedule_requests')
      .select('id, appointment:appointments!inner(id, created_by, status)')
      .eq('id', requestId)
      .single();
    if (error || !data || (data.appointment as { created_by: string }).created_by !== userId) {
      throw new NotFoundError('Reschedule request not found');
    }

    await this.supabase
      .from('appointment_reschedule_requests')
      .update({ status: 'dismissed', resolved_at: new Date().toISOString(), resolved_by: userId })
      .eq('id', requestId);

    // Back to confirmed — the standing appointment time remains.
    const appointment = data.appointment as { id: string; status: string };
    if (appointment.status === 'reschedule_requested') {
      await this.supabase
        .from('appointments')
        .update({ status: 'confirmed' })
        .eq('id', appointment.id);
    }
  }

  // ── Public (tokenized) access ─────────────────────────────────────────────

  private async getByManageToken(
    token: string,
  ): Promise<{ appointment: AppointmentRecord; event: EventRow }> {
    const { data: appointment, error } = await this.supabase
      .from('appointments')
      .select('*')
      .eq('manage_token', token)
      .single();
    if (error || !appointment) throw new NotFoundError('Appointment not found');
    if (new Date(appointment.manage_token_expires_at).getTime() < Date.now()) {
      throw new NotFoundError('This appointment link has expired');
    }

    const { data: event, error: eventError } = await this.supabase
      .from('events')
      .select('id, title, description, start_at, end_at')
      .eq('id', appointment.event_id)
      .single();
    if (eventError || !event) throw new NotFoundError('Appointment not found');

    return { appointment: appointment as AppointmentRecord, event: event as EventRow };
  }

  async getPublicView(token: string): Promise<PublicAppointmentView> {
    const { appointment, event } = await this.getByManageToken(token);
    const advisor = await this.getAdvisorContact(appointment.created_by);
    const { count } = await this.supabase
      .from('appointment_reschedule_requests')
      .select('id', { count: 'exact', head: true })
      .eq('appointment_id', appointment.id)
      .eq('status', 'open');

    return {
      title: event.title,
      description: event.description,
      start_at: event.start_at,
      end_at: event.end_at,
      meeting_kind: appointment.meeting_kind,
      join_url: appointment.status === 'confirmed' ? appointment.join_url : null,
      location: appointment.location,
      status: appointment.status,
      advisor_name: advisor.name,
      has_open_reschedule_request: (count ?? 0) > 0,
    };
  }

  async createRescheduleRequest(
    token: string,
    proposedTimes: ProposedTime[],
    note?: string | null,
  ): Promise<void> {
    const { appointment, event } = await this.getByManageToken(token);
    if (appointment.status === 'cancelled') {
      throw new ValidationError('This appointment has been cancelled');
    }

    const nowMs = Date.now();
    for (const time of proposedTimes) {
      if (new Date(time.start_at).getTime() <= nowMs) {
        throw new ValidationError('Proposed times must be in the future');
      }
    }

    const { count } = await this.supabase
      .from('appointment_reschedule_requests')
      .select('id', { count: 'exact', head: true })
      .eq('appointment_id', appointment.id)
      .eq('status', 'open');
    if ((count ?? 0) > 0) {
      throw new ValidationError(
        'A reschedule request is already pending — your advisor will be in touch',
      );
    }

    const { error } = await this.supabase.from('appointment_reschedule_requests').insert({
      appointment_id: appointment.id,
      proposed_times: proposedTimes,
      note: note ?? null,
    });
    if (error) {
      log.error('Error creating reschedule request', error);
      throw error;
    }

    await this.supabase
      .from('appointments')
      .update({ status: 'reschedule_requested' })
      .eq('id', appointment.id);

    // Advisor notification email goes through the queue (single send path)…
    await this.queueEmails(appointment.id, [
      { email_type: 'reschedule_requested_advisor', scheduled_at: new Date().toISOString() },
    ]);

    // …plus an in-app reminder so it surfaces in the Reminders UI immediately.
    await this.calendar
      .createReminder(appointment.created_by, {
        title: `Reschedule requested: ${appointment.client_name} — ${event.title}`,
        description: note
          ? `Client note: ${note}`
          : 'The client requested a new time via the appointment manage page.',
        type: 'follow_up',
        due_at: new Date().toISOString(),
        priority: 'high',
        client_id: null,
      })
      .catch((error) => log.warn('Failed to create reschedule reminder', { error: String(error) }));

    log.success('Reschedule request created', { appointmentId: appointment.id });
  }

  async publicCancel(token: string, reason?: string | null): Promise<void> {
    const { appointment } = await this.getByManageToken(token);
    if (appointment.status === 'cancelled') return; // idempotent
    await this.doCancel(appointment, { notifyAdvisor: true, reason });
  }

  // ── Shared cancel path ────────────────────────────────────────────────────

  private async doCancel(
    appointment: AppointmentRecord,
    opts: { notifyAdvisor: boolean; reason?: string | null },
  ): Promise<AppointmentRecord> {
    const nowIso = new Date().toISOString();

    const { data: updated, error } = await this.supabase
      .from('appointments')
      .update({ status: 'cancelled', cancelled_at: nowIso })
      .eq('id', appointment.id)
      .select('*')
      .single();
    if (error) {
      log.error('Error cancelling appointment', error);
      throw error;
    }

    await this.supabase
      .from('events')
      .update({ status: 'cancelled' })
      .eq('id', appointment.event_id);

    await this.supabase
      .from('appointment_reschedule_requests')
      .update({ status: 'dismissed', resolved_at: nowIso })
      .eq('appointment_id', appointment.id)
      .eq('status', 'open');

    await this.cancelPendingEmails(appointment.id);
    await this.queueEmails(appointment.id, [{ email_type: 'cancelled', scheduled_at: nowIso }]);

    if (opts.notifyAdvisor) {
      const { data: event } = await this.supabase
        .from('events')
        .select('id, title, start_at, end_at')
        .eq('id', appointment.event_id)
        .single();
      const advisor = await this.getAdvisorContact(appointment.created_by);
      if (advisor.email && event) {
        await sendAppointmentCancelledAdvisorEmail({
          to: advisor.email,
          clientName: appointment.client_name,
          title: event.title,
          startAt: event.start_at,
          reason: opts.reason,
        }).catch((error) =>
          log.warn('Failed to send advisor cancel notification', { error: String(error) }),
        );
      }
      await this.calendar
        .createReminder(appointment.created_by, {
          title: `Appointment cancelled by client: ${appointment.client_name}`,
          description: opts.reason ? `Client reason: ${opts.reason}` : null,
          type: 'follow_up',
          due_at: nowIso,
          priority: 'high',
          client_id: null,
        })
        .catch((error) => log.warn('Failed to create cancel reminder', { error: String(error) }));
    }

    log.success('Appointment cancelled', { appointmentId: appointment.id });
    return updated;
  }

  // ── Queue helpers ─────────────────────────────────────────────────────────

  private async queueEmails(appointmentId: string, plans: ScheduledEmailPlan[]): Promise<void> {
    if (plans.length === 0) return;
    const { error } = await this.supabase.from('appointment_emails').insert(
      plans.map((plan) => ({
        appointment_id: appointmentId,
        email_type: plan.email_type,
        scheduled_at: plan.scheduled_at,
      })),
    );
    if (error) {
      log.error('Error queueing appointment emails', error);
      throw error;
    }
  }

  private async cancelPendingEmails(appointmentId: string): Promise<void> {
    await this.supabase
      .from('appointment_emails')
      .update({ status: 'cancelled' })
      .eq('appointment_id', appointmentId)
      .eq('status', 'pending');
  }

  private async getOwnedAppointment(
    userId: string,
    appointmentId: string,
  ): Promise<AppointmentRecord> {
    const { data, error } = await this.supabase
      .from('appointments')
      .select('*')
      .eq('id', appointmentId)
      .eq('created_by', userId)
      .single();
    if (error || !data) throw new NotFoundError('Appointment not found');
    return data as AppointmentRecord;
  }

  // ── Cron: drain due emails ────────────────────────────────────────────────

  async processDueEmails(opts: { nowMs?: number; batchSize?: number } = {}): Promise<{
    processed: number;
    sent: number;
    skipped: number;
    failed: number;
  }> {
    const nowMs = opts.nowMs ?? Date.now();
    const batchSize = opts.batchSize ?? 25;
    const counters = { processed: 0, sent: 0, skipped: 0, failed: 0 };

    const { data: due, error } = await this.supabase
      .from('appointment_emails')
      .select('*')
      .eq('status', 'pending')
      .lte('scheduled_at', new Date(nowMs).toISOString())
      .order('scheduled_at', { ascending: true })
      .limit(batchSize);
    if (error) {
      log.error('Error fetching due appointment emails', error);
      throw error;
    }

    for (const row of (due || []) as AppointmentEmailRecord[]) {
      // Atomic claim — a concurrent run that already claimed it matches 0 rows.
      const { data: claimed } = await this.supabase
        .from('appointment_emails')
        .update({ status: 'processing', attempts: row.attempts + 1 })
        .eq('id', row.id)
        .eq('status', 'pending')
        .select('id');
      if (!claimed || claimed.length === 0) continue;

      counters.processed += 1;
      try {
        const outcome = await this.sendQueuedEmail(row, nowMs);
        await this.supabase
          .from('appointment_emails')
          .update(
            outcome === 'sent'
              ? { status: 'sent', sent_at: new Date().toISOString() }
              : { status: 'skipped' },
          )
          .eq('id', row.id);
        counters[outcome] += 1;
      } catch (sendError) {
        const message = sendError instanceof Error ? sendError.message : String(sendError);
        const exhausted = row.attempts + 1 >= MAX_SEND_ATTEMPTS;
        await this.supabase
          .from('appointment_emails')
          .update(
            exhausted
              ? { status: 'failed', last_error: message }
              : {
                  status: 'pending',
                  last_error: message,
                  scheduled_at: new Date(nowMs + RETRY_DELAY_MS).toISOString(),
                },
          )
          .eq('id', row.id);
        if (exhausted) counters.failed += 1;
        log.warn('Appointment email send failed', {
          emailId: row.id,
          emailType: row.email_type,
          attempts: row.attempts + 1,
          exhausted,
          error: message,
        });
      }
    }

    if (counters.processed > 0) {
      log.info('Processed appointment emails', counters);
    }
    return counters;
  }

  /** Send one claimed queue row. Returns 'sent' or 'skipped'; throws on failure. */
  private async sendQueuedEmail(
    row: AppointmentEmailRecord,
    nowMs: number,
  ): Promise<'sent' | 'skipped'> {
    const { data: appointment } = await this.supabase
      .from('appointments')
      .select('*')
      .eq('id', row.appointment_id)
      .single();
    if (!appointment) return 'skipped';

    const { data: event } = await this.supabase
      .from('events')
      .select('id, title, description, start_at, end_at')
      .eq('id', appointment.event_id)
      .single();
    if (!event) return 'skipped';

    const startMs = new Date(event.start_at).getTime();

    // Guards: don't remind about cancelled or already-started appointments.
    if (appointment.status === 'cancelled' && row.email_type !== 'cancelled') return 'skipped';
    if ((row.email_type === 'day_before' || row.email_type === 'morning_of') && startMs < nowMs) {
      return 'skipped';
    }
    if (row.email_type === 'starting_soon' && nowMs > startMs + STARTING_SOON_GRACE_MS) {
      return 'skipped';
    }

    if (row.email_type === 'reschedule_requested_advisor') {
      const advisor = await this.getAdvisorContact(appointment.created_by);
      if (!advisor.email) return 'skipped';
      const { data: request } = await this.supabase
        .from('appointment_reschedule_requests')
        .select('*')
        .eq('appointment_id', appointment.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      const ok = await sendRescheduleRequestedAdvisorEmail({
        to: advisor.email,
        clientName: appointment.client_name,
        title: event.title,
        startAt: event.start_at,
        proposedTimes: (request?.proposed_times ?? []) as ProposedTime[],
        note: request?.note,
      });
      if (!ok) throw new Error('SendGrid send failed');
      return 'sent';
    }

    const advisor = await this.getAdvisorContact(appointment.created_by);
    const ok = await sendAppointmentClientEmail(row.email_type as AppointmentClientEmailType, {
      to: appointment.client_email,
      clientName: appointment.client_name,
      advisorName: advisor.name,
      title: event.title,
      startAt: event.start_at,
      endAt: event.end_at,
      meetingKind: appointment.meeting_kind,
      joinUrl: appointment.join_url,
      location: appointment.location,
      description: event.description,
      manageUrl: `${MANAGE_PAGE_BASE}?token=${appointment.manage_token}`,
      icsUid: appointment.ics_uid,
      icsSequence: appointment.ics_sequence,
    });
    if (!ok) throw new Error('SendGrid send failed');
    return 'sent';
  }
}

export { formatSastDate, formatSastTime };
