/**
 * ArticleDetailPage — World-Class Published Article View
 *
 * Phase 1 enhancements:
 *  - Reading progress bar (scroll-driven)
 *  - Sticky table of contents (auto-generated from headings, intersection-observed)
 *  - Magazine-quality typography (drop cap, pull quotes, callout boxes, refined prose)
 *  - Related articles section (fetched from same category)
 *  - Author card with gradient design
 *  - Back-to-top floating button
 *  - Social sharing (LinkedIn, Facebook, copy link)
 *  - Print-friendly considerations
 *
 * Self-contained: avoids importing from the publications module barrel to
 * prevent transitive dependency issues with competing type files.
 *
 * @module pages/ArticleDetailPage
 */

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useParams, Link, useNavigate } from 'react-router';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import {
  ArrowLeft,
  Calendar,
  Clock,
  User,
  Share2,
  Linkedin,
  Facebook,
  Link as LinkIcon,
  AlertCircle,
  RefreshCw,
  Loader2,
  Printer,
  BookOpen,
  Eye,
  Twitter,
  Mail,
  MessageCircle,
} from 'lucide-react';
import { toast } from 'sonner@2.0.3';
import DOMPurify from 'dompurify';
import { projectId, publicAnonKey } from '../../utils/supabase/info';
import { API_CONFIG } from '../../utils/api/config';
import { cn } from '../ui/utils';

// Phase 1 sub-components
import { ReadingProgressBar } from './article-detail/ReadingProgressBar';
import { TableOfContents } from './article-detail/TableOfContents';
import { RelatedArticles } from './article-detail/RelatedArticles';
import { AuthorCard } from './article-detail/AuthorCard';
import { BackToTop } from './article-detail/BackToTop';

// ---------------------------------------------------------------------------
// Self-contained utilities
// ---------------------------------------------------------------------------

function formatDate(date: string | Date, options?: Intl.DateTimeFormatOptions): string {
  try {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    if (isNaN(dateObj.getTime())) return 'Invalid date';
    const defaultOptions: Intl.DateTimeFormatOptions = {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      ...options,
    };
    return dateObj.toLocaleDateString('en-US', defaultOptions);
  } catch {
    return 'Invalid date';
  }
}

function estimateReadingTime(html: string): number {
  const text = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  const words = text.split(' ').length;
  return Math.max(1, Math.ceil(words / 200));
}

// ---------------------------------------------------------------------------
// Local article type
// ---------------------------------------------------------------------------

