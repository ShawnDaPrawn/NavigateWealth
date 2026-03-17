/**
 * TableOfContents
 *
 * Auto-generated, sticky sidebar table of contents for articles.
 * Parses rendered heading elements (h2, h3) from the article container,
 * highlights the currently-visible heading via IntersectionObserver,
 * and smooth-scrolls to the target heading on click.
 *
 * @module article-detail/TableOfContents
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { List } from 'lucide-react';
import { cn } from '../../ui/utils';

interface TocEntry {
  id: string;
  text: string;
  level: 2 | 3;
}

interface TableOfContentsProps {
  /** Ref to the rendered article content container */
  contentRef: React.RefObject<HTMLElement | null>;
}

export function TableOfContents({ contentRef }: TableOfContentsProps) {
  const [entries, setEntries] = useState<TocEntry[]>([]);
  const [activeId, setActiveId] = useState<string>('');
  const observerRef = useRef<IntersectionObserver | null>(null);

  // Parse headings from the article content once it's rendered
  useEffect(() => {
    const el = contentRef.current;
    if (!el) return;

    // Give the DOM a tick to finish rendering (DOMPurify + dangerouslySetInnerHTML)
    const timer = setTimeout(() => {
      const headings = el.querySelectorAll('h2, h3');
      const tocEntries: TocEntry[] = [];

      headings.forEach((heading, index) => {
        // Generate a stable id if one doesn't exist
        if (!heading.id) {
          heading.id = `toc-heading-${index}`;
        }

        tocEntries.push({
          id: heading.id,
          text: heading.textContent?.trim() || '',
          level: heading.tagName === 'H2' ? 2 : 3,
        });
      });

      setEntries(tocEntries);
    }, 200);

    return () => clearTimeout(timer);
  }, [contentRef]);

  // Observe heading visibility for active-state highlighting
  useEffect(() => {
    if (entries.length === 0) return;

    // Clean up previous observer
    if (observerRef.current) {
      observerRef.current.disconnect();
    }

    const callback: IntersectionObserverCallback = (observerEntries) => {
      // Find the first heading that is intersecting (visible in viewport)
      for (const entry of observerEntries) {
        if (entry.isIntersecting) {
          setActiveId(entry.target.id);
          break;
        }
      }
    };

    observerRef.current = new IntersectionObserver(callback, {
      // Trigger when heading is within the top 30% of the viewport
      rootMargin: '0px 0px -70% 0px',
      threshold: 0.1,
    });

    entries.forEach(({ id }) => {
      const el = document.getElementById(id);
      if (el) observerRef.current?.observe(el);
    });

    return () => {
      observerRef.current?.disconnect();
    };
  }, [entries]);

  const handleClick = useCallback((id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setActiveId(id);
    }
  }, []);

  if (entries.length < 2) return null; // Don't show for very short articles

  return (
    <nav
      className="hidden xl:block sticky top-24 w-64 flex-shrink-0 self-start"
      aria-label="Table of contents"
    >
      <div className="border-l-2 border-gray-200 pl-4">
        <div className="flex items-center gap-2 mb-4">
          <List className="h-4 w-4 text-purple-600" />
          <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-500">
            In this article
          </h4>
        </div>

        <ul className="space-y-1">
          {entries.map((entry) => (
            <li key={entry.id}>
              <button
                onClick={() => handleClick(entry.id)}
                className={cn(
                  'block w-full text-left text-sm leading-snug py-1.5 transition-colors duration-150',
                  entry.level === 3 && 'pl-4',
                  activeId === entry.id
                    ? 'text-purple-700 font-medium'
                    : 'text-gray-500 hover:text-gray-800'
                )}
              >
                {entry.text}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </nav>
  );
}
