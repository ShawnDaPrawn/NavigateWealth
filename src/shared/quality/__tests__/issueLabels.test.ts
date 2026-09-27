/**
 * Issue labels — the text an admin reads on the Issues dashboard.
 *
 * Before this module, runtime issues were titled with the bare error class
 * ("TypeError") and the same bug hit on two records became two issues. These
 * tests pin the labels for the failures people actually hit and the grouping
 * rules that keep one bug as one issue.
 *
 * Run: npx vitest run src/shared/quality/__tests__/issueLabels.test.ts
 */
import { describe, expect, it } from 'vitest';
import {
  areaFromHref,
  chunkNameFromStack,
  describeRuntimeIssue,
  describeStoredIssue,
  normalizeMessageForGrouping,
  normalizeRoutePath,
  splitLegacyMessage,
} from '../issueLabels';

describe('describeRuntimeIssue — browser crashes', () => {
  it('names the property, the missing value and the screen for a null read', () => {
    const labels = describeRuntimeIssue({
      kind: 'react-error-boundary',
      errorName: 'TypeError',
      message: "Cannot read properties of undefined (reading 'map')",
      href: 'https://app.example/admin?module=clients',
      stack:
        'TypeError: x\n  at a (https://app.example/assets/ClientManagementModule-3fa2b1c4.js:1:2345)',
    });

    expect(labels.title).toBe(
      "Screen crashed: Read 'map' of undefined · Admin · Clients (Client Management Module)",
    );
    expect(labels.summary).toContain('`.map`');
    expect(labels.summary).toContain('Where: Admin · Clients');
    expect(labels.likelyCause).toMatch(/optional chaining/);
    expect(labels.pattern).toBe('null-property-read');
  });

  it('understands the Safari wording of the same failure', () => {
    const labels = describeRuntimeIssue({
      kind: 'window-error',
      errorName: 'TypeError',
      message: "undefined is not an object (evaluating 'client.policies.length')",
    });
    expect(labels.pattern).toBe('null-property-read');
    expect(labels.title).toContain("Read 'length' of a missing value");
  });

  it('explains array methods called on a non-array', () => {
    const labels = describeRuntimeIssue({
      kind: 'window-error',
      errorName: 'TypeError',
      message: 'data.filter is not a function',
    });
    expect(labels.summary).toContain('not an array');
    expect(labels.likelyCause).toMatch(/expected to be an array/);
  });

  it('decodes minified React errors', () => {
    const labels = describeRuntimeIssue({
      kind: 'window-error',
      errorName: 'Error',
      message: 'Minified React error #185; visit https://react.dev/errors/185',
    });
    expect(labels.title).toContain('Infinite re-render loop');
    expect(labels.pattern).toBe('react-185');
  });

  it('recognises a stale deploy as such', () => {
    const labels = describeRuntimeIssue({
      kind: 'unhandled-rejection',
      errorName: 'TypeError',
      message: 'Failed to fetch dynamically imported module: https://x/assets/Foo-abc12345.js',
    });
    expect(labels.pattern).toBe('stale-chunk');
    expect(labels.likelyCause).toMatch(/reload/i);
  });

  it('falls back to the cleaned message when nothing matches', () => {
    const labels = describeRuntimeIssue({
      kind: 'window-error',
      errorName: 'Error',
      message: 'Error: Something specific went wrong',
      href: 'https://app.example/',
    });
    expect(labels.title).toBe('Crash: Something specific went wrong · Public site · Home');
    expect(labels.likelyCause).toBeUndefined();
  });
});

describe('describeRuntimeIssue — handled errors', () => {
  it("leads with the developer's own description", () => {
    const labels = describeRuntimeIssue({
      kind: 'handled-error',
      errorName: 'APIError',
      message: 'Server returned 500: Internal Server Error',
      context: 'Failed to load client policies',
      href: 'https://app.example/admin?module=policies',
    });
    expect(labels.title).toBe(
      'Handled error: Failed to load client policies — Server error (500) · Admin · Policies',
    );
    expect(labels.summary.startsWith('Failed to load client policies.')).toBe(true);
  });
});

describe('describeRuntimeIssue — server and API failures', () => {
  it('uses the route shape and the route’s own message for a hand-built 500', () => {
    const labels = describeRuntimeIssue({
      kind: 'server-error-response',
      errorName: 'HTTP 500',
      message: 'Failed to generate download URL',
      method: 'GET',
      path: '/make-server-91ed8379/documents/3f2a1b4c-1234-4abc-8def-1234567890ab/download',
      statusCode: 500,
    });
    expect(labels.title).toBe(
      'GET /documents/:id/download failed (500): Failed to generate download URL',
    );
    expect(labels.route).toBe('/documents/:id/download');
    expect(labels.area).toBe('API · Documents');
  });

  it('explains database failures inside a server message', () => {
    const labels = describeRuntimeIssue({
      kind: 'server-error-response',
      message: 'Failed to save: duplicate key value violates unique constraint "clients_email_key"',
      method: 'POST',
      path: '/clients',
      statusCode: 500,
    });
    expect(labels.title).toBe('POST /clients failed (500): Duplicate record');
    expect(labels.summary).toContain('clients_email_key');
  });

  it('says what a gateway 504 means without repeating the path', () => {
    const labels = describeRuntimeIssue({
      kind: 'api-failure',
      errorName: 'HTTP 504',
      message: 'GET /clients/12/policies returned 504',
      method: 'GET',
      path: '/clients/12/policies',
      statusCode: 504,
    });
    expect(labels.title).toBe('GET /clients/:id/policies failed (504): Server took too long');
    expect(labels.likelyCause).toMatch(/function logs/);
  });
});

