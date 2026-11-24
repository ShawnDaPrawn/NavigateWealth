/**
 * What ErrorBoundary shows, in the Navigator design (StatusScreen): a render
 * crash, and a stale build after a deploy ("a new version is ready"), each
 * full-screen and inline. Reporting has its own suite
 * (ErrorBoundary.reporting.test.tsx); here it is stubbed out.
 *
 * Run: npx vitest run src/components/shared/__tests__/ErrorBoundary.fallback.test.tsx
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';

vi.mock('../../../utils/quality/runtimeIssueReporter', () => ({
  markErrorReported: vi.fn(),
  reportRuntimeClientIssue: vi.fn(async () => undefined),
}));
vi.mock('../../../utils/logger', () => ({
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));
const reloadOnceForStaleChunk = vi.hoisted(() => vi.fn(() => false));
vi.mock('../../../utils/staleChunkRecovery', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../utils/staleChunkRecovery')>()),
  reloadOnceForStaleChunk,
}));

const { ErrorBoundary } = await import('../ErrorBoundary');

let shouldThrow = true;
let thrown: Error = new TypeError("Cannot read properties of undefined (reading 'map')");

function Crashy() {
  if (shouldThrow) throw thrown;
  return <p>Recovered content</p>;
}

const reload = vi.fn();
const originalLocation = window.location;

beforeEach(() => {
  shouldThrow = true;
  thrown = new TypeError("Cannot read properties of undefined (reading 'map')");
  vi.spyOn(console, 'error').mockImplementation(() => {});
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: { ...originalLocation, reload, href: originalLocation.href },
  });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  reload.mockReset();
  reloadOnceForStaleChunk.mockClear();
  Object.defineProperty(window, 'location', { configurable: true, value: originalLocation });
});

describe('ErrorBoundary: a render crash', () => {
  it('shows the status screen with the boundary title as its label', () => {
    render(
      <ErrorBoundary fallbackTitle="Application Error">
        <Crashy />
      </ErrorBoundary>,
    );
    const alert = screen.getByRole('alert');
    expect(alert.className).toContain('nws--page');
    expect(screen.getByRole('heading', { level: 1, name: 'Something went wrong' })).toBeDefined();
    expect(screen.getByText('Application Error')).toBeDefined();
    expect(screen.getByText(/We've been notified/)).toBeDefined();
  });

  it("uses the boundary's own message, and folds the raw error into technical details", () => {
    render(
      <ErrorBoundary fallbackMessage="Unable to verify the document.">
        <Crashy />
      </ErrorBoundary>,
    );
    expect(screen.getByText('Unable to verify the document.')).toBeDefined();
    const details = screen.getByText('Technical details').closest('details');
    expect(details).not.toBeNull();
    expect(details?.open).toBe(false);
    expect(details?.textContent).toContain("reading 'map'");
  });

  it('puts focus on "Try again", which re-renders the children', () => {
    render(
      <ErrorBoundary>
        <Crashy />
      </ErrorBoundary>,
    );
    const retry = screen.getByRole('button', { name: 'Try again' });
    expect(document.activeElement).toBe(retry);
    shouldThrow = false;
    fireEvent.click(retry);
    expect(screen.getByText('Recovered content')).toBeDefined();
  });

  it('"Return home" goes to the home page', () => {
    render(
      <ErrorBoundary>
        <Crashy />
      </ErrorBoundary>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Return home' }));
    expect(window.location.href).toBe('/');
  });

  it('inline, it is the card alone and does not take focus', () => {
    function Page() {
      const [n] = useState(0);
      return (
        <main>
          <button type="button">Outside {n}</button>
          <ErrorBoundary inline fallbackTitle="Page Error">
            <Crashy />
          </ErrorBoundary>
        </main>
      );
    }
    render(<Page />);
    expect(screen.getByRole('alert').className).toContain('nws--inline');
    expect(screen.getByRole('heading', { name: "This page didn't load" })).toBeDefined();
    expect(screen.getByText('Page Error')).toBeDefined();
    expect(document.activeElement).toBe(document.body);
  });
});

describe('ErrorBoundary: a stale build after a deploy', () => {
  beforeEach(() => {
    thrown = new TypeError(
      'Failed to fetch dynamically imported module: https://example.test/assets/Page-abc.js',
    );
  });

  it('says a new version is ready and offers one action, a refresh', () => {
    render(
      <ErrorBoundary fallbackTitle="Application Error">
        <Crashy />
      </ErrorBoundary>,
    );
    expect(reloadOnceForStaleChunk).toHaveBeenCalled();
    expect(screen.getByRole('heading', { name: 'A new version is ready' })).toBeDefined();
    expect(screen.getByText('Update available')).toBeDefined();
    expect(screen.getByText(/You'll stay signed in/)).toBeDefined();
    // Nothing broke, so no error label and no technical details.
    expect(screen.queryByText('Application Error')).toBeNull();
    expect(screen.queryByText('Technical details')).toBeNull();

    const buttons = screen.getAllByRole('button');
    expect(buttons.map((b) => b.textContent)).toEqual(['Refresh now']);
    expect(document.activeElement).toBe(buttons[0]);
    fireEvent.click(buttons[0]);
    expect(reload).toHaveBeenCalled();
  });

  it('inline, shows the same message in the card', () => {
    render(
      <ErrorBoundary inline>
        <Crashy />
      </ErrorBoundary>,
    );
    expect(screen.getByRole('alert').className).toContain('nws--inline');
    expect(screen.getByRole('heading', { name: 'A new version is ready' })).toBeDefined();
  });
});
