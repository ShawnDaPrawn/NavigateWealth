import { describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router';
import { useEffect } from 'react';
import { useUrlState } from '../useUrlState';
import {
  UnsavedChangesRegistryProvider,
  useUnsavedChangesRegistry,
} from '../../../../shared/unsaved-changes/UnsavedChangesRegistry';

const TABS = ['board', 'archived'] as const;

function Page({ dirty, tryAction }: { dirty: boolean; tryAction: (a: () => void) => void }) {
  const registry = useUnsavedChangesRegistry();
  useEffect(() => {
    registry.register({ id: 'form', isDirty: dirty, tryAction });
  }, [registry, dirty, tryAction]);
  const [tab, setTab] = useUrlState('tab', 'board', TABS);
  const location = useLocation();
  return (
    <>
      <p>tab: {tab}</p>
      <p>search: {location.search}</p>
      <button onClick={() => setTab('archived')}>archived</button>
    </>
  );
}

function setup(dirty: boolean, tryAction = vi.fn()) {
  render(
    <MemoryRouter initialEntries={['/admin?module=tasks']}>
      <UnsavedChangesRegistryProvider>
        <Page dirty={dirty} tryAction={tryAction} />
      </UnsavedChangesRegistryProvider>
    </MemoryRouter>,
  );
  return tryAction;
}

describe('useUrlState and unsaved changes', () => {
  it('switches straight away when nothing is unsaved', () => {
    setup(false);
    fireEvent.click(screen.getByText('archived'));
    expect(screen.getByText('tab: archived')).toBeTruthy();
  });

  it('asks the dirty form first and only switches if it lets go', () => {
    let proceed: (() => void) | null = null;
    const tryAction = setup(
      true,
      vi.fn((a: () => void) => (proceed = a)),
    );
    fireEvent.click(screen.getByText('archived'));
    expect(tryAction).toHaveBeenCalled();
    expect(screen.getByText('tab: board')).toBeTruthy();
    // The user confirms leaving.
    act(() => proceed!());
    expect(screen.getByText('tab: archived')).toBeTruthy();
  });
});
