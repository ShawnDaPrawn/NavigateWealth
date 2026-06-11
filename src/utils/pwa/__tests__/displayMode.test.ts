/**
 * Tests for the shared PWA display-mode detection.
 *
 * The critical behavior: a genuine installed PWA reads as standalone, but a
 * normal browser tab and — importantly — in-app browsers / WebViews that fake
 * `display-mode: standalone` must read as the website (not standalone).
 */

import { describe, expect, it, vi, afterEach } from 'vitest';
import { isInAppBrowser, isStandaloneDisplay } from '../displayMode';

function setUserAgent(ua: string): void {
  Object.defineProperty(window.navigator, 'userAgent', {
    value: ua,
    configurable: true,
  });
}

function setIosStandalone(value: boolean | undefined): void {
  Object.defineProperty(window.navigator, 'standalone', {
    value,
    configurable: true,
  });
}

function setDisplayModeStandalone(matches: boolean): void {
  vi.stubGlobal(
    'matchMedia',
    vi.fn().mockReturnValue({
      matches,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }),
  );
}

const CHROME_UA =
  'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36';

describe('isInAppBrowser', () => {
  afterEach(() => {
    setUserAgent(CHROME_UA);
    vi.unstubAllGlobals();
  });

  it('returns false for a normal mobile Chrome user agent', () => {
    setUserAgent(CHROME_UA);
    expect(isInAppBrowser()).toBe(false);
  });

  it.each([
    ['Facebook', `${CHROME_UA} [FBAN/EMA;FBAV/123.0]`],
    ['Instagram', `${CHROME_UA} Instagram 250.0.0.0`],
    ['WhatsApp', `${CHROME_UA} WhatsApp/2.23`],
    ['LinkedIn', `${CHROME_UA} LinkedInApp`],
    ['WeChat', `${CHROME_UA} MicroMessenger/8.0`],
    ['TikTok', `${CHROME_UA} musical_ly_2023`],
    ['Android WebView', 'Mozilla/5.0 (Linux; Android 13; wv) AppleWebKit/537.36 Chrome/120 Mobile'],
  ])('returns true inside the %s in-app browser', (_name, ua) => {
    setUserAgent(ua);
    expect(isInAppBrowser()).toBe(true);
  });
});

describe('isStandaloneDisplay', () => {
  afterEach(() => {
    setUserAgent(CHROME_UA);
    setIosStandalone(undefined);
    vi.unstubAllGlobals();
  });

  it('is true for a genuinely installed standalone PWA (normal UA)', () => {
    setUserAgent(CHROME_UA);
    setDisplayModeStandalone(true);
    expect(isStandaloneDisplay()).toBe(true);
  });

  it('is false in a normal browser tab', () => {
    setUserAgent(CHROME_UA);
    setDisplayModeStandalone(false);
    expect(isStandaloneDisplay()).toBe(false);
  });

  it('is false in an in-app browser that fakes display-mode: standalone', () => {
    setUserAgent(`${CHROME_UA} [FBAN/EMA;FBAV/123.0]`);
    setDisplayModeStandalone(true);
    expect(isStandaloneDisplay()).toBe(false);
  });

  it('is true for an iOS home-screen web app (navigator.standalone)', () => {
    setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Safari');
    setIosStandalone(true);
    setDisplayModeStandalone(false);
    expect(isStandaloneDisplay()).toBe(true);
  });
});
