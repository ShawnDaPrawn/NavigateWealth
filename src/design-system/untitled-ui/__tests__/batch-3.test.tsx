import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import {
  Button,
  ContextMenu,
  Dropdown,
  DropdownDivider,
  DropdownItem,
  Mail01,
  MultiSelect,
  RadioGroup,
  RadioGroupItem,
  Select,
  Slider,
} from '../index';

const options = [
  { value: 'olivia', label: 'Olivia Rhye', supportingText: '@olivia' },
  { value: 'phoenix', label: 'Phoenix Baker', disabled: true },
  { value: 'lana', label: 'Lana Steiner' },
];

describe('Untitled UI Select', () => {
  it('is a labelled combobox that opens a listbox', () => {
    render(<Select label="Team member" options={options} hint="Pick one." size="lg" />);
    const combo = screen.getByRole('combobox', { name: 'Team member' });
    expect(combo.getAttribute('aria-expanded')).toBe('false');
    expect(combo.textContent).toContain('Select');
    fireEvent.click(combo);
    expect(combo.getAttribute('aria-expanded')).toBe('true');
    const listbox = screen.getByRole('listbox', { name: 'Team member' });
    expect(listbox.hidden).toBe(false);
    expect(screen.getAllByRole('option')).toHaveLength(3);
    expect(combo.closest('.uui-select')?.getAttribute('data-size')).toBe('lg');
  });

  it('selects with the mouse and closes', () => {
    const onChange = vi.fn();
    render(<Select aria-label="Member" options={options} onChange={onChange} />);
    const combo = screen.getByRole('combobox', { name: 'Member' });
    fireEvent.click(combo);
    fireEvent.click(screen.getByRole('option', { name: /Lana Steiner/ }));
    expect(onChange).toHaveBeenCalledWith('lana');
    expect(combo.getAttribute('aria-expanded')).toBe('false');
    expect(combo.textContent).toContain('Lana Steiner');
  });

  it('moves with the arrow keys, skips disabled options and selects with Enter', () => {
    const onChange = vi.fn();
    render(<Select aria-label="Member" options={options} onChange={onChange} />);
    const combo = screen.getByRole('combobox', { name: 'Member' });
    fireEvent.keyDown(combo, { key: 'ArrowDown' });
    expect(combo.getAttribute('aria-activedescendant')).toBe(
      screen.getByRole('option', { name: /Olivia/ }).id,
    );
    fireEvent.keyDown(combo, { key: 'ArrowDown' });
    expect(combo.getAttribute('aria-activedescendant')).toBe(
      screen.getByRole('option', { name: /Lana/ }).id,
    );
    fireEvent.keyDown(combo, { key: 'Enter' });
    expect(onChange).toHaveBeenCalledWith('lana');
  });

  it('closes on Escape and ignores clicks on disabled options', () => {
    const onChange = vi.fn();
    render(<Select aria-label="Member" options={options} onChange={onChange} />);
    const combo = screen.getByRole('combobox', { name: 'Member' });
    fireEvent.click(combo);
    fireEvent.click(screen.getByRole('option', { name: /Phoenix/ }));
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(combo.getAttribute('aria-expanded')).toBe('false');
  });

  it('finds an option by typing and submits the value with a form', () => {
    const { container } = render(
      <Select aria-label="Member" name="member" options={options} defaultValue="olivia" />,
    );
    const combo = screen.getByRole('combobox', { name: 'Member' });
    fireEvent.keyDown(combo, { key: 'l' });
    expect(combo.getAttribute('aria-activedescendant')).toBe(
      screen.getByRole('option', { name: /Lana/ }).id,
    );
    const hidden = container.querySelector<HTMLInputElement>('input[type="hidden"]');
    expect(hidden?.name).toBe('member');
    expect(hidden?.value).toBe('olivia');
  });

  it('marks an invalid select', () => {
    render(<Select label="Member" options={options} invalid hint="Required." />);
    expect(screen.getByRole('combobox', { name: 'Member' }).getAttribute('aria-invalid')).toBe(
      'true',
    );
  });
});

describe('Untitled UI MultiSelect', () => {
  it('toggles several values and stays open', () => {
    const onChange = vi.fn();
    render(<MultiSelect aria-label="Members" options={options} onChange={onChange} />);
    const combo = screen.getByRole('combobox', { name: 'Members' });
    fireEvent.click(combo);
    expect(screen.getByRole('listbox').getAttribute('aria-multiselectable')).toBe('true');
    fireEvent.click(screen.getByRole('option', { name: /Olivia/ }));
    fireEvent.click(screen.getByRole('option', { name: /Lana/ }));
    expect(onChange).toHaveBeenLastCalledWith(['olivia', 'lana']);
    expect(combo.getAttribute('aria-expanded')).toBe('true');
    fireEvent.click(screen.getByRole('option', { name: /Olivia/ }));
    expect(onChange).toHaveBeenLastCalledWith(['lana']);
  });
});

