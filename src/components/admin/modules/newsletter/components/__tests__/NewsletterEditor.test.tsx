import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

const hooks = vi.hoisted(() => ({
  lists: {
    data: [
      {
        id: 'sys_newsletter_contacts',
        name: 'Newsletter Contacts',
        description: '',
        type: 'system',
        memberCount: 205,
        externalContactCount: 205,
        clientCount: 0,
      },
    ],
    isLoading: false,
  },
  create: { mutateAsync: vi.fn(async () => ({ id: 'new-1' })), isPending: false },
  upload: { mutateAsync: vi.fn(async () => ({ id: 'new-1' })), isPending: false },
}));

vi.mock('../../hooks/useNewsletterStudio', () => ({
  useStudioLists: () => hooks.lists,
  useCreateCampaign: () => hooks.create,
  useUploadCampaignPdf: () => hooks.upload,
}));

import { NewsletterEditor } from '../NewsletterEditor';

function fill(container: HTMLElement, withPdf = true) {
  fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'September issue' } });
  fireEvent.change(screen.getByLabelText('Description'), {
    target: { value: 'What mattered in September.' },
  });
  if (withPdf) {
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, {
      target: { files: [new File(['%PDF-1.4'], 'sept.pdf', { type: 'application/pdf' })] },
    });
  }
}

beforeEach(() => {
  vi.clearAllMocks();
  hooks.create.mutateAsync.mockResolvedValue({ id: 'new-1' });
  hooks.upload.mutateAsync.mockResolvedValue({ id: 'new-1' });
});

describe('NewsletterEditor', () => {
  it('needs a title, a description and an audience before it can save', () => {
    render(<NewsletterEditor onCreated={vi.fn()} onCancel={vi.fn()} />);
    const save = screen.getByRole('button', { name: /save draft/i }) as HTMLButtonElement;
    expect(save.disabled).toBe(true);
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'T' } });
    fireEvent.change(screen.getByLabelText('Description'), { target: { value: 'D' } });
    expect(save.disabled).toBe(false);
    fireEvent.click(screen.getByRole('checkbox', { name: 'Newsletter Contacts' }));
    expect(save.disabled).toBe(true);
  });

  it('creates the draft, uploads the PDF, then hands the id on', async () => {
    const onCreated = vi.fn();
    const { container } = render(<NewsletterEditor onCreated={onCreated} onCancel={vi.fn()} />);
    fill(container);
    expect(screen.getByText('sept.pdf')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /save draft/i }));

    await waitFor(() => expect(onCreated).toHaveBeenCalledWith('new-1'));
    expect(hooks.create.mutateAsync).toHaveBeenCalledWith({
      title: 'September issue',
      description: 'What mattered in September.',
      listIds: ['sys_newsletter_contacts'],
    });
    expect(hooks.upload.mutateAsync).toHaveBeenCalledWith({
      id: 'new-1',
      file: expect.objectContaining({ name: 'sept.pdf' }),
    });
  });

  it('keeps the draft and offers a retry when only the PDF upload fails', async () => {
    hooks.upload.mutateAsync.mockRejectedValueOnce(new Error('The file is not a PDF.'));
    const onCreated = vi.fn();
    const { container } = render(<NewsletterEditor onCreated={onCreated} onCancel={vi.fn()} />);
    fill(container);
    fireEvent.click(screen.getByRole('button', { name: /save draft/i }));

    await waitFor(() => expect(screen.getByRole('alert').textContent).toMatch(/not a PDF/));
    expect(onCreated).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /retry pdf upload/i })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /retry pdf upload/i }));
    await waitFor(() => expect(onCreated).toHaveBeenCalledWith('new-1'));
    // The draft was created once; only the upload ran twice.
    expect(hooks.create.mutateAsync).toHaveBeenCalledTimes(1);
    expect(hooks.upload.mutateAsync).toHaveBeenCalledTimes(2);
  });

  it('can save a draft without a PDF', async () => {
    const onCreated = vi.fn();
    const { container } = render(<NewsletterEditor onCreated={onCreated} onCancel={vi.fn()} />);
    fill(container, false);
    fireEvent.click(screen.getByRole('button', { name: /save draft/i }));
    await waitFor(() => expect(onCreated).toHaveBeenCalledWith('new-1'));
    expect(hooks.upload.mutateAsync).not.toHaveBeenCalled();
  });
});
