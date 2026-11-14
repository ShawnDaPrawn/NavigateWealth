/**
 * Partner advertisers: list, add (validated centred dialog), edit, remove
 * (confirm), copy the referral link, and "—" for untracked clicks.
 */
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

const api = vi.hoisted(() => ({
  list: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  remove: vi.fn(),
}));
vi.mock('../../api', () => ({ partnersApi: api }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { toast } from 'sonner';
import { PartnersPanel } from '../PartnersPanel';
import { suggestReferralCode, validatePartner, EMPTY_PARTNER } from '../partnersModel';

const PARTNER = {
  id: 'p1',
  name: 'Pretoria Property Group',
  contactName: 'Thandi',
  contactEmail: 'thandi@ppg.co.za',
  website: 'https://ppg.co.za',
  referralCode: 'ppg',
  referralLink:
    'https://www.navigatewealth.co/?utm_source=partner&utm_medium=referral&utm_campaign=partners&utm_content=ppg',
  status: 'active' as const,
  notes: '',
  createdAt: '2026-11-01T00:00:00Z',
  updatedAt: '2026-11-01T00:00:00Z',
};

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

function openMenu(name: RegExp) {
  fireEvent.pointerDown(screen.getByRole('button', { name }), {
    button: 0,
    ctrlKey: false,
    pointerType: 'mouse',
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  api.list.mockResolvedValue([PARTNER]);
  api.create.mockImplementation(async (input) => ({ ...PARTNER, ...input, id: 'p2' }));
  api.update.mockImplementation(async (id, input) => ({ ...PARTNER, ...input, id }));
  api.remove.mockResolvedValue(undefined);
});

describe('PartnersPanel', () => {
  it('lists partners with their referral link and "—" for clicks, with a tracking notice', async () => {
    render(<PartnersPanel />, { wrapper });
    expect(await screen.findByText('Pretoria Property Group')).toBeDefined();
    expect(screen.getByText(PARTNER.referralLink)).toBeDefined();
    expect(screen.getByText('—')).toBeDefined();
    expect(screen.getByText(/tracking starts when a partner’s link is used/)).toBeDefined();
  });

  it('copies the referral link', async () => {
    const writeText = vi.fn(async () => undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    render(<PartnersPanel />, { wrapper });
    fireEvent.click(await screen.findByRole('button', { name: /copy referral link/i }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(PARTNER.referralLink));
    expect(toast.success).toHaveBeenCalled();
  });

  it('validates the add dialog, then saves', async () => {
    api.list.mockResolvedValue([]);
    render(<PartnersPanel />, { wrapper });
    fireEvent.click((await screen.findAllByRole('button', { name: /add partner/i }))[0]);
    const dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText('Contact email'), {
      target: { value: 'nope' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Add partner' }));
    expect(await within(dialog).findByText(/Fix 3 fields to add the partner/)).toBeDefined();
    expect(document.activeElement).toBe(within(dialog).getByLabelText('Partner name *'));
    expect(api.create).not.toHaveBeenCalled();

    fireEvent.change(within(dialog).getByLabelText('Partner name *'), {
      target: { value: 'Karoo Wine Estates' },
    });
    fireEvent.change(within(dialog).getByLabelText('Contact email'), {
      target: { value: 'hello@karoo.co.za' },
    });
    // The code follows the name until it is typed by hand.
    expect((within(dialog).getByLabelText('Referral code *') as HTMLInputElement).value).toBe(
      'karoo-wine-estates',
    );
    fireEvent.click(within(dialog).getByRole('button', { name: 'Add partner' }));
    await waitFor(() =>
      expect(api.create).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Karoo Wine Estates', referralCode: 'karoo-wine-estates' }),
      ),
    );
  });

  it('edits from the more menu', async () => {
    render(<PartnersPanel />, { wrapper });
    await screen.findByText('Pretoria Property Group');
    openMenu(/more options for pretoria/i);
    fireEvent.click(await screen.findByRole('menuitem', { name: /edit/i }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByRole('heading', { name: 'Edit partner' })).toBeDefined();
    fireEvent.change(within(dialog).getByLabelText('Notes'), { target: { value: 'Renewed' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save partner' }));
    await waitFor(() =>
      expect(api.update).toHaveBeenCalledWith('p1', expect.objectContaining({ notes: 'Renewed' })),
    );
  });

  it('confirms before removing', async () => {
    render(<PartnersPanel />, { wrapper });
    await screen.findByText('Pretoria Property Group');
    openMenu(/more options for pretoria/i);
    fireEvent.click(await screen.findByRole('menuitem', { name: /remove/i }));
    expect(await screen.findByText('Remove Pretoria Property Group?')).toBeDefined();
    expect(api.remove).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Remove' }));
    await waitFor(() => expect(api.remove).toHaveBeenCalledWith('p1'));
  });
});

describe('partners model', () => {
  it('suggests a referral code from the name', () => {
    expect(suggestReferralCode('Pretoria Property Group!')).toBe('pretoria-property-group');
  });

  it('refuses a referral code another partner uses', () => {
    const errors = validatePartner({ ...EMPTY_PARTNER, name: 'X', referralCode: 'ppg' }, [PARTNER]);
    expect(errors.referralCode).toMatch(/already uses/);
  });
});
