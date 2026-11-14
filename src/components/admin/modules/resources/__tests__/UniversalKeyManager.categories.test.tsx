import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen, within } from '@/test/utils';
import { MemoryRouter } from 'react-router';
import { UniversalKeyManager } from '../UniversalKeyManager';

describe('UniversalKeyManager category chip', () => {
  it('keeps every category on offer after one is picked', () => {
    render(
      <MemoryRouter>
        <UniversalKeyManager />
      </MemoryRouter>,
    );
    // Radix opens its menu from the keyboard in jsdom (pointer events are not simulated).
    fireEvent.keyDown(screen.getByRole('button', { name: '+ Category' }), { key: 'Enter' });
    const menu = screen.getByRole('menu');
    const choices = within(menu).getAllByRole('menuitem');
    // "Any category" plus at least two real categories.
    expect(choices.length).toBeGreaterThan(2);
    const firstCategory = choices[1].textContent ?? '';
    fireEvent.click(choices[1]);

    fireEvent.keyDown(screen.getByRole('button', { name: /^Category:/ }), { key: 'Enter' });
    const reopened = within(screen.getByRole('menu')).getAllByRole('menuitem');
    expect(reopened.length).toBe(choices.length);
    expect(firstCategory.length).toBeGreaterThan(0);
  });
});
