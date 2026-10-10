/**
 * Publishing an FNA lands the adviser on that category's FNA list, with the
 * new FNA highlighted. From outside the drawer (the intake hand-off) that
 * arrives as `fnaFocus`; PolicyDetailsSection must open the right category and
 * hand the list-open + highlight props to that category only.
 */
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@/test/utils';

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

  it.each(Object.entries(FNA_POLICY_CATEGORY))(
    'a published %s FNA opens %s on its FNA list',
    (_type, categorySubtabId) => {
      render(
        <PolicyDetailsSection
          selectedClient={CLIENT}
          fnaFocus={{ categorySubtabId, fnaId: 'fna-9' }}
        />,
      );
      expect(screen.getByTestId(`category-${categorySubtabId}`).textContent).toBe(
        'FNA list open, highlighting fna-9',
      );
    },
  );
});
