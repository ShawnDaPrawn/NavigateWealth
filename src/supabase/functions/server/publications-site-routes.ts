/**
 * publications-site-routes.ts — content templates, version history, the public
 * press surface, and team/careers (job listings) management (Phase 5c).
 * ============================================================================
 *
 * Extracted verbatim from publications-routes.tsx; mounted via
 * `publications.route('/', siteRoutes)`. Carries the TeamMember / JobListing
 * interfaces it owns. Behaviour-preserving; the publications route contract
 * suite + `deno check` guard the move.
 */
import { Hono } from 'npm:hono';
import * as kv from './kv_store.tsx';
import { createModuleLogger } from './stderr-logger.ts';
import { requireAuth } from './auth-mw.ts';
import { asyncHandler } from './error.middleware.ts';
import { TemplateService, VersionService } from './publications-phase4-service.ts';
import { type Article } from './publications-route-helpers.ts';

const log = createModuleLogger('publications-site-routes');

const siteRoutes = new Hono();

// ============================================================================
// CONTENT TEMPLATES ROUTES (Phase 4)
// ============================================================================

// Static paths must be registered before parameterised /:id routes (§14.2)
siteRoutes.post('/templates/seed', async (c) => {
  try {
    const templates = await TemplateService.seedDefaults();
    return c.json({ success: true, data: templates });
  } catch (error) {
    log.error('Error seeding templates', error);
    return c.json({ success: false, error: 'Failed to seed templates' }, 500);
  }
});

siteRoutes.get('/templates', async (c) => {
  try {
    const includeInactive = c.req.query('all') === 'true';
    const templates = includeInactive
      ? await TemplateService.listAll()
      : await TemplateService.list();
    return c.json({ success: true, data: templates });
  } catch (error) {
    log.error('Error fetching templates', error);
    return c.json({ success: false, error: 'Failed to fetch templates' }, 500);
  }
});

siteRoutes.post('/templates', async (c) => {
  try {
    const body = await c.req.json();
    if (!body.name || !body.description) {
      return c.json({ success: false, error: 'Name and description are required' }, 400);
    }
    const template = await TemplateService.create(body);
    return c.json({ success: true, data: template }, 201);
  } catch (error) {
    log.error('Error creating template', error);
    return c.json({ success: false, error: 'Failed to create template' }, 500);
  }
});

siteRoutes.get('/templates/:id', async (c) => {
  try {
    const id = c.req.param('id')!;
    const template = await TemplateService.get(id);
    if (!template) {
      return c.json({ success: false, error: 'Template not found' }, 404);
    }
    return c.json({ success: true, data: template });
  } catch (error) {
    log.error('Error fetching template', error);
    return c.json({ success: false, error: 'Failed to fetch template' }, 500);
  }
});

siteRoutes.put('/templates/:id', async (c) => {
  try {
    const id = c.req.param('id')!;
    const body = await c.req.json();
    const template = await TemplateService.update(id, body);
    if (!template) {
      return c.json({ success: false, error: 'Template not found' }, 404);
    }
    return c.json({ success: true, data: template });
  } catch (error) {
    log.error('Error updating template', error);
    return c.json({ success: false, error: 'Failed to update template' }, 500);
  }
});

siteRoutes.delete('/templates/:id', async (c) => {
  try {
    const id = c.req.param('id')!;
    const deleted = await TemplateService.delete(id);
    if (!deleted) {
      return c.json({ success: false, error: 'Template not found' }, 404);
    }
    return c.json({ success: true });
  } catch (error) {
    log.error('Error deleting template', error);
    return c.json({ success: false, error: 'Failed to delete template' }, 500);
  }
});

// ============================================================================
// VERSION HISTORY ROUTES (Phase 4)
// ============================================================================

siteRoutes.get('/versions/:articleId', async (c) => {
  try {
    const articleId = c.req.param('articleId')!;
    const versions = await VersionService.listVersions(articleId);
    return c.json({ success: true, data: versions });
  } catch (error) {
    log.error('Error fetching versions', error);
    return c.json({ success: false, error: 'Failed to fetch versions' }, 500);
  }
});

