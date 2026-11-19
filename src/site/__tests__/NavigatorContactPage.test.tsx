/**
 * The redesigned contact page, reached the way production reaches it:
 * ContactPage with the design switch on lazy-loads NavigatorContactPage.
 * Covers what the redesign must not lose (the SEO data, the audiences and
 * their copy, the firm's details from companyFacts, links only to routes that
 * exist, the ?type= and ?subject= address-bar behaviours, leads reaching the
 * endpoint with exactly the live page's payload) and what it adds (field
 * errors with focus on the first, a failed send shown in the form, the
 * confirmation in place).
 */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';

vi.mock('../design', () => ({ SITE_DESIGN: 'navigator', resolveSiteDesign: () => 'navigator' }));
vi.mock('../../utils/supabase/info', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../utils/supabase/info')>()),
  projectId: 'proj',
  publicAnonKey: 'anon',
}));

const { ContactPage } = await import('../../components/pages/ContactPage');
const { clientTypes } = await import('../../components/pages/contactPageData');
const { COMPANY } = await import('../../config/companyFacts');
const { getSEOData } = await import('../../components/seo/seo-config');
const { WHATSAPP_HREF } = await import('../siteLinks');

const here = dirname(fileURLToPath(import.meta.url));
const read = (path: string) => readFileSync(resolve(here, path), 'utf8');
/** The live page, whitespace collapsed so JSX line breaks do not matter. */
const liveSource = read('../../components/pages/ContactPage.tsx').replace(/\s+/g, ' ');
const thankYouSource = read('../../components/modals/ThankYouModal.tsx').replace(/\s+/g, ' ');

function stubFetch(submit: { ok: boolean; body: unknown } = { ok: true, body: { success: true } }) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({ ok: submit.ok, json: async () => submit.body })),
  );
}

function submitCalls() {
  return vi
    .mocked(fetch)
    .mock.calls.filter(([url]) => String(url).includes('/contact-form/submit'));
}

function LocationProbe() {
  const location = useLocation();
  return <span data-testid="location">{location.pathname + location.search}</span>;
}

async function renderPage(path = '/contact') {
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/contact" element={<ContactPage />} />
        <Route path="/schedule-consultation" element={<p>Booking page</p>} />
      </Routes>
      <LocationProbe />
    </MemoryRouter>,
  );
  return screen.findByRole('heading', { level: 1 });
}

function form() {
  return screen.getByRole('form', { name: 'Send us a message' });
}

function fill(values: Record<string, string>) {
  for (const [label, value] of Object.entries(values)) {
    fireEvent.change(within(form()).getByLabelText(label), { target: { value } });
  }
}

const VALID = {
  'First Name *': ' Thandi ',
  'Last Name *': 'van der Merwe',
  'Email Address *': ' thandi@example.com ',
  'Phone Number *': '082 000 0000',
  'Message *': '  I would like to review my retirement savings.  ',
};

beforeEach(() => stubFetch());

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  document.getElementById('seo-structured-data')?.remove();
});

