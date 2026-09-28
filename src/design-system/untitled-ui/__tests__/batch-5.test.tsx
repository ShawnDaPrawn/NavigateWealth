import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import {
  Alert,
  Breadcrumbs,
  ContentDivider,
  HomeLine,
  LoadingIndicator,
  Notification,
  Pagination,
  PaginationDots,
  Tabs,
  paginationRange,
} from '../index';

const tabs = [
  { id: 'details', label: 'My details', panel: <p>Details panel</p> },
  { id: 'password', label: 'Password', badge: 2, panel: <p>Password panel</p> },
  { id: 'team', label: 'Team', disabled: true, panel: <p>Team panel</p> },
  { id: 'billing', label: 'Billing', panel: <p>Billing panel</p> },
];

describe('Untitled UI Tabs', () => {
  it('renders a named tablist with the first tab selected and its panel', () => {
    render(<Tabs aria-label="Settings" items={tabs} type="underline" size="md" />);
    const list = screen.getByRole('tablist', { name: 'Settings' });
    expect(list.getAttribute('data-type')).toBe('underline');
    expect(list.getAttribute('data-size')).toBe('md');
    const first = screen.getByRole('tab', { name: 'My details' });
    expect(first.getAttribute('aria-selected')).toBe('true');
    expect(first.tabIndex).toBe(0);
    expect(screen.getByRole('tab', { name: /Password/ }).tabIndex).toBe(-1);
    const panel = screen.getByRole('tabpanel', { name: 'My details' });
    expect(panel.textContent).toBe('Details panel');
    expect(first.getAttribute('aria-controls')).toBe(panel.id);
  });

  it('selects on click and reports the change', () => {
    const onChange = vi.fn();
    render(<Tabs aria-label="Settings" items={tabs} onChange={onChange} />);
    fireEvent.click(screen.getByRole('tab', { name: /Password/ }));
    expect(onChange).toHaveBeenCalledWith('password');
    expect(screen.getByRole('tabpanel').textContent).toBe('Password panel');
  });

  it('moves with the arrow keys, skipping disabled tabs, and Home/End', () => {
    render(<Tabs aria-label="Settings" items={tabs} />);
    const first = screen.getByRole('tab', { name: 'My details' });
    fireEvent.keyDown(first, { key: 'ArrowRight' });
    const password = screen.getByRole('tab', { name: /Password/ });
    expect(document.activeElement).toBe(password);
    fireEvent.keyDown(password, { key: 'ArrowRight' });
    const billing = screen.getByRole('tab', { name: 'Billing' });
    expect(document.activeElement).toBe(billing);
    expect(billing.getAttribute('aria-selected')).toBe('true');
    fireEvent.keyDown(billing, { key: 'Home' });
    expect(document.activeElement).toBe(first);
    fireEvent.keyDown(first, { key: 'ArrowLeft' });
    expect(document.activeElement).toBe(billing);
  });

  it('uses up/down when vertical and supports panel-less navigation tabs', () => {
    render(
      <Tabs
        aria-label="Sections"
        type="line"
        items={[
          { id: 'a', label: 'A' },
          { id: 'b', label: 'B' },
        ]}
      />,
    );
    expect(screen.getByRole('tablist').getAttribute('aria-orientation')).toBe('vertical');
    fireEvent.keyDown(screen.getByRole('tab', { name: 'A' }), { key: 'ArrowDown' });
    expect(screen.getByRole('tab', { name: 'B' }).getAttribute('aria-selected')).toBe('true');
    expect(screen.queryByRole('tabpanel')).toBeNull();
    expect(screen.getByRole('tab', { name: 'A' }).hasAttribute('aria-controls')).toBe(false);
  });
});

describe('Untitled UI Breadcrumbs', () => {
  const items = [
    { label: 'Home', href: '/', icon: HomeLine, iconOnly: true },
    { label: 'Settings', href: '/settings' },
    { label: 'Team', href: '/settings/team' },
    { label: 'Members', href: '/settings/team/members' },
  ];

  it('is a breadcrumb landmark with links and a current page', () => {
    render(<Breadcrumbs items={items} />);
    const nav = screen.getByRole('navigation', { name: 'Breadcrumb' });
    expect(nav.querySelectorAll('li')).toHaveLength(4);
    expect(screen.getByRole('link', { name: 'Home' }).getAttribute('href')).toBe('/');
    const current = screen.getByText('Members').closest('[aria-current]');
    expect(current?.getAttribute('aria-current')).toBe('page');
    expect(current?.tagName).toBe('SPAN');
  });

  it('collapses the middle with maxItems and supports the slash divider', () => {
    const { container } = render(<Breadcrumbs items={items} maxItems={3} divider="slash" />);
    expect(container.querySelectorAll('li')).toHaveLength(4);
    expect(container.textContent).toContain('…');
    expect(screen.queryByRole('link', { name: 'Settings' })).toBeNull();
    expect(container.querySelector('.uui-breadcrumbs__divider')?.textContent).toBe('/');
  });
});

