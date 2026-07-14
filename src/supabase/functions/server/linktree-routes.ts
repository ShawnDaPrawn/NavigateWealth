/**
 * Linktree Routes - CRUD for company link-in-bio links.
 *
 * KV key pattern:
 *   linktree:links     - JSON array of LinktreeLink[]
 *   linktree:settings  - JSON object of page-level settings
 *
 * Public GET/click endpoints do not require auth. All management endpoints
 * require admin auth in this router.
 */

import { Hono } from 'npm:hono';
import { normalizeNavigateWealthUrl } from '../../../utils/siteOrigin.ts';
import { requireAdmin } from './auth-mw.ts';
import * as kv from './kv_store.tsx';

const app = new Hono();

app.use('/links', requireAdmin);
app.use('/links/*', requireAdmin);
app.use('/reorder', requireAdmin);
app.use('/settings', requireAdmin);

interface LinktreeLink {
  id: string;
  title: string;
  url: string;
  icon?: string;
  description?: string;
  enabled: boolean;
  order: number;
  clicks: number;
  createdAt: string;
  updatedAt: string;
}

interface LinktreeSettings {
  title: string;
  bio: string;
  avatarUrl?: string;
  theme: 'navy' | 'gold' | 'light' | 'dark';
  showBranding: boolean;
  socialProfiles?: Record<string, string>;
}

const DEFAULT_SETTINGS: LinktreeSettings = {
  title: 'Navigate Wealth',
  bio: 'Independent Financial Advice | FSCA Regulated | FSP 54606',
  theme: 'navy',
  showBranding: true,
  socialProfiles: {},
};

const KV_LINKS = 'linktree:links';
const KV_SETTINGS = 'linktree:settings';

