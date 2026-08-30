/**
 * Amazon SES transport — the provider that replaces SendGrid.
 *
 * Selected by `NW_EMAIL_PROVIDER=ses` (see email-core.ts); SendGrid stays the
 * default and the instant rollback. Zero new dependencies: SigV4 request
 * signing is ~60 lines of WebCrypto, and the message goes to the SESv2 HTTP
 * API as raw MIME — raw because SES's "Simple" content type cannot carry the
 * custom headers deliverability needs (List-Unsubscribe, List-Id,
 * Message-ID).
 *
 * Configuration (Edge Function secrets, read lazily — never at module load):
 *   NW_SES_REGION             e.g. eu-west-1 or af-south-1
 *   NW_SES_ACCESS_KEY_ID      IAM user with ses:SendRawEmail / SendEmail only
 *   NW_SES_SECRET_ACCESS_KEY
 */

export interface SesConfig {
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
}

/** Null when any of the three secrets is missing — callers surface that as a config error. */
export function getSesConfig(): SesConfig | null {
  if (typeof Deno === 'undefined') return null;
  const region = Deno.env.get('NW_SES_REGION') || '';
  const accessKeyId = Deno.env.get('NW_SES_ACCESS_KEY_ID') || '';
  const secretAccessKey = Deno.env.get('NW_SES_SECRET_ACCESS_KEY') || '';
  if (!region || !accessKeyId || !secretAccessKey) return null;
  return { region, accessKeyId, secretAccessKey };
}

// ── MIME assembly ────────────────────────────────────────────────────────────

export interface MimeAttachment {
  /** Base64-encoded content (same shape SendGrid attachments already use). */
  content: string;
  filename: string;
  type?: string;
}

export interface MimeMessageInput {
  from: { email: string; name?: string };
  to: string;
  cc?: string[];
  replyTo?: { email: string; name?: string };
  subject: string;
  html: string;
  text: string;
  headers?: Record<string, string>;
  attachments?: MimeAttachment[];
}

const CRLF = '\r\n';

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

function utf8ToBase64(value: string): string {
  return bytesToBase64(new TextEncoder().encode(value));
}

/** RFC 2045: base64 bodies wrapped at 76 characters. */
function wrap76(b64: string): string {
  return b64.replace(/(.{76})/g, `$1${CRLF}`);
}

