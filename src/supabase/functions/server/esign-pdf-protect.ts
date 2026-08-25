/**
 * PDF Digital Signature & Protection Service
 *
 * Adds an invisible cryptographic digital signature (PKCS#7 / CMS) to
 * completed e-sign documents using a self-signed platform certificate.
 *
 * When opened in Adobe Acrobat / Reader the Signature Panel will show:
 *   - "Signed by: Navigate Wealth E-Signature Platform"
 *   - Signing timestamp
 *   - Whether the document has been modified since signing
 *
 * If any byte of the PDF is altered after signing, the signature
 * status changes to "INVALID - the document has been altered or
 * corrupted since the signature was applied."
 *
 * Implementation:
 *   1. Generate (or retrieve cached) self-signed X.509 certificate
 *   2. Convert to PKCS#12 format for the P12Signer
 *   3. Add an invisible signature placeholder via @signpdf/placeholder-pdf-lib
 *   4. Sign the placeholder region with @signpdf/signpdf + P12Signer
 *
 * Fallback: If signing fails for any reason the original (unsigned) PDF
 * is returned so the completion workflow is never blocked.
 *
 * NOTE - Self-signed certificates show "Signature validity is UNKNOWN" in
 * Adobe until the certificate is manually trusted. For production, obtain
 * a certificate from the Adobe Approved Trust List (AATL) such as
 * GlobalSign, DigiCert, or Entrust. That way Adobe will show a green
 * tick with "Signature is valid" out of the box.
 */

import forge from 'npm:node-forge@1.3.1';
import { SignPdf } from 'npm:@signpdf/signpdf';
import { P12Signer } from 'npm:@signpdf/signer-p12';
import { pdflibAddPlaceholder } from 'npm:@signpdf/placeholder-pdf-lib';
import { PDFDocument } from 'npm:pdf-lib@1.17.1';
import { Buffer } from 'node:buffer';
import * as kv from './kv_store.tsx';
import { createModuleLogger } from './stderr-logger.ts';
import { getErrMsg } from './shared-logger-utils.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2.49.8';

const log = createModuleLogger('esign-pdf-protect');

// Lazy Supabase client — must NOT be constructed at module top level, or the
// function crashes on deploy (same constraint as security-shared.ts).
const getSupabase = () =>
  createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

// ── Constants ─────────────────────────────────────────────────────────

/** KV key for the cached platform signing certificate (PKCS#12) */
const PLATFORM_CERT_KV_KEY = 'esign_config:platform_signing_cert';

/** Certificate validity period */
const CERT_VALIDITY_YEARS = 5;

// ── Types ─────────────────────────────────────────────────────────────

interface CachedPlatformCert {
  /** Base64-encoded PKCS#12 (PFX) archive */
  p12Base64: string;
  /** Passphrase protecting the PKCS#12 archive */
  passphrase: string;
  /** Certificate subject (CN) */
  subject: string;
  /** ISO 8601 creation timestamp */
  createdAt: string;
  /** ISO 8601 expiry timestamp */
  expiresAt: string;
  /** Certificate serial number (hex) */
  serialNumber: string;
}

export interface SignPdfOptions {
  reason?: string;
  contactInfo?: string;
  location?: string;
  envelopeId?: string;
  envelopeTitle?: string;
}

// ── Certificate Management ───────────────────────────────────────────

/**
 * Generate a self-signed PKCS#12 certificate for document signing.
 *
 * The certificate uses RSA 2048-bit keys and SHA-256 signing.
 * Subject identifies Navigate Wealth as the signing platform.
 * Extensions limit usage to digital signing and non-repudiation.
 */
