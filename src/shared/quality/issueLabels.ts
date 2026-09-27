/**
 * Human labels for runtime issues
 * ===============================
 *
 * Runtime issues used to be titled with the bare JavaScript error class
 * ("TypeError", "Error", "Runtime error") and carried everything else — the
 * message, URL, user agent, both stacks — in one `message` blob. A dashboard
 * row therefore read "TypeError" over a wall of text, and two different bugs
 * with the same class name looked identical.
 *
 * This module turns the raw signal into four things a person can act on:
 *
 *   - `title`       — one line saying WHAT broke and WHERE
 *                     ("Crash: tried to read 'map' of undefined · Clients").
 *   - `summary`     — the same in a plain-English sentence.
 *   - `likelyCause` — the usual reason this class of failure happens and where
 *                     to look first. Pattern-based, so it is a hint, not a
 *                     diagnosis.
 *   - `area`        — the product area (admin module, portal page, API route
 *                     family) the failure happened in.
 *
 * It also owns the GROUPING rules (`normalizeMessageForGrouping`,
 * `normalizeRoutePath`) so that the same bug hit with different record ids
 * collapses into one issue instead of one issue per client.
 *
 * Pure and dependency-free on purpose: the Edge Function imports it at ingest
 * time, and the admin UI imports it to relabel issues that were stored before
 * this module existed. Both must produce the same text.
 */

export type RuntimeIssueKind =
  | 'window-error'
  | 'unhandled-rejection'
  | 'react-error-boundary'
  | 'handled-error'
  | 'api-failure'
  | 'server-exception'
  | 'server-error-response';

export interface IssueLabelInput {
  kind: RuntimeIssueKind | string;
  /** The error class, when known ("TypeError"). */
  errorName?: string;
  /** The raw error message. */
  message: string;
  /** The developer's own words, e.g. logger.error('Failed to load policies', err). */
  context?: string;
  stack?: string;
  componentStack?: string;
  /** Browser URL or server request path. */
  href?: string;
  /** HTTP method + path for API/server issues. */
  method?: string;
  path?: string;
  statusCode?: number;
}

export interface IssueLabels {
  title: string;
  summary: string;
  likelyCause?: string;
  area?: string;
  route?: string;
  /** Short machine-friendly name for the failure pattern, e.g. 'null-property-read'. */
  pattern: string;
}

const FUNCTION_PREFIX = '/make-server-91ed8379';
const MAX_TITLE_LENGTH = 160;

// ----------------------------------------------------------------------------
// Normalisation
// ----------------------------------------------------------------------------

const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;
const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const LONG_HEX_RE = /\b[0-9a-f]{16,}\b/gi;
const LONG_TOKEN_RE = /\b[A-Za-z0-9_-]{24,}\b/g;
const NUMBER_RE = /\b\d+(\.\d+)?\b/g;

/**
 * Collapse the variable parts of an error message (ids, emails, numbers,
 * quoted values) so the same defect hit with different data groups together.
 */
export function normalizeMessageForGrouping(message: string): string {
  return String(message || '')
    .replace(UUID_RE, '<id>')
    .replace(EMAIL_RE, '<email>')
    .replace(LONG_HEX_RE, '<id>')
    .replace(LONG_TOKEN_RE, '<token>')
    .replace(/"[^"]{0,200}"/g, '"<v>"')
    .replace(NUMBER_RE, '<n>')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 300);
}

/** One path segment that is clearly a record id rather than a route word. */
function isIdSegment(segment: string): boolean {
  if (!segment) return false;
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(segment)) return true;
  if (/^\d+$/.test(segment)) return true;
  if (/^[0-9a-f]{12,}$/i.test(segment)) return true;
  if (segment.includes('@')) return true;
  // Long mixed tokens (share links, signing tokens). Route words are short and
  // lower-case with hyphens; ids carry digits or upper case.
  return segment.length >= 20 && /\d/.test(segment) && /[A-Za-z]/.test(segment);
}

/**
 * Turn a concrete request path into its route shape:
 * `/make-server-91ed8379/clients/3f2a…/policies/12` → `/clients/:id/policies/:id`.
 */
