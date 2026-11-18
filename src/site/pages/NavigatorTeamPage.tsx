/**
 * NavigatorTeamPage — /team in the Navigator design.
 *
 * Navigate Wealth is founder-led: the founder is always shown, from
 * companyFacts.ts, and anyone added through the admin Team manager is read
 * from the same feed the live page reads (teamContent.ts) and listed below
 * him. Nothing is claimed about the founder that companyFacts.ts does not
 * carry — no credentials, figures or biography beyond his own note.
 */
import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import {
  ArrowRight,
  Check,
  GraduationCap,
  Heart,
  Mail,
  Phone,
  UserCheck,
  type LucideIcon,
} from 'lucide-react';
import { SEO, createWebPageSchema } from '../../components/seo/SEO';
import { getSEOData } from '../../components/seo/seo-config';
import { COMPANY, FOUNDER } from '../../config/companyFacts';
import { getOptimizedFallbackUrl } from '../../utils/optimizedImages';
import { NwImage } from '../components/NwImage';
import { SectionHead } from '../sections/SectionHead';
import { pad2 } from '../sections/format';
import { PHONE_DISPLAY } from '../siteLinks';
import { CompanyHero } from '../company/CompanyHero';
import { FactList, type Fact } from '../company/FactList';
import { TeamMemberCard } from '../company/TeamMemberCard';
import {
  TEAM_APPROACH,
  fetchTeamMembers,
  withoutFounder,
  type TeamMember,
} from '../company/teamContent';
import '../styles/navigator.css';
import '../styles/sections.css';
import '../styles/service.css';
import '../styles/company.css';

const FIRST_NAME = FOUNDER.name.split(' ')[0];
const FULL_NOTE_PATH = '/about#founder';
const APPROACH_ICONS: LucideIcon[] = [UserCheck, GraduationCap, Heart];
const HERO_FACTS = [
  `FSP ${COMPANY.fspNumber}`,
  'FSCA-authorised',
  `Est. ${COMPANY.foundedYear}`,
  COMPANY.headquarters,
];

/** Meeting formats are the ones the consultation booking offers. */
const WORKING_FACTS: Fact[] = [
  { term: 'Practice', value: 'Founder-led, independent' },
  { term: 'Licence', value: `FSP ${COMPANY.fspNumber} · FSCA, ${COMPANY.fscaAuthorisedOn}` },
  { term: 'Meetings', value: 'In person, virtual or telephonic' },
  { term: 'Office', value: COMPANY.office },
  { term: 'Languages', value: COMPANY.languages.join(', ') },
];

