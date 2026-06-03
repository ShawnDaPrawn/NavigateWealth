/**
 * FormBuilder — Render / Characterization Test (Phase 4)
 * =======================================================
 *
 * Locks the mount contract and the always-visible "Save Letter" / "Save
 * Template" toolbar button for this 1,061-line Phase 6 decomposition target.
 *
 * mode='letter' bypasses the TemplateGallery overlay (which shows for new
 * forms). Heavy sub-components (Toolbox, FormCanvas, PropertiesPanel,
 * InteractiveFormRenderer) are mocked to avoid complex canvas/registry usage.
 * api is mocked to prevent real HTTP calls on autosave.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@/test/utils';

const { mockApiPost, mockApiPut } = vi.hoisted(() => ({
  mockApiPost: vi.fn(),
  mockApiPut: vi.fn(),
}));

vi.mock('@/utils/api', () => ({
  api: {
    get: vi.fn().mockResolvedValue({}),
    post: mockApiPost,
    put: mockApiPut,
    delete: vi.fn(),
  },
}));

vi.mock('@/components/admin/modules/resources/builder/Toolbox', () => ({
  Toolbox: () => null,
}));

vi.mock('@/components/admin/modules/resources/builder/FormCanvas', () => ({
  FormCanvas: () => null,
}));

vi.mock('@/components/admin/modules/resources/builder/PropertiesPanel', () => ({
  PropertiesPanel: () => null,
}));

vi.mock('@/components/admin/modules/resources/builder/InteractiveFormRenderer', () => ({
  InteractiveFormRenderer: () => null,
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

import { FormBuilder } from '../FormBuilder';

const noop = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  mockApiPost.mockResolvedValue({});
  mockApiPut.mockResolvedValue({});
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('FormBuilder', () => {
  it('renders without throwing in letter mode', () => {
    const { container } = render(<FormBuilder onBack={noop} mode="letter" />);
    expect(container).toBeTruthy();
  });

  it('shows the Save Letter button in letter mode', () => {
    render(<FormBuilder onBack={noop} mode="letter" />);
    expect(screen.getByRole('button', { name: /save letter/i })).toBeTruthy();
  });

  it('shows the Save Template button for a new form (with initialData)', () => {
    render(<FormBuilder onBack={noop} initialData={{ id: 'f-1', name: 'Test Form' }} />);
    expect(screen.getByRole('button', { name: /save template/i })).toBeTruthy();
  });
});
