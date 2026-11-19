/**
 * The share menu: copy link, and the per-network share targets.
 *
 * Split out of `ArticleDetailPage.tsx` (1,486 lines), which held the page, its
 * loading and error states, the share menu, the fallback article set and every
 * helper in one file. Each was already a self-contained function; only its
 * address changed.
 */
import { useState, useRef, useEffect } from 'react';
import { Button } from '../../ui/button';
import {
  Share2,
  Linkedin,
  Facebook,
  Link as LinkIcon,
  Printer,
  Twitter,
  Mail,
  MessageCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { printArticle } from './articlePrint';

export function ShareActions({ title, excerpt }: { title: string; excerpt?: string }) {
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
      }
    };
    if (showMenu) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showMenu]);

  const copyLink = () => {
    navigator.clipboard
      .writeText(window.location.href)
      .then(() => toast.success('Link copied to clipboard'))
      .catch(() => toast.error('Failed to copy link'));
    setShowMenu(false);
  };

  const shareLinkedIn = () => {
    const url = encodeURIComponent(window.location.href);
    window.open(
      `https://www.linkedin.com/sharing/share-offsite/?url=${url}`,
      '_blank',
      'width=600,height=400',
    );
    setShowMenu(false);
  };

  const shareFacebook = () => {
    const url = encodeURIComponent(window.location.href);
    window.open(
      `https://www.facebook.com/sharer/sharer.php?u=${url}`,
      '_blank',
      'width=600,height=400',
    );
    setShowMenu(false);
  };

  const shareTwitter = () => {
    const url = encodeURIComponent(window.location.href);
    const text = encodeURIComponent(title);
    window.open(
      `https://twitter.com/intent/tweet?url=${url}&text=${text}`,
      '_blank',
      'width=600,height=400',
    );
    setShowMenu(false);
  };

  const shareWhatsApp = () => {
    const text = encodeURIComponent(`${title} — ${window.location.href}`);
    window.open(`https://wa.me/?text=${text}`, '_blank');
    setShowMenu(false);
  };

  const shareEmail = () => {
    const subj = encodeURIComponent(title);
    const body = encodeURIComponent(`${excerpt || title}\n\nRead more: ${window.location.href}`);
    window.location.href = `mailto:?subject=${subj}&body=${body}`;
    setShowMenu(false);
  };

  const handlePrint = () => {
    // Grab the article content from the current page's DOM
    const bodyEl = document.querySelector('.article-body');
    const excerptEl = document.querySelector('.mb-10.pl-6.border-l-\\[3px\\]');

    const articleContentHtml = bodyEl?.innerHTML || '';

    // Build the meta line
    const metaParts: string[] = [];
    const authorEl = document.querySelector('header .flex.flex-wrap.items-center.gap-x-5');
    if (authorEl) {
      const spans = authorEl.querySelectorAll('span');
      spans.forEach((s) => {
        const text = s.textContent?.trim();
        if (text) metaParts.push(text);
      });
    }
    printArticle(title, {
      articleContentHtml,
      excerptText: excerptEl ? excerptEl.querySelector('p')?.textContent || '' : null,
      metaParts,
    });
  };

  return (
    <div className="relative" ref={menuRef}>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowMenu(!showMenu)}
          className="gap-2"
        >
          <Share2 className="h-4 w-4" />
          Share
        </Button>
        <Button variant="outline" size="sm" onClick={handlePrint} className="gap-2 print:hidden">
          <Printer className="h-4 w-4" />
          Print
        </Button>
      </div>

      {showMenu && (
        <div className="absolute top-full left-0 mt-2 bg-white rounded-xl shadow-xl border border-gray-200 py-2 w-56 z-50 animate-in fade-in slide-in-from-top-2 duration-200">
          <button
            onClick={shareLinkedIn}
            className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <Linkedin className="h-4 w-4 text-[#0A66C2]" />
            Share on LinkedIn
          </button>
          <button
            onClick={shareFacebook}
            className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <Facebook className="h-4 w-4 text-[#1877F2]" />
            Share on Facebook
          </button>
          <button
            onClick={shareTwitter}
            className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <Twitter className="h-4 w-4 text-[#1DA1F2]" />
            Share on Twitter
          </button>
          <button
            onClick={shareWhatsApp}
            className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <MessageCircle className="h-4 w-4 text-[#25D366]" />
            Share on WhatsApp
          </button>
          <button
            onClick={shareEmail}
            className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <Mail className="h-4 w-4 text-[#FFD700]" />
            Share via Email
          </button>
          <button
            onClick={copyLink}
            className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <LinkIcon className="h-4 w-4 text-gray-500" />
            Copy Link
          </button>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Content post-processing: inject drop cap, style callouts & blockquotes
// ---------------------------------------------------------------------------

/**
 * Post-processes the sanitised article HTML to add magazine-quality enhancements:
 * - Drop cap on the first paragraph
 * - Enhanced blockquote styling
 * - Key takeaway / callout detection (paragraphs starting with "Key Takeaway:"
 *   or "Important:" get special styling)
 */
