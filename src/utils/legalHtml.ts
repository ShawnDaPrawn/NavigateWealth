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

export const LEGAL_DOCUMENT_CONTENT_CLASS = [
  'prose',
  'prose-stone',
  'prose-lg',
  'max-w-none',
  'text-stone-800',
  'prose-headings:font-semibold',
  'prose-headings:tracking-tight',
  'prose-headings:text-stone-950',
  'prose-h1:mt-8',
  'prose-h1:mb-4',
  'prose-h1:text-3xl',
  'prose-h2:mt-8',
  'prose-h2:mb-4',
  'prose-h2:border-b',
  'prose-h2:border-stone-200',
  'prose-h2:pb-2',
  'prose-h2:text-2xl',
  'prose-h3:mt-6',
  'prose-h3:mb-3',
  'prose-h3:text-xl',
  'prose-p:my-4',
  'prose-p:text-[16px]',
  'prose-p:leading-[1.85]',
  '[&_p]:my-4',
  '[&_p+h2]:mt-12',
  '[&_p+h3]:mt-8',
  '[&_h1]:scroll-mt-44',
  '[&_h2]:mt-12',
  '[&_h2]:mb-4',
  '[&_h2]:scroll-mt-44',
  '[&_h2:first-child]:mt-0',
  '[&_h3]:mt-8',
  '[&_h3]:mb-3',
  '[&_h3]:scroll-mt-44',
  '[&_h2+h3]:mt-4',
  '[&_h3+p]:mt-3',
  'prose-strong:font-semibold',
  'prose-strong:text-stone-950',
  'prose-ul:my-4',
  'prose-ol:my-4',
  'prose-li:my-1',
  'prose-li:leading-[1.8]',
  '[&_ul]:list-disc',
  '[&_ul]:pl-6',
  '[&_ol]:list-decimal',
  '[&_ol]:pl-6',
  '[&_li]:pl-1',
  '[&_li::marker]:text-stone-500',
  '[&_li>p]:my-1',
  'prose-table:block',
  'prose-table:w-full',
  'prose-th:bg-stone-100',
  'prose-th:text-stone-900',
  'prose-td:align-top',
  '[&_p:empty]:block',
  '[&_p:empty]:h-5',
].join(' ');

export type LegalDocumentTocItem = {
  id: string;
  title: string;
  level: number;
};

function slugifyLegalHeading(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    || 'section';
}

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

function getLeadingBulletMatch(value: string): RegExpMatchArray | null {
  return value.match(/^\s*([•●◦▪■‣◉○])\s+/);
}

function getElementIndentValue(element: HTMLElement): number {
  const style = element.getAttribute('style') || '';
  const match = style.match(/(?:margin-left|padding-left)\s*:\s*([0-9.]+)(px|pt|em|rem)?/i);

  if (!match) {
    return 0;
  }

  const amount = Number(match[1]);
  if (Number.isNaN(amount)) {
    return 0;
  }

  const unit = (match[2] || 'px').toLowerCase();
  if (unit === 'pt') return amount * (96 / 72);
  if (unit === 'em' || unit === 'rem') return amount * 16;
  return amount;
}

function stripLeadingBulletMarker(element: HTMLElement): HTMLElement {
  const clone = element.cloneNode(true) as HTMLElement;
  const walker = window.document.createTreeWalker(clone, window.NodeFilter.SHOW_TEXT);

  while (walker.nextNode()) {
    const textNode = walker.currentNode as Text;
    const value = textNode.nodeValue || '';
    const match = getLeadingBulletMatch(value);

    if (!match) {
      if (value.trim().length > 0) {
        break;
      }
      continue;
    }

    textNode.nodeValue = value.replace(/^\s*[•●◦▪■‣◉○]\s+/, '');
    break;
  }

  return clone;
}

