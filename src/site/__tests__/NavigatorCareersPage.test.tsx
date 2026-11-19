/**
 * The redesigned Careers page, reached the way production reaches it:
 * CareersPage with the design switch on lazy-loads NavigatorCareersPage.
 * Covers what the redesign must not lose (the SEO data, the links, the roles
 * from the same endpoint, applications reaching the same endpoint with the
 * same payload) and what it adds (tabs and accordions with their ARIA, field
 * validation, the confirmation in place, focus returned on close).
 */
import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';

vi.mock('../design', () => ({ SITE_DESIGN: 'navigator', resolveSiteDesign: () => 'navigator' }));
vi.mock('../../utils/supabase/info', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../utils/supabase/info')>()),
  projectId: 'proj',
  publicAnonKey: 'anon',
}));

const { CareersPage } = await import('../../components/pages/CareersPage');
const { getSEOData } = await import('../../components/seo/seo-config');
const { createWebPageSchema } = await import('../../components/seo/SEO');

const CAREERS_URL =
  'https://proj.supabase.co/functions/v1/make-server-91ed8379/publications/careers';

const LISTINGS = [
  {
    id: 'adviser-1',
    title: 'Financial Adviser',
    category: 'advisory',
    location: 'Pretoria',
    type: 'Full-time',
    description: 'Advise clients across the full financial plan.',
    requirements: ['RE5 qualification', 'Two years in advice'],
    benefits: ['Structured mentorship'],
    closingDate: '2026-12-15T08:00:00Z',
  },
  {
    id: 'compliance-1',
    title: 'Compliance Officer',
    category: 'compliance',
    location: 'Pretoria',
    type: 'Contract',
    description: '',
    requirements: [],
    benefits: [],
  },
];

function stubFetch(listings: unknown[] = [], submit = { ok: true, body: {} }) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      if (String(url).includes('/publications/careers')) {
        return { ok: true, json: async () => ({ success: true, data: listings }) };
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

async function renderPage() {
  render(
    <MemoryRouter initialEntries={['/careers']}>
      <CareersPage />
    </MemoryRouter>,
  );
  const h1 = await screen.findByRole('heading', { level: 1 });
  // Let the listings request settle, as every visitor's page does.
  await waitFor(() => expect(screen.queryByText('Loading positions…')).toBeNull());
  return h1;
}

function tab(name: string) {
  return within(screen.getByRole('tablist', { name: 'Departments' })).getByRole('tab', { name });
}

beforeEach(() => stubFetch());
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  document.getElementById('seo-structured-data')?.remove();
});

