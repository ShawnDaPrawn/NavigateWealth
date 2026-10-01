/**
 * Portfolio table — which agent is calling.
 *
 * `/integrations/portfolio-table` is called by outside agents on a schedule,
 * with no user session. Each agent has its own token (ROADMAP §9a), sent in
 * the `x-nw-portfolio-token` header. Its SHA-256 is looked up in
 * `public.portfolio_agent_tokens`, and the live row's name becomes the actor
 * on everything that agent writes (`agent:grok`). The name comes from the
 * token, never from the request body, so an agent cannot record its writes
 * under another agent's name, and revoking one agent leaves the others
 * working.
 *
 * This replaced one shared Vault secret checked by
 * `public.verify_portfolio_table_token`. The migration carried that secret's
 * hash over as the agent `shared`, so a bot configured with it keeps working.
 *
 * Fails closed: a database error reads as "no agent", so the gate falls
 * through to its other branches and an agent gets a 401, never a 500 and
 * never a pass.
 */
import { createModuleLogger } from './stderr-logger.ts';
import { getErrMsg } from './shared-logger-utils.ts';
import {
  findActiveAgentByToken,
  markAgentUsed,
} from './repositories/portfolio-agent-repository.ts';

const log = createModuleLogger('integrations-portfolio-table-auth');

/**
 * Longest header value worth hashing. Issued tokens are 48 characters and the
 * carried-over shared token 44; anything far longer is not a token.
 */
const MAX_TOKEN_LENGTH = 256;

/** The name of the live agent `candidate` belongs to, or null. */
export async function identifyPortfolioAgent(candidate: string): Promise<string | null> {
  const token = (candidate || '').trim();
  if (!token || token.length > MAX_TOKEN_LENGTH) return null;

  let agent;
  try {
    agent = await findActiveAgentByToken(token);
  } catch (error) {
    log.warn('Agent token lookup failed', { error: getErrMsg(error) });
    return null;
  }
  if (!agent) return null;

  try {
    await markAgentUsed(agent);
  } catch (error) {
    // Bookkeeping only: the token is valid, so the request goes ahead.
    log.warn('Could not record agent use', { agent: agent.name, error: getErrMsg(error) });
  }
  return agent.name;
}
