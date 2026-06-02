/**
 * RiskAssessmentPanel — render / characterization test (Phase 4 coverage push).
 *
 * The client KYC/AML risk-screening panel (Honeycomb integration). Locks the
 * list view (templates loaded from the API), the empty state, the
 * identification gate on starting a screening, and the list -> form view
 * transition (which drives parseFormJson). api + supabase info are mocked.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@/test/utils';

const { mockGet, mockPost } = vi.hoisted(() => ({
  mockGet: vi.fn(),
  mockPost: vi.fn(),
}));

vi.mock('@/utils/api', () => ({ api: { get: mockGet, post: mockPost } }));
vi.mock('../../../../../../utils/supabase/info', () => ({
  projectId: 'proj',
  publicAnonKey: 'anon',
  supabaseUrl: 'https://proj.supabase.co',
}));

import { RiskAssessmentPanel } from '../RiskAssessmentPanel';

const template = {
  id: 1,
  version: '1.0',
  matterType: 'AML',
  assessmentName: 'AML Screening',
  assessmentDescription: 'Anti-money-laundering check',
  formJson: JSON.stringify([{ id: 'q1', label: 'Full legal name?', type: 'text', required: true }]),
  weightingJson: '{}',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-02T00:00:00Z',
};

function setupApi(templates: unknown[], history: unknown[] = []) {
  mockGet.mockImplementation((url: string) => {
    if (url.includes('/templates')) return Promise.resolve({ templates });
    if (url.includes('/history/')) return Promise.resolve({ assessments: history });
    return Promise.resolve({});
  });
}

function renderPanel(over: Record<string, unknown> = {}) {
  return render(
    <RiskAssessmentPanel
      clientId="c1"
      clientFirstName="Ann"
      clientLastName="Example"
      idNumber="9001015800087"
      passport={null}
      hasIdentification={true}
      {...over}
    />,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('RiskAssessmentPanel', () => {
  it('lists the Honeycomb assessment templates', async () => {
    setupApi([template]);
    renderPanel();
    expect(await screen.findByText('AML Screening')).toBeTruthy();
    expect(screen.getByText('Risk Assessments')).toBeTruthy();
    expect(screen.getByRole('button', { name: /start/i })).toBeTruthy();
  });

  it('shows an empty state when there are no templates', async () => {
    setupApi([]);
    renderPanel();
    expect(await screen.findByText(/no assessment templates available/i)).toBeTruthy();
  });

  it('disables Start when the client has no identification (KYC gate)', async () => {
    setupApi([template]);
    renderPanel({ hasIdentification: false });
    const start = await screen.findByRole('button', { name: /start/i });
    expect((start as HTMLButtonElement).disabled).toBe(true);
  });

  it('opens the assessment form when Start is clicked', async () => {
    setupApi([template]);
    renderPanel();
    const start = await screen.findByRole('button', { name: /start/i });
    fireEvent.click(start);
    expect(await screen.findByText('Full legal name?')).toBeTruthy();
  });
});
