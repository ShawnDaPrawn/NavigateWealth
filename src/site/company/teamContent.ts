/**
 * The Team page's data — shared by the live TeamPage and NavigatorTeamPage.
 *
 * The founder always comes from companyFacts.ts. Anyone else is read from
 * GET /publications/team (the admin Team manager); the founder is filtered out
 * of that list so a matching admin entry never shows him twice.
 */
import { FOUNDER } from '@/config/companyFacts';
import { projectId, publicAnonKey } from '../../utils/supabase/info';

export interface TeamMember {
  id: string;
  name: string;
  title: string;
  credentials: string;
  bio: string;
  specialties: string[];
  image: string;
  linkedinUrl?: string;
  email?: string;
  sortOrder: number;
}

export async function fetchTeamMembers(): Promise<TeamMember[]> {
  try {
    const res = await fetch(
      `https://${projectId}.supabase.co/functions/v1/make-server-91ed8379/publications/team`,
      { headers: { Authorization: `Bearer ${publicAnonKey}` } },
    );
    const json = await res.json();
    if (json.success && Array.isArray(json.data) && json.data.length > 0) {
      return json.data;
    }
  } catch (err) {
    console.error('Failed to fetch team members from API:', err);
  }
  return [];
}

/** Drops an admin entry for the founder, who is always shown from companyFacts. */
export function withoutFounder(members: TeamMember[]): TeamMember[] {
  const founderName = FOUNDER.name.toLowerCase();
  return members.filter((m) => m.name?.trim().toLowerCase() !== founderName);
}

/** "How We Work" — the three points under the founder's profile. */
export const TEAM_APPROACH = [
  {
    title: 'Direct Access',
    description: 'You deal directly with the person advising you, from first meeting on.',
  },
  {
    title: 'Continuous Education',
    description: 'We stay current with market trends and regulatory changes.',
  },
  {
    title: 'Client-Centric Focus',
    description: 'Every decision is made with your best interests as our primary consideration.',
  },
];
