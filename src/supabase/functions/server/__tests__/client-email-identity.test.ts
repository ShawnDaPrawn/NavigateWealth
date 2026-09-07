import { describe, expect, it } from 'vitest';

import {
  aliasTagFromName,
  baseMailbox,
  buildSignInAlias,
  hasAliasTag,
  normalizeEmail,
  readSharedEmailLink,
  resolveContactEmail,
  splitEmail,
  type SharedEmailLink,
} from '../client-email-identity.ts';

const link = (over: Partial<SharedEmailLink> = {}): SharedEmailLink => ({
  contactEmail: 'michael.wood@gmail.com',
  signInEmail: 'michael.wood+charlotte-page-wood@gmail.com',
  relationship: 'Daughter (minor)',
  linkedAt: '2026-09-03T00:00:00.000Z',
  linkedBy: 'admin-1',
  ...over,
});

describe('normalizeEmail', () => {
  it('trims and lower-cases', () => {
    expect(normalizeEmail('  Michael.Wood@Gmail.COM ')).toBe('michael.wood@gmail.com');
  });

  it('returns an empty string for anything that is not a string', () => {
    expect(normalizeEmail(undefined)).toBe('');
    expect(normalizeEmail(null)).toBe('');
    expect(normalizeEmail(42)).toBe('');
  });
});

describe('splitEmail', () => {
  it('splits a plain address', () => {
    expect(splitEmail('michael@example.co.za')).toEqual({
      local: 'michael',
      domain: 'example.co.za',
    });
  });

  it('splits on the LAST @, so a quoted local part keeps its own', () => {
    expect(splitEmail('a@b@example.com')).toEqual({ local: 'a@b', domain: 'example.com' });
  });

  it('rejects addresses that cannot be used', () => {
    expect(splitEmail('not-an-email')).toBeNull();
    expect(splitEmail('@example.com')).toBeNull();
    expect(splitEmail('michael@')).toBeNull();
    // A domain with no dot is unroutable in practice; refusing it stops the
    // alias builder from minting an identity nobody can receive mail at.
    expect(splitEmail('michael@localhost')).toBeNull();
    expect(splitEmail('mich ael@example.com')).toBeNull();
  });
});

describe('baseMailbox', () => {
  it('is a no-op on an untagged address', () => {
    expect(baseMailbox('Michael@Example.com')).toBe('michael@example.com');
  });

  it('strips an existing sub-address tag so aliases never nest', () => {
    expect(baseMailbox('michael+charlotte@example.com')).toBe('michael@example.com');
  });

  it('strips from the FIRST plus, matching how providers route', () => {
    expect(baseMailbox('michael+a+b@example.com')).toBe('michael@example.com');
  });
});

describe('hasAliasTag', () => {
  it('detects a tagged address', () => {
    expect(hasAliasTag('michael+charlotte@example.com')).toBe(true);
    expect(hasAliasTag('michael@example.com')).toBe(false);
    expect(hasAliasTag('rubbish')).toBe(false);
  });
});

describe('aliasTagFromName', () => {
  it('slugifies a full name', () => {
    expect(aliasTagFromName('Charlotte', 'Page Wood')).toBe('charlotte-page-wood');
  });

  it('folds accents rather than dropping the letters', () => {
    expect(aliasTagFromName('Zoë', 'Müller')).toBe('zoe-muller');
  });

  it('collapses punctuation and trims stray separators', () => {
    expect(aliasTagFromName("O'Brien-Smith", ' Jones ')).toBe('o-brien-smith-jones');
  });

  it('falls back rather than producing an empty tag', () => {
    // `michael+@example.com` is a different address on some providers and
    // rejected outright by others, so an empty tag is never acceptable.
    expect(aliasTagFromName('', '')).toBe('linked');
    expect(aliasTagFromName('林', '')).toBe('linked');
  });
});

