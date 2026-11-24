/**
 * The Navigate Wealth platform map: what an outside AI agent reads to find its
 * way around the admin panel. It is the built-in skill of the Navigate Wealth
 * service in the password manager, returned with every Navigate Wealth login
 * and by the MCP tool `get_platform_guide`.
 *
 * Keep one entry per admin module a person could ask an agent to work in, in
 * the order the sidebar shows them. The `id` is the `?module=` value, so the
 * address works as a deep link. `platformGuide.test.ts` keeps the ids and names in
 * step with the sidebar.
 */
import { NAVIGATE_WEALTH_ADMIN_URL } from './password-manager.ts';

export interface PlatformModule {
  id: string;
  name: string;
  purpose: string;
}

export const PLATFORM_MODULES: PlatformModule[] = [
  {
    id: 'dashboard',
    name: 'Dashboard',
    purpose: 'The day at a glance: what needs attention across the practice.',
  },
  {
    id: 'tasks',
    name: 'To-Do',
    purpose: 'Tasks for the team: create, assign, complete and follow up work.',
  },
  {
    id: 'applications',
    name: 'Applications',
    purpose: 'New client sign-up applications waiting to be reviewed and approved.',
  },
  {
    id: 'submissions',
    name: 'Submissions',
    purpose: 'Requests and forms clients have sent in, such as quotes and contact requests.',
  },
  { id: 'calendar', name: 'Calendar', purpose: 'Meetings, consultations and reminders.' },
  { id: 'notes', name: 'Notes', purpose: 'Personal and shared notes.' },
  {
    id: 'clients',
    name: 'Client Management',
    purpose:
      'Every client’s profile: personal details, policies and products, documents, communication history and planning.',
  },
  {
    id: 'communication',
    name: 'Communication',
    purpose: 'Email clients one at a time or in bulk, and see what was sent.',
  },
  { id: 'esign', name: 'E-Signature', purpose: 'Send documents for signature and track them.' },
  {
    id: 'advice-engine',
    name: 'Advice Engine',
    purpose: 'Needs analyses and Records of Advice for clients.',
  },
  {
    id: 'product-management',
    name: 'Product Management',
    purpose: 'The product providers and products the firm works with.',
  },
  { id: 'resources', name: 'Resources', purpose: 'Forms, templates and tools staff use.' },
  {
    id: 'publications',
    name: 'Publications',
    purpose: 'Articles for the website: write, review and publish.',
  },
  { id: 'newsletter', name: 'Newsletters', purpose: 'Monthly newsletter issues and subscribers.' },
  {
    id: 'marketing',
    name: 'Social & Marketing',
    purpose: 'Social media posts and marketing campaigns.',
  },
  {
    id: 'personnel',
    name: 'Personnel',
    purpose: 'Staff profiles, roles and what each person may access.',
  },
  {
    id: 'compliance',
    name: 'Compliance',
    purpose: 'Regulatory records, registers and compliance checks.',
  },
  { id: 'reporting', name: 'Reporting', purpose: 'Practice reports and figures.' },
  { id: 'issues', name: 'Issue Manager', purpose: 'Problems reported in the platform.' },
  {
    id: 'ai-management',
    name: 'AI Management',
    purpose: 'Vasco, the website assistant: what it knows and how it answers.',
  },
];

export const platformModuleUrl = (id: string) => NAVIGATE_WEALTH_ADMIN_URL + '?module=' + id;

/** The platform map as an agent reads it. */
export function renderPlatformGuide(): string {
  return [
    '# Navigate Wealth platform map',
    '',
    'Navigate Wealth is the firm’s own platform. Sign in at ' +
      NAVIGATE_WEALTH_ADMIN_URL +
      ' with a Navigate Wealth login from this password manager. Everything staff do lives in the admin panel, one module per area of work. Open a module directly with its address below.',
    '',
    ...PLATFORM_MODULES.map(
      (m) => '- **' + m.name + '** — ' + m.purpose + ' ' + platformModuleUrl(m.id),
    ),
    '',
    'Work the way a careful staff member would: read before you change, change one record at a time, and stop and ask the person you are working for when something does not match what you expected.',
  ].join('\n');
}
