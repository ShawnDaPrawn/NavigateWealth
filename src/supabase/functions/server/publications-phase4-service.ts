/**
 * Publications Phase 4 Service — Templates & Version History
 *
 * Business logic for content templates and article version tracking.
 * Templates are stored as `pub_template:{id}` in KV.
 * Versions are stored as `pub_version:{articleId}:{timestamp}` in KV.
 *
 * @module publications/phase4-service
 */

import * as kv from './kv_store.tsx';
import { createModuleLogger } from './stderr-logger.ts';

const log = createModuleLogger('publications-phase4');

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ContentTemplate {
  id: string;
  name: string;
  description: string;
  /** Pre-filled HTML body */
  body: string;
  /** Suggested category ID */
  category_id?: string;
  /** Suggested content type ID */
  type_id?: string;
  /** Template icon (emoji or lucide slug) */
  icon?: string;
  /** Tags for filtering templates */
  tags: string[];
  /** Whether this is a system-provided template */
  is_system: boolean;
  /** Display order */
  sort_order: number;
  /** Whether template is active */
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateTemplateInput {
  name: string;
  description: string;
  body: string;
  category_id?: string;
  type_id?: string;
  icon?: string;
  tags?: string[];
  is_system?: boolean;
  sort_order?: number;
}

export interface UpdateTemplateInput {
  name?: string;
  description?: string;
  body?: string;
  category_id?: string;
  type_id?: string;
  icon?: string;
  tags?: string[];
  sort_order?: number;
  is_active?: boolean;
}

export interface ArticleVersion {
  id: string;
  article_id: string;
  version_number: number;
  title: string;
  body: string;
  excerpt: string;
  /** Who made this change */
  edited_by: string;
  /** What changed — auto-detected summary */
  change_summary: string;
  /** Snapshot of full article data for restore */
  snapshot: Record<string, unknown>;
  created_at: string;
  /** Body character count at this version */
  char_count: number;
  /** Word count at this version */
  word_count: number;
}

// ---------------------------------------------------------------------------
// KV Key Helpers
// ---------------------------------------------------------------------------

const TEMPLATE_PREFIX = 'pub_template:';
const VERSION_PREFIX = 'pub_version:';

function templateKey(id: string): string {
  return `${TEMPLATE_PREFIX}${id}`;
}

function versionKey(articleId: string, timestamp: string): string {
  return `${VERSION_PREFIX}${articleId}:${timestamp}`;
}

function versionPrefix(articleId: string): string {
  return `${VERSION_PREFIX}${articleId}:`;
}

// ---------------------------------------------------------------------------
// Template Service
// ---------------------------------------------------------------------------

export const TemplateService = {
  async list(): Promise<ContentTemplate[]> {
    const templates = await kv.getByPrefix(TEMPLATE_PREFIX);
    return (templates as ContentTemplate[])
      .filter((t) => t.is_active !== false)
      .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
  },

  async listAll(): Promise<ContentTemplate[]> {
    const templates = await kv.getByPrefix(TEMPLATE_PREFIX);
    return (templates as ContentTemplate[])
      .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
  },

  async get(id: string): Promise<ContentTemplate | null> {
    const template = await kv.get(templateKey(id));
    return template as ContentTemplate | null;
  },

  async create(input: CreateTemplateInput): Promise<ContentTemplate> {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    const template: ContentTemplate = {
      id,
      name: input.name,
      description: input.description,
      body: input.body,
      category_id: input.category_id,
      type_id: input.type_id,
      icon: input.icon || '📄',
      tags: input.tags || [],
      is_system: input.is_system || false,
      sort_order: input.sort_order ?? 0,
      is_active: true,
      created_at: now,
      updated_at: now,
    };

    await kv.set(templateKey(id), template);
    log.info('Template created', { id, name: input.name });
    return template;
  },

  async update(id: string, input: UpdateTemplateInput): Promise<ContentTemplate | null> {
    const existing = await kv.get(templateKey(id)) as ContentTemplate | null;
    if (!existing) return null;

    const updated: ContentTemplate = {
      ...existing,
      ...input,
      id, // Preserve ID
      updated_at: new Date().toISOString(),
    };

    await kv.set(templateKey(id), updated);
    log.info('Template updated', { id });
    return updated;
  },

  async delete(id: string): Promise<boolean> {
    const existing = await kv.get(templateKey(id));
    if (!existing) return false;

    await kv.del(templateKey(id));
    log.info('Template deleted', { id });
    return true;
  },

  async seedDefaults(): Promise<ContentTemplate[]> {
    const existing = await kv.getByPrefix(TEMPLATE_PREFIX);
    if ((existing as ContentTemplate[]).length > 0) {
      log.info('Templates already seeded, skipping');
      return existing as ContentTemplate[];
    }

    const defaults: CreateTemplateInput[] = [
      {
        name: 'Market Commentary',
        description: 'Weekly or monthly market analysis with performance data and outlook',
        icon: '📈',
        tags: ['market', 'analysis', 'recurring'],
        is_system: true,
        sort_order: 1,
        body: `<h2>Market Overview</h2>
<p>This week/month, markets have [summary of key movements]. The JSE All Share Index [moved/declined/advanced] by [X]%, while global markets [summary].</p>

<h2>Key Developments</h2>
<ul>
<li><strong>Local:</strong> [Key SA market development]</li>
<li><strong>Global:</strong> [Key international development]</li>
<li><strong>Currencies:</strong> The rand [strengthened/weakened] against major currencies</li>
</ul>

<h2>Sector Performance</h2>
<p>[Analysis of top and bottom performing sectors]</p>

<h2>Outlook</h2>
<p>[Forward-looking commentary — remember to include appropriate disclaimers]</p>

<blockquote>Past performance is not indicative of future results. This commentary is for informational purposes only and does not constitute financial advice.</blockquote>`,
      },
      {
        name: 'Client Guide',
        description: 'Educational guide explaining a financial concept or product',
        icon: '📚',
        tags: ['education', 'guide', 'client-facing'],
        is_system: true,
        sort_order: 2,
        body: `<h2>What You Need to Know</h2>
<p>[Brief introduction to the topic and why it matters to clients]</p>

<h2>How It Works</h2>
<p>[Clear, jargon-free explanation of the concept]</p>

<h3>Key Benefits</h3>
<ul>
<li>[Benefit 1]</li>
<li>[Benefit 2]</li>
<li>[Benefit 3]</li>
</ul>

<h3>Important Considerations</h3>
<ul>
<li>[Consideration 1]</li>
<li>[Consideration 2]</li>
</ul>

<h2>What This Means for You</h2>
<p>[Practical implications and next steps]</p>

<h2>Frequently Asked Questions</h2>
<h3>Q: [Common question 1]</h3>
<p>[Answer]</p>

<h3>Q: [Common question 2]</h3>
<p>[Answer]</p>

<blockquote>This guide is for educational purposes only. Please consult your financial adviser for advice tailored to your individual circumstances.</blockquote>`,
      },
      {
        name: 'Compliance Update',
        description: 'Regulatory or compliance change notification for advisers',
        icon: '⚖️',
        tags: ['compliance', 'regulatory', 'advisers'],
        is_system: true,
        sort_order: 3,
        body: `<h2>Regulatory Update Summary</h2>
<p><strong>Effective Date:</strong> [Date]</p>
<p><strong>Regulator:</strong> [FSCA / SARB / National Treasury]</p>
<p><strong>Reference:</strong> [Gazette/Notice number]</p>

<h2>What Has Changed</h2>
<p>[Clear description of the regulatory change]</p>

<h2>Impact on Practice</h2>
<h3>Immediate Actions Required</h3>
<ul>
<li>[Action item 1]</li>
<li>[Action item 2]</li>
</ul>

<h3>Timeline</h3>
<ul>
<li><strong>[Date]:</strong> [Milestone]</li>
<li><strong>[Date]:</strong> [Milestone]</li>
</ul>

<h2>Resources</h2>
<p>[Links to full regulatory text, FSCA guidance, etc.]</p>`,
      },
      {
        name: 'Product Review',
        description: 'Detailed analysis of a financial product or fund',
        icon: '🔍',
        tags: ['product', 'review', 'analysis'],
        is_system: true,
        sort_order: 4,
        body: `<h2>Product Overview</h2>
<p><strong>Product Name:</strong> [Name]</p>
<p><strong>Provider:</strong> [Provider]</p>
<p><strong>Category:</strong> [Category]</p>

<h2>Key Features</h2>
<ul>
<li>[Feature 1]</li>
<li>[Feature 2]</li>
<li>[Feature 3]</li>
</ul>

<h2>Cost Structure</h2>
<p>[Fee breakdown and comparison to similar products]</p>

<h2>Performance Analysis</h2>
<p>[Performance data with appropriate time frames and benchmarks]</p>

<h2>Who Is This For?</h2>
<p>[Target client profile and suitability considerations]</p>

<h2>Risks to Consider</h2>
<ul>
<li>[Risk 1]</li>
<li>[Risk 2]</li>
</ul>

<h2>Our Assessment</h2>
<p>[Professional assessment and where it fits in a portfolio]</p>

<blockquote>Past performance is not indicative of future results. Product information is subject to change. Always verify current details with the provider.</blockquote>`,
      },
      {
        name: 'Blank Article',
        description: 'Start with a clean slate — no pre-filled content',
        icon: '📝',
        tags: ['blank', 'custom'],
        is_system: true,
        sort_order: 0,
        body: '<p></p>',
      },
    ];

    const created: ContentTemplate[] = [];
    for (const input of defaults) {
      const template = await TemplateService.create(input);
      created.push(template);
    }

    log.info(`Seeded ${created.length} default templates`);
    return created;
  },
};

// ---------------------------------------------------------------------------
// Version History Service
// ---------------------------------------------------------------------------

export const VersionService = {
  /**
   * Create a new version snapshot for an article.
   * Called automatically when an article is updated.
   */
  async createVersion(
    articleId: string,
    articleData: Record<string, unknown>,
    editedBy: string
  ): Promise<ArticleVersion> {
    const now = new Date().toISOString();
    const id = crypto.randomUUID();

    // Get existing versions to determine version number
    const existing = await kv.getByPrefix(versionPrefix(articleId));
    const versionNumber = (existing as ArticleVersion[]).length + 1;

    const body = (articleData.body as string) || '';
    const plainText = body.replace(/<[^>]+>/g, '');
    const wordCount = plainText.trim() ? plainText.trim().split(/\s+/).length : 0;

    // Auto-detect what changed
    let changeSummary = 'Article updated';
    if (versionNumber === 1) {
      changeSummary = 'Initial version';
    } else {
      const prevVersions = (existing as ArticleVersion[])
        .sort((a, b) => b.version_number - a.version_number);
      const prev = prevVersions[0];
      if (prev) {
        const changes: string[] = [];
        if (prev.title !== articleData.title) changes.push('title');
        if (prev.body !== body) changes.push('content');
        if (prev.excerpt !== articleData.excerpt) changes.push('excerpt');
        changeSummary = changes.length > 0
          ? `Updated ${changes.join(', ')}`
          : 'Minor changes';
      }
    }

    const version: ArticleVersion = {
      id,
      article_id: articleId,
      version_number: versionNumber,
      title: (articleData.title as string) || '',
      body,
      excerpt: (articleData.excerpt as string) || '',
      edited_by: editedBy,
      change_summary: changeSummary,
      snapshot: {
        title: articleData.title,
        subtitle: articleData.subtitle,
        slug: articleData.slug,
        excerpt: articleData.excerpt,
        body: articleData.body,
        category_id: articleData.category_id,
        type_id: articleData.type_id,
        status: articleData.status,
        is_featured: articleData.is_featured,
        hero_image_url: articleData.hero_image_url,
        thumbnail_image_url: articleData.thumbnail_image_url,
        author_name: articleData.author_name,
        reading_time_minutes: articleData.reading_time_minutes,
        seo_title: articleData.seo_title,
        seo_description: articleData.seo_description,
      },
      created_at: now,
      char_count: plainText.length,
      word_count: wordCount,
    };

    await kv.set(versionKey(articleId, now), version);
    log.info('Version created', { articleId, versionNumber });

    // Keep only last 50 versions to avoid KV bloat
    if ((existing as ArticleVersion[]).length >= 50) {
      const sorted = (existing as ArticleVersion[])
        .sort((a, b) => a.version_number - b.version_number);
      const toDelete = sorted.slice(0, sorted.length - 49);
      for (const old of toDelete) {
        await kv.del(versionKey(articleId, old.created_at));
      }
      log.info(`Pruned ${toDelete.length} old versions for article ${articleId}`);
    }

    return version;
  },

  /**
   * List all versions for an article, newest first.
   */
  async listVersions(articleId: string): Promise<ArticleVersion[]> {
    const versions = await kv.getByPrefix(versionPrefix(articleId));
    return (versions as ArticleVersion[])
      .sort((a, b) => b.version_number - a.version_number);
  },

  /**
   * Get a specific version.
   */
  async getVersion(articleId: string, versionId: string): Promise<ArticleVersion | null> {
    const versions = await kv.getByPrefix(versionPrefix(articleId));
    const found = (versions as ArticleVersion[]).find((v) => v.id === versionId);
    return found || null;
  },

  /**
   * Delete all versions for an article (used when article is permanently deleted).
   */
  async deleteAllVersions(articleId: string): Promise<number> {
    const versions = await kv.getByPrefix(versionPrefix(articleId));
    const keys = (versions as ArticleVersion[]).map((v) => versionKey(articleId, v.created_at));
    if (keys.length > 0) {
      await kv.mdel(keys);
    }
    log.info(`Deleted ${keys.length} versions for article ${articleId}`);
    return keys.length;
  },
};