interface ArticleDisplay {
  id: string;
  slug?: string;
  title: string;
  subtitle?: string | null;
  excerpt?: string;
  body?: string;
  content?: string | null;
  author_name?: string;
  category_name?: string;
  category?: { name?: string } | null;
  type_name?: string;
  type?: { name?: string } | null;
  reading_time_minutes?: number;
  published_at?: string | null;
  updated_at?: string | null;
  is_featured?: boolean;
  status?: string;
  tags?: string[];
  featured_image_url?: string;
  featured_image?: string | null;
  feature_image_url?: string;
  hero_image_url?: string;
  thumbnail_image_url?: string;
  created_at?: string;
  category_id?: string;
  type_id?: string;
  view_count?: number;
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// Self-contained hook — fetches a single article by slug
// ---------------------------------------------------------------------------

function useArticleBySlug(slug: string | undefined) {
  const [article, setArticle] = useState<ArticleDisplay | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchArticle = useCallback(async () => {
    if (!slug) return;

    setIsLoading(true);
    setError(null);

    try {
      const url = `${API_CONFIG.BASE_URL}/publications/articles/slug/${slug}`;
      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${publicAnonKey}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch article (${response.status})`);
      }

      const data = await response.json();
      setArticle(data.data || data);

      // Increment view count silently
      const articleData = data.data || data;
      if (articleData?.id) {
        fetch(
          `${API_CONFIG.BASE_URL}/publications/articles/${articleData.id}/increment-views`,
          {
            method: 'POST',
            headers: { Authorization: `Bearer ${publicAnonKey}` },
          }
        ).catch(() => {
          /* silent */
        });
      }
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to fetch article';
      setError(errorMessage);
      console.error('useArticleBySlug error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    fetchArticle();
  }, [fetchArticle]);

  return { article, isLoading, error, refetch: fetchArticle };
}

// ---------------------------------------------------------------------------
// Demo articles fallback
// ---------------------------------------------------------------------------

const DEMO_ARTICLES: Record<string, ArticleDisplay> = {
  'complete-guide-retirement-planning-2025': {
    id: 'demo-retirement-guide-2025',
    slug: 'complete-guide-retirement-planning-2025',
    title: 'The Complete Guide to Retirement Planning in 2025',
    subtitle: 'Essential strategies for building a secure retirement',
    excerpt:
      'Navigate the complexities of retirement planning with our comprehensive guide covering 401(k) optimization, Social Security strategies, and long-term wealth preservation.',
    body: `<h2>Introduction to Retirement Planning</h2><p>Planning for retirement is one of the most important financial decisions you'll make in your lifetime. This comprehensive guide will walk you through the essential strategies and considerations for building a secure retirement.</p><h2>401(k) Optimization Strategies</h2><p>Maximizing your 401(k) contributions is crucial for building retirement wealth. Here are key strategies:</p><ul><li>Take full advantage of employer matching contributions</li><li>Gradually increase contribution rates annually</li><li>Choose appropriate asset allocation based on your age and risk tolerance</li><li>Consider Roth vs. Traditional 401(k) options</li></ul><h2>Social Security Planning</h2><p>Understanding when and how to claim Social Security benefits can significantly impact your retirement income:</p><ul><li>Delaying benefits can increase monthly payments by up to 8% per year</li><li>Coordinate spousal benefits for maximum household income</li><li>Consider your health and longevity expectations</li></ul><blockquote>The single most impactful decision in retirement planning is starting early. Even small, consistent contributions compound dramatically over decades.</blockquote><h2>Long-Term Wealth Preservation</h2><p>Protecting and growing your retirement assets requires careful planning and regular review of your investment strategy. Diversification across asset classes remains the cornerstone of prudent wealth management.</p>`,
    author_name: 'David Rodriguez',
    category_name: 'Retirement Planning',
    category_id: 'demo-category-1',
    type_name: 'Insights & Education',
    reading_time_minutes: 8,
    published_at: '2025-01-15T00:00:00Z',
    is_featured: true,
    status: 'published',
    tags: ['retirement', '401k', 'social security'],
    created_at: '2025-01-15T00:00:00Z',
    updated_at: '2025-01-20T00:00:00Z',
  },
  'tax-efficient-investment-strategies': {
    id: 'demo-tax-efficient-strategies',
    slug: 'tax-efficient-investment-strategies',
    title: 'Tax-Efficient Investment Strategies',
    subtitle: 'Minimize taxes while maximizing returns',
    excerpt:
      'Learn proven strategies to optimize your after-tax investment returns through strategic tax planning and smart investment choices.',
    body: `<h2>Understanding Tax-Efficient Investing</h2><p>Tax efficiency is a critical component of successful long-term investing. By minimizing the tax impact on your investments, you can keep more of your returns working for you.</p><h2>Asset Location Strategy</h2><p>Placing the right investments in the right accounts can significantly reduce your tax burden:</p><ul><li>Hold tax-inefficient assets in tax-deferred accounts</li><li>Keep tax-efficient investments in taxable accounts</li><li>Utilize Roth accounts for high-growth potential investments</li></ul><h2>Tax-Loss Harvesting</h2><p>Strategic realization of losses can offset gains and reduce your tax liability while maintaining your desired asset allocation.</p>`,
    author_name: 'Sarah Chen',
    category_name: 'Estate & Tax Planning',
    category_id: 'demo-category-2',
    type_name: 'Insights & Education',
    reading_time_minutes: 6,
    published_at: '2025-01-10T00:00:00Z',
    is_featured: false,
    status: 'published',
    tags: ['tax planning', 'investments', 'wealth management'],
    created_at: '2025-01-10T00:00:00Z',
    updated_at: '2025-01-10T00:00:00Z',
  },
  'estate-planning-essentials-high-net-worth': {
    id: 'demo-estate-planning-hnw',
    slug: 'estate-planning-essentials-high-net-worth',
    title: 'Estate Planning Essentials for High-Net-Worth Families',
    subtitle: 'Protect and transfer your wealth effectively',
    excerpt:
      'A comprehensive guide to estate planning strategies for high-net-worth individuals and families looking to preserve their legacy.',
    body: `<h2>The Importance of Estate Planning</h2><p>For high-net-worth families, proper estate planning is essential to ensure your wealth is transferred according to your wishes while minimizing tax implications.</p><h2>Key Estate Planning Tools</h2><ul><li>Revocable Living Trusts for probate avoidance</li><li>Irrevocable Life Insurance Trusts (ILITs)</li><li>Family Limited Partnerships (FLPs)</li><li>Charitable Remainder Trusts</li></ul><h2>Wealth Transfer Strategies</h2><p>Strategic gifting and trust structures can help minimize estate taxes while providing for future generations.</p>`,
    author_name: 'Jennifer Walsh',
    category_name: 'Estate & Tax Planning',
    category_id: 'demo-category-2',
    type_name: 'Insights & Education',
    reading_time_minutes: 10,
    published_at: '2025-01-05T00:00:00Z',
    is_featured: false,
    status: 'published',
    tags: ['estate planning', 'trusts', 'wealth transfer'],
    created_at: '2025-01-05T00:00:00Z',
    updated_at: '2025-01-05T00:00:00Z',
  },
  'understanding-risk-management-modern-portfolios': {
    id: 'demo-risk-management',
    slug: 'understanding-risk-management-modern-portfolios',
    title: 'Understanding Risk Management in Modern Portfolios',
    subtitle: 'Balance risk and return effectively',
    excerpt:
      'Learn how to construct resilient portfolios through diversification, strategic asset allocation, and risk management techniques.',
    body: `<h2>The Foundation of Risk Management</h2><p>Effective risk management is crucial for long-term investment success. Understanding and managing risk allows you to achieve your financial goals while protecting your wealth.</p><h2>Diversification Principles</h2><p>Proper diversification across asset classes, sectors, and geographies helps reduce portfolio volatility:</p><ul><li>Asset class diversification (stocks, bonds, alternatives)</li><li>Geographic diversification (domestic and international)</li><li>Sector and industry diversification</li><li>Investment style diversification (growth vs. value)</li></ul><h2>Strategic Asset Allocation</h2><p>Your asset allocation should reflect your risk tolerance, time horizon, and financial goals. Regular rebalancing ensures you maintain your target allocation.</p>`,
    author_name: 'Michael Johnson',
    category_name: 'Risk & Insurance',
    category_id: 'demo-category-3',
    type_name: 'Insights & Education',
    reading_time_minutes: 7,
    published_at: '2025-01-08T00:00:00Z',
    is_featured: false,
    status: 'published',
    tags: ['risk management', 'diversification', 'asset allocation'],
    created_at: '2025-01-08T00:00:00Z',
    updated_at: '2025-01-08T00:00:00Z',
  },
};

// ---------------------------------------------------------------------------
// Loading & Error states
// ---------------------------------------------------------------------------

function ArticleLoadingState() {
  return (
    <div className="min-h-screen bg-gray-50/50">
      {/* Skeleton header */}
      <div className="bg-[rgb(49,54,83)] pt-16 pb-14">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="animate-pulse space-y-4">
            <div className="h-6 w-24 bg-white/10 rounded" />
            <div className="flex gap-2">
              <div className="h-6 w-28 bg-white/10 rounded-full" />
              <div className="h-6 w-24 bg-white/10 rounded-full" />
            </div>
            <div className="h-12 bg-white/10 rounded w-3/4" />
            <div className="h-8 bg-white/10 rounded w-1/2" />
            <div className="flex gap-4 pt-2">
              <div className="h-4 w-32 bg-white/10 rounded" />
              <div className="h-4 w-28 bg-white/10 rounded" />
              <div className="h-4 w-24 bg-white/10 rounded" />
            </div>
          </div>
        </div>
      </div>

      {/* Skeleton body */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="animate-pulse space-y-6">
          <div className="h-64 bg-gray-200 rounded-xl" />
          <div className="space-y-3">
            <div className="h-4 bg-gray-200 rounded w-full" />
            <div className="h-4 bg-gray-200 rounded w-5/6" />
            <div className="h-4 bg-gray-200 rounded w-4/6" />
          </div>
          <div className="h-8 bg-gray-200 rounded w-1/3 mt-8" />
          <div className="space-y-3">
            <div className="h-4 bg-gray-200 rounded w-full" />
            <div className="h-4 bg-gray-200 rounded w-5/6" />
            <div className="h-4 bg-gray-200 rounded w-3/4" />
          </div>
        </div>
      </div>
    </div>
  );
}

function ArticleErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div className="min-h-screen bg-gray-50/50 flex items-center justify-center">
      <div className="text-center max-w-md px-6">
        <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-red-50 flex items-center justify-center">
          <AlertCircle className="w-8 h-8 text-red-500" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-3">Article Not Found</h2>
        <p className="text-gray-600 mb-8">{message}</p>
        <div className="flex items-center justify-center gap-3">
          <Link to="/resources">
            <Button variant="outline">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Resources
            </Button>
          </Link>
          {onRetry && (
            <Button onClick={onRetry} variant="outline">
              <RefreshCw className="h-4 w-4 mr-2" />
              Retry
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Share menu
// ---------------------------------------------------------------------------

function ShareActions({ title, excerpt }: { title: string; excerpt?: string }) {
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
      'width=600,height=400'
    );
    setShowMenu(false);
  };

  const shareFacebook = () => {
    const url = encodeURIComponent(window.location.href);
    window.open(
      `https://www.facebook.com/sharer/sharer.php?u=${url}`,
      '_blank',
      'width=600,height=400'
    );
    setShowMenu(false);
  };

  const shareTwitter = () => {
    const url = encodeURIComponent(window.location.href);
    const text = encodeURIComponent(title);
    window.open(
      `https://twitter.com/intent/tweet?url=${url}&text=${text}`,
      '_blank',
      'width=600,height=400'
    );
    setShowMenu(false);
  };

  const shareWhatsApp = () => {
    const url = encodeURIComponent(window.location.href);
    const text = encodeURIComponent(`${title} — ${window.location.href}`);
    window.open(`https://wa.me/?text=${text}`, '_blank');
    setShowMenu(false);
  };

  const shareEmail = () => {
    const subj = encodeURIComponent(title);
    const body = encodeURIComponent(
      `${excerpt || title}\n\nRead more: ${window.location.href}`
    );
    window.location.href = `mailto:?subject=${subj}&body=${body}`;
    setShowMenu(false);
  };

  const handlePrint = () => {
    // Open a clean print window whose CSS mirrors BasePdfLayout exactly:
    //   - @page { margin: 0 } — all spacing is controlled by body padding (same as BasePdfLayout)
    //   - position:fixed footer sits at bottom: 5mm, height: 18mm (matching --footer-height)
    //   - body padding-bottom reserves the footer zone so content never flows beneath it
    const printWin = window.open('', '_blank', 'width=900,height=700');
    if (!printWin) {
      toast.error('Pop-up blocked — please allow pop-ups to print.');
      return;
    }

    // Grab the article content from the current page's DOM
    const bodyEl = document.querySelector('.article-body');
    const excerptEl = document.querySelector('.mb-10.pl-6.border-l-\\[3px\\]');

    const articleContentHtml = bodyEl?.innerHTML || '';
    const excerptHtml = excerptEl
      ? `<div style="margin-bottom:6mm;padding-left:4mm;border-left:3px solid #6d28d9;"><p style="font-size:10.5px;color:#4b5563;line-height:1.6;font-style:italic;">${excerptEl.querySelector('p')?.textContent || ''}</p></div>`
      : '';

    // Build the meta line
    const metaParts: string[] = [];
    const authorEl = document.querySelector('header .flex.flex-wrap.items-center.gap-x-5');
    if (authorEl) {
      const spans = authorEl.querySelectorAll('span');
      spans.forEach(s => {
        const text = s.textContent?.trim();
        if (text) metaParts.push(text);
      });
    }
    const metaHtml = metaParts.length > 0
      ? `<div style="font-size:9px;color:#6b7280;margin-bottom:4mm;">${metaParts.join('  |  ')}</div>`
      : '';

    const issueDate = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });

    const fullHtml = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>${title}</title>
<style>
  /*
   * @page margins provide safe zones on every printed page.
   *
   *   top:    14mm  → content never starts flush at the physical top edge
   *   sides:  10mm  → consistent left/right gutter on every page
   *   bottom: 8mm   → small physical margin; the tfoot element reserves
   *                    the actual footer zone within the content area
   *
   * The footer repeats via <tfoot> — browsers natively repeat thead/tfoot
   * on every page when a table spans multiple pages. This is far more
   * reliable than position:fixed which Chrome often renders at the TOP.
   */
  @page {
    size: A4;
    margin: 14mm 10mm 8mm 10mm;
  }

  :root {
    --nw-purple: #6d28d9;
    --text: #111827;
    --muted: #6b7280;
    --border: #e5e7eb;
    --soft: #f9fafb;
  }

  * { box-sizing: border-box; }

  html, body {
    margin: 0;
    padding: 0;
    height: 100%;
    font-family: "Inter", "Segoe UI", Arial, sans-serif;
    color: var(--text);
    background: white;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  /* ── Table-based print layout ──────────────────────────────────────────
     The outer table spans the full content area. Browsers repeat <tfoot>
     at the bottom of every printed page automatically.
     height:100% ensures the table stretches to fill the last page,
     keeping the tfoot pinned to the bottom even when content is short.
  ──────────────────────────────────────────────────────────────────────── */
  .print-table { width: 100%; height: 100%; border-collapse: collapse; }
  .print-table td { padding: 0; border: none; vertical-align: top; }
  .print-table tfoot td { vertical-align: bottom; }

  /* ── Footer (inside tfoot) ─────────────────────────────────────────── */
  .print-footer {
    height: 18mm;
    border-top: 1px solid var(--border);
    padding: 3mm 0 0 0;
    font-size: 8px;
    color: var(--muted);
    line-height: 1.35;
    display: flex;
    gap: 5mm;
    align-items: flex-start;
  }
  .print-footer .fp { font-weight: 700; white-space: nowrap; width: 20mm; color: #374151; }
  .print-footer .ft { flex: 1; }

  /* ── Top masthead ── */
  .top-masthead {
    height: 15mm;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10mm;
    border-bottom: 1px solid var(--border);
    margin-bottom: 5mm;
    font-size: 9.2px;
  }
  .masthead-left { font-weight: 700; text-transform: uppercase; letter-spacing: 0.2px; color: #374151; }
  .masthead-right { color: var(--muted); text-align: right; line-height: 1.25; }
  .masthead-right strong { color: #374151; font-weight: 700; }

  /* ── First-page header ── */
  .page-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 10mm;
    margin-bottom: 6mm;
  }
  .brand-block { display: flex; flex-direction: column; gap: 2mm; min-width: 65mm; }
  .logo { font-size: 20px; font-weight: 800; letter-spacing: -0.35px; line-height: 1; color: var(--text); }
  .logo .wealth { color: var(--nw-purple); }
  .brand-sub { font-size: 10.5px; color: var(--muted); line-height: 1.25; }
  .doc-block { text-align: right; flex: 1; }
  .doc-title { font-size: 18px; font-weight: 800; margin: 0; letter-spacing: -0.2px; line-height: 1.2; }
  .doc-meta {
    display: inline-grid;
    grid-template-columns: auto auto;
    gap: 0.8mm 6mm;
    justify-content: end;
    align-items: baseline;
    margin-top: 2mm;
    padding-top: 2mm;
    border-top: 1px solid var(--border);
    font-size: 9.2px;
    color: var(--muted);
  }
  .doc-meta .mk { font-weight: 600; color: #4b5563; }
  hr.divider { border: none; border-top: 2px solid #6b7280; margin: 4mm 0 5mm 0; }

  /* ── Article body typography ── */
  .article-print-body { font-size: 10px; line-height: 1.65; color: var(--text); }
  .article-print-body h2 {
    font-size: 13px !important; font-weight: 800 !important;
    margin: 6mm 0 2mm !important; padding-bottom: 1mm;
    border-bottom: 1px solid var(--border); color: var(--text);
    page-break-after: avoid; break-after: avoid;
  }
  .article-print-body h3 {
    font-size: 11.5px !important; font-weight: 700 !important;
    margin: 5mm 0 1.5mm !important; color: var(--text);
    page-break-after: avoid; break-after: avoid;
  }
  .article-print-body h4 {
    font-size: 10.5px !important; font-weight: 600 !important;
    margin: 4mm 0 1mm !important; color: var(--text);
    page-break-after: avoid; break-after: avoid;
  }
  .article-print-body p {
    font-size: 10px !important; line-height: 1.65 !important;
    margin-bottom: 2.5mm !important; margin-top: 0 !important;
    orphans: 3; widows: 3;
  }
  .article-print-body ul, .article-print-body ol { margin: 2mm 0 2mm 5mm; padding-left: 3mm; font-size: 10px; line-height: 1.6; list-style-position: outside; }
  .article-print-body ul { list-style-type: disc; }
  .article-print-body ol { list-style-type: decimal; }
  .article-print-body li { margin-bottom: 1mm; orphans: 2; widows: 2; }
  .article-print-body blockquote {
    margin: 4mm 0; padding: 3mm 4mm;
    border-left: 3px solid #8b5cf6; background: #f5f3ff;
    font-style: italic; font-size: 10px; color: #3730a3;
    border-radius: 0 4px 4px 0;
    page-break-inside: avoid; break-inside: avoid;
  }
  .article-print-body strong { font-weight: 700; color: var(--text); }
  .article-print-body a { color: var(--nw-purple); text-decoration: none; }
  .article-print-body table { width: 100%; border-collapse: collapse; font-size: 9px; margin: 3mm 0; page-break-inside: avoid; break-inside: avoid; }
  .article-print-body th, .article-print-body td { border: 1px solid var(--border); padding: 2mm 3mm; }
  .article-print-body th { background: var(--soft); font-weight: 700; text-align: left; }
  .article-print-body span[style] { /* preserve inline colours from editor */ }

  /* ── Disclaimer ── */
  .disclaimer {
    margin-top: 8mm;
    padding: 4mm;
    background: var(--soft);
    border: 1px solid var(--border);
    border-radius: 4px;
    font-size: 8px;
    color: var(--muted);
    line-height: 1.5;
    page-break-inside: avoid; break-inside: avoid;
  }
  .disclaimer strong { color: #374151; }
</style>
</head><body>

  <table class="print-table">
    <tfoot><tr><td>
      <div class="print-footer">
        <div class="fp">Navigate Wealth</div>
        <div class="ft">
          Wealthfront (Pty) Ltd, trading as Navigate Wealth, is an Authorised Financial Services Provider &ndash; FSP 54606.
          Registration Number: 2024/071953/07. Located at Route 21 Corporate Park, 25 Sovereign Drive, Milestone Place A, Centurion, 0178.
          For inquiries, please contact us at Tel: (012) 667 2505.
        </div>
      </div>
    </td></tr></tfoot>
    <tbody><tr><td>

  <div class="top-masthead">
    <div class="masthead-left">ARTICLE</div>
    <div class="masthead-right">
      <strong>Wealthfront (Pty) Ltd</strong> t/a Navigate Wealth &nbsp;|&nbsp; <strong>FSP 54606</strong><br/>
      Email: info@navigatewealth.co
    </div>
  </div>

  <div class="page-header">
    <div class="brand-block">
      <div class="logo">Navigate <span class="wealth">Wealth</span></div>
      <div class="brand-sub">Independent Financial Advisory Services</div>
    </div>
    <div class="doc-block">
      <div class="doc-title">${title.replace(/</g,'&lt;').replace(/>/g,'&gt;')}</div>
      <div class="doc-meta">
        <span class="mk">Issue date</span>
        <span>${issueDate}</span>
      </div>
    </div>
  </div>
  <hr class="divider" />

  ${metaHtml}
  ${excerptHtml}

  <div class="article-print-body">
    ${articleContentHtml}
  </div>

  <div class="disclaimer">
    <strong>Disclaimer:</strong> This article is for informational purposes only and does not constitute financial, tax,
    or legal advice. Please consult a qualified financial adviser before making any investment decisions.
    Navigate Wealth is an authorised Financial Services Provider.
  </div>

    </td></tr></tbody>
  </table>

</body></html>`;

    printWin.document.write(fullHtml);
    printWin.document.close();
    printWin.onload = () => {
      printWin.print();
    };
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
        <Button
          variant="outline"
          size="sm"
          onClick={handlePrint}
          className="gap-2 print:hidden"
        >
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
function enhanceArticleHtml(rawHtml: string): string {
  const container = document.createElement('div');
  container.innerHTML = rawHtml;

  // --- Drop cap on the first <p> with substantial text ---
  const paragraphs = container.querySelectorAll('p');
  for (const p of paragraphs) {
    const text = p.textContent?.trim() || '';
    if (text.length > 40 && !p.querySelector('img') && !p.closest('blockquote')) {
      p.classList.add('article-drop-cap');
      break;
    }
  }

  // --- Callout / key takeaway detection ---
  const calloutPrefixes = [
    { prefix: 'Key Takeaway:', className: 'article-callout article-callout-takeaway' },
    { prefix: 'Important:', className: 'article-callout article-callout-important' },
    { prefix: 'Note:', className: 'article-callout article-callout-note' },
    { prefix: 'Tip:', className: 'article-callout article-callout-tip' },
    { prefix: 'Risk Warning:', className: 'article-callout article-callout-warning' },
    { prefix: "Adviser's Note:", className: 'article-callout article-callout-note' },
  ];

  paragraphs.forEach((p) => {
    const text = p.textContent?.trim() || '';
    for (const { prefix, className } of calloutPrefixes) {
      if (text.startsWith(prefix)) {
        // Wrap in a callout div
        const wrapper = document.createElement('div');
        wrapper.className = className;
        wrapper.innerHTML = p.innerHTML;
        p.replaceWith(wrapper);
        break;
      }
    }
  });

  // --- Style blockquotes as pull quotes ---
  const blockquotes = container.querySelectorAll('blockquote');
  blockquotes.forEach((bq) => {
    bq.classList.add('article-pull-quote');
  });

  return container.innerHTML;
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function ArticleDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();

  // Refs for reading progress and table of contents
  const articleContentRef = useRef<HTMLDivElement>(null);

  // Fetch article
  const { article: apiArticle, isLoading, error, refetch } = useArticleBySlug(slug);

  // Fallback to demo
  const article: ArticleDisplay | null =
    apiArticle || (slug ? DEMO_ARTICLES[slug] ?? null : null);

  // Scroll to top on slug change
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [slug]);

  // ── SEO: document title + Open Graph / Twitter Card meta tags ──────────
  useEffect(() => {
    if (!article) return;

    const prevTitle = document.title;
    document.title = `${article.title} | Navigate Wealth`;

    const ogImage =
      article.hero_image_url ||
      article.featured_image_url ||
      article.feature_image_url ||
      article.featured_image ||
      article.thumbnail_image_url ||
      '';
    const description = article.excerpt || article.subtitle || '';
    const url = window.location.href;

    const metaTags: Record<string, string> = {
      'og:title': article.title,
      'og:description': description,
      'og:type': 'article',
      'og:url': url,
      'og:site_name': 'Navigate Wealth',
      'twitter:card': ogImage ? 'summary_large_image' : 'summary',
      'twitter:title': article.title,
      'twitter:description': description,
      'description': description,
    };
    if (ogImage) {
      metaTags['og:image'] = ogImage;
      metaTags['twitter:image'] = ogImage;
    }
    if (article.author_name) {
      metaTags['article:author'] = article.author_name;
    }
    if (article.published_at) {
      metaTags['article:published_time'] = article.published_at;
    }

    const createdEls: HTMLMetaElement[] = [];
    for (const [key, value] of Object.entries(metaTags)) {
      const attr = key.startsWith('og:') || key.startsWith('article:') ? 'property' : 'name';
      let el = document.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
      if (!el) {
        el = document.createElement('meta');
        el.setAttribute(attr, key);
        document.head.appendChild(el);
        createdEls.push(el);
      }
      el.setAttribute('content', value);
    }

    // JSON-LD structured data
    const jsonLd = document.createElement('script');
    jsonLd.type = 'application/ld+json';
    jsonLd.textContent = JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: article.title,
      description,
      ...(ogImage && { image: ogImage }),
      author: { '@type': 'Person', name: article.author_name || 'Navigate Wealth Editorial Team' },
      publisher: { '@type': 'Organization', name: 'Navigate Wealth' },
      ...(article.published_at && { datePublished: article.published_at }),
      ...(article.updated_at && { dateModified: article.updated_at }),
      url,
    });
    document.head.appendChild(jsonLd);

    return () => {
      document.title = prevTitle;
      createdEls.forEach(el => el.remove());
      jsonLd.remove();
    };
  }, [article]);

  // Loading
  if (isLoading) return <ArticleLoadingState />;

  // Error
  if (!article && (error || !slug)) {
    return (
      <ArticleErrorState
        message={error || "The article you're looking for doesn't exist."}
        onRetry={refetch}
      />
    );
  }

  if (!article) return null;

  // Resolve field name variants
  const articleBody = (article.body || article.content || '') as string;
  const articleCategoryName =
    article.category_name || article.category?.name || '';
  const articleTypeName =
    article.type_name || article.type?.name || '';
  const articleImage =
    article.hero_image_url ||
    article.featured_image_url ||
    article.feature_image_url ||
    article.featured_image ||
    article.thumbnail_image_url ||
    '';
  const publishedDate = article.published_at
    ? formatDate(article.published_at)
    : '';
  const updatedDate = article.updated_at
    ? formatDate(article.updated_at)
    : '';
  const readingTime =
    article.reading_time_minutes || estimateReadingTime(articleBody);
  const authorName =
    article.author_name || 'Navigate Wealth Editorial Team';

  // Sanitise and enhance HTML
  const sanitisedHtml = DOMPurify.sanitize(articleBody);
  const enhancedHtml = enhanceArticleHtml(sanitisedHtml);

  return (
    <div className="contents">
      {/* Reading progress bar */}
      <ReadingProgressBar contentRef={articleContentRef} />

      {/* Back to top */}
      <BackToTop />

      <article className="min-h-screen bg-gray-50/50 print:bg-white">
        {/* ━━━ Header ━━━ */}
        <header className="bg-[rgb(49,54,83)] pt-16 pb-14 print:bg-white print:text-black print:pb-6 print:pt-4">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            {/* Back link */}
            <Link to="/resources" className="print:hidden">
              <Button
                variant="ghost"
                className="text-white/80 hover:text-white hover:bg-white/10 mb-8 -ml-2 text-sm"
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Resources
              </Button>
            </Link>

            {/* Badges */}
            <div className="flex flex-wrap items-center gap-2.5 mb-5">
              {articleCategoryName && (
                <Badge className="bg-purple-500/90 text-white hover:bg-purple-600 border-0 px-3 py-1 text-xs font-medium print:bg-gray-200 print:text-gray-800">
                  {articleCategoryName}
                </Badge>
              )}
              {articleTypeName && (
                <Badge
                  variant="outline"
                  className="text-white/80 border-white/25 text-xs print:text-gray-600 print:border-gray-300"
                >
                  {articleTypeName}
                </Badge>
              )}
              {article.is_featured && (
                <Badge className="bg-amber-500 text-white border-0 text-xs">
                  Featured
                </Badge>
              )}
            </div>

            {/* Title */}
            <h1 className="text-3xl sm:text-4xl md:text-[2.75rem] font-extrabold text-white leading-tight mb-4 tracking-tight print:text-gray-900">
              {article.title}
            </h1>

            {/* Subtitle */}
            {article.subtitle && (
              <p className="text-lg sm:text-xl text-white/80 mb-8 max-w-2xl leading-relaxed print:text-gray-600">
                {article.subtitle}
              </p>
            )}

            {/* Meta row */}
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-white/70 print:text-gray-500">
              <div className="flex items-center gap-2">
                <User className="h-4 w-4" />
                <span>{authorName}</span>
              </div>
              {publishedDate && (
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  <span>{publishedDate}</span>
                </div>
              )}
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                <span>{readingTime} min read</span>
              </div>
              {article.view_count !== undefined && article.view_count > 0 && (
                <div className="flex items-center gap-2">
                  <Eye className="h-4 w-4" />
                  <span>
                    {article.view_count.toLocaleString()} view
                    {article.view_count !== 1 ? 's' : ''}
                  </span>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* ━━━ Featured Image ━━━ */}
        {articleImage && (
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 -mt-8 print:hidden">
            <div className="aspect-[21/9] rounded-2xl overflow-hidden shadow-2xl ring-1 ring-black/5">
              <img
                src={articleImage}
                alt={article.title}
                className="w-full h-full object-cover"
              />
            </div>
          </div>
        )}

        {/* ━━━ Content Area ━━━ */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 print:py-4 print:px-0">
          <div className="flex gap-12">
            {/* Table of Contents — sticky sidebar on xl screens */}
            <TableOfContents contentRef={articleContentRef} />

            {/* Main column */}
            <div className="flex-1 min-w-0 max-w-4xl">
              {/* Actions bar */}
              <div className="flex items-center justify-between pb-6 mb-8 border-b border-gray-200 print:hidden">
                <ShareActions
                  title={article.title}
                  excerpt={article.excerpt}
                />

                {/* Updated timestamp */}
                {updatedDate && updatedDate !== publishedDate && (
                  <span className="text-xs text-gray-400">
                    Updated {updatedDate}
                  </span>
                )}
              </div>

              {/* Excerpt / Lead-in */}
              {article.excerpt && (
                <div className="mb-10 pl-6 border-l-[3px] border-purple-500 print:border-gray-300">
                  <p className="text-lg sm:text-xl text-gray-600 leading-relaxed italic">
                    {article.excerpt}
                  </p>
                </div>
              )}

              {/* ━━━ Article Body ━━━ */}
              <div
                ref={articleContentRef}
                className={cn(
                  // Base prose styling — magazine quality
                  'article-body',
                  'prose prose-lg max-w-none',
                  // Headings
                  'prose-headings:font-bold prose-headings:text-gray-900 prose-headings:tracking-tight',
                  'prose-h2:text-2xl sm:prose-h2:text-3xl prose-h2:mt-14 prose-h2:mb-5 prose-h2:pb-3 prose-h2:border-b prose-h2:border-gray-100',
                  'prose-h3:text-xl sm:prose-h3:text-2xl prose-h3:mt-10 prose-h3:mb-4',
                  // Paragraphs
                  'prose-p:text-gray-700 prose-p:leading-[1.85] prose-p:mb-5 prose-p:text-[16.5px]',
                  // Links
                  'prose-a:text-purple-600 prose-a:font-medium prose-a:no-underline hover:prose-a:underline prose-a:transition-colors',
                  // Strong
                  'prose-strong:text-gray-900 prose-strong:font-semibold',
                  // Lists
                  'prose-ul:my-6 prose-ol:my-6',
                  'prose-li:text-gray-700 prose-li:my-2 prose-li:leading-relaxed',
                  // Images
                  'prose-img:rounded-xl prose-img:shadow-lg prose-img:my-8',
                  // Code
                  'prose-code:text-purple-600 prose-code:bg-purple-50 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-sm prose-code:font-medium',
                  'prose-pre:bg-gray-900 prose-pre:text-gray-100 prose-pre:rounded-xl prose-pre:shadow-inner',
                  // Tables
                  'prose-table:border-collapse prose-table:rounded-lg prose-table:overflow-hidden',
                  'prose-th:bg-gray-50 prose-th:font-semibold prose-th:text-left prose-th:px-4 prose-th:py-3',
                  'prose-td:px-4 prose-td:py-3 prose-td:border-t prose-td:border-gray-100'
                )}
                dangerouslySetInnerHTML={{ __html: enhancedHtml }}
              />

              {/* Tags */}
              {article.tags && article.tags.length > 0 && (
                <div className="mt-12 pt-8 border-t border-gray-200 print:hidden">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-3">
                    Topics
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {article.tags.map((tag, index) => (
                      <Badge
                        key={index}
                        variant="outline"
                        className="text-sm px-3 py-1 text-gray-600 hover:bg-gray-50 transition-colors"
                      >
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Compliance Disclaimer */}
              <div className="mt-10 p-5 rounded-xl bg-gray-50 border border-gray-100 text-xs text-gray-500 leading-relaxed print:mt-6">
                <p>
                  <strong className="text-gray-600">Disclaimer:</strong> This
                  article is for informational purposes only and does not
                  constitute financial, tax, or legal advice. Please consult a
                  qualified financial adviser before making any investment
                  decisions. Navigate Wealth is an authorised
                  Financial Services Provider.
                </p>
              </div>

              {/* Author Card */}
              <AuthorCard name={authorName} />

              {/* Related Articles */}
              <RelatedArticles
                currentArticleId={article.id}
                categoryId={article.category_id}
              />

              {/* Bottom CTA */}
              <div className="mt-16 text-center print:hidden">
                <Link to="/resources">
                  <Button
                    size="lg"
                    className="bg-purple-600 hover:bg-purple-700 text-white shadow-lg shadow-purple-600/20 px-8"
                  >
                    <BookOpen className="mr-2 h-4 w-4" />
                    Explore More Insights
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </article>

      {/* ━━━ Custom CSS for magazine enhancements ━━━ */}
      <style>{`
        /* Drop cap */
        .article-drop-cap::first-letter {
          float: left;
          font-size: 3.75rem;
          font-weight: 700;
          line-height: 0.8;
          margin-right: 0.15em;
          margin-top: 0.1em;
          color: rgb(109, 40, 217); /* purple-700 */
          font-family: Georgia, 'Times New Roman', serif;
        }

        /* Pull quotes (enhanced blockquotes) */
        .article-body .article-pull-quote,
        .article-body blockquote {
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

        .article-body .article-pull-quote::before,
        .article-body blockquote::before {
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

        /* Callout boxes */
        .article-callout {
          margin: 2rem 0;
          padding: 1.25rem 1.5rem;
          border-radius: 0.75rem;
          font-style: normal;
          font-size: 0.9375rem;
          line-height: 1.7;
        }

        .article-callout-takeaway {
          background-color: rgb(240, 253, 244);
          border: 1px solid rgb(187, 247, 208);
          color: rgb(22, 101, 52);
        }
        .article-callout-takeaway::before {
          content: '💡 Key Takeaway';
          display: block;
          font-weight: 700;
          margin-bottom: 0.5rem;
          font-size: 0.8125rem;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .article-callout-important,
        .article-callout-warning {
          background-color: rgb(255, 251, 235);
          border: 1px solid rgb(253, 224, 71);
          color: rgb(113, 63, 18);
        }
        .article-callout-important::before {
          content: '⚠️ Important';
          display: block;
          font-weight: 700;
          margin-bottom: 0.5rem;
          font-size: 0.8125rem;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }
        .article-callout-warning::before {
          content: '⚠️ Risk Warning';
          display: block;
          font-weight: 700;
          margin-bottom: 0.5rem;
          font-size: 0.8125rem;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .article-callout-note {
          background-color: rgb(239, 246, 255);
          border: 1px solid rgb(191, 219, 254);
          color: rgb(30, 64, 175);
        }
        .article-callout-note::before {
          content: '📝 Note';
          display: block;
          font-weight: 700;
          margin-bottom: 0.5rem;
          font-size: 0.8125rem;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .article-callout-tip {
          background-color: rgb(245, 243, 255);
          border: 1px solid rgb(221, 214, 254);
          color: rgb(76, 29, 149);
        }
        .article-callout-tip::before {
          content: '✨ Tip';
          display: block;
          font-weight: 700;
          margin-bottom: 0.5rem;
          font-size: 0.8125rem;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        /* Print styles */
        @media print {
          .article-body {
            font-size: 11pt !important;
            line-height: 1.6 !important;
          }
          .article-body h2 {
            page-break-after: avoid;
            margin-top: 1.5rem !important;
          }
          .article-body blockquote,
          .article-callout {
            break-inside: avoid;
          }
          .article-drop-cap::first-letter {
            color: #000 !important;
          }
        }
      `}</style>
    </div>
  );
}