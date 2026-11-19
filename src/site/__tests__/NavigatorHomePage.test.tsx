/**
 * The redesigned home page, reached the way production reaches it: HomePage
 * with the design switch on lazy-loads NavigatorHomePage. Covers what the
 * redesign must not lose (the links, the FAQ text behind the JSON-LD, the
 * featured articles, the partner list, leads reaching the endpoint with the
 * same payload) and what it adds (a stable H1, a carousel that can be paused,
 * field validation, the confirmation in place).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';

vi.mock('../design', () => ({ SITE_DESIGN: 'navigator', resolveSiteDesign: () => 'navigator' }));
vi.mock('../../utils/supabase/info', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../utils/supabase/info')>()),
  projectId: 'proj',
  publicAnonKey: 'anon',
}));

const { HomePage } = await import('../../components/pages/HomePage');
const { commonFAQs } = await import('../../components/seo/seo-config');
const { PROVIDER_GROUPS } = await import('../../components/shared/providerGroups');

const ARTICLES = [
  {
    id: 'a',
    title: 'Less read',
    slug: 'less-read',
    category_name: 'Personal Finance',
    published_at: '2026-09-10T08:00:00Z',
    reading_time_minutes: 4,
    view_count: 3,
  },
  {
    id: 'b',
    title: 'Most read',
    slug: 'most-read',
    excerpt: 'The one readers chose.',
    category_name: 'Estate & Tax Planning',
    published_at: '2026-10-12T08:00:00Z',
    reading_time_minutes: 5,
    view_count: 90,
  },
  { id: 'c', title: 'Third', slug: 'third', view_count: 2 },
  { id: 'd', title: 'Fourth, not shown', slug: 'fourth', view_count: 1 },
];

function stubFetch(articles: unknown[] = ARTICLES, submit = { ok: true, body: {} }) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      if (String(url).includes('/publications/articles')) {
        return { ok: true, json: async () => ({ data: articles }) };
      }
      return { ok: submit.ok, json: async () => submit.body };
    }),
  );
}

function submitCalls() {
  return vi
    .mocked(fetch)
    .mock.calls.filter(([url]) => String(url).includes('/contact-form/submit'));
}

/**
 * Ends the active progress bar's fill animation. jsdom has no AnimationEvent,
 * so React listens for the WebKit-prefixed name there; a browser fires the
 * unprefixed one. Firing both works in either.
 */
function endProgress() {
  const bar = screen.getByTestId('hero-progress');
  fireEvent.animationEnd(bar);
  if (screen.queryByTestId('hero-progress') === bar) {
    fireEvent(bar, new Event('webkitAnimationEnd', { bubbles: true }));
  }
}

async function renderPage() {
  render(
    <MemoryRouter initialEntries={['/']}>
      <HomePage />
    </MemoryRouter>,
  );
  return screen.findByRole('heading', { level: 1 });
}

beforeEach(() => stubFetch());
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  document.getElementById('seo-structured-data')?.remove();
});