describe('grouping', () => {
  it('collapses ids, emails and numbers so one bug is one issue', () => {
    const a = normalizeMessageForGrouping(
      'Client 3f2a1b4c-1234-4abc-8def-1234567890ab not found for a@b.co (attempt 2)',
    );
    const b = normalizeMessageForGrouping(
      'Client 99999999-1234-4abc-8def-1234567890ab not found for c@d.com (attempt 7)',
    );
    expect(a).toBe(b);
  });

  it('keeps different failures apart', () => {
    expect(normalizeMessageForGrouping("reading 'map'")).not.toBe(
      normalizeMessageForGrouping("reading 'name'"),
    );
  });

  it('turns concrete paths into route shapes', () => {
    expect(
      normalizeRoutePath('/make-server-91ed8379/clients/3f2a1b4c-1234-4abc-8def-1234567890ab/x/42'),
    ).toBe('/clients/:id/x/:id');
    expect(normalizeRoutePath('https://h/make-server-91ed8379/esign/envelopes?x=1')).toBe(
      '/esign/envelopes',
    );
    expect(normalizeRoutePath('/sign/aB3dE5fG7hJ9kL1mN3pQ5rS7')).toBe('/sign/:id');
  });
});

describe('area detection', () => {
  it('names admin modules, portal pages and public pages', () => {
    expect(areaFromHref('https://h/admin?module=tasks')).toBe('Admin · Tasks');
    expect(areaFromHref('https://h/admin')).toBe('Admin · Dashboard');
    expect(areaFromHref('https://h/portal/documents')).toBe('Client portal · Documents');
    expect(areaFromHref('https://h/')).toBe('Public site · Home');
  });

  it('reads the lazy chunk name out of a production stack and skips vendor chunks', () => {
    expect(
      chunkNameFromStack(
        'at a (https://h/assets/vendor-abcdef12.js:1:1)\nat b (https://h/assets/TasksModule-12ab34cd.js:1:1)',
      ),
    ).toBe('TasksModule');
    expect(chunkNameFromStack('at a (https://h/assets/index-abcdef12.js:1:1)')).toBeUndefined();
  });
});

describe('legacy issues', () => {
  it('splits the old message blob into the error and its context', () => {
    expect(splitLegacyMessage('Boom\nUser: a@b.co\n\nURL: https://h/admin')).toEqual({
      text: 'Boom',
      details: 'User: a@b.co\n\nURL: https://h/admin',
    });
    expect(splitLegacyMessage('Just one line')).toEqual({ text: 'Just one line' });
  });

  it('relabels a stored "TypeError" issue from what its message still holds', () => {
    const labels = describeStoredIssue({
      source: 'runtime-client',
      title: 'TypeError',
      ruleId: 'react-error-boundary',
      message:
        "Cannot read properties of null (reading 'name')\nUser: a@b.co\n\nURL: https://h/admin?module=tasks\n\nStack:\nTypeError: x\n at y (https://h/assets/TaskManagementModule-12ab34cd.js:1:1)",
    });
    expect(labels.title).toBe(
      "Screen crashed: Read 'name' of null · Admin · Tasks (Task Management Module)",
    );
    expect(labels.text).toBe("Cannot read properties of null (reading 'name')");
    expect(labels.details).toContain('URL: https://h/admin?module=tasks');
  });

  it('relabels a legacy server issue using its recorded request line', () => {
    const labels = describeStoredIssue({
      source: 'runtime-server',
      title: 'TypeError',
      filePath: '/documents/7',
      message: 'x.map is not a function\n\nRequest: GET /documents/7\n\nStatus: 500',
    });
    expect(labels.title).toBe("GET /documents/:id failed (500): 'x.map' is not a function");
  });

  it('leaves non-runtime issues untouched', () => {
    const labels = describeStoredIssue({ source: 'build', title: 'Lint', message: 'no-unused' });
    expect(labels).toEqual({ title: 'Lint', text: 'no-unused' });
  });

  it('prefers the labels an issue was stored with', () => {
    const labels = describeStoredIssue({
      source: 'runtime-client',
      title: 'Stored title',
      message: 'raw',
      summary: 'Stored summary',
      details: 'URL: x',
    });
    expect(labels.title).toBe('Stored title');
    expect(labels.summary).toBe('Stored summary');
    expect(labels.details).toBe('URL: x');
  });
});
