import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { KBEntry } from '../../types';

vi.mock('../../hooks', () => ({
  useAgents: () => ({
    data: [
      { id: 'vasco-public', name: 'Vasco (Public)' },
      { id: 'vasco-authenticated', name: 'Vasco (Portal)' },
    ],
  }),
}));

import { KBEntryModal } from '../KBEntryModal';

const existing: KBEntry = {
  id: 'kb-1',
  title: 'Office hours',
  type: 'snippet',
  status: 'draft',
  content: 'We are open 8 to 5.',
  category: 'Company Info',
  tags: ['hours'],
  agentScope: ['vasco-authenticated'],
  priority: 8,
  createdBy: 'admin',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

describe('KBEntryModal', () => {
  it('defaults a new entry to Live, Normal importance and "Save and make live"', async () => {
    const onSubmit = vi.fn();
    render(
      <KBEntryModal
        open
        onOpenChange={vi.fn()}
        entry={null}
        onSubmit={onSubmit}
        isSubmitting={false}
      />,
    );

    expect(screen.getByRole('radio', { name: /^Live/ }).getAttribute('aria-checked')).toBe('true');
    expect(screen.getByRole('radio', { name: /^Normal/ }).getAttribute('aria-checked')).toBe(
      'true',
    );

    fireEvent.change(screen.getByLabelText('Title'), { target: { value: '  TFSA limit  ' } });
    fireEvent.change(screen.getByLabelText('Content'), { target: { value: 'R36,000 a year.' } });
    fireEvent.click(screen.getByRole('button', { name: /save and make live/i }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'TFSA limit',
        type: 'article',
        content: 'R36,000 a year.',
        status: 'active',
        priority: 5,
        agentScope: 'all',
        tags: [],
      }),
    );
  });

  it('validates the title and content in plain words instead of submitting', async () => {
    const onSubmit = vi.fn();
    render(
      <KBEntryModal
        open
        onOpenChange={vi.fn()}
        entry={null}
        onSubmit={onSubmit}
        isSubmitting={false}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /save and make live/i }));

    await waitFor(() => expect(screen.getByText('Give the entry a title')).toBeDefined());
    expect(screen.getByText('Add the content Vasco should know')).toBeDefined();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('switching to Draft changes the button to "Save as draft"', () => {
    render(
      <KBEntryModal
        open
        onOpenChange={vi.fn()}
        entry={null}
        onSubmit={vi.fn()}
        isSubmitting={false}
      />,
    );
    fireEvent.click(screen.getByRole('radio', { name: /^Draft/ }));
    expect(screen.getByRole('button', { name: /save as draft/i })).toBeDefined();
  });

  it('maps importance to the stored priority', async () => {
    const onSubmit = vi.fn();
    render(
      <KBEntryModal
        open
        onOpenChange={vi.fn()}
        entry={null}
        onSubmit={onSubmit}
        isSubmitting={false}
      />,
    );

    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Fees' } });
    fireEvent.change(screen.getByLabelText('Content'), { target: { value: 'Our fee is 1%.' } });
    fireEvent.click(screen.getByRole('radio', { name: /^Essential/ }));
    fireEvent.click(screen.getByRole('button', { name: /save and make live/i }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    expect(onSubmit.mock.calls[0][0].priority).toBe(10);
  });

  it('loads an existing entry, including importance and assistant scope, and opens More options', async () => {
    const onSubmit = vi.fn();
    render(
      <KBEntryModal
        open
        onOpenChange={vi.fn()}
        entry={existing}
        onSubmit={onSubmit}
        isSubmitting={false}
      />,
    );

    await waitFor(() =>
      expect((screen.getByLabelText('Title') as HTMLInputElement).value).toBe('Office hours'),
    );
    expect(screen.getByRole('radio', { name: /^High/ }).getAttribute('aria-checked')).toBe('true');
    expect(screen.getByRole('radio', { name: /^Draft/ }).getAttribute('aria-checked')).toBe('true');

    // Scoped entries reveal the assistants section automatically.
    expect(
      screen.getByRole('button', { name: 'Vasco (Portal)' }).getAttribute('aria-pressed'),
    ).toBe('true');
    expect((screen.getByLabelText('Tags') as HTMLInputElement).value).toBe('hours');

    fireEvent.click(screen.getByRole('button', { name: /save changes/i }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    expect(onSubmit.mock.calls[0][0]).toMatchObject({
      title: 'Office hours',
      status: 'draft',
      priority: 8,
      agentScope: ['vasco-authenticated'],
      tags: ['hours'],
    });
  });

  it('deselecting the last assistant falls back to all assistants', async () => {
    render(
      <KBEntryModal
        open
        onOpenChange={vi.fn()}
        entry={existing}
        onSubmit={vi.fn()}
        isSubmitting={false}
      />,
    );
    await waitFor(() => screen.getByRole('button', { name: 'Vasco (Portal)' }));

    fireEvent.click(screen.getByRole('button', { name: 'Vasco (Portal)' }));
    expect(
      screen.getByRole('button', { name: 'All assistants' }).getAttribute('aria-pressed'),
    ).toBe('true');
  });

  it('shows a Q&A form with its own validation when the format is Q&A', async () => {
    const qa: KBEntry = { ...existing, type: 'qa', question: '', answer: '', content: '' };
    const onSubmit = vi.fn();
    render(
      <KBEntryModal
        open
        onOpenChange={vi.fn()}
        entry={qa}
        onSubmit={onSubmit}
        isSubmitting={false}
      />,
    );

    await waitFor(() => screen.getByLabelText('Question'));
    fireEvent.click(screen.getByRole('button', { name: /save changes/i }));

    await waitFor(() => expect(screen.getByText('Add the question people ask')).toBeDefined());
    expect(screen.getByText('Add the answer Vasco should give')).toBeDefined();
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
