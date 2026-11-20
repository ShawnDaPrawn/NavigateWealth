/**
 * Public site header for the Navigator design, as the "Header" board draws it:
 * the contact top bar, the main navigation with its full-width mega menu, and
 * the phone menu sheet ("MobileMenu" board).
 *
 * Menu pages come from the same navigationData.ts the legacy header reads, so
 * both designs always offer the same pages under the same names. The panel copy
 * (taglines, the "Next step" card) is the board's. The logo is the current one
 * (Logo.tsx); the new logo pack is deliberately not used yet.
 */
import { useEffect, useId, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router';
import { COMPANY } from '../../config/companyFacts';
import { Logo } from '../../components/layout/Logo';
import {
  companyItems,
  serviceItems,
  solutionItems,
  type NavMenuItem,
} from '../../components/layout/navigationData';
import { getOptimizedImageUrl } from '../../utils/optimizedImages';
import { BUSINESS_HOURS, PHONE_DISPLAY, PHONE_HREF, WHATSAPP_HREF } from '../siteLinks';
import {
  ArrowIcon,
  BurgerIcon,
  ChatIcon,
  ChevronIcon,
  ClockIcon,
  CloseIcon,
  CompassIcon,
  INK,
  LogInIcon,
  MailIcon,
  MenuIcon,
  PhoneIcon,
  QUOTE_BLUE,
  QuoteIcon,
  WHATSAPP_GREEN,
} from './HeaderIcons';

type MenuKey = 'services' | 'solutions' | 'company';

/** The top bar writes the number with hyphens on the board. */
const TOP_BAR_PHONE = '012-667-2505';

interface PanelCopy {
  tagline: string;
  body: string;
  cta: { label: string; to: string };
  listLabel: string;
  feature: { label: string; title: string; cta: string; to: string; imageKey: string };
}

interface MenuDef {
  key: MenuKey;
  label: string;
  items: NavMenuItem[];
  copy: PanelCopy;
  isActive: (pathname: string) => boolean;
}

const MENUS: MenuDef[] = [
  {
    key: 'services',
    label: 'Services',
    items: serviceItems,
    copy: {
      tagline: 'Advice for every part of your financial life.',
      body: 'Independent advice across protection, investment, retirement, tax and estate planning.',
      cta: { label: 'View all services', to: '/services' },
      listLabel: 'Advice areas',
      feature: {
        label: 'Next step',
        title: 'Talk it through with an adviser.',
        cta: 'Book a free consultation',
        to: '/schedule-consultation',
        imageKey: 'services-menu',
      },
    },
    isActive: (p) => p === '/services' || serviceItems.some((i) => i.path === p),
  },
  {
    key: 'solutions',
    label: 'Solutions',
    items: solutionItems,
    copy: {
      tagline: 'Tailored guidance for wherever you are.',
      body: 'Advice shaped around your situation, whether you are planning for a household, a business or a practice.',
      cta: { label: 'Speak to an adviser', to: '/contact' },
      listLabel: 'Who we help',
      feature: {
        label: 'Next step',
        title: 'Get a quote tailored to you.',
        cta: 'Request a quote',
        to: '/get-quote',
        imageKey: 'solutions-menu',
      },
    },
    isActive: (p) => p.startsWith('/solutions'),
  },
  {
    key: 'company',
    label: 'Company',
    items: companyItems,
    copy: {
      tagline: `Get to know ${COMPANY.tradingName}.`,
      body: `An independent, proudly South African financial advisory practice. FSP ${COMPANY.fspNumber}.`,
      cta: { label: 'Contact us', to: '/contact' },
      listLabel: 'Explore',
      feature: {
        label: 'Our people',
        title: 'The people behind the advice.',
        cta: 'Meet our founder',
        to: '/team',
        imageKey: 'company-menu',
      },
    },
    // /team is reached from About, not the menu, but it is a company page.
    isActive: (p) => p === '/team' || companyItems.some((i) => i.path === p),
  },
];

/** Booking a consultation sits under Contact, so the boards mark Contact there. */
const CONSULTATION_PATHS = ['/schedule-consultation', '/contact/consultation'];

interface NavigatorHeaderProps {
  /** Collapses the top bar and adds a shadow once the page has scrolled. */
  isScrolled?: boolean;
}

export function NavigatorHeader({ isScrolled = false }: NavigatorHeaderProps) {
  const { pathname } = useLocation();
  const [openMenu, setOpenMenu] = useState<MenuKey | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  // The board opens the phone menu with Services expanded.
  const [sheetSection, setSheetSection] = useState<MenuKey | null>('services');
  const navRef = useRef<HTMLElement>(null);
  const idBase = useId();

  // Any navigation closes every menu.
  useEffect(() => {
    setOpenMenu(null);
    setSheetOpen(false);
    setSheetSection('services');
  }, [pathname]);

  // Escape closes, and so does a click outside the navigation.
  useEffect(() => {
    if (!openMenu && !sheetOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpenMenu(null);
        setSheetOpen(false);
      }
    };
    const onPointer = (event: PointerEvent) => {
      if (navRef.current && !navRef.current.contains(event.target as Node)) {
        setOpenMenu(null);
      }
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onPointer);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onPointer);
    };
  }, [openMenu, sheetOpen]);

  const current = (path: string) => (pathname === path ? 'page' : undefined);
  const activeMenu = MENUS.find((m) => m.key === openMenu) ?? null;

  return (
    <header className="nwh">
      <div className="nwh-top" data-collapsed={isScrolled ? 'true' : 'false'}>
        <div className="nwh-wrap nwh-top-row">
          <div className="nwh-hours">
            <ClockIcon size={15} stroke={INK} />
            <span>{BUSINESS_HOURS}</span>
          </div>
          <div className="nwh-top-contacts">
            <a className="nwh-toplink" href={PHONE_HREF}>
              <PhoneIcon size={15} stroke={INK} />
              <span>{TOP_BAR_PHONE}</span>
            </a>
            <span className="nwh-top-sep" aria-hidden="true" />
            <a className="nwh-toplink" href={`mailto:${COMPANY.email}`}>
              <MailIcon size={15} stroke={INK} />
              <span>{COMPANY.email}</span>
            </a>
            <span className="nwh-top-sep" aria-hidden="true" />
            <a
              className="nwh-toplink"
              href={WHATSAPP_HREF}
              target="_blank"
              rel="noopener noreferrer"
            >
              <ChatIcon size={15} stroke={WHATSAPP_GREEN} />
              <span>WhatsApp</span>
            </a>
            <span className="nwh-top-sep" aria-hidden="true" />
            <Link className="nwh-toplink" to="/get-quote">
              <QuoteIcon size={15} stroke={QUOTE_BLUE} />
              <span>Get Quote</span>
            </Link>
          </div>
          <div className="nwh-top-icons">
            <a
              className="nwh-toplink"
              href={PHONE_HREF}
              aria-label={`Call Navigate Wealth on ${PHONE_DISPLAY}`}
            >
              <PhoneIcon size={15} stroke={INK} />
            </a>
            <a
              className="nwh-toplink"
              href={WHATSAPP_HREF}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Chat to Navigate Wealth on WhatsApp"
            >
              <ChatIcon size={15} stroke={WHATSAPP_GREEN} />
            </a>
            <Link className="nwh-toplink" to="/get-quote" aria-label="Get a quote">
              <QuoteIcon size={15} stroke={QUOTE_BLUE} rules="top" />
            </Link>
          </div>
        </div>
      </div>

      <nav
        ref={navRef}
        aria-label="Main navigation"
        className="nwh-bar"
        data-scrolled={isScrolled ? 'true' : 'false'}
      >
        <div className="nwh-wrap nwh-row">
          <Link to="/" className="nwh-home" aria-label="Navigate Wealth home">
            <Logo />
          </Link>

          <div className="nwh-links nwh-desktop" data-menu-open={openMenu ? 'true' : undefined}>
            <Link className="nwh-link nwh-link-home" to="/" aria-current={current('/')}>
              Home
            </Link>
            {MENUS.map((menu) => {
              const open = openMenu === menu.key;
              return (
                <button
                  key={menu.key}
                  type="button"
                  className="nwh-link"
                  aria-expanded={open}
                  aria-controls={`${idBase}-mega`}
                  data-active={menu.isActive(pathname) ? 'true' : undefined}
                  onClick={() => {
                    setOpenMenu(open ? null : menu.key);
                    setSheetOpen(false);
                  }}
                >
                  {menu.label}
                  <ChevronIcon className="nwh-chev" size={14} />
                </button>
              );
            })}
            <Link className="nwh-link" to="/ask-vasco" aria-current={current('/ask-vasco')}>
              <CompassIcon size={16} />
              Ask Vasco
            </Link>
            <Link
              className="nwh-link"
              to="/resources"
              aria-current={current('/resources')}
              data-active={pathname.startsWith('/resources/') ? 'true' : undefined}
            >
              Resources
            </Link>
            <Link
              className="nwh-link"
              to="/contact"
              aria-current={current('/contact')}
              data-active={CONSULTATION_PATHS.includes(pathname) ? 'true' : undefined}
            >
              Contact
            </Link>
          </div>

          <div className="nwh-actions nwh-desktop">
            <Link className="nwh-ghost" to="/login">
              <LogInIcon className="nwh-login-ic" size={16} />
              Log In
            </Link>
            <Link className="nwh-primary" to="/signup">
              Get Started
            </Link>
          </div>

          <div className="nwh-mobile">
            <Link className="nwh-primary nwh-mcta" to="/signup">
              Get Started
            </Link>
            <button
              type="button"
              className="nwh-burger"
              aria-label={sheetOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={sheetOpen}
              aria-controls={`${idBase}-sheet`}
              onClick={() => {
                setSheetOpen((open) => !open);
                setOpenMenu(null);
              }}
            >
              {sheetOpen ? <CloseIcon /> : <BurgerIcon />}
            </button>
          </div>

          {sheetOpen && (
            <div className="nwh-sheet nwh-mobile" id={`${idBase}-sheet`}>
              <Link className="nwh-mrow" to="/" aria-current={current('/')}>
                Home
              </Link>
              {MENUS.map((menu) => {
                const open = sheetSection === menu.key;
                return (
                  <div key={menu.key} className="nwh-mgroup">
                    <button
                      type="button"
                      className="nwh-mrow nwh-mrow--group"
                      aria-expanded={open}
                      aria-controls={`${idBase}-m-${menu.key}`}
                      onClick={() => setSheetSection(open ? null : menu.key)}
                    >
                      <span>{menu.label}</span>
                      <ChevronIcon className="nwh-chev" size={18} />
                    </button>
                    {open && (
                      <div className="nwh-mtiles" id={`${idBase}-m-${menu.key}`}>
                        {menu.items.map((item) => (
                          <Link
                            key={item.path}
                            className="nwh-tile"
                            to={item.path}
                            aria-current={current(item.path)}
                          >
                            <span className="nwh-tile-i" aria-hidden="true">
                              <MenuIcon path={item.path} size={16} />
                            </span>
                            <span className="nwh-tile-t">{item.label}</span>
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
              <Link className="nwh-mrow" to="/ask-vasco" aria-current={current('/ask-vasco')}>
                <CompassIcon size={18} stroke={INK} />
                Ask Vasco
              </Link>
              <Link className="nwh-mrow" to="/resources" aria-current={current('/resources')}>
                Resources
              </Link>
              <Link className="nwh-mrow" to="/contact" aria-current={current('/contact')}>
                Contact
              </Link>
              <div className="nwh-sheet-actions">
                <Link className="nwh-ghost nwh-sheet-login" to="/login">
                  <LogInIcon size={16} />
                  Log In
                </Link>
                <Link className="nwh-primary nwh-sheet-start" to="/signup">
                  Get Started
                </Link>
              </div>
              <div className="nwh-sheet-quick">
                <a className="nwh-quick" href={PHONE_HREF}>
                  <PhoneIcon size={17} stroke={INK} />
                  Call
                </a>
                <a
                  className="nwh-quick"
                  href={WHATSAPP_HREF}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <ChatIcon size={17} stroke={WHATSAPP_GREEN} />
                  WhatsApp
                </a>
                <Link className="nwh-quick" to="/get-quote">
                  <QuoteIcon size={17} stroke={QUOTE_BLUE} rules="lower" />
                  Get Quote
                </Link>
              </div>
              <p className="nwh-sheet-note">
                {BUSINESS_HOURS} · FSP {COMPANY.fspNumber}
              </p>
            </div>
          )}
        </div>

        {activeMenu && (
          <>
            <div
              className="nwh-scrim nwh-desktop"
              aria-hidden="true"
              onClick={() => setOpenMenu(null)}
            />
            <MegaPanel
              id={`${idBase}-mega`}
              menu={activeMenu}
              onNavigate={() => setOpenMenu(null)}
            />
          </>
        )}
      </nav>
    </header>
  );
}

function MegaPanel({
  id,
  menu,
  onNavigate,
}: {
  id: string;
  menu: MenuDef;
  onNavigate: () => void;
}) {
  const { copy, items } = menu;
  const { feature } = copy;
  return (
    <div id={id} className="nwh-panel nwh-desktop" role="region" aria-label={`${menu.label} menu`}>
      <div className="nwh-wrap">
        <div className="nwh-mm-grid">
          <div className="nwh-mm-intro">
            <p className="nwh-mm-label">{menu.label}</p>
            <p className="nwh-mm-tagline">{copy.tagline}</p>
            <p className="nwh-mm-body">{copy.body}</p>
            <Link className="nwh-mm-cta nwh-mm-more" to={copy.cta.to} onClick={onNavigate}>
              {copy.cta.label}
              <ArrowIcon size={15} />
            </Link>
          </div>

          <div>
            <p className="nwh-mm-label">{copy.listLabel}</p>
            <div className="nwh-mm-list">
              {items.map((item) => (
                <Link key={item.path} className="nwh-mm-item" to={item.path} onClick={onNavigate}>
                  <span className="nwh-mm-ic" aria-hidden="true">
                    <MenuIcon path={item.path} size={17} />
                  </span>
                  <span className="nwh-mm-text">
                    <span className="nwh-mm-t">{item.label}</span>
                    <span className="nwh-mm-d" data-testid="nav-tile-description">
                      {item.description}
                    </span>
                  </span>
                  <ArrowIcon className="nwh-mm-arrow" size={16} />
                </Link>
              ))}
            </div>
          </div>

          <div className="nwh-mm-feature">
            <p className="nwh-mm-label">{feature.label}</p>
            <Link className="nwh-mm-card" to={feature.to} onClick={onNavigate}>
              <div className="nwh-mm-card-media">
                <picture>
                  <source
                    type="image/avif"
                    srcSet={`${getOptimizedImageUrl(feature.imageKey, 480, 'avif')} 480w, ${getOptimizedImageUrl(feature.imageKey, 768, 'avif')} 768w`}
                    sizes="272px"
                  />
                  <img
                    src={getOptimizedImageUrl(feature.imageKey, 768, 'webp')}
                    alt=""
                    width={272}
                    height={120}
                    decoding="async"
                  />
                </picture>
              </div>
              <div className="nwh-mm-card-body">
                <span className="nwh-mm-card-t">{feature.title}</span>
                <span className="nwh-mm-cta nwh-mm-card-cta">
                  {feature.cta}
                  <ArrowIcon size={14} />
                </span>
              </div>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
