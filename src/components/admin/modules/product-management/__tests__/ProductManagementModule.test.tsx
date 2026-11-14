/**
 * Product Management shell: the shared no-access state, and an open
 * integration replacing the module header and tabs (it is a page of its own).
 */
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';

const can = vi.fn();
vi.mock('../../personnel', () => ({
  useCurrentUserPermissions: () => ({ can, isLoading: false }),
}));
vi.mock('../ProviderManagementTab', () => ({ ProviderManagementTab: () => <p>providers</p> }));
vi.mock('../ProductManagementTab', () => ({ ProductManagementTab: () => <p>structure</p> }));
vi.mock('../IntegrationsTab', () => ({ IntegrationsTab: () => <p>integrations body</p> }));
vi.mock('../../resources', () => ({ UniversalKeyManager: () => <p>keys</p> }));

import { ProductManagementModule } from '../ProductManagementModule';

function renderAt(url: string) {
  return render(
    <MemoryRouter initialEntries={[url]}>
      <ProductManagementModule />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  can.mockReturnValue(true);
});

describe('ProductManagementModule', () => {
  it('shows the shared no-access state without permission', () => {
    can.mockReturnValue(false);
    renderAt('/');
    expect(screen.getByText(/You don.t have access to Product Management/)).toBeTruthy();
    expect(screen.queryByText('providers')).toBeNull();
  });

  it('shows the header and tabs on the Integrations list', () => {
    renderAt('/?tab=integrations');
    expect(screen.getByRole('heading', { level: 1, name: 'Product Management' })).toBeTruthy();
    expect(screen.getByText('integrations body')).toBeTruthy();
  });

  it('gives an open integration the whole page (no module header or tabs)', () => {
    renderAt('/?tab=integrations&integration=p1');
    expect(screen.queryByRole('heading', { level: 1, name: 'Product Management' })).toBeNull();
    expect(screen.getByText('integrations body')).toBeTruthy();
  });
});
