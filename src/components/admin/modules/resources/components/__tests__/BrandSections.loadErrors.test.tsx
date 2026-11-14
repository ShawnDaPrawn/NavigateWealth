/**
 * Corporate identity: with the brand API failing, each section shows the
 * shared error state ("Unable to load …", Try again), never its empty state.
 */
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

vi.mock('@/utils/api/client', () => ({
  api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));

const brand = vi.hoisted(() => ({
  getLogos: vi.fn(),
  getColourPalette: vi.fn(),
  getTypography: vi.fn(),
  getCollateral: vi.fn(),
  getGuidelines: vi.fn(),
}));

vi.mock('../brand-api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../brand-api')>();
  return { ...actual, brandApi: { ...actual.brandApi, ...brand } };
});

import { LogosSection } from '../LogosSection';
import { ColoursSection } from '../ColoursSection';
import { TypographySection } from '../TypographySection';
import { CollateralSection } from '../CollateralSection';
import { GuidelinesSection } from '../GuidelinesSection';

const failure = () => Promise.reject(new Error('Request failed (400)'));

describe('Corporate identity sections — failed loads', () => {
  it.each([
    ['Logos', LogosSection, 'getLogos', 'Unable to load logos'],
    ['Colours', ColoursSection, 'getColourPalette', 'Unable to load brand colours'],
    ['Typography', TypographySection, 'getTypography', 'Unable to load typography'],
    ['Collateral', CollateralSection, 'getCollateral', 'Unable to load collateral'],
    ['Guidelines', GuidelinesSection, 'getGuidelines', 'Unable to load brand guidelines'],
  ] as const)('%s shows the error state and retries', async (_name, Section, loader, title) => {
    brand[loader].mockImplementation(failure);
    render(<Section onUpdate={vi.fn()} />);
    expect(await screen.findByText(title)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Try again/ }));
    await waitFor(() => expect(brand[loader]).toHaveBeenCalledTimes(2));
  });

  it('Colours: a successful empty palette still shows its empty state', async () => {
    brand.getColourPalette.mockResolvedValue({ swatches: [], updatedAt: '', updatedBy: '' });
    render(<ColoursSection onUpdate={vi.fn()} />);
    expect(await screen.findByText('No colours defined yet')).toBeTruthy();
  });
});
