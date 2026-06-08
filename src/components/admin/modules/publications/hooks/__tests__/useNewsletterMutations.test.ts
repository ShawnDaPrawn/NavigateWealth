/**
 * Tests for newsletter mutation hooks.
 *
 * Strategy: mock @tanstack/react-query's useMutation and useQueryClient so we
 * can inspect the options object passed in without needing a QueryClientProvider
 * or live network. Each test sets up mockImplementationOnce BEFORE calling the
 * hook, then inspects the captured options.
 *
 * NOTE: paths from __tests__/ need one extra ../ compared to the source file.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ──────────────────────────────────────────────────────────────────────

const mockInvalidateQueries = vi.fn();
const mockQueryClient = {
  invalidateQueries: (...args: unknown[]) => mockInvalidateQueries(...args),
};

const mockUseMutation = vi.fn();

vi.mock('@tanstack/react-query', () => ({
  useMutation: (...args: unknown[]) => mockUseMutation(...args),
  useQueryClient: () => mockQueryClient,
}));

const mockToastSuccess = vi.fn();
const mockToastInfo = vi.fn();
const mockToastError = vi.fn();

vi.mock('sonner', () => ({
  toast: {
    success: (...args: unknown[]) => mockToastSuccess(...args),
    info: (...args: unknown[]) => mockToastInfo(...args),
    error: (...args: unknown[]) => mockToastError(...args),
  },
}));

const mockAddSubscriber = vi.fn();
const mockBulkAdd = vi.fn();
const mockRemoveSubscriber = vi.fn();
const mockResubscribe = vi.fn();
const mockUpdateSubscriber = vi.fn();

vi.mock('../../api', () => ({
  NewsletterAPI: {
    addSubscriber: (...args: unknown[]) => mockAddSubscriber(...args),
    bulkAdd: (...args: unknown[]) => mockBulkAdd(...args),
    removeSubscriber: (...args: unknown[]) => mockRemoveSubscriber(...args),
    resubscribe: (...args: unknown[]) => mockResubscribe(...args),
    updateSubscriber: (...args: unknown[]) => mockUpdateSubscriber(...args),
  },
}));

vi.mock('../queryKeys', () => ({
  newsletterKeys: {
    all: ['newsletter'],
    subscribers: () => ['newsletter', 'subscribers'],
  },
}));

// ── Imports (after mocks) ─────────────────────────────────────────────────────

import {
  useAddSubscriber,
  useBulkUpload,
  useRemoveSubscriber,
  useResubscribe,
  useUpdateSubscriber,
} from '../useNewsletterMutations';
import { newsletterKeys } from '../queryKeys';

// ── Types ─────────────────────────────────────────────────────────────────────

interface MutationOptions {
  mutationFn: (input: unknown) => Promise<unknown>;
  onSuccess: (data: unknown, variables: unknown) => void;
  onError: (error: Error) => void;
}

// ── Helper ────────────────────────────────────────────────────────────────────

/** Set up capture BEFORE calling the hook, then call the hook, return captured opts. */
function setupCapture(): { getOpts: () => MutationOptions } {
  let captured: MutationOptions | undefined;
  mockUseMutation.mockImplementationOnce((opts: unknown) => {
    captured = opts as MutationOptions;
    return {};
  });
  return {
    getOpts: () => {
      if (!captured) throw new Error('Hook was not called yet');
      return captured;
    },
  };
}

// ── useAddSubscriber ──────────────────────────────────────────────────────────

