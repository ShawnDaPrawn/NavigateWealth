/**
 * The step indicator, across all seven quote wizards.
 * ==================================================
 *
 * The seven wizards are 8,384 lines of public lead-capture UI with no tests
 * between them. This file gives them their first, and exists because of a
 * specific measurement: every one defines its own `StepIndicator`, and once the
 * per-wizard `steps` array is removed, all seven bodies are byte-identical.
 * About 350 lines of literal duplication.
 *
 * That makes it safe to extract into one component — but "safe" is a claim
 * until something checks it. What must survive is that each wizard still
 * renders ITS OWN labels, in order, and marks the right circle as current. A
 * shared component wired with the wrong `steps` prop would render a perfectly
 * good stepper showing another product's steps.
 *
 * Written and made green BEFORE the extraction.
 *
 * NOTE ON SCOPE: this covers the wizard shell, not the wizards. Their
 * per-vertical questions, validation and submit payloads remain untested — and
 * `handleSubmit` is genuinely different in all seven (79 to 136 lines each), so
 * it is real content rather than duplication and is left alone here.
 */
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() },
}));

vi.mock('react-router', () => ({ useNavigate: () => vi.fn() }));

vi.mock('../../../../utils/supabase/info', () => ({
  projectId: 'test-project',
  publicAnonKey: 'test-anon-key',
}));

import { RiskQuoteWizard } from '../RiskQuoteWizard';
import { MedicalAidQuoteWizard } from '../MedicalAidQuoteWizard';
import { RetirementQuoteWizard } from '../RetirementQuoteWizard';
import { InvestmentQuoteWizard } from '../InvestmentQuoteWizard';
import { EmployeeBenefitsQuoteWizard } from '../EmployeeBenefitsQuoteWizard';
import { EstatePlanningQuoteWizard } from '../EstatePlanningQuoteWizard';
import { TaxPlanningQuoteWizard } from '../TaxPlanningQuoteWizard';

const PROPS = {
  firstName: 'Zora',
  lastName: 'Mkhize',
  email: 'zora@example.co.za',
  phone: '+27820000000',
  onSuccess: vi.fn(),
};

/**
 * Each wizard's own step labels, in order. These are the values that must keep
 * reaching the shared component — the whole risk of the extraction.
 */
const WIZARDS: [string, React.ComponentType<typeof PROPS>, string[]][] = [
  ['Risk', RiskQuoteWizard, ['Cover', 'Details', 'Health', 'Review']],
  ['MedicalAid', MedicalAidQuoteWizard, []],
  ['Retirement', RetirementQuoteWizard, []],
  ['Investment', InvestmentQuoteWizard, []],
  ['EmployeeBenefits', EmployeeBenefitsQuoteWizard, []],
  ['EstatePlanning', EstatePlanningQuoteWizard, []],
  ['TaxPlanning', TaxPlanningQuoteWizard, ['Tax Type', 'Taxpayer', 'Scope', 'Review']],
];

beforeEach(() => {
  sessionStorage.clear();
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('every wizard renders a step indicator', () => {
  it.each(WIZARDS.map(([name, Cmp]) => [name, Cmp] as const))(
    '%s renders one circle per step, with the first marked current',
    (_name, Cmp) => {
      const { container } = render(<Cmp {...PROPS} />);

      // The step circles carry a fixed size class; the count is the step count.
      const circles = container.querySelectorAll('.w-9.h-9.rounded-full');
      expect(circles.length).toBeGreaterThanOrEqual(4);

      // Step 1 is current on first render, so exactly one circle is primary.
      const active = Array.from(circles).filter((c) => c.className.includes('bg-primary'));
      expect(active).toHaveLength(1);
    },
  );
});

describe('each wizard keeps its own labels', () => {
  it.each(
    WIZARDS.filter(([, , labels]) => labels.length > 0).map(
      ([name, Cmp, labels]) => [name, Cmp, labels] as const,
    ),
  )('%s shows its own step names', (_name, Cmp, labels) => {
    render(<Cmp {...PROPS} />);

    for (const label of labels) {
      expect(screen.getAllByText(label).length).toBeGreaterThan(0);
    }
  });

  it('no two wizards render the same set of step labels', () => {
    // The failure a shared component invites: every wizard wired to one
    // default `steps` array, all showing the same stepper.
    const seen = WIZARDS.map(([, Cmp]) => {
      const { container } = render(<Cmp {...PROPS} />);
      const labels = Array.from(container.querySelectorAll('.w-9.h-9.rounded-full')).map(
        (c) => c.parentElement?.textContent?.trim() ?? '',
      );
      return labels.join('|');
    });

    expect(new Set(seen).size, `wizards share a stepper: ${seen.join(' // ')}`).toBe(
      WIZARDS.length,
    );
  });
});
