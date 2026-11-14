/** Draft RoA start: failed saved-draft load is an error, and Begin still works. */
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { RoAStepStart } from '../RoAStepStart';

describe('RoAStepStart — failed drafts load', () => {
  it('shows "Unable to load saved RoA drafts" with Try again, and keeps Begin RoA draft', () => {
    const onRetryDrafts = vi.fn();
    render(
      <RoAStepStart
        onCreateNew={vi.fn()}
        onResume={vi.fn()}
        existingDrafts={[]}
        finalisedDrafts={[]}
        draftsError={new Error('Request failed (400)')}
        onRetryDrafts={onRetryDrafts}
      />,
    );
    expect(screen.getByText('Unable to load saved RoA drafts')).toBeTruthy();
    expect(screen.getByRole('button', { name: /Begin RoA draft/ })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Try again/ }));
    expect(onRetryDrafts).toHaveBeenCalled();
  });
});
