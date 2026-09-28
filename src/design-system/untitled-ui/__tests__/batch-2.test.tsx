import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import {
  Avatar,
  AvatarGroup,
  AvatarLabelGroup,
  ButtonGroup,
  ButtonGroupItem,
  Mail01,
  ProgressBar,
  ProgressCircle,
  Tag,
  Tooltip,
} from '../index';

describe('Untitled UI Avatar', () => {
  it('shows a photo with its alt text', () => {
    render(<Avatar src="/olivia.png" alt="Olivia Rhye" size="lg" />);
    const img = screen.getByRole('img', { name: 'Olivia Rhye' });
    expect(img.tagName).toBe('IMG');
    expect(img.closest('.uui-avatar')?.getAttribute('data-size')).toBe('lg');
  });

  it('falls back to initials when the photo fails to load', () => {
    render(<Avatar src="/missing.png" alt="Olivia Rhye" initials="OR" />);
    fireEvent.error(screen.getByRole('img', { name: 'Olivia Rhye' }));
    const avatar = screen.getByRole('img', { name: 'Olivia Rhye' });
    expect(avatar.tagName).toBe('SPAN');
    expect(avatar.textContent).toContain('OR');
  });

  it('shows the placeholder icon with no photo or initials, and a status', () => {
    const { container } = render(<Avatar alt="Unknown user" status="online" bordered />);
    expect(container.querySelector('.uui-avatar__face svg')).not.toBeNull();
    expect(container.querySelector('[data-status="online"]')?.textContent).toBe('Online');
    expect(container.querySelector('.uui-avatar')?.getAttribute('data-bordered')).toBe('true');
  });

  it('groups avatars, collapses extras into +N and offers an add button', () => {
    const onAdd = vi.fn();
    render(
      <AvatarGroup
        size="xs"
        max={2}
        onAdd={onAdd}
        avatars={[{ initials: 'AA' }, { initials: 'BB' }, { initials: 'CC' }, { initials: 'DD' }]}
      />,
    );
    expect(screen.getByRole('img', { name: '2 more' }).textContent).toContain('+2');
    fireEvent.click(screen.getByRole('button', { name: 'Add user' }));
    expect(onAdd).toHaveBeenCalledTimes(1);
  });

  it('renders a label group with name and supporting text', () => {
    render(
      <AvatarLabelGroup
        size="sm"
        avatar={{ initials: 'OR', alt: 'Olivia' }}
        name="Olivia Rhye"
        hint="olivia@untitledui.com"
      />,
    );
    expect(screen.getByText('Olivia Rhye')).toBeTruthy();
    expect(screen.getByText('olivia@untitledui.com')).toBeTruthy();
  });
});

describe('Untitled UI Tooltip', () => {
  it('describes its trigger and carries theme, placement and hint', () => {
    render(
      <Tooltip title="Save changes" hint="Ctrl+S" theme="light" placement="bottom">
        <button type="button">Save</button>
      </Tooltip>,
    );
    const tip = screen.getByRole('tooltip');
    const trigger = screen.getByRole('button', { name: 'Save' });
    expect(trigger.getAttribute('aria-describedby')).toBe(tip.id);
    expect(tip.getAttribute('data-theme')).toBe('light');
    expect(tip.getAttribute('data-placement')).toBe('bottom');
    expect(tip.getAttribute('data-has-hint')).toBe('true');
    expect(tip.textContent).toContain('Ctrl+S');
  });
});

describe('Untitled UI Tag', () => {
  it('renders a removable tag', () => {
    const onRemove = vi.fn();
    render(
      <Tag size="lg" onRemove={onRemove} removeLabel="Remove Design">
        Design
      </Tag>,
    );
    expect(screen.getByText('Design').getAttribute('data-action')).toBe('close');
    fireEvent.click(screen.getByRole('button', { name: 'Remove Design' }));
    expect(onRemove).toHaveBeenCalledTimes(1);
  });

  it('renders a count and a dot', () => {
    const { container } = render(
      <Tag dot count={5}>
        Label
      </Tag>,
    );
    expect(container.querySelector('.uui-tag__count')?.textContent).toBe('5');
    expect(container.querySelector('.uui-tag')?.getAttribute('data-leading')).toBe('dot');
  });

  it('has a working checkbox named by its label', () => {
    const onCheckedChange = vi.fn();
    render(
      <Tag checkbox checked={false} onCheckedChange={onCheckedChange}>
        Finance
      </Tag>,
    );
    fireEvent.click(screen.getByRole('checkbox', { name: 'Finance' }));
    expect(onCheckedChange).toHaveBeenCalledWith(true);
  });
});

describe('Untitled UI Progress', () => {
  it('reports the bar value and clamps it', () => {
    render(<ProgressBar value={140} label="right" aria-label="Upload" />);
    const bar = screen.getByRole('progressbar', { name: 'Upload' });
    expect(bar.getAttribute('aria-valuenow')).toBe('100');
    expect(bar.textContent).toBe('100%');
  });

  it('draws the circle at the Figma size and reports its value', () => {
    const { container } = render(<ProgressCircle value={40} size="sm" label="Active users" />);
    const circle = screen.getByRole('progressbar', { name: 'Active users' });
    expect(circle.getAttribute('aria-valuenow')).toBe('40');
    expect(container.querySelector('svg')?.getAttribute('width')).toBe('200');
  });

  it('draws a half circle half as tall plus half a stroke', () => {
    const { container } = render(<ProgressCircle value={40} size="md" shape="half" />);
    expect(container.querySelector('svg')?.getAttribute('height')).toBe('132');
  });
});

describe('Untitled UI ButtonGroup', () => {
  it('is a group of pressable items', () => {
    const onClick = vi.fn();
    render(
      <ButtonGroup size="sm" aria-label="View">
        <ButtonGroupItem isCurrent>Day</ButtonGroupItem>
        <ButtonGroupItem isCurrent={false} onClick={onClick}>
          Week
        </ButtonGroupItem>
        <ButtonGroupItem iconLeading={Mail01} aria-label="Mail" />
      </ButtonGroup>,
    );
    expect(screen.getByRole('group', { name: 'View' }).getAttribute('data-size')).toBe('sm');
    expect(screen.getByRole('button', { name: 'Day' }).getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(screen.getByRole('button', { name: 'Week' }));
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Mail' }).getAttribute('data-icon-only')).toBe(
      'true',
    );
  });
});
