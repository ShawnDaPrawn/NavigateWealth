/**
 * The redesigned home page, reached the way production reaches it: the `/`
 * route's lazy page with the design switch set to Navigator. Covers what the
 * redesign must not lose — every link the live page has, its SEO and JSON-LD,
 * the enquiry reaching the endpoint with a byte-identical body — and what it
 * adds: the search-led H1, a pausable carousel, the partners dialog, field
 * validation and in-form errors.
 */
import { Suspense } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';

vi.mock('../design', () => ({ SITE_DESIGN: 'navigator', resolveSiteDesign: () => 'navigator' }));
vi.mock('../../utils/supabase/info', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../utils/supabase/info')>()),
  projectId: 'proj',
  publicAnonKey: 'anon',
}));

// jsdom has no element scrolling.
Element.prototype.scrollTo = () => {};

const { HomePage } = await import('../../app/publicPages');
const { HomePage: LiveHomePage } = await import('../../components/pages/HomePage');

const ARTICLES = [
  {
    id: 'a2',
    title: 'Your household inflation rate is not the headline number',
    slug: 'household-inflation',
    excerpt: 'Electricity and water have outpaced headline inflation.',
    category_name: 'Personal Finance',
    published_at: '2026-09-10T08:00:00Z',
    reading_time_minutes: 4,
    view_count: 3,
  },
  {
    id: 'a1',
    title: 'The will you signed may not be valid',
    slug: 'will-validity',
    excerpt: 'An incorrectly signed will cannot be corrected afterwards.',
    category_name: 'Estate & Tax Planning',
    published_at: '2026-10-12T08:00:00Z',
    reading_time_minutes: 4,
    hero_image_url: 'https://cdn.example.com/will.jpg',
    view_count: 40,
  },
];

function mockFetch({ articles = ARTICLES, submitOk = true, error = '' } = {}) {
  const fn = vi.fn(async (url: string) => {
    if (String(url).includes('/publications/articles')) {
      return { ok: true, json: async () => ({ data: articles }) };
    }
    if (String(url).includes('/contact-form/submit')) {
      return submitOk
        ? { ok: true, json: async () => ({ success: true }) }
        : { ok: false, json: async () => ({ error }) };
    }
    return { ok: true, json: async () => ({}) };
  });
  vi.stubGlobal('fetch', fn);
  return fn;
}

function submitBodies(fn: ReturnType<typeof mockFetch>): string[] {
  return fn.mock.calls
    .filter(([url]) => String(url).includes('/contact-form/submit'))
    .map((call) => String((call as unknown as [string, RequestInit])[1].body));
}

async function renderNavigator() {
  render(
    <MemoryRouter initialEntries={['/']}>
      <Suspense fallback={null}>
        <HomePage />
      </Suspense>
    </MemoryRouter>,
  );
  return screen.findByRole('heading', { level: 1 });
}

function renderLive() {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <LiveHomePage />
    </MemoryRouter>,
  );
}

function hrefs(root: ParentNode = document): Set<string> {
  return new Set([...root.querySelectorAll('a[href]')].map((a) => a.getAttribute('href') ?? ''));
}

/**
 * Completes the hero's fill bar. jsdom has no AnimationEvent, so React listens
 * for the webkit-prefixed name there; browsers fire `animationend`. Firing
 * both reaches whichever React chose — the first remounts the bar, so the
 * second lands on a detached node.
 */
function endFill() {
  const fill = document.querySelector('.nwhm-fill')!;
  for (const type of ['animationend', 'webkitAnimationEnd']) {
    fireEvent(fill, new Event(type, { bubbles: true }));
  }
}

function slides(): HTMLElement[] {
  return [...document.querySelectorAll<HTMLElement>('[aria-roledescription="slide"]')];
}

beforeEach(() => {
  mockFetch();
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  document.getElementById('seo-structured-data')?.remove();
});

