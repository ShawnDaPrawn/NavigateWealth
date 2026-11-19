/**
 * The redesigned quote "your details" step, reached the way production
 * reaches it: QuoteServiceContactPage with the design switch on lazy-loads
 * NavigatorQuoteContactPage. The lead it sends, and where it then goes, are
 * not written down here: each test that checks them runs the live page
 * (the switch off) with the same input and expects the redesign to match it.
 * Also covers the SEO data, the service copy and sidebar lists read from the
 * modules the live page reads, links only to routes that exist, the unknown
 * service, the will-drafting hand-over, and what the redesign adds (field
 * errors with focus on the first, a failed send shown in the form).
 */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';

const mode = vi.hoisted(() => ({ design: 'navigator' as 'navigator' | 'legacy' }));

vi.mock('../design', () => ({
  get SITE_DESIGN() {
    return mode.design;
  },
  resolveSiteDesign: () => mode.design,
}));
vi.mock('../../utils/supabase/info', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../utils/supabase/info')>()),
  projectId: 'proj',
  publicAnonKey: 'anon',
}));
vi.mock('../../components/features/wills/WillDraftingFlow', () => ({
  WillDraftingFlow: ({
    clientDetails,
    onBack,
  }: {
    clientDetails: Record<string, string>;
    onBack: () => void;
  }) => (
    <div data-testid="will-flow">
      {JSON.stringify(clientDetails)}
      <button type="button" onClick={onBack}>
        Back to the form
      </button>
    </div>
  ),
}));

const { QuoteServiceContactPage } = await import('../../components/pages/QuoteServiceContactPage');
const { getServiceConfig, QUOTE_SERVICES } = await import('../../components/pages/quote/constants');
const { QUOTE_GATEWAY_SESSION_KEY } = await import('../../components/pages/quote/gatewaySession');
const { QUOTE_CONTACT_POINTS, QUOTE_CONTACT_STEPS } =
  await import('../../components/pages/quoteServiceContactPageData');
const { getQuoteServiceContactSEO } = await import('../../components/seo/seo-config');
const { COMPANY } = await import('../../config/companyFacts');
const { WHATSAPP_HREF } = await import('../siteLinks');

const here = dirname(fileURLToPath(import.meta.url));
/** The live page, whitespace collapsed so JSX line breaks do not matter. */
const liveSource = readFileSync(
  resolve(here, '../../components/pages/QuoteServiceContactPage.tsx'),
  'utf8',
).replace(/\s+/g, ' ');

const SUBMIT_URL =
  'https://proj.supabase.co/functions/v1/make-server-91ed8379/quote-request/submit';

function stubFetch(reply: { ok: boolean; body: unknown } = { ok: true, body: OK_REPLY }) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({ ok: reply.ok, json: async () => reply.body })),
  );
}
const OK_REPLY = { success: true, submissionId: 'sub-123', submissionEntryId: 'entry-9' };

function submitCalls() {
  return vi.mocked(fetch).mock.calls.filter(([url]) => String(url).includes('/quote-request/'));
}

function LocationProbe() {
  const location = useLocation();
  return (
    <>
      <span data-testid="location">{location.pathname + location.search}</span>
      <span data-testid="state">{JSON.stringify(location.state ?? null)}</span>
    </>
  );
}

function renderStep(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/get-quote" element={<p>All services</p>} />
        <Route path="/get-quote/:service/contact" element={<QuoteServiceContactPage />} />
        <Route path="/get-quote/:service" element={<p>Product quote page</p>} />
      </Routes>
      <LocationProbe />
    </MemoryRouter>,
  );
}

async function renderPage(path = '/get-quote/risk-management/contact') {
  renderStep(path);
  return screen.findByRole('heading', { level: 1 });
}

const location = () => screen.getByTestId('location').textContent;
const routerState = () => JSON.parse(screen.getByTestId('state').textContent!);

function form() {
  return screen.getByRole('form', { name: 'Your details' });
}

const VALID = {
  'First name *': ' Thandi ',
  'Surname *': 'van der Merwe ',
  'Email address *': ' thandi@example.com ',
  'Contact number *': ' 082 000 0000 ',
};

function fill(values: Record<string, string>, root: HTMLElement = document.body) {
  for (const [label, value] of Object.entries(values)) {
    fireEvent.change(within(root).getByLabelText(label), { target: { value } });
  }
}

