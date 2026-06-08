/**
 * Tests for useEntityCrud hook.
 *
 * useEntityCrud is a pure state hook — no network, no React-Query.
 * We test all CRUD handlers, edit-mode tracking, delete confirmation,
 * validation on save, and the isItemEmpty / onCleanup callbacks.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useEntityCrud } from '../useEntityCrud';
import type { EntityCrudConfig } from '../useEntityCrud';
import type { ProfileData, BankAccount, Asset } from '../../types';

// ── Mock sonner toast (used in save validation) ───────────────────────────────

const mockToastError = vi.fn();
const mockToastSuccess = vi.fn();

vi.mock('sonner', () => ({
  toast: {
    error: (...args: unknown[]) => mockToastError(...args),
    success: (...args: unknown[]) => mockToastSuccess(...args),
  },
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Minimal ProfileData that only carries the array key we care about. */
function makeProfileData<T>(arrayKey: keyof ProfileData, items: T[]): ProfileData {
  return { [arrayKey]: items } as unknown as ProfileData;
}

function makeBankAccount(overrides: Partial<BankAccount> = {}): BankAccount {
  return {
    id: 'ba-1',
    accountHolderName: 'Alice',
    bankName: 'FNB',
    accountNumber: '123456789',
    accountType: 'Cheque',
    branchCode: '250655',
    isPrimary: false,
    ...overrides,
  };
}

function makeAsset(overrides: Partial<Asset> = {}): Asset {
  return {
    id: 'asset-1',
    type: 'property',
    name: 'My house',
    description: '',
    value: 1_000_000,
    ownershipType: 'sole',
    provider: '',
    ...overrides,
  };
}

// ── BankAccount config ────────────────────────────────────────────────────────

function makeBankAccountConfig(
  overrides: Partial<EntityCrudConfig<BankAccount>> = {},
): EntityCrudConfig<BankAccount> {
  return {
    arrayKey: 'bankAccounts',
    createItem: () => makeBankAccount({ id: `ba-${Date.now()}-${Math.random()}` }),
    ...overrides,
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
});

describe('useEntityCrud — initial state', () => {
  it('starts with empty inEditMode set', () => {
    const items: BankAccount[] = [];
    const setProfileData = vi.fn();
    const { result } = renderHook(() =>
      useEntityCrud(items, setProfileData, makeBankAccountConfig()),
    );
    expect(result.current.inEditMode.size).toBe(0);
  });

  it('starts with itemToDelete as null', () => {
    const items: BankAccount[] = [];
    const setProfileData = vi.fn();
    const { result } = renderHook(() =>
      useEntityCrud(items, setProfileData, makeBankAccountConfig()),
    );
    expect(result.current.itemToDelete).toBeNull();
  });
});

describe('useEntityCrud — add', () => {
  it('calls setProfileData to append a new item', () => {
    const items: BankAccount[] = [];
    const setProfileData = vi.fn();
    const { result } = renderHook(() =>
      useEntityCrud(items, setProfileData, makeBankAccountConfig()),
    );

    act(() => {
      result.current.add();
    });

    expect(setProfileData).toHaveBeenCalledTimes(1);
    const updater = setProfileData.mock.calls[0][0] as (prev: ProfileData) => ProfileData;
    const prevData = makeProfileData<BankAccount>('bankAccounts', []);
    const newData = updater(prevData);
    expect((newData.bankAccounts as BankAccount[]).length).toBe(1);
  });

  it('places the new item into edit mode', () => {
    const items: BankAccount[] = [];
    const setProfileData = vi.fn((updater: (p: ProfileData) => ProfileData) => {
      // simulate the state update so we can inspect inEditMode
      updater(makeProfileData<BankAccount>('bankAccounts', []));
    });

    const { result } = renderHook(() =>
      useEntityCrud(items, setProfileData as never, makeBankAccountConfig()),
    );

    act(() => {
      result.current.add();
    });

    // The new item id should be in edit mode
    expect(result.current.inEditMode.size).toBe(1);
  });
});

