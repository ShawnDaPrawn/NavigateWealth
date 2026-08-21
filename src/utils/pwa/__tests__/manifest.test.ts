import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

/**
 * Guards the installed-app launch contract declared in `public/manifest.json`.
 *
 * These fields are what the operating system remembers about the installed app,
 * so a careless edit here changes behaviour on every client's device without any
 * code change being visible in a component diff.
 */
const manifest = JSON.parse(
  readFileSync(path.resolve(process.cwd(), 'public/manifest.json'), 'utf8'),
) as {
  id: string;
  start_url: string;
  scope: string;
  display: string;
  launch_handler?: { client_mode?: string };
};

describe('PWA manifest launch behaviour', () => {
  it('reuses the open app window instead of opening a second one', () => {
    // Without an explicit `launch_handler`, Chromium falls back to
    // `client_mode: "auto"`, which on desktop means "navigate-new" — every click
    // of the app icon spawns ANOTHER app window. Any window left open (or
    // restored by Chrome on start-up) therefore leaves the user staring at two
    // Navigate Wealth login windows. `focus-existing` brings the window they
    // already have to the front, the way a native app does.
    expect(manifest.launch_handler?.client_mode).toBe('focus-existing');
  });

  it('keeps the app identity stable so devices do not register a second app', () => {
    // Changing `id` makes the browser treat this as a brand-new app: the old
    // install stays on the device and a second icon appears alongside it. It
    // must stay exactly as first shipped.
    expect(manifest.id).toBe('/login');
    expect(manifest.start_url).toBe('/login');
  });

  it('scopes the installed app to the whole site in standalone display', () => {
    expect(manifest.scope).toBe('/');
    expect(manifest.display).toBe('standalone');
  });
});
