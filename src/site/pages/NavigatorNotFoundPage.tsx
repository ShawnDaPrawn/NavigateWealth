/**
 * NavigatorNotFoundPage — the redesigned 404, shown for any URL the app has
 * no route for.
 *
 * Keeps what the live page (NotFoundPage.tsx) does: the "Page Not Found"
 * title and a noindex, nofollow robots tag, "Go back" through the history
 * (home when there is none), and links to home, the legal pages, the
 * resources and the contact page. A real HTTP 404 for unknown URLs is the
 * edge middleware's job (middleware.ts), not this component's.
 * The layout is the "NotFound" board of the Website Redesign canvas. Beyond
 * the live page it adds the board's page search, whose pages are routes the
 * site serves with their sitemap descriptions (sitemap/sitemapData.ts), and
 * the WhatsApp card links to WhatsApp (the live card went to /resources).
 */
import { useEffect } from 'react';
import { useNavigate } from 'react-router';
import { sitemapSections } from '../../components/pages/sitemap/sitemapData';
import { WHATSAPP_HREF } from '../siteLinks';
import { NotFoundHero } from '../sections/NotFoundHero';
import {
  NotFoundRecover,
  type NotFoundCard,
  type NotFoundDestination,
} from '../sections/NotFoundRecover';
import '../styles/navigator.css';
import '../styles/sections.css';
import '../styles/not-found.css';

/** The board's searchable pages, in its order, with its names for them. */
const DESTINATIONS: ReadonlyArray<readonly [title: string, path: string]> = [
  ['Home', '/'],
  ['Our Services', '/services'],
  ['Get a Quote', '/get-quote'],
  ['Book a Free Consultation', '/schedule-consultation'],
  ['Ask Vasco', '/ask-vasco'],
  ['Resources', '/resources'],
  ['Contact Us', '/contact'],
  ['Risk Management', '/risk-management'],
  ['Retirement Planning', '/retirement-planning'],
  ['Investment Management', '/investment-management'],
  ['Medical Aid', '/medical-aid'],
  ['Estate Planning', '/estate-planning'],
  ['Tax Planning', '/tax-planning'],
  ['Employee Benefits', '/employee-benefits'],
  ['Financial Planning', '/financial-planning'],
  ['About Us', '/about'],
  ['Careers', '/careers'],
  ['Legal Information', '/legal'],
  ['Log In', '/login'],
  ['Create an Account', '/signup'],
];

const SITEMAP_DESCRIPTIONS = new Map(
  sitemapSections.flatMap((section) => section.links).map((link) => [link.path, link.description]),
);

const PAGES: NotFoundDestination[] = DESTINATIONS.map(([title, path]) => ({
  title,
  path,
  description: SITEMAP_DESCRIPTIONS.get(path) ?? '',
}));

/** The board's chips: Services, Quote, Consultation, Resources, Ask Vasco, Contact. */
const POPULAR = [1, 2, 3, 5, 4, 6].map((i) => PAGES[i]);

const CARDS: NotFoundCard[] = [
  {
    title: 'Legal',
    description: 'Terms, privacy policy, and regulatory compliance information.',
    icon: 'fileText',
    href: '/legal',
  },
  {
    title: 'Chat to us on WhatsApp',
    description: "Can't find what you're looking for?",
    icon: 'message',
    href: WHATSAPP_HREF,
  },
  {
    title: 'Resources',
    description: 'Read the latest posts on our blog.',
    icon: 'book',
    href: '/resources',
  },
];

export function NavigatorNotFoundPage() {
  const navigate = useNavigate();

  // The live page's tags, set the same way.
  useEffect(() => {
    document.title = 'Page Not Found | Navigate Wealth';
    let el = document.querySelector('meta[name="robots"]') as HTMLMetaElement | null;
    if (!el) {
      el = document.createElement('meta');
      el.setAttribute('name', 'robots');
      document.head.appendChild(el);
    }
    el.setAttribute('content', 'noindex, nofollow');
  }, []);

  const handleGoBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate('/');
    }
  };

  return (
    <div className="nw-site nwnf">
      <NotFoundHero onGoBack={handleGoBack} />
      <NotFoundRecover pages={PAGES} popular={POPULAR} cards={CARDS} />
    </div>
  );
}

export default NavigatorNotFoundPage;