describe('useEntityCrud — update', () => {
  it('calls setProfileData with the patched item', () => {
    const account = makeBankAccount({ id: 'ba-1' });
    const items = [account];
    const setProfileData = vi.fn();

    const { result } = renderHook(() =>
      useEntityCrud(items, setProfileData, makeBankAccountConfig()),
    );

    act(() => {
      result.current.update('ba-1', { accountHolderName: 'Bob' });
    });

    expect(setProfileData).toHaveBeenCalledTimes(1);
    const updater = setProfileData.mock.calls[0][0] as (prev: ProfileData) => ProfileData;
    const prevData = makeProfileData<BankAccount>('bankAccounts', items);
    const newData = updater(prevData);
    const updated = (newData.bankAccounts as BankAccount[]).find((a) => a.id === 'ba-1');
    expect(updated?.accountHolderName).toBe('Bob');
  });

  it('does not mutate other items', () => {
    const a1 = makeBankAccount({ id: 'ba-1', accountHolderName: 'Alice' });
    const a2 = makeBankAccount({ id: 'ba-2', accountHolderName: 'Carol' });
    const setProfileData = vi.fn();

    const { result } = renderHook(() =>
      useEntityCrud([a1, a2], setProfileData, makeBankAccountConfig()),
    );

    act(() => {
      result.current.update('ba-1', { accountHolderName: 'Bob' });
    });

    const updater = setProfileData.mock.calls[0][0] as (prev: ProfileData) => ProfileData;
    const newData = updater(makeProfileData<BankAccount>('bankAccounts', [a1, a2]));
    const carol = (newData.bankAccounts as BankAccount[]).find((a) => a.id === 'ba-2');
    expect(carol?.accountHolderName).toBe('Carol');
  });
});

describe('useEntityCrud — edit', () => {
  it('places item into edit mode', () => {
    const items = [makeBankAccount({ id: 'ba-1' })];
    const setProfileData = vi.fn();

    const { result } = renderHook(() =>
      useEntityCrud(items, setProfileData, makeBankAccountConfig()),
    );

    act(() => {
      result.current.edit('ba-1');
    });

    expect(result.current.inEditMode.has('ba-1')).toBe(true);
  });
});

describe('useEntityCrud — save (no validation)', () => {
  it('removes item from edit mode', () => {
    const items = [makeBankAccount({ id: 'ba-1' })];
    const setProfileData = vi.fn();

    const { result } = renderHook(() =>
      useEntityCrud(items, setProfileData, makeBankAccountConfig()),
    );

    act(() => {
      result.current.edit('ba-1');
    });
    act(() => {
      result.current.save('ba-1');
    });

    expect(result.current.inEditMode.has('ba-1')).toBe(false);
  });

  it('calls onCleanup with the saved id', () => {
    const onCleanup = vi.fn();
    const items = [makeBankAccount({ id: 'ba-1' })];
    const setProfileData = vi.fn();

    const { result } = renderHook(() =>
      useEntityCrud(items, setProfileData, makeBankAccountConfig({ onCleanup })),
    );

    act(() => {
      result.current.edit('ba-1');
    });
    act(() => {
      result.current.save('ba-1');
    });

    expect(onCleanup).toHaveBeenCalledWith('ba-1');
  });
});

describe('useEntityCrud — save with validation', () => {
  it('blocks save and shows toast.error when validation fails', () => {
    const validateItem = (_item: BankAccount) => 'Account number is required';
    const account = makeBankAccount({ id: 'ba-1', accountNumber: '' });
    const items = [account];
    const setProfileData = vi.fn();

    const { result } = renderHook(() =>
      useEntityCrud(items, setProfileData, makeBankAccountConfig({ validateItem })),
    );

    act(() => {
      result.current.edit('ba-1');
    });
    act(() => {
      result.current.save('ba-1');
    });

    // Should remain in edit mode
    expect(result.current.inEditMode.has('ba-1')).toBe(true);
    expect(mockToastError).toHaveBeenCalledWith('Account number is required');
  });

  it('saves successfully when validateItem returns null', () => {
    const validateItem = (_item: BankAccount) => null;
    const account = makeBankAccount({ id: 'ba-1' });
    const items = [account];
    const setProfileData = vi.fn();

    const { result } = renderHook(() =>
      useEntityCrud(items, setProfileData, makeBankAccountConfig({ validateItem })),
    );

    act(() => {
      result.current.edit('ba-1');
    });
    act(() => {
      result.current.save('ba-1');
    });

    expect(result.current.inEditMode.has('ba-1')).toBe(false);
    expect(mockToastError).not.toHaveBeenCalled();
  });
});

