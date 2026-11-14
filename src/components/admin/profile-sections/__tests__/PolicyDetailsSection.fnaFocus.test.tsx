/**
 * Publishing an FNA lands the adviser on that category's FNA list, with the
 * new FNA highlighted. From outside the drawer (the intake hand-off) that
 * arrives as `fnaFocus`; PolicyDetailsSection must open the right category and
 * hand the list-open + highlight props to that category only.
 */
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, renderWithQueryClient, screen, waitFor } from '@/test/utils';
import { MemoryRouter, useLocation } from 'react-router';
import type { ReactElement } from 'react';

vi.mock('../../../../shared/api/clientPolicies', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../../shared/api/clientPolicies')>();
  return {
    ...actual,
    clientPoliciesQueryOptions: (clientId: string) => ({
      queryKey: ['policies', clientId],
      queryFn: async () => [
        { id: 'p1', categoryId: 'risk_planning' },
        { id: 'p2', categoryId: 'retirement_pre' },
        { id: 'p3', categoryId: 'retirement_post' },
      ],
    }),
  };
});
vi.mock('../PolicyComparisonPanel', () => ({
  PolicyComparisonPanel: () => <div data-testid="compare" />,
}));

function Location() {
  return <output data-testid="search">{useLocation().search}</output>;
}
function render(ui: ReactElement, url = '/') {
  return renderWithQueryClient(
    <MemoryRouter initialEntries={[url]}>
      {ui}
      <Location />
    </MemoryRouter>,
  );
}

vi.mock('../PolicyCategoryTab', () => ({
  PolicyCategoryTab: (props: {
    categorySubtabId: string;
    openFNAListOnMount?: boolean;
    highlightFnaId?: string;
  }) => (
    <div data-testid={`category-${props.categorySubtabId}`}>
      {props.openFNAListOnMount
        ? `FNA list open, highlighting ${props.highlightFnaId}`
        : 'policies'}
    </div>
  ),
}));
vi.mock('../PolicyOverviewTab', () => ({
  PolicyOverviewTab: () => <div data-testid="overview" />,
}));

const { PolicyDetailsSection } = await import('../PolicyDetailsSection');
const { FNA_POLICY_CATEGORY } = await import('../../modules/fna/fnaPolicyCategory');

const CLIENT = { id: 'client-1', firstName: 'Thandi', lastName: 'Nkosi' };

describe('PolicyDetailsSection FNA focus', () => {
  it('opens on the overview without a focus', () => {
    render(<PolicyDetailsSection selectedClient={CLIENT} />);
    expect(screen.getByTestId('overview')).toBeTruthy();
  });

  it('shows the categories as a rail with counts, the open one in the address', async () => {
    render(<PolicyDetailsSection selectedClient={CLIENT} />);
    const rail = screen.getByRole('navigation', { name: 'Policy categories' });
    await waitFor(() => expect(rail.textContent).toContain('Retirement planning2'));
    expect(rail.textContent).toContain('Risk planning1');
    fireEvent.click(screen.getByRole('button', { name: /Medical aid/ }));
    expect(await screen.findByTestId('category-medical-aid')).toBeTruthy();
    expect(screen.getByTestId('search').textContent).toBe('?pcat=medical-aid');
    fireEvent.click(screen.getByRole('button', { name: 'Compare all policies' }));
    expect(await screen.findByTestId('compare')).toBeTruthy();
  });

  it('opens the category named in the address', async () => {
    render(<PolicyDetailsSection selectedClient={CLIENT} />, '/?pcat=tax-planning');
    expect(await screen.findByTestId('category-tax-planning')).toBeTruthy();
  });

  it.each(Object.entries(FNA_POLICY_CATEGORY))(
    'a published %s FNA opens %s on its FNA list',
    async (_type, categorySubtabId) => {
      render(
        <PolicyDetailsSection
          selectedClient={CLIENT}
          fnaFocus={{ categorySubtabId, fnaId: 'fna-9' }}
        />,
      );
      expect((await screen.findByTestId(`category-${categorySubtabId}`)).textContent).toBe(
        'FNA list open, highlighting fna-9',
      );
    },
  );
});
