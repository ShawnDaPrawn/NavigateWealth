import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ComponentsLibraryTab } from '../ComponentsLibraryTab';

vi.mock('../DesignSystemLibrary', () => ({
  DesignSystemLibrary: () => <div>Library embed</div>,
}));

vi.mock('../ComponentsTab', () => ({
  ComponentsTab: () => <div>Current components</div>,
}));

describe('ComponentsLibraryTab', () => {
  it('shows the component library first, and today’s components on request', () => {
    render(<ComponentsLibraryTab />);
    expect(screen.getByText('Library embed')).toBeTruthy();
    expect(screen.queryByText('Current components')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Components in use today' }));
    expect(screen.getByText('Current components')).toBeTruthy();
    expect(screen.queryByText('Library embed')).toBeNull();
    expect(
      screen.getByRole('button', { name: 'Components in use today' }).getAttribute('aria-pressed'),
    ).toBe('true');

    fireEvent.click(screen.getByRole('button', { name: 'Component library' }));
    expect(screen.getByText('Library embed')).toBeTruthy();
  });
});