function generateP12(passphrase: string): {
  p12Buffer: Buffer;
  expiresAt: Date;
  serialNumber: string;
} {
  log.info('Generating 2048-bit RSA key pair for platform signing certificate...');
  const keys = forge.pki.rsa.generateKeyPair(2048);

  const cert = forge.pki.createCertificate();
  cert.publicKey = keys.publicKey;
  cert.serialNumber = '01' + forge.util.bytesToHex(forge.random.getBytesSync(8));

  const now = new Date();
  const expires = new Date(now);
  expires.setFullYear(now.getFullYear() + CERT_VALIDITY_YEARS);

  cert.validity.notBefore = now;
  cert.validity.notAfter = expires;

  const attrs = [
    { shortName: 'CN', value: 'Navigate Wealth E-Signature Platform' },
    { shortName: 'O', value: 'Navigate Wealth (Pty) Ltd' },
    { shortName: 'OU', value: 'E-Signature Services' },
    { shortName: 'C', value: 'ZA' },
    { shortName: 'ST', value: 'Western Cape' },
    { shortName: 'L', value: 'Cape Town' },
  ];

  cert.setSubject(attrs);
  cert.setIssuer(attrs); // Self-signed

  cert.setExtensions([
    { name: 'basicConstraints', cA: false },
    {
      name: 'keyUsage',
      digitalSignature: true,
      nonRepudiation: true,
    },
    {
      name: 'extKeyUsage',
      emailProtection: true,
    },
  ]);

  // Sign the certificate with SHA-256
  cert.sign(keys.privateKey, forge.md.sha256.create());

  // Package as PKCS#12 (PFX) — this is the format @signpdf/signer-p12 expects
  const p12Asn1 = forge.pkcs12.toPkcs12Asn1(keys.privateKey, [cert], passphrase, {
    algorithm: '3des',
    friendlyName: 'Navigate Wealth E-Signature Platform',
  });
  const p12Der = forge.asn1.toDer(p12Asn1).getBytes();

  return {
    p12Buffer: Buffer.from(p12Der, 'binary'),
    expiresAt: expires,
    serialNumber: cert.serialNumber,
  };
}

/**
 * Get or create the platform PKCS#12 signing certificate.
 *
 * Generated once and cached in KV for reuse across all envelope completions.
 * Automatically regenerated when expired (every CERT_VALIDITY_YEARS years).
 *
 * Security note: The passphrase is randomly generated and stored alongside
 * the P12 in KV. In production, the private key material should be stored
 * in a dedicated secrets manager or HSM rather than the KV store.
 */