describe('Navigator careers page', () => {
  it("has one H1, the board's headline, and headings in order", async () => {
    const h1 = await renderPage();
    expect(h1.textContent).toBe('Build Your Career in Financial Advisory');
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)).toEqual([
      'Explore Career Opportunities',
      'Why Navigate Wealth?',
      'Everything You Need to Thrive',
      'Ready to Shape the Future of Financial Advisory?',
    ]);
    const levels = [...document.querySelectorAll('h1, h2, h3, h4, h5, h6')].map((h) =>
      Number(h.tagName[1]),
    );
    levels.forEach((level, i) => {
      if (i > 0) expect(level - levels[i - 1]).toBeLessThanOrEqual(1);
    });
  });

  it('links only to the openings below and to routes the site already serves', async () => {
    await renderPage();
    const targets = new Set(screen.getAllByRole('link').map((a) => a.getAttribute('href')));
    expect(targets).toEqual(new Set(['#opportunities', '/contact']));
    expect(document.getElementById('opportunities')).not.toBeNull();
    const routes = readFileSync('src/app/AppRoutes.tsx', 'utf8');
    expect(routes).toContain('path="/contact"');
  });

  it("emits the live page's SEO tags and WebPage data", async () => {
    await renderPage();
    const seo = getSEOData('careers');
    await waitFor(() => expect(document.getElementById('seo-structured-data')).not.toBeNull());
    expect(document.title).toBe(seo.title);
    expect(document.querySelector('link[rel="canonical"]')?.getAttribute('href')).toBe(
      seo.canonicalUrl,
    );
    expect(JSON.parse(document.getElementById('seo-structured-data')!.textContent!)).toEqual(
      createWebPageSchema(seo.title, seo.description, seo.canonicalUrl),
    );
  });

  it('asks for roles where the live page does', async () => {
    await renderPage();
    const calls = vi.mocked(fetch).mock.calls.filter(([url]) => url === CAREERS_URL);
    expect(calls).toHaveLength(1);
    expect(calls[0][1]).toEqual({ headers: { Authorization: 'Bearer anon' } });
  });

  it('shows the copy the live page shows', async () => {
    await renderPage();
    for (const t of ['Founder-Led', 'Client Excellence', 'Professional Growth', 'Independence']) {
      expect(screen.getByRole('heading', { level: 3, name: t })).toBeDefined();
    }
    for (const t of [
      'Competitive Remuneration',
      'Continuous Learning',
      'Flexible Working',
      'Meaningful Work',
      'Innovation Culture',
      'Mentorship',
    ]) {
      expect(screen.getByRole('heading', { level: 3, name: t })).toBeDefined();
    }
    expect(screen.getByText('Hybrid working from our Pretoria office')).toBeDefined();
    expect(screen.getByText('Close-knit, founder-led culture')).toBeDefined();
    expect(screen.getByText('Email your CV to info@navigatewealth.co')).toBeDefined();
    expect(screen.getByText(/Equal opportunity employer • Professional development/)).toBeDefined();
    for (const t of ['FSCA Regulated', 'Independent', 'Equal Opportunity Employer']) {
      expect(screen.getByText(t)).toBeDefined();
    }
  });

  it('with no openings, shows each department in turn, by click or by arrow key', async () => {
    await renderPage();
    expect(tab('Advisory').getAttribute('aria-selected')).toBe('true');
    const panel = screen.getByRole('tabpanel');
    expect(panel.getAttribute('aria-labelledby')).toBe(tab('Advisory').id);
    expect(
      within(panel).getByRole('heading', { name: 'No Current Advisory Openings' }),
    ).toBeDefined();
    expect(panel.textContent).toContain(
      "Client-facing roles providing financial advice and building lasting relationships. We don't have open positions here right now",
    );

    fireEvent.click(tab('Compliance'));
    expect(tab('Compliance').getAttribute('aria-selected')).toBe('true');
    expect(tab('Advisory').getAttribute('tabindex')).toBe('-1');
    expect(screen.getByRole('heading', { name: 'No Current Compliance Openings' })).toBeDefined();

    fireEvent.keyDown(tab('Compliance'), { key: 'ArrowRight' });
    expect(tab('Marketing').getAttribute('aria-selected')).toBe('true');
    expect(document.activeElement).toBe(tab('Marketing'));
    fireEvent.keyDown(tab('Marketing'), { key: 'ArrowRight' });
    expect(document.activeElement).toBe(tab('Advisory'));
    fireEvent.keyDown(tab('Advisory'), { key: 'End' });
    expect(tab('Marketing').getAttribute('aria-selected')).toBe('true');
    fireEvent.keyDown(tab('Marketing'), { key: 'Home' });
    expect(tab('Advisory').getAttribute('aria-selected')).toBe('true');
  });

  it('picks a department from the crew manifest and brings the openings into view', async () => {
    const scroll = vi.fn();
    Element.prototype.scrollIntoView = scroll;
    await renderPage();
    const manifest = screen.getByRole('complementary', { name: 'Departments' });
    expect(within(manifest).getByText('4 departments')).toBeDefined();
    fireEvent.click(within(manifest).getByRole('button', { name: /Administration/ }));
    expect(tab('Administration').getAttribute('aria-selected')).toBe('true');
    expect(scroll).toHaveBeenCalledTimes(1);
    expect(scroll.mock.contexts[0]).toBe(document.getElementById('opportunities'));
  });

  it('lists published roles under their department, each opening like an accordion', async () => {
    stubFetch(LISTINGS);
    await renderPage();
    const role = screen.getByRole('button', { name: /Financial Adviser/ });
    expect(role.closest('h3')).not.toBeNull();
    expect(role.textContent).toContain('Closes 15 Dec 2026');
    expect(role.getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByText('No Current Advisory Openings')).toBeNull();
    expect(screen.queryByText('RE5 qualification')).toBeNull();

    fireEvent.click(role);
    expect(role.getAttribute('aria-expanded')).toBe('true');
    const body = document.getElementById(role.getAttribute('aria-controls')!)!;
    expect(body.textContent).toContain('Advise clients across the full financial plan.');
    expect(within(body).getByRole('heading', { level: 4, name: 'Requirements' })).toBeDefined();
    expect(within(body).getByText('RE5 qualification')).toBeDefined();
    expect(within(body).getByRole('heading', { level: 4, name: 'What We Offer' })).toBeDefined();
    expect(within(body).getByText('Structured mentorship')).toBeDefined();

    fireEvent.click(within(body).getByRole('button', { name: /Apply Now/ }));
    expect(await screen.findByRole('dialog', { name: 'Submit Your CV' })).toBeDefined();
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());

    fireEvent.click(tab('Compliance'));
    const other = screen.getByRole('button', { name: /Compliance Officer/ });
    expect(other.textContent).not.toContain('Closes');
    fireEvent.click(other);
    expect(screen.queryByRole('heading', { name: 'Requirements' })).toBeNull();
    expect(screen.getByRole('button', { name: /Share Position/ })).toBeDefined();

    fireEvent.click(tab('Marketing'));
    expect(screen.getByRole('heading', { name: 'No Current Marketing Openings' })).toBeDefined();
  });
});

