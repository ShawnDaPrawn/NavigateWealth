import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ClientFNAHub } from '@/components/client/fna-intake/ClientFNAHub';

describe('ClientFNAHub error UX', () => {
  it('shows retry when batch status failed to load', () => {
    const onRetry = vi.fn();
    render(
      <ClientFNAHub
        clientId="client-1"
        fnaType="tax"
        statusError="Batch FNA status response was unsuccessful"
        onRetryStatus={onRetry}
      />,
    );

    expect(screen.getByText(/could not load your needs analysis status/i)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /retry/i }));
    expect(onRetry).toHaveBeenCalled();
  });
});
