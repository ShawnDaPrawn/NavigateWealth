import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import {
  Badge,
  Button,
  Check,
  Checkbox,
  CloseButton,
  Input,
  Mail01,
  Radio,
  Textarea,
  Toggle,
} from '../index';

/** The text of the elements an element's aria-describedby points at. */
const description = (el: Element) =>
  (el.getAttribute('aria-describedby') ?? '')
    .split(' ')
    .filter(Boolean)
    .map((id) => document.getElementById(id)?.textContent ?? '')
    .join(' ');

describe('Untitled UI Button', () => {
  it('maps size, hierarchy and destructive to data attributes', () => {
    render(
      <Button size="lg" hierarchy="secondary" destructive>
        Delete
      </Button>,
    );
    const button = screen.getByRole('button', { name: 'Delete' });
    expect(button.classList.contains('uui-button')).toBe(true);
    expect(button?.getAttribute('data-size')).toBe('lg');
    expect(button?.getAttribute('data-hierarchy')).toBe('secondary');
    expect(button?.getAttribute('data-destructive')).toBe('true');
    expect(button?.getAttribute('type')).toBe('button');
  });

  it('defaults to a primary md button', () => {
    render(<Button>Save</Button>);
    const button = screen.getByRole('button', { name: 'Save' });
    expect(button?.getAttribute('data-size')).toBe('md');
    expect(button?.getAttribute('data-hierarchy')).toBe('primary');
    expect(button?.hasAttribute('data-destructive')).toBe(false);
  });

  it('renders leading and trailing icons', () => {
    const { container } = render(
      <Button iconLeading={Mail01} iconTrailing={Check}>
        Send
      </Button>,
    );
    expect(container.querySelectorAll('svg.uui-icon')).toHaveLength(2);
  });

  it('is icon-only when it has an icon and no label', () => {
    render(<Button iconLeading={Mail01} aria-label="Email" />);
    const button = screen.getByRole('button', { name: 'Email' });
    expect(button?.getAttribute('data-icon-only')).toBe('true');
    expect(button.querySelector('.uui-button__label')).toBeNull();
  });

  it('shows the spinner and loading text, and blocks clicks while loading', () => {
    const onClick = vi.fn();
    const { container } = render(
      <Button isLoading loadingText="Submitting..." iconTrailing={Check} onClick={onClick}>
        Submit
      </Button>,
    );
    const button = screen.getByRole('button', { name: 'Submitting...' });
    expect((button as HTMLButtonElement).disabled).toBe(true);
    expect(button?.getAttribute('aria-busy')).toBe('true');
    expect(button?.getAttribute('data-loading')).toBe('true');
    expect(container.querySelector('.uui-spinner')).not.toBeNull();
    expect(container.querySelectorAll('svg')).toHaveLength(1);
    fireEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });
});