describe('Navigator home page', () => {
  it('has one stable H1 led by the searched-for phrase', async () => {
    const h1 = await renderPage();
    expect(h1.textContent).toBe('Independent Financial Advisors in South Africa');
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    // The rotating headline is display text, not a second heading.
    expect(screen.getByText(/Secure Your Financial/).tagName).toBe('P');
  });

  it('links only to routes the site already serves', async () => {
    await renderPage();
    await screen.findByRole('link', { name: /Most read/ });
    const targets = new Set(screen.getAllByRole('link').map((a) => a.getAttribute('href')));
    expect(targets).toEqual(
      new Set([
        '/schedule-consultation',
        '/services',
        '/solutions/individuals',
        '/solutions/businesses',
        '/solutions/advisers',
        '/risk-management',
        '/retirement-planning',
        '/investment-management',
        '/estate-planning',
        '/tax-planning',
        '/employee-benefits',
        '/financial-planning',
        '/medical-aid',
        '/resources?section=insights',
        '/resources/article/most-read',
        '/resources/article/less-read',
        '/resources/article/third',
        '/ask-vasco',
        '/contact',
        'tel:+27126672505',
        'mailto:info@navigatewealth.co',
        '/legal/privacy-notice',
      ]),
    );
  });

  it('rotates the highlights when each progress bar fills, and can be paused', async () => {
    await renderPage();
    const carousel = screen.getByRole('group', { name: 'Highlights' });
    expect(carousel.getAttribute('aria-live')).toBe('off');
    expect(within(carousel).getByText(/Secure Your Financial/)).toBeDefined();

    endProgress();
    expect(within(carousel).getByText(/Secure Your Retirement With/)).toBeDefined();
    expect(within(carousel).getByRole('link', { name: 'Get a Quote' })).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: 'Show highlight 4 of 4' }));
    expect(within(carousel).getByText(/Protect What Matters/)).toBeDefined();
    expect(
      screen.getByRole('button', { name: 'Show highlight 4 of 4' }).getAttribute('aria-current'),
    ).toBe('true');

    fireEvent.click(screen.getByRole('button', { name: 'Pause highlights' }));
    expect(screen.getByRole('button', { name: 'Play highlights' })).toBeDefined();
    expect(screen.getByTestId('hero-progress').style.animationPlayState).toBe('paused');
    // Stopped, a change of slide is announced.
    expect(carousel.getAttribute('aria-live')).toBe('polite');
  });

  it('pauses while the pointer is over the highlights', async () => {
    await renderPage();
    const carousel = screen.getByRole('group', { name: 'Highlights' });
    fireEvent.mouseEnter(carousel);
    expect(screen.getByTestId('hero-progress').style.animationPlayState).toBe('paused');
    fireEvent.mouseLeave(carousel);
    expect(screen.getByTestId('hero-progress').style.animationPlayState).toBe('running');
  });

  it('starts paused when the visitor asks for reduced motion', async () => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn((query: string) => ({ matches: query.includes('reduce'), media: query })),
    );
    await renderPage();
    expect(screen.getByRole('button', { name: 'Play highlights' })).toBeDefined();
  });

  it('keeps every FAQ answer in the document, matching the FAQPage data', async () => {
    await renderPage();
    await waitFor(() => expect(document.getElementById('seo-structured-data')).not.toBeNull());
    const data = JSON.parse(document.getElementById('seo-structured-data')!.textContent!);
    const faqPage = data['@graph'].find((n: { '@type': string }) => n['@type'] === 'FAQPage');
    expect(faqPage.mainEntity).toHaveLength(commonFAQs.length);

    const faq = screen.getByRole('region', { name: 'Frequently asked questions' });
    for (const { question, answer } of commonFAQs) {
      expect(within(faq).getByRole('button', { name: question })).toBeDefined();
      expect(faq.textContent).toContain(answer);
    }
  });

  it('shows the three most-read featured articles, the most read leading', async () => {
    await renderPage();
    await screen.findByRole('link', { name: /Most read/ });
    const cards = [...document.querySelectorAll('.nwin-card')];
    expect(cards.map((c) => c.getAttribute('href'))).toEqual([
      '/resources/article/most-read',
      '/resources/article/less-read',
      '/resources/article/third',
    ]);
    expect(cards[0].className).toContain('nwin-card--lead');
    expect(screen.getByText('05 — Insights')).toBeDefined();
    expect(screen.getByText('06 — FAQ')).toBeDefined();
  });

  it('with no featured articles, drops the heading and keeps Ask Vasco', async () => {
    stubFetch([]);
    await renderPage();
    await waitFor(() => expect(screen.getByText('05 — FAQ')).toBeDefined());
    expect(screen.queryByRole('heading', { name: 'Featured Insights' })).toBeNull();
    expect(screen.getByRole('link', { name: /Ask Vasco a question/ })).toBeDefined();
  });

  it('lists every partner by service in a dialog that returns focus', async () => {
    await renderPage();
    const trigger = screen.getByRole('button', { name: /View All Partners/ });
    fireEvent.click(trigger);
    const dialog = await screen.findByRole('dialog', { name: 'Our Trusted Partners' });
    for (const group of PROVIDER_GROUPS) {
      const heading = within(dialog).getByRole('heading', { name: group.title });
      const list = heading.closest('section')!.querySelector('ul')!;
      expect(list.querySelectorAll('li')).toHaveLength(group.providers.length);
    }
    expect(within(dialog).getByText('13 partners')).toBeDefined();
    fireEvent.keyDown(dialog, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(trigger));
  });
});

