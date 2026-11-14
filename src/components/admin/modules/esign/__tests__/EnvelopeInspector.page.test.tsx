import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import type { EsignEnvelope } from '../types';

vi.mock('../api', () => ({
  esignApi: {
    getEnvelope: vi.fn(async () => null),
    getAuditTrail: vi.fn(async () => ({ events: [] })),
  },
}));
vi.mock('../components/ReminderSettingsPanel', () => ({ ReminderConfigPanel: () => null }));

import { EnvelopeInspector } from '../components/EnvelopeInspector';

afterEach(() => cleanup());

const envelope = {
  id: 'ENV-7F3A',
  title: 'Record of Advice — Risk',
  status: 'sent',
  signers: [],
  created_at: '2026-11-09T10:00:00Z',
} as unknown as EsignEnvelope;

describe('EnvelopeInspector as a page', () => {
  it('shows the envelope title as the page heading and a Back link', async () => {
    const onOpenChange = vi.fn();
    render(<EnvelopeInspector envelope={envelope} open onOpenChange={onOpenChange} />);
    expect(
      screen.getByRole('heading', { level: 1, name: 'Record of Advice — Risk' }),
    ).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Back to envelopes' }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('renders nothing when closed', () => {
    render(<EnvelopeInspector envelope={envelope} open={false} onOpenChange={vi.fn()} />);
    expect(screen.queryByRole('heading', { level: 1 })).toBeNull();
  });
});