/** Fills the live page's form and continues; returns its request and where it went. */
async function runLivePage(service: string) {
  mode.design = 'legacy';
  renderStep(`/get-quote/${service}/contact`);
  await screen.findByRole('heading', { level: 1 });
  // Really the live page, not the redesign twice.
  expect(document.querySelector('.nw-site')).toBeNull();
  fill(VALID);
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: /Continue to Quote Details/ }));
  });
  await waitFor(() => expect(location()).toBe(`/get-quote/${service}`));
  expect(screen.getByText('Product quote page')).toBeDefined();
  const [url, init] = submitCalls()[0];
  const sent = { url: String(url), method: init!.method, body: String(init!.body) };
  const went = { path: location(), state: routerState() };
  cleanup();
  vi.mocked(fetch).mockClear();
  sessionStorage.clear();
  mode.design = 'navigator';
  return { sent, went };
}

async function continueNavigator() {
  await act(async () => {
    fireEvent.click(within(form()).getByRole('button', { name: /Continue to Quote Details/ }));
  });
}

beforeEach(() => {
  mode.design = 'navigator';
  sessionStorage.clear();
  stubFetch();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  document.getElementById('seo-structured-data')?.remove();
});

describe('Navigator quote contact step', () => {
  it('has one H1, the service being quoted, and headings in order', async () => {
    const h1 = await renderPage();
    expect(h1.textContent).toBe('Risk Management quote');
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)).toEqual([
      'Your details',
    ]);
    expect(screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent)).toEqual([
      'Risk Management',
      'Why Navigate Wealth?',
      'How it works',
    ]);
    const levels = [...document.querySelectorAll('h1, h2, h3, h4, h5, h6')].map((h) =>
      Number(h.tagName[1]),
    );
    levels.forEach((level, i) => expect(level - (levels[i - 1] ?? 0)).toBeLessThanOrEqual(1));
  });

  it("emits the live page's SEO tags, noindex and WebPage data", async () => {
    await renderPage('/get-quote/medical-aid/contact');
    const seo = getQuoteServiceContactSEO('medical-aid');
    await waitFor(() => expect(document.title).toBe(seo.title));
    expect(document.querySelector('meta[name="robots"]')?.getAttribute('content')).toBe(
      'noindex, follow',
    );
    expect(liveSource).toContain('robotsContent="noindex, follow"');
    expect(document.querySelector('meta[name="description"]')?.getAttribute('content')).toBe(
      seo.description,
    );
    expect(document.querySelector('link[rel="canonical"]')?.getAttribute('href')).toBe(
      seo.canonicalUrl,
    );
    const data = JSON.parse(document.getElementById('seo-structured-data')!.textContent!);
    expect(data['@type']).toBe('WebPage');
    expect(data.name).toBe(seo.title);
    expect(data.url).toBe(seo.canonicalUrl);
  });

  it('links only to routes the site serves, the phone and WhatsApp', async () => {
    await renderPage();
    const hrefs = screen.getAllByRole('link').map((a) => a.getAttribute('href'));
    expect(new Set(hrefs)).toEqual(
      new Set(['/', '/get-quote', '/legal/privacy-notice', COMPANY.phone.tel, WHATSAPP_HREF]),
    );
    const call = screen.getByRole('link', { name: 'Call Navigate Wealth on 012 667 2505' });
    expect(call.getAttribute('href')).toBe(COMPANY.phone.tel);
    expect(`27${'012 667 2505'.replace(/\D/g, '').slice(1)}`).toBe(
      COMPANY.phone.tel.replace(/\D/g, ''),
    );
    const whatsapp = screen.getByRole('link', { name: 'Chat to Navigate Wealth on WhatsApp' });
    expect(whatsapp.getAttribute('target')).toBe('_blank');
    expect(whatsapp.getAttribute('rel')).toBe('noopener noreferrer');
    expect(screen.getByRole('link', { name: /Back to services/ }).getAttribute('href')).toBe(
      '/get-quote',
    );
    expect(screen.getByRole('link', { name: 'Privacy Policy' }).getAttribute('href')).toBe(
      '/legal/privacy-notice',
    );
    for (const img of document.querySelectorAll('img'))
      expect(img.getAttribute('alt')).toBeTruthy();
  });

  it("reads the service's copy and providers from quote/constants.ts", async () => {
    await renderPage('/get-quote/retirement-planning/contact');
    const config = getServiceConfig('retirement-planning')!;
    const aside = screen.getByRole('complementary');
    expect(within(aside).getByText(config.description)).toBeDefined();
    expect(within(aside).getByText(config.heroDescription)).toBeDefined();
    expect(
      within(aside)
        .getAllByRole('listitem')
        .slice(0, 4)
        .map((li) => li.textContent),
    ).toEqual(config.topicChips);
    expect(liveSource).toContain('{selectedConfig.heroDescription}');
    expect(
      screen.getByText(
        `Tell us who you are so we can prepare your personalised retirement planning quote.`,
      ),
    ).toBeDefined();
    expect(screen.getByText(`${config.providers.length} partners`)).toBeDefined();
    expect(liveSource).toContain('<ProviderStrip providers={selectedConfig.providers}');
    const logos = within(form()).getAllByTitle(/./);
    expect(logos.map((l) => l.getAttribute('title'))).toEqual(config.providers.map((p) => p.name));

    // Profin is the one tax partner: "1 partner", singular.
    cleanup();
    await renderPage('/get-quote/tax-planning/contact');
    expect(screen.getByText('1 partner')).toBeDefined();
  });

  it("lists the live page's reasons and steps, from the module both designs read", async () => {
    await renderPage();
    expect(liveSource).toContain('{QUOTE_CONTACT_POINTS.map(');
    expect(liveSource).toContain('{QUOTE_CONTACT_STEPS.map(');
    const why = screen.getByRole('heading', { name: 'Why Navigate Wealth?' }).parentElement!;
    expect(
      within(why)
        .getAllByRole('listitem')
        .map((li) => li.textContent),
    ).toEqual(QUOTE_CONTACT_POINTS);
    const how = screen.getByRole('heading', { name: 'How it works' }).parentElement!;
    const steps = within(how).getAllByRole('listitem');
    expect(steps.map((li) => li.textContent)).toEqual(
      QUOTE_CONTACT_STEPS.map((s, i) => (i === 0 ? s.text : `${s.step}${s.text}`)),
    );
    expect(steps[1].getAttribute('aria-current')).toBe('step');
    const progress = screen.getByRole('navigation', { name: 'Quote progress' });
    expect(within(progress).getAllByRole('listitem')[1].getAttribute('aria-current')).toBe('step');
  });

  it("uses the board's eyebrow and the live page's words elsewhere", async () => {
    await renderPage();
    const text = document.body.textContent ?? '';
    expect(text).toContain('Step 2 of 3 — Your details · about a minute left');
    expect(liveSource).toContain('Step 2 of 3 — Your details');
    expect(text).toContain(
      'Tell us who you are so we can prepare your personalised quote. Next step: your specific needs.',
    );
    expect(liveSource).toContain(
      'Tell us who you are so we can prepare your personalised quote. Next step: your specific needs.',
    );
    expect(liveSource).toContain(
      'Your information is secure and will only be used to prepare your quote.',
    );
    expect(text).not.toMatch(/\d+\+ (clients|years)/i);
  });

  it('shows "Service Not Found" for a service that does not exist, and sends nothing', async () => {
    const h1 = await renderPage('/get-quote/not-a-service/contact');
    expect(h1.textContent).toBe('Service Not Found');
    expect(liveSource).toContain('Service Not Found');
    expect(screen.getByText('The requested service does not exist.')).toBeDefined();
    expect(screen.getByRole('link', { name: 'Browse All Services' }).getAttribute('href')).toBe(
      '/get-quote',
    );
    expect(screen.queryByRole('form')).toBeNull();
    expect(submitCalls()).toHaveLength(0);
  });
});

