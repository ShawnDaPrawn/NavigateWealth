/**
 * The public newsletter surface the website reads.
 *
 * Two unauthenticated GETs, mounted at `/newsletter-site`, feeding the
 * Newsletters tab on /resources and the per-newsletter page at
 * /resources/newsletter/<slug>. Published articles are served the same way
 * (publications-articles-read-routes.ts): no auth middleware at all, because
 * a published newsletter is public by definition — it has already been
 * emailed to every subscriber.
 *
 * WHY ITS OWN FILE AND PREFIX
 * The studio router is admin-gated end to end. Keeping the public reads in a
 * separate router means no future middleware added there can accidentally
 * lock the website out, and no middleware added here can accidentally reach
 * the studio. Both paths are listed as intentionally public in
 * __tests__/route-auth-classification.ts.
 *
 * The payload is the `PublishedNewsletter` record, which is written by
 * newsletter-studio-publish.ts and deliberately holds none of the campaign's
 * delivery internals.
 */

import { Hono } from 'npm:hono';
import { asyncHandler } from './error.middleware.ts';
import { getPublishedNewsletter, listPublishedNewsletters } from './newsletter-studio-publish.ts';

const app = new Hono();

/** Every newsletter live on the website, newest issue first. */
app.get(
  '/newsletters',
  asyncHandler(async (c) => {
    const newsletters = await listPublishedNewsletters();
    return c.json({ success: true, newsletters });
  }),
);

/** One newsletter by slug, for its own page. */
app.get(
  '/newsletters/:slug',
  asyncHandler(async (c) => {
    const newsletter = await getPublishedNewsletter(c.req.param('slug')!);
    if (!newsletter) {
      return c.json({ success: false, error: 'Newsletter not found' }, 404);
    }
    return c.json({ success: true, newsletter });
  }),
);

export default app;