function generateId(): string {
  return `lnk_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeLink(link: LinktreeLink): LinktreeLink {
  return {
    ...link,
    url: normalizeNavigateWealthUrl(link.url),
  };
}

function normalizeSettings(settings: LinktreeSettings): LinktreeSettings {
  const socialProfiles: Record<string, string> = {};

  for (const [key, value] of Object.entries(settings.socialProfiles || {})) {
    if (typeof value === 'string' && value.trim()) {
      socialProfiles[key] = normalizeNavigateWealthUrl(value);
    }
  }

  return {
    ...settings,
    socialProfiles,
  };
}

async function getLinks(): Promise<LinktreeLink[]> {
  const raw = await kv.get(KV_LINKS);
  if (!raw) return [];

  try {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    return Array.isArray(parsed) ? parsed.map(normalizeLink) : [];
  } catch {
    return [];
  }
}

async function saveLinks(links: LinktreeLink[]): Promise<void> {
  await kv.set(KV_LINKS, links.map(normalizeLink));
}

async function getSettings(): Promise<LinktreeSettings> {
  const raw = await kv.get(KV_SETTINGS);
  if (!raw) return DEFAULT_SETTINGS;

  try {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    return normalizeSettings({ ...DEFAULT_SETTINGS, ...parsed });
  } catch {
    return DEFAULT_SETTINGS;
  }
}

async function saveSettings(settings: LinktreeSettings): Promise<void> {
  await kv.set(KV_SETTINGS, normalizeSettings(settings));
}

app.get('/public', async (c) => {
  try {
    const [links, settings] = await Promise.all([getLinks(), getSettings()]);
    const enabledLinks = links.filter((link) => link.enabled).sort((a, b) => a.order - b.order);
    return c.json({ success: true, data: { links: enabledLinks, settings } });
  } catch (error: unknown) {
    console.error('[linktree] Error fetching public data:', error);
    return c.json({ success: false, error: 'Failed to load links' }, 500);
  }
});

app.get('/links', async (c) => {
  try {
    const links = await getLinks();
    return c.json({ success: true, data: links.sort((a, b) => a.order - b.order) });
  } catch (error: unknown) {
    console.error('[linktree] Error fetching links:', error);
    return c.json({ success: false, error: 'Failed to load links' }, 500);
  }
});

app.post('/links', async (c) => {
  try {
    const body = await c.req.json();
    const { title, url, icon, description, enabled = true } = body;

    if (!title?.trim() || !url?.trim()) {
      return c.json({ success: false, error: 'Title and URL are required' }, 400);
    }

    const links = await getLinks();
    const maxOrder = links.reduce((max, link) => Math.max(max, link.order), -1);

    const newLink: LinktreeLink = normalizeLink({
      id: generateId(),
      title: title.trim(),
      url: url.trim(),
      icon: icon?.trim() || undefined,
      description: description?.trim() || undefined,
      enabled,
      order: maxOrder + 1,
      clicks: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    links.push(newLink);
    await saveLinks(links);

    return c.json({ success: true, data: newLink });
  } catch (error: unknown) {
    console.error('[linktree] Error creating link:', error);
    return c.json({ success: false, error: 'Failed to create link' }, 500);
  }
});

app.put('/links/:id', async (c) => {
  try {
    const { id } = c.req.param();
    const body = await c.req.json();
    const links = await getLinks();
    const index = links.findIndex((link) => link.id === id);

    if (index === -1) {
      return c.json({ success: false, error: 'Link not found' }, 404);
    }

    const updated: LinktreeLink = normalizeLink({
      ...links[index],
      ...body,
      id,
      updatedAt: new Date().toISOString(),
    });

    links[index] = updated;
    await saveLinks(links);

    return c.json({ success: true, data: updated });
  } catch (error: unknown) {
    console.error('[linktree] Error updating link:', error);
    return c.json({ success: false, error: 'Failed to update link' }, 500);
  }
});

app.delete('/links/:id', async (c) => {
  try {
    const { id } = c.req.param();
    const links = await getLinks();
    const filtered = links.filter((link) => link.id !== id);

    if (filtered.length === links.length) {
      return c.json({ success: false, error: 'Link not found' }, 404);
    }

    await saveLinks(filtered);
    return c.json({ success: true });
  } catch (error: unknown) {
    console.error('[linktree] Error deleting link:', error);
    return c.json({ success: false, error: 'Failed to delete link' }, 500);
  }
});

app.put('/reorder', async (c) => {
  try {
    const { orderedIds } = await c.req.json();
    if (!Array.isArray(orderedIds)) {
      return c.json({ success: false, error: 'orderedIds must be an array' }, 400);
    }

    const links = await getLinks();
    const reordered = orderedIds
      .map((id: string, index: number) => {
        const link = links.find((candidate) => candidate.id === id);
        if (!link) return null;
        return { ...link, order: index, updatedAt: new Date().toISOString() };
      })
      .filter(Boolean) as LinktreeLink[];

    const orderedSet = new Set(orderedIds);
    const remaining = links
      .filter((link) => !orderedSet.has(link.id))
      .map((link, index) => ({ ...link, order: reordered.length + index }));

    await saveLinks([...reordered, ...remaining]);
    return c.json({ success: true });
  } catch (error: unknown) {
    console.error('[linktree] Error reordering links:', error);
    return c.json({ success: false, error: 'Failed to reorder links' }, 500);
  }
});

app.get('/settings', async (c) => {
  try {
    const settings = await getSettings();
    return c.json({ success: true, data: settings });
  } catch (error: unknown) {
    console.error('[linktree] Error fetching settings:', error);
    return c.json({ success: false, error: 'Failed to load settings' }, 500);
  }
});

app.put('/settings', async (c) => {
  try {
    const body = await c.req.json();
    const current = await getSettings();
    const updated = normalizeSettings({ ...current, ...body });
    await saveSettings(updated);
    return c.json({ success: true, data: updated });
  } catch (error: unknown) {
    console.error('[linktree] Error updating settings:', error);
    return c.json({ success: false, error: 'Failed to update settings' }, 500);
  }
});

app.post('/click/:id', async (c) => {
  try {
    const { id } = c.req.param();
    const links = await getLinks();
    const index = links.findIndex((link) => link.id === id);
    if (index !== -1) {
      links[index].clicks += 1;
      await saveLinks(links);
    }
    return c.json({ success: true });
  } catch {
    return c.json({ success: true });
  }
});

export default app;
