import { PDFDocument, rgb, StandardFonts, type PDFImage } from 'npm:pdf-lib@1.17.1';
import {
  AlignmentType,
  Document,
  Footer,
  Header,
  HeadingLevel,
  ImageRun,
  PageNumber,
  Packer,
  Paragraph,
  TextRun,
} from 'npm:docx';
import type { RoACompiledOutput } from './advice-engine-roa-draft-types.ts';
import { getRoABrandKit, type RoABrandKit } from './advice-engine-roa-branding.ts';

interface MarkdownLine {
  kind: 'heading' | 'bullet' | 'text';
  text: string;
}

/** Light markdown splitter shared by both renderers (the AI authors markdown prose). */
function splitMarkdown(content: string): MarkdownLine[] {
  return content
    .split('\n')
    .map((raw) => raw.replace(/\s+$/, ''))
    .filter((line) => line.length > 0)
    .map((line) => {
      if (/^#{1,6}\s+/.test(line)) {
        return { kind: 'heading' as const, text: line.replace(/^#{1,6}\s+/, '') };
      }
      if (/^[-*•]\s+/.test(line)) {
        return { kind: 'bullet' as const, text: line.replace(/^[-*•]\s+/, '') };
      }
      return { kind: 'text' as const, text: line.replace(/^#+\s*/, '') };
    });
}

// ---------------------------------------------------------------------------
// PDF
// ---------------------------------------------------------------------------

export async function createCanonicalRoAPdf(
  compilation: RoACompiledOutput,
  brand?: RoABrandKit,
): Promise<Uint8Array> {
  const kit = brand || (await getRoABrandKit());
  const pdfDoc = await PDFDocument.create();
  const regularFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const headingColor = rgb(kit.heading.r, kit.heading.g, kit.heading.b);
  const primaryColor = rgb(kit.primary.r, kit.primary.g, kit.primary.b);
  const mutedColor = rgb(kit.muted.r, kit.muted.g, kit.muted.b);
  const borderColor = rgb(kit.border.r, kit.border.g, kit.border.b);
  const inkColor = rgb(0.1, 0.1, 0.1);

  let logoImage: PDFImage | undefined;
  if (kit.logo) {
    try {
      logoImage =
        kit.logo.format === 'jpeg'
          ? await pdfDoc.embedJpg(kit.logo.bytes)
          : await pdfDoc.embedPng(kit.logo.bytes);
    } catch {
      logoImage = undefined;
    }
  }

  let page = pdfDoc.addPage([595, 842]);
  let pageNumber = 1;
  let y = 772;

  const drawShell = () => {
    page.drawText(`${kit.entityName.toUpperCase()} | RECORD OF ADVICE`, {
      x: 48,
      y: 806,
      size: 8,
      font: boldFont,
      color: headingColor,
    });
    page.drawText(`Version ${compilation.version} | ${compilation.status}`, {
      x: 430,
      y: 806,
      size: 8,
      font: regularFont,
      color: mutedColor,
    });
    page.drawLine({
      start: { x: 48, y: 794 },
      end: { x: 547, y: 794 },
      thickness: 1.2,
      color: primaryColor,
    });
    page.drawLine({
      start: { x: 48, y: 42 },
      end: { x: 547, y: 42 },
      thickness: 0.6,
      color: borderColor,
    });
    page.drawText(`Page ${pageNumber}`, {
      x: 48,
      y: 28,
      size: 8,
      font: boldFont,
      color: mutedColor,
    });
    page.drawText(`${kit.entityName} — Record of Advice`, {
      x: 360,
      y: 28,
      size: 8,
      font: regularFont,
      color: mutedColor,
    });
  };

  const newPage = () => {
    page = pdfDoc.addPage([595, 842]);
    pageNumber += 1;
    y = 772;
    drawShell();
  };

  const drawLine = (
    text: string,
    options: { bold?: boolean; size?: number; color?: ReturnType<typeof rgb> } = {},
  ) => {
    const size = options.size || 10;
    const font = options.bold ? boldFont : regularFont;
    const maxChars = Math.max(40, Math.floor(92 * (10 / size)));
    const words = text.split(/\s+/);
    let line = '';
    const flush = () => {
      if (!line) return;
      if (y < 56) newPage();
      page.drawText(line, { x: 48, y, size, font, color: options.color || inkColor });
      y -= size + 6;
      line = '';
    };
    for (const word of words) {
      if ((line + ' ' + word).trim().length > maxChars) flush();
      line = `${line} ${word}`.trim();
    }
    flush();
  };

  const drawMarkdown = (content: string) => {
    for (const line of splitMarkdown(content)) {
      if (line.kind === 'heading') {
        y -= 4;
        drawLine(line.text, { bold: true, size: 11, color: headingColor });
      } else if (line.kind === 'bullet') {
        drawLine(`•  ${line.text}`);
      } else {
        drawLine(line.text);
      }
    }
  };

  const drawSectionHeading = (title: string, size = 13) => {
    y -= 10;
    if (y < 70) newPage();
    drawLine(title, { bold: true, size, color: headingColor });
    page.drawLine({
      start: { x: 48, y: y + 4 },
      end: { x: 547, y: y + 4 },
      thickness: 0.5,
      color: borderColor,
    });
    y -= 4;
  };

  // ── Branded cover page ────────────────────────────────────────────
  if (logoImage) {
    const maxWidth = 150;
    const scale = Math.min(maxWidth / logoImage.width, 60 / logoImage.height, 1);
    const w = logoImage.width * scale;
    const h = logoImage.height * scale;
    page.drawImage(logoImage, { x: 48, y: 760 - h, width: w, height: h });
    y = 760 - h - 30;
  } else {
    y = 740;
  }
  drawShell();

  drawLine('Record of Advice', { bold: true, size: 26, color: headingColor });
  y -= 4;
  drawLine(`Prepared for ${compilation.client?.displayName || 'Unknown Client'}`, {
    size: 12,
    color: mutedColor,
  });
  drawLine(`Adviser: ${compilation.adviser?.displayName || 'Unknown Adviser'}`, {
    size: 11,
    color: mutedColor,
  });
  drawLine(`Generated: ${compilation.generatedAt} | Version ${compilation.version}`, {
    size: 10,
    color: mutedColor,
  });
  y -= 10;
  drawMarkdown(compilation.scopeAndPurpose);

  // ── Canonical document sections ───────────────────────────────────
  for (const section of compilation.documentSections) {
    drawSectionHeading(section.title);
    drawMarkdown(section.content);
  }

  // ── Module narratives ─────────────────────────────────────────────
  for (const module of compilation.modules) {
    drawSectionHeading(module.title, 14);
    if (module.summary) drawLine(module.summary, { color: mutedColor });
    module.outputValues.forEach((item) => drawLine(`${item.label}: ${item.value}`));
    for (const section of module.sections) {
      drawLine(section.title, { bold: true, size: 11, color: headingColor });
      drawMarkdown(section.content);
    }
    if (module.disclosures.length > 0) {
      drawLine('Disclosures', { bold: true, size: 11, color: headingColor });
      module.disclosures.forEach((item) => drawLine(`•  ${item}`));
    }
  }

  return await pdfDoc.save();
}

// ---------------------------------------------------------------------------
// DOCX
// ---------------------------------------------------------------------------

function docxMarkdown(content: string, brand: RoABrandKit): Paragraph[] {
  return splitMarkdown(content).map((line) => {
    if (line.kind === 'heading') {
      return new Paragraph({
        children: [new TextRun({ text: line.text, bold: true, color: brand.heading.hex })],
        spacing: { before: 120, after: 60 },
      });
    }
    if (line.kind === 'bullet') {
      return new Paragraph({ text: line.text, bullet: { level: 0 } });
    }
    return new Paragraph({ text: line.text, spacing: { after: 60 } });
  });
}

export async function createCanonicalRoADocx(
  compilation: RoACompiledOutput,
  brand?: RoABrandKit,
): Promise<Uint8Array> {
  const kit = brand || (await getRoABrandKit());

  const heading1 = (text: string) =>
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 240, after: 80 },
      children: [new TextRun({ text, bold: true, color: kit.heading.hex })],
    });
  const heading2 = (text: string) =>
    new Paragraph({
      heading: HeadingLevel.HEADING_2,
      spacing: { before: 160, after: 60 },
      children: [new TextRun({ text, bold: true, color: kit.heading.hex })],
    });

  const cover: Paragraph[] = [];
  if (kit.logo) {
    try {
      cover.push(
        new Paragraph({
          children: [
            new ImageRun({
              type: kit.logo.format === 'jpeg' ? 'jpg' : 'png',
              data: kit.logo.bytes,
              transformation: { width: 150, height: 50 },
            }),
          ],
        }),
      );
    } catch {
      // Skip logo if it cannot be embedded.
    }
  }
  cover.push(
    new Paragraph({
      heading: HeadingLevel.TITLE,
      children: [new TextRun({ text: 'Record of Advice', bold: true, color: kit.heading.hex })],
    }),
    new Paragraph({
      children: [
        new TextRun({
          text: `Prepared for ${compilation.client?.displayName || 'Unknown Client'}`,
          color: kit.muted.hex,
        }),
      ],
    }),
    new Paragraph({
      children: [
        new TextRun({
          text: `Adviser: ${compilation.adviser?.displayName || 'Unknown Adviser'}`,
          color: kit.muted.hex,
        }),
      ],
    }),
    new Paragraph({
      children: [
        new TextRun({
          text: `Generated ${compilation.generatedAt} • Version ${compilation.version} • ${compilation.status}`,
          color: kit.muted.hex,
        }),
      ],
    }),
    new Paragraph({ text: compilation.scopeAndPurpose, spacing: { before: 160, after: 120 } }),
  );

  const children: Paragraph[] = [...cover];

  for (const section of compilation.documentSections) {
    children.push(heading1(section.title));
    children.push(...docxMarkdown(section.content, kit));
  }

  for (const module of compilation.modules) {
    children.push(heading1(module.title));
    if (module.summary) children.push(new Paragraph({ text: module.summary }));
    module.outputValues.forEach((item) => {
      children.push(new Paragraph({ text: `${item.label}: ${item.value}` }));
    });
    for (const section of module.sections) {
      children.push(heading2(section.title));
      children.push(...docxMarkdown(section.content, kit));
    }
    if (module.disclosures.length > 0) {
      children.push(heading2('Disclosures'));
      module.disclosures.forEach((item) =>
        children.push(new Paragraph({ text: item, bullet: { level: 0 } })),
      );
    }
  }

  const doc = new Document({
    sections: [
      {
        headers: {
          default: new Header({
            children: [
              new Paragraph({
                children: [
                  new TextRun({
                    text: `${kit.entityName} — Record of Advice`,
                    bold: true,
                    size: 16,
                    color: kit.heading.hex,
                  }),
                ],
              }),
            ],
          }),
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({ text: 'Page ', size: 16, color: kit.muted.hex }),
                  new TextRun({ children: [PageNumber.CURRENT], size: 16, color: kit.muted.hex }),
                  new TextRun({ text: ' of ', size: 16, color: kit.muted.hex }),
                  new TextRun({
                    children: [PageNumber.TOTAL_PAGES],
                    size: 16,
                    color: kit.muted.hex,
                  }),
                ],
              }),
            ],
          }),
        },
        children,
      },
    ],
  });

  const buffer = await Packer.toBuffer(doc);
  return buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
}
