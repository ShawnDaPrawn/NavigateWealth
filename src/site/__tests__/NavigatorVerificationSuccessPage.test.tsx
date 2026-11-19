/**
 * The redesigned verification-success page, reached the way production
 * reaches it: VerificationSuccessPage with the design switch on lazy-loads
 * NavigatorVerificationSuccessPage.
 *
 * Auth is safety-critical here, so most of this file renders the live page
 * and the redesign side by side, through the same switch, for every kind of
 * account the live page tells apart (signed out; signed in with an
 * application still to start, or under way; signed in otherwise), and checks
 * they say the same thing, count down the same way and replace the history
 * entry with the same path at the same moment — including when the session
 * arrives part-way through the countdown. The rest covers what the redesign
 * must not lose (one H1, links only to routes that exist, the firm's details
 * from companyFacts, no SEO tags, as on the live page) and what it adds (the
 * progress bar).
 */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation, useNavigationType } from 'react-router';
import type { AppUser } from '../../utils/auth/types';

interface FakeAuth {
  isAuthenticated: boolean;
  user: Partial<AppUser> | null;
}

const h = vi.hoisted(() => ({
  design: 'navigator' as 'legacy' | 'navigator',
  auth: { isAuthenticated: false, user: null } as FakeAuth,
}));

vi.mock('../design', () => ({
  get SITE_DESIGN() {
    return h.design;
  },
  resolveSiteDesign: () => h.design,
}));
vi.mock('../../components/auth/AuthContext', () => ({
  useAuth: () => h.auth,
}));

const { default: VerificationSuccessPage } =
  await import('../../components/pages/VerificationSuccessPage');
// Loaded up front so the lazy page resolves at once under fake timers.
await import('../pages/NavigatorVerificationSuccessPage');
const { logger } = await import('../../utils/logger');
const { COMPANY } = await import('../../config/companyFacts');

const here = dirname(fileURLToPath(import.meta.url));
const read = (path: string) => readFileSync(resolve(here, path), 'utf8');
const liveSource = read('../../components/pages/VerificationSuccessPage.tsx');
const navigatorSource = read('../pages/NavigatorVerificationSuccessPage.tsx');

type Design = 'legacy' | 'navigator';
const DESIGNS: Design[] = ['legacy', 'navigator'];

const SIGNED_OUT: FakeAuth = { isAuthenticated: false, user: null };
const NEW_APPLICANT: FakeAuth = {
  isAuthenticated: true,
  user: { id: 'u1', email: 'a@example.com', role: 'client', applicationStatus: 'incomplete' },
};
const MID_APPLICATION: FakeAuth = {
  isAuthenticated: true,
  user: {
    id: 'u1',
    email: 'a@example.com',
    role: 'client',
    applicationStatus: 'incomplete',
    accountType: 'personal',
  },
};
const APPROVED: FakeAuth = {
  isAuthenticated: true,
  user: { id: 'u1', email: 'a@example.com', role: 'client', applicationStatus: 'approved' },
};
const AUTHENTICATED_WITHOUT_USER: FakeAuth = { isAuthenticated: true, user: null };

function LocationProbe() {
  const location = useLocation();
  const type = useNavigationType();
  return (
    <span data-testid="location" data-type={type}>
      {location.pathname}
    </span>
  );
}

const where = () => screen.getByTestId('location');

const tree = () => (
  <MemoryRouter initialEntries={['/verification-success']}>
    <Routes>
      <Route path="/verification-success" element={<VerificationSuccessPage />} />
      {['/login', '/account-type', '/application', '/dashboard', '/contact', '/'].map((path) => (
        <Route key={path} path={path} element={<p>Page {path}</p>} />
      ))}
    </Routes>
    <LocationProbe />
  </MemoryRouter>
);

/** Renders /verification-success in the given design, its countdown on fake timers. */
async function renderPage(design: Design, auth: FakeAuth) {
  h.design = design;
  h.auth = auth;
  vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
  const view = render(tree());
  await screen.findByText('Email Verified Successfully!');
  return view;
}

async function tick(ms: number) {
  await act(async () => {
    vi.advanceTimersByTime(ms);
  });
}

const countdownLine = () => screen.getByText(/^Redirecting/).textContent;
const cta = (text: string) => screen.getByText(text).closest('a') as HTMLAnchorElement;

/** Runs a scenario in both designs and returns each one's result. */
async function inBothDesigns<T>(scenario: (design: Design) => Promise<T>) {
  const results = {} as Record<Design, T>;
  for (const design of DESIGNS) {
    vi.mocked(logger.info).mockClear();
    results[design] = await scenario(design);
    cleanup();
    vi.useRealTimers();
  }
  return results;
}

/** Walks the countdown second by second and reports what each design did. */
async function countDown(design: Design, auth: FakeAuth, ctaText: string) {
  await renderPage(design, auth);
  const href = cta(ctaText).getAttribute('href');
  const lines: (string | null)[] = [countdownLine()];
  for (let s = 1; s < 5; s += 1) {
    await tick(1000);
    lines.push(countdownLine());
  }
  await tick(999);
  const stillHere = where().textContent;
  await tick(1);
  return {
    href,
    lines,
    stillHere,
    location: where().textContent,
    navigationType: where().getAttribute('data-type'),
    loggerInfo: vi.mocked(logger.info).mock.calls,
  };
}

beforeEach(() => {
  vi.spyOn(logger, 'info').mockImplementation(() => {});
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
  h.design = 'navigator';
  h.auth = SIGNED_OUT;
});

