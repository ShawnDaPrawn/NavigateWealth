import { describe, it, expect, afterEach } from 'vitest';
import { isArticleEscapeHost, removeManifestLinkOnEscapeHost } from '../escapeHost';

function setHostname(hostname: string): void {
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: { ...window.location, hostname },
  });
}

describe('isArticleEscapeHost', () => {
  it('recognises the apex, which is where emailed article links land', () => {
    expect(isArticleEscapeHost('navigatewealth.co')).toBe(true);
    expect(isArticleEscapeHost('NavigateWealth.CO')).toBe(true);
  });

  it('does not treat the canonical www host as the escape host', () => {
    // www is the installed PWA's origin — suppressing the service worker or the
    // install prompt there would break the app itself.
    expect(isArticleEscapeHost('www.navigatewealth.co')).toBe(false);
    expect(isArticleEscapeHost('navigate-wealth.vercel.app')).toBe(false);
    expect(isArticleEscapeHost('localhost')).toBe(false);
  });
});

describe('removeManifestLinkOnEscapeHost', () => {
  afterEach(() => {
    document.head.innerHTML = '';
    setHostname('localhost');
  });

  it('drops the manifest on the apex so it never becomes installable', () => {
    document.head.innerHTML = '<link rel="manifest" href="/manifest.json">';
    setHostname('navigatewealth.co');

    removeManifestLinkOnEscapeHost();

    expect(document.querySelector('link[rel="manifest"]')).toBeNull();
  });

  it('leaves the manifest alone on the canonical host', () => {
    document.head.innerHTML = '<link rel="manifest" href="/manifest.json">';
    setHostname('www.navigatewealth.co');

    removeManifestLinkOnEscapeHost();

    expect(document.querySelector('link[rel="manifest"]')).not.toBeNull();
  });
});
