import { createModuleLogger } from './stderr-logger.ts';
import { APIError } from './error.middleware.ts';

const log = createModuleLogger('resources-service');

export function generateId(): string {
  return crypto.randomUUID();
}

export function legalDefinitionKey(slug: string): string {
  return `legal_document_definition:${slug}`;
}

export function legalVersionKey(slug: string, versionId: string): string {
  return `legal_document_version:${slug}:${versionId}`;
}

export function incrementLegalVersion(versionNumber?: string | null): string {
  const fallback = '1.0';
  if (!versionNumber) return fallback;

  const match = versionNumber.trim().match(/^(\d+)\.(\d+)$/);
  if (!match) return versionNumber.trim() || fallback;

  const major = Number(match[1]);
  const minor = Number(match[2]);
  return `${major}.${minor + 1}`;
}

function slugifyHeading(value: string): string {
  const normalized = value
    .toLowerCase()
    .replace(/&nbsp;/g, ' ')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');

  return normalized || `section-${crypto.randomUUID().slice(0, 8)}`;
}

function sanitizeLegalHtml(sourceHtml: string): string {
  const withoutDangerousTags = sourceHtml
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<\?xml[\s\S]*?\?>/gi, '')
    .replace(/<\/?[a-z0-9_-]+:[^>]*>/gi, '')
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, '')
    .replace(/<iframe[\s\S]*?>[\s\S]*?<\/iframe>/gi, '')
    .replace(/<object[\s\S]*?>[\s\S]*?<\/object>/gi, '')
    .replace(/<embed[\s\S]*?>[\s\S]*?<\/embed>/gi, '');

  return withoutDangerousTags
    .replace(/\s+xmlns(:[a-z0-9_-]+)?="[^"]*"/gi, '')
    .replace(/\s+xmlns(:[a-z0-9_-]+)?='[^']*'/gi, '')
    .replace(/\s+xml:[a-z0-9_-]+="[^"]*"/gi, '')
    .replace(/\s+xml:[a-z0-9_-]+='[^']*'/gi, '')
    .replace(/\s+on[a-z]+\s*=\s*"[^"]*"/gi, '')
    .replace(/\s+on[a-z]+\s*=\s*'[^']*'/gi, '')
    .replace(/\s+on[a-z]+\s*=\s*[^\s>]+/gi, '')
    .replace(/javascript:/gi, '')
    .replace(/\s+style="([^"]*)"/gi, (_, styles: string) => {
      const cleaned = styles
        .split(';')
        .map((rule) => rule.trim())
        .filter(Boolean)
        .filter((rule) => {
          const property = rule.split(':')[0]?.trim().toLowerCase() || '';
          return (
            property.length > 0 &&
            !property.startsWith('mso-') &&
            property !== 'tab-stops' &&
            property !== 'layout-grid-mode' &&
            property !== 'behavior'
          );
        })
        .join('; ');

      return cleaned ? ` style="${cleaned}"` : '';
    })
    .replace(/\s+style='([^']*)'/gi, (_, styles: string) => {
      const cleaned = styles
        .split(';')
        .map((rule) => rule.trim())
        .filter(Boolean)
        .filter((rule) => {
          const property = rule.split(':')[0]?.trim().toLowerCase() || '';
          return (
            property.length > 0 &&
            !property.startsWith('mso-') &&
            property !== 'tab-stops' &&
            property !== 'layout-grid-mode' &&
            property !== 'behavior'
          );
        })
        .join('; ');

      return cleaned ? ` style='${cleaned}'` : '';
    })
    .replace(/\u00a0/g, ' ')
    .trim();
}

function decodeLegalHtmlEntities(value: string): string {
  return value
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");
}

function stripLegalHtmlTags(value: string): string {
  return decodeLegalHtmlEntities(
    value
      .replace(/<br\s*\/?>/gi, ' ')
      .replace(/<\/(p|div|section|article|li|tr|td|th|h1|h2|h3|h4|h5|h6)>/gi, ' ')
      .replace(/<[^>]+>/g, ' '),
  )
    .replace(/\s+/g, ' ')
    .trim();
}

