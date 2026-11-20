/**
 * The redesigned service page, reached the way production reaches it: a real
 * service page renders ServicePageTemplate, and the design switch hands it to
 * NavigatorServicePage. Covers what the redesign must not lose (every product's
 * copy, the FAQ answers, the JSON-LD, the lead form reaching the endpoint) and
 * what it adds (field validation, honeypot, focus handling).
 */
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

const { MedicalAidPage } = await import('../../components/pages/MedicalAidPage');
const { TaxPlanningPage } = await import('../../components/pages/TaxPlanningPage');
const { RiskManagementPage } = await import('../../components/pages/RiskManagementPage');

async function renderPage() {
  render(
    <MemoryRouter initialEntries={['/medical-aid']}>
      <MedicalAidPage />
    </MemoryRouter>,
  );
  return screen.findByRole('heading', { level: 1 });
}

function hrefs(): string[] {
  return screen.getAllByRole('link').map((a) => a.getAttribute('href') ?? '');
}

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }));
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  document.getElementById('seo-structured-data')?.remove();
});

describe('Navigator service page', () => {
  it("leads with the board's two-line headline as the only H1", async () => {
    const h1 = await renderPage();
    expect(h1.textContent).toBe('Your Health,Our Priority');
    expect(h1.querySelector('br')).not.toBeNull();
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getByText('Medical Aid Solutions')).toBeDefined();
    const crumbs = screen.getByRole('navigation', { name: 'Breadcrumb' });
    expect(within(crumbs).getByRole('link', { name: 'Home' }).getAttribute('href')).toBe('/');
    expect(within(crumbs).getByRole('link', { name: 'Services' }).getAttribute('href')).toBe(
      '/services',
    );
    expect(within(crumbs).getByText('Medical Aid').getAttribute('aria-current')).toBe('page');
  });

  it('links only to routes the site already serves', async () => {
    await renderPage();
    const targets = new Set(hrefs());
    expect(targets).toEqual(
      new Set([
        '/',
        '/services',
        '/schedule-consultation',
        '/get-quote/medical-aid/contact',
        '#individuals',
        '#businesses',
        '#approach',
        '#partners',
        '#faq',
        'tel:+27126672505',
        'mailto:info@navigatewealth.co',
        '/ask-vasco',
      ]),
    );
  });

  it('keeps every product in the document and shows one panel at a time', async () => {
    await renderPage();
    const tablist = screen.getByRole('tablist', { name: 'Medical aid for individuals' });
    const tabs = within(tablist).getAllByRole('tab');
    expect(tabs.map((t) => t.textContent)).toEqual([
      'Comprehensive',
      'Hospital Plans',
      'Medical Savings',
    ]);
    const panels = tabs.map((t) => document.getElementById(t.getAttribute('aria-controls')!)!);
    expect(panels.map((p) => p.hidden)).toEqual([false, true, true]);
    // The hidden panels' copy is still in the page for search engines.
    expect(panels[2].textContent).toContain('Medical Savings Plans');

    fireEvent.click(tabs[1]);
    expect(panels.map((p) => p.hidden)).toEqual([true, false, true]);
    expect(tabs[1].getAttribute('aria-selected')).toBe('true');

    fireEvent.keyDown(tabs[1], { key: 'ArrowRight' });
    expect(panels.map((p) => p.hidden)).toEqual([true, true, false]);
    expect(document.activeElement).toBe(tabs[2]);

    fireEvent.keyDown(tabs[2], { key: 'Home' });
    expect(panels[0].hidden).toBe(false);

    fireEvent.click(within(panels[0]).getByRole('button', { name: /Next: Hospital Plans/ }));
    expect(panels[1].hidden).toBe(false);
    expect(document.activeElement).toBe(tabs[1]);
  });

  it('keeps collapsed FAQ answers in the document, one open at a time', async () => {
    await renderPage();
    const faq = screen.getByRole('region', { name: 'Frequently asked questions' });
    const questions = within(faq)
      .getAllByRole('button')
      .filter((b) => b.hasAttribute('aria-expanded'));
    expect(questions.length).toBeGreaterThan(1);
    const answer = (b: HTMLElement) => document.getElementById(b.getAttribute('aria-controls')!)!;
    expect(answer(questions[0]).hidden).toBe(false);
    expect(answer(questions[1]).hidden).toBe(true);
    expect(answer(questions[1]).textContent!.length).toBeGreaterThan(20);

    fireEvent.click(questions[1]);
    expect(questions[1].getAttribute('aria-expanded')).toBe('true');
    expect(answer(questions[0]).hidden).toBe(true);
    expect(answer(questions[1]).hidden).toBe(false);
  });

  it('emits the same structured data as the live design, FAQPage included', async () => {
    await renderPage();
    await waitFor(() => expect(document.getElementById('seo-structured-data')).not.toBeNull());
    const data = JSON.parse(document.getElementById('seo-structured-data')!.textContent!);
    const types = data['@graph'].map((n: { '@type': unknown }) => n['@type']);
    // Organisation, the service itself, the breadcrumb trail, the FAQs.
    expect(types).toEqual([
      ['Organization', 'FinancialService'],
      'FinancialService',
      'BreadcrumbList',
      'FAQPage',
    ]);
    const faqPage = data['@graph'][3];
    const firstQuestion = faqPage.mainEntity[0].name;
    expect(screen.getByRole('button', { name: firstQuestion })).toBeDefined();
  });

  it('opens a product in the phone sheet and returns focus to its row', async () => {
    await renderPage();
    const section = document.getElementById('individuals')!;
    const row = within(section)
      .getAllByRole('button')
      .find(
        (b) =>
          b.getAttribute('aria-haspopup') === 'dialog' && /Hospital Plans/.test(b.textContent!),
      )!;
    fireEvent.click(row);
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByRole('heading', { name: 'Hospital Plans' })).toBeDefined();
    fireEvent.click(within(dialog).getByRole('button', { name: /Next/ }));
    expect(within(dialog).getByRole('heading', { name: 'Medical Savings Plans' })).toBeDefined();
    fireEvent.keyDown(dialog, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    const savingsRow = within(section)
      .getAllByRole('button')
      .find(
        (b) =>
          b.getAttribute('aria-haspopup') === 'dialog' && /Medical Savings/.test(b.textContent!),
      );
    await waitFor(() => expect(document.activeElement).toBe(savingsRow));
  });
});

