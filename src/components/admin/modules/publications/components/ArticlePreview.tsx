/**
 * ArticlePreview — Admin-side preview modal
 *
 * Renders the article as it will appear to readers, using the same
 * magazine-quality typography and styling as the public ArticleDetailPage.
 * Includes drop cap, pull quote styling, callout box detection, and
 * proper prose classes for a WYSIWYG experience.
 *
 * @module publications/components/ArticlePreview
 */

import React, { useRef, useEffect } from 'react';
import { X, Calendar, Clock, User, Monitor, Smartphone, Tablet } from 'lucide-react';
import DOMPurify from 'dompurify';
import { Button } from '../../../../ui/button';
import { Badge } from '../../../../ui/badge';
import { ImageWithFallback } from '../../../../figma/ImageWithFallback';
import { cn } from '../../../../ui/utils';

// ---------------------------------------------------------------------------
// Local types
// ---------------------------------------------------------------------------

interface PreviewArticle {
  title: string;
  subtitle?: string | null;
  slug?: string;
  excerpt?: string;
  content?: string | null;
  body?: string;
  category_id: string;
  type_id: string;
  status?: string;
  is_featured?: boolean;
  author_name?: string;
  feature_image_url?: string;
  featured_image?: string | null;
  reading_time_minutes?: number;
}

interface PreviewCategory {
  id: string;
  name: string;
}

interface ArticlePreviewProps {
  article: PreviewArticle;
  categories: PreviewCategory[];
  types?: { id: string; name: string }[];
  onClose: () => void;
}

// ---------------------------------------------------------------------------
// Content enhancement (same logic as the public page)
// ---------------------------------------------------------------------------

function enhanceArticleHtml(rawHtml: string): string {
  const container = document.createElement('div');
  container.innerHTML = rawHtml;

  // Drop cap on first substantial paragraph
  const paragraphs = container.querySelectorAll('p');
  for (const p of paragraphs) {
    const text = p.textContent?.trim() || '';
    if (text.length > 40 && !p.querySelector('img') && !p.closest('blockquote')) {
      p.classList.add('preview-drop-cap');
      break;
    }
  }

  // Callout detection
  const calloutPrefixes = [
    { prefix: 'Key Takeaway:', className: 'preview-callout preview-callout-takeaway' },
    { prefix: 'Important:', className: 'preview-callout preview-callout-important' },
    { prefix: 'Note:', className: 'preview-callout preview-callout-note' },
    { prefix: 'Tip:', className: 'preview-callout preview-callout-tip' },
    { prefix: 'Risk Warning:', className: 'preview-callout preview-callout-warning' },
    { prefix: "Adviser's Note:", className: 'preview-callout preview-callout-note' },
  ];

  paragraphs.forEach((p) => {
    const text = p.textContent?.trim() || '';
    for (const { prefix, className } of calloutPrefixes) {
      if (text.startsWith(prefix)) {
        const wrapper = document.createElement('div');
        wrapper.className = className;
        wrapper.innerHTML = p.innerHTML;
        p.replaceWith(wrapper);
        break;
      }
    }
  });

  // Pull quote styling
  const blockquotes = container.querySelectorAll('blockquote');
  blockquotes.forEach((bq) => {
    bq.classList.add('preview-pull-quote');
  });

  return container.innerHTML;
}

// Render markdown-style content into HTML, then enhance
function processContent(content: string): string {
  const lines = content.split('\n');
  let html = '';
  let inList = false;
  let listType: 'ul' | 'ol' | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) {
      if (inList) {
        html += listType === 'ul' ? '</ul>' : '</ol>';
        inList = false;
        listType = null;
      }
      continue;
    }

    // Close list if next line is not a list item
    if (inList && !line.match(/^[-*]\s/) && !line.match(/^\d+\.\s/)) {
      html += listType === 'ul' ? '</ul>' : '</ol>';
      inList = false;
      listType = null;
    }

    // Headers
    if (line.startsWith('### ')) {
      html += `<h3>${line.substring(4)}</h3>`;
      continue;
    }
    if (line.startsWith('## ')) {
      html += `<h2>${line.substring(3)}</h2>`;
      continue;
    }
    if (line.startsWith('# ')) {
      html += `<h1>${line.substring(2)}</h1>`;
      continue;
    }

    // Blockquote
    if (line.startsWith('> ')) {
      html += `<blockquote>${line.substring(2)}</blockquote>`;
      continue;
    }

    // Unordered list
    if (line.match(/^[-*]\s/)) {
      if (!inList || listType !== 'ul') {
        if (inList) html += listType === 'ul' ? '</ul>' : '</ol>';
        html += '<ul>';
        inList = true;
        listType = 'ul';
      }
      html += `<li>${line.substring(2)}</li>`;
      continue;
    }

    // Ordered list
    if (line.match(/^\d+\.\s/)) {
      if (!inList || listType !== 'ol') {
        if (inList) html += listType === 'ul' ? '</ul>' : '</ol>';
        html += '<ol>';
        inList = true;
        listType = 'ol';
      }
      html += `<li>${line.replace(/^\d+\.\s/, '')}</li>`;
      continue;
    }

    // Regular paragraph — apply inline formatting
    let processed = line;
    processed = processed.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    processed = processed.replace(/\*(.*?)\*/g, '<em>$1</em>');
    processed = processed.replace(
      /\[(.*?)\]\((.*?)\)/g,
      '<a href="$2" class="text-purple-600 hover:underline">$1</a>'
    );
    processed = processed.replace(
      /`(.*?)`/g,
      '<code class="bg-purple-50 text-purple-600 px-1.5 py-0.5 rounded text-sm font-medium">$1</code>'
    );
    html += `<p>${processed}</p>`;
  }

  if (inList) {
    html += listType === 'ul' ? '</ul>' : '</ol>';
  }

  return html;
}

