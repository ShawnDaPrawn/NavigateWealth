/**
 * ComplianceResultViewer — Render / Characterization Test (Phase 4)
 * ==================================================================
 *
 * Locks the null guard (returns null when activity is null), dialog-title
 * (renders activity.type), footer buttons, and loading state for this
 * 1,494-line Phase 6 decomposition target.
 *
 * api.get is mocked so no real HTTP calls are made.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@/test/utils';

const { mockApiGet } = vi.hoisted(() => ({ mockApiGet: vi.fn() }));
vi.mock('@/utils/api', () => ({
  api: { get: mockApiGet },
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

import { ComplianceResultViewer } from '../ComplianceResultViewer';

// ── Fixtures ─────────────────────────────────────────────────────────────────

function makeActivity(over: Record<string, unknown> = {}) {
  return {
    id: 'act-1',
    type: 'IDV Report',
    date: '2026-01-01T00:00:00.000Z',
    status: 'completed',
    details: {},
    ...over,
  };
}

const noop = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('ComplianceResultViewer', () => {
  it('renders nothing (returns null) when activity is null', () => {
    const { container } = render(
      <ComplianceResultViewer
        open={true}
        onClose={noop}
        activity={null}
        clientId="c-1"
        clientName="Test Client"
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('shows the activity type in the dialog title when open', () => {
    // Never resolves — keeps the component in loading state, but the title is
    // in the header (always rendered regardless of fetch status).
    mockApiGet.mockReturnValue(new Promise(() => {}));

    render(
      <ComplianceResultViewer
        open={true}
        onClose={noop}
        activity={makeActivity()}
        clientId="c-1"
        clientName="Test Client"
      />,
    );

    expect(screen.getAllByText('IDV Report').length).toBeGreaterThan(0);
  });

  it('shows the Download Report and Close footer buttons when open', () => {
    mockApiGet.mockReturnValue(new Promise(() => {}));

    render(
      <ComplianceResultViewer
        open={true}
        onClose={noop}
        activity={makeActivity()}
        clientId="c-1"
        clientName="Test Client"
      />,
    );

    expect(screen.getByRole('button', { name: /download report/i })).toBeTruthy();
    // Dialog's built-in X close button + the footer Close button both match
    // /close/i — use getAllByRole to avoid "Found multiple elements" throw.
    expect(screen.getAllByRole('button', { name: /close/i }).length).toBeGreaterThan(0);
  });

  it('shows the loading text while the check result is being fetched', () => {
    mockApiGet.mockReturnValue(new Promise(() => {}));

    render(
      <ComplianceResultViewer
        open={true}
        onClose={noop}
        activity={makeActivity()}
        clientId="c-1"
        clientName="Test Client"
      />,
    );

    expect(screen.getByText('Loading check result...')).toBeTruthy();
  });
});