describe('Untitled UI CloseButton', () => {
  it('has an accessible name and passes size and background through', () => {
    const onClick = vi.fn();
    render(<CloseButton size="lg" darkBackground onClick={onClick} />);
    const button = screen.getByRole('button', { name: 'Close' });
    expect(button?.getAttribute('data-size')).toBe('lg');
    expect(button?.getAttribute('data-dark-background')).toBe('true');
    fireEvent.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});

describe('Untitled UI Badge', () => {
  it('renders a gray pill by default', () => {
    render(<Badge>Label</Badge>);
    const badge = screen.getByText('Label');
    expect(badge?.getAttribute('data-type')).toBe('pill-color');
    expect(badge?.getAttribute('data-size')).toBe('md');
    expect(badge?.hasAttribute('data-color')).toBe(false);
  });

  it('marks a leading dot and the colour', () => {
    const { container } = render(
      <Badge type="badge-modern" color="success" dot>
        Active
      </Badge>,
    );
    const badge = screen.getByText('Active');
    expect(badge?.getAttribute('data-color')).toBe('success');
    expect(badge?.getAttribute('data-leading')).toBe('dot');
    expect(container.querySelector('.uui-badge__dot')).not.toBeNull();
  });

  it('marks leading and trailing icons', () => {
    render(
      <Badge iconLeading={Mail01} iconTrailing={Check}>
        Both
      </Badge>,
    );
    const badge = screen.getByText('Both');
    expect(badge?.getAttribute('data-leading')).toBe('icon');
    expect(badge?.getAttribute('data-trailing')).toBe('icon');
  });

  it('is icon-only with an icon and no label', () => {
    render(<Badge iconLeading={Mail01} aria-label="Mail" />);
    expect(screen.getByLabelText('Mail')?.getAttribute('data-icon-only')).toBe('true');
  });

  it('renders a remove button that calls onRemove', () => {
    const onRemove = vi.fn();
    render(
      <Badge onRemove={onRemove} removeLabel="Remove tag">
        Tag
      </Badge>,
    );
    expect(screen.getByText('Tag')?.getAttribute('data-trailing')).toBe('close');
    fireEvent.click(screen.getByRole('button', { name: 'Remove tag' }));
    expect(onRemove).toHaveBeenCalledTimes(1);
  });
});

describe('Untitled UI Input and Textarea', () => {
  it('links the label and hint to the input', () => {
    render(
      <Input
        label="Email"
        hint="We never share it."
        required
        icon={Mail01}
        placeholder="you@example.com"
      />,
    );
    const input = screen.getByLabelText(/Email/);
    expect((input as HTMLInputElement).required).toBe(true);
    expect(description(input)).toBe('We never share it.');
    expect(input.closest('.uui-field')?.getAttribute('data-size')).toBe('md');
  });

  it('marks an invalid field and shows the hint as the error', () => {
    render(<Input label="Email" hint="Enter a valid email." invalid size="sm" />);
    const input = screen.getByLabelText('Email');
    expect(input?.getAttribute('aria-invalid')).toBe('true');
    const field = input.closest('.uui-field');
    expect(field?.getAttribute('data-invalid')).toBe('true');
    expect(field?.getAttribute('data-size')).toBe('sm');
  });

  it('shows the help icon with its text as an accessible name', () => {
    render(<Input label="Name" helpText="As on your ID." />);
    expect(screen.getByRole('img', { name: 'As on your ID.' })).toBeTruthy();
  });

  it('renders a multiline textarea with the help icon in the label', () => {
    render(<Textarea label="Description" helpText="Keep it short." hint="Max 200 words." />);
    const textarea = screen.getByRole('textbox', { name: /Description/ });
    expect(textarea.tagName).toBe('TEXTAREA');
    expect(description(textarea)).toBe('Max 200 words.');
    expect(textarea.closest('.uui-field__control')?.getAttribute('data-multiline')).toBe('true');
  });

  it('shows the error icon in an invalid textarea', () => {
    const { container } = render(<Textarea label="Notes" invalid hint="Required." />);
    expect(container.querySelector('.uui-field__control .uui-field__trailing-icon')).not.toBeNull();
  });
});

describe('Untitled UI Checkbox and Radio', () => {
  it('is a real checkbox with label and supporting text', () => {
    const onChange = vi.fn();
    render(<Checkbox label="Remember me" hint="Save my login details." onChange={onChange} />);
    const box = screen.getByRole('checkbox', { name: /Remember me/ });
    expect(description(box)).toBe('Save my login details.');
    fireEvent.click(box);
    expect(onChange).toHaveBeenCalledTimes(1);
    expect((box as HTMLInputElement).checked).toBe(true);
  });

  it('sets the indeterminate DOM property', () => {
    render(<Checkbox label="Select all" indeterminate size="md" />);
    const box = screen.getByRole('checkbox', { name: 'Select all' }) as HTMLInputElement;
    expect(box.indeterminate).toBe(true);
    expect(box.closest('.uui-choice')?.getAttribute('data-size')).toBe('md');
  });

  it('forwards refs', () => {
    const ref = { current: null as HTMLInputElement | null };
    render(<Checkbox ref={ref} aria-label="Plain" />);
    expect(ref.current).toBe(screen.getByRole('checkbox', { name: 'Plain' }));
  });

  it('renders radios that share a group', () => {
    render(
      <>
        <Radio name="plan" value="basic" label="Basic" defaultChecked />
        <Radio name="plan" value="pro" label="Pro" />
      </>,
    );
    fireEvent.click(screen.getByRole('radio', { name: 'Pro' }));
    expect((screen.getByRole('radio', { name: 'Pro' }) as HTMLInputElement).checked).toBe(true);
    expect((screen.getByRole('radio', { name: 'Basic' }) as HTMLInputElement).checked).toBe(false);
  });
});

describe('Untitled UI Toggle', () => {
  it('toggles itself when uncontrolled', () => {
    const onCheckedChange = vi.fn();
    render(
      <Toggle label="Notifications" hint="Email me updates." onCheckedChange={onCheckedChange} />,
    );
    const toggle = screen.getByRole('switch', { name: 'Notifications' });
    expect(toggle?.getAttribute('aria-checked')).toBe('false');
    expect(description(toggle)).toBe('Email me updates.');
    fireEvent.click(toggle);
    expect(toggle?.getAttribute('aria-checked')).toBe('true');
    expect(onCheckedChange).toHaveBeenCalledWith(true);
  });

  it('follows the checked prop when controlled', () => {
    const onCheckedChange = vi.fn();
    render(
      <Toggle
        aria-label="Dark mode"
        checked
        onCheckedChange={onCheckedChange}
        type="slim"
        size="md"
      />,
    );
    const toggle = screen.getByRole('switch', { name: 'Dark mode' });
    fireEvent.click(toggle);
    expect(onCheckedChange).toHaveBeenCalledWith(false);
    expect(toggle?.getAttribute('aria-checked')).toBe('true');
    expect(toggle.closest('.uui-toggle')?.getAttribute('data-type')).toBe('slim');
  });

  it('respects a prevented click', () => {
    const onCheckedChange = vi.fn();
    render(
      <Toggle
        aria-label="Locked"
        onClick={(e) => e.preventDefault()}
        onCheckedChange={onCheckedChange}
      />,
    );
    fireEvent.click(screen.getByRole('switch', { name: 'Locked' }));
    expect(onCheckedChange).not.toHaveBeenCalled();
  });
});
