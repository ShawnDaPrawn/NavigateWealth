import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ClientFNAIntakeWizard } from '@/components/client/fna-intake/ClientFNAIntakeWizard';

vi.mock('@/services/fna-intake-api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/services/fna-intake-api')>();
  return {
    ...actual,
    getIntakeDraft: vi.fn().mockResolvedValue({
      id: 'sess-1',
      clientId: 'client-1',
      domain: 'tax',
      status: 'submitted',
      inputs: { age: 40 },
      progressPercent: 80,
      createdAt: '2026-05-01T00:00:00.000Z',
      updatedAt: '2026-05-01T00:00:00.000Z',
      intakeSource: 'client',
    }),
    saveIntakeDraft: vi.fn(),
    submitIntakeSession: vi.fn(),
  };
});

function renderWizard() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <ClientFNAIntakeWizard clientId="client-1" domain="tax" readOnly />
    </QueryClientProvider>,
  );
}

describe('ClientFNAIntakeWizard read-only', () => {
  it('shows read-only review when session is submitted', async () => {
    renderWizard();

    expect(await screen.findByText('Tax planning discovery')).toBeTruthy();
    expect(screen.getByText('40')).toBeTruthy();
  });
});