describe('Navigator contact page', () => {
  it("has one H1: the board's headline", async () => {
    const h1 = await renderPage();
    expect(h1.textContent).toBe('Contact Us');
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    const h2 = screen.getAllByRole('heading', { level: 2 });
    expect(h2.map((h) => h.textContent)).toEqual(['How Can We Help?']);
  });

  it('emits the same SEO tags and ContactPage data as the live page', async () => {
    await renderPage();
    const seo = getSEOData('contact');
    await waitFor(() => expect(document.title).toBe(seo.title));
    expect(seo.title).toBe('Contact a Financial Advisor in Pretoria | Navigate Wealth');
    expect(document.querySelector('link[rel="canonical"]')?.getAttribute('href')).toBe(
      seo.canonicalUrl,
    );
    const data = JSON.parse(document.getElementById('seo-structured-data')!.textContent!);
    expect(data['@type']).toBe('ContactPage');
  });

  it('links only to routes the site serves, the phone, the mailbox and WhatsApp', async () => {
    await renderPage();
    const hrefs = screen.getAllByRole('link').map((a) => a.getAttribute('href'));
    expect(new Set(hrefs)).toEqual(
      new Set([
        COMPANY.phone.tel,
        `mailto:${COMPANY.email}`,
        '/schedule-consultation',
        '/get-quote',
        WHATSAPP_HREF,
        '/ask-vasco',
        '/legal/privacy-notice',
      ]),
    );
    // POPIA: the form says how its details are used, and links the notice.
    expect(screen.getByRole('link', { name: 'Privacy Notice' }).getAttribute('href')).toBe(
      '/legal/privacy-notice',
    );
    const whatsapp = screen.getByRole('link', { name: /WhatsApp/ });
    expect(whatsapp.getAttribute('target')).toBe('_blank');
    expect(whatsapp.getAttribute('rel')).toBe('noopener noreferrer');
    expect(screen.getByRole('link', { name: /Ask Vasco/ }).getAttribute('href')).toBe('/ask-vasco');
  });

  it("takes the firm's address, phone, email and hours from companyFacts", async () => {
    await renderPage();
    const call = screen.getByRole('link', { name: /Switchboard/ });
    expect(call.getAttribute('href')).toBe(COMPANY.phone.tel);
    expect(call.textContent).toContain('012 667 2505');
    // Both printed forms are the companyFacts number.
    const digits = COMPANY.phone.tel.replace(/\D/g, '');
    expect(`27${'012 667 2505'.replace(/\D/g, '').slice(1)}`).toBe(digits);
    const card = screen.getByRole('tabpanel');
    expect(within(card).getByText('+27 (0)12 667 2505')).toBeDefined();
    expect(`27${'+27 (0)12 667 2505'.replace(/\D/g, '').slice(3)}`).toBe(digits);

    expect(screen.getByRole('link', { name: /Email us/ }).textContent).toContain(COMPANY.email);
    expect(within(card).getByText(COMPANY.email)).toBeDefined();
    expect(within(card).getByText('navigatewealth.co')).toBeDefined();
    expect(screen.getByText(COMPANY.addressOneLine)).toBeDefined();
    expect(screen.getByText(COMPANY.officeHours.label)).toBeDefined();
    expect(screen.getByText(COMPANY.languages.join(' or '))).toBeDefined();
    expect(
      screen.getByRole('img', {
        name: 'Stylised chart marking the Navigate Wealth office in Pretoria',
      }),
    ).toBeDefined();
  });

  it("repeats the live page's hero copy word for word", async () => {
    await renderPage();
    const lead = document.querySelector('.nwct-lead')!.textContent!;
    expect(liveSource).toContain(lead);
    expect(liveSource).toContain('Switchboard');
    expect(liveSource).toContain('Email us');
  });

  it('promises nothing the firm cannot stand behind', async () => {
    await renderPage();
    const text = document.body.textContent ?? '';
    expect(text).not.toMatch(/one business day/i);
    expect(text).not.toMatch(/\d+°\d+′/); // no map coordinates for the office
    expect(text).not.toMatch(/\d+\+ (clients|years)/i);
    expect(text).toContain('We respond within 24 hours on business days.');
    expect(thankYouSource).toContain('We respond within 24 hours on business days');
  });
});

