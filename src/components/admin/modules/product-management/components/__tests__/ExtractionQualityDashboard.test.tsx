/** Extraction quality: a failed load shows the shared error state with Try again. */
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

const get = vi.hoisted(() => vi.fn());
vi.mock('../../../../../../utils/api', () => ({ api: { get } }));

import { ExtractionQualityDashboard } from '../ExtractionQualityDashboard';

describe('ExtractionQualityDashboard', () => {
  it('shows "Unable to load extraction quality" and retries', async () => {
    get.mockRejectedValue(new Error('Request failed (400)'));
    render(<ExtractionQualityDashboard />);
    expect(await screen.findByText('Unable to load extraction quality')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Try again/ }));
    await waitFor(() => expect(get).toHaveBeenCalledTimes(2));
  });
});
