/**
 * The redesigned booking page, reached the way production reaches it:
 * ScheduleConsultationPage with the design switch on lazy-loads
 * NavigatorScheduleConsultationPage. Covers what the redesign must not lose
 * (the SEO tags, the analytics event with its attribution, the contact link
 * keeping the query string, the firm's details from companyFacts, links only
 * to routes that exist, exactly the live booking's options and payload) and
 * what it adds (radio groups and a calendar worked from the keyboard, errors
 * beside the fields with focus on the first, a failed send shown in the form,
 * the confirmation in place).
 */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { renderToStaticMarkup } from 'react-dom/server';
import { BookingIcon, type BookingIconName } from '../sections/BookingIcons';

/** The inner markup of a booking icon, to tell which one a row draws. */
function iconMarkup(name: BookingIconName): string {
  const holder = document.createElement('div');
  holder.innerHTML = renderToStaticMarkup(<BookingIcon name={name} size={16} />);
  return holder.querySelector('svg')!.innerHTML;
}

vi.mock('../design', () => ({ SITE_DESIGN: 'navigator', resolveSiteDesign: () => 'navigator' }));
vi.mock('../../utils/api/client', () => ({ api: { post: vi.fn() } }));
vi.mock('../../utils/analytics', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../utils/analytics')>()),
  trackConsultationFlowStarted: vi.fn(),
}));

const { ScheduleConsultationPage } =
  await import('../../components/pages/ScheduleConsultationPage');
const { api } = await import('../../utils/api/client');
const { trackConsultationFlowStarted } = await import('../../utils/analytics');
const { COMPANY } = await import('../../config/companyFacts');
const { SITE_ORIGIN } = await import('../../utils/siteOrigin');
const { WHATSAPP_HREF } = await import('../siteLinks');
const { MEETING_TYPES, generateTimeSlots, formatTimeLabel } =
  await import('../../components/modals/consultationBooking');
const { getBlockedEmailDomainWarning } =
  await import('../../shared/submissions/blockedEmailDomains');

const here = dirname(fileURLToPath(import.meta.url));
const read = (path: string) => readFileSync(resolve(here, path), 'utf8');
/** The live page and the live booking, whitespace collapsed. */
const livePage = read('../../components/pages/ScheduleConsultationPage.tsx').replace(/\s+/g, ' ');
const liveModal = read('../../components/modals/ConsultationModal.tsx').replace(/\s+/g, ' ');

const post = () => vi.mocked(api.post);

async function renderPage(path = '/schedule-consultation') {
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/schedule-consultation" element={<ScheduleConsultationPage />} />
        <Route path="/contact/consultation" element={<ScheduleConsultationPage />} />
      </Routes>
    </MemoryRouter>,
  );
  return screen.findByRole('heading', { level: 1 });
}

const card = () => document.querySelector('.nwbk-card') as HTMLElement;
const continueButton = () => within(card()).getByRole('button', { name: /Continue/ });
const pressContinue = () => fireEvent.click(continueButton());
const day = (label: string) => screen.getByRole('button', { name: label });

/** Walks the booking to the details leg: telephonic, Monday 23 November, 10:30. */
function toDetails() {
  fireEvent.click(screen.getByRole('radio', { name: 'Telephonic Meeting' }));
  pressContinue();
  fireEvent.click(day('Monday, 23 November 2026'));
  pressContinue();
  fireEvent.click(screen.getByRole('radio', { name: '10:30 AM' }));
  pressContinue();
}

function fill(values: Record<string, string>) {
  for (const [label, value] of Object.entries(values)) {
    fireEvent.change(screen.getByLabelText(label), { target: { value } });
  }
}

const VALID = {
  'Full Name *': 'Thandi Mokoena',
  'Email Address *': 'thandi@example.com',
  'Contact Number *': '082 000 0000',
  'Additional Notes (optional)': 'I would like to review my retirement savings.',
};