function normalizeBulletLikeBlocksInContainer(container: HTMLElement): void {
  const childNodes = Array.from(container.childNodes);

  for (let index = 0; index < childNodes.length; index += 1) {
    const node = childNodes[index];

    if (!(node instanceof HTMLElement)) {
      continue;
    }

    if (node.children.length > 0) {
      normalizeBulletLikeBlocksInContainer(node);
    }

    const tag = node.tagName.toLowerCase();
    if (tag !== 'p' && tag !== 'div') {
      continue;
    }

    const match = getLeadingBulletMatch(node.textContent || '');
    if (!match) {
      continue;
    }

    const group: HTMLElement[] = [node];
    const indent = getElementIndentValue(node);
    let cursor = index + 1;

    while (cursor < childNodes.length) {
      const sibling = childNodes[cursor];
      if (!(sibling instanceof HTMLElement)) break;

      const siblingTag = sibling.tagName.toLowerCase();
      if (siblingTag !== 'p' && siblingTag !== 'div') break;

      if (!getLeadingBulletMatch(sibling.textContent || '')) break;

      const siblingIndent = getElementIndentValue(sibling);
      if (Math.abs(siblingIndent - indent) > 8) break;

      group.push(sibling);
      cursor += 1;
    }

    if (group.length === 0) {
      continue;
    }

    const list = window.document.createElement('ul');

    group.forEach((item) => {
      const li = window.document.createElement('li');
      const cleaned = stripLeadingBulletMarker(item);
      li.innerHTML = cleaned.innerHTML;
      list.appendChild(li);
    });

    container.insertBefore(list, group[0]);
    group.forEach((item) => item.remove());
    index += group.length - 1;
  }
}

export function normalizeLegalListStructure(html: string, fallbackHtml = '<p></p>'): string {
  if (typeof window === 'undefined') {
    return html || fallbackHtml;
  }

  const parser = new window.DOMParser();
  const doc = parser.parseFromString(`<div id="legal-list-normalize-root">${html || fallbackHtml}</div>`, 'text/html');
  const root = doc.querySelector('#legal-list-normalize-root');

  if (!root) {
    return html || fallbackHtml;
  }

  normalizeBulletLikeBlocksInContainer(root);
  return root.innerHTML.trim() || fallbackHtml;
}

export function sanitizeLegalDocumentHtml(html: string): string {
  const sanitized = DOMPurify.sanitize(html || '<p></p>', LEGAL_HTML_SANITIZE_CONFIG);
  return normalizeLegalListStructure(sanitized, '<p></p>');
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

  const normalizedLists = normalizeLegalListStructure(root.innerHTML.trim() || fallbackHtml, fallbackHtml);
  return sanitizeLegalDocumentHtml(normalizedLists);
}

export function normalizeLegalDocumentAnchors(
  html: string,
  preferredToc: LegalDocumentTocItem[] = [],
): {
  html: string;
  toc: LegalDocumentTocItem[];
} {
  const fallbackHtml = sanitizeLegalDocumentHtml(html || '<p></p>');

  if (typeof window === 'undefined') {
    return {
      html: fallbackHtml,
      toc: preferredToc,
    };
  }

  const parser = new window.DOMParser();
  const doc = parser.parseFromString(fallbackHtml, 'text/html');
  const headings = Array.from(doc.body.querySelectorAll('h1, h2, h3'));
  const seenIds = new Set<string>();

  const toc = headings.map((heading, index) => {
    const title = heading.textContent?.replace(/\s+/g, ' ').trim() || `Section ${index + 1}`;
    const preferredId = preferredToc[index]?.id?.trim();
    const level = Number(heading.tagName.slice(1));
    let id = preferredId || heading.id || slugifyLegalHeading(title);

    while (seenIds.has(id)) {
      id = `${id}-${seenIds.size + 1}`;
    }

    seenIds.add(id);
    heading.id = id;

    return {
      id,
      title: preferredToc[index]?.title?.trim() || title,
      level: preferredToc[index]?.level || level,
    };
  });

  return {
    html: doc.body.innerHTML.trim() || '<p></p>',
    toc: toc.length > 0 ? toc : preferredToc,
  };
}
