import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useFNAManagement } from '../useFNAManagement';
import type { FNAConfig } from '../../types';

// ============================================================================
// MOCKS
// ============================================================================

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    loading: vi.fn(() => 'toast-id'),
  },
}));

vi.mock('../../../../../utils/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

// ============================================================================
// HELPERS
// ============================================================================

function makeFNAConfig(overrides: Partial<FNAConfig> = {}): FNAConfig {
  return {
    name: 'Test FNA',
    getLatestPublished: vi.fn().mockResolvedValue(null),
    deleteFNA: vi.fn().mockResolvedValue(undefined),
    publishFNA: vi.fn().mockResolvedValue(undefined),
    unpublishFNA: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  } as unknown as FNAConfig;
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ============================================================================
// TESTS
// ============================================================================

describe('useFNAManagement — initial state', () => {
  it('initialises with null fna and loading=false when config returns null', async () => {
    const config = makeFNAConfig();
    const { result } = renderHook(() =>
      useFNAManagement({ config, clientId: 'client-1', enabled: true }),
    );

    // Wait for the auto-load effect to settle
    await act(async () => {});

    expect(result.current.fna).toBeNull();
    expect(result.current.loading).toBe(false);
  });

  it('sets fna after loadFNA resolves with data', async () => {
    const fnaRecord = { id: 'fna-1', status: 'published' };
    const config = makeFNAConfig({
      getLatestPublished: vi.fn().mockResolvedValue(fnaRecord),
    });

    const { result } = renderHook(() =>
      useFNAManagement({ config, clientId: 'client-1', enabled: true }),
    );

    await act(async () => {});

    expect(result.current.fna).toEqual(fnaRecord);
  });

  it('does not auto-load when enabled=false', async () => {
    const config = makeFNAConfig();

    renderHook(() => useFNAManagement({ config, clientId: 'client-1', enabled: false }));

    await act(async () => {});

    expect(config.getLatestPublished).not.toHaveBeenCalled();
  });

  it('does not auto-load when config is null', async () => {
    const { result } = renderHook(() =>
      useFNAManagement({ config: null, clientId: 'client-1', enabled: true }),
    );

    await act(async () => {});

    expect(result.current.fna).toBeNull();
  });

  it('starts with wizardOpen=false, deleteDialogOpen=false, publishDialogOpen=false', () => {
    const config = makeFNAConfig();
    const { result } = renderHook(() => useFNAManagement({ config, clientId: 'client-1' }));

    expect(result.current.wizardOpen).toBe(false);
    expect(result.current.deleteDialogOpen).toBe(false);
    expect(result.current.publishDialogOpen).toBe(false);
    expect(result.current.deleting).toBe(false);
  });
});

describe('useFNAManagement — handleRunFNA / handleEditFNA', () => {
  it('handleRunFNA opens the wizard', async () => {
    const config = makeFNAConfig();
    const { result } = renderHook(() => useFNAManagement({ config, clientId: 'client-1' }));

    await act(async () => {
      result.current.handleRunFNA();
    });

    expect(result.current.wizardOpen).toBe(true);
  });

  it('handleEditFNA opens the wizard', async () => {
    const config = makeFNAConfig();
    const { result } = renderHook(() => useFNAManagement({ config, clientId: 'client-1' }));

    await act(async () => {
      result.current.handleEditFNA();
    });

    expect(result.current.wizardOpen).toBe(true);
  });

  it('setWizardOpen(false) closes the wizard', async () => {
    const config = makeFNAConfig();
    const { result } = renderHook(() => useFNAManagement({ config, clientId: 'client-1' }));

    await act(async () => {
      result.current.handleRunFNA();
    });
    expect(result.current.wizardOpen).toBe(true);

    await act(async () => {
      result.current.setWizardOpen(false);
    });
    expect(result.current.wizardOpen).toBe(false);
  });
});

describe('useFNAManagement — handleFNAComplete', () => {
  it('calls loadFNA and shows toast.success on completion', async () => {
    const { toast } = await import('sonner');
    const fnaRecord = { id: 'fna-42' };
    const getLatestPublished = vi.fn().mockResolvedValue(fnaRecord);
    const config = makeFNAConfig({ getLatestPublished });

    const { result } = renderHook(() => useFNAManagement({ config, clientId: 'client-1' }));

    await act(async () => {}); // settle auto-load

    await act(async () => {
      await result.current.handleFNAComplete('fna-42');
    });

    expect(getLatestPublished).toHaveBeenCalledTimes(2); // once on mount, once on complete
    expect(toast.success).toHaveBeenCalledWith(expect.stringContaining('Test FNA'));
  });

  it('does nothing when config is null', async () => {
    const { result } = renderHook(() => useFNAManagement({ config: null, clientId: 'client-1' }));

    await act(async () => {
      await result.current.handleFNAComplete('fna-1');
    });
    // No error thrown
  });
});

describe('useFNAManagement — handleDeleteFNA', () => {
  it('does nothing when fna is null', async () => {
    const config = makeFNAConfig();
    const { result } = renderHook(() => useFNAManagement({ config, clientId: 'client-1' }));

    await act(async () => {});

    await act(async () => {
      await result.current.handleDeleteFNA();
    });

    expect(config.deleteFNA).not.toHaveBeenCalled();
  });

  it('calls config.deleteFNA, clears fna state, and shows success toast on success', async () => {
    const { toast } = await import('sonner');
    const fnaRecord = { id: 'fna-5', status: 'published' };
    const getLatestPublished = vi.fn().mockResolvedValueOnce(fnaRecord).mockResolvedValueOnce(null);
    const deleteFNA = vi.fn().mockResolvedValue(undefined);
    const config = makeFNAConfig({ getLatestPublished, deleteFNA });

    const { result } = renderHook(() => useFNAManagement({ config, clientId: 'client-1' }));

    await act(async () => {}); // settle — fna is now set

    await act(async () => {
      await result.current.handleDeleteFNA();
    });

    expect(deleteFNA).toHaveBeenCalledWith('fna-5');
    expect(toast.success).toHaveBeenCalledWith(
      expect.stringContaining('Test FNA'),
      expect.anything(),
    );
    expect(result.current.deleteDialogOpen).toBe(false);
  });

  it('shows toast.error when deleteFNA rejects', async () => {
    const { toast } = await import('sonner');
    const fnaRecord = { id: 'fna-6' };
    const getLatestPublished = vi.fn().mockResolvedValue(fnaRecord);
    const deleteFNA = vi.fn().mockRejectedValue(new Error('Network error'));
    const config = makeFNAConfig({ getLatestPublished, deleteFNA });

    const { result } = renderHook(() => useFNAManagement({ config, clientId: 'client-1' }));

    await act(async () => {});

    await act(async () => {
      await result.current.handleDeleteFNA();
    });

    expect(toast.error).toHaveBeenCalledWith('Network error', expect.anything());
  });
});

describe('useFNAManagement — handlePublishFNA / handleUnpublishFNA', () => {
  it('handlePublishFNA calls config.publishFNA and reloads', async () => {
    const publishFNA = vi.fn().mockResolvedValue(undefined);
    const getLatestPublished = vi.fn().mockResolvedValue(null);
    const config = makeFNAConfig({ publishFNA, getLatestPublished });

    const { result } = renderHook(() => useFNAManagement({ config, clientId: 'client-1' }));

    await act(async () => {});

    await act(async () => {
      await result.current.handlePublishFNA('fna-7');
    });

    expect(publishFNA).toHaveBeenCalledWith('fna-7');
    expect(getLatestPublished).toHaveBeenCalledTimes(2);
  });

  it('handleUnpublishFNA calls config.unpublishFNA and reloads', async () => {
    const unpublishFNA = vi.fn().mockResolvedValue(undefined);
    const getLatestPublished = vi.fn().mockResolvedValue(null);
    const config = makeFNAConfig({ unpublishFNA, getLatestPublished });

    const { result } = renderHook(() => useFNAManagement({ config, clientId: 'client-1' }));

    await act(async () => {});

    await act(async () => {
      await result.current.handleUnpublishFNA('fna-8');
    });

    expect(unpublishFNA).toHaveBeenCalledWith('fna-8');
    expect(getLatestPublished).toHaveBeenCalledTimes(2);
  });

  it('handlePublishFNA does nothing when config is null', async () => {
    const { result } = renderHook(() => useFNAManagement({ config: null, clientId: 'client-1' }));

    await act(async () => {
      await result.current.handlePublishFNA('fna-9');
    });
    // No error thrown
  });
});

describe('useFNAManagement — dialog state setters', () => {
  it('setDeleteDialogOpen toggles deleteDialogOpen', async () => {
    const config = makeFNAConfig();
    const { result } = renderHook(() => useFNAManagement({ config, clientId: 'client-1' }));

    await act(async () => {
      result.current.setDeleteDialogOpen(true);
    });
    expect(result.current.deleteDialogOpen).toBe(true);

    await act(async () => {
      result.current.setDeleteDialogOpen(false);
    });
    expect(result.current.deleteDialogOpen).toBe(false);
  });

  it('setPublishDialogOpen toggles publishDialogOpen', async () => {
    const config = makeFNAConfig();
    const { result } = renderHook(() => useFNAManagement({ config, clientId: 'client-1' }));

    await act(async () => {
      result.current.setPublishDialogOpen(true);
    });
    expect(result.current.publishDialogOpen).toBe(true);
  });
});
