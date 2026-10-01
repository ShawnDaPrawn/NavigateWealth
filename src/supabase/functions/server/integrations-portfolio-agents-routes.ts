/**
 * Portfolio agent tokens — issue, list and revoke the token each outside agent
 * sends to `/integrations/portfolio-table`.
 *
 *   GET  /integrations/portfolio-agents               — every agent token, live and revoked
 *   POST /integrations/portfolio-agents               — issue a token for { name }
 *   POST /integrations/portfolio-agents/:name/revoke  — revoke that agent's live token
 *
 * SUPER ADMIN ONLY, ON ITS OWN ROUTER
 * ----------------------------------
 * A token admits its holder to every client's policy book for every provider,
 * and lets it write. Minting one is creating that credential, so it takes a
 * super admin. The routes sit on their own router, not under the portfolio
 * table's, because that router's gate admits agent tokens and the cron
 * credential: an agent that could reach these could mint itself more tokens or
 * revoke the others. Here, nothing but a super admin's session gets in.
 *
 * WHAT CROSSES THE WIRE
 * ---------------------
 * The token itself appears in exactly one response: the 201 that issues it,
 * marked `no-store`. Lists never carry a token or its hash. If the token is
 * lost, revoke the name and issue it a new one; the actor stays the same.
 */
import { Hono, type Context } from 'npm:hono';
import { requireSuperAdmin } from './auth-mw.ts';
import { asyncHandler } from './error.middleware.ts';
import { createModuleLogger } from './stderr-logger.ts';
import { validateBody, body } from './validate.ts';
import { PortfolioAgentIssueSchema } from './integrations-portfolio-table-validation.ts';
import {
  issueAgentToken,
  listAgents,
  revokeAgentToken,
} from './repositories/portfolio-agent-repository.ts';
import {
  PORTFOLIO_AGENT_NAME_PATTERN,
  normalisePortfolioAgentName,
} from '../../../shared/integrations/portfolio-table.ts';

const app = new Hono();
const log = createModuleLogger('integrations-portfolio-agents-routes');

app.use('*', requireSuperAdmin);

/** Who issued or revoked a token, for the row and the log. */
function adminActor(c: Context): string {
  const userId = c.get('userId') as string | undefined;
  return userId ? `admin:${userId}` : 'admin';
}

app.get(
  '/',
  asyncHandler(async (c) => {
    return c.json({ success: true, agents: await listAgents() });
  }),
);

app.post(
  '/',
  validateBody(PortfolioAgentIssueSchema),
  asyncHandler(async (c) => {
    const { name } = body(c, PortfolioAgentIssueSchema);
    const issuedBy = adminActor(c);
    const result = await issueAgentToken(name, issuedBy);
    if (result.status === 'exists') {
      return c.json(
        {
          error: `"${name}" already has a live token. Revoke it first, then issue a new one.`,
          code: 'AGENT_TOKEN_EXISTS',
        },
        409,
      );
    }
    log.info('Portfolio agent token issued', { agent: name, issuedBy });
    // The only response that ever carries a token: keep it out of every cache.
    c.header('Cache-Control', 'no-store');
    return c.json({ success: true, agent: result.agent, token: result.token }, 201);
  }),
);

app.post(
  '/:name/revoke',
  asyncHandler(async (c) => {
    const name = normalisePortfolioAgentName(c.req.param('name'));
    if (!PORTFOLIO_AGENT_NAME_PATTERN.test(name)) {
      return c.json({ error: 'Invalid agent name', code: 'VALIDATION_ERROR' }, 400);
    }
    const revokedBy = adminActor(c);
    const result = await revokeAgentToken(name, revokedBy);
    if (result.status === 'not_found') {
      return c.json({ error: `"${name}" has no live token`, code: 'AGENT_TOKEN_NOT_FOUND' }, 404);
    }
    log.info('Portfolio agent token revoked', { agent: name, revokedBy });
    return c.json({ success: true, agent: result.agent });
  }),
);

export default app;
