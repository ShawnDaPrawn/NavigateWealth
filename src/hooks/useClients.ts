/**
 * Clients Data Hooks
 * Uses React Query for data fetching
 */

import { useQuery } from '@tanstack/react-query';
import { api } from '../utils/api/client';
import type { Client } from '../shared/types/calendar';

// Query keys
export const clientKeys = {
  all: ['clients'] as const,
  lists: () => [...clientKeys.all, 'list'] as const,
  list: (search?: string) => [...clientKeys.lists(), search] as const,
};

/**
 * Fetch all clients via the API
 */
export function useClients(search?: string) {
  return useQuery({
    queryKey: clientKeys.list(search),
    queryFn: async (): Promise<Client[]> => {
      console.log('🔍 Fetching clients from API (profile/all-users)...');
      
      try {
        /** Shape of a user record from the profile/all-users API */
        interface ApiUserRecord {
          id: string;
          email?: string;
          name?: string;
          user_metadata?: Record<string, unknown>;
          profile?: Record<string, Record<string, unknown>>;
          [key: string]: unknown;
        }

        const data = await api.get<{ count: number, users: ApiUserRecord[] }>('profile/all-users');
        
        if (!data || !data.users) {
          console.warn('⚠️ No users returned from API');
          return [];
        }

        // Transform API users to Calendar Client type
        const clients: Client[] = data.users.map((user: ApiUserRecord) => {
          const firstName = user.user_metadata?.firstName || user.profile?.personalInformation?.firstName || user.name?.split(' ')[0] || 'Unknown';
          const lastName = user.user_metadata?.surname || user.profile?.personalInformation?.lastName || user.name?.split(' ').slice(1).join(' ') || '';
          const fullName = `${firstName} ${lastName}`.trim();

          return {
            id: user.id,
            full_name: fullName || 'Unknown User',
            preferred_name: user.profile?.personalInformation?.preferredName || firstName,
            email: user.email || '',
            phone: user.profile?.contactDetails?.mobileNumber || null,
            date_of_birth: user.profile?.personalInformation?.dateOfBirth || null,
            created_by: 'system', 
            created_at: user.created_at || new Date().toISOString(),
            updated_at: user.updated_at || new Date().toISOString(),
          };
        });

        // Client-side filtering if search is provided
        let result = clients;
        
        if (search) {
          const lowerSearch = search.toLowerCase();
          result = result.filter(c => 
            c.full_name.toLowerCase().includes(lowerSearch) || 
            c.email.toLowerCase().includes(lowerSearch)
          );
        }

        // Filter out admin users if possible (optional, but good for consistency)
        // Similar logic to ClientManagementModule
        result = result.filter(client => {
           // We can't easily check role here without the raw user object or profile role
           // But assuming the API returns what we need.
           // For now, let's just return all users so we don't accidentally hide someone.
           return true;
        });

        // Sort by name
        return result.sort((a, b) => a.full_name.localeCompare(b.full_name));
        
      } catch (error) {
        console.error('❌ Error fetching clients:', error);
        // Return empty array instead of throwing to prevent UI crash
        return [];
      }
    },
    staleTime: 60000, // 1 minute
    gcTime: 5 * 60 * 1000,
    retry: false,
    refetchOnWindowFocus: false,
  });
}