describe('buildSignInAlias', () => {
  it('derives a readable alias from the shared mailbox', () => {
    expect(buildSignInAlias('michael.wood@gmail.com', 'Charlotte', 'Page Wood')).toBe(
      'michael.wood+charlotte-page-wood@gmail.com',
    );
  });

  it('numbers later attempts so two identical names still terminate', () => {
    expect(buildSignInAlias('michael@x.com', 'Charlotte', 'Wood', 0)).toBe(
      'michael+charlotte-wood@x.com',
    );
    expect(buildSignInAlias('michael@x.com', 'Charlotte', 'Wood', 1)).toBe(
      'michael+charlotte-wood-2@x.com',
    );
    expect(buildSignInAlias('michael@x.com', 'Charlotte', 'Wood', 4)).toBe(
      'michael+charlotte-wood-5@x.com',
    );
  });

  it('derives from the base mailbox, so linking a sibling does not nest tags', () => {
    expect(buildSignInAlias('michael+charlotte@x.com', 'Thomas', 'Wood')).toBe(
      'michael+thomas-wood@x.com',
    );
  });

  it('normalises case', () => {
    expect(buildSignInAlias('Michael.Wood@Gmail.com', 'Charlotte', 'Wood')).toBe(
      'michael.wood+charlotte-wood@gmail.com',
    );
  });

  it('trims the tag, never the mailbox, to stay inside the 64-char local part', () => {
    const local = 'a'.repeat(50);
    const alias = buildSignInAlias(`${local}@x.com`, 'Charlotte', 'Page Wood');

    expect(alias).not.toBeNull();
    const [aliasLocal] = alias!.split('@');
    expect(aliasLocal.length).toBeLessThanOrEqual(64);
    // The mailbox survives intact — truncating it would address a different
    // account entirely.
    expect(aliasLocal.startsWith(`${local}+`)).toBe(true);
    expect(aliasLocal.endsWith('-')).toBe(false);
  });

  it('gives up rather than truncating the mailbox when there is no room', () => {
    expect(buildSignInAlias(`${'a'.repeat(64)}@x.com`, 'Charlotte', 'Wood')).toBeNull();
  });

  it('returns null for an address it cannot parse', () => {
    expect(buildSignInAlias('not-an-email', 'Charlotte', 'Wood')).toBeNull();
  });
});

describe('readSharedEmailLink', () => {
  it('reads a well-formed link', () => {
    expect(readSharedEmailLink({ sharedEmail: link() })?.contactEmail).toBe(
      'michael.wood@gmail.com',
    );
  });

  it('ignores absent, malformed, or contactless links', () => {
    expect(readSharedEmailLink(null)).toBeNull();
    expect(readSharedEmailLink({})).toBeNull();
    expect(readSharedEmailLink({ sharedEmail: 'yes' })).toBeNull();
    expect(readSharedEmailLink({ sharedEmail: { relationship: 'Daughter' } })).toBeNull();
  });
});

describe('resolveContactEmail', () => {
  it('returns the auth email for a client that owns its mailbox', () => {
    expect(resolveContactEmail('Michael.Wood@gmail.com', { personalInformation: {} })).toBe(
      'michael.wood@gmail.com',
    );
  });

  it('returns the guardian address for a linked client, not the alias', () => {
    // This is the whole point: every message the platform sends reads
    // `client.email`, so a minor's birthday greeting must resolve to an inbox a
    // person actually reads.
    expect(
      resolveContactEmail('michael.wood+charlotte-page-wood@gmail.com', { sharedEmail: link() }),
    ).toBe('michael.wood@gmail.com');
  });

  it('falls back to the auth email when the profile is missing', () => {
    expect(resolveContactEmail('michael@x.com', null)).toBe('michael@x.com');
    expect(resolveContactEmail('michael@x.com', undefined)).toBe('michael@x.com');
  });

  it('returns an empty string when there is nothing to resolve', () => {
    expect(resolveContactEmail(undefined, null)).toBe('');
  });
});
