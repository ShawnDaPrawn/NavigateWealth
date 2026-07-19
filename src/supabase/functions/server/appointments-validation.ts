/**
 * Appointment Booking — Zod schemas (Phase 1)
 *
 * Mirrors the shared-calendar-validation style. The appointment flow is
 * stricter than plain events: exactly one client (with a valid email) is
 * required, virtual meetings validate the pasted join link, in-person
 * meetings require a location, and recurrence is not supported.
 */

import { z } from 'npm:zod';

export const MeetingKindSchema = z.enum(['virtual', 'in_person', 'phone']);

const HttpUrlSchema = z
  .string()
  .url('Meeting link must be a valid URL')
  .refine((value) => /^https?:\/\//i.test(value), {
    message: 'Meeting link must start with http:// or https://',
  });

const AppointmentTimesShape = {
  start_at: z.string().datetime({ message: 'Invalid start date format' }),
  end_at: z.string().datetime({ message: 'Invalid end date format' }),
};

function endAfterStart(data: { start_at: string; end_at: string }): boolean {
  return new Date(data.start_at) < new Date(data.end_at);
}

export const CreateAppointmentSchema = z
  .object({
    title: z.string().min(1, 'Title is required'),
    description: z.string().nullable().optional(),
    ...AppointmentTimesShape,
    meeting_kind: MeetingKindSchema.default('virtual'),
    join_url: HttpUrlSchema.nullable().optional(),
    location: z.string().nullable().optional(),
    client: z.object({
      id: z.string().min(1, 'Client is required'),
      name: z.string().min(1, 'Client name is required'),
      email: z.string().email('Client email is required for appointment emails'),
    }),
  })
  .refine(endAfterStart, {
    message: 'End time must be after start time',
    path: ['end_at'],
  })
  .refine((data) => data.meeting_kind !== 'in_person' || !!data.location?.trim(), {
    message: 'Location is required for in-person appointments',
    path: ['location'],
  });

export const RescheduleAppointmentSchema = z
  .object({
    ...AppointmentTimesShape,
    join_url: HttpUrlSchema.nullable().optional(),
    location: z.string().nullable().optional(),
  })
  .refine(endAfterStart, {
    message: 'End time must be after start time',
    path: ['end_at'],
  });

export const CancelAppointmentSchema = z.object({
  reason: z.string().max(2000).nullable().optional(),
});

const ManageTokenSchema = z.string().min(20, 'Invalid token');

export const PublicManageSchema = z.object({
  token: ManageTokenSchema,
});

export const PublicRescheduleRequestSchema = z.object({
  token: ManageTokenSchema,
  proposed_times: z
    .array(
      z
        .object(AppointmentTimesShape)
        .refine(endAfterStart, { message: 'End time must be after start time' }),
    )
    .max(3, 'Propose at most 3 alternative times')
    .default([]),
  note: z.string().max(2000).nullable().optional(),
});

export const PublicCancelSchema = z.object({
  token: ManageTokenSchema,
  reason: z.string().max(2000).nullable().optional(),
});