describe('Navigator home enquiry form', () => {
  function form() {
    return screen.getByRole('form', { name: 'Get Started' });
  }

  it('says which fields need fixing and sends nothing', async () => {
    await renderPage();
    fireEvent.change(within(form()).getByLabelText('Phone number'), {
      target: { value: '123' },
    });
    fireEvent.click(within(form()).getByRole('button', { name: /Request a Free Consultation/ }));
    expect(await screen.findByText('Enter your first name')).toBeDefined();
    expect(screen.getByText('Enter your last name')).toBeDefined();
    expect(screen.getByText('Enter your email address')).toBeDefined();
    expect(screen.getByText('Enter a valid phone number')).toBeDefined();
    expect(document.activeElement).toBe(within(form()).getByLabelText('First name'));
    expect(submitCalls()).toHaveLength(0);
  });

  it('sends what the live form sends, honeypot included, and confirms in place', async () => {
    await renderPage();
    const f = form();
    fireEvent.change(within(f).getByLabelText('First name'), { target: { value: ' Thandi ' } });
    fireEvent.change(within(f).getByLabelText('Last name'), {
      target: { value: 'van der Merwe' },
    });
    fireEvent.change(within(f).getByLabelText('Email address'), {
      target: { value: 'thandi@example.com' },
    });
    fireEvent.change(within(f).getByLabelText('Phone number'), {
      target: { value: '082 000 0000' },
    });
    fireEvent.change(within(f).getByLabelText('Service of interest'), {
      target: { value: 'Medical Aid' },
    });
    await act(async () => {
      fireEvent.click(within(f).getByRole('button', { name: /Request a Free Consultation/ }));
    });

    expect(await screen.findByText('Thank you, Thandi.')).toBeDefined();
    expect(submitCalls()).toHaveLength(1);
    expect(JSON.parse(String(submitCalls()[0][1]!.body))).toEqual({
      firstName: 'Thandi',
      lastName: 'van der Merwe',
      email: 'thandi@example.com',
      phone: '082 000 0000',
      service: 'Medical Aid',
      website: '',
    });
  });

  it('defaults to a general consultation, as the live form does', async () => {
    await renderPage();
    const select = within(form()).getByLabelText('Service of interest') as HTMLSelectElement;
    expect(select.value).toBe('General consultation / All Service');
    expect(select.selectedOptions[0].textContent).toBe('General consultation');
  });

  it('shows a failed send in the form instead of a confirmation', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    stubFetch(ARTICLES, { ok: false, body: { error: 'Validation failed' } });
    await renderPage();
    const f = form();
    fireEvent.change(within(f).getByLabelText('First name'), { target: { value: 'Sipho' } });
    fireEvent.change(within(f).getByLabelText('Last name'), { target: { value: 'Dlamini' } });
    fireEvent.change(within(f).getByLabelText('Email address'), {
      target: { value: 'sipho@example.com' },
    });
    fireEvent.change(within(f).getByLabelText('Phone number'), {
      target: { value: '0821234567' },
    });
    fireEvent.click(within(f).getByRole('button', { name: /Request a Free Consultation/ }));
    expect((await screen.findByRole('alert')).textContent).toContain('Validation failed');
    expect(screen.queryByText(/Thank you/)).toBeNull();
  });
});
