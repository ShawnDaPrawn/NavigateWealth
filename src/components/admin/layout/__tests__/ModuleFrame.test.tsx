import { describe, expect, it, vi, afterEach } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { lazy } from 'react';
import { ModuleFrame } from '../ModuleFrame';
import { ModuleSkeleton } from '../page';

vi.mock('../../../../utils/quality/runtimeIssueReporter', () => ({
  markErrorReported: vi.fn(),
  reportRuntimeClientIssue: vi.fn(() => Promise.resolve()),
}));

afterEach(() => vi.useRealTimers());

function Boom(): JSX.Element {
  throw new Error('kaboom in the table');
}

describe('ModuleFrame', () => {
  it('shows the module name and the standard error state when a module crashes', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    render(
      <ModuleFrame module="tasks">
        <Boom />
      </ModuleFrame>,
    );
    expect(screen.getByRole('heading', { level: 1, name: 'To-Do' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Unable to load To-Do' })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Try again/ })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Show details' }));
    expect(screen.getByText('kaboom in the table')).toBeTruthy();
  });

  it('shows the shared skeleton with the module name while the module loads', () => {
    const Never = lazy(() => new Promise<{ default: () => JSX.Element }>(() => {}));
    render(
      <ModuleFrame module="notes">
        <Never />
      </ModuleFrame>,
    );
    expect(screen.getByRole('heading', { level: 1, name: 'Notes' })).toBeTruthy();
    expect(screen.getByLabelText('Loading Notes').getAttribute('aria-busy')).toBe('true');
  });
});

describe('ModuleSkeleton', () => {
  it('switches to the error state after ten seconds', () => {
    vi.useFakeTimers();
    render(<ModuleSkeleton title="Calendar" />);
    expect(screen.queryByRole('alert')).toBeNull();
    act(() => {
      vi.advanceTimersByTime(10_000);
    });
    expect(screen.getByRole('heading', { name: 'Unable to load Calendar' })).toBeTruthy();
  });
});