// Determine if content is HTML or markdown
function isHtmlContent(content: string): boolean {
  return /<[a-z][\s\S]*>/i.test(content.trim());
}

export function ArticlePreview({
  article,
  categories,
  types,
  onClose,
}: ArticlePreviewProps) {
  const categoryName = categories.find((c) => c.id === article.category_id)?.name;
  const bodyContent = article.body || article.content || '';

  // Convert markdown to HTML if needed, then sanitise and enhance
  const rawHtml = isHtmlContent(bodyContent)
    ? bodyContent
    : processContent(bodyContent);
  const sanitisedHtml = DOMPurify.sanitize(rawHtml);
  const enhancedHtml = enhanceArticleHtml(sanitisedHtml);

  // Prevent body scroll when modal is open
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 overflow-auto">
      <div className="min-h-screen py-6 px-4">
        <div className="max-w-4xl mx-auto">
          {/* Toolbar */}
          <div className="flex items-center justify-between mb-4 sticky top-2 z-10">
            <div className="flex items-center gap-2">
              <Badge className="bg-amber-500 text-white border-0 text-xs">
                Preview Mode
              </Badge>
              {article.status && (
                <Badge variant="outline" className="bg-white text-xs">
                  {article.status}
                </Badge>
              )}
            </div>
            <Button
              onClick={onClose}
              variant="outline"
              size="sm"
              className="bg-white shadow-sm"
            >
              <X className="h-4 w-4 mr-2" />
              Close Preview
            </Button>
          </div>

          {/* Preview card */}
          <div className="bg-white rounded-2xl shadow-2xl overflow-hidden ring-1 ring-black/5">
            {/* Header — matches the published page header */}
            <div className="bg-[rgb(49,54,83)] pt-10 pb-10 px-8 md:px-12">
              {/* Badges */}
              <div className="flex items-center gap-2.5 mb-5">
                {categoryName && (
                  <Badge className="bg-purple-500/90 text-white border-0 px-3 py-1 text-xs font-medium">
                    {categoryName}
                  </Badge>
                )}
                <Badge
                  variant="outline"
                  className="text-white/80 border-white/25 text-xs"
                >
                  Insights &amp; Education
                </Badge>
                {article.is_featured && (
                  <Badge className="bg-amber-500 text-white border-0 text-xs">
                    Featured
                  </Badge>
                )}
              </div>

              {/* Title */}
              <h1 className="text-3xl md:text-[2.75rem] font-extrabold text-white leading-tight mb-4 tracking-tight">
                {article.title || 'Untitled Article'}
              </h1>

              {/* Subtitle */}
              {article.subtitle && (
                <p className="text-lg text-white/80 mb-6 max-w-2xl leading-relaxed">
                  {article.subtitle}
                </p>
              )}

              {/* Meta */}
              <div className="flex items-center gap-5 text-sm text-white/70 flex-wrap">
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4" />
                  <span>{article.author_name || 'Navigate Wealth Editorial Team'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  <span>
                    {new Date().toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  <span>{article.reading_time_minutes || 5} min read</span>
                </div>
              </div>
            </div>

            {/* Hero Image */}
            {(article.feature_image_url || article.featured_image) && (
              <div className="px-8 md:px-12 -mt-6">
                <div className="aspect-[21/9] rounded-xl overflow-hidden shadow-lg ring-1 ring-black/5">
                  <ImageWithFallback
                    src={(article.feature_image_url || article.featured_image)!}
                    alt={article.title}
                    className="w-full h-full object-cover"
                  />
                </div>
              </div>
            )}

            {/* Article content */}
            <div className="p-8 md:p-12">
              {/* Excerpt */}
              {article.excerpt && (
                <div className="mb-10 pl-6 border-l-[3px] border-purple-500">
                  <p className="text-lg text-gray-600 leading-relaxed italic">
                    {article.excerpt}
                  </p>
                </div>
              )}

              {/* Body */}
              {bodyContent ? (
                <div
                  className={cn(
                    'preview-body',
                    'prose prose-lg max-w-none',
                    'prose-headings:font-bold prose-headings:text-gray-900 prose-headings:tracking-tight',
                    'prose-h2:text-2xl prose-h2:mt-12 prose-h2:mb-5 prose-h2:pb-3 prose-h2:border-b prose-h2:border-gray-100',
                    'prose-h3:text-xl prose-h3:mt-10 prose-h3:mb-4',
                    'prose-p:text-gray-700 prose-p:leading-[1.85] prose-p:mb-5 prose-p:text-[16px]',
                    'prose-a:text-purple-600 prose-a:font-medium prose-a:no-underline hover:prose-a:underline',
                    'prose-strong:text-gray-900 prose-strong:font-semibold',
                    'prose-ul:my-6 prose-ol:my-6',
                    'prose-li:text-gray-700 prose-li:my-2 prose-li:leading-relaxed',
                    'prose-img:rounded-xl prose-img:shadow-lg prose-img:my-8',
                    'prose-code:text-purple-600 prose-code:bg-purple-50 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-sm prose-code:font-medium'
                  )}
                  dangerouslySetInnerHTML={{ __html: enhancedHtml }}
                />
              ) : (
                <div className="py-12 text-center">
                  <p className="text-gray-400 italic text-lg">
                    No content to preview yet.
                  </p>
                  <p className="text-gray-300 text-sm mt-2">
                    Start writing in the editor to see your article here.
                  </p>
                </div>
              )}

              {/* Disclaimer preview */}
              <div className="mt-10 p-5 rounded-xl bg-gray-50 border border-gray-100 text-xs text-gray-500 leading-relaxed">
                <p>
                  <strong className="text-gray-600">Disclaimer:</strong> This
                  article is for informational purposes only and does not
                  constitute financial, tax, or legal advice. Please consult a
                  qualified financial adviser before making any investment
                  decisions. Navigate Wealth is an authorised
                  Financial Services Provider.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Preview-specific styles */}
      <style>{`
        .preview-drop-cap::first-letter {
          float: left;
          font-size: 3.75rem;
          font-weight: 700;
          line-height: 0.8;
          margin-right: 0.15em;
          margin-top: 0.1em;
          color: rgb(109, 40, 217);
          font-family: Georgia, 'Times New Roman', serif;
        }

        .preview-body .preview-pull-quote,
        .preview-body blockquote {
          position: relative;
          margin: 2.5rem 0;
          padding: 2rem 2rem 2rem 2.5rem;
          border-left: 4px solid rgb(139, 92, 246);
          background: linear-gradient(135deg, rgb(245, 243, 255) 0%, rgb(238, 242, 255) 100%);
          border-radius: 0 1rem 1rem 0;
          font-style: italic;
          font-size: 1.125rem;
          line-height: 1.75;
          color: rgb(55, 48, 163);
        }

        .preview-body .preview-pull-quote::before,
        .preview-body blockquote::before {
          content: '"';
          position: absolute;
          top: -0.25rem;
          left: 0.75rem;
          font-size: 4rem;
          font-weight: 700;
          color: rgb(196, 181, 253);
          font-family: Georgia, 'Times New Roman', serif;
          line-height: 1;
        }

        .preview-callout {
          margin: 2rem 0;
          padding: 1.25rem 1.5rem;
          border-radius: 0.75rem;
          font-style: normal;
          font-size: 0.9375rem;
          line-height: 1.7;
        }

        .preview-callout-takeaway {
          background-color: rgb(240, 253, 244);
          border: 1px solid rgb(187, 247, 208);
          color: rgb(22, 101, 52);
        }
        .preview-callout-takeaway::before {
          content: '\\1F4A1  Key Takeaway';
          display: block;
          font-weight: 700;
          margin-bottom: 0.5rem;
          font-size: 0.8125rem;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .preview-callout-important,
        .preview-callout-warning {
          background-color: rgb(255, 251, 235);
          border: 1px solid rgb(253, 224, 71);
          color: rgb(113, 63, 18);
        }
        .preview-callout-important::before {
          content: '\\26A0\\FE0F  Important';
          display: block;
          font-weight: 700;
          margin-bottom: 0.5rem;
          font-size: 0.8125rem;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }
        .preview-callout-warning::before {
          content: '\\26A0\\FE0F  Risk Warning';
          display: block;
          font-weight: 700;
          margin-bottom: 0.5rem;
          font-size: 0.8125rem;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .preview-callout-note {
          background-color: rgb(239, 246, 255);
          border: 1px solid rgb(191, 219, 254);
          color: rgb(30, 64, 175);
        }
        .preview-callout-note::before {
          content: '\\1F4DD  Note';
          display: block;
          font-weight: 700;
          margin-bottom: 0.5rem;
          font-size: 0.8125rem;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .preview-callout-tip {
          background-color: rgb(245, 243, 255);
          border: 1px solid rgb(221, 214, 254);
          color: rgb(76, 29, 149);
        }
        .preview-callout-tip::before {
          content: '\\2728  Tip';
          display: block;
          font-weight: 700;
          margin-bottom: 0.5rem;
          font-size: 0.8125rem;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }
      `}</style>
    </div>
  );
}