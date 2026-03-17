/**
 * Auto Content Routes — Automated Article Generation Pipeline Management
 *
 * Thin route dispatcher for the auto-content service.
 * All business logic is in auto-content-service.ts.
 *
 * Routes:
 *   GET  /configs                — List all pipeline configs
 *   GET  /configs/:id            — Get single pipeline config
 *   PUT  /configs/:id            — Update pipeline config
 *   POST /configs/seed           — Seed default configs
 *   POST /trigger/:id            — Trigger a single pipeline
 *   POST /trigger-all            — Trigger all enabled pipelines
 *   POST /trigger-source/:sourceId — Trigger a single content source
 *   GET  /history/:id            — Get run history for a pipeline
 *   GET  /calendar-events        — List calendar events
 *   POST /calendar-events        — Add a calendar event
 *   PUT  /calendar-events/:id    — Update a calendar event
 *   DELETE /calendar-events/:id  — Delete a calendar event
 *   GET  /sources                — List content sources
 *   POST /sources                — Add a content source
 *   PUT  /sources/:id            — Update a content source
 *   DELETE /sources/:id          — Delete a content source
 *   POST /sources/discover-feeds — Discover feeds from a URL
 *
 * @module auto-content/routes
 */

import { Hono } from 'npm:hono';
import { createModuleLogger } from './stderr-logger.ts';
import { AutoContentService } from './auto-content-service.ts';
import type { PipelineId } from './auto-content-service.ts';

const app = new Hono();
const log = createModuleLogger('auto-content-routes');

const VALID_PIPELINE_IDS: PipelineId[] = [
  'market_commentary',
  'regulatory_monitor',
  'news_commentary',
  'calendar_content',
];

function isValidPipelineId(id: string): id is PipelineId {
  return VALID_PIPELINE_IDS.includes(id as PipelineId);
}

// Root handler
app.get('/', (c) => c.json({ service: 'auto-content', status: 'active' }));
app.get('', (c) => c.json({ service: 'auto-content', status: 'active' }));

// ---------------------------------------------------------------------------
// Pipeline Config Routes
// ---------------------------------------------------------------------------

app.get('/configs', async (c) => {
  try {
    const configs = await AutoContentService.seedAllConfigs();
    return c.json({ success: true, data: configs });
  } catch (error) {
    log.error('Error fetching configs', error);
    return c.json({ success: false, error: 'Failed to fetch pipeline configs' }, 500);
  }
});

app.get('/configs/:id', async (c) => {
  try {
    const id = c.req.param('id');
    if (!isValidPipelineId(id)) {
      return c.json({ success: false, error: `Invalid pipeline ID: ${id}` }, 400);
    }
    const config = await AutoContentService.getConfig(id);
    if (!config) {
      return c.json({ success: false, error: 'Config not found' }, 404);
    }
    return c.json({ success: true, data: config });
  } catch (error) {
    log.error('Error fetching config', error);
    return c.json({ success: false, error: 'Failed to fetch config' }, 500);
  }
});

app.put('/configs/:id', async (c) => {
  try {
    const id = c.req.param('id');
    if (!isValidPipelineId(id)) {
      return c.json({ success: false, error: `Invalid pipeline ID: ${id}` }, 400);
    }
    const body = await c.req.json();
    const updated = await AutoContentService.updateConfig(id, body);
    return c.json({ success: true, data: updated });
  } catch (error) {
    log.error('Error updating config', error);
    return c.json({ success: false, error: 'Failed to update config' }, 500);
  }
});

app.post('/configs/seed', async (c) => {
  try {
    const configs = await AutoContentService.seedAllConfigs();
    return c.json({ success: true, data: configs });
  } catch (error) {
    log.error('Error seeding configs', error);
    return c.json({ success: false, error: 'Failed to seed configs' }, 500);
  }
});

// ---------------------------------------------------------------------------
// Pipeline Trigger Routes
// ---------------------------------------------------------------------------

app.post('/trigger/:id', async (c) => {
  try {
    const id = c.req.param('id');
    if (!isValidPipelineId(id)) {
      return c.json({ success: false, error: `Invalid pipeline ID: ${id}` }, 400);
    }

    log.info(`Manual trigger for pipeline: ${id}`);
    const result = await AutoContentService.triggerPipeline(id);
    return c.json({ success: true, data: result });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Pipeline trigger failed';
    log.error(`Pipeline trigger failed: ${msg}`, error);
    return c.json({ success: false, error: msg }, 500);
  }
});

// ---------------------------------------------------------------------------
// Scheduled Auto-Processing — called by client-side poller
// ---------------------------------------------------------------------------

app.post('/process-due', async (c) => {
  try {
    log.info('Processing due pipelines (scheduled auto-run)');
    const result = await AutoContentService.processDuePipelines();
    return c.json({ success: true, data: result });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Process-due failed';
    log.error(`Process-due failed: ${msg}`, error);
    return c.json({ success: false, error: msg }, 500);
  }
});

app.post('/trigger-all', async (c) => {
  try {
    log.info('Manual trigger-all for enabled pipelines');
    const results = await AutoContentService.triggerAll();
    return c.json({ success: true, data: results });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Trigger-all failed';
    log.error(`Trigger-all failed: ${msg}`, error);
    return c.json({ success: false, error: msg }, 500);
  }
});