describe('Navigator contact audiences', () => {
  function tabs() {
    return within(screen.getByRole('tablist', { name: 'Enquiry type' })).getAllByRole('tab');
  }

  it('reads all three from the module the live page reads, every one in the document', async () => {
    await renderPage();
    expect(liveSource).toContain("import { clientTypes } from './contactPageData';");
    expect(tabs().map((t) => t.textContent)).toEqual(['Individuals', 'Business', 'Advisors']);
    expect(tabs()[0].getAttribute('aria-selected')).toBe('true');

    const panels = [...document.querySelectorAll('[role="tabpanel"]')];
    expect(panels).toHaveLength(3);
    expect(panels.filter((p) => p.hasAttribute('hidden'))).toHaveLength(2);
    Object.values(clientTypes).forEach((type, i) => {
      const panel = panels[i];
      expect(panel.querySelector('.nwct-card-code')!.textContent).toBe(`Enquiry · 0${i + 1}`);
      expect(panel.querySelector('h3')!.textContent).toBe(type.label);
      expect(panel.querySelector('.nwct-card-desc')!.textContent).toBe(type.description);
      expect([...panel.querySelectorAll('li')].map((li) => li.textContent)).toEqual(type.services);
    });
  });

  it('switches audience on click, and with the arrow keys, Home and End', async () => {
    await renderPage();
    const message = () => within(form()).getByLabelText('Message *') as HTMLTextAreaElement;
    expect(message().placeholder).toBe(
      'Tell us about your financial goals or any specific questions you have...',
    );

    fireEvent.click(screen.getByRole('tab', { name: 'Business' }));
    const panel = screen.getByRole('tabpanel');
    expect(panel.getAttribute('aria-labelledby')).toBe(
      screen.getByRole('tab', { name: 'Business' }).id,
    );
    expect(within(panel).getByRole('heading', { name: 'Business' })).toBeDefined();
    expect(within(form()).getByText('Business')).toBeDefined();
    expect(message().placeholder).toBe(
      'Tell us about your business needs or any specific questions you have...',
    );

    fireEvent.keyDown(screen.getByRole('tab', { name: 'Business' }), { key: 'ArrowRight' });
    expect(document.activeElement).toBe(screen.getByRole('tab', { name: 'Advisors' }));
    expect(message().placeholder).toBe(
      'Tell us about your advisory requirements or any specific questions you have...',
    );
    fireEvent.keyDown(document.activeElement!, { key: 'ArrowRight' });
    expect(document.activeElement).toBe(screen.getByRole('tab', { name: 'Individuals' }));
    fireEvent.keyDown(document.activeElement!, { key: 'End' });
    expect(document.activeElement).toBe(screen.getByRole('tab', { name: 'Advisors' }));
    fireEvent.keyDown(document.activeElement!, { key: 'Home' });
    expect(document.activeElement).toBe(screen.getByRole('tab', { name: 'Individuals' }));
    expect(tabs().filter((t) => t.getAttribute('tabindex') === '0')).toHaveLength(1);
    // The placeholders are the live page's, built from the same three topics.
    for (const topic of ['financial goals', 'business needs', 'advisory requirements']) {
      expect(liveSource).toContain(`'${topic}'`);
    }
  });

  it('opens on the audience named by ?type=, as the Solutions pages link', async () => {
    await renderPage('/contact?type=advisors');
    await waitFor(() =>
      expect(screen.getByRole('tab', { name: 'Advisors' }).getAttribute('aria-selected')).toBe(
        'true',
      ),
    );
    expect(within(screen.getByRole('tabpanel')).getByText('Succession Planning')).toBeDefined();
  });

  it('sends old ?subject=consultation links to the booking page, keeping the rest', async () => {
    render(
      <MemoryRouter initialEntries={['/contact?subject=consultation&utm_source=mail']}>
        <Routes>
          <Route path="/contact" element={<ContactPage />} />
          <Route path="/schedule-consultation" element={<p>Booking page</p>} />
        </Routes>
        <LocationProbe />
      </MemoryRouter>,
    );
    expect(await screen.findByText('Booking page')).toBeDefined();
    expect(screen.getByTestId('location').textContent).toBe(
      '/schedule-consultation?utm_source=mail',
    );
  });
});

