/**
 * email-recipients.ts — CC list hygiene
 * =====================================
 *
 * The rule this module exists to enforce is not cosmetic: SendGrid rejects the
 * entire personalization block — so the PRIMARY recipient gets nothing — when a
 * CC address repeats the To address or is malformed. `documents-email-routes`
 * already carried a hand-rolled guard for one instance of that (admin CC ==
 * client email); everything below pins the general version, because the failure
 * mode it prevents is "the adviser CC'd someone and the client never got the
 * message".
 *
 * The other half of the contract is that a bad CC never escalates into a failed
 * send: every case here DROPS an address and keeps going.
 */
import { describe, it, expect } from 'vitest';
import {
  describeDroppedRecipients,
  describeUndeliveredRecipients,
  isValidEmailAddress,
  normalizeEmailList,
} from '../email-recipients.ts';

describe('normalizeEmailList', () => {
  it('accepts a plain list unchanged', () => {
    const result = normalizeEmailList(['a@example.com', 'b@example.com']);
    expect(result.accepted).toEqual(['a@example.com', 'b@example.com']);
    expect(result.dropped).toEqual([]);
  });

  it('parses the comma-separated string the compose form produces', () => {
    const result = normalizeEmailList('a@example.com, b@example.com;c@example.com');
    expect(result.accepted).toEqual(['a@example.com', 'b@example.com', 'c@example.com']);
  });

  it('splits entries that arrive as one comma-joined array element', () => {
    // The CC field is free text — an admin pasting "x, y" into a single row of
    // the array must not produce one unusable address.
    const result = normalizeEmailList(['a@example.com, b@example.com']);
    expect(result.accepted).toEqual(['a@example.com', 'b@example.com']);
  });

  it('drops the To address rather than letting the provider reject the send', () => {
    const result = normalizeEmailList(
      ['client@example.com', 'adviser@example.com'],
      ['client@example.com'],
    );
    expect(result.accepted).toEqual(['adviser@example.com']);
    expect(result.dropped).toEqual([{ value: 'client@example.com', reason: 'excluded' }]);
  });

  it('compares the To address case-insensitively', () => {
    // The old inline filter used `c !== email`, so CC'ing Client@… on a message
    // to client@… slipped through and the whole send 400'd.
    const result = normalizeEmailList(['Client@Example.com'], ['client@example.com']);
    expect(result.accepted).toEqual([]);
    expect(result.dropped[0].reason).toBe('excluded');
  });

  it('de-duplicates, keeping the first spelling', () => {
    const result = normalizeEmailList(['a@example.com', 'A@Example.com']);
    expect(result.accepted).toEqual(['a@example.com']);
    expect(result.dropped).toEqual([{ value: 'A@Example.com', reason: 'duplicate' }]);
  });

  it('drops malformed addresses instead of failing the send', () => {
    const result = normalizeEmailList(['good@example.com', 'not-an-email', 'also bad@']);
    expect(result.accepted).toEqual(['good@example.com']);
    expect(result.dropped.map((d) => d.reason)).toEqual(['invalid', 'invalid']);
  });

  it('ignores the empty entries a trailing comma leaves behind', () => {
    // A trailing comma is the single most likely thing an admin types, and an
    // empty string in the cc array is enough for SendGrid to refuse the message.
    const result = normalizeEmailList('a@example.com, ,');
    expect(result.accepted).toEqual(['a@example.com']);
    expect(result.dropped).toEqual([]);
  });

  it('unwraps display-name form', () => {
    const result = normalizeEmailList(['Navigate Wealth <info@navigatewealth.co>']);
    expect(result.accepted).toEqual(['info@navigatewealth.co']);
  });

  it('caps the envelope and reports the overflow', () => {
    const many = Array.from({ length: 5 }, (_, i) => `a${i}@example.com`);
    const result = normalizeEmailList(many, [], 3);
    expect(result.accepted).toHaveLength(3);
    expect(result.dropped).toHaveLength(2);
    expect(result.dropped.every((d) => d.reason === 'limit')).toBe(true);
  });

  it('returns nothing for absent or non-list input', () => {
    expect(normalizeEmailList(undefined).accepted).toEqual([]);
    expect(normalizeEmailList(null).accepted).toEqual([]);
    expect(normalizeEmailList(42).accepted).toEqual([]);
    expect(normalizeEmailList([null, 7, {}]).accepted).toEqual([]);
  });

  it('ignores blank exclusions', () => {
    // recipientEmail is optional; an undefined To must not exclude everything.
    const result = normalizeEmailList(['a@example.com'], [undefined, '', null]);
    expect(result.accepted).toEqual(['a@example.com']);
  });
});

describe('describeDroppedRecipients', () => {
  it('is empty when nothing was dropped', () => {
    expect(describeDroppedRecipients([])).toBe('');
  });

  it('names each address and why it was dropped', () => {
    const { dropped } = normalizeEmailList(['nope', 'client@example.com'], ['client@example.com']);
    const text = describeDroppedRecipients(dropped);
    expect(text).toContain('nope (not a valid email address)');
    expect(text).toContain('client@example.com (already the primary recipient)');
  });
});

describe('describeUndeliveredRecipients', () => {
  // The distinction is not cosmetic: a `duplicate` was copied once and an
  // `excluded` address IS the recipient, so both people received the message.
  // Telling the adviser "not copied to <them>" is simply false — and the
  // encrypted-documents path hands the admin address in twice, so it tripped on
  // every send with "CC Admin" ticked.
  it('says nothing about an address that was copied once anyway', () => {
    const { dropped } = normalizeEmailList(['a@example.com', 'A@example.com']);
    expect(describeUndeliveredRecipients(dropped)).toBe('');
  });

  it('says nothing about the recipient being CC-d on their own message', () => {
    const { dropped } = normalizeEmailList(['client@example.com'], ['client@example.com']);
    expect(describeUndeliveredRecipients(dropped)).toBe('');
  });

  it('reports addresses that genuinely received nothing', () => {
    const { dropped } = normalizeEmailList(['nope', 'dup@example.com', 'dup@example.com']);
    const text = describeUndeliveredRecipients(dropped);
    expect(text).toContain('nope');
    expect(text).not.toContain('dup@example.com');
  });

  it('reports addresses cut by the limit', () => {
    const { dropped } = normalizeEmailList(['a@example.com', 'b@example.com'], [], 1);
    expect(describeUndeliveredRecipients(dropped)).toContain('b@example.com');
  });
});

describe('isValidEmailAddress', () => {
  it.each(['a@b.co', 'first.last+tag@sub.domain.example', 'X@Y.IO'])('accepts %s', (value) => {
    expect(isValidEmailAddress(value)).toBe(true);
  });

  it.each(['', ' ', 'nope', 'a@b', 'a@.co', '@b.co', 'a b@c.co', undefined, 12])(
    'rejects %s',
    (value) => {
      expect(isValidEmailAddress(value)).toBe(false);
    },
  );
});
