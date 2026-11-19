/**
 * The consultation booking's rules and options — the meeting formats, the
 * bookable dates, the time slots and the steps — shared by both designs of
 * the booking flow: ConsultationModal (the live site) and the Navigator
 * redesign's /schedule-consultation page. Moved here verbatim from
 * ConsultationModal so the two can never offer different choices.
 *
 * POST /consultation/request enforces the same date and time rules on the
 * server (src/supabase/functions/server/consultation.ts).
 */
import { Video, PhoneCall, MapPin } from 'lucide-react';
import { COMPANY } from '@/config/companyFacts';
import { startOfDay, addDays, isBefore } from 'date-fns';

// ── Helpers ───────────────────────────────────────────────────────────────────

export const getCurrentSASTTime = () =>
  new Date(new Date().toLocaleString('en-US', { timeZone: 'Africa/Johannesburg' }));

export const isWeekend = (date: Date): boolean => date.getDay() === 0 || date.getDay() === 6;

/**
 * Returns the earliest bookable date.
 *
 * Policy: bookings require at least one full business day for scheduling.
 * Today and the next business day are both disabled. The first available
 * date is the second business day from today.
 *
 * Examples (SAST):
 *   Monday    → Wednesday
 *   Thursday  → Monday   (Fri skipped, Sat/Sun are weekends)
 *   Friday    → Tuesday  (Mon is next biz day → skip, Sat/Sun weekends)
 */
export const getMinBookingDate = (): Date => {
  const today = startOfDay(getCurrentSASTTime());
  let date = addDays(today, 1);

  // Advance past weekends to find the next business day
  while (isWeekend(date)) date = addDays(date, 1);

  // That's the next business day — skip it
  date = addDays(date, 1);

  // Advance past weekends again to land on the first available business day
  while (isWeekend(date)) date = addDays(date, 1);

  return date;
};

/** True if the calendar day cannot be booked (weekends or before earliest bookable date). */
export const isBookingDateDisabled = (date: Date): boolean => {
  const d = startOfDay(date);
  const minDate = getMinBookingDate();
  return isBefore(d, minDate) || isWeekend(d);
};

/** Calendar day is strictly before “today” in SAST (for past styling). */
export const isPastCalendarDay = (date: Date): boolean =>
  isBefore(startOfDay(date), startOfDay(getCurrentSASTTime()));

export type MeetingTypeId = 'virtual' | 'telephonic' | 'in_person';

/** Meeting formats offered. In-person meetings are at the Pretoria office. */
export const MEETING_TYPES: readonly {
  id: MeetingTypeId;
  icon: typeof Video;
  title: string;
  subtitle: string;
  detail: string;
}[] = [
  {
    id: 'virtual',
    icon: Video,
    title: 'Virtual Meeting',
    subtitle: 'Video call via Microsoft Teams or Zoom',
    detail: 'Best for screen sharing and document review',
  },
  {
    id: 'telephonic',
    icon: PhoneCall,
    title: 'Telephonic Meeting',
    subtitle: 'Voice call via telephone',
    detail: 'Quick and convenient for initial consultations',
  },
  {
    id: 'in_person',
    icon: MapPin,
    title: 'In-Person Meeting',
    subtitle: `At our office, ${COMPANY.office}`,
    detail: 'Meet face to face to go through your plans',
  },
];

/**
 * Generates 30-minute time slots within office hours (08:30 – 16:30 SAST).
 * The last slot starts at 16:00 so a meeting ends by closing time.
 *
 * Because the earliest bookable date is always at least two business days
 * out, there is no need to filter past slots for the current time.
 */
export const generateTimeSlots = (): string[] => {
  const slots: string[] = [];
  for (let hour = 8; hour <= 16; hour++) {
    for (const minute of [0, 30]) {
      if (hour === 8 && minute === 0) continue;
      if (hour === 16 && minute > 0) break;
      slots.push(`${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`);
    }
  }
  return slots;
};

export function formatTimeLabel(time: string): string {
  const [h, m] = time.split(':').map(Number);
  const suffix = h >= 12 ? 'PM' : 'AM';
  const displayH = h > 12 ? h - 12 : h === 0 ? 12 : h;
  return `${displayH}:${m.toString().padStart(2, '0')} ${suffix}`;
}

// ── Types ─────────────────────────────────────────────────────────────────────

export type Step = 'meeting-type' | 'date' | 'time' | 'details' | 'confirm';

export const STEPS: { id: Step; label: string }[] = [
  { id: 'meeting-type', label: 'Type' },
  { id: 'date', label: 'Date' },
  { id: 'time', label: 'Time' },
  { id: 'details', label: 'Details' },
  { id: 'confirm', label: 'Review' },
];