export function NavigatorTeamPage() {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const seoData = getSEOData('team');

  useEffect(() => {
    let cancelled = false;
    fetchTeamMembers().then((list) => {
      if (cancelled) return;
      setMembers(withoutFounder(list));
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const hasMembers = !loading && members.length > 0;
  const approachIndex = pad2(hasMembers ? 3 : 2);

  return (
    <div className="nw-site nwx-team">
      <SEO
        {...seoData}
        structuredData={createWebPageSchema(
          seoData.title,
          seoData.description,
          seoData.canonicalUrl,
        )}
      />

      <CompanyHero
        titleId="nwx-team-title"
        pillIcon={UserCheck}
        pill="Founder-led practice"
        title={
          <>
            Meet the <span className="nw-accent">Founder</span> of Navigate Wealth
          </>
        }
        lead={`${COMPANY.tradingName} is a founder-led practice. ${FOUNDER.name} founded the firm in ${COMPANY.foundedYear} and works with clients directly.`}
        actions={
          <>
            <Link className="nw-btn nw-btn--lg" to="/schedule-consultation">
              Schedule a Meeting
              <ArrowRight size={18} strokeWidth={1.75} aria-hidden="true" />
            </Link>
            <Link className="nw-ghost-dark nw-btn--lg" to={FULL_NOTE_PATH}>
              Read the full note from {FIRST_NAME}
            </Link>
          </>
        }
        meta={
          <ul className="nw-trust nw-trust--dark" aria-label="Checkable facts">
            {HERO_FACTS.map((fact) => (
              <li key={fact}>
                <Check size={14} strokeWidth={1.75} aria-hidden="true" />
                {fact}
              </li>
            ))}
          </ul>
        }
        aside={
          <figure className="nwco-hero-portrait">
            <span className="nwco-hero-portrait-ring" aria-hidden="true" />
            <div className="nwco-portrait-frame nwco-portrait-frame--dark">
              <NwImage
                src={getOptimizedFallbackUrl(FOUNDER.imageKey)}
                imageKey={FOUNDER.imageKey}
                alt={`${FOUNDER.name}, ${FOUNDER.title} of ${COMPANY.tradingName}`}
                sizes="(min-width: 1000px) 480px, 100vw"
                width={1254}
                height={1254}
                priority
              />
            </div>
            <figcaption className="nwco-portrait-cap">
              <span>
                <span className="nwco-portrait-name">{FOUNDER.name}</span>
                <span className="nwco-portrait-role">
                  {FOUNDER.title}, {COMPANY.tradingName}
                </span>
              </span>
              <span className="nwco-portrait-tag nw-mono">FSP {COMPANY.fspNumber}</span>
            </figcaption>
          </figure>
        }
      />

      <section className="nw-sec nw-sec--white" aria-labelledby="nwx-team-founder">
        <div className="nw-wrap nwco-profile">
          <div>
            <SectionHead
              index="01"
              kicker="The founder"
              title={FOUNDER.name}
              titleId="nwx-team-founder"
            />
            <p className="nwco-profile-role">
              {FOUNDER.title}, {COMPANY.tradingName}
            </p>
            <ul className="nwco-quals" aria-label={`${FOUNDER.name}'s qualifications`}>
              {FOUNDER.qualifications.map((q) => (
                <li key={q.name}>
                  <strong>{q.name}</strong>
                  {q.detail ? <span> · {q.detail}</span> : null}
                </li>
              ))}
              <li className="nwco-quals-from">All obtained through {FOUNDER.qualificationsFrom}</li>
            </ul>
            <div className="nwco-note">
              <p>{FOUNDER.note[0]}</p>
              <p>{FOUNDER.note[1]}</p>
            </div>
            <Link className="nw-btn nwco-profile-cta" to={FULL_NOTE_PATH}>
              Read the full note from {FIRST_NAME}
              <ArrowRight size={16} strokeWidth={1.75} aria-hidden="true" />
            </Link>
          </div>

          <aside className="nwco-card-light" aria-label={`Working with ${FIRST_NAME}`}>
            <div className="nwco-card-head">
              <p className="nwco-card-label nw-mono">Working with {FIRST_NAME}</p>
              <span className="nwco-status">Free initial consultation</span>
            </div>
            <FactList tone="light" facts={WORKING_FACTS} />
            <div className="nwco-card-actions">
              <a className="nw-outline" href={`mailto:${COMPANY.email}`}>
                <Mail size={16} strokeWidth={1.75} aria-hidden="true" />
                Email
              </a>
              <a className="nw-outline" href={COMPANY.phone.tel}>
                <Phone size={16} strokeWidth={1.75} aria-hidden="true" />
                {PHONE_DISPLAY}
              </a>
            </div>
          </aside>
        </div>

        {loading ? (
          <p className="nw-wrap nwco-loading" role="status">
            <span className="nwco-spinner" aria-hidden="true" />
            Loading team members…
          </p>
        ) : null}
      </section>

      {hasMembers ? (
        <section className="nw-sec nw-sec--white nwco-team" aria-labelledby="nwx-team-members">
          <div className="nw-wrap">
            <SectionHead index="02" kicker="Team" title="Our Team" titleId="nwx-team-members" />
            <ul className="nwco-members">
              {members.map((member, i) => (
                <TeamMemberCard key={member.id} member={member} priority={i < 3} />
              ))}
            </ul>
          </div>
        </section>
      ) : null}

      <section className="nw-sec nw-sec--paper" aria-labelledby="nwx-team-approach">
        <div className="nw-wrap">
          <SectionHead
            center
            index={approachIndex}
            kicker="Approach"
            title="How We Work"
            titleId="nwx-team-approach"
            lead="As a founder-led practice, we keep advice personal and joined-up, with solutions that address all aspects of your financial life."
          />
          <ol className="nwco-waypoints">
            {TEAM_APPROACH.map((step, i) => {
              const Icon = APPROACH_ICONS[i] ?? UserCheck;
              return (
                <li key={step.title}>
                  <span className="nwco-waypoint-mark" aria-hidden="true">
                    <Icon size={24} strokeWidth={1.75} />
                  </span>
                  <span className="nwco-waypoint-no nw-mono">Waypoint {pad2(i + 1)}</span>
                  <h3>{step.title}</h3>
                  <p>{step.description}</p>
                </li>
              );
            })}
          </ol>
          <div className="nwco-center-ctas">
            <Link className="nw-btn nw-btn--lg" to="/schedule-consultation">
              Schedule a Meeting
              <ArrowRight size={18} strokeWidth={1.75} aria-hidden="true" />
            </Link>
            <Link className="nw-outline nw-btn--lg" to="/contact">
              Contact Us
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