siteRoutes.post('/versions/:articleId', async (c) => {
  try {
    const articleId = c.req.param('articleId')!;
    const article = await kv.get(`article:${articleId}`);
    if (!article) {
      return c.json({ success: false, error: 'Article not found' }, 404);
    }
    const body = await c.req.json().catch(() => ({}));
    const editedBy = body.edited_by || 'system';
    const version = await VersionService.createVersion(articleId, article, editedBy);
    return c.json({ success: true, data: version }, 201);
  } catch (error) {
    log.error('Error creating version', error);
    return c.json({ success: false, error: 'Failed to create version' }, 500);
  }
});

siteRoutes.post('/versions/:articleId/:versionId/restore', async (c) => {
  try {
    const articleId = c.req.param('articleId')!;
    const versionId = c.req.param('versionId')!;

    const version = await VersionService.getVersion(articleId, versionId);
    if (!version) {
      return c.json({ success: false, error: 'Version not found' }, 404);
    }

    const existing = await kv.get(`article:${articleId}`);
    if (!existing) {
      return c.json({ success: false, error: 'Article not found' }, 404);
    }

    // Save current state as a new version before restoring
    await VersionService.createVersion(articleId, existing, 'system');

    // Restore from snapshot
    const restored: Article = {
      ...existing,
      ...version.snapshot,
      id: articleId,
      updated_at: new Date().toISOString(),
    };

    await kv.set(`article:${articleId}`, restored);

    return c.json({ success: true, data: restored });
  } catch (error) {
    log.error('Error restoring version', error);
    return c.json({ success: false, error: 'Failed to restore version' }, 500);
  }
});

// ============================================================================
// ADMIN PRESS CONFIG ENDPOINTS (require auth)
// ============================================================================

/**
 * GET /publications/press/config
 * Returns the current press page config (admin only).
 */
siteRoutes.get(
  '/press/config',
  requireAuth,
  asyncHandler(async (c) => {
    const config = await kv.get('config:press_stats');
    return c.json({
      success: true,
      data: {
        aum: (config as any)?.aum || 'R500 mil+',
        yearsInBusiness: (config as any)?.yearsInBusiness || '2+',
        combinedExperience: (config as any)?.combinedExperience || '55+',
      },
    });
  }),
);

/**
 * PUT /publications/press/config
 * Updates the config:press_stats KV entry (admin only).
 * Body: { aum?: string, yearsInBusiness?: string, combinedExperience?: string }
 */
siteRoutes.put(
  '/press/config',
  requireAuth,
  asyncHandler(async (c) => {
    const body = await c.req.json();
    const { aum, yearsInBusiness, combinedExperience } = body;

    // Fetch existing config to merge
    const existing = ((await kv.get('config:press_stats')) as Record<string, unknown>) || {};

    const updated = {
      ...existing,
      ...(aum !== undefined ? { aum: String(aum).trim() } : {}),
      ...(yearsInBusiness !== undefined ? { yearsInBusiness: String(yearsInBusiness).trim() } : {}),
      ...(combinedExperience !== undefined
        ? { combinedExperience: String(combinedExperience).trim() }
        : {}),
      updatedAt: new Date().toISOString(),
    };

    await kv.set('config:press_stats', updated);

    log.info('Press stats config updated', {
      aum: updated.aum,
      yearsInBusiness: updated.yearsInBusiness,
    });

    return c.json({ success: true, data: updated });
  }),
);

// ============================================================================
// PUBLIC PRESS PAGE ENDPOINTS (No auth required)
// ============================================================================

/**
 * GET /publications/press/stats
 * Public endpoint returning company stats for the Press page.
 * Active client count is derived from KV; other stats are config-driven.
 */
