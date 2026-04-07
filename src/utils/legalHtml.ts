import DOMPurify from 'dompurify';

const LEGAL_HTML_SANITIZE_CONFIG = {
  USE_PROFILES: { html: true },
  ADD_ATTR: [
    'style',
    'class',
    'id',
    'target',
    'rel',
    'colspan',
    'rowspan',
    'scope',
    'width',
    'height',
    'align',
    'valign',
  ],
  FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'meta', 'link'],
} as const;

function cleanInlineStyle(styleValue: string): string {
  return styleValue
    .split(';')
    .map((rule) => rule.trim())
    .filter(Boolean)
    .filter((rule) => {
      const property = rule.split(':')[0]?.trim().toLowerCase() || '';
      return property.length > 0
        && !property.startsWith('mso-')
        && property !== 'tab-stops'
        && property !== 'layout-grid-mode'
        && property !== 'behavior';
    })
    .join('; ');
}

export function sanitizeLegalDocumentHtml(html: string): string {
  return DOMPurify.sanitize(html || '<p></p>', LEGAL_HTML_SANITIZE_CONFIG);
}

export function normalizeClipboardLegalHtml(rawHtml: string, fallbackHtml = '<p></p>'): string {
  const source = (rawHtml || '').trim();

  if (typeof window === 'undefined') {
    return sanitizeLegalDocumentHtml(source || fallbackHtml);
  }

  const cleanedSource = source
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<\?xml[\s\S]*?\?>/gi, '')
    .replace(/<\/?[a-z0-9_-]+:[^>]*>/gi, '')
    .replace(/\s+xmlns(:[a-z0-9_-]+)?="[^"]*"/gi, '')
    .replace(/\s+xmlns(:[a-z0-9_-]+)?='[^']*'/gi, '')
    .replace(/\s+xml:[a-z0-9_-]+="[^"]*"/gi, '')
    .replace(/\s+xml:[a-z0-9_-]+='[^']*'/gi, '');

  const parser = new window.DOMParser();
  const doc = parser.parseFromString(`<div id="legal-import-root">${cleanedSource || fallbackHtml}</div>`, 'text/html');
  const root = doc.querySelector('#legal-import-root');

  if (!root) {
    return sanitizeLegalDocumentHtml(cleanedSource || fallbackHtml);
  }

  root.querySelectorAll('meta, link').forEach((node) => node.remove());
  root.querySelectorAll<HTMLElement>('*').forEach((element) => {
    for (const attr of Array.from(element.attributes)) {
      const attrName = attr.name.toLowerCase();
      if (attrName.startsWith('on')) {
        element.removeAttribute(attr.name);
        continue;
      }

      if (attrName === 'style') {
        const cleanedStyle = cleanInlineStyle(attr.value);
        if (cleanedStyle) {
          element.setAttribute('style', cleanedStyle);
        } else {
          element.removeAttribute('style');
        }
      }

      if (attrName === 'class') {
        const classes = attr.value
          .split(/\s+/)
          .map((item) => item.trim())
          .filter(Boolean)
          .filter((item) => !/^mso/i.test(item));

        if (classes.length > 0) {
          element.setAttribute('class', classes.join(' '));
        } else {
          element.removeAttribute('class');
        }
      }
    }
  });

  return sanitizeLegalDocumentHtml(root.innerHTML.trim() || fallbackHtml);
}