describe('useAddSubscriber', () => {
  beforeEach(() => vi.clearAllMocks());

  it('mutationFn delegates to NewsletterAPI.addSubscriber', async () => {
    const response = { alreadySubscribed: false, message: 'Subscribed!' };
    mockAddSubscriber.mockResolvedValue(response);

    const { getOpts } = setupCapture();
    useAddSubscriber();
    const opts = getOpts();

    const input = { email: 'a@b.com', firstName: 'A', surname: 'B' };
    const result = await opts.mutationFn(input);
    expect(result).toEqual(response);
    expect(mockAddSubscriber).toHaveBeenCalledWith(input);
  });

  it('onSuccess shows toast.success when not already subscribed', () => {
    const { getOpts } = setupCapture();
    useAddSubscriber();
    const opts = getOpts();

    opts.onSuccess({ alreadySubscribed: false, message: 'Subscribed!' }, undefined);
    expect(mockToastSuccess).toHaveBeenCalledWith('Subscribed!');
    expect(mockToastInfo).not.toHaveBeenCalled();
  });

  it('onSuccess shows toast.info when already subscribed', () => {
    const { getOpts } = setupCapture();
    useAddSubscriber();
    const opts = getOpts();

    opts.onSuccess({ alreadySubscribed: true, message: 'Already subscribed' }, undefined);
    expect(mockToastInfo).toHaveBeenCalledWith('Already subscribed');
    expect(mockToastSuccess).not.toHaveBeenCalled();
  });

  it('onSuccess invalidates subscribers query', () => {
    const { getOpts } = setupCapture();
    useAddSubscriber();
    const opts = getOpts();

    opts.onSuccess({ alreadySubscribed: false, message: 'OK' }, undefined);
    expect(mockInvalidateQueries).toHaveBeenCalledWith({
      queryKey: newsletterKeys.subscribers(),
    });
  });

  it('onError shows toast.error with error message', () => {
    const { getOpts } = setupCapture();
    useAddSubscriber();
    const opts = getOpts();

    opts.onError(new Error('Already exists'));
    expect(mockToastError).toHaveBeenCalledWith('Already exists');
  });

  it('onError falls back to default message when error.message is empty', () => {
    const { getOpts } = setupCapture();
    useAddSubscriber();
    const opts = getOpts();

    opts.onError({ message: '' } as Error);
    expect(mockToastError).toHaveBeenCalledWith('Failed to add subscriber');
  });
});

// ── useBulkUpload ─────────────────────────────────────────────────────────────

describe('useBulkUpload', () => {
  beforeEach(() => vi.clearAllMocks());

  it('mutationFn delegates to NewsletterAPI.bulkAdd', async () => {
    const response = { message: 'Uploaded 3' };
    mockBulkAdd.mockResolvedValue(response);

    const { getOpts } = setupCapture();
    useBulkUpload();
    const opts = getOpts();

    const input = [{ email: 'a@b.com' }];
    const result = await opts.mutationFn(input);
    expect(result).toEqual(response);
    expect(mockBulkAdd).toHaveBeenCalledWith(input);
  });

  it('onSuccess shows toast.success with data.message', () => {
    const { getOpts } = setupCapture();
    useBulkUpload();
    const opts = getOpts();

    opts.onSuccess({ message: 'Uploaded 3' }, undefined);
    expect(mockToastSuccess).toHaveBeenCalledWith('Uploaded 3');
  });

  it('onSuccess invalidates subscribers query', () => {
    const { getOpts } = setupCapture();
    useBulkUpload();
    const opts = getOpts();

    opts.onSuccess({ message: 'Done' }, undefined);
    expect(mockInvalidateQueries).toHaveBeenCalledWith({
      queryKey: newsletterKeys.subscribers(),
    });
  });

  it('onError shows toast.error', () => {
    const { getOpts } = setupCapture();
    useBulkUpload();
    const opts = getOpts();

    opts.onError(new Error('Upload failed'));
    expect(mockToastError).toHaveBeenCalledWith('Upload failed');
  });

  it('onError falls back to default message', () => {
    const { getOpts } = setupCapture();
    useBulkUpload();
    const opts = getOpts();

    opts.onError({ message: '' } as Error);
    expect(mockToastError).toHaveBeenCalledWith('Bulk upload failed');
  });
});

// ── useRemoveSubscriber ───────────────────────────────────────────────────────

describe('useRemoveSubscriber', () => {
  beforeEach(() => vi.clearAllMocks());

  it('mutationFn delegates to NewsletterAPI.removeSubscriber', async () => {
    mockRemoveSubscriber.mockResolvedValue({});

    const { getOpts } = setupCapture();
    useRemoveSubscriber();
    const opts = getOpts();

    await opts.mutationFn('user@example.com');
    expect(mockRemoveSubscriber).toHaveBeenCalledWith('user@example.com');
  });

  it('onSuccess shows toast with email and invalidates query', () => {
    const { getOpts } = setupCapture();
    useRemoveSubscriber();
    const opts = getOpts();

    opts.onSuccess({}, 'user@example.com');
    expect(mockToastSuccess).toHaveBeenCalledWith('user@example.com removed');
    expect(mockInvalidateQueries).toHaveBeenCalledWith({
      queryKey: newsletterKeys.subscribers(),
    });
  });

  it('onError shows toast.error', () => {
    const { getOpts } = setupCapture();
    useRemoveSubscriber();
    const opts = getOpts();

    opts.onError(new Error('Remove failed'));
    expect(mockToastError).toHaveBeenCalledWith('Remove failed');
  });

  it('onError falls back to default message', () => {
    const { getOpts } = setupCapture();
    useRemoveSubscriber();
    const opts = getOpts();

    opts.onError({ message: '' } as Error);
    expect(mockToastError).toHaveBeenCalledWith('Failed to remove subscriber');
  });
});

