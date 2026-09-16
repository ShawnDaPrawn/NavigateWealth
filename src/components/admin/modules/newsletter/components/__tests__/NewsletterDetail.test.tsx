import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type { NewsletterCampaign } from '../../types';

const hooks = vi.hoisted(() => {
  const mutation = () => ({
    mutate: vi.fn(),
    mutateAsync: vi.fn(async () => ({})),
    isPending: false,
  });
  return {
    lists: { data: [], isLoading: false },
    dashboard: { data: undefined },
    stats: { data: undefined as unknown },
    recipients: { data: { recipients: [], total: 0, page: 1, limit: 50 }, isLoading: false },
    update: mutation(),
    upload: mutation(),
    sendTest: mutation(),
    schedule: mutation(),
    sendNow: mutation(),
    resume: mutation(),
    cancel: mutation(),
    remove: mutation(),
  };
});

vi.mock('../../hooks/useNewsletterStudio', () => ({
  useStudioLists: () => hooks.lists,
  useStudioDashboard: () => hooks.dashboard,
  useStudioCampaignStats: () => hooks.stats,
  useStudioRecipients: () => hooks.recipients,
  useUpdateCampaign: () => hooks.update,
  useUploadCampaignPdf: () => hooks.upload,
  useSendTest: () => hooks.sendTest,
  useScheduleCampaign: () => hooks.schedule,
  useSendCampaignNow: () => hooks.sendNow,
  useResumeCampaign: () => hooks.resume,
  useCancelCampaign: () => hooks.cancel,
  useDeleteCampaign: () => hooks.remove,
}));
vi.mock('../../api', () => ({
  newsletterStudioApi: {
    getPdfUrl: vi.fn(async () => ({ url: 'https://signed/x', fileName: 'x.pdf' })),
  },
}));

import { NewsletterDetail } from '../NewsletterDetail';

const campaign = (overrides: Partial<NewsletterCampaign> = {}): NewsletterCampaign => ({
  id: 'c1',
  title: 'September issue',
  description: 'What mattered.',
  fromName: 'Navigate Wealth',
  listIds: ['sys_newsletter_contacts'],
  listNames: ['Newsletter Contacts'],
  pdf: { storagePath: 'c1/x.pdf', fileName: 'x.pdf', sizeBytes: 100, uploadedAt: '2026-09-01' },
  source: 'admin',
  sourceRef: null,
  reviewNotifiedAt: null,
  status: 'draft',
  scheduledAt: null,
  recipientCount: 0,
  sentCount: 0,
  failedCount: 0,
  processedCount: 0,
  progressPercent: 0,
  readCount: 0,
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

const caps = { create: true, send: true, delete: true };

beforeEach(() => {
  vi.clearAllMocks();
});

describe('NewsletterDetail', () => {
  it('blocks every send action until a PDF is uploaded', () => {
    render(<NewsletterDetail campaign={campaign({ pdf: null })} caps={caps} onDeleted={vi.fn()} />);
    expect(screen.getByText('Upload the PDF first')).toBeTruthy();
    expect((screen.getByRole('button', { name: /send now/i }) as HTMLButtonElement).disabled).toBe(
      true,
    );
    expect(
      (screen.getByRole('button', { name: /send myself a test/i }) as HTMLButtonElement).disabled,
    ).toBe(true);
    expect((screen.getByRole('button', { name: /schedule/i }) as HTMLButtonElement).disabled).toBe(
      true,
    );
  });

  it('flags a routine hand-over and lets the admin edit and save the draft', () => {
    render(
      <NewsletterDetail
        campaign={campaign({ source: 'routine' })}
        caps={caps}
        onDeleted={vi.fn()}
      />,
    );
    expect(screen.getByText('Handed over by the monthly routine')).toBeTruthy();

    const save = screen.getByRole('button', { name: /save changes/i }) as HTMLButtonElement;
    expect(save.disabled).toBe(true);
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'September, revised' } });
    expect(save.disabled).toBe(false);
    fireEvent.click(save);
    expect(hooks.update.mutate).toHaveBeenCalledWith({
      id: 'c1',
      patch: {
        title: 'September, revised',
        description: 'What mattered.',
        listIds: ['sys_newsletter_contacts'],
      },
    });
  });

  it('opens the send-now pre-flight showing the title and PDF, then sends', () => {
    render(<NewsletterDetail campaign={campaign()} caps={caps} onDeleted={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /send now/i }));
    expect(screen.getByText('Send this newsletter now?')).toBeTruthy();
    // The pre-flight names the PDF (the stored-file card above shows it too).
    expect(screen.getAllByText('x.pdf').length).toBeGreaterThanOrEqual(2);
    fireEvent.click(screen.getByRole('button', { name: /send to/i }));
    expect(hooks.sendNow.mutate).toHaveBeenCalledWith('c1');
  });

  it('offers stop while sending and confirms it', () => {
    render(
      <NewsletterDetail
        campaign={campaign({
          status: 'sending',
          recipientCount: 100,
          sentCount: 40,
          processedCount: 40,
          progressPercent: 40,
        })}
        caps={caps}
        onDeleted={vi.fn()}
      />,
    );
    expect(screen.queryByRole('button', { name: /send now/i })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /stop sending/i }));
    expect(screen.getByText('Stop sending?')).toBeTruthy();
    fireEvent.click(screen.getAllByRole('button', { name: /stop sending/i }).at(-1)!);
    expect(hooks.cancel.mutate).toHaveBeenCalledWith('c1');
  });

  it('shows the provider fault and a retry when delivery stopped', () => {
    render(
      <NewsletterDetail
        campaign={campaign({
          status: 'paused',
          recipientCount: 100,
          lastError: 'Paused — the email provider rejected the sender: not verified',
        })}
        caps={caps}
        onDeleted={vi.fn()}
      />,
    );
    expect(screen.getByText('Delivery stopped')).toBeTruthy();
    expect(screen.getByText(/not verified/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /retry delivery/i }));
    expect(hooks.resume.mutate).toHaveBeenCalledWith('c1');
  });

  it('shows delivered / failed / read tiles once finished', () => {
    hooks.stats.data = {
      campaignId: 'c1',
      recipientCount: 200,
      sentCount: 198,
      failedCount: 2,
      pendingCount: 0,
      readCount: 60,
      readRate: 30.3,
    };
    render(
      <NewsletterDetail
        campaign={campaign({
          status: 'finished',
          recipientCount: 200,
          sentCount: 198,
          failedCount: 2,
          completedAt: '2026-09-05T10:00:00.000Z',
        })}
        caps={caps}
        onDeleted={vi.fn()}
      />,
    );
    // "Delivered" appears both as a tile and as a recipients filter chip.
    expect(screen.getAllByText('Delivered').length).toBeGreaterThanOrEqual(1);
    // 198 is the tile and the "Delivered" recipients chip count.
    expect(screen.getAllByText('198').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('60')).toBeTruthy();
    expect(screen.getByText('30.3%')).toBeTruthy();
    expect(screen.getByText('What went out')).toBeTruthy();
  });

  it('hides mutations from an admin without the capability', () => {
    render(
      <NewsletterDetail
        campaign={campaign()}
        caps={{ create: false, send: false, delete: false }}
        onDeleted={vi.fn()}
      />,
    );
    expect(screen.queryByRole('button', { name: /send now/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /save changes/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /delete newsletter/i })).toBeNull();
  });
});