describe('Navigator service page layouts', () => {
  it('draws the jump layout on Tax Planning', async () => {
    render(
      <MemoryRouter initialEntries={['/tax-planning']}>
        <TaxPlanningPage />
      </MemoryRouter>,
    );
    const h1 = await screen.findByRole('heading', { level: 1 });
    expect(h1.textContent).toBe('Maximize YourTax Efficiency');
    const jump = screen.getByRole('navigation', { name: 'On this page' });
    expect(within(jump).getByRole('link', { name: 'Individuals' }).getAttribute('href')).toBe(
      '#individuals',
    );
    expect(
      screen.getAllByRole('link', { name: 'Call Me Back' }).map((a) => a.getAttribute('href')),
    ).toEqual(['#callback', '#callback']);
    expect(screen.getByText('STEP 01')).toBeDefined();
    expect(screen.getByText(/in line with POPIA and our Privacy Notice/)).toBeDefined();
  });

  it('draws the risk layout: no breadcrumb or approach, a logo strip', async () => {
    render(
      <MemoryRouter initialEntries={['/risk-management']}>
        <RiskManagementPage />
      </MemoryRouter>,
    );
    const h1 = await screen.findByRole('heading', { level: 1 });
    expect(h1.textContent).toBe('Protecting WhatMatters Most');
    expect(screen.queryByRole('navigation', { name: 'Breadcrumb' })).toBeNull();
    expect(screen.queryByRole('navigation', { name: 'On this page' })).toBeNull();
    expect(document.getElementById('approach')).toBeNull();
    expect(screen.getByRole('heading', { name: '7 Insurers Compared' })).toBeDefined();
  });
});

describe('Navigator call-back form', () => {
  function form() {
    return screen.getByRole('form', { name: 'Request a call back' });
  }

  it('says which fields need fixing and sends nothing', async () => {
    await renderPage();
    fireEvent.change(within(form()).getByLabelText('Email address'), {
      target: { value: 'not-an-email' },
    });
    fireEvent.click(within(form()).getByRole('button', { name: /Call Me Back/ }));
    expect(await screen.findByText('Enter your full name')).toBeDefined();
    expect(screen.getByText('Enter a valid email address')).toBeDefined();
    expect(screen.getByText('Enter your phone number')).toBeDefined();
    expect(within(form()).getByLabelText('Full name').getAttribute('aria-invalid')).toBe('true');
    expect(document.activeElement).toBe(within(form()).getByLabelText('Full name'));
    expect(fetch).not.toHaveBeenCalled();
  });

  it('sends the enquiry, honeypot included, and confirms in place', async () => {
    await renderPage();
    const f = form();
    fireEvent.change(within(f).getByLabelText('Full name'), {
      target: { value: 'Thandi van der Merwe' },
    });
    fireEvent.change(within(f).getByLabelText('Email address'), {
      target: { value: 'thandi@example.com' },
    });
    fireEvent.change(within(f).getByLabelText('Phone number'), {
      target: { value: '082 000 0000' },
    });
    fireEvent.change(within(f).getByLabelText('Medical Aid Need'), {
      target: { value: 'hospital-plan' },
    });
    fireEvent.click(within(f).getByRole('button', { name: /Call Me Back/ }));

    expect(await screen.findByText('Request Submitted Successfully')).toBeDefined();
    const call = vi
      .mocked(fetch)
      .mock.calls.find(([url]) => String(url).includes('/contact-form/submit'));
    expect(call).toBeDefined();
    expect(JSON.parse(String(call![1]!.body))).toEqual({
      firstName: 'Thandi',
      lastName: 'van der Merwe',
      email: 'thandi@example.com',
      phone: '082 000 0000',
      service: 'Medical Aid & Health Insurance — Hospital Plan',
      message: '',
      clientType: 'call-back request',
      website: '',
    });
  });

  it('shows a failed send in the form instead of a confirmation', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, json: async () => ({ error: 'Validation failed' }) }),
    );
    await renderPage();
    const f = form();
    fireEvent.change(within(f).getByLabelText('Full name'), { target: { value: 'Sipho' } });
    fireEvent.change(within(f).getByLabelText('Email address'), {
      target: { value: 'sipho@example.com' },
    });
    fireEvent.change(within(f).getByLabelText('Phone number'), {
      target: { value: '0821234567' },
    });
    fireEvent.click(within(f).getByRole('button', { name: /Call Me Back/ }));
    expect((await screen.findByRole('alert')).textContent).toContain('Validation failed');
    expect(screen.queryByText('Request Submitted Successfully')).toBeNull();
  });
});
