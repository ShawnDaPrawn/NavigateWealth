/**
 * The redesigned request completion page, reached the way production reaches
 * it: RequestCompletionPage with the design switch on lazy-loads
 * NavigatorRequestCompletionPage. Covers what the redesign must not lose — the
 * GET of the request and the POST of `{ responses }` to the same addresses,
 * read and sent the same way (minus the anon key as a bearer), the same
 * required-field check, every response key the live renderers write, every
 * state and message — and what the board adds (the count of required answers,
 * the required-field message above the form with the fields marked, the
 * board's toast for a failed submission).
 */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';

vi.mock('../design', () => ({ SITE_DESIGN: 'navigator', resolveSiteDesign: () => 'navigator' }));
vi.mock('../../utils/supabase/info', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../utils/supabase/info')>()),
  projectId: 'proj',
  publicAnonKey: 'anon',
}));
const sonner = vi.hoisted(() => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('sonner', () => sonner);

const { RequestCompletionPage } = await import('../../components/pages/RequestCompletionPage');
const { COMPANY } = await import('../../config/companyFacts');

const here = dirname(fileURLToPath(import.meta.url));
const read = (path: string) => readFileSync(resolve(here, path), 'utf8').replace(/\s+/g, ' ');
/** The live page and the renderer it hands blocks to, whitespace collapsed. */
const liveSource = read('../../components/pages/RequestCompletionPage.tsx');
const rendererSource = read(
  '../../components/admin/modules/resources/builder/InteractiveFormRenderer.tsx',
);
const pageSource = read('../pages/NavigatorRequestCompletionPage.tsx');

const URL_GET = 'https://proj.supabase.co/functions/v1/make-server-91ed8379/requests/req-1';
const URL_SUBMIT = `${URL_GET}/submit`;
const CONFIRM = 'I confirm the information provided is correct';

const FIELDS = [
  { id: 'h1', type: 'header', label: 'Personal details' },
  {
    id: 'p1',
    type: 'paragraph',
    label: '',
    description: 'Please complete the details below so we can prepare for your review.',
  },
  {
    id: 'name',
    type: 'text',
    label: 'Full name',
    required: true,
    placeholder: 'As it appears on your ID',
  },
  {
    id: 'email',
    type: 'email',
    label: 'Email address',
    required: true,
    placeholder: 'you@example.com',
  },
  { id: 'phone', type: 'phone', label: 'Contact number', placeholder: '+27 82 123 4567' },
  { id: 'dob', type: 'date', label: 'Date of birth' },
  { id: 'deps', type: 'number', label: 'Number of dependants', placeholder: '0' },
  { id: 'h2', type: 'header', label: 'Preferences' },
  {
    id: 'method',
    type: 'select',
    label: 'Preferred contact method',
    required: true,
    options: ['Email', 'Phone', 'WhatsApp'],
  },
  {
    id: 'cover',
    type: 'radio',
    label: 'Do you have existing life cover?',
    options: ['Yes', 'No', 'Not sure'],
  },
  {
    id: 'notes',
    type: 'textarea',
    label: 'Anything else we should know?',
    description: 'Optional',
  },
  { id: 'copy', type: 'toggle', label: 'Email me a copy of my responses' },
  {
    id: 'topics',
    type: 'checkbox',
    label: 'Topics to discuss',
    options: ['Retirement', 'Tax'],
  },
  { id: 'confirm', type: 'checkbox', label: CONFIRM, required: true, options: [CONFIRM] },
];

function request(over: Record<string, unknown> = {}) {
  return {
    id: 'req-1',
    templateName: 'Client Information Request',
    recipientEmail: 'thandi@example.com',
    status: 'Sent',
    fields: FIELDS,
    ...over,
  };
}

type Answer = { ok: boolean; body?: unknown } | 'hold' | 'reject';

/** Stubs fetch: the GET answers `get`, the POST answers `post`. */
function stubFetch(get: Answer, post: Answer = { ok: true, body: { success: true } }) {
  const answer = (a: Answer) =>
    a === 'hold'
      ? new Promise(() => {})
      : a === 'reject'
        ? Promise.reject(new TypeError('Failed to fetch'))
        : Promise.resolve({ ok: a.ok, json: async () => a.body });
  vi.stubGlobal(
    'fetch',
    vi.fn((_url: string, init?: RequestInit) =>
      init?.method === 'POST' ? answer(post) : answer(get),
    ),
  );
}

async function renderPage() {
  render(
    <MemoryRouter initialEntries={['/requests/req-1']}>
      <Routes>
        <Route path="/requests/:id" element={<RequestCompletionPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

async function form() {
  await renderPage();
  return screen.findByRole('heading', { level: 1, name: 'Client Information Request' });
}

function posted() {
  const calls = vi.mocked(fetch).mock.calls.filter(([, init]) => init?.method === 'POST');
  return calls;
}

beforeEach(() => {
  sonner.toast.success.mockReset();
  sonner.toast.error.mockReset();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('Navigator request completion page', () => {
  it('shows the loading card while the request is fetched', async () => {
    stubFetch('hold');
    await renderPage();
    expect(await screen.findByRole('status', { name: 'Loading request' })).toBeTruthy();
  });

  it('fetches the request from the same public address, without the anon key', async () => {
    stubFetch({ ok: true, body: { request: request() } });
    await form();
    expect(fetch).toHaveBeenCalledTimes(1);
    const [url, init] = vi.mocked(fetch).mock.calls[0];
    expect(url).toBe(URL_GET);
    expect(init?.method ?? 'GET').toBe('GET');
    expect(JSON.stringify(init?.headers ?? {})).not.toContain('Authorization');
    // The live page's address…
    expect(liveSource).toContain(
      '`https://${projectId}.supabase.co/functions/v1/make-server-91ed8379/requests/${requestId}`',
    );
    // …read the same way…
    expect(liveSource).toContain('setRequest(data.request);');
    expect(pageSource).toContain('setRequest(data.request);');
    // …but no anon key as a bearer token.
    expect(pageSource).not.toContain('publicAnonKey');
  });

  it("draws the request as the board's document, with one H1", async () => {
    stubFetch({ ok: true, body: { request: request() } });
    await form();
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getByAltText('Navigate Wealth')).toBeTruthy();
    expect(screen.getByText(COMPANY.headquarters)).toBeTruthy();
    expect(screen.getByText('(+27) 12-667-2505')).toBeTruthy();
    expect(liveSource).toContain('(+27) 12-667-2505');
    expect(screen.getByText('Requested for:').textContent).toBe(
      'Requested for: thandi@example.com',
    );
    const today = new Date().toLocaleDateString('en-ZA', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    expect(screen.getByText(today)).toBeTruthy();
    expect(screen.getByText('0/4 required')).toBeTruthy();
    expect(screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)).toEqual([
      'Personal details',
      'Preferences',
    ]);
    expect(screen.getAllByText('Required')).toHaveLength(3);
    expect(screen.getByLabelText(/Full name/)).toBeTruthy();
    expect(
      screen.getByRole('radiogroup', { name: 'Do you have existing life cover?' }),
    ).toBeTruthy();
    expect(screen.getByRole('switch', { name: 'Email me a copy of my responses' })).toBeTruthy();
    // The live page's notes, and the firm's disclosure line it prints.
    for (const words of [
      'Important Information:',
      'Please complete all required fields marked with an asterisk (*)',
      'All information provided will be treated as confidential',
      'This document is for information purposes only and does not constitute financial advice.',
    ]) {
      expect(screen.getByText(words)).toBeTruthy();
      expect(liveSource).toContain(words);
    }
    expect(screen.getByText(`For assistance, please contact us at ${COMPANY.email}`)).toBeTruthy();
    expect(
      screen.getByText(
        `${COMPANY.legalName} t/a ${COMPANY.tradingName} | Authorised FSP ${COMPANY.fspNumber}`,
      ),
    ).toBeTruthy();
    expect(screen.queryAllByRole('link')).toHaveLength(0);
  });

  it('checks the required fields as live, names them, marks them and focuses the first', async () => {
    stubFetch({ ok: true, body: { request: request() } });
    await form();
    fireEvent.click(screen.getByRole('button', { name: 'Submit Response' }));
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toBe(
      `Please fill in all required fields: Full name, Email address, Preferred contact method, ${CONFIRM}`,
    );
    // The live page's message.
    expect(liveSource).toContain(
      "toast.error(`Please fill in all required fields: ${missingFields.join(', ')}`);",
    );
    expect(posted()).toHaveLength(0);
    const name = screen.getByLabelText(/Full name/);
    expect(name.getAttribute('aria-invalid')).toBe('true');
    expect(screen.getByLabelText(/Email address/).getAttribute('aria-invalid')).toBe('true');
    expect(screen.getByLabelText(/Contact number/).getAttribute('aria-invalid')).toBeNull();
    await waitFor(() => expect(document.activeElement).toBe(name));

    // Filling a field takes it out of the message.
    fireEvent.change(name, { target: { value: 'Thandi Mokoena' } });
    expect(screen.getByRole('alert').textContent).toBe(
      `Please fill in all required fields: Email address, Preferred contact method, ${CONFIRM}`,
    );
    expect(name.getAttribute('aria-invalid')).toBeNull();
    expect(screen.getByText('1/4 required')).toBeTruthy();
  });

  it('posts every answer under its field id, exactly as live, then thanks the client', async () => {
    stubFetch({ ok: true, body: { request: request() } });
    await form();
    fireEvent.change(screen.getByLabelText(/Full name/), { target: { value: 'Thandi Mokoena' } });
    fireEvent.change(screen.getByLabelText(/Email address/), {
      target: { value: 'thandi@example.com' },
    });
    fireEvent.change(screen.getByLabelText('Contact number'), {
      target: { value: '082 123 4567' },
    });
    fireEvent.change(screen.getByLabelText('Date of birth'), { target: { value: '1990-04-12' } });
    fireEvent.change(screen.getByLabelText('Number of dependants'), { target: { value: '2' } });
    fireEvent.change(screen.getByLabelText(/Preferred contact method/), {
      target: { value: 'WhatsApp' },
    });
    // Arrow keys move the single choice, as a radio group does.
    const yes = screen.getByRole('radio', { name: 'Yes' });
    fireEvent.click(yes);
    fireEvent.keyDown(yes, { key: 'ArrowRight' });
    expect(screen.getByRole('radio', { name: 'No' }).getAttribute('aria-checked')).toBe('true');
    fireEvent.change(screen.getByLabelText('Anything else we should know?'), {
      target: { value: 'Call after 5' },
    });
    fireEvent.click(screen.getByRole('switch', { name: 'Email me a copy of my responses' }));
    fireEvent.click(screen.getByLabelText('Retirement'));
    fireEvent.click(screen.getByLabelText('Tax'));
    fireEvent.click(screen.getByLabelText('Retirement'));
    fireEvent.click(screen.getByLabelText(new RegExp(CONFIRM)));
    expect(screen.getByText('4/4 required')).toBeTruthy();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Submit Response' }));
    });
    expect(await screen.findByRole('heading', { level: 1, name: 'Thank You!' })).toBeTruthy();

    expect(posted()).toHaveLength(1);
    const [url, init] = posted()[0];
    expect(url).toBe(URL_SUBMIT);
    expect(init).toEqual({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        responses: {
          name: 'Thandi Mokoena',
          email: 'thandi@example.com',
          phone: '082 123 4567',
          dob: '1990-04-12',
          deps: '2',
          method: 'WhatsApp',
          cover: 'No',
          notes: 'Call after 5',
          copy: true,
          topics: ['Tax'],
          confirm: [CONFIRM],
        },
      }),
    });
    expect(liveSource).toContain('/requests/${request.id}/submit');
    expect(liveSource).toContain("method: 'POST'");
    expect(liveSource).toContain('body: JSON.stringify({ responses })');
    expect(sonner.toast.success).toHaveBeenCalledWith('Form submitted successfully!');
    expect(liveSource).toContain("toast.success('Form submitted successfully!');");
    expect(screen.getByText('Your response has been successfully submitted.')).toBeTruthy();
    expect(
      screen.getByText('We have been notified and will review your information shortly.'),
    ).toBeTruthy();
  });

  it("shows the board's toast with the live message when the submission fails", async () => {
    stubFetch(
      { ok: true, body: { request: request({ fields: FIELDS.slice(0, 3) }) } },
      {
        ok: false,
        body: { error: 'Not found' },
      },
    );
    await form();
    fireEvent.change(screen.getByLabelText(/Full name/), { target: { value: 'Thandi' } });
    vi.useFakeTimers({ shouldAdvanceTime: true });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Submit Response' }));
    });
    const toast = await screen.findByRole('alert');
    expect(toast.textContent).toBe('Failed to submit form. Please try again.');
    expect(liveSource).toContain("toast.error('Failed to submit form. Please try again.');");
    expect(
      screen.getByRole('heading', { level: 1, name: 'Client Information Request' }),
    ).toBeTruthy();
    await act(async () => {
      vi.advanceTimersByTime(4100);
    });
    expect(screen.queryByRole('alert')).toBeNull();

    // A request that never got an answer fails the same way.
    stubFetch({ ok: true }, 'reject');
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Submit Response' }));
    });
    expect((await screen.findByRole('alert')).textContent).toBe(
      'Failed to submit form. Please try again.',
    );
  });

  it('marks the button busy while sending and sends once', async () => {
    stubFetch({ ok: true, body: { request: request({ fields: FIELDS.slice(0, 3) }) } }, 'hold');
    await form();
    fireEvent.change(screen.getByLabelText(/Full name/), { target: { value: 'Thandi' } });
    const button = screen.getByRole('button', { name: 'Submit Response' });
    fireEvent.click(button);
    await waitFor(() => expect(button.getAttribute('aria-disabled')).toBe('true'));
    fireEvent.click(button);
    expect(posted()).toHaveLength(1);
  });

  it('opens on the thank-you card for a request already Pending or Finalised', async () => {
    for (const status of ['Pending', 'Finalised']) {
      stubFetch({ ok: true, body: { request: request({ status }) } });
      await renderPage();
      expect(await screen.findByRole('heading', { level: 1, name: 'Thank You!' })).toBeTruthy();
      expect(screen.getByText(COMPANY.email)).toBeTruthy();
      expect(posted()).toHaveLength(0);
      cleanup();
    }
    expect(liveSource).toContain(
      "if (data.request.status === 'Pending' || data.request.status === 'Finalised')",
    );
  });

  it("shows the live page's error for a request that cannot be loaded", async () => {
    const message = 'Failed to load request. It may check have been deleted or does not exist.';
    expect(liveSource).toContain(message);
    for (const get of [
      { ok: false, body: { error: 'Request not found' } },
      // The route's own answer shape, which the live page does not read.
      { ok: true, body: { success: true, data: request() } },
      'reject' as const,
    ]) {
      stubFetch(get);
      await renderPage();
      expect(await screen.findByRole('heading', { level: 1, name: 'Error' })).toBeTruthy();
      expect(screen.getByRole('alert').textContent).toContain(message);
      expect(screen.getByRole('link', { name: COMPANY.email }).getAttribute('href')).toBe(
        `mailto:${COMPANY.email}`,
      );
      cleanup();
    }
  });

  it('draws template blocks and posts the keys the live renderer writes', async () => {
    const prompt = vi.fn(() => 'Thandi Mokoena');
    vi.stubGlobal('prompt', prompt);
    const blocks = [
      { id: 'b1', type: 'section_header', data: { number: '1.', title: 'Your details' } },
      {
        id: 'b2',
        type: 'text',
        data: { content: '<p>Read <strong>carefully</strong>.</p><script>alert(1)</script>' },
      },
      {
        id: 'b3',
        type: 'field_grid',
        data: {
          columns: 2,
          fields: [
            { label: 'Full name', required: true, key: 'client_name' },
            { label: 'ID number', required: true },
          ],
        },
      },
      {
        id: 'b4',
        type: 'radio_options',
        data: { label: 'Marital status', options: ['Single', 'Married'], layout: 'horizontal' },
      },
      { id: 'b5', type: 'checkbox_table', data: { columns: ['Keep', 'Review'], rows: ['Fund A'] } },
      {
        id: 'b6',
        type: 'compliance_question',
        data: { question: 'Are you a politically exposed person?', showDetails: true },
      },
      {
        id: 'b7',
        type: 'container',
        data: {
          conditionVariable: 'comp_b6',
          conditionValue: 'Yes',
          blocks: [
            {
              id: 'b8',
              type: 'instructional_callout',
              data: { type: 'warning', text: 'We will call you.' },
            },
          ],
        },
      },
      {
        id: 'b9',
        type: 'repeater',
        data: {
          title: 'Dependants',
          variableName: 'dependants',
          userPopulated: true,
          columns: [{ header: 'Name', key: 'name' }],
        },
      },
      {
        id: 'b10',
        type: 'signature',
        data: { signatories: [{ label: 'Client', key: '' }], showDate: true },
      },
    ];
    stubFetch({ ok: true, body: { request: request({ blocks }) } });
    await form();
    expect(screen.getByRole('heading', { level: 2, name: '1.Your details' })).toBeTruthy();
    expect(screen.getByText('carefully').tagName).toBe('STRONG');
    expect(document.querySelector('script')).toBeNull();
    expect(screen.getByText('0/2 required')).toBeTruthy();

    // The live check covers the grid's required fields.
    fireEvent.click(screen.getByRole('button', { name: 'Submit Response' }));
    expect((await screen.findByRole('alert')).textContent).toBe(
      'Please fill in all required fields: Full name, ID number',
    );

    fireEvent.change(screen.getByLabelText(/Full name/), { target: { value: 'Thandi Mokoena' } });
    fireEvent.change(screen.getByLabelText(/ID number/), { target: { value: '9004120000000' } });
    fireEvent.click(screen.getByRole('radio', { name: 'Married' }));
    fireEvent.click(screen.getByLabelText('Fund A: Review'));
    expect(screen.queryByText('We will call you.')).toBeNull();
    fireEvent.click(screen.getByRole('radio', { name: 'Yes' }));
    expect(screen.getByText('We will call you.')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Please provide details:'), {
      target: { value: 'Municipal councillor' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Add Row' }));
    fireEvent.click(screen.getByRole('button', { name: 'Add Row' }));
    fireEvent.change(screen.getByLabelText('Name, row 1'), { target: { value: 'Lebo' } });
    fireEvent.click(screen.getByRole('button', { name: 'Remove row 2' }));
    fireEvent.click(screen.getByRole('button', { name: 'Click to Sign' }));
    expect(prompt).toHaveBeenCalledWith('Type your full name to sign:');
    expect(screen.getByText('Thandi Mokoena', { selector: '.nwrc-sign-name' })).toBeTruthy();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Submit Response' }));
    });
    await screen.findByRole('heading', { level: 1, name: 'Thank You!' });
    const body = JSON.parse(posted()[0][1]!.body as string);
    expect(body).toEqual({
      responses: {
        client_name: 'Thandi Mokoena',
        field_b3_1: '9004120000000',
        radio_b4: 'Married',
        chk_b5_0_1: true,
        comp_b6: 'Yes',
        comp_b6_details: 'Municipal councillor',
        dependants: [{ name: 'Lebo' }],
        sig_b10_0: 'Thandi Mokoena',
      },
    });
    // The live renderer's keys and prompt, word for word.
    for (const key of [
      'field.key || `field_${block.id}_${idx}`',
      '(block.data.key as string) || `radio_${block.id}`',
      'const cellKey = `chk_${block.id}_${rowIdx}_${colIdx}`;',
      '(block.data.key as string) || `comp_${block.id}`',
      'const detailsKey = `${compKey}_details`;',
      'sig.key || `sig_${block.id}_${idx}`',
      "prompt('Type your full name to sign:')",
      "'Please provide details:'",
      'DOMPurify.sanitize(',
    ]) {
      expect(rendererSource).toContain(key);
    }
    expect(liveSource).toContain('field.key || `field_${block.id}_${idx}`');
  });

  it('lays a list of fields out as the board does', async () => {
    stubFetch({ ok: true, body: { request: request() } });
    await form();
    const grids = document.querySelectorAll('.nwrc-grid');
    expect(grids).toHaveLength(1);
    expect(
      within(grids[0] as HTMLElement)
        .getAllByText(/./, { selector: 'label' })
        .map((l) => l.textContent),
    ).toEqual(['Email address*', 'Contact number', 'Date of birth', 'Number of dependants']);
  });
});
