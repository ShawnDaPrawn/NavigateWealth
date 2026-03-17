/**
 * Calendar Validation Schemas
 * Shared between Frontend and Backend
 */

import { z } from 'npm:zod';
import { 
  EventType, 
  LocationType, 
  ReminderType, 
  ReminderPriority, 
  EventStatus,
  ReminderStatus
} from './shared-calendar-types.ts';

// Enums as Zod Enums
export const EventTypeSchema = z.enum([
  'meeting', 'review', 'call', 'webinar', 'internal', 
  'consultation', 'deadline', 'other'
] as [EventType, ...EventType[]]);

export const LocationTypeSchema = z.enum([
  'in_person', 'video', 'phone', 'virtual', 'other'
] as [LocationType, ...LocationType[]]);

export const EventStatusSchema = z.enum([
  'scheduled', 'completed', 'cancelled', 'rescheduled'
] as [EventStatus, ...EventStatus[]]);

export const ReminderTypeSchema = z.enum([
  'client_review', 'section_14', 'birthday', 'follow_up', 
  'compliance', 'task', 'deadline', 'call', 'email', 'other'
] as [ReminderType, ...ReminderType[]]);

export const ReminderPrioritySchema = z.enum([
  'low', 'normal', 'medium', 'high', 'urgent'
] as [ReminderPriority, ...ReminderPriority[]]);

export const ReminderStatusSchema = z.enum([
  'pending', 'completed', 'overdue', 'dismissed'
] as [ReminderStatus, ...ReminderStatus[]]);

// Create Event Schema
export const CreateEventSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().nullable().optional(),
  event_type: EventTypeSchema.default('meeting'),
  start_at: z.string().datetime({ message: "Invalid start date format" }),
  end_at: z.string().datetime({ message: "Invalid end date format" }),
  location_type: LocationTypeSchema.default('virtual'),
  location: z.string().nullable().optional(),
  video_link: z.string().nullable().optional(),
  client_id: z.string().nullable().optional(),
  attendees: z.array(z.object({ name: z.string().optional(), email: z.string().optional() }).passthrough()).optional(),
  create_reminder: z.boolean().optional(),
  recurrence_rule: z.string().nullable().optional(),
  notes: z.string().optional(),
}).refine(data => {
  return new Date(data.start_at) < new Date(data.end_at);
}, {
  message: "End time must be after start time",
  path: ["end_at"],
});

// Update Event Schema
export const UpdateEventSchema = z.object({
  id: z.string().optional(), // Sometimes passed in body
  title: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  event_type: EventTypeSchema.optional(),
  start_at: z.string().datetime().optional(),
  end_at: z.string().datetime().optional(),
  location_type: LocationTypeSchema.optional(),
  location: z.string().nullable().optional(),
  video_link: z.string().nullable().optional(),
  status: EventStatusSchema.optional(),
  client_id: z.string().nullable().optional(),
  attendees: z.array(z.object({ name: z.string().optional(), email: z.string().optional() }).passthrough()).optional(),
  recurrence_rule: z.string().nullable().optional(),
  notes: z.string().optional(),
});

// Create Reminder Schema
export const CreateReminderSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().nullable().optional(),
  type: ReminderTypeSchema,
  due_at: z.string().datetime({ message: "Invalid due date format" }),
  priority: ReminderPrioritySchema.default('medium'),
  client_id: z.string().nullable().optional(),
  tags: z.array(z.string()).optional(),
  create_event: z.boolean().optional(),
  recurrence_rule: z.string().nullable().optional(),
});

// Update Reminder Schema
export const UpdateReminderSchema = z.object({
  id: z.string().optional(),
  title: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  type: ReminderTypeSchema.optional(),
  due_at: z.string().datetime().optional(),
  priority: ReminderPrioritySchema.optional(),
  client_id: z.string().nullable().optional(),
  status: ReminderStatusSchema.optional(),
  completed_at: z.string().nullable().optional(),
  tags: z.array(z.string()).optional(),
  recurrence_rule: z.string().nullable().optional(),
});