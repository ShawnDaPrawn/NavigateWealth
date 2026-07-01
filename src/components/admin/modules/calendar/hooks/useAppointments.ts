/**
 * Appointment Hooks
 * Navigate Wealth Admin Dashboard
 *
 * React Query hooks for the client-facing appointment booking flow.
 * Appointments are layered on calendar events, so mutations invalidate the
 * event lists too.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { calendarApi } from '../api';
import type { CreateAppointmentInput, RescheduleAppointmentInput } from '../types';
import { QUERY_STALE_TIME, QUERY_GC_TIME } from '../constants';
import { eventKeys } from './useEvents';

// ============================================================================
// QUERY KEYS
// ============================================================================

export const appointmentKeys = {
  all: ['appointments'] as const,
  byEvent: (eventId: string) => [...appointmentKeys.all, 'by-event', eventId] as const,
  rescheduleRequests: (status: string) =>
    [...appointmentKeys.all, 'reschedule-requests', status] as const,
};

// ============================================================================
// QUERIES
// ============================================================================

/** Appointment details for a calendar event (appointment-type events only). */
export function useAppointmentByEvent(eventId: string | null) {
  return useQuery({
    queryKey: appointmentKeys.byEvent(eventId || ''),
    queryFn: () => calendarApi.fetchAppointmentByEvent(eventId!),
    enabled: !!eventId,
    staleTime: QUERY_STALE_TIME,
    gcTime: QUERY_GC_TIME,
    retry: false,
  });
}

/** Open client reschedule requests for the header panel. */
export function useRescheduleRequests(status: 'open' | 'resolved' | 'dismissed' = 'open') {
  return useQuery({
    queryKey: appointmentKeys.rescheduleRequests(status),
    queryFn: () => calendarApi.fetchRescheduleRequests(status),
    staleTime: QUERY_STALE_TIME,
    gcTime: QUERY_GC_TIME,
    refetchInterval: 60_000, // requests arrive from the public page — keep fresh
    retry: false,
  });
}

// ============================================================================
// MUTATIONS
// ============================================================================

function useInvalidateAppointments() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: eventKeys.lists() });
    queryClient.invalidateQueries({ queryKey: appointmentKeys.all });
  };
}

export function useCreateAppointment() {
  const invalidate = useInvalidateAppointments();

  return useMutation({
    mutationFn: (input: CreateAppointmentInput) => calendarApi.createAppointment(input),
    onSuccess: () => {
      invalidate();
      toast.success('Appointment booked — confirmation email is on its way to the client');
    },
    onError: (error) => {
      console.error('Failed to book appointment:', error);
      toast.error('Failed to book appointment');
    },
  });
}

export function useRescheduleAppointment() {
  const invalidate = useInvalidateAppointments();

  return useMutation({
    mutationFn: ({ id, ...input }: RescheduleAppointmentInput & { id: string }) =>
      calendarApi.rescheduleAppointment(id, input),
    onSuccess: () => {
      invalidate();
      toast.success('Appointment rescheduled — the client will receive a new confirmation');
    },
    onError: (error) => {
      console.error('Failed to reschedule appointment:', error);
      toast.error('Failed to reschedule appointment');
    },
  });
}

export function useCancelAppointment() {
  const invalidate = useInvalidateAppointments();

  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string | null }) =>
      calendarApi.cancelAppointment(id, reason),
    onSuccess: () => {
      invalidate();
      toast.success('Appointment cancelled — the client has been notified');
    },
    onError: (error) => {
      console.error('Failed to cancel appointment:', error);
      toast.error('Failed to cancel appointment');
    },
  });
}

export function useResendAppointmentConfirmation() {
  return useMutation({
    mutationFn: (id: string) => calendarApi.resendAppointmentConfirmation(id),
    onSuccess: () => toast.success('Confirmation email re-sent'),
    onError: (error) => {
      console.error('Failed to resend confirmation:', error);
      toast.error('Failed to resend confirmation email');
    },
  });
}

export function useDismissRescheduleRequest() {
  const invalidate = useInvalidateAppointments();

  return useMutation({
    mutationFn: (id: string) => calendarApi.dismissRescheduleRequest(id),
    onSuccess: () => {
      invalidate();
      toast.success('Request dismissed');
    },
    onError: (error) => {
      console.error('Failed to dismiss request:', error);
      toast.error('Failed to dismiss request');
    },
  });
}