describe('useEntityCrud — cancelEdit', () => {
  it('removes item from edit mode', () => {
    const items = [makeBankAccount({ id: 'ba-1' })];
    const setProfileData = vi.fn();

    const { result } = renderHook(() =>
      useEntityCrud(items, setProfileData, makeBankAccountConfig()),
    );

    act(() => {
      result.current.edit('ba-1');
    });
    act(() => {
      result.current.cancelEdit('ba-1');
    });

    expect(result.current.inEditMode.has('ba-1')).toBe(false);
  });

  it('auto-removes a blank item when isItemEmpty returns true', () => {
    const isItemEmpty = (item: BankAccount) => !item.accountNumber;
    const emptyAccount = makeBankAccount({ id: 'ba-1', accountNumber: '' });
    const items = [emptyAccount];
    const setProfileData = vi.fn();

    const { result } = renderHook(() =>
      useEntityCrud(items, setProfileData, makeBankAccountConfig({ isItemEmpty })),
    );

    act(() => {
      result.current.edit('ba-1');
    });
    act(() => {
      result.current.cancelEdit('ba-1');
    });

    expect(setProfileData).toHaveBeenCalledTimes(1);
    const updater = setProfileData.mock.calls[0][0] as (prev: ProfileData) => ProfileData;
    const prevData = makeProfileData<BankAccount>('bankAccounts', [emptyAccount]);
    const newData = updater(prevData);
    expect((newData.bankAccounts as BankAccount[]).length).toBe(0);
  });

  it('does NOT remove a non-empty item when isItemEmpty returns false', () => {
    const isItemEmpty = (item: BankAccount) => !item.accountNumber;
    const filledAccount = makeBankAccount({ id: 'ba-1', accountNumber: '123456789' });
    const items = [filledAccount];
    const setProfileData = vi.fn();

    const { result } = renderHook(() =>
      useEntityCrud(items, setProfileData, makeBankAccountConfig({ isItemEmpty })),
    );

    act(() => {
      result.current.edit('ba-1');
    });
    act(() => {
      result.current.cancelEdit('ba-1');
    });

    // setProfileData should NOT have been called for a non-empty item
    expect(setProfileData).not.toHaveBeenCalled();
  });

  it('calls onCleanup', () => {
    const onCleanup = vi.fn();
    const items = [makeBankAccount({ id: 'ba-1' })];
    const setProfileData = vi.fn();

    const { result } = renderHook(() =>
      useEntityCrud(items, setProfileData, makeBankAccountConfig({ onCleanup })),
    );

    act(() => {
      result.current.edit('ba-1');
    });
    act(() => {
      result.current.cancelEdit('ba-1');
    });

    expect(onCleanup).toHaveBeenCalledWith('ba-1');
  });
});

