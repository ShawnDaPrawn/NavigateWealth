import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, waitFor, act, fireEvent } from '@testing-library/react';
import { DesignSystemLibrary } from '../DesignSystemLibrary';
import {
  isLibraryMessage,
  LIBRARY_PATH,
  STICKY_HEADER_HEIGHT,
  viewportMessage,
} from '../designSystemLibraryMessages';

const TITLE = 'Navigate Wealth component library';

/** Renders the embed and simulates the iframe loading a page, with or without the library marker. */
function renderLoaded(withMarker: boolean) {
  render(<DesignSystemLibrary />);
  const frame = screen.getByTitle(TITLE) as HTMLIFrameElement;
  const doc = frame.contentDocument;
  if (withMarker && doc) {
    const meta = doc.createElement('meta');
    meta.setAttribute('name', 'nw-design-system-library');
    meta.setAttribute('content', '1');
    // jsdom leaves the iframe's about:blank document empty.
    const root = doc.documentElement ?? doc.appendChild(doc.createElement('html'));
    root.appendChild(meta);
  }
  fireEvent.load(frame);
  return frame;
}

function postFromFrame(
  frame: HTMLIFrameElement | null,
  data: unknown,
  origin = window.location.origin,
) {
  act(() => {
    window.dispatchEvent(
      new MessageEvent('message', { data, origin, source: frame ? frame.contentWindow : window }),
    );
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('isLibraryMessage', () => {
  it('accepts height and scrollTo messages from the library', () => {
    expect(isLibraryMessage({ source: 'nw-design-system', type: 'height', height: 10 })).toBe(true);
    expect(isLibraryMessage({ source: 'nw-design-system', type: 'scrollTo', top: 5 })).toBe(true);
  });

  it('rejects anything else', () => {
    expect(isLibraryMessage(null)).toBe(false);
    expect(isLibraryMessage('height')).toBe(false);
    expect(isLibraryMessage({ source: 'other', type: 'height', height: 10 })).toBe(false);
    expect(isLibraryMessage({ source: 'nw-design-system', type: 'height', height: '10' })).toBe(
      false,
    );
    expect(isLibraryMessage({ source: 'nw-design-system', type: 'navigate', top: 1 })).toBe(false);
  });
});

describe('viewportMessage', () => {
  it('gives the on-screen part of the iframe, below the sticky header', () => {
    // Iframe starts 500px down a 900px window: its first 400px are visible.
    expect(viewportMessage({ top: 500, height: 90000 }, 900)).toMatchObject({
      type: 'viewport',
      top: 0,
      height: 400,
    });
    // Scrolled 10,000px into the iframe: the window shows 10,072 to 10,900.
    expect(viewportMessage({ top: -10000, height: 90000 }, 900)).toMatchObject({
      top: 10000 + STICKY_HEADER_HEIGHT,
      height: 900 - STICKY_HEADER_HEIGHT,
    });
    // Near the end: the window runs past the bottom of the iframe.
    expect(viewportMessage({ top: -89500, height: 90000 }, 900)).toMatchObject({
      top: 89500 + STICKY_HEADER_HEIGHT,
      height: 500 - STICKY_HEADER_HEIGHT,
    });
  });

  it('never reports a negative height when the iframe is off screen', () => {
    expect(viewportMessage({ top: 2000, height: 90000 }, 900).height).toBe(0);
    expect(viewportMessage({ top: -95000, height: 90000 }, 900).height).toBe(0);
  });
});

describe('DesignSystemLibrary', () => {
  it('shows a loading notice until the library page has loaded', () => {
    render(<DesignSystemLibrary />);
    expect(screen.getByText('Loading the component library…')).toBeTruthy();
    expect(screen.getByTitle(TITLE).getAttribute('src')).toBe(LIBRARY_PATH);
  });

  it('keeps the iframe when the library page loads', () => {
    const frame = renderLoaded(true);
    expect(screen.queryByText('Loading the component library…')).toBeNull();
    expect(frame.className).toContain('w-full');
    expect(frame.getAttribute('aria-hidden')).toBeNull();
  });

  it('reloads the library, rather than giving up, if the iframe is navigated away from it', () => {
    const frame = renderLoaded(true);
    frame.contentDocument?.querySelector('meta[name="nw-design-system-library"]')?.remove();
    frame.setAttribute('src', 'https://www.fsca.co.za/');
    fireEvent.load(frame);
    expect(screen.queryByText('The component library is not built here')).toBeNull();
    expect(screen.getByTitle(TITLE).getAttribute('src')).toBe(LIBRARY_PATH);
  });

  it('shows build instructions when the site answers instead of the library', () => {
    renderLoaded(false);
    expect(screen.getByText('The component library is not built here')).toBeTruthy();
    expect(screen.queryByTitle(TITLE)).toBeNull();
  });

  it('sizes the iframe from height messages sent by the iframe only', async () => {
    const frame = renderLoaded(true);
    expect(frame.style.height).toBe('1200px');

    // From another window: ignored.
    postFromFrame(null, { source: 'nw-design-system', type: 'height', height: 4321 });
    expect(frame.style.height).toBe('1200px');

    postFromFrame(frame, { source: 'nw-design-system', type: 'height', height: 4321 });
    await waitFor(() => expect(frame.style.height).toBe('4321px'));

    // Wrong origin: ignored.
    postFromFrame(
      frame,
      { source: 'nw-design-system', type: 'height', height: 999 },
      'https://evil.example',
    );
    expect(frame.style.height).toBe('4321px');
  });

  it('scrolls the page when the library asks to jump to a section', () => {
    const scrollTo = vi.fn();
    vi.stubGlobal('scrollTo', scrollTo);
    const frame = renderLoaded(true);
    postFromFrame(frame, { source: 'nw-design-system', type: 'scrollTo', top: 500 });
    expect(scrollTo).toHaveBeenCalledWith(expect.objectContaining({ behavior: 'smooth' }));
  });

  it('tells the library which part of it is on screen, and again on scroll', async () => {
    const frame = renderLoaded(true);
    const post = vi.spyOn(frame.contentWindow as Window, 'postMessage');
    act(() => {
      window.dispatchEvent(new Event('scroll'));
    });
    await waitFor(() =>
      expect(post).toHaveBeenCalledWith(
        expect.objectContaining({ source: 'nw-design-system-host', type: 'viewport' }),
        window.location.origin,
      ),
    );
  });
});
