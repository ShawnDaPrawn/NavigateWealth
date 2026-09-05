import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { RouterProvider, createMemoryRouter } from 'react-router';
import type { NewsletterCampaign, NewsletterListView } from '../../types';

const hooks = vi.hoisted(() => ({
  lists: { data: [] as NewsletterListView[], isLoading: false },
  templates: { data: [] as unknown[] },
  create: { mutateAsync: vi.fn(), isPending: false },
  update: { mutateAsync: vi.fn(), isPending: false },
}));

vi.mock('../../hooks/useNewsletterStudio', () => ({
  useStudioLists: () => hooks.lists,
  useStudioTemplates: () => hooks.templates,
  useCreateCampaign: () => hooks.create,
  useUpdateCampaign: () => hooks.update,
}));
// The shared TipTap editor is heavy and owned by publications; a textarea
// stand-in exercises the same value/onChange contract.
vi.mock('../../../publications', () => ({
  RichTextEditor: ({ value, onChange }: { value: string; onChange: (value: string) => void }) => (
    <textarea
      data-testid="rte"
      aria-label="Body"
      value={value}
      onChange={(event) => onChange(event.target.value)}
    />
  ),
}));

import { CampaignEditor } from '../CampaignEditor';

const LISTS: NewsletterListView[] = [
  {
    id: 'sys_newsletter_contacts',
    name: 'Newsletter Contacts',
    description: '',
    type: 'system',
    memberCount: 206,
    externalContactCount: 206,
    clientCount: 0,
  },
  {
    id: 'grp-1',
    name: 'Allan Gray clients',
    description: '',
    type: 'custom',
    memberCount: 14,
    externalContactCount: 0,
    clientCount: 14,
  },
];

const saved = (overrides: Partial<NewsletterCampaign> = {}): NewsletterCampaign => ({
  id: 'c-new',
  name: 'September wrap',
  subject: 'Your September update',
  fromName: 'Navigate Wealth',
  listIds: ['sys_newsletter_contacts'],
  listNames: ['Newsletter Contacts'],
  bodyHtml: '<p>Hello {{firstName}}</p>',
  templateId: null,
  trackClicks: true,
  status: 'draft',
  scheduledAt: null,
  links: [],
  recipientCount: 0,
  sentCount: 0,
  failedCount: 0,
  processedCount: 0,
  progressPercent: 0,
  openCount: 0,
  clickCount: 0,
  statsRefreshedAt: null,
  createdBy: 'admin',
  createdAt: '2026-09-05T08:00:00.000Z',
  updatedAt: '2026-09-05T09:00:00.000Z',
  startedAt: null,
  completedAt: null,
  lastProgressAt: null,
  lastError: null,
  pendingCount: 0,
  stuck: false,
  ...overrides,
});

function renderEditor(props: Partial<React.ComponentProps<typeof CampaignEditor>> = {}) {
  const onBack = vi.fn();
  const onSaved = vi.fn();
  const router = createMemoryRouter(
    [
      {
        path: '/',
        element: <CampaignEditor campaign={null} onBack={onBack} onSaved={onSaved} {...props} />,
      },
    ],
    { initialEntries: ['/'] },
  );
  render(<RouterProvider router={router} />);
  return { onBack, onSaved };
}

beforeEach(() => {
  vi.clearAllMocks();
  hooks.lists.data = LISTS;
  hooks.lists.isLoading = false;
});

describe('CampaignEditor', () => {
  it('pre-selects the subscriber base and tallies the estimated reach', async () => {
    renderEditor();
    expect(await screen.findByText('206')).toBeTruthy();
    const subscribers = screen.getByRole('checkbox', { name: /Newsletter Contacts/ });
    expect(subscribers.getAttribute('data-state')).toBe('checked');

    fireEvent.click(screen.getByRole('checkbox', { name: /Allan Gray clients/ }));
    expect(screen.getByText('220')).toBeTruthy();
  });

  it('refuses to save until the checklist is complete, then creates the draft', async () => {
    const { onSaved } = renderEditor();
    hooks.create.mutateAsync.mockResolvedValue(saved());
    await screen.findByTestId('rte');

    fireEvent.click(screen.getAllByRole('button', { name: /save draft/i })[0]);
    expect(hooks.create.mutateAsync).not.toHaveBeenCalled();
    expect(screen.getByText('Before you can save')).toBeTruthy();

    fireEvent.change(screen.getByLabelText('Internal name'), {
      target: { value: 'September wrap' },
    });
    fireEvent.change(screen.getByLabelText('Subject'), {
      target: { value: 'Your September update' },
    });
    fireEvent.change(screen.getByTestId('rte'), {
      target: { value: '<p>Hello {{firstName}}</p>' },
    });
    expect(screen.getByText('Ready to save')).toBeTruthy();
    expect(screen.getByText('Unsaved changes')).toBeTruthy();

    fireEvent.click(screen.getAllByRole('button', { name: /save draft/i })[0]);
    await waitFor(() => expect(hooks.create.mutateAsync).toHaveBeenCalledTimes(1));
    expect(hooks.create.mutateAsync).toHaveBeenCalledWith({
      name: 'September wrap',
      subject: 'Your September update',
      preheader: undefined,
      fromName: 'Navigate Wealth',
      listIds: ['sys_newsletter_contacts'],
      bodyHtml: '<p>Hello {{firstName}}</p>',
      trackClicks: true,
    });
    await waitFor(() => expect(onSaved).toHaveBeenCalledWith(saved()));
  });

  it('applies a starter layout into an empty body and keeps a subject the author set', async () => {
    renderEditor();
    await screen.findByTestId('rte');
    fireEvent.change(screen.getByLabelText('Subject'), { target: { value: 'Keep me' } });
    fireEvent.click(screen.getByRole('button', { name: /Monthly update/ }));
    expect((screen.getByTestId('rte') as HTMLTextAreaElement).value).toContain('Hi {{firstName}}');
    expect((screen.getByLabelText('Subject') as HTMLInputElement).value).toBe('Keep me');
  });

  it('asks before leaving with unsaved changes and leaves cleanly once discarded', async () => {
    const { onBack } = renderEditor();
    await screen.findByTestId('rte');
    fireEvent.change(screen.getByLabelText('Subject'), { target: { value: 'Draft subject' } });
    fireEvent.click(screen.getByRole('button', { name: /back to campaigns/i }));
    expect(onBack).not.toHaveBeenCalled();
    expect(await screen.findByText(/unsaved changes\. Save them before leaving/i)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /discard/i }));
    await waitFor(() => expect(onBack).toHaveBeenCalledTimes(1));
  });

  it('edits an existing campaign with its content and a disabled save until something changes', async () => {
    const campaign = saved({ id: 'c-1', preheader: 'Short version' });
    renderEditor({ campaign });
    await screen.findByTestId('rte');
    expect((screen.getByLabelText('Preview text') as HTMLInputElement).value).toBe('Short version');
    expect(screen.getByText('All changes saved')).toBeTruthy();
    const save = screen.getAllByRole('button', { name: /save changes/i })[0] as HTMLButtonElement;
    expect(save.disabled).toBe(true);

    fireEvent.change(screen.getByLabelText('Subject'), { target: { value: 'Better subject' } });
    expect(save.disabled).toBe(false);
    hooks.update.mutateAsync.mockResolvedValue(saved({ id: 'c-1', subject: 'Better subject' }));
    fireEvent.click(save);
    await waitFor(() =>
      expect(hooks.update.mutateAsync).toHaveBeenCalledWith({
        id: 'c-1',
        patch: expect.objectContaining({ subject: 'Better subject' }),
      }),
    );
  });
});