describe('Navigator careers CV form', () => {
  async function openForm(trigger = /Send Your CV/) {
    await renderPage();
    const button = screen.getByRole('button', { name: trigger });
    fireEvent.click(button);
    const dialog = await screen.findByRole('dialog', { name: 'Submit Your CV' });
    return { button, dialog };
  }

  it('opens from every action, starts at the first field and returns focus on close', async () => {
    for (const trigger of [/Send Your CV/, /Send Us Your CV/, /Start Your Journey With Us/]) {
      const { button, dialog } = await openForm(trigger);
      await waitFor(() =>
        expect(document.activeElement).toBe(within(dialog).getByLabelText('Full Name *')),
      );
      fireEvent.keyDown(dialog, { key: 'Escape' });
      await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
      await waitFor(() => expect(document.activeElement).toBe(button));
      cleanup();
    }
  });

  it('says which fields need fixing and sends nothing', async () => {
    const { dialog } = await openForm();
    fireEvent.change(within(dialog).getByLabelText('Email Address *'), {
      target: { value: 'not-an-email' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Send My Details' }));
    expect(await within(dialog).findByText('Enter your full name')).toBeDefined();
    expect(within(dialog).getByText('Enter a valid email address')).toBeDefined();
    expect(within(dialog).getByText('Enter your phone number')).toBeDefined();
    const name = within(dialog).getByLabelText('Full Name *');
    expect(name.getAttribute('aria-invalid')).toBe('true');
    expect(document.activeElement).toBe(name);
    expect(submitCalls()).toHaveLength(0);
  });

  it('sends what the live form sends, honeypot included, and confirms in place', async () => {
    const { dialog } = await openForm();
    fireEvent.change(within(dialog).getByLabelText('Full Name *'), {
      target: { value: ' Thandi van der Merwe ' },
    });
    fireEvent.change(within(dialog).getByLabelText('Email Address *'), {
      target: { value: 'thandi@example.com' },
    });
    fireEvent.change(within(dialog).getByLabelText('Phone Number *'), {
      target: { value: '082 000 0000' },
    });
    fireEvent.change(within(dialog).getByLabelText('Tell us about yourself'), {
      target: { value: ' I would like to join the advisory team. ' },
    });
    await act(async () => {
      fireEvent.click(within(dialog).getByRole('button', { name: 'Send My Details' }));
    });

    expect(submitCalls()).toHaveLength(1);
    const [url, init] = submitCalls()[0];
    expect(url).toBe(
      'https://proj.supabase.co/functions/v1/make-server-91ed8379/contact-form/submit',
    );
    expect(init!.method).toBe('POST');
    expect(JSON.parse(String(init!.body))).toEqual({
      firstName: 'Thandi',
      lastName: 'van der Merwe',
      email: 'thandi@example.com',
      phone: '082 000 0000',
      service: 'Careers',
      message: 'I would like to join the advisory team.',
      clientType: 'job application',
      website: '',
    });

    const done = await screen.findByRole('dialog', { name: 'Thank you — we have your details.' });
    expect(done.textContent).toContain('Please email your CV to info@navigatewealth.co.');
    expect(
      within(done)
        .getByRole('link', { name: /Email your CV/ })
        .getAttribute('href'),
    ).toBe(
      `mailto:info@navigatewealth.co?subject=${encodeURIComponent('CV – Thandi van der Merwe')}`,
    );
  });

  it('shows a failed send in the form instead of a confirmation', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    stubFetch([], { ok: false, body: { error: 'Validation failed' } });
    const { dialog } = await openForm();
    fireEvent.change(within(dialog).getByLabelText('Full Name *'), { target: { value: 'Sipho' } });
    fireEvent.change(within(dialog).getByLabelText('Email Address *'), {
      target: { value: 'sipho@example.com' },
    });
    fireEvent.change(within(dialog).getByLabelText('Phone Number *'), {
      target: { value: '0821234567' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Send My Details' }));
    expect((await within(dialog).findByRole('alert')).textContent).toContain('Validation failed');
    expect(screen.queryByText(/Thank you/)).toBeNull();
    // A one-word name keeps the endpoint's placeholder surname, as on the live page.
    expect(JSON.parse(String(submitCalls()[0][1]!.body)).lastName).toBe('-');
  });
});