/** RFC 2047 encoded-word for any header value that may carry non-ASCII. */
function encodeHeaderWord(value: string): string {
  if (/^[\x20-\x7e]*$/.test(value) && !/[",]/.test(value)) return value;
  return `=?UTF-8?B?${utf8ToBase64(value)}?=`;
}

function formatAddress(address: { email: string; name?: string }): string {
  if (!address.name) return address.email;
  return `${encodeHeaderWord(address.name)} <${address.email}>`;
}

/**
 * Assemble the raw RFC 5322 message: multipart/alternative (text + html),
 * wrapped in multipart/mixed when attachments are present, with the custom
 * deliverability headers verbatim at the top level.
 */
export function buildMimeMessage(input: MimeMessageInput): string {
  const altBoundary = `alt-${crypto.randomUUID()}`;
  const mixedBoundary = `mix-${crypto.randomUUID()}`;
  const hasAttachments = (input.attachments?.length ?? 0) > 0;

  const headerLines: string[] = [`From: ${formatAddress(input.from)}`, `To: ${input.to}`];
  if (input.cc && input.cc.length > 0) headerLines.push(`Cc: ${input.cc.join(', ')}`);
  if (input.replyTo) headerLines.push(`Reply-To: ${formatAddress(input.replyTo)}`);
  headerLines.push(`Subject: ${encodeHeaderWord(input.subject)}`);
  for (const [name, value] of Object.entries(input.headers ?? {})) {
    headerLines.push(`${name}: ${value}`);
  }
  headerLines.push('MIME-Version: 1.0');

  const alternative = [
    `--${altBoundary}`,
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: base64',
    '',
    wrap76(utf8ToBase64(input.text)),
    `--${altBoundary}`,
    'Content-Type: text/html; charset=UTF-8',
    'Content-Transfer-Encoding: base64',
    '',
    wrap76(utf8ToBase64(input.html)),
    `--${altBoundary}--`,
  ].join(CRLF);

  if (!hasAttachments) {
    headerLines.push(`Content-Type: multipart/alternative; boundary="${altBoundary}"`);
    return [...headerLines, '', alternative].join(CRLF);
  }

  headerLines.push(`Content-Type: multipart/mixed; boundary="${mixedBoundary}"`);
  const attachmentParts = (input.attachments ?? []).map((attachment) =>
    [
      `--${mixedBoundary}`,
      `Content-Type: ${attachment.type || 'application/octet-stream'}; name="${attachment.filename}"`,
      'Content-Transfer-Encoding: base64',
      `Content-Disposition: attachment; filename="${attachment.filename}"`,
      '',
      wrap76(attachment.content.replace(/\s+/g, '')),
    ].join(CRLF),
  );

  return [
    ...headerLines,
    '',
    `--${mixedBoundary}`,
    `Content-Type: multipart/alternative; boundary="${altBoundary}"`,
    '',
    alternative,
    ...attachmentParts,
    `--${mixedBoundary}--`,
  ].join(CRLF);
}

// ── SigV4 signing (WebCrypto, no SDK) ────────────────────────────────────────

async function sha256Hex(data: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(data));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function hmac(key: ArrayBuffer | Uint8Array, data: string): Promise<ArrayBuffer> {
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    key as ArrayBuffer,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  return crypto.subtle.sign('HMAC', cryptoKey, new TextEncoder().encode(data));
}

export interface SignedSesRequest {
  url: string;
  headers: Record<string, string>;
  body: string;
}

/**
 * Sign a SESv2 POST per AWS Signature Version 4. Exported (with an
 * injectable clock) so the signature pipeline is testable without AWS.
 */
export async function signSesRequest(
  config: SesConfig,
  path: string,
  body: string,
  now: Date = new Date(),
): Promise<SignedSesRequest> {
  const host = `email.${config.region}.amazonaws.com`;
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, ''); // YYYYMMDDTHHMMSSZ
  const dateStamp = amzDate.slice(0, 8);
  const service = 'ses';

  const payloadHash = await sha256Hex(body);
  const canonicalHeaders =
    `content-type:application/json${'\n'}host:${host}${'\n'}` +
    `x-amz-content-sha256:${payloadHash}${'\n'}x-amz-date:${amzDate}${'\n'}`;
  const signedHeaders = 'content-type;host;x-amz-content-sha256;x-amz-date';
  const canonicalRequest = ['POST', path, '', canonicalHeaders, signedHeaders, payloadHash].join(
    '\n',
  );

  const credentialScope = `${dateStamp}/${config.region}/${service}/aws4_request`;
  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    credentialScope,
    await sha256Hex(canonicalRequest),
  ].join('\n');

  const kDate = await hmac(new TextEncoder().encode(`AWS4${config.secretAccessKey}`), dateStamp);
  const kRegion = await hmac(kDate, config.region);
  const kService = await hmac(kRegion, service);
  const kSigning = await hmac(kService, 'aws4_request');
  const signature = [...new Uint8Array(await hmac(kSigning, stringToSign))]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  return {
    url: `https://${host}${path}`,
    headers: {
      'Content-Type': 'application/json',
      'x-amz-content-sha256': payloadHash,
      'x-amz-date': amzDate,
      Authorization:
        `AWS4-HMAC-SHA256 Credential=${config.accessKeyId}/${credentialScope}, ` +
        `SignedHeaders=${signedHeaders}, Signature=${signature}`,
    },
    body,
  };
}

// ── Send ─────────────────────────────────────────────────────────────────────

/**
 * Deliver one message through the SESv2 API. Throws with the SES response
 * text on failure so email-core's classification (bounce vs transient)
 * works identically to the SendGrid path.
 */
export async function sendViaSes(config: SesConfig, message: MimeMessageInput): Promise<void> {
  const mime = buildMimeMessage(message);
  const body = JSON.stringify({
    FromEmailAddress: message.from.email,
    Destination: {
      ToAddresses: [message.to],
      ...(message.cc && message.cc.length > 0 ? { CcAddresses: message.cc } : {}),
    },
    Content: { Raw: { Data: utf8ToBase64(mime) } },
  });

  const signed = await signSesRequest(config, '/v2/email/outbound-emails', body);
  const response = await fetch(signed.url, {
    method: 'POST',
    headers: signed.headers,
    body: signed.body,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`SES error (${response.status}): ${errorText}`);
  }
}
