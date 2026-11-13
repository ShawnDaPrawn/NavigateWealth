/** A plausible email address: something@domain.tld, no spaces. */
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidSubscriberEmail(value: string): boolean {
  return EMAIL_PATTERN.test(value.trim());
}
