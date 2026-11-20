/**
 * NavigatorTeamPage — the redesigned Team page ("Meet Our Founder").
 *
 * The layout is the "Team" board of the Website Redesign canvas. The content
 * is the live page's: the founder and his note from companyFacts, anyone
 * published through the admin Team manager (same endpoint, the founder never
 * repeated), the same "How We Work" copy, and the same SEO tags and WebPage
 * JSON-LD. Every fact the board states about the firm is read from
 * companyFacts; links go only to routes the site serves.
 */
import { useEffect, useState } from 'react';
import { SEO, createWebPageSchema } from '../../components/seo/SEO';
import { getSEOData } from '../../components/seo/seo-config';
import { COMPANY, FOUNDER, TRUST_FACTS } from '../../config/companyFacts';
import { getOptimizedFallbackUrl } from '../../utils/optimizedImages';
import { projectId } from '../../utils/supabase/info';
import { PHONE_DISPLAY, PHONE_HREF } from '../siteLinks';
import { TeamApproach, type TeamWaypoint } from '../sections/TeamApproach';
import { TeamFounder, type TeamCardMember, type TeamFact } from '../sections/TeamFounder';
import { TeamHero } from '../sections/TeamHero';
import { GraduationCapIcon, HeartIcon, UserCheckIcon } from '../sections/TeamIcons';
import '../styles/navigator.css';
import '../styles/sections.css';
import '../styles/team.css';

const CONSULTATION_PATH = '/schedule-consultation';
/** The founder's full note is the About page's #founder section. */
const NOTE_PATH = '/about#founder';

const FIRST_NAME = FOUNDER.name.split(' ')[0];
const FOUNDER_ROLE = `${FOUNDER.title}, ${COMPANY.tradingName}`;
const NOTE_LABEL = `Read the full note from ${FIRST_NAME}`;
const FSP = `FSP ${COMPANY.fspNumber}`;

/** "FSP 54606 · FSCA-authorised · Est. 2024 · Pretoria, South Africa". */
const HERO_FACTS = [
  FSP,
  TRUST_FACTS[0].label,
  `Est. ${COMPANY.foundedYear}`,
  COMPANY.headquarters,
] as const;

const WORKING_WITH: readonly TeamFact[] = [
  { label: 'Practice', value: 'Founder-led, independent' },
  { label: 'Licence', value: `${FSP} · FSCA, ${COMPANY.fscaAuthorisedOn}` },
  // The three meeting formats the consultation booking offers.
  { label: 'Meetings', value: 'In person, virtual or telephonic' },
  { label: 'Office', value: COMPANY.office },
  { label: 'Languages', value: COMPANY.languages.join(', ') },
];

/** The live page's "How We Work" points, word for word. */
const WAYPOINTS: readonly TeamWaypoint[] = [
  {
    title: 'Direct Access',
    description: 'You deal directly with the person advising you, from first meeting on.',
    icon: UserCheckIcon,
  },
  {
    title: 'Continuous Education',
    description: 'We stay current with market trends and regulatory changes.',
    icon: GraduationCapIcon,
  },
  {
    title: 'Client-Centric Focus',
    description: 'Every decision is made with your best interests as our primary consideration.',
    icon: HeartIcon,
  },
];

/**
 * The people published through the admin Team manager — the same request,
 * headers and checks as the live page's fetchTeamMembers (TeamPage.tsx keeps
 * its copy private, since a .tsx file that exports a non-component breaks
 * fast refresh). Any failure means "no one published".
 */
async function fetchPublishedTeam(): Promise<TeamCardMember[]> {
  try {
    // A public route (no auth middleware, and the function runs with
    // verify_jwt = false), so no bearer: see anon-key-bearer-ratchet.test.ts.
    const res = await fetch(
      `https://${projectId}.supabase.co/functions/v1/make-server-91ed8379/publications/team`,
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

/**
 * Anyone published through the admin Team manager, without the founder, who
 * is always shown from companyFacts — the same rule the live page applies.
 * Nothing shows while loading or when the request fails.
 */
function usePublishedTeam(): TeamCardMember[] {
  const [members, setMembers] = useState<TeamCardMember[]>([]);
  useEffect(() => {
    let cancelled = false;
    fetchPublishedTeam().then((list) => {
      if (cancelled) return;
      const founderName = FOUNDER.name.toLowerCase();
      setMembers(list.filter((m) => m.name?.trim().toLowerCase() !== founderName));
    });
    return () => {
      cancelled = true;
    };
  }, []);
  return members;
}

export function NavigatorTeamPage() {
  const members = usePublishedTeam();
  const seo = getSEOData('team');

  return (
    <div className="nw-site nw-base nwtm">
      <SEO
        {...seo}
        structuredData={createWebPageSchema(seo.title, seo.description, seo.canonicalUrl)}
      />

      <TeamHero
        badge="Founder-led practice"
        title="Meet Our"
        accent="Founder"
        lead={`${COMPANY.tradingName} is a founder-led practice. ${FOUNDER.name} founded the firm in ${COMPANY.foundedYear} and works with clients directly.`}
        primary={{ label: 'Schedule a Meeting', to: CONSULTATION_PATH }}
        secondary={{ label: NOTE_LABEL, to: NOTE_PATH }}
        facts={HERO_FACTS}
        portrait={{
          src: getOptimizedFallbackUrl(FOUNDER.imageKey),
          imageKey: FOUNDER.imageKey,
          alt: `${FOUNDER.name}, ${FOUNDER.title} of ${COMPANY.tradingName}`,
          name: FOUNDER.name,
          role: FOUNDER_ROLE,
          badge: FSP,
        }}
      />

      <TeamFounder
        index="01"
        kicker="The founder"
        name={FOUNDER.name}
        role={FOUNDER_ROLE}
        note={FOUNDER.note.slice(0, 2)}
        noteLink={{ label: NOTE_LABEL, to: NOTE_PATH }}
        cardLabel={`Working with ${FIRST_NAME}`}
        cardStatus="Free initial consultation"
        facts={WORKING_WITH}
        contact={{ email: COMPANY.email, phoneHref: PHONE_HREF, phoneDisplay: PHONE_DISPLAY }}
        members={members}
        fallbackEmail={COMPANY.email}
      />

      <TeamApproach
        index="02"
        kicker="Approach"
        title="How We Work"
        lead="As a founder-led practice, we keep advice personal and joined-up, with solutions that address all aspects of your financial life."
        points={WAYPOINTS}
        primary={{ label: 'Schedule a Meeting', to: CONSULTATION_PATH }}
        secondary={{ label: 'Contact Us', to: '/contact' }}
      />
    </div>
  );
}

export default NavigatorTeamPage;
