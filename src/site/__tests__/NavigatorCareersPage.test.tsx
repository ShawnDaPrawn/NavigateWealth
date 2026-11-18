/**
 * The redesigned Careers page through the design switch, checked against the
 * live page: the same listings feed, the same link targets, and — because the
 * server emails the firm and the applicant from it — an application request
 * body byte-identical to the live CV form's for the same input.
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

const { CareersPage } = await import('../../app/publicPages');
const { CareersPage: LiveCareersPage } = await import('../../components/pages/CareersPage');

const LISTINGS = [
  {
    id: 'adviser-2026',
    title: 'Financial Adviser',
    category: 'advisory',
    location: 'Pretoria',
    type: 'Full-time',
    description: 'Advise clients directly.',
    requirements: ['RE5 (or working towards it)'],
    benefits: ['Mentorship'],
    closingDate: '2026-12-15',
  },
  {
    id: 'admin-2026',
    title: 'Practice Administrator',
    category: 'administration',
    location: 'Pretoria',
    type: 'Part-time',
    description: 'Keep the practice running.',
    requirements: [],
    benefits: [],
  },
];

const CAREERS_URL =
  'https://proj.supabase.co/functions/v1/make-server-91ed8379/publications/careers';
const SUBMIT_URL = 'https://proj.supabase.co/functions/v1/make-server-91ed8379/contact-form/submit';

function mockFetch({ listings = LISTINGS, submitOk = true } = {}) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      if (url === SUBMIT_URL) {
        return submitOk
          ? { ok: true, json: async () => ({ success: true }) }
          : { ok: false, json: async () => ({ error: 'Validation failed' }) };
      }
      return { ok: true, json: async () => ({ success: true, data: listings }) };
    }),
  );
}

function submitBodies(): string[] {
  return vi
    .mocked(fetch)
    .mock.calls.filter(([url]) => url === SUBMIT_URL)
    .map(([, init]) => String((init as RequestInit).body));
}

async function renderNavigator(path = '/careers') {
  render(
    <MemoryRouter initialEntries={[path]}>
      <Suspense fallback={null}>
        <CareersPage />
      </Suspense>
    </MemoryRouter>,
  );
  const h1 = await screen.findByRole('heading', { level: 1 });
  await waitFor(() => expect(screen.queryByText(/Loading positions/)).toBeNull());
  return h1;
}

function hrefs(root: ParentNode = document): Set<string> {
  return new Set([...root.querySelectorAll('a[href]')].map((a) => a.getAttribute('href') ?? ''));
}

function fill(dialog: HTMLElement, values: Record<string, string>) {
  for (const [label, value] of Object.entries(values)) {
    fireEvent.change(within(dialog).getByLabelText(new RegExp(label, 'i')), {
      target: { value },
    });
  }
}

const APPLICANT = {
  'full name': '  Thandi van der Merwe ',
  'email address': 'thandi@example.com ',
  'phone number': '082 000 0000',
  'tell us about yourself': 'I would like to join as a paraplanner.',
};

beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn();
  mockFetch();
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  document.getElementById('seo-structured-data')?.remove();
});

describe('Navigator Careers page', () => {
  it('has one descriptive H1 with the live headline beneath it', async () => {
    const h1 = await renderNavigator();
    expect(h1.textContent).toBe('Careers at Navigate Wealth');
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getByText('Build Your Career in Financial Advisory')).toBeDefined();
    expect(screen.getByText('2 Open Positions')).toBeDefined();
    expect(vi.mocked(fetch).mock.calls[0][0]).toBe(CAREERS_URL);
  });

  it('keeps every live link target and adds none', async () => {
    const { container } = render(
      <MemoryRouter>
        <LiveCareersPage />
      </MemoryRouter>,
    );
    await waitFor(() => expect(fetch).toHaveBeenCalled());
    const live = hrefs(container);
    cleanup();
    await renderNavigator();
    expect(hrefs()).toEqual(live);
    expect(live).toEqual(new Set(['/contact']));
  });

  it('keeps every department and role in the document, one department shown', async () => {
    await renderNavigator();
    const tabs = within(screen.getByRole('tablist', { name: 'Departments' })).getAllByRole('tab');
    const panels = tabs.map((t) => document.getElementById(t.getAttribute('aria-controls')!)!);
    expect(panels.map((p) => p.hidden)).toEqual([false, true, true, true]);
    expect(panels[1].textContent).toContain('Practice Administrator');
    expect(panels[2].textContent).toContain('No Current Compliance Openings');

    const role = within(panels[0]).getByRole('button', { name: /Financial Adviser/ });
    const details = document.getElementById(role.getAttribute('aria-controls')!)!;
    expect(details.hidden).toBe(true);
    expect(details.textContent).toContain('Advise clients directly.');
    fireEvent.click(role);
    expect(role.getAttribute('aria-expanded')).toBe('true');
    expect(details.hidden).toBe(false);

    fireEvent.keyDown(tabs[0], { key: 'ArrowRight' });
    expect(panels.map((p) => p.hidden)).toEqual([true, false, true, true]);
    expect(document.activeElement).toBe(tabs[1]);
  });

  it('copies a link to a role, and that link opens the role', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    await renderNavigator();
    fireEvent.click(screen.getByRole('button', { name: /Financial Adviser/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Share Position' }));
    expect(await screen.findByRole('button', { name: 'Link copied' })).toBeDefined();
    expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/careers#adviser-2026`);

    cleanup();
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
      cb(0);
      return 0;
    });
    await renderNavigator('/careers#admin-2026');
    const role = await screen.findByRole('button', { name: /Practice Administrator/ });
    await waitFor(() => expect(role.getAttribute('aria-expanded')).toBe('true'));
    expect(screen.getByRole('tab', { name: /Administration/ }).getAttribute('aria-selected')).toBe(
      'true',
    );
  });

  it('sends an application byte-identical to the live CV form', async () => {
    render(
      <MemoryRouter>
        <LiveCareersPage />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByRole('button', { name: /Send Your CV/ }));
    const liveDialog = await screen.findByRole('dialog');
    fill(liveDialog, APPLICANT);
    fireEvent.click(within(liveDialog).getByRole('button', { name: 'Send My Details' }));
    await waitFor(() => expect(submitBodies()).toHaveLength(1));
    const [liveBody] = submitBodies();
    cleanup();

    mockFetch();
    await renderNavigator();
    fireEvent.click(screen.getByRole('button', { name: /Send Your CV/ }));
    const dialog = await screen.findByRole('dialog');
    fill(dialog, APPLICANT);
    fireEvent.click(within(dialog).getByRole('button', { name: 'Send My Details' }));
    expect(await screen.findByText('Thank you — we have your details.')).toBeDefined();
    const [body] = submitBodies();
    expect(body).toBe(liveBody);
    expect(JSON.parse(body)).toEqual({
      firstName: 'Thandi',
      lastName: 'van der Merwe',
      email: 'thandi@example.com',
      phone: '082 000 0000',
      service: 'Careers',
      message: 'I would like to join as a paraplanner.',
      clientType: 'job application',
    });
    expect(screen.getByRole('link', { name: /Email your CV/ }).getAttribute('href')).toBe(
      `mailto:info@navigatewealth.co?subject=${encodeURIComponent('CV – Thandi van der Merwe')}`,
    );
  });

  it('says which fields need fixing, focuses the first, and sends nothing', async () => {
    await renderNavigator();
    fireEvent.click(screen.getByRole('button', { name: /Start Your Journey/ }));
    const dialog = await screen.findByRole('dialog');
    fill(dialog, { 'email address': 'not-an-email' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Send My Details' }));
    expect(within(dialog).getByText('Enter your full name')).toBeDefined();
    expect(within(dialog).getByText('Enter a valid email address')).toBeDefined();
    expect(within(dialog).getByText('Enter your phone number')).toBeDefined();
    const name = within(dialog).getByLabelText(/full name/i);
    expect(name.getAttribute('aria-invalid')).toBe('true');
    expect(document.activeElement).toBe(name);
    expect(submitBodies()).toHaveLength(0);
    expect(within(dialog).getByRole('link', { name: 'Privacy Notice' }).getAttribute('href')).toBe(
      '/legal/privacy-notice',
    );
  });

  it('shows a failed send inside the form', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    mockFetch({ submitOk: false });
    await renderNavigator();
    fireEvent.click(screen.getByRole('button', { name: /Send Your CV/ }));
    const dialog = await screen.findByRole('dialog');
    fill(dialog, APPLICANT);
    fireEvent.click(within(dialog).getByRole('button', { name: 'Send My Details' }));
    expect((await within(dialog).findByRole('alert')).textContent).toContain('Validation failed');
    expect(screen.queryByText(/we have your details/)).toBeNull();
  });

  it('sends the honeypot only when a bot fills it in', async () => {
    await renderNavigator();
    fireEvent.click(screen.getByRole('button', { name: /Send Your CV/ }));
    const dialog = await screen.findByRole('dialog');
    fill(dialog, APPLICANT);
    fireEvent.change(dialog.querySelector('input[name="website"]')!, {
      target: { value: 'spam.example' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Send My Details' }));
    await waitFor(() => expect(submitBodies()).toHaveLength(1));
    expect(JSON.parse(submitBodies()[0]).website).toBe('spam.example');
  });
});
