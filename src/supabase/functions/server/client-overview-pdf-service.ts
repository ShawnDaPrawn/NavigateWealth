/**
 * Client Overview PDF Report Generator
 *
 * Produces a branded, multi-section PDF report for a single client.
 * Uses jsPDF + jsPDF-AutoTable for professional layout with tables.
 *
 * The data is pre-computed on the frontend and sent as a typed payload
 * so that the server only handles formatting/rendering.
 *
 * The payload type and formatting helpers live in client-overview-pdf-model,
 * the shared cursor/layout utilities in client-overview-pdf-context, and the
 * section renderers in client-overview-pdf-{cover,snapshot,details}. This
 * file wires them together in section order.
 */

import { jsPDF } from 'npm:jspdf';
import { createModuleLogger } from './stderr-logger.ts';
import type { ClientOverviewReportData } from './client-overview-pdf-model.ts';
import { createPdfContext } from './client-overview-pdf-context.ts';
import { renderCoverAndProfile } from './client-overview-pdf-cover.ts';
import { renderSnapshotSections } from './client-overview-pdf-snapshot.ts';
import { renderDetailSections } from './client-overview-pdf-details.ts';

export type { ClientOverviewReportData } from './client-overview-pdf-model.ts';

const log = createModuleLogger('pdf-service');

// ── PDF generator ───────────────────────────────────────────────────────

export async function generateClientOverviewPDF(
  data: ClientOverviewReportData,
): Promise<Uint8Array> {
  log.info('Generating client overview PDF', {
    client: `${data.client.firstName} ${data.client.lastName}`,
  });

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const ctx = createPdfContext(doc, data.generatedAt);

  renderCoverAndProfile(ctx, data);
  renderSnapshotSections(ctx, data);
  renderDetailSections(ctx, data);

  // ── Add footers to all pages ──────────────────────────────────────
  ctx.addFooter();

  // ── Return PDF bytes ──────────────────────────────────────────────
  const output = doc.output('arraybuffer');
  log.info('PDF generated successfully', { pages: doc.getNumberOfPages() });
  return new Uint8Array(output);
}
