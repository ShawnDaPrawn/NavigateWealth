import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TabStrip } from '../TabStrip';
import type { TabStripOption } from '../TabStrip';

// Minimal icon stub for tests
const IconStub = ({ className }: { className?: string }) => (
  <svg data-testid="icon" className={className} />
);

const options: TabStripOption[] = [
  { id: 'tab1', label: 'Overview' },
  { id: 'tab2', label: 'Details' },
];

const icons = {
  tab1: IconStub,
  tab2: IconStub,
};

describe('TabStrip', () => {
  it('renders all tab labels', () => {
    render(
      <TabStrip
        options={options}
        activeId="tab1"
        icons={icons}
        onSelect={() => {}}
        onPrev={() => {}}
        onNext={() => {}}
        scrollRef={{ current: null }}
      />,
    );
    expect(screen.getByText('Overview')).toBeDefined();
    expect(screen.getByText('Details')).toBeDefined();
  });

  it('marks active tab with aria-selected=true', () => {
    render(
      <TabStrip
        options={options}
        activeId="tab1"
        icons={icons}
        onSelect={() => {}}
        onPrev={() => {}}
        onNext={() => {}}
        scrollRef={{ current: null }}
      />,
    );
    const overviewBtn = screen.getByRole('tab', { name: 'Overview' });
    expect(overviewBtn.getAttribute('aria-selected')).toBe('true');
    const detailsBtn = screen.getByRole('tab', { name: 'Details' });
    expect(detailsBtn.getAttribute('aria-selected')).toBe('false');
  });

  it('calls onSelect with the tab id when clicked', () => {
    const onSelect = vi.fn();
    render(
      <TabStrip
        options={options}
        activeId="tab1"
        icons={icons}
        onSelect={onSelect}
        onPrev={() => {}}
        onNext={() => {}}
        scrollRef={{ current: null }}
      />,
    );
    fireEvent.click(screen.getByText('Details'));
    expect(onSelect).toHaveBeenCalledWith('tab2');
  });

  it('calls onPrev when previous arrow is clicked', () => {
    const onPrev = vi.fn();
    render(
      <TabStrip
        options={options}
        activeId="tab1"
        icons={icons}
        onSelect={() => {}}
        onPrev={onPrev}
        onNext={() => {}}
        scrollRef={{ current: null }}
      />,
    );
    fireEvent.click(screen.getByLabelText('Previous tab'));
    expect(onPrev).toHaveBeenCalledOnce();
  });

  it('calls onNext when next arrow is clicked', () => {
    const onNext = vi.fn();
    render(
      <TabStrip
        options={options}
        activeId="tab1"
        icons={icons}
        onSelect={() => {}}
        onPrev={() => {}}
        onNext={onNext}
        scrollRef={{ current: null }}
      />,
    );
    fireEvent.click(screen.getByLabelText('Next tab'));
    expect(onNext).toHaveBeenCalledOnce();
  });

  it('uses custom ariaLabel on tablist', () => {
    render(
      <TabStrip
        options={options}
        activeId="tab1"
        icons={icons}
        onSelect={() => {}}
        onPrev={() => {}}
        onNext={() => {}}
        scrollRef={{ current: null }}
        ariaLabel="Service categories"
      />,
    );
    expect(screen.getByRole('tablist', { name: 'Service categories' })).toBeDefined();
  });
});
