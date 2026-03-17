/**
 * Policy Renewals Hook
 * Navigate Wealth Admin Dashboard
 *
 * Fetches policies with inception dates and generates annual
 * renewal/anniversary calendar events for the calendar view.
 */

import { useQuery } from '@tanstack/react-query';
import { api } from '../../../../../utils/api/client';
import { clientApi } from '../../client-management/api';
import type { CalendarEvent } from '../types';
import { parseISO, isValid, setYear } from 'date-fns';
import { logger } from '../../../../../utils/logger';
import { calendarKeys } from './queryKeys';

// ============================================================================
// TYPES
// ============================================================================

interface PolicyRenewalData {
  clientId: string;
  policyId: string;
  providerName: string;
  categoryId: string;
  categoryLabel: string;
  policyNumber: string;
  inceptionDate: string;
  inceptionFieldName: string;
}

interface PolicyRenewalsResponse {
  renewals: PolicyRenewalData[];
}

// ============================================================================
// HOOK
// ============================================================================

export function usePolicyRenewals(currentDate: Date) {
  return useQuery({
    queryKey: calendarKeys.renewals(currentDate.getFullYear()),
    queryFn: async () => {
      logger.debug('[Calendar] Fetching policy renewals for calendar');

      // Fetch renewal data from server and client names in parallel
      const [renewalsResponse, clientsResponse] = await Promise.all([
        api.get<PolicyRenewalsResponse>('/integrations/policy-renewals'),
        clientApi.getClients(),
      ]);

      const renewals = renewalsResponse?.renewals || [];
      if (renewals.length === 0) return [];

      // Build a client name lookup map
      const clientNameMap: Record<string, string> = {};
      if (clientsResponse?.users) {
        for (const client of clientsResponse.users) {
          const name =
            client.name ||
            `${client.user_metadata?.firstName || ''} ${client.user_metadata?.surname || ''}`.trim() ||
            client.email ||
            'Unknown Client';
          clientNameMap[client.id] = name;
        }
      }

      const events: CalendarEvent[] = [];
      const currentYear = currentDate.getFullYear();

      // Generate renewal events for previous year, current year, and next year
      const yearsToGenerate = [currentYear - 1, currentYear, currentYear + 1];

      for (const renewal of renewals) {
        const inception = parseISO(renewal.inceptionDate);
        if (!isValid(inception)) continue;

        const clientName = clientNameMap[renewal.clientId] || 'Unknown Client';
        const policyLabel = renewal.policyNumber
          ? `${renewal.providerName} (${renewal.policyNumber})`
          : renewal.providerName;

        // Calculate how many years since inception for the anniversary label
        const inceptionYear = inception.getFullYear();

        for (const year of yearsToGenerate) {
          // Only generate for years at or after the inception year
          if (year < inceptionYear) continue;

          const anniversaryYear = year - inceptionYear;

          // Create anniversary date for this year using the inception month/day
          const anniversaryDate = setYear(inception, year);
          const startAt = new Date(anniversaryDate);
          startAt.setHours(9, 0, 0, 0);
          const endAt = new Date(anniversaryDate);
          endAt.setHours(9, 30, 0, 0);

          // Build a descriptive title and description
          const ordinalSuffix = getOrdinalSuffix(anniversaryYear);
          const title = anniversaryYear > 0
            ? `Renewal: ${policyLabel} - ${clientName} (${anniversaryYear}${ordinalSuffix} year)`
            : `Renewal: ${policyLabel} - ${clientName} (Inception)`;

          const description = [
            `Policy Anniversary for ${clientName}`,
            `Provider: ${renewal.providerName}`,
            renewal.policyNumber ? `Policy No: ${renewal.policyNumber}` : null,
            `Category: ${renewal.categoryLabel}`,
            `Inception Date: ${inception.toLocaleDateString('en-ZA')}`,
            anniversaryYear > 0 ? `Anniversary: ${anniversaryYear} year${anniversaryYear > 1 ? 's' : ''}` : 'Original inception date',
          ]
            .filter(Boolean)
            .join('\n');

          events.push({
            id: `renewal-${renewal.policyId}-${year}`,
            user_id: 'system',
            title,
            description,
            event_type: 'renewal',
            start_at: startAt.toISOString(),
            end_at: endAt.toISOString(),
            location_type: 'other',
            location: null,
            video_link: null,
            status: 'scheduled',
            client_id: renewal.clientId,
            created_by: 'system',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            recurrence_rule: 'FREQ=YEARLY',
            client: {
              id: renewal.clientId,
              full_name: clientName,
              email: '',
            },
          });
        }
      }

      logger.debug(`[Calendar] Generated ${events.length} policy renewal events`);
      return events;
    },
    staleTime: 60 * 60 * 1000, // 1 hour - renewals don't change often
  });
}

// ============================================================================
// HELPERS
// ============================================================================

function getOrdinalSuffix(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return s[(v - 20) % 10] || s[v] || s[0];
}