export function normalizeRoutePath(path: string | undefined): string {
  if (!path) return '';
  let pathname = path;
  try {
    if (/^https?:\/\//i.test(path)) pathname = new URL(path).pathname;
  } catch {
    // keep the raw value
  }
  pathname = pathname.split('?')[0].split('#')[0];
  if (pathname.startsWith(FUNCTION_PREFIX)) pathname = pathname.slice(FUNCTION_PREFIX.length);
  const shaped = pathname
    .split('/')
    .map((segment) => {
      let decoded = segment;
      try {
        decoded = decodeURIComponent(segment);
      } catch {
        // keep the raw segment
      }
      return isIdSegment(decoded) ? ':id' : segment;
    })
    .join('/');
  return shaped || '/';
}

function titleCase(value: string): string {
  return value
    .replace(/[-_]+/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

// ----------------------------------------------------------------------------
// Area detection
// ----------------------------------------------------------------------------

/** Vite names lazy chunks after their source file: `ClientsModule-3fa2b1c4.js`. */
const GENERIC_CHUNKS = new Set([
  'index',
  'main',
  'vendor',
  'react',
  'react-dom',
  'chunk',
  'client',
  'jsx-runtime',
  'app',
]);

/** First application chunk named in a stack, e.g. "ClientManagementModule". */
export function chunkNameFromStack(stack: string | undefined): string | undefined {
  if (!stack) return undefined;
  const matches = stack.matchAll(/\/assets\/([A-Za-z][A-Za-z0-9_.-]*?)-[A-Za-z0-9_-]{6,}\.js/g);
  for (const match of matches) {
    const name = match[1];
    if (!GENERIC_CHUNKS.has(name.toLowerCase()) && !/^(vendor|chunk)[-.]/i.test(name)) {
      return name;
    }
  }
  // Development / source-mapped stacks: /src/components/…/SomeFile.tsx
  const devMatch = stack.match(/\/src\/(?:[\w.-]+\/)*([A-Z][\w-]*)\.(?:tsx|ts|jsx|js)/);
  return devMatch?.[1];
}

/** First real component in a React component stack ("at ClientTable (…)"). */
export function componentFromComponentStack(
  componentStack: string | undefined,
): string | undefined {
  if (!componentStack) return undefined;
  const names = [...componentStack.matchAll(/^\s*(?:at\s+)?([A-Z][A-Za-z0-9_$]{2,})/gm)].map(
    (match) => match[1],
  );
  // Minified builds rename components to one or two letters; those are useless
  // as labels, which the length floor above already filters.
  return names.find(
    (name) => !['Suspense', 'ErrorBoundary', 'Fragment', 'StrictMode'].includes(name),
  );
}

/** Human area name from a browser URL: admin module, portal page, or public page. */
export function areaFromHref(href: string | undefined): string | undefined {
  if (!href) return undefined;
  let url: URL;
  try {
    url = new URL(href, 'https://app.local');
  } catch {
    return undefined;
  }
  const segments = url.pathname.split('/').filter(Boolean);
  const moduleParam = url.searchParams.get('module');
  if (segments[0] === 'admin') {
    return `Admin · ${titleCase(moduleParam || segments[1] || 'dashboard')}`;
  }
  if (segments.length === 0) return 'Public site · Home';
  const [first, second] = segments;
  const label = second && !isIdSegment(second) ? `${first} ${second}` : first;
  if (['portal', 'client', 'dashboard', 'account'].includes(first)) {
    return `Client portal · ${titleCase(second && !isIdSegment(second) ? second : first)}`;
  }
  return titleCase(label);
}

/** Human area name from an API route: `/clients/:id/policies` → "API · Clients". */
export function areaFromRoute(route: string | undefined): string | undefined {
  if (!route) return undefined;
  const first = route.split('/').filter(Boolean)[0];
  return first ? `API · ${titleCase(first)}` : undefined;
}

// ----------------------------------------------------------------------------
// Pattern library
// ----------------------------------------------------------------------------

interface Explanation {
  pattern: string;
  /** Short phrase for the title. */
  headline: string;
  summary: string;
  likelyCause: string;
}

type Matcher = (message: string, name: string) => Explanation | null;

/** React production error codes → what they mean. Only the ones people hit. */
const REACT_ERRORS: Record<string, [string, string]> = {
  '31': [
    'Tried to render a plain object',
    'A component returned an object (often an API response or a Date) where text or JSX was expected. Look for `{someObject}` in JSX.',
  ],
  '130': [
    'Rendered a component that is undefined',
    'An import resolved to undefined — usually a default vs named export mismatch, or a lazy() import pointing at the wrong export.',
  ],
  '152': [
    'A component returned nothing',
    'A component path returns `undefined` instead of `null` or JSX — typically a missing `return`.',
  ],
  '185': [
    'Infinite re-render loop',
    'State is being set during render or inside an effect that re-triggers itself. Check setState calls in useEffect without correct dependencies.',
  ],
  '300': [
    'Hooks called conditionally',
    'A component rendered fewer hooks than last time — a hook is behind an early return or condition.',
  ],
  '301': [
    'Too many re-renders',
    'setState is being called directly in the render body, causing a loop.',
  ],
  '310': [
    'Hooks called conditionally',
    'A component rendered more hooks than last time — a hook is behind an early return or condition.',
  ],
  '321': [
    'Invalid hook call',
    'A hook was called outside a component body, or two copies of React are loaded.',
  ],
  '418': [
    'Server/client markup mismatch',
    'Pre-rendered HTML does not match what React rendered in the browser (dates, random values, or browser-only checks during render).',
  ],
  '423': [
    'Server/client markup mismatch',
    'React had to discard server HTML and re-render on the client.',
  ],
  '425': [
    'Server/client text mismatch',
    'Text content in pre-rendered HTML differs from what React rendered.',
  ],
};

const MATCHERS: Matcher[] = [
  // Stale deploy / chunk loading
  (message) =>
    /Failed to fetch dynamically imported module|Importing a module script failed|ChunkLoadError|Loading chunk [\w-]+ failed|error loading dynamically imported module/i.test(
      message,
    )
      ? {
          pattern: 'stale-chunk',
          headline: 'Page code failed to load',
          summary:
            'The browser could not download part of the app — usually because a new version was deployed while this tab was open.',
          likelyCause:
            'Stale tab after a deploy (a reload fixes it) or a flaky connection. Only worth investigating if it keeps happening on a fresh load.',
        }
      : null,

  // Reading a property of null/undefined
  (message) => {
    const match =
      message.match(/Cannot read propert(?:y|ies) of (undefined|null) \(reading '([^']+)'\)/i) ||
      message.match(/Cannot read property '([^']+)' of (undefined|null)/i);
    if (!match) {
      const safari = message.match(/(?:undefined|null) is not an object \(evaluating '([^']+)'\)/i);
      if (safari) {
        const property = safari[1].split('.').pop() || safari[1];
        return {
          pattern: 'null-property-read',
          headline: `Read '${property}' of a missing value`,
          summary: `The code tried to read \`${safari[1]}\` but part of that chain was missing (null/undefined).`,
          likelyCause:
            'Data had not loaded yet, an API returned a different shape, or an optional field was treated as always present. Add a guard or optional chaining (?.) at this read.',
        };
      }
      const firefox = message.match(/(\S+) is (undefined|null)$/i);
      if (firefox && !/is not/i.test(message)) {
        return {
          pattern: 'null-property-read',
          headline: `'${firefox[1]}' was ${firefox[2]}`,
          summary: `The code used \`${firefox[1]}\` while it was ${firefox[2]}.`,
          likelyCause:
            'Data had not loaded yet, or an API returned a different shape than the screen expects.',
        };
      }
      return null;
    }
    const [, first, second] = match;
    const [missing, property] = /undefined|null/i.test(first) ? [first, second] : [second, first];
    return {
      pattern: 'null-property-read',
      headline: `Read '${property}' of ${missing}`,
      summary: `The code tried to read \`.${property}\` from a value that was ${missing}.`,
      likelyCause:
        'Data had not loaded yet, an API returned a different shape, or an optional field was treated as always present. Add a guard or optional chaining (?.) where `.' +
        property +
        '` is read.',
    };
  },

  // Setting a property of null/undefined
  (message) => {
    const match = message.match(
      /Cannot set propert(?:y|ies) of (undefined|null) \(setting '([^']+)'\)/i,
    );
    return match
      ? {
          pattern: 'null-property-write',
          headline: `Set '${match[2]}' on ${match[1]}`,
          summary: `The code tried to assign \`.${match[2]}\` on a value that was ${match[1]}.`,
          likelyCause:
            'An object the code expected to exist was never created, or a DOM element was not found.',
        }
      : null;
  },

  // x is not a function
  (message) => {
    const match = message.match(/^(?:[\w$]+Error: )?([\w$.[\]()'"]+) is not a function/i);
    if (!match) return null;
    const subject = match[1];
    const method = subject.split('.').pop() || subject;
    const isArrayMethod = /^(map|filter|forEach|reduce|find|some|every|includes|sort|slice)$/.test(
      method,
    );
    return {
      pattern: 'not-a-function',
      headline: `'${subject}' is not a function`,
      summary: `The code called \`${subject}()\` but it is not a function${isArrayMethod ? ' — the value is not an array' : ''}.`,
      likelyCause: isArrayMethod
        ? `The data was expected to be an array but was an object, null or a string — often an API returning { data: [...] } instead of [...], or an error payload.`
        : 'A wrong import, a renamed method, or a value of a different type than expected.',
    };
  },

  // x is not defined
  (message) => {
    const match = message.match(/^(?:ReferenceError: )?([\w$]+) is not defined/i);
    return match
      ? {
          pattern: 'not-defined',
          headline: `'${match[1]}' is not defined`,
          summary: `The code referenced \`${match[1]}\`, which does not exist in scope.`,
          likelyCause:
            'A missing import, a typo, or a browser-only global used where it does not exist.',
        }
      : null;
  },

  // x is not iterable
  (message) => {
    const match = message.match(/([\w$.]+) is not iterable/i);
    return match
      ? {
          pattern: 'not-iterable',
          headline: `'${match[1]}' is not a list`,
          summary: `The code tried to loop over or spread \`${match[1]}\`, but it was not an array.`,
          likelyCause: 'An API returned an object or null where a list was expected.',
        }
      : null;
  },

  // React production errors
  (message) => {
    const match = message.match(/Minified React error #(\d+)/);
    if (!match) return null;
    const [headline, likelyCause] = REACT_ERRORS[match[1]] || [
      `React error #${match[1]}`,
      `See https://react.dev/errors/${match[1]} for the full message.`,
    ];
    return {
      pattern: `react-${match[1]}`,
      headline,
      summary: `React stopped rendering: ${headline.toLowerCase()} (React error #${match[1]}).`,
      likelyCause,
    };
  },
  (message) =>
    /Maximum update depth exceeded/i.test(message)
      ? {
          pattern: 'react-185',
          headline: REACT_ERRORS['185'][0],
          summary: 'A component kept updating its own state until React gave up.',
          likelyCause: REACT_ERRORS['185'][1],
        }
      : null,
  (message) =>
    /Rendered (?:more|fewer) hooks than/i.test(message)
      ? {
          pattern: 'react-hooks-order',
          headline: 'Hooks called conditionally',
          summary: 'A component called a different number of hooks between renders.',
          likelyCause: 'A hook sits behind an early return or an if-statement.',
        }
      : null,
  (message) =>
    /Objects are not valid as a React child/i.test(message)
      ? {
          pattern: 'react-31',
          headline: REACT_ERRORS['31'][0],
          summary: 'A component tried to display an object as text.',
          likelyCause: REACT_ERRORS['31'][1],
        }
      : null,

  // Network
  (message, name) =>
    /Failed to fetch|NetworkError when attempting to fetch|Network request failed|Load failed|ERR_NETWORK|ERR_INTERNET_DISCONNECTED/i.test(
      message,
    ) || name === 'NetworkError'
      ? {
          pattern: 'network',
          headline: 'Network request failed',
          summary:
            'A request never got a response — the connection dropped, was blocked, or the server was unreachable.',
          likelyCause:
            'User offline or on a flaky connection, a browser extension/firewall blocking the call, a CORS rejection, or the backend being down. If many users hit it at once, check the Edge Function health.',
        }
      : null,
  (message, name) =>
    name === 'AbortError' || /aborted|The operation was aborted/i.test(message)
      ? {
          pattern: 'aborted',
          headline: 'Request was cancelled',
          summary: 'A request or operation was aborted before it finished.',
          likelyCause:
            'Usually harmless (user navigated away) — unless it is a timeout abort, which means the backend was too slow.',
        }
      : null,
  (message, name) =>
    name === 'TimeoutError' || /timed? ?out|timeout/i.test(message)
      ? {
          pattern: 'timeout',
          headline: 'Operation timed out',
          summary: 'Something took longer than its time limit and was stopped.',
          likelyCause:
            'A slow query or third-party call, or the Edge Function hitting its CPU/wall-clock limit. Check the server logs for the same time window.',
        }
      : null,

  // Auth
  (message) =>
    /JWT expired|invalid JWT|token (?:has )?expired|Auth session missing|refresh[_ ]token/i.test(
      message,
    )
      ? {
          pattern: 'auth-session',
          headline: 'Login session expired or invalid',
          summary: "The user's login session was expired or invalid when this ran.",
          likelyCause:
            'Long-idle tab or a token refresh race. Usually self-heals on re-login; investigate only if it happens right after signing in.',
        }
      : null,
  (message) =>
    /row-level security|violates row level security|permission denied for|insufficient privilege|\b403\b|forbidden/i.test(
      message,
    )
      ? {
          pattern: 'permission',
          headline: 'Permission denied',
          summary: 'The database or API refused the action for this user.',
          likelyCause:
            'A row-level security policy, a missing role/permission, or a route that checks for the wrong role.',
        }
      : null,

  // Database (Postgres / PostgREST)
  (message) => {
    const match = message.match(/duplicate key value violates unique constraint "?([\w.]+)"?/i);
    return match
      ? {
          pattern: 'db-duplicate',
          headline: 'Duplicate record',
          summary: `The database rejected a save because a record with the same key already exists (${match[1]}).`,
          likelyCause:
            'A double-submit, a retry that re-inserted, or an insert that should have been an upsert.',
        }
      : null;
  },
  (message) => {
    const match = message.match(/violates (foreign key|not-null|check) constraint "?([\w.]+)"?/i);
    return match
      ? {
          pattern: 'db-constraint',
          headline: `Database ${match[1]} rule broken`,
          summary: `The database rejected a save that broke the ${match[1]} constraint ${match[2]}.`,
          likelyCause:
            match[1].toLowerCase() === 'foreign key'
              ? 'The record points at something that does not exist (or was deleted first).'
              : 'A required field was empty or had an invalid value.',
        }
      : null;
  },
  (message) => {
    const match = message.match(/(relation|column|function) "?([\w.]+)"? does not exist/i);
    return match
      ? {
          pattern: 'db-schema',
          headline: `Database ${match[1]} '${match[2]}' missing`,
          summary: `The code used a database ${match[1]} (${match[2]}) that does not exist.`,
          likelyCause:
            'A migration that was not applied to this environment, or code that is ahead of the schema.',
        }
      : null;
  },
  (message) =>
    /PGRST116|JSON object requested, multiple \(or no\) rows returned|no rows returned/i.test(
      message,
    )
      ? {
          pattern: 'db-no-row',
          headline: 'Record not found',
          summary: 'A lookup expected exactly one record and found none (or several).',
          likelyCause:
            'The record was deleted or never created, or `.single()` is used where `.maybeSingle()` is right.',
        }
      : null,
  (message) =>
    /statement timeout|canceling statement due to/i.test(message)
      ? {
          pattern: 'db-timeout',
          headline: 'Database query too slow',
          summary: 'A database query ran past its time limit and was cancelled.',
          likelyCause: 'A missing index or an unbounded query. Check the slow-query advisor.',
        }
      : null,

  // Edge runtime limits
  (message) =>
    /WORKER_LIMIT|Memory limit exceeded|CPU time (?:soft )?limit|wall ?clock/i.test(message)
      ? {
          pattern: 'edge-limit',
          headline: 'Server hit its resource limit',
          summary: 'The Edge Function ran out of CPU time or memory handling this request.',
          likelyCause:
            'A heavy request (large PDF, big export, unbounded loop). Batch or stream the work.',
        }
      : null,

  // Parsing
  (message, name) =>
    (name === 'SyntaxError' && /JSON/i.test(message)) ||
    /Unexpected token .* in JSON|is not valid JSON|Unexpected end of JSON input/i.test(message)
      ? {
          pattern: 'bad-json',
          headline: 'Response was not valid JSON',
          summary: 'The code expected JSON but received something else (often an HTML error page).',
          likelyCause:
            'The endpoint returned an error page or empty body — often a 404/502 from a wrong URL or a crashed function.',
        }
      : null,

  // Storage
  (message, name) =>
    name === 'QuotaExceededError' || /quota.*exceeded|exceeded the quota/i.test(message)
      ? {
          pattern: 'storage-quota',
          headline: 'Browser storage is full',
          summary: 'Saving to browser storage failed because it is full.',
          likelyCause: 'Too much data cached in localStorage/IndexedDB, or private browsing mode.',
        }
      : null,

  // Validation
  (message, name) =>
    name === 'ZodError' || /validation failed|invalid input|is required/i.test(message)
      ? {
          pattern: 'validation',
          headline: 'Data failed validation',
          summary: 'Input or API data did not match the expected format.',
          likelyCause:
            'A form sending a missing/badly formatted field, or the schema and the frontend disagreeing.',
        }
      : null,
];

function explain(message: string, name: string): Explanation | null {
  for (const matcher of MATCHERS) {
    const result = matcher(message, name);
    if (result) return result;
  }
  return null;
}

// ----------------------------------------------------------------------------
// HTTP status explanations
// ----------------------------------------------------------------------------

function statusExplanation(status: number | undefined): Explanation | null {
  if (!status) return null;
  if (status === 502 || status === 503 || status === 504 || status === 546) {
    return {
      pattern: `http-${status}`,
      headline:
        status === 504
          ? 'Server took too long (504)'
          : status === 546
            ? 'Server hit its resource limit (546)'
            : `Server unavailable (${status})`,
      summary:
        'The request reached the platform but the Edge Function did not answer in time or crashed before it could respond.',
      likelyCause:
        'A cold start that failed, the function running out of CPU/memory, or a deploy in progress. These never reach the app’s own error handler — check the Supabase function logs for the same minute.',
    };
  }
  if (status >= 500) {
    return {
      pattern: `http-${status}`,
      headline: `Server error (${status})`,
      summary: 'The server hit an unexpected error while handling the request.',
      likelyCause: 'A bug or a failing dependency (database, storage, third-party API).',
    };
  }
  return null;
}

// ----------------------------------------------------------------------------
// Public API
// ----------------------------------------------------------------------------

/** Trim noisy prefixes ("Error: ", "Uncaught ") and collapse whitespace. */
export function cleanErrorMessage(message: string | undefined): string {
  return String(message || '')
    .replace(/^Uncaught\s+(?:\(in promise\)\s+)?/i, '')
    .replace(/^(?:[A-Z]\w*Error|Error):\s*/, '')
    .split('\n')[0]
    .replace(/\s+/g, ' ')
    .trim();
}

function clip(value: string, max = MAX_TITLE_LENGTH): string {
  return value.length > max ? `${value.slice(0, max - 1).trimEnd()}…` : value;
}

const KIND_PREFIX: Record<string, string> = {
  'react-error-boundary': 'Screen crashed',
  'window-error': 'Crash',
  'unhandled-rejection': 'Unhandled failure',
  'handled-error': 'Handled error',
  'api-failure': 'API call failed',
  'server-exception': 'Server exception',
  'server-error-response': 'Server error',
};

/**
 * Build the human labels for one runtime issue. Never throws; unknown shapes
 * fall back to the cleaned message so a label is always produced.
 */
export function describeRuntimeIssue(input: IssueLabelInput): IssueLabels {
  const name = (input.errorName || '').trim();
  const message = cleanErrorMessage(input.message) || name || 'Unknown error';
  const context = cleanErrorMessage(input.context);
  const route = input.path ? normalizeRoutePath(input.path) : undefined;
  const isServerSide = input.kind === 'server-exception' || input.kind === 'server-error-response';
  const isApi = input.kind === 'api-failure';

  const statusInMessage = Number(
    message.match(/(?:returned|status(?: code)?|HTTP)\s*:?\s*(5\d\d)\b/i)?.[1],
  );
  const explanation =
    explain(message, name) ||
    statusExplanation(input.statusCode ?? (statusInMessage || undefined)) ||
    (context ? explain(context, name) : null);

  const component =
    componentFromComponentStack(input.componentStack) || chunkNameFromStack(input.stack);
  const pageArea = areaFromHref(input.href);
  const area =
    isServerSide || isApi
      ? areaFromRoute(route) || pageArea
      : pageArea && component
        ? `${pageArea} (${titleCase(component)})`
        : pageArea || (component ? titleCase(component) : undefined);

  // A status-code explanation is a fallback: when the failure carries its own
  // words ("Failed to generate download URL"), those say more than "Server
  // error (500)". The reporter's synthetic api-failure text does not count.
  const statusOnly = !!explanation?.pattern.startsWith('http-');
  const hasOwnMessage = !isApi && !!message && message !== name && !/^HTTP \d{3}$/.test(message);

  const requestLabel = route ? `${(input.method || '').toUpperCase()} ${route}`.trim() : '';
  const prefix = KIND_PREFIX[input.kind] || 'Error';

  // The headline: the developer's own words beat a pattern, which beats the
  // raw message. "Failed to load client policies" says more than any regex.
  let headline: string;
  if (context && input.kind === 'handled-error') {
    headline = explanation ? `${context} — ${explanation.headline}` : `${context}: ${message}`;
  } else if (explanation && !(statusOnly && hasOwnMessage)) {
    headline = explanation.headline;
  } else {
    headline = message;
  }

  let title: string;
  if (isServerSide || isApi) {
    const status = input.statusCode ? ` (${input.statusCode})` : '';
    const reason =
      explanation && !(statusOnly && hasOwnMessage)
        ? explanation.headline.replace(/\s*\(\d{3}\)$/, '')
        : hasOwnMessage
          ? message
          : '';
    title = requestLabel
      ? `${requestLabel} failed${status}${reason ? `: ${reason}` : ''}`
      : `${prefix}${status}: ${reason || message}`;
  } else {
    title = `${prefix}: ${headline}${area ? ` · ${area}` : ''}`;
  }

  const where = requestLabel || area || '';
  const summaryCore =
    explanation && !(statusOnly && hasOwnMessage && !context)
      ? explanation.summary.replace(/\.$/, '')
      : `${name && name !== 'Error' ? `${name}: ` : ''}${message}`.replace(/\.$/, '');
  const summaryLead = context && input.kind === 'handled-error' ? `${context}. ` : '';
  const summary = `${summaryLead}${summaryCore}.${where ? ` Where: ${where}.` : ''}`;

  return {
    title: clip(title),
    summary: clip(summary, 600),
    likelyCause: explanation?.likelyCause,
    area,
    route,
    pattern: explanation?.pattern || (name ? name.toLowerCase() : 'unclassified'),
  };
}

/**
 * Split a legacy stored message ("<error>\nUser: …\n\nURL: …\n\nStack: …")
 * into the error text and the technical context appended after it.
 */
export function splitLegacyMessage(message: string): { text: string; details?: string } {
  const value = String(message || '');
  const index = value.indexOf('\n\n');
  if (index < 0) return { text: value.split('\n')[0] };
  const head = value.slice(0, index);
  const [text, ...rest] = head.split('\n');
  const details = [rest.join('\n'), value.slice(index + 2)].filter(Boolean).join('\n\n');
  return { text, details: details || undefined };
}

interface StoredIssueLike {
  source: string;
  title: string;
  message: string;
  ruleId?: string;
  filePath?: string;
  summary?: string;
  likelyCause?: string;
  area?: string;
  route?: string;
  details?: string;
}

/**
 * Labels for an issue as stored. Issues recorded after this module shipped
 * carry their own labels; older runtime issues ("TypeError" over a blob) are
 * relabelled on read from what their message still contains, so the dashboard
 * improves immediately rather than only for new occurrences.
 */
export function describeStoredIssue(issue: StoredIssueLike): {
  title: string;
  text: string;
  summary?: string;
  likelyCause?: string;
  area?: string;
  details?: string;
} {
  const { text, details } = splitLegacyMessage(issue.message);
  if (issue.summary) {
    return {
      title: issue.title,
      text,
      summary: issue.summary,
      likelyCause: issue.likelyCause,
      area: issue.area,
      details: issue.details ?? details,
    };
  }
  if (issue.source !== 'runtime-client' && issue.source !== 'runtime-server') {
    return { title: issue.title, text: issue.message };
  }

  const allDetails = details || '';
  const href = allDetails.match(/^URL: (.+)$/m)?.[1];
  const request = allDetails.match(/^Request: (\w+) (\S+)/m);
  const stack = allDetails.match(/Stack:\n([\s\S]+?)(?:\n\n|$)/)?.[1];
  const componentStack = allDetails.match(/Component stack:\n([\s\S]+?)(?:\n\n|$)/)?.[1];
  const isServer = issue.source === 'runtime-server';
  const labels = describeRuntimeIssue({
    kind: isServer ? 'server-exception' : issue.ruleId || 'window-error',
    errorName: issue.title,
    message: text,
    stack,
    componentStack,
    href: isServer ? undefined : href || issue.filePath,
    method: request?.[1],
    path: isServer ? request?.[2] || issue.filePath : undefined,
    statusCode: isServer ? 500 : undefined,
  });
  return {
    title: labels.title,
    text,
    summary: labels.summary,
    likelyCause: labels.likelyCause,
    area: labels.area,
    details: allDetails || undefined,
  };
}
