import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { useState } from 'react';
import { useBreadcrumbTrail } from '../page';

vi.mock('../Sidebar', () => ({ Sidebar: () => null }));
vi.mock('../GlobalSearch', () => ({ GlobalSearch: () => <input aria-label="search" /> }));
vi.mock('../../hooks/usePendingCounts', () => ({ usePendingCounts: () => ({}) }));

import { AdminLayout } from '../../AdminLayout';

function Integrations() {
  const [open, setOpen] = useState(false);
  useBreadcrumbTrail(
    open
      ? [{ label: 'Integrations', onClick: () => setOpen(false) }, { label: 'Allan Gray' }]
      : [{ label: 'Integrations' }],
  );
  return <button onClick={() => setOpen(true)}>open Allan Gray</button>;
}

describe('top-bar breadcrumb', () => {
  it('shows group and module, then the steps the module sets, with links back', () => {
    const onModuleChange = vi.fn();
    render(
      <AdminLayout activeModule="product-management" onModuleChange={onModuleChange}>
        <Integrations />
      </AdminLayout>,
    );
    const crumbs = () => within(screen.getByRole('navigation', { name: 'Breadcrumb' }));
    expect(crumbs().getByText('Advice')).toBeTruthy();
    expect(crumbs().getByText('Integrations').getAttribute('aria-current')).toBe('page');

    fireEvent.click(screen.getByText('open Allan Gray'));
    expect(crumbs().getByText('Allan Gray').getAttribute('aria-current')).toBe('page');
    fireEvent.click(crumbs().getByRole('button', { name: 'Integrations' }));
    expect(crumbs().getByText('Integrations').getAttribute('aria-current')).toBe('page');

    fireEvent.click(crumbs().getByRole('button', { name: 'Product Management' }));
    expect(onModuleChange).toHaveBeenCalledWith('product-management');
  });

  it('shows just the module when nothing is set', () => {
    render(
      <AdminLayout activeModule="notes" onModuleChange={vi.fn()}>
        <p>notes</p>
      </AdminLayout>,
    );
    const nav = within(screen.getByRole('navigation', { name: 'Breadcrumb' }));
    expect(nav.getByText('Notes').getAttribute('aria-current')).toBe('page');
  });
});
