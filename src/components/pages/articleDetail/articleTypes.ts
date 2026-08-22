/**
 * The shape an article takes once it reaches the page.
 *
 * Split out of `ArticleDetailPage.tsx` (1,486 lines), which held the page, its
 * loading and error states, the share menu, the fallback article set and every
 * helper in one file. Each was already a self-contained function; only its
 * address changed.
 */

export interface ArticleDisplay {
  id: string;
  slug?: string;
  title: string;
  subtitle?: string | null;
  excerpt?: string;
  body?: string;
  content?: string | null;
  seo_canonical_url?: string | null;
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
