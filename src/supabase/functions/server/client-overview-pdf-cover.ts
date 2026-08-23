/**
 * Cover page, report-body transition, and section 1 (client profile) of the
 * client overview PDF. Bodies are moved verbatim from
 * client-overview-pdf-service.ts; the former closure cursor `y` is now ctx.y
 * and the shared layout utilities are called through ctx (see PdfContext).
 */
import type { ClientOverviewReportData } from './client-overview-pdf-model.ts';
import { BRAND, capitalize, fmt, fmtDate } from './client-overview-pdf-model.ts';
import type { PdfContext } from './client-overview-pdf-context.ts';

export function renderCoverAndProfile(ctx: PdfContext, data: ClientOverviewReportData): void {
  const { doc, margin, contentWidth, pageWidth, pageHeight } = ctx;

  // ────────────────────────────────────────────────────────────────────
  // COVER PAGE
  // ────────────────────────────────────────────────────────────────────

  // Purple header band
  doc.setFillColor(...BRAND.primary);
  doc.rect(0, 0, pageWidth, 60, 'F');

  // Title text
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(26);
  doc.setTextColor(...BRAND.white);
  doc.text('Client Overview Report', margin, 30);

  doc.setFontSize(13);
  doc.setFont('helvetica', 'normal');
  doc.text('Navigate Wealth', margin, 42);

  // Client name block
  ctx.y = 80;
  doc.setFontSize(20);
  doc.setTextColor(...BRAND.dark);
  doc.setFont('helvetica', 'bold');
  const fullName = `${data.profile?.title ? data.profile.title + ' ' : ''}${data.client.firstName} ${data.client.lastName}`;
  doc.text(fullName, margin, ctx.y);
  ctx.y += 10;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...BRAND.muted);
  if (data.client.applicationNumber) {
    doc.text(`Application #: ${data.client.applicationNumber}`, margin, ctx.y);
    ctx.y += 6;
  }
  doc.text(`Status: ${capitalize(data.client.applicationStatus)}`, margin, ctx.y);
  ctx.y += 6;
  doc.text(`Client Since: ${fmtDate(data.client.createdAt)}`, margin, ctx.y);
  ctx.y += 6;
  doc.text(`Report Generated: ${fmtDate(data.generatedAt)}`, margin, ctx.y);
  ctx.y += 6;
  if (data.advisorName) {
    doc.text(`Prepared by: ${data.advisorName}`, margin, ctx.y);
    ctx.y += 6;
  }

  // Confidentiality notice
  ctx.y = pageHeight - 50;
  doc.setFontSize(8);
  doc.setTextColor(...BRAND.muted);
  doc.setFont('helvetica', 'italic');
  const notice =
    'CONFIDENTIAL — This document is prepared for the exclusive use of the named client and their financial adviser. It contains personal financial information and must not be distributed without authorisation.';
  const noticeLines = doc.splitTextToSize(notice, contentWidth);
  doc.text(noticeLines, margin, ctx.y);

  // ────────────────────────────────────────────────────────────────────
  // PAGE 2+: Report body
  // ────────────────────────────────────────────────────────────────────
  doc.addPage();
  ctx.y = margin;

  // ── 1. Client Profile ──────────────────────────────────────────────
  ctx.sectionHeading('1. Client Profile');

  const pr = data.profile;
  if (pr) {
    // Personal
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...BRAND.text);
    doc.text('Personal', margin, ctx.y);
    ctx.y += 5;

    ctx.kvRow('Full Name', fullName);
    ctx.kvRow('Age', pr.age !== null ? `${pr.age} years` : '-');
    ctx.kvRow('Date of Birth', fmtDate(pr.dateOfBirth));
    ctx.kvRow('Gender', capitalize(pr.gender));
    ctx.kvRow('ID Number', pr.maskedIdNumber || '-');
    ctx.kvRow('Tax Number', pr.taxNumber || '-');
    ctx.kvRow('Nationality', pr.nationality || '-');
    ctx.kvRow(
      'Marital Status',
      `${capitalize(pr.maritalStatus)}${pr.maritalRegime ? ` (${pr.maritalRegime})` : ''}`,
    );
    ctx.kvRow('Smoker', pr.smokerStatus ? 'Yes' : 'No');

    ctx.y += 3;
    doc.setFont('helvetica', 'bold');
    doc.text('Contact', margin, ctx.y);
    ctx.y += 5;
    ctx.kvRow('Email', pr.email || data.client.email);
    ctx.kvRow('Phone', pr.phone || '-');
    ctx.kvRow('Address', pr.address || '-');

    ctx.y += 3;
    doc.setFont('helvetica', 'bold');
    doc.text('Employment', margin, ctx.y);
    ctx.y += 5;
    ctx.kvRow('Status', capitalize(pr.employmentStatus));
    if (pr.employer) ctx.kvRow('Employer', pr.employer);
    if (pr.position) ctx.kvRow('Position', pr.position);
    if (pr.industry) ctx.kvRow('Industry', pr.industry);
    ctx.kvRow('Gross Monthly Income', fmt(data.financials.grossMonthly));
    ctx.kvRow('Net Monthly Income', fmt(data.financials.netMonthly));
    if (pr.riskProfile) ctx.kvRow('Risk Profile', pr.riskProfile);
  } else {
    doc.setFontSize(9);
    doc.setTextColor(...BRAND.muted);
    doc.text('Profile data not available.', margin, ctx.y);
    ctx.y += 6;
  }
}