// ── useResubscribe ────────────────────────────────────────────────────────────

describe('useResubscribe', () => {
  beforeEach(() => vi.clearAllMocks());

  it('mutationFn delegates to NewsletterAPI.resubscribe', async () => {
    mockResubscribe.mockResolvedValue({});

    const { getOpts } = setupCapture();
    useResubscribe();
    const opts = getOpts();

    await opts.mutationFn('user@example.com');
    expect(mockResubscribe).toHaveBeenCalledWith('user@example.com');
  });

  it('onSuccess shows toast with email and invalidates query', () => {
    const { getOpts } = setupCapture();
    useResubscribe();
    const opts = getOpts();

    opts.onSuccess({}, 'user@example.com');
    expect(mockToastSuccess).toHaveBeenCalledWith('user@example.com re-subscribed');
    expect(mockInvalidateQueries).toHaveBeenCalledWith({
      queryKey: newsletterKeys.subscribers(),
    });
  });

  it('onError shows toast.error', () => {
    const { getOpts } = setupCapture();
    useResubscribe();
    const opts = getOpts();

    opts.onError(new Error('Resubscribe failed'));
    expect(mockToastError).toHaveBeenCalledWith('Resubscribe failed');
  });

  it('onError falls back to default message', () => {
    const { getOpts } = setupCapture();
    useResubscribe();
    const opts = getOpts();

    opts.onError({ message: '' } as Error);
    expect(mockToastError).toHaveBeenCalledWith('Failed to re-subscribe');
  });
});

// ── useUpdateSubscriber ───────────────────────────────────────────────────────

describe('useUpdateSubscriber', () => {
  beforeEach(() => vi.clearAllMocks());

  it('mutationFn delegates to NewsletterAPI.updateSubscriber', async () => {
    const response = { message: 'Updated' };
    mockUpdateSubscriber.mockResolvedValue(response);

    const { getOpts } = setupCapture();
    useUpdateSubscriber();
    const opts = getOpts();

    const input = { email: 'u@b.com', firstName: 'New' };
    const result = await opts.mutationFn(input);
    expect(result).toEqual(response);
    expect(mockUpdateSubscriber).toHaveBeenCalledWith(input);
  });

  it('onSuccess shows toast.success with data.message', () => {
    const { getOpts } = setupCapture();
    useUpdateSubscriber();
    const opts = getOpts();

    opts.onSuccess({ message: 'Subscriber updated' }, undefined);
    expect(mockToastSuccess).toHaveBeenCalledWith('Subscriber updated');
  });

  it('onSuccess falls back to default message when data.message is absent', () => {
    const { getOpts } = setupCapture();
    useUpdateSubscriber();
    const opts = getOpts();

    opts.onSuccess({}, undefined);
    expect(mockToastSuccess).toHaveBeenCalledWith('Subscriber updated');
  });

  it('onSuccess invalidates subscribers query', () => {
    const { getOpts } = setupCapture();
    useUpdateSubscriber();
    const opts = getOpts();

    opts.onSuccess({ message: 'OK' }, undefined);
    expect(mockInvalidateQueries).toHaveBeenCalledWith({
      queryKey: newsletterKeys.subscribers(),
    });
  });

  it('onError shows toast.error', () => {
    const { getOpts } = setupCapture();
    useUpdateSubscriber();
    const opts = getOpts();

    opts.onError(new Error('Update failed'));
    expect(mockToastError).toHaveBeenCalledWith('Update failed');
  });

  it('onError falls back to default message', () => {
    const { getOpts } = setupCapture();
    useUpdateSubscriber();
    const opts = getOpts();

    opts.onError({ message: '' } as Error);
    expect(mockToastError).toHaveBeenCalledWith('Failed to update subscriber');
  });
});
