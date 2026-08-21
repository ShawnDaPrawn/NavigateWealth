import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { KbaVerificationStep } from '../KbaVerificationStep';
import type { SignerSessionData } from '../types';

const sessionData = {
  envelope_id: 'env-1',
  envelope_title: 'Investment Mandate',
  signer_id: 'signer-1',
  signer_name: 'Test Signer',
  signer_email: 'signer@example.com',
  signer_status: 'pending',
  otp_required: false,
  challenge_required: true,
  missing_factors: ['kba'],
  document_url: '',
  page_count: 1,
  fields: [],
} satisfies SignerSessionData;

describe('KbaVerificationStep', () => {
  it('submits the identity number and advances only after a passed result', async () => {
    const verifyKba = vi.fn().mockResolvedValue({ success: true, status: 'passed' });
    const onVerified = vi.fn();
    render(
      <KbaVerificationStep
        token="signer-token"
        sessionData={sessionData}
        verifyKba={verifyKba}
        onVerified={onVerified}
      />,
    );

    fireEvent.change(screen.getByLabelText(/south african id/i), {
      target: { value: '9001015009087' },
    });
    fireEvent.click(screen.getByRole('button', { name: /verify identity/i }));

    await waitFor(() => {
      expect(verifyKba).toHaveBeenCalledWith('signer-token', '9001015009087');
      expect(onVerified).toHaveBeenCalledTimes(1);
    });
  });

  it('does not bypass an unavailable or skipped provider', async () => {
    const verifyKba = vi.fn().mockResolvedValue({ success: true, status: 'skipped' });
    const onVerified = vi.fn();
    render(
      <KbaVerificationStep
        token="signer-token"
        sessionData={sessionData}
        verifyKba={verifyKba}
        onVerified={onVerified}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /verify identity/i }));

    expect(
      await screen.findByText(/identity verification is not currently available/i),
    ).toBeTruthy();
    expect(onVerified).not.toHaveBeenCalled();
  });
});
