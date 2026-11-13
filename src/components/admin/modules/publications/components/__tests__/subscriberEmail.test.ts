import { describe, expect, it } from 'vitest';
import { isValidSubscriberEmail } from '../subscriberEmail';

describe('isValidSubscriberEmail', () => {
  it.each(['elsa@venter.co.za', '  thabo.m@example.com  ', 'a+news@b.io'])('accepts %s', (v) =>
    expect(isValidSubscriberEmail(v)).toBe(true),
  );
  it.each(['', '@', 'elsa@', 'elsa@venter', 'elsa venter@x.com', 'no-at-sign.com'])(
    'rejects %j',
    (v) => expect(isValidSubscriberEmail(v)).toBe(false),
  );
});