describe('Navigator contact form', () => {
  it('says which fields need fixing, focuses the first and sends nothing', async () => {
    await renderPage();
    fill({ 'Email Address *': 'thabo@', 'Phone Number *': '123' });
    fireEvent.click(within(form()).getByRole('button', { name: /Send Enquiry/ }));

    expect(within(form()).getByRole('alert').textContent).toBe(
      '5 fields need your attention before we can send this.',
    );
    expect(screen.getByText('Please enter your first name.')).toBeDefined();
    expect(screen.getByText('Please enter your last name.')).toBeDefined();
    expect(
      screen.getByText('That email address looks incomplete — check the part after the @.'),
    ).toBeDefined();
    expect(screen.getByText('Please enter a valid phone number.')).toBeDefined();
    expect(
      screen.getByText('Tell us a little about what you need (at least 10 characters).'),
    ).toBeDefined();
    const first = within(form()).getByLabelText('First Name *');
    expect(document.activeElement).toBe(first);
    expect(first.getAttribute('aria-invalid')).toBe('true');
    expect(document.getElementById(first.getAttribute('aria-describedby')!)!.textContent).toBe(
      'Please enter your first name.',
    );
    expect(submitCalls()).toHaveLength(0);

    // The errors follow the fields once a send has been tried.
    fill({ 'First Name *': 'Thabo', 'Last Name *': 'Mokoena', 'Phone Number *': '' });
    expect(within(form()).getByRole('alert').textContent).toBe(
      '3 fields need your attention before we can send this.',
    );
    expect(screen.getByText('Please enter your phone number.')).toBeDefined();
    expect(within(form()).getByLabelText('First Name *').hasAttribute('aria-invalid')).toBe(false);
    fill({ 'Email Address *': '' });
    expect(screen.getByText('Please enter your email address.')).toBeDefined();
  });

  it("sends exactly the live page's payload, honeypot included, and confirms in place", async () => {
    await renderPage();
    fireEvent.click(screen.getByRole('tab', { name: 'Business' }));
    fill(VALID);
    await act(async () => {
      fireEvent.click(within(form()).getByRole('button', { name: /Send Enquiry/ }));
    });

    const done = await screen.findByRole('status');
    const title = within(done).getByRole('heading', {
      name: 'Thank you, Thandi. Your message is with us.',
    });
    expect(document.activeElement).toBe(title);
    expect(done.textContent).toContain('A confirmation has been sent to thandi@example.com.');
    expect(within(done).getByRole('link', { name: /Book a Free Consultation/ })).toBeDefined();

    expect(submitCalls()).toHaveLength(1);
    const [url, init] = submitCalls()[0];
    expect(String(url)).toBe(
      'https://proj.supabase.co/functions/v1/make-server-91ed8379/contact-form/submit',
    );
    expect(init!.method).toBe('POST');
    const payload = JSON.parse(String(init!.body));
    expect(payload).toEqual({
      firstName: 'Thandi',
      lastName: 'van der Merwe',
      email: 'thandi@example.com',
      phone: '082 000 0000',
      service: '',
      message: 'I would like to review my retirement savings.',
      clientType: 'business',
      website: '',
    });
    // The same fields, in the same order, as the live page's call.
    const liveCall = liveSource.match(/submitContactEnquiry\(\{(.*?)\}\);/)![1];
    const liveKeys = [...liveCall.matchAll(/(\w+):/g)].map((m) => m[1]);
    expect(Object.keys(payload)).toEqual(liveKeys);

    fireEvent.click(within(done).getByRole('button', { name: 'Send another message' }));
    const firstName = within(form()).getByLabelText('First Name *') as HTMLInputElement;
    expect(firstName.value).toBe('');
    await waitFor(() => expect(document.activeElement).toBe(firstName));
  });

  it("passes on the honeypot's value, as the live page does", async () => {
    await renderPage();
    fill(VALID);
    fireEvent.change(within(form()).getByLabelText('Website'), {
      target: { value: 'https://spam.example' },
    });
    await act(async () => {
      fireEvent.click(within(form()).getByRole('button', { name: /Send Enquiry/ }));
    });
    expect(JSON.parse(String(submitCalls()[0][1]!.body)).website).toBe('https://spam.example');
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
    fill(VALID);
    fireEvent.click(within(form()).getByRole('button', { name: /Send Enquiry/ }));
    const button = within(form()).getByRole('button', { name: /Sending…/ }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    await act(async () => {
      finish({ ok: true, json: async () => ({ success: true }) });
    });
    expect(await screen.findByRole('status')).toBeDefined();
  });

  it('shows a failed send in the form, keeping what was typed', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    stubFetch({ ok: false, body: { error: 'Validation failed' } });
    await renderPage();
    fill(VALID);
    await act(async () => {
      fireEvent.click(within(form()).getByRole('button', { name: /Send Enquiry/ }));
    });
    const alert = await within(form()).findByRole('alert');
    expect(alert.textContent).toBe('Validation failed');
    expect(screen.queryByRole('status')).toBeNull();
    expect((within(form()).getByLabelText('Last Name *') as HTMLInputElement).value).toBe(
      'van der Merwe',
    );
  });
});