describe('Navigator verification-success page: the same behaviour as the live page', () => {
  const CASES: [string, FakeAuth, string, string][] = [
    ['signed out', SIGNED_OUT, 'Continue to Login', '/login'],
    [
      'signed in, application not started',
      NEW_APPLICANT,
      'Continue to Application',
      '/account-type',
    ],
    [
      'signed in, application under way',
      MID_APPLICATION,
      'Continue to Application',
      '/application',
    ],
    ['signed in otherwise', APPROVED, 'Continue to Application', '/dashboard'],
    [
      'flagged signed in with no user yet',
      AUTHENTICATED_WITHOUT_USER,
      'Continue to Application',
      '/login',
    ],
  ];

  it.each(CASES)(
    '%s: the same label, link, countdown and redirect',
    async (_name, auth, ctaText, path) => {
      const { legacy, navigator } = await inBothDesigns((design) =>
        countDown(design, auth, ctaText),
      );
      expect(navigator).toEqual(legacy);
      expect(navigator.href).toBe(path);
      expect(navigator.lines).toEqual([
        'Redirecting automatically in 5 seconds...',
        'Redirecting automatically in 4 seconds...',
        'Redirecting automatically in 3 seconds...',
        'Redirecting automatically in 2 seconds...',
        'Redirecting automatically in 1 second...',
      ]);
      expect(navigator.stillHere).toBe('/verification-success');
      expect(navigator.location).toBe(path);
      expect(navigator.navigationType).toBe('REPLACE');
      expect(navigator.loggerInfo).toEqual([['Redirecting', { path }]]);
    },
  );

  it('follows the session when it arrives part-way through the countdown', async () => {
    const { legacy, navigator } = await inBothDesigns(async (design) => {
      const view = await renderPage(design, SIGNED_OUT);
      await tick(2500);
      h.auth = NEW_APPLICANT;
      view.rerender(tree());
      const label = cta('Continue to Application').getAttribute('href');
      let elapsed = 2500;
      while (where().textContent === '/verification-success' && elapsed < 10_000) {
        await tick(100);
        elapsed += 100;
      }
      return { label, elapsed, location: where().textContent };
    });
    expect(navigator).toEqual(legacy);
    expect(navigator.location).toBe('/account-type');
  });

  it("keeps the live page's redirect rules in its source", () => {
    for (const line of [
      "return !user.accountType ? '/account-type' : '/application';",
      "return '/dashboard';",
      "return '/login';",
      "logger.info('Redirecting', { path: redirectPath });",
      'navigate(redirectPath, { replace: true });',
      '}, 1000);',
      '}, [navigate, isAuthenticated, user]);',
      "const ctaText = isAuthenticated ? 'Continue to Application' : 'Continue to Login';",
    ]) {
      expect(liveSource).toContain(line);
      expect(navigatorSource).toContain(line);
    }
    expect(liveSource).toContain('useState(5)');
    expect(navigatorSource).toContain('const COUNTDOWN_FROM = 5;');
  });
});

describe('Navigator verification-success page: the board', () => {
  it('is the redesign when the switch is on, and the live page when it is off', async () => {
    await renderPage('navigator', SIGNED_OUT);
    expect(document.querySelector('.nw-site.nwvs')).not.toBeNull();
    cleanup();
    await renderPage('legacy', SIGNED_OUT);
    expect(document.querySelector('.nwvs')).toBeNull();
  });

  it("has one H1, the board's headline", async () => {
    await renderPage('navigator', SIGNED_OUT);
    const headings = screen.getAllByRole('heading');
    expect(headings.map((h) => [h.tagName, h.textContent])).toEqual([
      ['H1', 'Email Verified Successfully!'],
    ]);
  });

  it('links only to routes the site serves', async () => {
    await renderPage('navigator', SIGNED_OUT);
    const links = screen.getAllByRole('link');
    expect(
      links.map((a) => [
        a.textContent?.trim() || a.getAttribute('aria-label'),
        a.getAttribute('href'),
      ]),
    ).toEqual([
      ['Navigate Wealth home', '/'],
      ['Continue to Login', '/login'],
      ['Contact Us', '/contact'],
      ['Contact Support', '/contact'],
      ['Back to Home', '/'],
    ]);
    for (const img of document.querySelectorAll('img')) {
      expect(img.getAttribute('alt')).toBe('');
    }
  });

  it('fills the progress bar as the seconds run down, in a polite live region', async () => {
    await renderPage('navigator', SIGNED_OUT);
    const fill = () => (document.querySelector('.nwvs-fill') as HTMLElement).style.width;
    const widths = [fill()];
    for (let s = 1; s < 5; s += 1) {
      await tick(1000);
      widths.push(fill());
    }
    expect(widths).toEqual(['0%', '20%', '40%', '60%', '80%']);
    expect(screen.getByText(/^Redirecting/).closest('[aria-live="polite"]')).not.toBeNull();
  });

  it('keeps the live copy and names the FSP from companyFacts', async () => {
    await renderPage('navigator', SIGNED_OUT);
    const collapse = (s: string) => s.replace(/\s+/g, ' ');
    const live = collapse(liveSource);
    for (const text of [
      'Your email has been successfully verified. You can now log in to access your Navigate Wealth account.',
      'Need help getting started?',
      'Your account is now active and secured. For your security, please use a strong password and enable two-factor authentication in your account settings.',
    ]) {
      expect(screen.getByText(text)).toBeTruthy();
      expect(live).toContain(text);
    }
    expect(screen.getByText(`Proudly South African · FSP No. ${COMPANY.fspNumber}`)).toBeTruthy();
  });

  it('sets no SEO tags, as the live page sets none', async () => {
    const title = document.title;
    await renderPage('navigator', SIGNED_OUT);
    expect(liveSource).not.toMatch(/<SEO\b/);
    expect(navigatorSource).not.toMatch(/<SEO\b/);
    expect(document.title).toBe(title);
  });
});