describe('Navigator home page', () => {
  it('leads with the searched-for phrase as the only H1, the live headline beneath it', async () => {
    const h1 = await renderNavigator();
    expect(h1.textContent).toBe(
      'Independent Wealth Management and Financial Advice in South Africa',
    );
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(slides()[0].textContent).toContain('Secure Your Financial Future.');
    // The hero's only raster image is the flag, loaded first.
    const flag = screen.getByAltText('South African flag');
    expect(flag.getAttribute('loading')).toBe('eager');
    expect(flag.getAttribute('fetchpriority')).toBe('high');
  });

  it('loads every photograph below the hero lazily', async () => {
    await renderNavigator();
    await screen.findByRole('link', { name: 'The will you signed may not be valid' });
    const eager = [...document.querySelectorAll('img')].filter(
      (img) => img.getAttribute('loading') !== 'lazy',
    );
    expect(eager.map((img) => img.getAttribute('alt'))).toEqual(['South African flag']);
  });

  it('keeps every link the live page has, and adds only existing routes', async () => {
    renderLive();
    await screen.findByRole('link', { name: /The will you signed may not be valid/ });
    const live = hrefs();
    cleanup();
    document.getElementById('seo-structured-data')?.remove();

    await renderNavigator();
    await screen.findByRole('link', { name: 'The will you signed may not be valid' });
    const nav = hrefs();
    for (const target of live) expect(nav, `missing ${target}`).toContain(target);
    expect(nav).toEqual(
      new Set([
        // Hero slides: every slide's two actions.
        '/signup',
        '/services',
        '/retirement-planning',
        '/get-quote',
        '/investment-management',
        '/contact',
        '/risk-management',
        // Audience paths (the site navigation's Solutions).
        '/solutions/individuals',
        '/solutions/businesses',
        '/solutions/advisers',
        // Services.
        '/estate-planning',
        '/tax-planning',
        '/employee-benefits',
        '/financial-planning',
        '/medical-aid',
        '/schedule-consultation',
        // Insights and Ask Vasco.
        '/resources?section=insights',
        '/resources/article/will-validity',
        '/resources/article/household-inflation',
        '/ask-vasco',
        // FAQ help card and the enquiry form.
        'tel:+27126672505',
        'mailto:info@navigatewealth.co',
        '/legal/privacy-notice',
      ]),
    );
  });

  it('emits the same SEO tags and JSON-LD as the live page', async () => {
    renderLive();
    await waitFor(() => expect(document.getElementById('seo-structured-data')).not.toBeNull());
    const liveData = document.getElementById('seo-structured-data')!.textContent;
    const liveTitle = document.title;
    const liveCanonical = document.querySelector('link[rel="canonical"]')!.getAttribute('href');
    cleanup();
    document.getElementById('seo-structured-data')?.remove();

    await renderNavigator();
    await waitFor(() => expect(document.getElementById('seo-structured-data')).not.toBeNull());
    expect(document.getElementById('seo-structured-data')!.textContent).toBe(liveData);
    expect(document.title).toBe(liveTitle);
    expect(document.querySelector('link[rel="canonical"]')!.getAttribute('href')).toBe(
      liveCanonical,
    );
    // The FAQPage questions are on the page, answers kept in the document.
    const data = JSON.parse(liveData!);
    const faq = data['@graph'].find((n: { '@type': string }) => n['@type'] === 'FAQPage');
    for (const q of faq.mainEntity) {
      expect(screen.getByRole('button', { name: q.name })).toBeDefined();
      expect(document.body.textContent).toContain(q.acceptedAnswer.text);
    }
  });

  it('keeps all four slides in the document and shows one at a time', async () => {
    await renderNavigator();
    const all = slides();
    expect(all).toHaveLength(4);
    const active = () => all.map((s) => s.getAttribute('data-active'));
    expect(active()).toEqual(['true', 'false', 'false', 'false']);
    expect(all[1].getAttribute('aria-hidden')).toBe('true');
    // Hidden slides' actions are out of the tab order.
    expect(
      within(all[1]).getByRole('link', { hidden: true, name: /Plan My Retirement/ }).tabIndex,
    ).toBe(-1);

    fireEvent.click(screen.getByRole('button', { name: 'Go to slide 3' }));
    expect(active()).toEqual(['false', 'false', 'true', 'false']);
    expect(screen.getByRole('button', { name: 'Go to slide 3' }).getAttribute('aria-current')).toBe(
      'true',
    );

    // The fill bar times each slide; when it completes, the next one shows.
    endFill();
    expect(active()).toEqual(['false', 'false', 'false', 'true']);
    endFill();
    expect(active()).toEqual(['true', 'false', 'false', 'false']);
  });

  it('pauses the slides with the button and while focus is inside them', async () => {
    await renderNavigator();
    const fill = () => document.querySelector('.nwhm-fill')!;
    expect(fill().getAttribute('data-running')).toBe('true');

    fireEvent.click(screen.getByRole('button', { name: 'Pause slides' }));
    expect(fill().getAttribute('data-running')).toBe('false');
    fireEvent.click(screen.getByRole('button', { name: 'Play slides' }));
    expect(fill().getAttribute('data-running')).toBe('true');

    fireEvent.focus(screen.getByRole('button', { name: 'Go to slide 2' }));
    expect(fill().getAttribute('data-running')).toBe('false');
    fireEvent.blur(screen.getByRole('button', { name: 'Go to slide 2' }));
    expect(fill().getAttribute('data-running')).toBe('true');
  });

  it('lists every partner by service in a dialog and returns focus on close', async () => {
    await renderNavigator();
    const open = screen.getByRole('button', { name: /View All Partners/ });
    expect(screen.getAllByRole('img', { name: /logo$/ }).length).toBe(12);
    fireEvent.click(open);
    const dialog = await screen.findByRole('dialog', { name: 'Our Trusted Partners' });
    expect(
      within(dialog)
        .getAllByRole('heading', { level: 3 })
        .map((h) => h.textContent),
    ).toEqual([
      'Risk Management',
      'Medical Aid',
      'Investment Management',
      'Group Benefits',
      'Estate Planning',
    ]);
    expect(within(dialog).getByText('EW Serfontein & Associates')).toBeDefined();
    fireEvent.keyDown(dialog, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(open));
  });

  it('shows featured articles most-read first, and keeps the section without them', async () => {
    await renderNavigator();
    const lead = await screen.findByRole('link', { name: 'The will you signed may not be valid' });
    expect(lead.closest('li')!.className).toContain('nwhm-ins--lead');
    cleanup();

    mockFetch({ articles: [] });
    await renderNavigator();
    const section = document.getElementById('insights')!;
    await waitFor(() => expect(section.getAttribute('aria-busy')).toBe('false'));
    expect(within(section).queryAllByRole('listitem')).toHaveLength(0);
    expect(within(section).getByRole('link', { name: /View all insights/ })).toBeDefined();
    expect(within(section).getByRole('link', { name: /Ask Vasco a question/ })).toBeDefined();
  });
});