siteRoutes.get('/press/stats', async (c) => {
  try {
    const profiles = await kv.getByPrefix('user_profile:');
    // Count non-closed profiles
    const activeClients = profiles.filter((p: Record<string, unknown>) => {
      if (!p || typeof p !== 'object') return false;
      return p.accountStatus !== 'closed';
    }).length;

    // Config-based stats (update here as the business evolves)
    const pressConfig = await kv.get('config:press_stats');
    const config = (pressConfig as Record<string, unknown>) || {};

    return c.json({
      success: true,
      data: {
        aum: (config.aum as string) || 'R500 mil+',
        activeClients,
        activeClientsLabel:
          activeClients >= 1000
            ? `${Math.floor(activeClients / 1000)},${String(activeClients % 1000).padStart(3, '0')}+`
            : `${activeClients}+`,
        yearsInBusiness: (config.yearsInBusiness as string) || '2+',
        combinedExperience: (config.combinedExperience as string) || '55+',
      },
    });
  } catch (error) {
    log.error('Error fetching press stats', error);
    return c.json({
      success: true,
      data: {
        aum: 'R500 mil+',
        activeClients: 0,
        activeClientsLabel: '—',
        yearsInBusiness: '2+',
        combinedExperience: '55+',
      },
    });
  }
});

/**
 * GET /publications/press/articles
 * Public endpoint returning published articles tagged with a press_category.
 * Optional ?category= filter for tab filtering on the Press page.
 */
siteRoutes.get('/press/articles', async (c) => {
  try {
    const categoryFilter = c.req.query('category') || undefined;
    const articles = await kv.getByPrefix('article:');

    // Filter to published articles with a press_category set
    let pressArticles = articles.filter(
      (a: Article) => a.status === 'published' && a.press_category,
    );

    if (categoryFilter && categoryFilter !== 'all') {
      pressArticles = pressArticles.filter((a: Article) => a.press_category === categoryFilter);
    }

    // Sort by published_at descending
    pressArticles.sort((a: Article, b: Article) => {
      const aDate = a.published_at || a.created_at;
      const bDate = b.published_at || b.created_at;
      return new Date(bDate).getTime() - new Date(aDate).getTime();
    });

    // Return only public-safe fields
    const publicArticles = pressArticles.map((a: Article) => ({
      id: a.id,
      title: a.title,
      subtitle: a.subtitle,
      slug: a.slug,
      excerpt: a.excerpt,
      press_category: a.press_category,
      hero_image_url: a.hero_image_url,
      thumbnail_image_url: a.thumbnail_image_url,
      published_at: a.published_at,
      author_name: a.author_name,
      reading_time_minutes: a.reading_time_minutes,
    }));

    return c.json({ success: true, data: publicArticles });
  } catch (error) {
    log.error('Error fetching press articles', error);
    return c.json({ success: true, data: [] });
  }
});

// ============================================================================
// TEAM MEMBER ENDPOINTS
// ============================================================================