// Trigger a single content source — must be registered BEFORE /:id routes
app.post('/trigger-source/:sourceId', async (c) => {
  try {
    const sourceId = c.req.param('sourceId');
    log.info(`Manual trigger for source: ${sourceId}`);
    const result = await AutoContentService.triggerSource(sourceId);
    return c.json({ success: true, data: result });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Source trigger failed';
    log.error(`Source trigger failed: ${msg}`, error);
    const status = msg.includes('not found') ? 404 : 500;
    return c.json({ success: false, error: msg }, status);
  }
});

// ---------------------------------------------------------------------------
// Run History Routes
// ---------------------------------------------------------------------------

app.get('/history/:id', async (c) => {
  try {
    const id = c.req.param('id');
    if (!isValidPipelineId(id)) {
      return c.json({ success: false, error: `Invalid pipeline ID: ${id}` }, 400);
    }
    const limit = parseInt(c.req.query('limit') || '20', 10);
    const history = await AutoContentService.getRunHistory(id, limit);
    return c.json({ success: true, data: history });
  } catch (error) {
    log.error('Error fetching run history', error);
    return c.json({ success: false, error: 'Failed to fetch run history' }, 500);
  }
});

// ---------------------------------------------------------------------------
// Calendar Events Routes
// ---------------------------------------------------------------------------

app.get('/calendar-events', async (c) => {
  try {
    const events = await AutoContentService.getCalendarEvents();
    return c.json({ success: true, data: events });
  } catch (error) {
    log.error('Error fetching calendar events', error);
    return c.json({ success: false, error: 'Failed to fetch calendar events' }, 500);
  }
});

app.post('/calendar-events', async (c) => {
  try {
    const body = await c.req.json();
    if (!body.name || !body.month || !body.day || !body.articleTopic) {
      return c.json({
        success: false,
        error: 'name, month, day, and articleTopic are required',
      }, 400);
    }
    const event = await AutoContentService.addCalendarEvent(body);
    return c.json({ success: true, data: event });
  } catch (error) {
    log.error('Error adding calendar event', error);
    return c.json({ success: false, error: 'Failed to add calendar event' }, 500);
  }
});

app.put('/calendar-events/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const body = await c.req.json();
    const updated = await AutoContentService.updateCalendarEvent(id, body);
    if (!updated) {
      return c.json({ success: false, error: 'Calendar event not found' }, 404);
    }
    return c.json({ success: true, data: updated });
  } catch (error) {
    log.error('Error updating calendar event', error);
    return c.json({ success: false, error: 'Failed to update calendar event' }, 500);
  }
});

app.delete('/calendar-events/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const deleted = await AutoContentService.deleteCalendarEvent(id);
    if (!deleted) {
      return c.json({ success: false, error: 'Calendar event not found' }, 404);
    }
    return c.json({ success: true });
  } catch (error) {
    log.error('Error deleting calendar event', error);
    return c.json({ success: false, error: 'Failed to delete calendar event' }, 500);
  }
});

// ---------------------------------------------------------------------------
// Content Sources Routes
// ---------------------------------------------------------------------------

// Feed discovery — must be registered BEFORE /sources/:id to avoid path collision
app.post('/sources/discover-feeds', async (c) => {
  try {
    const { url } = await c.req.json();
    if (!url || typeof url !== 'string') {
      return c.json({ success: false, error: 'url is required' }, 400);
    }

    // Basic URL validation
    try { new URL(url); } catch {
      return c.json({ success: false, error: 'Invalid URL format' }, 400);
    }

    log.info('Feed discovery requested', { url });
    const feeds = await AutoContentService.discoverFeeds(url);
    return c.json({ success: true, data: feeds });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Feed discovery failed';
    log.error(`Feed discovery error: ${msg}`, error);
    return c.json({ success: false, error: msg }, 500);
  }
});

app.get('/sources', async (c) => {
  try {
    const sources = await AutoContentService.getContentSources();
    return c.json({ success: true, data: sources });
  } catch (error) {
    log.error('Error fetching content sources', error);
    return c.json({ success: false, error: 'Failed to fetch content sources' }, 500);
  }
});

app.post('/sources', async (c) => {
  try {
    const body = await c.req.json();
    if (!body.name || !body.url || !body.pipelines?.length) {
      return c.json({
        success: false,
        error: 'name, url, and pipelines are required',
      }, 400);
    }
    const source = await AutoContentService.addContentSource(body);
    return c.json({ success: true, data: source });
  } catch (error) {
    log.error('Error adding content source', error);
    return c.json({ success: false, error: 'Failed to add content source' }, 500);
  }
});

app.put('/sources/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const body = await c.req.json();
    const updated = await AutoContentService.updateContentSource(id, body);
    if (!updated) {
      return c.json({ success: false, error: 'Content source not found' }, 404);
    }
    return c.json({ success: true, data: updated });
  } catch (error) {
    log.error('Error updating content source', error);
    return c.json({ success: false, error: 'Failed to update content source' }, 500);
  }
});

app.delete('/sources/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const deleted = await AutoContentService.deleteContentSource(id);
    if (!deleted) {
      return c.json({ success: false, error: 'Content source not found' }, 404);
    }
    return c.json({ success: true });
  } catch (error) {
    log.error('Error deleting content source', error);
    return c.json({ success: false, error: 'Failed to delete content source' }, 500);
  }
});

export default app;