async function getOrCreatePlatformP12(): Promise<{ p12Buffer: Buffer; passphrase: string }> {
  // SECURITY-AUDIT H-5: prefer signing material provisioned via Supabase
  // secrets (env vars) over the KV store, so the private key never sits in
  // application-readable storage. Set NW_ESIGN_PLATFORM_P12_BASE64 and
  // NW_ESIGN_PLATFORM_P12_PASSPHRASE to activate; the KV path below remains
  // as a fallback until rotation is complete.
  const envP12 = Deno.env.get('NW_ESIGN_PLATFORM_P12_BASE64');
  const envPassphrase = Deno.env.get('NW_ESIGN_PLATFORM_P12_PASSPHRASE');
  if (envP12 && envPassphrase) {
    log.info('Using platform signing certificate from environment secrets');
    return { p12Buffer: Buffer.from(envP12, 'base64'), passphrase: envPassphrase };
  }

  // SECURITY-AUDIT S4, second branch (2026-08-25). Vault: encrypted at rest
  // with a key held outside the database, and unreachable through the
  // application's own KV endpoints. Added because the env-secret branch above
  // needs an operator in the dashboard — there is no Management API tool for
  // Edge Function secrets — and leaving the key in a plaintext table until
  // someone got round to it was the worse trade.
  //
  // Be clear about what this is not: signing needs the private key in memory,
  // so unlike the cron token this cannot be a boolean oracle. The getter really
  // does hand the key to its caller. What improves is that the key stops
  // sitting unencrypted in a general-purpose table, and reading it now needs
  // service_role EXECUTE on one narrowly-granted function rather than a row
  // read. The env branch above is still the better option and still runs first.
  try {
    const { data, error } = await getSupabase().rpc('get_esign_platform_cert');
    if (error) {
      log.warn('get_esign_platform_cert failed — falling back to KV', { error: error.message });
    } else if (data) {
      const vaulted = data as CachedPlatformCert;
      if (vaulted.p12Base64 && vaulted.passphrase && new Date(vaulted.expiresAt) > new Date()) {
        log.info(`Using platform signing certificate from Vault (expires: ${vaulted.expiresAt})`);
        return {
          p12Buffer: Buffer.from(vaulted.p12Base64, 'base64'),
          passphrase: vaulted.passphrase,
        };
      }
      log.warn('Vault holds a platform certificate but it is expired or incomplete');
    }
  } catch (err) {
    log.warn('get_esign_platform_cert threw — falling back to KV', {
      error: err instanceof Error ? err.message : String(err),
    });
  }

  // SECURITY-AUDIT S4 — the KV fallback below keeps the signing private key and
  // its passphrase in application-readable storage. Reading it back out through
  // the generic KV API is now blocked outright (kv-routes.ts denies the
  // `esign_config:` namespace to every caller), but the material is still at
  // rest in KV. It is retained until the Vault path above is observed working
  // in production: deleting it first would break every envelope completion — an
  // outage on a compliance path, caused by a security fix.
  //
  // Deleting this fallback in code would be the wrong way to force that: if the
  // secrets are not yet set in the deployed environment, every envelope
  // completion would start failing — an outage on a compliance path, caused by
  // a security fix. So the switch is left to the operator instead:
  // NW_ESIGN_REQUIRE_ENV_CERT=true makes the absence of the secrets a hard
  // error rather than a silent downgrade, and can be flipped without a deploy
  // once they are confirmed present. Same posture as NW_ALLOWED_ORIGINS: fail
  // open with a loud warning until explicitly configured to fail closed.
  if (Deno.env.get('NW_ESIGN_REQUIRE_ENV_CERT') === 'true') {
    log.error(
      'NW_ESIGN_REQUIRE_ENV_CERT is set but NW_ESIGN_PLATFORM_P12_BASE64 / ' +
        'NW_ESIGN_PLATFORM_P12_PASSPHRASE are not both present — refusing to fall back to KV',
    );
    throw new Error(
      'Platform signing certificate is not provisioned via environment secrets ' +
        'and the KV fallback is disabled (NW_ESIGN_REQUIRE_ENV_CERT=true)',
    );
  }

  log.warn(
    'Platform signing certificate is being read from KV — the private key and passphrase ' +
      'are in application-readable storage (SECURITY-AUDIT S4). Provision ' +
      'NW_ESIGN_PLATFORM_P12_BASE64 and NW_ESIGN_PLATFORM_P12_PASSPHRASE, then set ' +
      'NW_ESIGN_REQUIRE_ENV_CERT=true to close this path.',
  );

  try {
    const cached = (await kv.get(PLATFORM_CERT_KV_KEY)) as CachedPlatformCert | null;

    if (cached && new Date(cached.expiresAt) > new Date()) {
      log.info(
        `Using cached platform certificate (serial: ${cached.serialNumber}, expires: ${cached.expiresAt})`,
      );
      return {
        p12Buffer: Buffer.from(cached.p12Base64, 'base64'),
        passphrase: cached.passphrase,
      };
    }

    if (cached) {
      log.info('Platform certificate expired — regenerating');
    }

    // Generate a random passphrase for the PKCS#12 archive
    const passphrase = forge.util.bytesToHex(forge.random.getBytesSync(16));
    const { p12Buffer, expiresAt, serialNumber } = generateP12(passphrase);

    const certData: CachedPlatformCert = {
      p12Base64: p12Buffer.toString('base64'),
      passphrase,
      subject: 'Navigate Wealth E-Signature Platform',
      createdAt: new Date().toISOString(),
      expiresAt: expiresAt.toISOString(),
      serialNumber,
    };

    // Persist to Vault, never to KV. A regenerated certificate is new private
    // key material; writing it back to a plaintext table would undo the whole
    // point of the branch above. If Vault is unreachable the run still returns
    // a usable certificate — it is simply not cached, so the next call
    // regenerates. That is slower, and correct.
    try {
      const { error } = await getSupabase().rpc('set_esign_platform_cert', {
        cert: certData,
      });
      if (error) {
        log.warn('Could not persist the new platform certificate to Vault', {
          error: error.message,
        });
      } else {
        log.info('New platform signing certificate stored in Vault');
      }
    } catch (err) {
      log.warn('Could not persist the new platform certificate to Vault', {
        error: err instanceof Error ? err.message : String(err),
      });
    }

    log.success(
      `Platform signing certificate generated (serial: ${serialNumber}, expires: ${expiresAt.toISOString()})`,
    );
    return { p12Buffer, passphrase };
  } catch (err) {
    log.error('Failed to get/create platform certificate:', err);
    throw err;
  }
}