interface TeamMember {
  id: string;
  name: string;
  title: string;
  credentials: string;
  bio: string;
  specialties: string[];
  image: string;
  linkedinUrl?: string;
  email?: string;
  sortOrder: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * GET /publications/team — Public endpoint returning active team members
 */
siteRoutes.get('/team', async (c) => {
  try {
    const entries = await kv.getByPrefix('team_member:');
    const members = (entries as TeamMember[])
      .filter((m) => m && m.id && m.active !== false)
      .sort((a, b) => (a.sortOrder ?? 99) - (b.sortOrder ?? 99));

    return c.json({ success: true, data: members });
  } catch (error) {
    log.error('Error fetching team members', error);
    return c.json({ success: true, data: [] });
  }
});

/**
 * GET /publications/team/admin — Admin endpoint returning all team members (including inactive)
 */
siteRoutes.get(
  '/team/admin',
  requireAuth,
  asyncHandler(async (c) => {
    const entries = await kv.getByPrefix('team_member:');
    const members = (entries as TeamMember[])
      .filter((m) => m && m.id)
      .sort((a, b) => (a.sortOrder ?? 99) - (b.sortOrder ?? 99));

    return c.json({ success: true, data: members, total: members.length });
  }),
);

/**
 * POST /publications/team/admin — Create a new team member
 */
siteRoutes.post(
  '/team/admin',
  requireAuth,
  asyncHandler(async (c) => {
    const body = await c.req.json();
    const {
      name,
      title: role,
      credentials,
      bio,
      specialties,
      image,
      linkedinUrl,
      email: memberEmail,
      sortOrder,
    } = body;

    if (!name || typeof name !== 'string' || name.trim().length < 2) {
      return c.json({ error: 'Name is required (min 2 characters)' }, 400);
    }
    if (!role || typeof role !== 'string') {
      return c.json({ error: 'Title/role is required' }, 400);
    }

    const id = crypto.randomUUID();
    const timestamp = new Date().toISOString();

    const member: TeamMember = {
      id,
      name: name.trim(),
      title: role.trim(),
      credentials: credentials?.trim() || '',
      bio: bio?.trim() || '',
      specialties: Array.isArray(specialties) ? specialties : [],
      image: image?.trim() || '',
      linkedinUrl: linkedinUrl?.trim() || '',
      email: memberEmail?.trim() || '',
      sortOrder: typeof sortOrder === 'number' ? sortOrder : 99,
      active: true,
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    await kv.set(`team_member:${id}`, member);
    log.info('Team member created', { id, name: member.name });

    return c.json({ success: true, data: member });
  }),
);

/**
 * PUT /publications/team/admin/:id — Update a team member
 */
siteRoutes.put(
  '/team/admin/:id',
  requireAuth,
  asyncHandler(async (c) => {
    const { id } = c.req.param();
    const existing = (await kv.get(`team_member:${id}`)) as TeamMember | null;

    if (!existing) {
      return c.json({ error: 'Team member not found' }, 404);
    }

    const body = await c.req.json();
    const updated: TeamMember = {
      ...existing,
      name: body.name?.trim() ?? existing.name,
      title: body.title?.trim() ?? existing.title,
      credentials: body.credentials?.trim() ?? existing.credentials,
      bio: body.bio?.trim() ?? existing.bio,
      specialties: Array.isArray(body.specialties) ? body.specialties : existing.specialties,
      image: body.image?.trim() ?? existing.image,
      linkedinUrl: body.linkedinUrl?.trim() ?? existing.linkedinUrl,
      email: body.email?.trim() ?? existing.email,
      sortOrder: typeof body.sortOrder === 'number' ? body.sortOrder : existing.sortOrder,
      active: typeof body.active === 'boolean' ? body.active : existing.active,
      updatedAt: new Date().toISOString(),
    };

    await kv.set(`team_member:${id}`, updated);
    log.info('Team member updated', { id, name: updated.name });

    return c.json({ success: true, data: updated });
  }),
);

/**
 * DELETE /publications/team/admin/:id — Soft-delete a team member
 */
siteRoutes.delete(
  '/team/admin/:id',
  requireAuth,
  asyncHandler(async (c) => {
    const { id } = c.req.param();
    const existing = (await kv.get(`team_member:${id}`)) as TeamMember | null;

    if (!existing) {
      return c.json({ error: 'Team member not found' }, 404);
    }

    const updated = {
      ...existing,
      active: false,
      deletedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await kv.set(`team_member:${id}`, updated);
    log.info('Team member soft-deleted', { id, name: existing.name });

    return c.json({ success: true, message: `${existing.name} removed from team page` });
  }),
);

// ============================================================================
// CAREERS / JOB LISTING ENDPOINTS
// ============================================================================

interface JobListing {
  id: string;
  title: string;
  category: string;
  location: string;
  type: string;
  description: string;
  requirements: string[];
  benefits: string[];
  closingDate?: string;
  active: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

/**
 * GET /publications/careers — Public endpoint returning active job listings
 */
siteRoutes.get('/careers', async (c) => {
  try {
    const entries = await kv.getByPrefix('job_listing:');
    const listings = (entries as JobListing[])
      .filter((j) => j && j.id && j.active !== false)
      .sort((a, b) => (a.sortOrder ?? 99) - (b.sortOrder ?? 99));
    return c.json({ success: true, data: listings });
  } catch (error) {
    log.error('Error fetching job listings', error);
    return c.json({ success: true, data: [] });
  }
});

/**
 * GET /publications/careers/admin — Admin endpoint returning all job listings
 */
siteRoutes.get(
  '/careers/admin',
  requireAuth,
  asyncHandler(async (c) => {
    const entries = await kv.getByPrefix('job_listing:');
    const listings = (entries as JobListing[])
      .filter((j) => j && j.id)
      .sort((a, b) => (a.sortOrder ?? 99) - (b.sortOrder ?? 99));
    return c.json({ success: true, data: listings, total: listings.length });
  }),
);

/**
 * POST /publications/careers/admin — Create a new job listing
 */
siteRoutes.post(
  '/careers/admin',
  requireAuth,
  asyncHandler(async (c) => {
    const body = await c.req.json();
    const {
      title,
      category,
      location,
      type: jobType,
      description,
      requirements,
      benefits,
      closingDate,
      sortOrder,
    } = body;

    if (!title || typeof title !== 'string' || title.trim().length < 3) {
      return c.json({ error: 'Title is required (min 3 characters)' }, 400);
    }
    if (!category || typeof category !== 'string') {
      return c.json({ error: 'Category is required' }, 400);
    }

    const id = crypto.randomUUID();
    const timestamp = new Date().toISOString();

    const listing: JobListing = {
      id,
      title: title.trim(),
      category: category.trim(),
      location: location?.trim() || 'Pretoria, South Africa',
      type: jobType?.trim() || 'full-time',
      description: description?.trim() || '',
      requirements: Array.isArray(requirements) ? requirements : [],
      benefits: Array.isArray(benefits) ? benefits : [],
      closingDate: closingDate || '',
      active: true,
      sortOrder: typeof sortOrder === 'number' ? sortOrder : 99,
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    await kv.set(`job_listing:${id}`, listing);
    log.info('Job listing created', { id, title: listing.title });
    return c.json({ success: true, data: listing });
  }),
);

/**
 * PUT /publications/careers/admin/:id — Update a job listing
 */
siteRoutes.put(
  '/careers/admin/:id',
  requireAuth,
  asyncHandler(async (c) => {
    const { id } = c.req.param();
    const existing = (await kv.get(`job_listing:${id}`)) as JobListing | null;
    if (!existing) return c.json({ error: 'Job listing not found' }, 404);

    const body = await c.req.json();
    const updated: JobListing = {
      ...existing,
      title: body.title?.trim() ?? existing.title,
      category: body.category?.trim() ?? existing.category,
      location: body.location?.trim() ?? existing.location,
      type: body.type?.trim() ?? existing.type,
      description: body.description?.trim() ?? existing.description,
      requirements: Array.isArray(body.requirements) ? body.requirements : existing.requirements,
      benefits: Array.isArray(body.benefits) ? body.benefits : existing.benefits,
      closingDate: body.closingDate ?? existing.closingDate,
      active: typeof body.active === 'boolean' ? body.active : existing.active,
      sortOrder: typeof body.sortOrder === 'number' ? body.sortOrder : existing.sortOrder,
      updatedAt: new Date().toISOString(),
    };

    await kv.set(`job_listing:${id}`, updated);
    log.info('Job listing updated', { id, title: updated.title });
    return c.json({ success: true, data: updated });
  }),
);

/**
 * DELETE /publications/careers/admin/:id — Soft-delete a job listing
 */
siteRoutes.delete(
  '/careers/admin/:id',
  requireAuth,
  asyncHandler(async (c) => {
    const { id } = c.req.param();
    const existing = (await kv.get(`job_listing:${id}`)) as JobListing | null;
    if (!existing) return c.json({ error: 'Job listing not found' }, 404);

    const updated = {
      ...existing,
      active: false,
      deletedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await kv.set(`job_listing:${id}`, updated);
    log.info('Job listing soft-deleted', { id, title: existing.title });
    return c.json({ success: true, message: `"${existing.title}" removed from careers page` });
  }),
);

export default siteRoutes;
