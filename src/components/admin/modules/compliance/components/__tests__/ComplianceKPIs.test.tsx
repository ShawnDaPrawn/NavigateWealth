import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ComplianceKPIs } from '@/components/admin/modules/compliance/components/ComplianceKPIs';
import type { ComplianceStats } from '@/components/admin/modules/compliance/types';

/**
 * Characterization tests — capture current ComplianceKPIs rendering so the
 * typecheck burn-down (modelling ComplianceStats) can't silently change it.
 */
describe('ComplianceKPIs (characterization)', () => {
  it('renders the KPI cards with mock fallbacks when no stats are provided', () => {
    render(<ComplianceKPIs />);
    expect(screen.getByText('Statutory Returns')).toBeTruthy();
    expect(screen.getByText('FICA Alerts')).toBeTruthy();
    expect(screen.getByText('KYC Pending')).toBeTruthy();
    expect(screen.getByText('STR Queue')).toBeTruthy();
  });

  it('derives FICA alert counts from provided stats (pendingReviews -> KYC Pending, riskIssues -> STR Queue)', () => {
    // The component only reads these top-level summary fields; cast a partial
    // object so the test does not depend on the full nested ComplianceStats.
    const stats = {
      complianceScore: 80,
      overdueItems: 2,
      pendingReviews: 7,
      riskIssues: 3,
    } as ComplianceStats;

    render(<ComplianceKPIs stats={stats} />);

    expect(screen.getByText('KYC Pending').parentElement?.textContent).toContain('7');
    expect(screen.getByText('STR Queue').parentElement?.textContent).toContain('3');
  });
});