describe('Untitled UI Pagination', () => {
  it('computes a 7-slot page range with ellipses', () => {
    expect(paginationRange(1, 5)).toEqual([1, 2, 3, 4, 5]);
    expect(paginationRange(2, 10)).toEqual([1, 2, 3, 4, 5, 'ellipsis', 10]);
    expect(paginationRange(6, 10)).toEqual([1, 'ellipsis', 5, 6, 7, 'ellipsis', 10]);
    expect(paginationRange(9, 10)).toEqual([1, 'ellipsis', 6, 7, 8, 9, 10]);
  });

  it('marks the current page and moves with numbers and Previous/Next', () => {
    const onPageChange = vi.fn();
    render(<Pagination page={1} pageCount={10} onPageChange={onPageChange} shape="circle" />);
    screen.getByRole('navigation', { name: 'Pagination' });
    expect(screen.getByRole('button', { name: 'Page 1' }).getAttribute('aria-current')).toBe(
      'page',
    );
    expect((screen.getByRole('button', { name: 'Previous' }) as HTMLButtonElement).disabled).toBe(
      true,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(onPageChange).toHaveBeenLastCalledWith(2);
    fireEvent.click(screen.getByRole('button', { name: 'Page 10' }));
    expect(onPageChange).toHaveBeenLastCalledWith(10);
    fireEvent.click(screen.getByRole('button', { name: 'Page 1' }));
    expect(onPageChange).toHaveBeenCalledTimes(2);
  });

  it('shows "Page N of M" in the card layout', () => {
    const onPageChange = vi.fn();
    render(<Pagination type="card" page={10} pageCount={10} onPageChange={onPageChange} />);
    expect(screen.getByText('Page 10 of 10')).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Next' }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Previous' }));
    expect(onPageChange).toHaveBeenCalledWith(9);
  });

  it('renders a dot group with a current dot', () => {
    const onChange = vi.fn();
    render(<PaginationDots count={4} current={1} onChange={onChange} variant="line" framed />);
    expect(screen.getByRole('button', { name: 'Slide 2' }).getAttribute('aria-current')).toBe(
      'true',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Slide 4' }));
    expect(onChange).toHaveBeenCalledWith(3);
  });
});

describe('Untitled UI Alert and Notification', () => {
  it('announces errors assertively and others politely', () => {
    render(
      <>
        <Alert color="error" title="Payment failed">
          Check your card details.
        </Alert>
        <Alert color="success" title="Saved" />
      </>,
    );
    expect(screen.getByRole('alert', { name: 'Payment failed' }).textContent).toContain(
      'Check your card details.',
    );
    expect(screen.getByRole('status', { name: 'Saved' }).getAttribute('data-color')).toBe(
      'success',
    );
  });

  it('renders actions and a close button', () => {
    const onClose = vi.fn();
    render(
      <Alert
        title="New version"
        actions={<button type="button">View changes</button>}
        onClose={onClose}
      />,
    );
    screen.getByRole('button', { name: 'View changes' });
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('uses the square featured icon for Default and the outline icon otherwise', () => {
    const { container } = render(
      <>
        <Alert title="A" />
        <Alert title="B" color="warning" />
        <Alert title="C" icon={null} />
      </>,
    );
    const alerts = container.querySelectorAll('.uui-alert');
    expect(alerts[0].querySelector('.uui-alert__featured')).not.toBeNull();
    expect(alerts[1].querySelector('.uui-featured-outline')?.getAttribute('data-color')).toBe(
      'warning',
    );
    expect(alerts[2].querySelector('svg')).toBeNull();
  });

  it('renders a notification card, brand by default', () => {
    const { container } = render(<Notification title="Update available" />);
    const card = container.querySelector('.uui-notification');
    expect(card?.getAttribute('data-color')).toBe('brand');
    expect(screen.getByRole('status', { name: 'Update available' })).toBe(card);
  });
});

describe('Untitled UI LoadingIndicator and ContentDivider', () => {
  it('is a status with a visible or hidden label', () => {
    render(
      <>
        <LoadingIndicator size="xl" variant="dot-circle" />
        <LoadingIndicator label="Saving" hideLabel />
      </>,
    );
    const [first, second] = screen.getAllByRole('status');
    expect(first.textContent).toBe('Loading...');
    expect(first.getAttribute('data-size')).toBe('xl');
    expect(first.querySelectorAll('circle')).toHaveLength(8);
    expect(second.querySelector('.uui-sr-only')?.textContent).toBe('Saving');
  });

  it('renders a plain separator or a divider with content', () => {
    const { container } = render(
      <>
        <ContentDivider />
        <ContentDivider>Today</ContentDivider>
        <ContentDivider variant="dual-line">Yesterday</ContentDivider>
      </>,
    );
    expect(screen.getAllByRole('separator')).toHaveLength(1);
    const dividers = container.querySelectorAll('.uui-divider');
    expect(dividers[1].querySelectorAll('.uui-divider__line')).toHaveLength(2);
    expect(dividers[2].querySelectorAll('.uui-divider__line')).toHaveLength(0);
    expect(dividers[2].textContent).toBe('Yesterday');
  });
});