describe('Navigator "Get Started" enquiry', () => {
  function form() {
    return screen.getByRole('form', { name: 'Get Started' });
  }
  function fill(root: HTMLElement) {
    fireEvent.change(within(root).getByLabelText(/^First Name/), { target: { value: ' Thandi ' } });
    fireEvent.change(within(root).getByLabelText(/^Last Name/), {
      target: { value: 'van der Merwe' },
    });
    fireEvent.change(within(root).getByLabelText(/^Email Address/), {
      target: { value: 'thandi@example.com' },
    });
    fireEvent.change(within(root).getByLabelText(/^Phone Number/), {
      target: { value: '082 000 0000' },
    });
  }

  it('sends a body byte-identical to the live form', async () => {
    const liveFetch = mockFetch();
    const { container } = renderLive();
    const liveForm = container.querySelector('form')!;
    fill(liveForm);
    fireEvent.submit(liveForm);
    await waitFor(() => expect(submitBodies(liveFetch)).toHaveLength(1));
    const [liveBody] = submitBodies(liveFetch);
    cleanup();
    document.getElementById('seo-structured-data')?.remove();

    const navFetch = mockFetch();
    await renderNavigator();
    fill(form());
    fireEvent.click(within(form()).getByRole('button', { name: /Get Started Today/ }));
    await waitFor(() => expect(submitBodies(navFetch)).toHaveLength(1));
    const [navBody] = submitBodies(navFetch);

    expect(navBody).toBe(liveBody);
    expect(JSON.parse(navBody)).toEqual({
      firstName: 'Thandi',
      lastName: 'van der Merwe',
      email: 'thandi@example.com',
      phone: '082 000 0000',
      service: 'General consultation / All Service',
    });
    expect(await screen.findByRole('status')).toBeDefined();
    expect(screen.getByRole('status').textContent).toContain(
      "Hi Thandi, we've received your enquiry about General consultation.",
    );
  });

  it('records the chosen service as the live form does', async () => {
    const fn = mockFetch();
    await renderNavigator();
    fill(form());
    fireEvent.change(within(form()).getByLabelText('Service of Interest'), {
      target: { value: 'Group Benefits' },
    });
    fireEvent.click(within(form()).getByRole('button', { name: /Get Started Today/ }));
    await waitFor(() => expect(submitBodies(fn)).toHaveLength(1));
    expect(JSON.parse(submitBodies(fn)[0]).service).toBe('Group Benefits');
  });

  it('says which fields need fixing, focuses the first and sends nothing', async () => {
    const fn = mockFetch();
    await renderNavigator();
    fireEvent.change(within(form()).getByLabelText(/^Email Address/), {
      target: { value: 'not-an-email' },
    });
    fireEvent.click(within(form()).getByRole('button', { name: /Get Started Today/ }));
    expect(await screen.findByText('Enter your first name')).toBeDefined();
    expect(screen.getByText('Enter your last name')).toBeDefined();
    expect(screen.getByText('Enter a valid email address')).toBeDefined();
    expect(screen.getByText('Enter your phone number')).toBeDefined();
    const first = within(form()).getByLabelText(/^First Name/);
    expect(first.getAttribute('aria-invalid')).toBe('true');
    expect(first.getAttribute('aria-describedby')).toBe(
      screen.getByText('Enter your first name').id,
    );
    expect(document.activeElement).toBe(first);
    expect(submitBodies(fn)).toHaveLength(0);
  });

  it('shows a failed send in the form, not a confirmation', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    mockFetch({ submitOk: false, error: 'Validation failed' });
    await renderNavigator();
    fill(form());
    fireEvent.click(within(form()).getByRole('button', { name: /Get Started Today/ }));
    expect((await screen.findByRole('alert')).textContent).toContain('Validation failed');
    expect(screen.queryByRole('status')).toBeNull();
    expect(within(form()).getByRole('link', { name: 'Privacy Notice' }).getAttribute('href')).toBe(
      '/legal/privacy-notice',
    );
  });
});
