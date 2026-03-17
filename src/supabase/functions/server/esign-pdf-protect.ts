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

const log = createModuleLogger('esign-pdf-protect');

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
function generateP12(passphrase: string): { p12Buffer: Buffer; expiresAt: Date; serialNumber: string } {
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
  try {
    const cached = await kv.get(PLATFORM_CERT_KV_KEY) as CachedPlatformCert | null;

    if (cached && new Date(cached.expiresAt) > new Date()) {
      log.info(`Using cached platform certificate (serial: ${cached.serialNumber}, expires: ${cached.expiresAt})`);
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

    // Cache in KV
    const certData: CachedPlatformCert = {
      p12Base64: p12Buffer.toString('base64'),
      passphrase,
      subject: 'Navigate Wealth E-Signature Platform',
      createdAt: new Date().toISOString(),
      expiresAt: expiresAt.toISOString(),
      serialNumber,
    };
    await kv.set(PLATFORM_CERT_KV_KEY, certData);

    log.success(`Platform signing certificate generated (serial: ${serialNumber}, expires: ${expiresAt.toISOString()})`);
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
