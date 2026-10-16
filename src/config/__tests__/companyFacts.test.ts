/**
 * The public site states only facts about the firm that can be checked.
 *
 * In October 2026 a business-directory listing was declined because the site
 * carried unbacked, mutually contradictory figures (see the header of
 * src/config/companyFacts.ts). Each page had typed its own numbers, so they
 * drifted. This file pins the fix from both ends:
 *
 *   1. companyFacts agrees with organization.json, the structured data search
 *      engines read, so the page copy and the schema cannot disagree; and
 *   2. no public page reintroduces the kinds of figures that were removed.
 *
 * If a figure can genuinely be evidenced, add it to companyFacts.ts and read it
 * from there — then relax the matching pattern below in the same change, with
 * the evidence named in the PR.
 *
 * Run: npx vitest run src/config/__tests__/companyFacts.test.ts
 */
import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import organization from '../../components/seo/organization.json';
import { COMPANY, FOUNDER, TRUST_FACTS } from '../companyFacts';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const PAGES_DIR = join(REPO_ROOT, 'src', 'components', 'pages');

describe('company facts agree with the structured data', () => {
  it('names the same founder and founding year', () => {
    expect(organization.founder.name).toBe(FOUNDER.name);
    expect(organization.foundingDate).toBe(String(COMPANY.foundedYear));
  });

  it('carries the FSP number in the organisation description', () => {
    expect(organization.description).toContain(`FSP ${COMPANY.fspNumber}`);
    expect(organization.legalName).toContain(COMPANY.legalName);
  });

  it('leads the trust strip with the FSCA authorisation', () => {
    expect(TRUST_FACTS[0].value).toBe(`FSP ${COMPANY.fspNumber}`);
    expect(TRUST_FACTS.length).toBeGreaterThanOrEqual(3);
  });
});

/**
 * Client-portal page with placeholder adviser data, not part of the public
 * marketing site. Replacing it needs real adviser data wired in, which is
 * separate work; it is listed here so the exemption is visible, not silent.
 */
const EXEMPT = new Set(['MyAdviserPage.tsx']);

/** Labels and phrasings of the figures that were removed. Case-sensitive on purpose. */
const FORBIDDEN: readonly RegExp[] = [
  /Years Experience/,
  /Combined Experience/,
  /Happy Clients/,
  /Satisfied Clients/,
  /Active Clients/,
  /Client Retention/,
  /Staff Retention/,
  /Team Members/,
  /Assets Under/,
  /Assets Managed/,
  /Under Management/,
  /Client Satisfaction/,
  /Referral Rate/,
  /Cape Town/,
  /\b\d[\d,]*\+ (clients|years)/i,
  /What Our Clients Say/,
];

const publicPageFiles = [
  ...readdirSync(PAGES_DIR)
    .filter((name) => /\.tsx?$/.test(name) && !EXEMPT.has(name))
    .map((name) => join(PAGES_DIR, name)),
  join(PAGES_DIR, 'auth', 'authConstants.ts'),
];

describe('public pages carry no unbacked credibility figures', () => {
  it('finds the page files (guards against the scan silently going empty)', () => {
    expect(publicPageFiles.length).toBeGreaterThan(20);
  });

  it.each(publicPageFiles.map((f) => [relative(REPO_ROOT, f), f] as const))(
    '%s',
    (_label, filePath) => {
      const source = readFileSync(filePath, 'utf8');
      const hits = FORBIDDEN.filter((pattern) => pattern.test(source)).map(String);

      expect(
        hits,
        'This page states a figure about the firm that nothing backs. Use ' +
          'TRUST_FACTS / COMPANY from src/config/companyFacts.ts instead, and ' +
          'show reviews only through PublishedReviews.',
      ).toEqual([]);
    },
  );
});
