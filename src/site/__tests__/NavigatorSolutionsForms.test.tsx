/**
 * Every submission from the Solutions and Why Us pages sends a transactional
 * email server-side, so the Navigator pages must post exactly what the live
 * pages post. Each test drives the live page and its Navigator page through
 * the same form with the same values and compares the requests the API client
 * was asked to send (endpoint, JSON body as serialised, options).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ComponentType } from 'react';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';

vi.mock('../design', () => ({ SITE_DESIGN: 'navigator', resolveSiteDesign: () => 'navigator' }));

// jsdom has no element scrolling.
Element.prototype.scrollTo = () => {};

const { api } = await import('../../utils/api/client');
const { ForIndividualsPage } = await import('../../components/pages/ForIndividualsPage');
const { ForBusinessesPage } = await import('../../components/pages/ForBusinessesPage');
const { ForAdvisersPage } = await import('../../components/pages/ForAdvisersPage');
const { WhyUsPage } = await import('../../components/pages/WhyUsPage');
const { NavigatorForIndividualsPage } = await import('../pages/NavigatorForIndividualsPage');
const { NavigatorForBusinessesPage } = await import('../pages/NavigatorForBusinessesPage');
const { NavigatorForAdvisersPage } = await import('../pages/NavigatorForAdvisersPage');
const { NavigatorWhyUsPage } = await import('../pages/NavigatorWhyUsPage');

type Sent = [string, string, unknown];

let post: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  post = vi.spyOn(api, 'post').mockResolvedValue({});
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  document.getElementById('seo-structured-data')?.remove();
});

function sent(): Sent[] {
  return post.mock.calls.map((call: unknown[]) => {
    const [endpoint, body, options] = call as [string, unknown, unknown];
    return [endpoint, JSON.stringify(body), options] as Sent;
  });
}

function renderPage(Page: ComponentType) {
  render(
    <MemoryRouter>
      <Page />
    </MemoryRouter>,
  );
}

function type(dialog: HTMLElement, selector: string, value: string) {
  const field = dialog.querySelector(selector);
  if (!field) throw new Error(`No field ${selector}`);
  fireEvent.change(field, { target: { value } });
}

/** GetQuoteModal: details, coverage, provider, submit. */
async function submitQuote(open: HTMLElement): Promise<Sent[]> {
  fireEvent.click(open);
  const dialog = await screen.findByRole('dialog');
  type(dialog, '#firstName', 'Thandi');
  type(dialog, '#lastName', 'Mokoena');
  type(dialog, '#email', 'thandi.mokoena@gmail.com');
  type(dialog, '#phone', '+27 82 555 0101');
  fireEvent.click(within(dialog).getByRole('button', { name: /Next/ }));
  fireEvent.click(await within(dialog).findByRole('button', { name: /Next/ }));
  fireEvent.click(await within(dialog).findByRole('button', { name: /Submit Request/ }));
  await waitFor(() => expect(post).toHaveBeenCalledTimes(1));
  return sent();
}

/** ConsultationModal: type, first open date, first slot, details, confirm. */
async function submitConsultation(open: HTMLElement): Promise<Sent[]> {
  fireEvent.click(open);
  const dialog = await screen.findByRole('dialog');
  const next = () => within(dialog).getByRole('button', { name: /Continue/ });

  fireEvent.click(next());
  await within(dialog).findByText('Select a date');
  let day = dialog.querySelector<HTMLButtonElement>('td button:not([disabled])');
  for (let i = 0; !day && i < 2; i++) {
    fireEvent.click(within(dialog).getByRole('button', { name: /Next Month/ }));
    day = dialog.querySelector<HTMLButtonElement>('td button:not([disabled])');
  }
  if (!day) throw new Error('No bookable day');
  fireEvent.click(day);
  fireEvent.click(next());

  await within(dialog).findByText('Select a time');
  const slot = within(dialog)
    .getAllByRole('button')
    .find((b) => /\d{1,2}:\d{2}/.test(b.textContent ?? ''));
  if (!slot) throw new Error('No time slot');
  fireEvent.click(slot);
  fireEvent.click(next());

  await within(dialog).findByText('Your details');
  type(dialog, '#consultation-name', 'Thandi Mokoena');
  type(dialog, '#consultation-email', 'thandi.mokoena@gmail.com');
  type(dialog, '#consultation-phone', '+27 82 555 0101');
  type(dialog, '#consultation-notes', 'Planning for my family.');
  fireEvent.click(next());

  fireEvent.click(await within(dialog).findByRole('button', { name: /Confirm Booking/ }));
  await waitFor(() => expect(post).toHaveBeenCalledTimes(1));
  return sent();
}

async function viaLive(Page: ComponentType, button: RegExp, submit: typeof submitQuote) {
  renderPage(Page);
  const [open] = screen.getAllByRole('button', { name: button });
  const requests = await submit(open);
  cleanup();
  post.mockClear();
  return requests;
}

async function viaNavigator(Page: ComponentType, button: RegExp, submit: typeof submitQuote) {
  renderPage(Page);
  await screen.findByRole('heading', { level: 1 });
  const [open] = screen.getAllByRole('button', { name: button });
  return submit(open);
}

const SOLUTIONS = [
  {
    name: 'individuals',
    Live: ForIndividualsPage,
    Navigator: NavigatorForIndividualsPage,
    liveQuote: /^Get Started$/,
    navQuote: /^Get a Quote$/,
    liveConsult: /^Book a Consultation$/,
  },
  {
    name: 'businesses',
    Live: ForBusinessesPage,
    Navigator: NavigatorForBusinessesPage,
    liveQuote: /Get Your Business Quote/,
    navQuote: /Get Your Business Quote/,
    liveConsult: /^Book a Consultation$/,
  },
  {
    name: 'advisers',
    Live: ForAdvisersPage,
    Navigator: NavigatorForAdvisersPage,
    liveQuote: /Get Your Succession Plan/,
    navQuote: /Get Your Succession Plan/,
    liveConsult: /^Book a Consultation$/,
  },
];

describe.each(SOLUTIONS)('Solutions page for $name', (page) => {
  it('posts the same quote request as the live page', async () => {
    const live = await viaLive(page.Live, page.liveQuote, submitQuote);
    const nav = await viaNavigator(page.Navigator, page.navQuote, submitQuote);
    expect(live).toHaveLength(1);
    expect(live[0][0]).toBe('/quote-request/submit');
    expect(nav).toEqual(live);
  });

  it('posts the same consultation booking as the live page', async () => {
    const live = await viaLive(page.Live, page.liveConsult, submitConsultation);
    const nav = await viaNavigator(page.Navigator, /Book a Free Consultation/, submitConsultation);
    expect(live).toHaveLength(1);
    expect(live[0][0]).toBe('/consultation/request');
    expect(nav).toEqual(live);
  });
});

describe('Why Us page', () => {
  it('posts the same consultation booking as the live page', async () => {
    const live = await viaLive(WhyUsPage, /Schedule Free Consultation/, submitConsultation);
    const nav = await viaNavigator(
      NavigatorWhyUsPage,
      /Schedule Free Consultation/,
      submitConsultation,
    );
    expect(live).toHaveLength(1);
    expect(live[0][0]).toBe('/consultation/request');
    expect(nav).toEqual(live);
  });
});
