import { useQuery } from '@tanstack/react-query';
import { clientApi } from '../../client-management/api';
import { CalendarEvent } from '../types';
import { addYears, setYear, parseISO, isValid, format } from 'date-fns';
import { calendarKeys } from './queryKeys';

export function useClientBirthdays(currentDate: Date) {
  return useQuery({
    queryKey: calendarKeys.birthdays(currentDate.getFullYear()),
    queryFn: async () => {
      const response = await clientApi.getClients();
      const events: CalendarEvent[] = [];
      const currentYear = currentDate.getFullYear();
      
      // Generate birthdays for current year, previous year, and next year
      // to ensure smooth navigation when switching years
      const yearsToGenerate = [currentYear - 1, currentYear, currentYear + 1];

      response.users.forEach(client => {
        // Try to find date of birth in various locations based on the structure
        const dobString = 
          client.profile?.personalInformation?.dateOfBirth || 
          client.user_metadata?.dateOfBirth ||
          (client.profile as Record<string, unknown>)?.dateOfBirth;

        if (!dobString) return;

        const dob = parseISO(dobString);
        if (!isValid(dob)) return;

        const clientName = 
          client.name || 
          `${client.user_metadata?.firstName || ''} ${client.user_metadata?.surname || ''}`.trim() || 
          client.email;

        yearsToGenerate.forEach(year => {
          // Create birthday date for this year
          const birthdayDate = setYear(dob, year);
          const startAt = new Date(birthdayDate);
          startAt.setHours(9, 0, 0, 0); // 9 AM
          const endAt = new Date(birthdayDate);
          endAt.setHours(10, 0, 0, 0); // 10 AM (1 hour duration)

          events.push({
            id: `birthday-${client.id}-${year}`,
            user_id: 'system',
            title: `Birthday: ${clientName}`,
            description: `Happy Birthday to ${clientName}!`,
            event_type: 'birthday',
            start_at: startAt.toISOString(),
            end_at: endAt.toISOString(),
            location_type: 'other',
            location: null,
            video_link: null,
            status: 'scheduled',
            client_id: client.id,
            created_by: 'system',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            recurrence_rule: 'FREQ=YEARLY',
            client: {
              id: client.id,
              full_name: clientName,
              email: client.email
            }
          });
        });
      });

      return events;
    },
    staleTime: 60 * 60 * 1000, // 1 hour
  });
}