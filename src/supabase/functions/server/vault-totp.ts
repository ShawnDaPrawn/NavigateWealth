/** RFC 6238 one-time codes (SHA-1, 6 digits, 30-second steps) from a base32 setup key. */

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function base32Decode(input: string): Uint8Array<ArrayBuffer> {
  const clean = input.toUpperCase().replace(/[\s=-]/g, '');
  if (!clean || /[^A-Z2-7]/.test(clean)) throw new Error('Invalid one-time code key');
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const char of clean) {
    value = (value << 5) | ALPHABET.indexOf(char);
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return new Uint8Array(out);
}

export function isValidOtpSecret(secret: string) {
  try {
    return base32Decode(secret).length >= 10;
  } catch {
    return false;
  }
}

export async function totp(secret: string, now = Date.now(), step = 30) {
  const counter = Math.floor(now / 1000 / step);
  const message = new Uint8Array(8);
  let c = counter;
  for (let i = 7; i >= 0; i--) {
    message[i] = c & 0xff;
    c = Math.floor(c / 256);
  }
  const key = await crypto.subtle.importKey(
    'raw',
    base32Decode(secret),
    { name: 'HMAC', hash: 'SHA-1' },
    false,
    ['sign'],
  );
  const mac = new Uint8Array(await crypto.subtle.sign('HMAC', key, message));
  const offset = mac[mac.length - 1] & 0x0f;
  const binary =
    ((mac[offset] & 0x7f) << 24) |
    (mac[offset + 1] << 16) |
    (mac[offset + 2] << 8) |
    mac[offset + 3];
  return {
    code: String(binary % 1_000_000).padStart(6, '0'),
    expiresIn: step - (Math.floor(now / 1000) % step),
  };
}
