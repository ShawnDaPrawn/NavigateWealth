/**
 * AI invoice-capture extraction — pure normalization.
 *
 * The AI reads a received supplier invoice (PDF/photo) and returns candidate
 * fields; this module coerces that untrusted output into a clean, renderable
 * draft the operator confirms before anything is written to the ledger.
 *
 * Locked-owned shared module (SPA + edge); deleted together with the locked
 * module (see components/admin/modules/locked/README.md).
 *
 * @module shared/locked-vat/capture-extraction
 */

export interface CaptureExtraction {
  supplierName: string;
  supplierVatNumber: string;
  invoiceNumber: string;
  /** ISO yyyy-mm-dd; empty when unreadable. */
  invoiceDate: string;
  /** VAT-inclusive total. */
  total: number;
  vatAmount: number;
  description: string;
  /** Inferred from the amounts: VAT > 0 → standard, else zero-rated. */
  vatTreatment: 'standard' | 'zero_rated';
  /** Model's 0-1 estimate of read accuracy. */
  confidence: number;
  /** Anything the model could not read plus arithmetic warnings. */
  notes: string;
}

const VAT_RATE = 0.15;
const r2 = (value: number): number => Math.round(value * 100) / 100;

function cleanText(value: unknown, maxLength: number): string {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

function cleanNumber(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(String(value ?? '').replace(/[^\d.-]/g, ''));
  return Number.isFinite(n) && n >= 0 ? r2(n) : 0;
}

function cleanIsoDate(value: unknown): string {
  const s = typeof value === 'string' ? value.trim() : '';
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : '';
}

/**
 * Coerce a raw AI extraction into a confirmed-safe draft. VAT above the
 * arithmetic 15/115 maximum is clamped (with a note) so a misread can never
 * inflate an input claim.
 */
export function normalizeCaptureExtraction(raw: unknown): CaptureExtraction {
  const input = (raw ?? {}) as Record<string, unknown>;
  const total = cleanNumber(input.total);
  let vatAmount = cleanNumber(input.vatAmount);
  const notes: string[] = [];
  const rawNotes = cleanText(input.notes, 1000);
  if (rawNotes) notes.push(rawNotes);

  const maxVat = r2((total * VAT_RATE) / (1 + VAT_RATE));
  if (total > 0 && vatAmount > maxVat + 0.05) {
    notes.push(
      `Extracted VAT (${vatAmount.toFixed(2)}) exceeds 15/115 of the total — clamped to ${maxVat.toFixed(2)}; verify against the document.`,
    );
    vatAmount = maxVat;
  }
  if (vatAmount > 0 && total > 0) {
    const expected = maxVat;
    if (Math.abs(vatAmount - expected) > 0.5) {
      notes.push(
        `VAT does not match 15% of the total (expected ~${expected.toFixed(2)}) — the invoice may be partially zero-rated or misread.`,
      );
    }
  }

  const confidenceRaw = typeof input.confidence === 'number' ? input.confidence : 0;
  return {
    supplierName: cleanText(input.supplierName, 120),
    supplierVatNumber: cleanText(input.supplierVatNumber, 20).replace(/[^\d]/g, ''),
    invoiceNumber: cleanText(input.invoiceNumber, 60),
    invoiceDate: cleanIsoDate(input.invoiceDate),
    total,
    vatAmount,
    description: cleanText(input.description, 200),
    vatTreatment: vatAmount > 0 ? 'standard' : 'zero_rated',
    confidence: Math.min(1, Math.max(0, confidenceRaw)),
    notes: notes.join(' '),
  };
}

/** Minimal supplier shape for matching. */
export interface MatchableSupplier {
  id: string;
  name: string;
  vatNumber: string;
}

/**
 * Match an extraction to the suppliers directory: exact VAT number first
 * (digits compared), then case-insensitive name containment either way.
 */
export function matchSupplier(
  extraction: Pick<CaptureExtraction, 'supplierName' | 'supplierVatNumber'>,
  suppliers: MatchableSupplier[],
): MatchableSupplier | null {
  const vat = extraction.supplierVatNumber;
  if (vat) {
    const byVat = suppliers.find((s) => s.vatNumber.replace(/[^\d]/g, '') === vat);
    if (byVat) return byVat;
  }
  const name = extraction.supplierName.trim().toLowerCase();
  if (name.length >= 4) {
    const byName = suppliers.find((s) => {
      const candidate = s.name.trim().toLowerCase();
      return candidate.includes(name) || name.includes(candidate);
    });
    if (byName) return byName;
  }
  return null;
}