function upsertHeadingIdAttribute(attributes: string, id: string): string {
  if (!attributes.trim()) {
    return ` id="${id}"`;
  }

  if (/(\s|^)id\s*=\s*(['"])[^'"]*\2/i.test(attributes)) {
    return attributes.replace(
      /(\s|^)id\s*=\s*(['"])[^'"]*\2/i,
      (match, prefix) => `${prefix}id="${id}"`,
    );
  }

  return `${attributes} id="${id}"`;
}

export function normalizeLegalDocumentContent(sourceHtml: string) {
  const sanitizedHtml = sanitizeLegalHtml(sourceHtml || '');
  const seenIds = new Set<string>();
  const toc: Array<{ id: string; title: string; level: number }> = [];

  const normalizedHtml =
    (sanitizedHtml || '<p></p>')
      .replace(
        /<h([1-3])([^>]*)>([\s\S]*?)<\/h\1>/gi,
        (_match, levelText: string, attributes: string, innerHtml: string) => {
          const title = stripLegalHtmlTags(innerHtml) || 'Untitled section';
          const level = Number(levelText);
          const existingIdMatch = attributes.match(/(?:\s|^)id\s*=\s*(['"])([^'"]+)\1/i);
          let id = existingIdMatch?.[2]?.trim() || slugifyHeading(title);

          while (seenIds.has(id)) {
            id = `${id}-${seenIds.size + 1}`;
          }

          seenIds.add(id);
          toc.push({ id, title, level });

          const nextAttributes = upsertHeadingIdAttribute(attributes || '', id);
          return `<h${levelText}${nextAttributes}>${innerHtml}</h${levelText}>`;
        },
      )
      .trim() || '<p></p>';

  const plainText = stripLegalHtmlTags(normalizedHtml);
  const wordCount = plainText ? plainText.split(/\s+/).length : 0;

  return {
    sourceHtml: normalizedHtml,
    normalizedContent: {
      html: normalizedHtml,
      plainText,
      wordCount,
      headingCount: toc.length,
    },
    toc,
    blocks: [
      {
        id: generateId(),
        type: 'text',
        data: { content: normalizedHtml },
      },
    ],
  };
}

export function buildLegalTocFromBlocks(blocks: Array<Record<string, unknown>> | undefined) {
  const seenIds = new Set<string>();

  return (blocks || [])
    .filter((block) => block?.type === 'section_header')
    .map((block, index) => {
      const data = (block.data || {}) as Record<string, unknown>;
      const number =
        typeof data.number === 'string' && data.number.trim() ? `${data.number.trim()} ` : '';
      const title =
        typeof data.title === 'string' && data.title.trim()
          ? `${number}${data.title.trim()}`.trim()
          : `Section ${index + 1}`;
      let id = slugifyHeading(title);

      while (seenIds.has(id)) {
        id = `${id}-${seenIds.size + 1}`;
      }

      seenIds.add(id);

      return {
        id,
        title,
        level: 2,
      };
    });
}

function escapeLegalHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function convertLegacyBlocksToLegalHtml(
  blocks: Array<Record<string, unknown>> | undefined,
  fallbackTitle: string,
) {
  const legacyBlocks = Array.isArray(blocks) ? blocks : [];
  const html = legacyBlocks
    .map((block, index) => {
      const type = typeof block?.type === 'string' ? block.type : '';
      const data = (block?.data || {}) as Record<string, unknown>;

      if (type === 'section_header') {
        const rawTitle =
          typeof data.title === 'string' && data.title.trim() ? data.title.trim() : fallbackTitle;
        const number =
          typeof data.number === 'string' && data.number.trim() ? `${data.number.trim()} ` : '';
        const heading = `${number}${rawTitle}`.trim();
        return `<h2>${escapeLegalHtml(heading)}</h2>`;
      }

      if (type === 'text') {
        return typeof data.content === 'string' && data.content.trim() ? data.content.trim() : '';
      }

      if (type === 'page_break') {
        return '<div class="legal-page-break"></div>';
      }

      if (type === 'signature') {
        const signatories = Array.isArray(data.signatories) ? data.signatories : [];
        const signatureHtml = signatories
          .map((entry) => {
            const label =
              typeof entry === 'object' &&
              entry &&
              typeof (entry as Record<string, unknown>).label === 'string'
                ? String((entry as Record<string, unknown>).label)
                : 'Signature';

            return `
            <div class="legal-signature-line">
              <div class="line"></div>
              <span>${escapeLegalHtml(label)}</span>
            </div>
          `;
          })
          .join('');

        return signatureHtml ? `<div class="legal-signatures">${signatureHtml}</div>` : '';
      }

      if (type === 'field_grid') {
        const fields = Array.isArray(data.fields) ? data.fields : [];
        if (fields.length === 0) return '';

        const rows = fields
          .map((field) => {
            const label =
              typeof field === 'object' &&
              field &&
              typeof (field as Record<string, unknown>).label === 'string'
                ? String((field as Record<string, unknown>).label)
                : 'Field';

            return `<tr><th>${escapeLegalHtml(label)}</th><td></td></tr>`;
          })
          .join('');

        return `<table><tbody>${rows}</tbody></table>`;
      }

      if (type === 'table') {
        const hasRowHeaders = Boolean(data.hasRowHeaders);
        const hasColumnHeaders = Boolean(data.hasColumnHeaders);
        const columnHeaders = Array.isArray(data.columnHeaders) ? data.columnHeaders : [];
        const rowHeaders = Array.isArray(data.rowHeaders) ? data.rowHeaders : [];
        const rows = Array.isArray(data.rows) ? data.rows : [];

        const thead = hasColumnHeaders
          ? `<thead><tr>${hasRowHeaders ? '<th></th>' : ''}${columnHeaders.map((header) => `<th>${escapeLegalHtml(String(header || ''))}</th>`).join('')}</tr></thead>`
          : '';

        const tbody = rows
          .map((row, rowIndex) => {
            const record = (row || {}) as Record<string, unknown>;
            const cells = Array.isArray(record.cells) ? record.cells : [];
            const rowHeader = hasRowHeaders
              ? `<th>${escapeLegalHtml(String(rowHeaders[rowIndex] || ''))}</th>`
              : '';
            return `
            <tr>
              ${rowHeader}
              ${cells
                .map((cell) => {
                  const value =
                    typeof cell === 'object' &&
                    cell &&
                    typeof (cell as Record<string, unknown>).value === 'string'
                      ? String((cell as Record<string, unknown>).value)
                      : '';
                  return `<td>${escapeLegalHtml(value)}</td>`;
                })
                .join('')}
            </tr>
          `;
          })
          .join('');

        return `<table>${thead}<tbody>${tbody}</tbody></table>`;
      }

      return index === 0 ? `<p></p>` : '';
    })
    .filter(Boolean)
    .join('\n');

  return html.trim() || `<h1>${escapeLegalHtml(fallbackTitle)}</h1><p></p>`;
}

export interface RSSItem {
  title: string;
  link: string;
  description: string;
  pubDate: string;
  guid: string;
}

export function parseRSStoJSON(xmlText: string): RSSItem[] {
  try {
    const items: RSSItem[] = [];

    const itemRegex = /<item>([\s\S]*?)<\/item>/g;
    const matches = xmlText.matchAll(itemRegex);

    for (const match of matches) {
      const itemXml = match[1];

      const title = itemXml.match(/<title>(.*?)<\/title>/)?.[1] || '';
      const link = itemXml.match(/<link>(.*?)<\/link>/)?.[1] || '';
      const description = itemXml.match(/<description>(.*?)<\/description>/)?.[1] || '';
      const pubDate = itemXml.match(/<pubDate>(.*?)<\/pubDate>/)?.[1] || '';
      const guid = itemXml.match(/<guid.*?>(.*?)<\/guid>/)?.[1] || '';

      items.push({
        title: title.trim(),
        link: link.trim(),
        description: description.trim().replace(/<!\[CDATA\[(.*?)\]\]>/g, '$1'),
        pubDate: pubDate.trim(),
        guid: guid.trim(),
      });
    }

    return items;
  } catch (error) {
    log.error('Failed to parse RSS XML', error as Error);
    throw new APIError('Failed to parse RSS feed', 500, 'RSS_PARSE_ERROR');
  }
}