describe('Untitled UI Dropdown', () => {
  const renderMenu = (onSelect = vi.fn()) =>
    render(
      <Dropdown trigger={<Button>Options</Button>}>
        <DropdownItem icon={Mail01} shortcut="⌘E" onSelect={onSelect}>
          Email
        </DropdownItem>
        <DropdownDivider />
        <DropdownItem disabled>Archive</DropdownItem>
        <DropdownItem>Log out</DropdownItem>
      </Dropdown>,
    );

  it('opens a menu from its trigger and focuses the first item', () => {
    renderMenu();
    const trigger = screen.getByRole('button', { name: 'Options' });
    expect(trigger.getAttribute('aria-haspopup')).toBe('menu');
    fireEvent.click(trigger);
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    screen.getByRole('menu', { name: 'Options' });
    expect(document.activeElement).toBe(screen.getByRole('menuitem', { name: /Email/ }));
    expect(screen.getByRole('separator')).toBeTruthy();
  });

  it('moves between enabled items with the arrow keys', () => {
    renderMenu();
    fireEvent.click(screen.getByRole('button', { name: 'Options' }));
    const menu = screen.getByRole('menu');
    fireEvent.keyDown(menu, { key: 'ArrowDown' });
    expect(document.activeElement).toBe(screen.getByRole('menuitem', { name: 'Log out' }));
    fireEvent.keyDown(menu, { key: 'ArrowDown' });
    expect(document.activeElement).toBe(screen.getByRole('menuitem', { name: /Email/ }));
    fireEvent.keyDown(menu, { key: 'End' });
    expect(document.activeElement).toBe(screen.getByRole('menuitem', { name: 'Log out' }));
  });

  it('calls onSelect, closes and returns focus on Escape', () => {
    const onSelect = vi.fn();
    renderMenu(onSelect);
    const trigger = screen.getByRole('button', { name: 'Options' });
    fireEvent.click(trigger);
    fireEvent.click(screen.getByRole('menuitem', { name: /Email/ }));
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('menu')).toBeNull();

    fireEvent.keyDown(trigger, { key: 'ArrowUp' });
    expect(document.activeElement).toBe(screen.getByRole('menuitem', { name: 'Log out' }));
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('menu')).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it('closes on an outside click', () => {
    renderMenu();
    fireEvent.click(screen.getByRole('button', { name: 'Options' }));
    fireEvent.pointerDown(document.body);
    expect(screen.queryByRole('menu')).toBeNull();
  });
});

describe('Untitled UI ContextMenu', () => {
  it('opens at the pointer on right-click', () => {
    render(
      <ContextMenu menu={<DropdownItem>Copy</DropdownItem>}>
        <p>Right-click me</p>
      </ContextMenu>,
    );
    fireEvent.contextMenu(screen.getByText('Right-click me'), { clientX: 40, clientY: 60 });
    const menu = screen.getByRole('menu', { name: 'Context menu' });
    expect(menu.style.left).toBe('40px');
    expect(menu.style.top).toBe('60px');
    fireEvent.click(screen.getByRole('menuitem', { name: 'Copy' }));
    expect(screen.queryByRole('menu')).toBeNull();
  });
});

describe('Untitled UI Slider', () => {
  it('is a native range input with a formatted value', () => {
    const onChange = vi.fn();
    render(<Slider aria-label="Volume" defaultValue={40} label="bottom" onChange={onChange} />);
    const input = screen.getByRole('slider', { name: 'Volume' }) as HTMLInputElement;
    expect(input.value).toBe('40');
    expect(input.getAttribute('aria-valuetext')).toBe('40%');
    fireEvent.change(input, { target: { value: '70' } });
    expect(onChange).toHaveBeenCalledWith(70);
    expect(input.value).toBe('70');
  });

  it('keeps two handles from crossing', () => {
    const onChange = vi.fn();
    render(<Slider aria-label="Price" defaultValue={[20, 60]} onChange={onChange} />);
    const low = screen.getByRole('slider', { name: 'Price, minimum' });
    const high = screen.getByRole('slider', { name: 'Price, maximum' });
    fireEvent.change(low, { target: { value: '80' } });
    expect(onChange).toHaveBeenLastCalledWith([60, 60]);
    fireEvent.change(high, { target: { value: '10' } });
    expect(onChange).toHaveBeenLastCalledWith([60, 60]);
    expect(low.closest('.uui-slider')?.getAttribute('data-range')).toBe('true');
  });
});

describe('Untitled UI RadioGroup', () => {
  it('selects one card at a time', () => {
    const onChange = vi.fn();
    render(
      <RadioGroup aria-label="Plan" defaultValue="basic" onChange={onChange}>
        <RadioGroupItem
          value="basic"
          title="Basic plan"
          subtext="$10/month"
          description="For individuals."
        />
        <RadioGroupItem value="business" title="Business plan" />
      </RadioGroup>,
    );
    screen.getByRole('radiogroup', { name: 'Plan' });
    const basic = screen.getByRole('radio', { name: 'Basic plan' }) as HTMLInputElement;
    const business = screen.getByRole('radio', { name: 'Business plan' }) as HTMLInputElement;
    expect(basic.checked).toBe(true);
    expect(basic.closest('.uui-radio-card')?.hasAttribute('data-checked')).toBe(true);
    fireEvent.click(business);
    expect(onChange).toHaveBeenCalledWith('business');
    expect(business.checked).toBe(true);
    expect(basic.checked).toBe(false);
  });

  it('renders the icon type with a trailing checkbox, and disables items', () => {
    const { container } = render(
      <RadioGroup aria-label="Plan" type="icon" size="sm" disabled>
        <RadioGroupItem value="a" title="A" icon={Mail01} />
      </RadioGroup>,
    );
    const card = container.querySelector('.uui-radio-card');
    expect(card?.getAttribute('data-type')).toBe('icon');
    expect(card?.getAttribute('data-size')).toBe('sm');
    expect(container.querySelector('.uui-radio-card__icon svg')).not.toBeNull();
    expect(container.querySelector('.uui-radio-card__check')).not.toBeNull();
    expect((screen.getByRole('radio', { name: 'A' }) as HTMLInputElement).disabled).toBe(true);
  });
});
