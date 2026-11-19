/**
 * The redesigned Ask Vasco page, reached the way production reaches it:
 * AskVascoPage with the design switch on lazy-loads NavigatorAskVascoPage.
 *
 * The chat must behave exactly as the live page's does — same stream endpoint
 * and payload, same counter and limit, same storage keys, same feedback and
 * call-back requests — and keep every disclaimer the live page shows. The
 * stream is stubbed at fetch, as useVascoStream's own tests stub it.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router';

vi.mock('../design', () => ({ SITE_DESIGN: 'navigator', resolveSiteDesign: () => 'navigator' }));
vi.mock('../../utils/supabase/info', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../utils/supabase/info')>()),
  projectId: 'proj',
  publicAnonKey: 'anon',
}));
const apiGet = vi.fn();
const apiPost = vi.fn();
vi.mock('../../utils/api', () => ({
  api: {
    get: (...args: unknown[]) => apiGet(...args),
    post: (...args: unknown[]) => apiPost(...args),
  },
}));
const toastError = vi.fn();
const toastSuccess = vi.fn();
vi.mock('sonner', () => ({
  toast: {
    error: (...args: unknown[]) => toastError(...args),
    success: (...args: unknown[]) => toastSuccess(...args),
  },
}));

const { AskVascoPage } = await import('../../components/pages/AskVascoPage');
const { SUGGESTED_PROMPTS } = await import('../../components/pages/askVascoData');
const { getSEOData } = await import('../../components/seo/seo-config');

const STREAM_URL = 'https://proj.supabase.co/functions/v1/make-server-91ed8379/vasco/chat/stream';
const DISCLAIMER =
  'Vasco is an AI-powered experimental tool and is not a licensed financial adviser. Nothing in this conversation constitutes formal financial advice, a recommendation, or an offer to buy or sell any financial product.';
const FINE_PRINT =
  'Vasco provides general financial information only — not personal financial advice.';

/** An SSE response the hook can read, one line per read. */
function sseResponse(lines: string[], headers: Record<string, string> = {}): Response {
  const encoder = new TextEncoder();
  const chunks = lines.map((line) => encoder.encode(`${line}\n`));
  let i = 0;
  return {
    ok: true,
    status: 200,
    headers: { get: (name: string) => headers[name] ?? null },
    body: {
      getReader: () => ({
        read: async () =>
          i < chunks.length
            ? { done: false, value: chunks[i++] }
            : { done: true, value: undefined },
        releaseLock: () => {},
      }),
    },
  } as unknown as Response;
}

function reply(parts: string[], sessionId = 'sess-1', remaining = '9') {
  return sseResponse(
    [
      ...parts.map((content) => `data: ${JSON.stringify({ type: 'chunk', content })}`),
      `data: ${JSON.stringify({ type: 'done', sessionId, citations: [] })}`,
    ],
    { 'X-Vasco-Remaining': remaining },
  );
}

function errorResponse(status: number, body: Record<string, unknown> = {}): Response {
  return {
    ok: false,
    status,
    headers: { get: () => null },
    json: async () => body,
  } as unknown as Response;
}

function stubFetch(...responses: Array<Response | Promise<Response>>) {
  const fn = vi.fn();
  for (const r of responses) fn.mockImplementationOnce(async () => r);
  vi.stubGlobal('fetch', fn);
  return fn;
}

function sentMessages(fetchMock: ReturnType<typeof vi.fn>, call = 0) {
  const [url, init] = fetchMock.mock.calls[call] as [string, RequestInit];
  expect(url).toBe(STREAM_URL);
  return JSON.parse(init.body as string) as {
    messages: Array<{ role: string; content: string }>;
    sessionId: string | null;
    visitorId: string;
  };
}

async function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/ask-vasco']}>
        <AskVascoPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  const h1 = await screen.findByRole('heading', { level: 1 });
  await waitFor(() => expect(apiGet).toHaveBeenCalledWith('/vasco/status'));
  return h1;
}

const log = () => screen.getByRole('log');
const input = () => screen.getByLabelText('Message Vasco') as HTMLTextAreaElement;

beforeEach(() => {
  localStorage.clear();
  apiGet.mockResolvedValue({ enabled: true });
  apiPost.mockResolvedValue({ success: true });
  vi.stubGlobal('scrollTo', vi.fn());
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
  document.getElementById('seo-structured-data')?.remove();
});

