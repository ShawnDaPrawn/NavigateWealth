import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { Tabs, TabsList, TabsTrigger } from '../tabs';

afterEach(() => cleanup());

function Strip() {
  return (
    <Tabs defaultValue="one">
      <TabsList aria-label="Strip">
        <TabsTrigger value="one">One</TabsTrigger>
        <TabsTrigger value="two">Two</TabsTrigger>
        <TabsTrigger value="three">Three</TabsTrigger>
      </TabsList>
    </Tabs>
  );
}

/** jsdom does no layout, so give the strip the sizes a phone would. */
function sizeStrip(el: HTMLElement, { scrollWidth, clientWidth }: Record<string, number>) {
  Object.defineProperty(el, 'scrollWidth', { configurable: true, value: scrollWidth });
  Object.defineProperty(el, 'clientWidth', { configurable: true, value: clientWidth });
}

describe('tab strip (tabs wider than the screen)', () => {
  it('scrolls sideways instead of squeezing the tabs', () => {
    render(<Strip />);
    const list = screen.getByRole('tablist');
    expect(list.className).toContain('tab-strip');
    expect(list.className).not.toMatch(/\bgrid-cols-/);
  });

  it('marks no fade when every tab fits', () => {
    render(<Strip />);
    const list = screen.getByRole('tablist');
    sizeStrip(list, { scrollWidth: 300, clientWidth: 300 });
    fireEvent.scroll(list);
    expect(list.dataset.fadeStart).toBe('false');
    expect(list.dataset.fadeEnd).toBe('false');
  });

  it('fades the edge that has more tabs past it', () => {
    render(<Strip />);
    const list = screen.getByRole('tablist');
    sizeStrip(list, { scrollWidth: 600, clientWidth: 300 });

    list.scrollLeft = 0;
    fireEvent.scroll(list);
    expect(list.dataset.fadeStart).toBe('false');
    expect(list.dataset.fadeEnd).toBe('true');

    list.scrollLeft = 150;
    fireEvent.scroll(list);
    expect(list.dataset.fadeStart).toBe('true');
    expect(list.dataset.fadeEnd).toBe('true');

    list.scrollLeft = 300;
    fireEvent.scroll(list);
    expect(list.dataset.fadeStart).toBe('true');
    expect(list.dataset.fadeEnd).toBe('false');
  });
});
