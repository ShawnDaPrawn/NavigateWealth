/**
 * Linktree Routes — CRUD for company link-in-bio links
 *
 * KV key pattern:
 *   linktree:links     — JSON array of LinktreeLink[]
 *   linktree:settings  — JSON object of page-level settings (title, bio, theme)
 *
 * Public GET endpoint does NOT require auth (served to Instagram visitors).
 * All mutation endpoints require admin auth.
 *
 * @module server/linktree-routes
 */

import { Hono } from 'npm:hono';
import * as kv from './kv_store.tsx';

const app = new Hono();

// ============================================================================
// Types
// ============================================================================

interface LinktreeLink {
  id: string;
  title: string;
  url: string;
  icon?: string;       // Lucide icon slug
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
  socialProfiles?: Record<string, string>; // e.g. { instagram: 'https://...', linkedin: 'https://...' }
}

const DEFAULT_SETTINGS: LinktreeSettings = {
  title: 'Navigate Wealth',
  bio: 'Independent Financial Advice · FSCA Regulated · FSP 54606',
  theme: 'navy',
  showBranding: true,
  socialProfiles: {},
};

const KV_LINKS = 'linktree:links';
const KV_SETTINGS = 'linktree:settings';

// ============================================================================
// Helpers
// ============================================================================

function generateId(): string {
  return `lnk_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

async function getLinks(): Promise<LinktreeLink[]> {
  const raw = await kv.get(KV_LINKS);
  if (!raw) return [];
  try {
    // KV stores JSONB — value is already parsed by Supabase.
    // If it's somehow a string (legacy double-encode), parse it.
    if (typeof raw === 'string') return JSON.parse(raw);
    if (Array.isArray(raw)) return raw;
    return [];
  } catch {
    return [];
  }
}

async function saveLinks(links: LinktreeLink[]): Promise<void> {
  // KV column is JSONB — pass the object directly, do NOT JSON.stringify.
  await kv.set(KV_LINKS, links);
}

async function getSettings(): Promise<LinktreeSettings> {
  const raw = await kv.get(KV_SETTINGS);
  if (!raw) return DEFAULT_SETTINGS;
  try {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    return { ...DEFAULT_SETTINGS, ...parsed };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

async function saveSettings(settings: LinktreeSettings): Promise<void> {
  // KV column is JSONB — pass the object directly, do NOT JSON.stringify.
  await kv.set(KV_SETTINGS, settings);
}

// ============================================================================
// Public — GET links + settings (no auth)
// ============================================================================

app.get('/public', async (c) => {
  try {
    const [links, settings] = await Promise.all([getLinks(), getSettings()]);
    const enabledLinks = links
      .filter((l) => l.enabled)
      .sort((a, b) => a.order - b.order);
    return c.json({ success: true, data: { links: enabledLinks, settings } });
  } catch (error: unknown) {
    console.error('[linktree] Error fetching public data:', error);
    return c.json({ success: false, error: 'Failed to load links' }, 500);
  }
});

// ============================================================================
// Admin — GET all links (including disabled)
// ============================================================================

app.get('/links', async (c) => {
  try {
    const links = await getLinks();
    return c.json({ success: true, data: links.sort((a, b) => a.order - b.order) });
  } catch (error: unknown) {
    console.error('[linktree] Error fetching links:', error);
    return c.json({ success: false, error: 'Failed to load links' }, 500);
  }
});

// ============================================================================
// Admin — CREATE link
// ============================================================================

app.post('/links', async (c) => {
  try {
    const body = await c.req.json();
    const { title, url, icon, description, enabled = true } = body;

    if (!title?.trim() || !url?.trim()) {
      return c.json({ success: false, error: 'Title and URL are required' }, 400);
    }

    const links = await getLinks();
    const maxOrder = links.reduce((max, l) => Math.max(max, l.order), -1);

    const newLink: LinktreeLink = {
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
    };

    links.push(newLink);
    await saveLinks(links);

    return c.json({ success: true, data: newLink });
  } catch (error: unknown) {
    console.error('[linktree] Error creating link:', error);
    return c.json({ success: false, error: 'Failed to create link' }, 500);
  }
});

// ============================================================================
// Admin — UPDATE link
// ============================================================================

app.put('/links/:id', async (c) => {
  try {
    const { id } = c.req.param();
    const body = await c.req.json();
    const links = await getLinks();
    const index = links.findIndex((l) => l.id === id);

    if (index === -1) {
      return c.json({ success: false, error: 'Link not found' }, 404);
    }

    const updated: LinktreeLink = {
      ...links[index],
      ...body,
      id, // Immutable
      updatedAt: new Date().toISOString(),
    };

    links[index] = updated;
    await saveLinks(links);

    return c.json({ success: true, data: updated });
  } catch (error: unknown) {
    console.error('[linktree] Error updating link:', error);
    return c.json({ success: false, error: 'Failed to update link' }, 500);
  }
});

// ============================================================================
// Admin — DELETE link
// ============================================================================

app.delete('/links/:id', async (c) => {
  try {
    const { id } = c.req.param();
    const links = await getLinks();
    const filtered = links.filter((l) => l.id !== id);

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

// ============================================================================
// Admin — REORDER links
// ============================================================================

app.put('/reorder', async (c) => {
  try {
    const { orderedIds } = await c.req.json();
    if (!Array.isArray(orderedIds)) {
      return c.json({ success: false, error: 'orderedIds must be an array' }, 400);
    }

    const links = await getLinks();
    const reordered = orderedIds
      .map((id: string, index: number) => {
        const link = links.find((l) => l.id === id);
        if (!link) return null;
        return { ...link, order: index, updatedAt: new Date().toISOString() };
      })
      .filter(Boolean) as LinktreeLink[];

    // Append any links not in orderedIds
    const orderedSet = new Set(orderedIds);
    const remaining = links
      .filter((l) => !orderedSet.has(l.id))
      .map((l, i) => ({ ...l, order: reordered.length + i }));

    await saveLinks([...reordered, ...remaining]);
    return c.json({ success: true });
  } catch (error: unknown) {
    console.error('[linktree] Error reordering links:', error);
    return c.json({ success: false, error: 'Failed to reorder links' }, 500);
  }
});

// ============================================================================
// Admin — GET / UPDATE settings
// ============================================================================

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
    const updated = { ...current, ...body };
    await saveSettings(updated);
    return c.json({ success: true, data: updated });
  } catch (error: unknown) {
    console.error('[linktree] Error updating settings:', error);
    return c.json({ success: false, error: 'Failed to update settings' }, 500);
  }
});

// ============================================================================
// Public — Track click
// ============================================================================

app.post('/click/:id', async (c) => {
  try {
    const { id } = c.req.param();
    const links = await getLinks();
    const index = links.findIndex((l) => l.id === id);
    if (index !== -1) {
      links[index].clicks += 1;
      await saveLinks(links);
    }
    return c.json({ success: true });
  } catch {
    return c.json({ success: true }); // Fail silently for click tracking
  }
});

export default app;