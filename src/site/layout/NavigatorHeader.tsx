/**
 * Public site header for the Navigator design: the contact top bar, the main
 * navigation with its three mega menus, and the phone menu sheet.
 *
 * Menu content comes from the same navigationData.ts the legacy header reads,
 * so both designs always offer the same pages under the same names. The logo is
 * the current one (Logo.tsx); the new logo pack is deliberately not used yet.
 */
import { useEffect, useId, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router';
import {
  ArrowRight,
  ChevronDown,
  Clock,
  Compass,
  FileText,
  LogIn,
  Mail,
  Menu,
  MessageCircle,
  Phone,
  X,
} from 'lucide-react';
import { COMPANY } from '../../config/companyFacts';
import { Logo } from '../../components/layout/Logo';
import {
  companyItems,
  companyPanel,
  serviceItems,
  servicesPanel,
  solutionItems,
  solutionsPanel,
  type MegaPanelConfig,
  type NavMenuItem,
} from '../../components/layout/navigationData';
import { getOptimizedImageUrl } from '../../utils/optimizedImages';
import { BUSINESS_HOURS, PHONE_DISPLAY, PHONE_HREF, WHATSAPP_HREF } from '../siteLinks';

type MenuKey = 'services' | 'solutions' | 'company';

interface MenuDef {
  key: MenuKey;
  label: string;
  items: NavMenuItem[];
  panel: MegaPanelConfig;
  wide: boolean;
  isActive: (pathname: string) => boolean;
}

const MENUS: MenuDef[] = [
  {
    key: 'services',
    label: 'Services',
    items: serviceItems,
    panel: servicesPanel,
    wide: true,
    isActive: (p) => p === '/services' || serviceItems.some((i) => i.path === p),
  },
  {
    key: 'solutions',
    label: 'Solutions',
    items: solutionItems,
    panel: solutionsPanel,
    wide: false,
    isActive: (p) => p.startsWith('/solutions'),
  },
  {
    key: 'company',
    label: 'Company',
    items: companyItems,
    panel: companyPanel,
    wide: false,
    // /team is reached from About, not the menu, but it is a company page.
    isActive: (p) => p === '/team' || companyItems.some((i) => i.path === p),
  },
];

interface NavigatorHeaderProps {
  /** Collapses the top bar and adds a shadow once the page has scrolled. */
  isScrolled?: boolean;
}

export function NavigatorHeader({ isScrolled = false }: NavigatorHeaderProps) {
  const { pathname } = useLocation();
  const [openMenu, setOpenMenu] = useState<MenuKey | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetSection, setSheetSection] = useState<MenuKey | null>(null);
  const rowRef = useRef<HTMLDivElement>(null);
  const idBase = useId();

  // Any navigation closes every menu.
  useEffect(() => {
    setOpenMenu(null);
    setSheetOpen(false);
    setSheetSection(null);
  }, [pathname]);

  // Escape closes, and so does a click outside the navigation row.
  useEffect(() => {
    if (!openMenu && !sheetOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpenMenu(null);
        setSheetOpen(false);
      }
    };
    const onPointer = (event: PointerEvent) => {
      if (rowRef.current && !rowRef.current.contains(event.target as Node)) {
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
            <Clock size={14} strokeWidth={1.75} aria-hidden="true" />
            <span>{BUSINESS_HOURS}</span>
          </div>
          <div className="nwh-top-contacts">
            <a className="nwh-toplink" href={PHONE_HREF}>
              <Phone size={14} strokeWidth={1.75} aria-hidden="true" />
              <span>{PHONE_DISPLAY}</span>
            </a>
            <span className="nwh-top-sep" aria-hidden="true" />
            <a className="nwh-toplink" href={`mailto:${COMPANY.email}`}>
              <Mail size={14} strokeWidth={1.75} aria-hidden="true" />
              <span>{COMPANY.email}</span>
            </a>
            <span className="nwh-top-sep" aria-hidden="true" />
            <a
              className="nwh-toplink"
              href={WHATSAPP_HREF}
              target="_blank"
              rel="noopener noreferrer"
            >
              <MessageCircle size={14} strokeWidth={1.75} aria-hidden="true" />
              <span>WhatsApp</span>
            </a>
            <span className="nwh-top-sep" aria-hidden="true" />
            <Link className="nwh-toplink" to="/get-quote">
              <FileText size={14} strokeWidth={1.75} aria-hidden="true" />
              <span>Get Quote</span>
            </Link>
          </div>
          <div className="nwh-top-icons">
            <a
              className="nwh-toplink"
              href={PHONE_HREF}
              aria-label={`Call Navigate Wealth on ${PHONE_DISPLAY}`}
            >
              <Phone size={16} strokeWidth={1.75} aria-hidden="true" />
            </a>
            <a
              className="nwh-toplink"
              href={WHATSAPP_HREF}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Chat to Navigate Wealth on WhatsApp"
            >
              <MessageCircle size={16} strokeWidth={1.75} aria-hidden="true" />
            </a>
            <Link className="nwh-toplink" to="/get-quote" aria-label="Get a quote">
              <FileText size={16} strokeWidth={1.75} aria-hidden="true" />
            </Link>
          </div>
        </div>
      </div>

      <nav
        aria-label="Main navigation"
        className="nwh-bar"
        data-scrolled={isScrolled ? 'true' : 'false'}
      >
        <div className="nwh-wrap nwh-row" ref={rowRef}>
          <Link to="/" className="nwh-home" aria-label="Navigate Wealth home">
            <Logo />
          </Link>

          <div className="nwh-links nwh-desktop">
            <Link className="nwh-link" to="/" aria-current={current('/')}>
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
                  aria-controls={`${idBase}-${menu.key}`}
                  data-active={menu.isActive(pathname) ? 'true' : undefined}
                  onClick={() => setOpenMenu(open ? null : menu.key)}
                >
                  {menu.label}
                  <ChevronDown
                    className="nwh-chev"
                    size={14}
                    strokeWidth={1.75}
                    aria-hidden="true"
                  />
                </button>
              );
            })}
            <Link className="nwh-link" to="/ask-vasco" aria-current={current('/ask-vasco')}>
              <Compass size={16} strokeWidth={1.75} aria-hidden="true" />
              Ask Vasco
            </Link>
            <Link className="nwh-link" to="/resources" aria-current={current('/resources')}>
              Resources
            </Link>
            <Link className="nwh-link" to="/contact" aria-current={current('/contact')}>
              Contact
            </Link>
          </div>

          <div className="nwh-actions nwh-desktop">
            <Link className="nwh-ghost" to="/login">
              <LogIn size={16} strokeWidth={1.75} aria-hidden="true" />
              Log In
            </Link>
            <Link className="nwh-primary" to="/signup">
              Get Started
            </Link>
          </div>

          <div className="nwh-mobile">
            <Link className="nwh-primary" to="/signup">
              Get Started
            </Link>
            <button
              type="button"
              className="nwh-burger"
              aria-label={sheetOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={sheetOpen}
              aria-controls={`${idBase}-sheet`}
              onClick={() => setSheetOpen((open) => !open)}
            >
              {sheetOpen ? (
                <X size={20} strokeWidth={1.75} aria-hidden="true" />
              ) : (
                <Menu size={20} strokeWidth={1.75} aria-hidden="true" />
              )}
            </button>
          </div>

          {activeMenu && (
            <MegaPanel
              id={`${idBase}-${activeMenu.key}`}
              menu={activeMenu}
              onNavigate={() => setOpenMenu(null)}
            />
          )}
        </div>

        {sheetOpen && (
          <div className="nwh-sheet" id={`${idBase}-sheet`}>
            <div className="nwh-sheet-inner">
              <ul className="nwh-sheet-list">
                <li>
                  <Link className="nwh-mrow" to="/" aria-current={current('/')}>
                    Home
                  </Link>
                </li>
                {MENUS.map((menu) => {
                  const open = sheetSection === menu.key;
                  return (
                    <li key={menu.key}>
                      <button
                        type="button"
                        className="nwh-mrow"
                        aria-expanded={open}
                        aria-controls={`${idBase}-m-${menu.key}`}
                        onClick={() => setSheetSection(open ? null : menu.key)}
                      >
                        {menu.label}
                        <ChevronDown
                          className="nwh-chev"
                          size={18}
                          strokeWidth={1.75}
                          aria-hidden="true"
                        />
                      </button>
                      {open && (
                        <ul className="nwh-msub" id={`${idBase}-m-${menu.key}`}>
                          {menu.key === 'services' && (
                            <li>
                              <Link to="/services">
                                <ArrowRight size={16} strokeWidth={1.75} aria-hidden="true" />
                                All services
                              </Link>
                            </li>
                          )}
                          {menu.items.map((item) => (
                            <li key={item.path}>
                              <Link to={item.path} aria-current={current(item.path)}>
                                <item.icon size={16} strokeWidth={1.75} aria-hidden="true" />
                                {item.label}
                              </Link>
                            </li>
                          ))}
                        </ul>
                      )}
                    </li>
                  );
                })}
                <li>
                  <Link className="nwh-mrow" to="/ask-vasco" aria-current={current('/ask-vasco')}>
                    Ask Vasco
                  </Link>
                </li>
                <li>
                  <Link className="nwh-mrow" to="/resources" aria-current={current('/resources')}>
                    Resources
                  </Link>
                </li>
                <li>
                  <Link className="nwh-mrow" to="/contact" aria-current={current('/contact')}>
                    Contact
                  </Link>
                </li>
              </ul>
              <div className="nwh-sheet-actions">
                <Link className="nw-outline" to="/login">
                  <LogIn size={16} strokeWidth={1.75} aria-hidden="true" />
                  Log In
                </Link>
                <Link className="nw-btn" to="/signup">
                  Get Started
                </Link>
                <a className="nwh-quick" href={PHONE_HREF}>
                  <Phone size={15} strokeWidth={1.75} aria-hidden="true" />
                  Call us
                </a>
                <a
                  className="nwh-quick"
                  href={WHATSAPP_HREF}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <MessageCircle size={15} strokeWidth={1.75} aria-hidden="true" />
                  WhatsApp
                </a>
              </div>
            </div>
          </div>
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
  const { panel, items } = menu;
  return (
    <div
      id={id}
      className={`nwh-panel nwh-desktop ${menu.wide ? 'nwh-panel--wide' : 'nwh-panel--narrow'}`}
    >
      <div className="nwh-panel-media">
        <picture>
          <source
            type="image/avif"
            srcSet={`${getOptimizedImageUrl(panel.image.key, 480, 'avif')} 480w, ${getOptimizedImageUrl(panel.image.key, 768, 'avif')} 768w`}
            sizes="300px"
          />
          <img
            src={getOptimizedImageUrl(panel.image.key, 768, 'webp')}
            alt={panel.image.alt}
            width={300}
            height={320}
            decoding="async"
          />
        </picture>
        <div className="nwh-panel-copy">
          <p className="nwh-panel-heading">{panel.heading}</p>
          <p className="nwh-panel-tagline">{panel.tagline}</p>
          {panel.cta && (
            <Link className="nwh-cta" to={panel.cta.to} onClick={onNavigate}>
              {panel.cta.label}
              <ArrowRight size={14} strokeWidth={1.75} aria-hidden="true" />
            </Link>
          )}
        </div>
      </div>
      <ul className="nwh-grid" aria-label={menu.label}>
        {items.map((item) => (
          <li key={item.path}>
            <Link className="nwh-tile" to={item.path} onClick={onNavigate}>
              <span className="nwh-tile-i" aria-hidden="true">
                <item.icon size={18} strokeWidth={1.75} />
              </span>
              <span>
                <span className="nwh-tile-t">{item.label}</span>
                <span className="nwh-tile-d">{item.description}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