describe('Navigator Ask Vasco page', () => {
  it('has one H1, the board’s, and its headings in order', async () => {
    const h1 = await renderPage();
    expect(h1.textContent).toBe('Ask Vasco');
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    // The redesign, not the legacy page.
    expect(h1.closest('.nw-site.nwav')).not.toBeNull();
    expect(document.querySelectorAll('h2, h3, h4, h5, h6')).toHaveLength(0);
  });

  it('emits the live page’s SEO data', async () => {
    await renderPage();
    const seo = getSEOData('ask-vasco');
    await waitFor(() => expect(document.getElementById('seo-structured-data')).not.toBeNull());
    const data = JSON.parse(document.getElementById('seo-structured-data')!.textContent!);
    expect(data).toMatchObject({
      '@type': 'WebPage',
      name: seo.title,
      description: seo.description,
      url: seo.canonicalUrl,
    });
    expect(document.title).toBe(seo.title);
  });

  it('keeps every disclaimer the live page shows', async () => {
    await renderPage();
    expect(screen.getByText(DISCLAIMER)).toBeDefined();
    expect(screen.getByText('Disclaimer:')).toBeDefined();
    expect(screen.getByText(FINE_PRINT)).toBeDefined();
    expect(screen.getByText('Online · General information, not advice')).toBeDefined();

    // The call-back form's privacy line.
    fireEvent.click(screen.getByRole('button', { name: /Book a Free Consultation/ }));
    const dialog = await screen.findByRole('dialog', { name: 'Book a Free Consultation' });
    expect(
      within(dialog).getByText('Your information will be shared with Navigate Wealth only.'),
    ).toBeDefined();
  });

  it('links only to routes the site serves', async () => {
    await renderPage();
    const hrefs = screen.getAllByRole('link').map((a) => a.getAttribute('href'));
    expect(hrefs).toEqual(['/signup']);
  });

  it('greets with the live welcome and offers the live prompts', async () => {
    await renderPage();
    expect(within(log()).getByText('Vasco', { selector: 'strong' })).toBeDefined();
    expect(within(log()).getByText('Understanding tax implications')).toBeDefined();
    const prompts = within(log()).getAllByRole('button');
    expect(prompts.map((b) => b.textContent)).toEqual(SUGGESTED_PROMPTS);
    expect(screen.getByText('10 free questions daily', { selector: '.nw-sr-only' })).toBeDefined();
  });

  it('sends a suggested prompt as the question, with the live payload', async () => {
    const fetchMock = stubFetch(reply(['Retirement annuities are...']));
    await renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'Explain retirement annuities' }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const body = sentMessages(fetchMock);
    expect(body.messages).toEqual([{ role: 'user', content: 'Explain retirement annuities' }]);
    expect(body.sessionId).toBeNull();
    expect(body.visitorId).toBe(localStorage.getItem('vasco_visitor_id'));
    expect(within(log()).getByText('Explain retirement annuities')).toBeDefined();
    // The prompts give way to the conversation.
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: 'Explain retirement annuities' })).toBeNull(),
    );
  });

  it('renders the streamed reply, updates the counter and saves the conversation', async () => {
    const fetchMock = stubFetch(
      reply(['Life cover should replace ', 'what your income pays for.\n- Your bond']),
    );
    await renderPage();
    fireEvent.change(input(), { target: { value: 'How much life cover do I need?' } });
    fireEvent.keyDown(input(), { key: 'Enter' });

    await within(log()).findByText('Life cover should replace what your income pays for.');
    expect(within(log()).getByText('Your bond')).toBeDefined();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(input().value).toBe('');
    expect(screen.getByText('9 free questions left', { selector: '.nw-sr-only' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Helpful' })).toBeDefined();

    expect(localStorage.getItem('vasco_session_id')).toBe('sess-1');
    const saved = JSON.parse(localStorage.getItem('vasco_session_messages')!);
    expect(saved.map((m: { role: string; content: string }) => [m.role, m.content])).toEqual([
      ['user', 'How much life cover do I need?'],
      ['assistant', 'Life cover should replace what your income pays for.\n- Your bond'],
    ]);
  });

  it('announces politely through the log and shows Vasco typing while it waits', async () => {
    let release: (r: Response) => void = () => {};
    stubFetch(new Promise<Response>((resolve) => (release = resolve)));
    await renderPage();
    expect(log().getAttribute('aria-live')).toBe('polite');
    expect(log().getAttribute('aria-relevant')).toBe('additions');

    fireEvent.click(screen.getByRole('button', { name: SUGGESTED_PROMPTS[0] }));
    const status = await within(log()).findByRole('status');
    expect(status.textContent).toBe('Vasco is responding...');
    expect(screen.getByRole('button', { name: 'Send message' })).toHaveProperty('disabled', true);
    expect(screen.getByRole('button', { name: 'Clear conversation' })).toHaveProperty(
      'disabled',
      true,
    );

    await act(async () => release(reply(['Done.'])));
    await within(log()).findByText('Done.');
    expect(within(log()).queryByText('Vasco is responding...')).toBeNull();
  });

  it('Shift+Enter is a new line, not a send', async () => {
    const fetchMock = stubFetch();
    await renderPage();
    fireEvent.change(input(), { target: { value: 'First line' } });
    fireEvent.keyDown(input(), { key: 'Enter', shiftKey: true });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('shows an error in the log and asks the same question again on "Try again"', async () => {
    const fetchMock = stubFetch(errorResponse(503), reply(['Second time lucky.']));
    await renderPage();
    fireEvent.click(screen.getByRole('button', { name: SUGGESTED_PROMPTS[1] }));

    const alert = await within(log()).findByRole('alert');
    expect(alert.textContent).toContain("Vasco couldn't answer just now.");
    expect(alert.textContent).toContain(
      'I apologise, but I encountered a temporary issue. Please try again.',
    );
    expect(toastError).toHaveBeenCalledWith(
      'I apologise, but I encountered a temporary issue. Please try again.',
    );

    fireEvent.click(within(alert).getByRole('button', { name: 'Try again' }));
    await within(log()).findByText('Second time lucky.');
    expect(within(log()).queryByRole('alert')).toBeNull();
    // The failed question is asked once more, not twice over.
    expect(sentMessages(fetchMock, 1).messages).toEqual([
      { role: 'user', content: SUGGESTED_PROMPTS[1] },
    ]);
    expect(within(log()).getAllByText(SUGGESTED_PROMPTS[1])).toHaveLength(1);
  });

  it('stops at the free-question limit and points to an adviser', async () => {
    stubFetch(
      errorResponse(429, {
        error: 'You have reached the free Ask Vasco limit for now.',
        limitReached: true,
        remaining: 0,
      }),
    );
    await renderPage();
    fireEvent.click(screen.getByRole('button', { name: SUGGESTED_PROMPTS[2] }));

    const alert = await within(log()).findByRole('alert');
    expect(alert.textContent).toContain('You have reached the free Ask Vasco limit for now.');
    expect(within(alert).queryByRole('button', { name: 'Try again' })).toBeNull();
    expect(screen.getByText('Free questions used', { selector: '.nw-sr-only' })).toBeDefined();
    expect(input().disabled).toBe(true);
    expect(
      screen.getByText(
        'You have used the free public questions for now. A Navigate Wealth adviser can help from here.',
      ),
    ).toBeDefined();
  });

  it('sends feedback as the live page does', async () => {
    stubFetch(reply(['An answer.']));
    await renderPage();
    fireEvent.click(screen.getByRole('button', { name: SUGGESTED_PROMPTS[3] }));
    await within(log()).findByText('An answer.');

    fireEvent.click(screen.getByRole('button', { name: 'Helpful' }));
    expect(await screen.findByText('Thanks for the feedback')).toBeDefined();
    expect(apiPost).toHaveBeenCalledWith('/vasco/feedback', {
      sessionId: 'sess-1',
      messageContent: 'An answer.',
      rating: 'positive',
    });
    // One rating per answer.
    fireEvent.click(screen.getByRole('button', { name: 'Not helpful' }));
    expect(apiPost).toHaveBeenCalledTimes(1);
  });

  it('requests a call-back with the live payload', async () => {
    await renderPage();
    fireEvent.click(screen.getByRole('button', { name: /Book a Free Consultation/ }));
    const dialog = await screen.findByRole('dialog', { name: 'Book a Free Consultation' });
    fireEvent.change(within(dialog).getByLabelText(/Full Name/), {
      target: { value: ' Thandi ' },
    });
    fireEvent.change(within(dialog).getByLabelText(/Email/), {
      target: { value: 'thandi@example.com' },
    });
    fireEvent.change(within(dialog).getByLabelText(/What would you like to discuss/), {
      target: { value: 'Retirement' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Request Callback' }));

    expect(await screen.findByText('Request Submitted')).toBeDefined();
    expect(apiPost).toHaveBeenCalledWith('/vasco/handoff', {
      sessionId: 'unknown',
      name: 'Thandi',
      email: 'thandi@example.com',
      phone: undefined,
      topic: 'Retirement',
      conversationSummary: '',
    });
  });

  it('restores a saved conversation and clears it on confirmation', async () => {
    localStorage.setItem('vasco_session_id', 'sess-9');
    localStorage.setItem(
      'vasco_session_messages',
      JSON.stringify([
        { role: 'user', content: 'Saved question', timestamp: '2026-11-01T08:00:00Z' },
        { role: 'assistant', content: 'Saved answer', timestamp: '2026-11-01T08:00:05Z' },
      ]),
    );
    await renderPage();
    expect(within(log()).getByText('Saved question')).toBeDefined();
    expect(within(log()).getByText('Saved answer')).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: 'Clear conversation' }));
    const confirm = await screen.findByRole('alertdialog', { name: 'Clear conversation?' });
    fireEvent.click(within(confirm).getByRole('button', { name: 'Clear chat' }));

    await waitFor(() => expect(within(log()).queryByText('Saved question')).toBeNull());
    expect(localStorage.getItem('vasco_session_messages')).toBeNull();
    expect(localStorage.getItem('vasco_session_id')).toBeNull();
  });

  it('shows the live "coming soon" message while Vasco is switched off', async () => {
    apiGet.mockResolvedValue({ enabled: false });
    await renderPage();
    expect(
      await screen.findByRole('heading', { level: 2, name: 'Vasco is Coming Soon' }),
    ).toBeDefined();
    expect(screen.queryByRole('log')).toBeNull();
    const hrefs = screen.getAllByRole('link').map((a) => a.getAttribute('href'));
    expect(hrefs).toEqual(['/services', '/contact']);
  });
});