describe('Navigator quote contact lead', () => {
  it.each(['risk-management', 'medical-aid', 'estate-planning'])(
    "sends the live page's request for %s and continues as it does",
    async (service) => {
      const live = await runLivePage(service);

      await renderPage(`/get-quote/${service}/contact`);
      fill(VALID, form());
      await continueNavigator();
      await waitFor(() => expect(location()).toBe(`/get-quote/${service}`));
      expect(screen.getByText('Product quote page')).toBeDefined();

      expect(submitCalls()).toHaveLength(1);
      const [url, init] = submitCalls()[0];
      expect(String(url)).toBe(SUBMIT_URL);
      expect(String(url)).toBe(live.sent.url);
      expect(init!.method).toBe(live.sent.method);
      // Same fields, same order, same values, the honeypot included.
      expect(String(init!.body)).toBe(live.sent.body);
      expect(JSON.parse(String(init!.body))).toEqual({
        firstName: 'Thandi',
        lastName: 'van der Merwe',
        email: 'thandi@example.com',
        phone: '082 000 0000',
        productName: getServiceConfig(service)!.label,
        stage: 'initial',
        service,
        website: '',
      });
      // A public route: no anon key dressed up as a bearer token.
      expect(init!.headers).toEqual({ 'Content-Type': 'application/json' });

      expect(location()).toBe(live.went.path);
      expect(location()).toBe(`/get-quote/${service}`);
      expect(routerState()).toEqual(live.went.state);
      expect(routerState().parentSubmissionId).toBe('sub-123');
      expect(sessionStorage.getItem(QUOTE_GATEWAY_SESSION_KEY)).toBeNull();
    },
  );

  it("passes on the honeypot's value, as the live page does", async () => {
    await renderPage();
    fill(VALID, form());
    fireEvent.change(within(form()).getByLabelText('Website'), {
      target: { value: 'https://spam.example' },
    });
    await continueNavigator();
    expect(JSON.parse(String(submitCalls()[0][1]!.body)).website).toBe('https://spam.example');
  });

  it('keeps what was typed in the session store, and starts from it', async () => {
    sessionStorage.setItem(
      QUOTE_GATEWAY_SESSION_KEY,
      JSON.stringify({ firstName: 'Sipho', email: 'sipho@example.com' }),
    );
    await renderPage();
    expect((within(form()).getByLabelText('First name *') as HTMLInputElement).value).toBe('Sipho');
    fill({ 'Surname *': 'Dlamini' }, form());
    expect(JSON.parse(sessionStorage.getItem(QUOTE_GATEWAY_SESSION_KEY)!)).toEqual({
      firstName: 'Sipho',
      lastName: 'Dlamini',
      email: 'sipho@example.com',
      phone: '',
    });
  });

  it('switches service from "Quoting for", keeping what was typed', async () => {
    await renderPage();
    const select = within(form()).getByLabelText('Quoting for') as HTMLSelectElement;
    expect(select.value).toBe('risk-management');
    expect([...select.options].map((o) => o.value)).toEqual(QUOTE_SERVICES.map((s) => s.id));
    fill({ 'First name *': 'Thabo' }, form());
    fireEvent.change(select, { target: { value: 'medical-aid' } });
    await waitFor(() => expect(location()).toBe('/get-quote/medical-aid/contact'));
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Medical Aid quote');
    expect((within(form()).getByLabelText('First name *') as HTMLInputElement).value).toBe('Thabo');
  });

  it('disables the button while sending', async () => {
    let finish: (value: unknown) => void = () => {};
    vi.stubGlobal(
      'fetch',
      vi.fn(
        () =>
          new Promise((resolveFetch) => {
            finish = resolveFetch;
          }),
      ),
    );
    await renderPage();
    fill(VALID, form());
    fireEvent.click(within(form()).getByRole('button', { name: /Continue to Quote Details/ }));
    const button = within(form()).getByRole('button', { name: /Submitting…/ }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    await act(async () => {
      finish({ ok: true, json: async () => OK_REPLY });
    });
    await waitFor(() => expect(location()).toBe('/get-quote/risk-management'));
  });
});

describe('Navigator quote contact form', () => {
  it('says which fields need fixing, focuses the first and sends nothing', async () => {
    await renderPage();
    await continueNavigator();

    expect(within(form()).getByRole('alert').textContent).toBe(
      '4 fields need your attention before we can continue.',
    );
    expect(screen.getByText('Please enter your first name.')).toBeDefined();
    expect(screen.getByText('Please enter your surname.')).toBeDefined();
    expect(screen.getByText('Please enter your email address.')).toBeDefined();
    expect(screen.getByText('Please enter your contact number.')).toBeDefined();
    const first = within(form()).getByLabelText('First name *');
    expect(document.activeElement).toBe(first);
    expect(first.getAttribute('aria-invalid')).toBe('true');
    expect(document.getElementById(first.getAttribute('aria-describedby')!)!.textContent).toBe(
      'Please enter your first name.',
    );
    expect(submitCalls()).toHaveLength(0);

    // The errors follow the fields once a send has been tried.
    fill({ 'First name *': 'Thabo', 'Surname *': 'Mokoena', 'Email address *': 'thabo@' }, form());
    fill({ 'Contact number *': '123' }, form());
    expect(within(form()).getByRole('alert').textContent).toBe(
      '2 fields need your attention before we can continue.',
    );
    expect(
      screen.getByText('That email address looks incomplete — check the part after the @.'),
    ).toBeDefined();
    expect(screen.getByText('Please enter a valid contact number.')).toBeDefined();
    expect(within(form()).getByLabelText('First name *').hasAttribute('aria-invalid')).toBe(false);
    await continueNavigator();
    expect(document.activeElement).toBe(within(form()).getByLabelText('Email address *'));
    expect(submitCalls()).toHaveLength(0);
  });

  it('labels every field, and keeps the honeypot out of reach', async () => {
    await renderPage();
    for (const input of form().querySelectorAll('input, select')) {
      expect(input.id).toBeTruthy();
      expect(document.querySelector(`label[for="${input.id}"]`)).not.toBeNull();
    }
    const trap = within(form()).getByLabelText('Website');
    expect(trap.getAttribute('tabindex')).toBe('-1');
    expect(trap.closest('[aria-hidden="true"]')).not.toBeNull();
  });

  it('shows a failed send in the form, keeping what was typed', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    stubFetch({ ok: false, body: { error: 'Validation failed' } });
    await renderPage();
    fill(VALID, form());
    await continueNavigator();
    const alert = await within(form()).findByRole('alert');
    expect(alert.textContent).toBe('Validation failed');
    expect(location()).toBe('/get-quote/risk-management/contact');
    expect((within(form()).getByLabelText('Surname *') as HTMLInputElement).value).toBe(
      'van der Merwe ',
    );
  });

  it("falls back to the live page's messages when the server or network gives none", async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    stubFetch({ ok: false, body: {} });
    await renderPage();
    fill(VALID, form());
    await continueNavigator();
    expect((await within(form()).findByRole('alert')).textContent).toBe(
      'Something went wrong. Please try again.',
    );
    expect(liveSource).toContain("'Something went wrong. Please try again.'");

    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('Failed to fetch');
      }),
    );
    await continueNavigator();
    expect(within(form()).getByRole('alert').textContent).toBe(
      'Unable to submit your request. Please check your connection and try again.',
    );
    expect(liveSource).toContain(
      "'Unable to submit your request. Please check your connection and try again.'",
    );
  });
});

