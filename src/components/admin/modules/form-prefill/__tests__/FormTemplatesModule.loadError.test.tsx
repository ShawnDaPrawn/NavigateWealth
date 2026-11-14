/** Form Mapping Studio: a failed template load is an error, not "No templates uploaded yet". */
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';

const listFormTemplates = vi.hoisted(() => vi.fn());
vi.mock('../../../../../services/form-prefill-api', () => ({
  listFormTemplates,
  fillFormTemplate: vi.fn(),
  previewTemplatePrefill: vi.fn(),
  updateTemplateMappings: vi.fn(),
  uploadFormTemplate: vi.fn(),
}));
vi.mock('../../../../../utils/api', () => ({ api: { get: vi.fn() } }));
vi.mock('../../../../shared/ClientPicker', () => ({ ClientPicker: () => null }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));

import { FormTemplatesModule } from '../FormTemplatesModule';

describe('FormTemplatesModule', () => {
  it('shows "Unable to load form templates" and retries', async () => {
    listFormTemplates.mockRejectedValue(new Error('Request failed (400)'));
    render(
      <MemoryRouter>
        <FormTemplatesModule />
      </MemoryRouter>,
    );
    expect(await screen.findByText('Unable to load form templates')).toBeTruthy();
    expect(screen.queryByText('No templates uploaded yet.')).toBeNull();

    listFormTemplates.mockResolvedValue([]);
    fireEvent.click(screen.getByRole('button', { name: /Try again/ }));
    await waitFor(() => expect(screen.getByText('No templates uploaded yet.')).toBeTruthy());
  });
});