beforeEach(() => {
  // Thursday 19 November 2026, 10:00 in Pretoria: the first bookable day is Monday 23rd.
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-11-19T08:00:00Z'));
  post().mockReset();
  post().mockResolvedValue({ success: true });
  vi.mocked(trackConsultationFlowStarted).mockClear();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('Navigator booking page', () => {
  it("has one H1, the board's headline, and headings in order", async () => {
    const h1 = await renderPage();
    expect(h1.textContent).toBe('Schedule Your Free Consultation');
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    const levels = screen.getAllByRole('heading').map((h) => [h.tagName, h.textContent]);
    expect(levels).toEqual([
      ['H1', 'Schedule Your Free Consultation'],
      ['H2', 'How would you like to meet?'],
      ['H3', 'What happens next'],
      ['H3', 'Prefer to talk now?'],
      ['H2', 'Other ways to reach us'],
    ]);
    // The live booking's title, word for word.
    expect(liveModal).toContain('Schedule Your Free Consultation');
  });

  it('emits the same SEO tags as the live page', async () => {
    await renderPage();
    await waitFor(() => expect(document.title).toBe('Schedule a consultation | Navigate Wealth'));
    expect(livePage).toContain('title="Schedule a consultation | Navigate Wealth"');
    const description = document.querySelector('meta[name="description"]')?.getAttribute('content');
    expect(description).toBe(
      'Book a complimentary consultation with a Navigate Wealth financial adviser.',
    );
    expect(livePage).toContain(`description="${description}"`);
    expect(document.querySelector('link[rel="canonical"]')?.getAttribute('href')).toBe(
      `${SITE_ORIGIN}/schedule-consultation`,
    );
    expect(livePage).toContain('const CANONICAL = `${SITE_ORIGIN}/schedule-consultation`;');
  });

  it('reports the visit with its attribution, as the live page does', async () => {
    await renderPage('/schedule-consultation?utm_source=mail&gclid=abc&ref=x');
    expect(trackConsultationFlowStarted).toHaveBeenCalledTimes(1);
    expect(trackConsultationFlowStarted).toHaveBeenCalledWith({
      page_path: '/schedule-consultation',
      page_location: window.location.href,
      utm_source: 'mail',
      gclid: 'abc',
    });
    expect(livePage).toContain(
      "key.startsWith('utm_') || key === 'gclid' || key === 'fbclid' || key === 'msclkid'",
    );
  });

  it('links only to the phone, the mailbox, WhatsApp, the contact page and the booking', async () => {
    await renderPage('/contact/consultation?utm_source=mail');
    const hrefs = screen.getAllByRole('link').map((a) => a.getAttribute('href'));
    expect(new Set(hrefs)).toEqual(
      new Set([
        COMPANY.phone.tel,
        WHATSAPP_HREF,
        `mailto:${COMPANY.email}`,
        '/contact?utm_source=mail',
        '#booking',
      ]),
    );
    // Campaign parameters stay on the contact link, as on the live page.
    expect(livePage).toContain('const contactHref = `/contact${location.search ||');
    expect(screen.getByRole('link', { name: 'Open full contact form' }).getAttribute('href')).toBe(
      '/contact?utm_source=mail',
    );
    const whatsapp = screen.getByRole('link', { name: 'WhatsApp' });
    expect(whatsapp.getAttribute('rel')).toBe('noopener noreferrer');
    expect(document.getElementById('booking')).not.toBeNull();
  });

  it("takes the firm's phone, email, hours, office and languages from companyFacts", async () => {
    await renderPage();
    const hours = `Monday – Friday, ${COMPANY.officeHours.open} – ${COMPANY.officeHours.close}`;
    expect(screen.getByText(hours)).toBeDefined();
    expect(
      screen.getByText(
        `${hours} (SAST). Bookings require at least one full business day's notice.`,
      ),
    ).toBeDefined();
    expect(
      screen.getByText(
        `We meet — in person at our ${COMPANY.address.city} office, by video or by phone, in ${COMPANY.languages.join(' or ')}.`,
      ),
    ).toBeDefined();
    const phone = screen.getByRole('link', { name: '+27 (0)12 667 2505' });
    expect(phone.getAttribute('href')).toBe(COMPANY.phone.tel);
    expect(`27${'+27 (0)12 667 2505'.replace(/\D/g, '').slice(3)}`).toBe(
      COMPANY.phone.tel.replace(/\D/g, ''),
    );
    expect(screen.getByRole('link', { name: COMPANY.email })).toBeDefined();
    expect(screen.getByText(`At our office, ${COMPANY.office}`)).toBeDefined();
  });

  it('promises nothing the live booking does not', async () => {
    await renderPage();
    const text = document.body.textContent ?? '';
    expect(text).not.toMatch(/\d+\+ (clients|years)/i);
    expect(text).not.toMatch(/one business day/i);
    expect(text).toContain('We contact you within 24 hours on business days');
    expect(liveModal).toContain(
      'We will contact you within 24 hours on business days to confirm your appointment.',
    );
  });
});

describe('Navigator booking choices', () => {
  it('offers the live booking’s three meeting formats, with the arrow keys', async () => {
    await renderPage();
    const group = screen.getByRole('radiogroup', { name: 'Meeting type' });
    const radios = within(group).getAllByRole('radio');
    expect(radios.map((r) => r.textContent)).toEqual(
      MEETING_TYPES.map((m) => `${m.title}${m.subtitle}${m.detail}`),
    );
    expect(
      radios.map((r) => document.getElementById(r.getAttribute('aria-labelledby')!)!.textContent),
    ).toEqual(MEETING_TYPES.map((m) => m.title));
    expect(radios.map((r) => r.getAttribute('aria-checked'))).toEqual(['true', 'false', 'false']);
    expect(radios.filter((r) => r.tabIndex === 0)).toEqual([radios[0]]);

    fireEvent.keyDown(radios[0], { key: 'ArrowDown' });
    expect(document.activeElement).toBe(radios[1]);
    expect(radios[1].getAttribute('aria-checked')).toBe('true');
    fireEvent.keyDown(radios[1], { key: 'End' });
    expect(radios[2].getAttribute('aria-checked')).toBe('true');
    fireEvent.keyDown(radios[2], { key: 'ArrowRight' });
    expect(document.activeElement).toBe(radios[0]);
    fireEvent.keyDown(radios[0], { key: 'ArrowUp' });
    expect(document.activeElement).toBe(radios[2]);

    const summary = screen.getByRole('complementary', { name: 'Your booking' });
    expect(within(summary).getByText('In-Person Meeting')).toBeDefined();
  });

  it('opens only the days the live booking allows, and walks them from the keyboard', async () => {
    await renderPage();
    pressContinue();
    expect(screen.getByRole('heading', { name: 'Select a date' })).toBe(document.activeElement);
    expect(screen.getByText('November 2026')).toBeDefined();
    // Today, tomorrow (the notice day) and the weekend are closed; Monday is the first.
    for (const closed of [
      'Thursday, 19 November 2026 (unavailable)',
      'Friday, 20 November 2026 (unavailable)',
      'Saturday, 21 November 2026 (unavailable)',
      'Sunday, 22 November 2026 (unavailable)',
      'Saturday, 28 November 2026 (unavailable)',
    ]) {
      expect((day(closed) as HTMLButtonElement).disabled).toBe(true);
    }
    expect(day('Wednesday, 18 November 2026 (unavailable)').className).toContain('nwbk-day--past');
    const monday = day('Monday, 23 November 2026');
    expect((monday as HTMLButtonElement).disabled).toBe(false);
    expect(monday.tabIndex).toBe(0);
    expect(screen.getByRole('button', { name: 'Previous month' })).toHaveProperty('disabled', true);

    fireEvent.keyDown(monday, { key: 'ArrowRight' });
    expect(document.activeElement).toBe(day('Tuesday, 24 November 2026'));
    fireEvent.keyDown(document.activeElement!, { key: 'End' });
    expect(document.activeElement).toBe(day('Friday, 27 November 2026'));
    fireEvent.keyDown(document.activeElement!, { key: 'ArrowRight' });
    expect(document.activeElement).toBe(day('Monday, 30 November 2026'));
    fireEvent.keyDown(document.activeElement!, { key: 'ArrowDown' });
    await waitFor(() => expect(screen.getByText('December 2026')).toBeDefined());
    await waitFor(() => expect(document.activeElement).toBe(day('Monday, 7 December 2026')));
    // A month back is 7 November, closed, so the nearest open day: the 23rd.
    fireEvent.keyDown(document.activeElement!, { key: 'PageUp' });
    await waitFor(() => expect(document.activeElement).toBe(day('Monday, 23 November 2026')));
    // Nothing before the first bookable day.
    fireEvent.keyDown(document.activeElement!, { key: 'ArrowUp' });
    expect(document.activeElement).toBe(day('Monday, 23 November 2026'));
    fireEvent.keyDown(document.activeElement!, { key: 'ArrowLeft' });
    expect(document.activeElement).toBe(day('Monday, 23 November 2026'));

    fireEvent.click(day('Wednesday, 25 November 2026'));
    expect(day('Wednesday, 25 November 2026').getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByText('Wednesday, 25 November 2026', { selector: 'strong' })).toBeDefined();
    // Like the live calendar, it looks ahead without limit.
    const nextMonth = screen.getByRole('button', { name: 'Next month' });
    for (let i = 0; i < 6; i++) fireEvent.click(nextMonth);
    expect(screen.getByText('May 2027')).toBeDefined();
    expect(nextMonth).toHaveProperty('disabled', false);
  });

  it('offers the live booking’s half-hour slots, with the arrow keys', async () => {
    await renderPage();
    pressContinue();
    fireEvent.click(day('Monday, 23 November 2026'));
    pressContinue();
    expect(screen.getByText('Monday, 23 November 2026', { selector: 'p' })).toBeDefined();
    const group = screen.getByRole('radiogroup', { name: 'Time slots' });
    const slots = within(group).getAllByRole('radio');
    expect(slots.map((s) => s.textContent)).toEqual(generateTimeSlots().map(formatTimeLabel));
    expect(slots).toHaveLength(16);
    expect(slots[0].textContent).toBe('8:30 AM');
    expect(slots[15].textContent).toBe('4:00 PM');
    expect(slots[0].tabIndex).toBe(0);
    fireEvent.keyDown(slots[0], { key: 'ArrowRight' });
    expect(document.activeElement).toBe(slots[1]);
    expect(slots[1].getAttribute('aria-checked')).toBe('true');
    const summary = screen.getByRole('complementary', { name: 'Your booking' });
    expect(within(summary).getByText('9:00 AM (SAST)')).toBeDefined();
    expect(within(summary).getByText('Monday, 23 November 2026')).toBeDefined();
  });

  it('says a day or a time is needed when Continue is used too soon', async () => {
    await renderPage();
    pressContinue();
    expect(continueButton().getAttribute('aria-disabled')).toBe('true');
    pressContinue();
    expect(screen.getByText('Please choose a date.')).toBeDefined();
    expect(document.activeElement).toBe(day('Monday, 23 November 2026'));
    expect(screen.getByRole('heading', { name: 'Select a date' })).toBeDefined();

    fireEvent.click(day('Monday, 23 November 2026'));
    expect(screen.queryByText('Please choose a date.')).toBeNull();
    expect(continueButton().hasAttribute('aria-disabled')).toBe(false);
    pressContinue();
    pressContinue();
    const group = screen.getByRole('radiogroup', { name: 'Time slots' });
    expect(group.getAttribute('aria-invalid')).toBe('true');
    expect(document.getElementById(group.getAttribute('aria-describedby')!)!.textContent).toBe(
      'Please choose a time.',
    );
    expect(document.activeElement).toBe(within(group).getByRole('radio', { name: '8:30 AM' }));
  });
});

describe('Navigator booking details and sending', () => {
  it('says which fields need fixing, focuses the first and sends nothing', async () => {
    await renderPage();
    toDetails();
    expect(screen.getByRole('heading', { name: 'Your details' })).toBe(document.activeElement);
    pressContinue();
    const name = screen.getByLabelText('Full Name *');
    expect(document.activeElement).toBe(name);
    expect(name.getAttribute('aria-invalid')).toBe('true');
    expect(document.getElementById(name.getAttribute('aria-describedby')!)!.textContent).toBe(
      'Please enter your full name.',
    );
    expect(screen.getByText('Please enter your email address.')).toBeDefined();
    expect(screen.getByText('Please enter your contact number.')).toBeDefined();

    // The errors follow the fields once Continue has been tried.
    fill({ 'Full Name *': 'Thandi', 'Email Address *': 'thandi@', 'Contact Number *': '12' });
    expect(name.hasAttribute('aria-invalid')).toBe(false);
    expect(screen.getByText('Please enter a valid email address.')).toBeDefined();
    expect(screen.getByText('Please enter a valid contact number.')).toBeDefined();
    pressContinue();
    expect(document.activeElement).toBe(screen.getByLabelText('Email Address *'));
    expect(screen.getByRole('heading', { name: 'Your details' })).toBeDefined();
    expect(post()).not.toHaveBeenCalled();
  });

  it("warns about a flagged email domain in the server's words", async () => {
    await renderPage();
    toDetails();
    fill({
      'Full Name *': 'Thandi',
      'Email Address *': 'thandi@test.com',
      'Contact Number *': '082 000 0000',
    });
    const alert = screen.getByRole('alert');
    expect(alert.textContent).toBe(getBlockedEmailDomainWarning('test.com'));
    const email = screen.getByLabelText('Email Address *');
    expect(email.getAttribute('aria-invalid')).toBe('true');
    expect(email.getAttribute('aria-describedby')).toBe(alert.id);
    expect(continueButton().getAttribute('aria-disabled')).toBe('true');
    pressContinue();
    expect(document.activeElement).toBe(email);
    expect(screen.getByRole('heading', { name: 'Your details' })).toBeDefined();
  });

  it("sends exactly the live booking's payload and confirms in place", async () => {
    await renderPage();
    toDetails();
    fill(VALID);
    pressContinue();
    const review = screen.getByRole('heading', { name: 'Review your booking' });
    expect(document.activeElement).toBe(review);
    const list = card().querySelector('dl')!;
    expect([...list.querySelectorAll('dd')].map((d) => d.textContent)).toEqual([
      'Telephonic Meeting',
      'Monday, 23 November 2026',
      '10:30 AM (SAST)',
      'Thandi Mokoena',
      'thandi@example.com · 082 000 0000',
      'I would like to review my retirement savings.',
    ]);
    // The meeting row carries the chosen format's icon: a phone, not the video camera.
    expect(list.querySelector('svg')!.innerHTML).toBe(iconMarkup('phone'));
    await act(async () => {
      fireEvent.click(within(card()).getByRole('button', { name: /Confirm Booking/ }));
    });

    expect(post()).toHaveBeenCalledTimes(1);
    const [endpoint, payload, options] = post().mock.calls[0];
    expect(endpoint).toBe('/consultation/request');
    expect(options).toEqual({ retryTransientFailures: false });
    expect(payload).toEqual({
      name: 'Thandi Mokoena',
      email: 'thandi@example.com',
      phone: '082 000 0000',
      meetingType: 'telephonic',
      preferredDate1: '2026-11-23',
      preferredTime1: '10:30',
      preferredDate2: '',
      preferredTime2: '',
      preferredDate3: '',
      preferredTime3: '',
      additionalNotes: 'I would like to review my retirement savings.',
    });
    // The same fields, in the same order, to the same endpoint, as the live booking's call.
    const liveCall = liveModal.match(
      /api\.post\( '\/consultation\/request', \{(.*?)\}, \{ retryTransientFailures: false \},? \)/,
    )!;
    expect(liveCall).not.toBeNull();
    const liveKeys = [...liveCall[1].matchAll(/(\w+):/g)].map((m) => m[1]);
    expect(Object.keys(payload as object)).toEqual(liveKeys);
    expect(liveCall[1]).toContain("preferredDate1: format(selectedDate, 'yyyy-MM-dd')");

    const done = await screen.findByRole('heading', { name: 'Request Received!' });
    await waitFor(() => expect(document.activeElement).toBe(done));
    expect(card().textContent).toContain(
      "We've received your request and sent a confirmation to thandi@example.com.",
    );
    expect(card().textContent).toContain('10:30 AM (SAST)');
    expect(card().querySelector('.nwbk-done-box svg')!.innerHTML).toBe(iconMarkup('phone'));

    fireEvent.click(within(card()).getByRole('button', { name: 'Done' }));
    const first = await screen.findByRole('heading', { name: 'How would you like to meet?' });
    await waitFor(() => expect(document.activeElement).toBe(first));
    expect(
      screen.getByRole('radio', { name: 'Virtual Meeting' }).getAttribute('aria-checked'),
    ).toBe('true');
    const summary = screen.getByRole('complementary', { name: 'Your booking' });
    expect(within(summary).getAllByText('Not selected yet')).toHaveLength(2);
  });

  it('disables Confirm Booking while sending', async () => {
    let finish: (value: unknown) => void = () => {};
    post().mockImplementation(
      () =>
        new Promise((resolveSend) => {
          finish = resolveSend;
        }),
    );
    await renderPage();
    toDetails();
    fill(VALID);
    pressContinue();
    fireEvent.click(within(card()).getByRole('button', { name: /Confirm Booking/ }));
    const button = within(card()).getByRole('button', { name: /Booking…/ }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    await act(async () => {
      finish({ success: true });
    });
    expect(await screen.findByRole('heading', { name: 'Request Received!' })).toBeDefined();
  });

  it('shows a failed send in the form, keeping the booking', async () => {
    post().mockRejectedValue(
      new Error('Too many requests. Please wait a while before trying again.'),
    );
    await renderPage();
    toDetails();
    fill(VALID);
    pressContinue();
    await act(async () => {
      fireEvent.click(within(card()).getByRole('button', { name: /Confirm Booking/ }));
    });
    const alert = await within(card()).findByRole('alert');
    expect(alert.textContent).toBe('Too many requests. Please wait a while before trying again.');
    expect(screen.queryByRole('heading', { name: 'Request Received!' })).toBeNull();
    expect(within(card()).getByRole('button', { name: /Confirm Booking/ })).toBeDefined();

    // Without a message, the live booking's fallback, with the companyFacts number.
    post().mockRejectedValue({});
    await act(async () => {
      fireEvent.click(within(card()).getByRole('button', { name: /Confirm Booking/ }));
    });
    expect(within(card()).getByRole('alert').textContent).toBe(
      `Failed to book consultation. Please try again or contact us directly at ${COMPANY.phone.display}.`,
    );
    expect(liveModal).toContain(
      "'Failed to book consultation. Please try again or contact us directly at (+27) 12-667-2505.'",
    );
  });
});

describe('Navigator booking stylesheet', () => {
  it('scopes every rule to the Navigator site and honours reduced motion', () => {
    const css = read('../styles/schedule-consultation.css').replace(/\/\*[\s\S]*?\*\//g, '');
    const selectors = [...css.matchAll(/(^|})\s*([^@{}][^{}]*)\{/g)]
      .map((m) => m[2].trim())
      .filter((s) => !s.startsWith('@') && !/^(from|to|\d+%)$/.test(s));
    expect(selectors.length).toBeGreaterThan(50);
    for (const group of selectors) {
      for (const selector of group.split(/,(?![^(]*\))/)) {
        expect(selector.trim()).toMatch(/^(\.nw-site[\s.]|:where\(\.nw-site\.nwbk\))/);
      }
    }
    expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\)/);
  });
});
