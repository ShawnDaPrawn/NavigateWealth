/**
 * NavigatorCareersPage — the redesigned Careers page, the "Careers" board of
 * the Website Redesign canvas.
 *
 * Emits the same SEO tags and WebPage JSON-LD as the live page, lists the same
 * roles from the same endpoint (GET /publications/careers), and sends
 * applications to the same place with the same payload (see CareersCvDialog).
 * Links only to routes the site already serves.
 *
 * The departments, values and perks are the live page's copy word for word.
 * They are repeated here because CareersPage.tsx keeps them in module-local
 * constants it does not export; if they change, change both.
 */
import { useCallback, useEffect, useRef, useState, type MouseEvent } from 'react';
import { Link } from 'react-router';
import {
  ArrowRight,
  Coffee,
  FileText,
  Globe,
  GraduationCap,
  Heart,
  Lightbulb,
  Megaphone,
  Shield,
  TrendingUp,
  UserCheck,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { SEO, createWebPageSchema } from '../../components/seo/SEO';
import { getSEOData } from '../../components/seo/seo-config';
import { COMPANY } from '../../config/companyFacts';
import { projectId } from '../../utils/supabase/info';
import { CareersCvDialog } from '../sections/CareersCvDialog';
import { CareersHero } from '../sections/CareersHero';
import {
  CareersOpenings,
  type CareersCategory,
  type JobListing,
} from '../sections/CareersOpenings';
import { SectionHead } from '../sections/SectionHead';
import '../styles/navigator.css';
import '../styles/sections.css';
import '../styles/careers.css';

const CAREERS_URL = `https://${projectId}.supabase.co/functions/v1/make-server-91ed8379/publications/careers`;
const OPENINGS_ID = 'opportunities';

const SEO_DATA = getSEOData('careers');
const STRUCTURED_DATA = createWebPageSchema(
  SEO_DATA.title,
  SEO_DATA.description,
  SEO_DATA.canonicalUrl,
);

const CATEGORIES: readonly CareersCategory[] = [
  {
    id: 'advisory',
    title: 'Advisory',
    icon: Users,
    description:
      'Client-facing roles providing financial advice and building lasting relationships.',
  },
  {
    id: 'administration',
    title: 'Administration',
    icon: FileText,
    description: 'Operational support roles ensuring smooth business operations.',
  },
  {
    id: 'compliance',
    title: 'Compliance',
    icon: Shield,
    description: 'Regulatory and compliance roles maintaining standards and oversight.',
  },
  {
    id: 'marketing',
    title: 'Marketing',
    icon: Megaphone,
    description: 'Creative and strategic roles driving brand growth and client acquisition.',
  },
];

const OPENINGS_PERKS = [
  'Competitive remuneration',
  'Professional development',
  'Growth opportunities',
  'Modern work environment',
  'Flexible working options',
  'Close-knit, founder-led culture',
] as const;

interface Point {
  title: string;
  description: string;
  icon: LucideIcon;
}

const VALUES: readonly Point[] = [
  {
    title: 'Founder-Led',
    description: 'Work directly alongside the founder and see how every part of the practice runs.',
    icon: UserCheck,
  },
  {
    title: 'Client Excellence',
    description: "Every decision we make is guided by what's best for our clients.",
    icon: Heart,
  },
  {
    title: 'Professional Growth',
    description: 'We support continuous learning, CPD and professional development.',
    icon: GraduationCap,
  },
  {
    title: 'Independence',
    description: 'We give advice that is not tied to any single product provider.',
    icon: Globe,
  },
];

const PERKS: readonly Point[] = [
  {
    icon: TrendingUp,
    title: 'Competitive Remuneration',
    description: 'Market-related pay, discussed openly for each role',
  },
  {
    icon: GraduationCap,
    title: 'Continuous Learning',
    description: 'Support for CPD and industry qualifications',
  },
  {
    icon: Coffee,
    title: 'Flexible Working',
    description: 'Hybrid working from our Pretoria office',
  },
  {
    icon: Shield,
    title: 'Meaningful Work',
    description: 'Help clients make real, well-informed financial decisions',
  },
  {
    icon: Lightbulb,
    title: 'Innovation Culture',
    description: 'AI tools, modern tech stack & creative freedom',
  },
  { icon: Users, title: 'Mentorship', description: 'One-on-one mentorship from the founder' },
];

/** Same request and fallback as the live page: any failure means no listings. */
async function fetchJobListings(): Promise<JobListing[]> {
  try {
    // A public route (no auth middleware, and the function runs with
    // verify_jwt = false), so no bearer: see anon-key-bearer-ratchet.test.ts.
    const res = await fetch(CAREERS_URL);
    const json = await res.json();
    if (json.success && Array.isArray(json.data)) return json.data;
  } catch (err) {
    console.error('Failed to fetch job listings:', err);
  }
  return [];
}

function prefersReducedMotion(): boolean {
  return (
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

export function NavigatorCareersPage() {
  const [active, setActive] = useState(CATEGORIES[0].id);
  const [listings, setListings] = useState<JobListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [cvOpen, setCvOpen] = useState(false);
  const opener = useRef<HTMLElement | null>(null);

  useEffect(() => {
    let live = true;
    fetchJobListings().then((data) => {
      if (!live) return;
      setListings(data);
      setLoading(false);
    });
    return () => {
      live = false;
    };
  }, []);

  const openCv = useCallback((e: MouseEvent<HTMLButtonElement>) => {
    opener.current = e.currentTarget;
    setCvOpen(true);
  }, []);

  const pickAndGo = useCallback((id: string) => {
    setActive(id);
    document
      .getElementById(OPENINGS_ID)
      ?.scrollIntoView?.({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' });
  }, []);

  return (
    <div className="nw-site nwcr">
      <SEO {...SEO_DATA} structuredData={STRUCTURED_DATA} />

      <CareersHero
        categories={CATEGORIES}
        openingsHref={`#${OPENINGS_ID}`}
        onPickCategory={pickAndGo}
        onSendCv={openCv}
      />

      <CareersOpenings
        id={OPENINGS_ID}
        index="01"
        categories={CATEGORIES}
        active={active}
        onSelect={setActive}
        listings={listings}
        loading={loading}
        perks={OPENINGS_PERKS}
        onApply={openCv}
      />

      <section className="nwcr-culture" aria-labelledby="nwcr-culture-title">
        <div className="nw-grid-bg" aria-hidden="true" />
        <div className="nw-wrap nwcr-culture-inner">
          <SectionHead
            index="02"
            kicker="Our Culture"
            title="Why Navigate Wealth?"
            lead="Join a growing, founder-led practice built on independence, transparency and personal service."
            center
            dark
            titleId="nwcr-culture-title"
            className="nwcr-head"
          />
          <ul className="nwcr-values">
            {VALUES.map(({ title, description, icon: Icon }) => (
              <li key={title} className="nwcr-value">
                <span className="nwcr-value-i" aria-hidden="true">
                  <Icon size={22} strokeWidth={1.75} />
                </span>
                <h3 className="nw-h nwcr-value-t">{title}</h3>
                <p className="nwcr-value-d">{description}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="nwcr-perks" aria-labelledby="nwcr-perks-title">
        <div className="nw-wrap">
          <SectionHead
            index="03"
            kicker="Benefits & Perks"
            title="Everything You Need to Thrive"
            lead="We believe that taking care of the people who work with us is the foundation of exceptional client service. Here's what you can expect."
            center
            titleId="nwcr-perks-title"
            className="nwcr-head"
          />
          <ul className="nwcr-perk-grid">
            {PERKS.map(({ title, description, icon: Icon }) => (
              <li key={title} className="nwcr-perk">
                <span className="nwcr-perk-i" aria-hidden="true">
                  <Icon size={20} strokeWidth={1.75} />
                </span>
                <div>
                  <h3 className="nwcr-perk-t">{title}</h3>
                  <p className="nwcr-perk-d">{description}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="nwcr-cta" aria-labelledby="nwcr-cta-title">
        <div className="nw-wrap nwcr-cta-inner">
          <h2 id="nwcr-cta-title" className="nwcr-cta-title">
            Ready to Shape the Future of <span className="nwcr-accent-l">Financial Advisory?</span>
          </h2>
          <p className="nwcr-cta-lead">
            Even if you don&apos;t see a current opening that matches your skills, we&apos;re always
            interested in hearing from exceptional candidates who share our vision.
          </p>
          <ol className="nwcr-legs">
            <li className="nwcr-leg">
              <span className="nw-mono nwcr-leg-no">LEG 01</span>
              <span className="nwcr-leg-t">Send us your details</span>
            </li>
            <li className="nwcr-leg-line" aria-hidden="true" />
            <li className="nwcr-leg">
              <span className="nw-mono nwcr-leg-no">LEG 02</span>
              <span className="nwcr-leg-t">Email your CV to {COMPANY.email}</span>
            </li>
          </ol>
          <div className="nwcr-cta-actions">
            <button type="button" className="nw-btn nwcr-btn-lg" onClick={openCv}>
              Start Your Journey With Us
              <ArrowRight size={18} strokeWidth={1.75} aria-hidden="true" />
            </button>
            <Link className="nw-outline nwcr-btn-lg" to="/contact">
              Contact Us
            </Link>
          </div>
          <p className="nwcr-cta-foot">
            Equal opportunity employer • Professional development • Competitive benefits •
            Growth-focused culture
          </p>
        </div>
      </section>

      <CareersCvDialog open={cvOpen} onOpenChange={setCvOpen} returnFocusTo={opener} />
    </div>
  );
}

export default NavigatorCareersPage;
