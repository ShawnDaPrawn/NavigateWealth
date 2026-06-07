import { PDFDocument, rgb, StandardFonts } from 'npm:pdf-lib@1.17.1';
import { Document, HeadingLevel, Packer, Paragraph, TextRun } from 'npm:docx';
import type { RoACompiledOutput } from './advice-engine-roa-draft-types.ts';

export async function createCanonicalRoAPdf(compilation: RoACompiledOutput): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const regularFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  let page = pdfDoc.addPage([595, 842]);
  let pageNumber = 1;
  let y = 772;

  const drawShell = () => {
    page.drawText('NAVIGATE WEALTH | RECORD OF ADVICE', {
      x: 48,
      y: 806,
      size: 8,
      font: boldFont,
      color: rgb(0.23, 0.25, 0.32),
    });
    page.drawText(`Version ${compilation.version} | ${compilation.status}`, {
      x: 430,
      y: 806,
      size: 8,
      font: regularFont,
      color: rgb(0.42, 0.45, 0.5),
    });
    page.drawLine({
      start: { x: 48, y: 794 },
      end: { x: 547, y: 794 },
      thickness: 0.6,
      color: rgb(0.9, 0.9, 0.92),
    });
    page.drawLine({
      start: { x: 48, y: 42 },
      end: { x: 547, y: 42 },
      thickness: 0.6,
      color: rgb(0.9, 0.9, 0.92),
    });
    page.drawText(`Page ${pageNumber}`, {
      x: 48,
      y: 28,
      size: 8,
      font: boldFont,
      color: rgb(0.42, 0.45, 0.5),
    });
    page.drawText('Compiled from the canonical RoA source and active module contracts.', {
      x: 100,
      y: 28,
      size: 8,
      font: regularFont,
      color: rgb(0.42, 0.45, 0.5),
    });
  };

  drawShell();

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
      if (y < 56) {
        page = pdfDoc.addPage([595, 842]);
        pageNumber += 1;
        y = 772;
        drawShell();
      }
      page.drawText(line, { x: 48, y, size, font, color: options.color || rgb(0.1, 0.1, 0.1) });
      y -= size + 6;
      line = '';
    };
    for (const word of words) {
      if ((line + ' ' + word).trim().length > maxChars) flush();
      line = `${line} ${word}`.trim();
    }
    flush();
  };

  const drawSection = (section: { title: string; content: string }) => {
    y -= 8;
    drawLine(section.title, { bold: true, size: 13, color: rgb(0.19, 0.18, 0.33) });
    section.content.split('\n').forEach((line) => drawLine(line.replace(/^[-#]\s*/, '')));
  };

  drawLine('Record of Advice', { bold: true, size: 20, color: rgb(0.19, 0.18, 0.33) });
  drawLine(`Client: ${compilation.client?.displayName || 'Unknown Client'}`);
  drawLine(`Adviser: ${compilation.adviser?.displayName || 'Unknown Adviser'}`);
  drawLine(`Version: ${compilation.version} | Generated: ${compilation.generatedAt}`);
  drawLine(compilation.scopeAndPurpose);

  compilation.documentSections.forEach(drawSection);

  for (const module of compilation.modules) {
    y -= 10;
    drawLine(module.title, { bold: true, size: 14, color: rgb(0.19, 0.18, 0.33) });
    drawLine(module.summary);
    module.outputValues.forEach((item) => drawLine(`${item.label}: ${item.value}`));
    for (const section of module.sections) {
      drawLine(section.title, { bold: true, size: 12 });
      section.content.split('\n').forEach((line) => drawLine(line.replace(/^##\s*/, '')));
    }
    if (module.disclosures.length > 0) {
      drawLine('Disclosures', { bold: true, size: 12 });
      module.disclosures.forEach((item) => drawLine(`- ${item}`));
    }
  }

  return await pdfDoc.save();
}

export async function createCanonicalRoADocx(compilation: RoACompiledOutput): Promise<Uint8Array> {
  const children: Paragraph[] = [
    new Paragraph({ text: 'Record of Advice', heading: HeadingLevel.TITLE }),
    new Paragraph({
      children: [new TextRun(`Client: ${compilation.client?.displayName || 'Unknown Client'}`)],
    }),
    new Paragraph({
      children: [new TextRun(`Adviser: ${compilation.adviser?.displayName || 'Unknown Adviser'}`)],
    }),
    new Paragraph({ children: [new TextRun(`Version: ${compilation.version}`)] }),
    new Paragraph({ text: compilation.scopeAndPurpose }),
  ];

  for (const section of compilation.documentSections) {
    children.push(new Paragraph({ text: section.title, heading: HeadingLevel.HEADING_1 }));
    section.content
      .split('\n')
      .filter(Boolean)
      .forEach((line) => {
        const cleaned = line.replace(/^[-#]\s*/, '');
        children.push(new Paragraph({ text: cleaned }));
      });
  }

  for (const module of compilation.modules) {
    children.push(new Paragraph({ text: module.title, heading: HeadingLevel.HEADING_1 }));
    children.push(new Paragraph({ text: module.summary }));
    module.outputValues.forEach((item) => {
      children.push(new Paragraph({ text: `${item.label}: ${item.value}` }));
    });
    for (const section of module.sections) {
      children.push(new Paragraph({ text: section.title, heading: HeadingLevel.HEADING_2 }));
      section.content
        .split('\n')
        .filter(Boolean)
        .forEach((line) => {
          children.push(new Paragraph({ text: line.replace(/^##\s*/, '') }));
        });
    }
    if (module.disclosures.length > 0) {
      children.push(new Paragraph({ text: 'Disclosures', heading: HeadingLevel.HEADING_2 }));
      module.disclosures.forEach((item) =>
        children.push(new Paragraph({ text: item, bullet: { level: 0 } })),
      );
    }
  }

  const doc = new Document({ sections: [{ children }] });
  const buffer = await Packer.toBuffer(doc);
  return buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
}
