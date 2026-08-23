/**
 * HTML parsing for the letter .docx export: converts rich-text HTML from
 * text blocks into docx TextRun/Paragraph arrays. Moved verbatim from
 * letterDocxExport.ts.
 */
import { Paragraph, TextRun, HeadingLevel, convertMillimetersToTwip } from 'docx';
import { TEXT_DARK } from './letterDocxTheme';

/**
 * Very simple HTML-to-TextRun parser. Handles <p>, <strong>/<b>,
 * <em>/<i>, <u>, <br>, and plain text. Strips everything else.
 */
export function htmlToTextRuns(html: string, baseSizePt: number): TextRun[] {
  if (!html) return [new TextRun({ text: ' ', size: baseSizePt * 2 })];

  const runs: TextRun[] = [];

  // Create a temporary DOM element to parse
  const div = document.createElement('div');
  div.innerHTML = html;

  function walk(node: Node, bold = false, italic = false, underline = false) {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent || '';
      if (text) {
        runs.push(
          new TextRun({
            text,
            bold,
            italics: italic,
            underline: underline ? {} : undefined,
            size: baseSizePt * 2, // half-points
            color: TEXT_DARK,
            font: 'Calibri',
          }),
        );
      }
      return;
    }

    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const el = node as HTMLElement;
    const tag = el.tagName.toLowerCase();

    if (tag === 'br') {
      runs.push(new TextRun({ break: 1, size: baseSizePt * 2 }));
      return;
    }

    const nextBold = bold || tag === 'strong' || tag === 'b';
    const nextItalic = italic || tag === 'em' || tag === 'i';
    const nextUnderline = underline || tag === 'u';

    for (const child of Array.from(el.childNodes)) {
      walk(child, nextBold, nextItalic, nextUnderline);
    }
  }

  walk(div);

  return runs.length > 0 ? runs : [new TextRun({ text: ' ', size: baseSizePt * 2 })];
}

/**
 * Convert an HTML string (from a text block) into an array of Paragraphs.
 * Each <p> becomes a separate Paragraph; inline formatting is preserved.
 */
export function htmlToParagraphs(
  html: string,
  baseSizePt: number,
  lineSpacing?: number,
): Paragraph[] {
  if (!html) {
    return [new Paragraph({ children: [new TextRun({ text: ' ', size: baseSizePt * 2 })] })];
  }

  const div = document.createElement('div');
  div.innerHTML = html;

  const paragraphs: Paragraph[] = [];

  // Spacing in twips (1pt = 20 twips)
  const spacingAfter = 100; // ~5pt after each paragraph
  const lineRule = lineSpacing ? Math.round(lineSpacing * 240) : Math.round(1.65 * 240);

  function processNode(node: Node) {
    if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as HTMLElement;
      const tag = el.tagName.toLowerCase();

      if (tag === 'p') {
        const runs = htmlToTextRuns(el.innerHTML, baseSizePt);
        paragraphs.push(
          new Paragraph({
            children: runs,
            spacing: { after: spacingAfter, line: lineRule },
          }),
        );
      } else if (tag === 'ul' || tag === 'ol') {
        const items = el.querySelectorAll(':scope > li');
        items.forEach((li, idx) => {
          const runs = htmlToTextRuns(li.innerHTML, baseSizePt);
          const bullet = tag === 'ul' ? '\u2022 ' : `${idx + 1}. `;
          paragraphs.push(
            new Paragraph({
              children: [
                new TextRun({
                  text: bullet,
                  size: baseSizePt * 2,
                  font: 'Calibri',
                  color: TEXT_DARK,
                }),
                ...runs,
              ],
              spacing: { after: 60, line: lineRule },
              indent: { left: convertMillimetersToTwip(5) },
            }),
          );
        });
      } else if (tag === 'h1' || tag === 'h2' || tag === 'h3') {
        const level =
          tag === 'h1'
            ? HeadingLevel.HEADING_1
            : tag === 'h2'
              ? HeadingLevel.HEADING_2
              : HeadingLevel.HEADING_3;
        paragraphs.push(
          new Paragraph({
            heading: level,
            children: htmlToTextRuns(el.innerHTML, baseSizePt + 2),
            spacing: { before: 200, after: 100 },
          }),
        );
      } else {
        // Fallback — treat as paragraph
        for (const child of Array.from(el.childNodes)) {
          processNode(child);
        }
      }
    } else if (node.nodeType === Node.TEXT_NODE) {
      const text = (node.textContent || '').trim();
      if (text) {
        paragraphs.push(
          new Paragraph({
            children: [
              new TextRun({ text, size: baseSizePt * 2, font: 'Calibri', color: TEXT_DARK }),
            ],
            spacing: { after: spacingAfter, line: lineRule },
          }),
        );
      }
    }
  }

  for (const child of Array.from(div.childNodes)) {
    processNode(child);
  }

  return paragraphs.length > 0
    ? paragraphs
    : [new Paragraph({ children: [new TextRun({ text: ' ', size: baseSizePt * 2 })] })];
}
