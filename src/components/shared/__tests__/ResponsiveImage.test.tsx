import { Children, isValidElement, type ComponentProps, type ReactElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import { render } from '@testing-library/react';

import { ResponsiveImage } from '../ResponsiveImage';

/** The props ResponsiveImage passes to its <img>, read from the element tree. */
function imgProps(props: ComponentProps<typeof ResponsiveImage>): Record<string, unknown> {
  const picture = ResponsiveImage(props) as ReactElement<{ children: unknown }>;
  const img = Children.toArray(picture.props.children as never).find(
    (child): child is ReactElement<Record<string, unknown>> =>
      isValidElement(child) && child.type === 'img',
  );
  if (!img) throw new Error('ResponsiveImage rendered no <img>');
  return img.props;
}

/**
 * React 18 does not know the camel-cased `fetchPriority` DOM prop. Passing it
 * straight to <img> logs "React does not recognize the `fetchPriority` prop on
 * a DOM element" on every page that renders a provider logo. ResponsiveImage
 * keeps `fetchPriority` as its public prop name but must emit the lower-case
 * `fetchpriority` attribute instead.
 *
 * React warns about an unknown prop only once per prop name per module
 * instance, so the console check below can only catch a regression on the
 * first render in this file. The element-level test does not depend on that
 * dedupe: it inspects the props handed to <img> directly.
 */
describe('ResponsiveImage fetch priority', () => {
  let consoleError: MockInstance<typeof console.error>;

  beforeEach(() => {
    consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleError.mockRestore();
  });

  function unknownPropWarnings() {
    return consoleError.mock.calls.filter((args) =>
      args.some((arg) => typeof arg === 'string' && /does not recognize|fetchPriority/i.test(arg)),
    );
  }

  it('sets fetchpriority="high" on the <img> when requested, without a React warning', () => {
    const { container } = render(
      <ResponsiveImage imageKey="team/founder" alt="Founder" fetchPriority="high" />,
    );

    const img = container.querySelector('img');
    expect(img).not.toBeNull();
    expect(img?.getAttribute('fetchpriority')).toBe('high');
    expect(unknownPropWarnings()).toEqual([]);
  });

  it.each(['high', 'low'] as const)(
    'hands <img> a lower-case fetchpriority="%s" and never the camel-cased prop',
    (priority) => {
      const props = imgProps({ imageKey: 'team/founder', alt: 'Founder', fetchPriority: priority });
      expect(props).not.toHaveProperty('fetchPriority');
      expect(props).toHaveProperty('fetchpriority', priority);
    },
  );

  it('hands <img> neither spelling for the default "auto" priority', () => {
    const props = imgProps({ imageKey: 'team/founder', alt: 'Founder' });
    expect(props).not.toHaveProperty('fetchPriority');
    expect(props).not.toHaveProperty('fetchpriority');
  });

  it('passes fetchpriority="low" through as well', () => {
    const { container } = render(
      <ResponsiveImage imageKey="team/founder" alt="Founder" fetchPriority="low" />,
    );

    expect(container.querySelector('img')?.getAttribute('fetchpriority')).toBe('low');
    expect(unknownPropWarnings()).toEqual([]);
  });

  it('omits the attribute for the default "auto" priority', () => {
    const { container } = render(<ResponsiveImage imageKey="team/founder" alt="Founder" />);

    expect(container.querySelector('img')?.hasAttribute('fetchpriority')).toBe(false);
    expect(unknownPropWarnings()).toEqual([]);
  });

  it('still renders the AVIF/WebP sources and the fallback <img>', () => {
    const { container } = render(
      <ResponsiveImage
        imageKey="team/founder"
        alt="Founder"
        fallbackSrc="/founder.png"
        loading="eager"
        width={100}
        height={50}
      />,
    );

    const sources = container.querySelectorAll('picture > source');
    expect(Array.from(sources).map((s) => s.getAttribute('type'))).toEqual([
      'image/avif',
      'image/webp',
    ]);
    const img = container.querySelector('picture > img');
    expect(img?.getAttribute('src')).toBe('/founder.png');
    expect(img?.getAttribute('alt')).toBe('Founder');
    expect(img?.getAttribute('loading')).toBe('eager');
    expect(img?.getAttribute('width')).toBe('100');
    expect(consoleError).not.toHaveBeenCalled();
  });
});