// ── PDF Signing ──────────────────────────────────────────────────────

/**
 * Apply an invisible PKCS#7 digital signature to a PDF buffer.
 *
 * - Adobe Reader / Acrobat will show the signature in the Signature Panel
 * - Any modification after signing invalidates the signature
 * - The PDF can still be opened and viewed without restriction
 * - The signature is invisible (no visible stamp on the page)
 *
 * The signing flow:
 *   1. Load PDF with pdf-lib
 *   2. Add an invisible /Sig dictionary with placeholder ByteRange and Contents
 *   3. Serialize the PDF
 *   4. P12Signer calculates PKCS#7 detached signature over the relevant bytes
 *   5. SignPdf inserts the signature into the Contents placeholder
 *
 * @param pdfBuffer - The PDF to sign (Uint8Array)
 * @param options - Signing metadata (reason, location, etc.)
 * @returns The signed PDF buffer. On failure, returns the original buffer.
 */
export async function signAndProtectPdf(
  pdfBuffer: Uint8Array,
  options: SignPdfOptions = {},
): Promise<Uint8Array> {
  const {
    reason = 'Document electronically signed and sealed via Navigate Wealth',
    contactInfo = 'Navigate Wealth E-Signature Platform',
    location = 'Cape Town, South Africa',
    envelopeId,
    envelopeTitle,
  } = options;

  const ctx = envelopeId ? ` [envelope: ${envelopeId}]` : '';
  log.info(`Applying digital signature to PDF${ctx}...`);

  try {
    // 1. Retrieve or generate the platform P12 certificate
    const { p12Buffer, passphrase } = await getOrCreatePlatformP12();

    // 2. Load PDF with pdf-lib and add signature placeholder
    const pdfDoc = await PDFDocument.load(pdfBuffer);

    // Update metadata to mark the document as sealed
    pdfDoc.setProducer('Navigate Wealth E-Signature Platform');
    pdfDoc.setCreator('Navigate Wealth');
    if (envelopeTitle) {
      pdfDoc.setSubject(`Signed: ${envelopeTitle}`);
    }

    // Add invisible signature placeholder.
    // This creates the /Sig dictionary, AcroForm entries with SigFlags,
    // and an invisible widget annotation on the first page.
    pdflibAddPlaceholder({
      pdfDoc,
      reason,
      contactInfo,
      name: 'Navigate Wealth E-Signature Platform',
      location,
    });

    // Save with placeholder (useObjectStreams: false is required for signature compatibility)
    const pdfWithPlaceholder = await pdfDoc.save({ useObjectStreams: false });
    const pdfBuf = Buffer.from(pdfWithPlaceholder);

    // 3. Create P12 signer from the platform certificate
    const signer = new P12Signer(p12Buffer, { passphrase });

    // 4. Sign the PDF
    // SignPdf handles:
    //   - Finding the ByteRange placeholder in the serialized bytes
    //   - Calculating the actual byte ranges (before/after the Contents value)
    //   - Passing the relevant bytes to the signer for PKCS#7 signature creation
    //   - Writing the hex-encoded signature into the Contents placeholder
    const signPdf = new SignPdf();
    const signedPdfBuffer = await signPdf.sign(pdfBuf, signer);

    log.success(`Digital signature applied successfully${ctx} (${signedPdfBuffer.length} bytes)`);

    return new Uint8Array(signedPdfBuffer);
  } catch (err: unknown) {
    const errMsg = getErrMsg(err);
    log.error(`Failed to apply digital signature${ctx}: ${errMsg}`);

    // FALLBACK: Return the original unsigned PDF.
    // The document is still valid with burned-in signatures and certificate page,
    // just without the additional PKCS#7 cryptographic seal.
    // This ensures the completion workflow is never blocked by signing failures.
    log.warn(`Returning unsigned PDF as fallback${ctx}`);
    return pdfBuffer;
  }
}
