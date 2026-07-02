/**
 * Appointment Booking — types (Phase 1)
 *
 * Row shapes for the appointments tables (see migration
 * 20260701000002_appointments_core_tables.sql) plus the public-page DTO.
 */

export type MeetingKind = 'virtual' | 'in_person' | 'phone';

export type AppointmentStatus = 'confirmed' | 'reschedule_requested' | 'cancelled' | 'completed';

export type AppointmentEmailType =
  | 'confirmation'
  | 'day_before'
  | 'morning_of'
  | 'starting_soon'
  | 'rescheduled'
  | 'cancelled'
  | 'reschedule_requested_advisor';

export type AppointmentEmailStatus =
  | 'pending'
  | 'processing'
  | 'sent'
  | 'failed'
  | 'cancelled'
  | 'skipped';

export interface AppointmentRecord {
  id: string;
  event_id: string;
  client_id: string | null;
  client_email: string;
  client_name: string;
  timezone: string;
  meeting_kind: MeetingKind;
  join_url: string | null;
  location: string | null;
  meeting_provider: string;
  ics_uid: string;
  ics_sequence: number;
  manage_token: string;
  manage_token_expires_at: string;
  status: AppointmentStatus;
  cancelled_at: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface AppointmentEmailRecord {
  id: string;
  appointment_id: string;
  email_type: AppointmentEmailType;
  scheduled_at: string;
  status: AppointmentEmailStatus;
  attempts: number;
  last_error: string | null;
  sent_at: string | null;
  created_at: string;
}

export interface ProposedTime {
  start_at: string;
  end_at: string;
}

export interface RescheduleRequestRecord {
  id: string;
  appointment_id: string;
  proposed_times: ProposedTime[];
  note: string | null;
  status: 'open' | 'resolved' | 'dismissed';
  created_at: string;
  resolved_at: string | null;
  resolved_by: string | null;
}

/** Sanitized appointment shape returned to the public manage page (no
 *  tokens, no internal ids beyond what the page needs). */
export interface PublicAppointmentView {
  title: string;
  description: string | null;
  start_at: string;
  end_at: string;
  meeting_kind: MeetingKind;
  /** Only exposed while the appointment is confirmed */
  join_url: string | null;
  location: string | null;
  status: AppointmentStatus;
  advisor_name: string;
  has_open_reschedule_request: boolean;
}