describe('Navigator quote contact: estate planning', () => {
  it('offers a consultation or a will, and hands a will over to the drafting flow', async () => {
    // What the live page hands the drafting flow, for the same input.
    mode.design = 'legacy';
    await renderPage('/get-quote/estate-planning/contact');
    expect(document.querySelector('.nw-site')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Draft My Will/ }));
    fill(VALID);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Start Will Drafting/ }));
    });
    const liveHandOver = JSON.parse(screen.getByTestId('will-flow').firstChild!.textContent!);
    cleanup();
    sessionStorage.clear();
    mode.design = 'navigator';

    await renderPage('/get-quote/estate-planning/contact');
    const group = screen.getByRole('group', { name: 'What would you like to do?' });
    const consult = within(group).getByRole('button', { name: /Estate Planning Consultation/ });
    const will = within(group).getByRole('button', { name: /Draft My Will/ });
    expect(consult.getAttribute('aria-pressed')).toBe('true');
    expect(will.getAttribute('aria-pressed')).toBe('false');

    fireEvent.click(will);
    expect(will.getAttribute('aria-pressed')).toBe('true');
    fill(VALID, form());
    await act(async () => {
      fireEvent.click(within(form()).getByRole('button', { name: /Start Will Drafting/ }));
    });
    const flow = screen.getByTestId('will-flow');
    // The details as typed (an email field trims itself), as the live page passes them.
    expect(JSON.parse(flow.firstChild!.textContent!)).toEqual(liveHandOver);
    expect(liveHandOver).toEqual({
      name: ' Thandi ',
      surname: 'van der Merwe ',
      email: 'thandi@example.com',
      cellphone: ' 082 000 0000 ',
    });
    expect(submitCalls()).toHaveLength(0);

    fireEvent.click(screen.getByRole('button', { name: 'Back to the form' }));
    expect((within(form()).getByLabelText('First name *') as HTMLInputElement).value).toBe(
      ' Thandi ',
    );
  });

  it('opens on the will when the address says ?will=true', async () => {
    await renderPage('/get-quote/estate-planning/contact?will=true');
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: /Draft My Will/ }).getAttribute('aria-pressed'),
      ).toBe('true'),
    );
    expect(within(form()).getByRole('button', { name: /Start Will Drafting/ })).toBeDefined();
  });

  it('offers no such choice for other services', async () => {
    await renderPage('/get-quote/risk-management/contact?will=true');
    expect(screen.queryByRole('group', { name: 'What would you like to do?' })).toBeNull();
    expect(within(form()).getByRole('button', { name: /Continue to Quote Details/ })).toBeDefined();
  });
});