describe('useEntityCrud — confirmDelete / remove', () => {
  it('confirmDelete sets itemToDelete', () => {
    const items = [makeBankAccount({ id: 'ba-1' })];
    const setProfileData = vi.fn();

    const { result } = renderHook(() =>
      useEntityCrud(items, setProfileData, makeBankAccountConfig()),
    );

    act(() => {
      result.current.confirmDelete('ba-1');
    });

    expect(result.current.itemToDelete).toBe('ba-1');
  });

  it('remove deletes the item from the array', () => {
    const account = makeBankAccount({ id: 'ba-1' });
    const items = [account];
    const setProfileData = vi.fn();

    const { result } = renderHook(() =>
      useEntityCrud(items, setProfileData, makeBankAccountConfig()),
    );

    act(() => {
      result.current.remove('ba-1');
    });

    expect(setProfileData).toHaveBeenCalledTimes(1);
    const updater = setProfileData.mock.calls[0][0] as (prev: ProfileData) => ProfileData;
    const newData = updater(makeProfileData<BankAccount>('bankAccounts', [account]));
    expect((newData.bankAccounts as BankAccount[]).length).toBe(0);
  });

  it('remove resets itemToDelete to null', () => {
    const account = makeBankAccount({ id: 'ba-1' });
    const items = [account];
    const setProfileData = vi.fn();

    const { result } = renderHook(() =>
      useEntityCrud(items, setProfileData, makeBankAccountConfig()),
    );

    act(() => {
      result.current.confirmDelete('ba-1');
    });
    act(() => {
      result.current.remove('ba-1');
    });

    expect(result.current.itemToDelete).toBeNull();
  });

  it('remove also clears the item from edit mode', () => {
    const account = makeBankAccount({ id: 'ba-1' });
    const items = [account];
    const setProfileData = vi.fn();

    const { result } = renderHook(() =>
      useEntityCrud(items, setProfileData, makeBankAccountConfig()),
    );

    act(() => {
      result.current.edit('ba-1');
    });
    act(() => {
      result.current.remove('ba-1');
    });

    expect(result.current.inEditMode.has('ba-1')).toBe(false);
  });

  it('remove calls onCleanup', () => {
    const onCleanup = vi.fn();
    const account = makeBankAccount({ id: 'ba-1' });
    const items = [account];
    const setProfileData = vi.fn();

    const { result } = renderHook(() =>
      useEntityCrud(items, setProfileData, makeBankAccountConfig({ onCleanup })),
    );

    act(() => {
      result.current.remove('ba-1');
    });

    expect(onCleanup).toHaveBeenCalledWith('ba-1');
  });
});

describe('useEntityCrud — resetEditMode', () => {
  it('clears all edit-mode entries and itemToDelete', () => {
    const a1 = makeBankAccount({ id: 'ba-1' });
    const a2 = makeBankAccount({ id: 'ba-2' });
    const items = [a1, a2];
    const setProfileData = vi.fn();

    const { result } = renderHook(() =>
      useEntityCrud(items, setProfileData, makeBankAccountConfig()),
    );

    act(() => {
      result.current.edit('ba-1');
      result.current.edit('ba-2');
      result.current.confirmDelete('ba-1');
    });

    act(() => {
      result.current.resetEditMode();
    });

    expect(result.current.inEditMode.size).toBe(0);
    expect(result.current.itemToDelete).toBeNull();
  });
});

describe('useEntityCrud — setItemToDelete', () => {
  it('exposes setItemToDelete for external AlertDialog binding', () => {
    const items: Asset[] = [];
    const setProfileData = vi.fn();
    const assetConfig: EntityCrudConfig<Asset> = {
      arrayKey: 'assets',
      createItem: () => makeAsset({ id: `asset-${Date.now()}` }),
    };

    const { result } = renderHook(() => useEntityCrud(items, setProfileData, assetConfig));

    act(() => {
      result.current.setItemToDelete('asset-99');
    });

    expect(result.current.itemToDelete).toBe('asset-99');
  });
});

describe('useEntityCrud — multiple edit modes', () => {
  it('can track multiple items in edit mode simultaneously', () => {
    const items = [
      makeBankAccount({ id: 'ba-1' }),
      makeBankAccount({ id: 'ba-2' }),
      makeBankAccount({ id: 'ba-3' }),
    ];
    const setProfileData = vi.fn();

    const { result } = renderHook(() =>
      useEntityCrud(items, setProfileData, makeBankAccountConfig()),
    );

    act(() => {
      result.current.edit('ba-1');
      result.current.edit('ba-3');
    });

    expect(result.current.inEditMode.has('ba-1')).toBe(true);
    expect(result.current.inEditMode.has('ba-2')).toBe(false);
    expect(result.current.inEditMode.has('ba-3')).toBe(true);
  });
});
