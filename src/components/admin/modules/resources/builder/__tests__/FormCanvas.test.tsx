/**
 * FormCanvas — Render / Characterization Test (Phase 4)
 * ======================================================
 *
 * Locks the mount contract with an empty blocks array and verifies the
 * canvas root element renders without throwing for this 911-line Phase 6 target.
 *
 * getBlockDefinition is mocked to avoid the full block registry being loaded.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@/test/utils';

vi.mock('@/components/admin/modules/resources/builder/registry', () => ({
  getBlockDefinition: vi.fn().mockReturnValue(null),
}));

import { FormCanvas } from '../FormCanvas';

const noop = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('FormCanvas', () => {
  it('renders without throwing when blocks array is empty', () => {
    const { container } = render(
      <FormCanvas blocks={[]} selectedBlockId={null} onSelectBlock={noop} />,
    );
    expect(container).toBeTruthy();
  });

  it('renders without throwing when blocks are provided', () => {
    const block = { id: 'b-1', type: 'short_text' as const, label: 'Name', required: false };
    const { container } = render(
      <FormCanvas blocks={[block as never]} selectedBlockId={null} onSelectBlock={noop} />,
    );
    expect(container).toBeTruthy();
  });
});
