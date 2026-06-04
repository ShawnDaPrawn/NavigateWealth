import { Hono } from 'npm:hono';
import * as kv from './kv_store.tsx';
import { createModuleLogger } from './stderr-logger.ts';
import { authenticateUser, fnaErrorResponse } from './fna-auth.ts';
import { SaveSessionSchema } from './fna-validation.ts';
import { formatZodError } from './shared-validation-utils.ts';

const app = new Hono();
const log = createModuleLogger('estate-planning-fna-session-routes');

interface EstateDep {
  name?: string;
  age?: number;
  relationship?: string;
  specialNeeds?: boolean;
  [key: string]: unknown;
}
interface EstateAsset {
  type?: string;
  description?: string;
  owner?: string;
  ownershipPercentage?: number;
  estimatedValue?: number;
  location?: string;
  ownership?: string;
  [key: string]: unknown;
}
interface EstateLiability {
  type?: string;
  description?: string;
  creditor?: string;
  amountOwing?: number;
  [key: string]: unknown;
}
interface EstatePolicy {
  type?: string;
  category?: string;
  product_category?: string;
  productCategory?: string;
  provider?: string;
  name?: string;
  coverAmount?: number;
  currentValue?: number;
  beneficiaryDesignation?: string;
  policyNumber?: string;
  status?: string;
  [key: string]: unknown;
}
interface VersionedSession {
  version: number;
  status?: string;
  createdAt?: string;
  publishedAt?: string;
  [key: string]: unknown;
}

function determineAssetLiquidity(
  type: string,
  subType: string,
): 'liquid' | 'semi_liquid' | 'illiquid' {
  if (type === 'financial') {
    if (['bank_account', 'cash', 'money_market'].includes(subType)) return 'liquid';
    if (['unit_trust', 'shares'].includes(subType)) return 'liquid';
    if (subType === 'endowment') return 'semi_liquid';
  }
  if (type === 'property' || type === 'business') return 'illiquid';
  if (type === 'personal') return 'illiquid';
  return 'semi_liquid';
}

app.get('/', (c) => c.json({ service: 'estate-planning-fna', status: 'active' }));
app.get('', (c) => c.json({ service: 'estate-planning-fna', status: 'active' }));

app.get('/client/:clientId/auto-populate', async (c) => {
  try {
    log.info('📥 GET /estate-planning-fna/client/:clientId/auto-populate');
    const _user = await authenticateUser(c.req.header('Authorization'));

    const clientId = c.req.param('clientId');

    const { estateAutoPopulateFromResolver } = await import('./form-prefill-auto-populate.ts');
    const resolverInputs = await estateAutoPopulateFromResolver(clientId);
    const familyInfo = (resolverInputs.familyInfo ?? {}) as Record<string, unknown>;
    const dependants = (resolverInputs.dependants ?? []) as EstateDep[];
    const willInfo = resolverInputs.willInfo ?? {
      hasValidWill: 'unknown' as const,
      executorNominated: 'unknown' as const,
      guardianNominated: 'unknown' as const,
      specialBequests: [],
      willNeedsUpdate: false,
    };

    // Fetch assets
    const assetRecords = await kv.getByPrefix(`asset:${clientId}:`);
    const assets = (assetRecords || []).map((asset: EstateAsset) => {
      const assetType = asset.assetType || 'personal';
      const subType = asset.subType || 'other';

      return {
        id: asset.id || `asset-${Math.random()}`,
        type: assetType,
        subType: subType,
        description: asset.description || asset.name || 'Asset',
        currentValue: asset.value || asset.currentValue || 0,
        ownership: asset.ownership || 'sole',
        ownershipPercentage: asset.ownershipPercentage || 100,
        location: asset.location || 'south_africa',
        liquidity: determineAssetLiquidity(assetType, subType),
        includeInEstate: asset.ownership !== 'trust',
        // Property-specific
        purchasePrice: asset.purchasePrice || 0,
        unrealisedGain: asset.unrealisedGain || 0,
        bondedAmount: asset.bondAmount || asset.bondedAmount || 0,
        // Business-specific
        hasBuyAndSellAgreement: asset.hasBuyAndSellAgreement || false,
        buyAndSellFunded: asset.buyAndSellFunded || false,
        // Retirement-specific
        beneficiaryNominated: asset.beneficiaryNominated || false,
        beneficiaryDetails: asset.beneficiaryDetails || '',
      };
    });

    // Fetch liabilities
    const liabilityRecords = await kv.getByPrefix(`liability:${clientId}:`);
    const liabilities = (liabilityRecords || []).map((liability: EstateLiability) => ({
      id: liability.id || `liability-${Math.random()}`,
      type: liability.liabilityType || liability.type || 'other',
      description: liability.description || liability.name || 'Liability',
      outstandingBalance: liability.balance || liability.outstandingBalance || 0,
      securedAgainst: liability.securedAgainst || '',
      lifeCoverCeded: liability.lifeCoverCeded || false,
      creditorName: liability.creditorName || liability.institution || '',
    }));

    // Fetch life policies
    const policyRecords = await kv.getByPrefix(`policy:${clientId}:`);
    const lifePolicies = (policyRecords || [])
      .filter(
        (policy: EstatePolicy) =>
          policy.category === 'risk_planning' &&
          ['life_cover', 'group_life', 'funeral'].includes(policy.policyType),
      )
      .map((policy: EstatePolicy) => {
        const beneficiaryType = policy.beneficiaryType || 'estate';

        return {
          id: policy.id || `policy-${Math.random()}`,
          policyType: policy.policyType || 'life_cover',
          sumAssured: policy.coverAmount || policy.sumAssured || 0,
          ownership: policy.ownership || 'client',
          beneficiaryType: beneficiaryType,
          beneficiaries: policy.beneficiaries || [],
          cededTo: policy.cededTo || '',
          payableToEstate: beneficiaryType === 'estate',
        };
      });

    // Default assumptions
    const assumptions = {
      executorFeePercentage: 3.5,
      conveyancingFeesPerProperty: 50000,
      masterFeesEstimate: 5000,
      funeralCostsEstimate: 50000,
      estateDutyRate: 0.2,
      estateDutyAbatement: 3500000,
      spousalBequest: String(familyInfo.maritalStatus ?? '').startsWith('married'),
      cgtInclusionRate: 0.4,
    };

    // Check for offshore assets and trusts
    const hasOffshorAssets = assets.some((a: { location?: string }) => a.location === 'offshore');
    const hasTrusts = assets.some((a: { ownership?: string }) => a.ownership === 'trust');

    const inputs = {
      familyInfo,
      dependants,
      willInfo,
      assets,
      liabilities,
      lifePolicies,
      assumptions,
      hasOffshorAssets,
      hasTrusts,
      trustDetails: hasTrusts ? 'Trust structures exist - details to be confirmed' : '',
      planningNotes: '',
    };

    log.info('✅ Auto-populated Estate Planning inputs for client:', { clientId });

    return c.json({
      success: true,
      data: inputs,
    });
  } catch (error: unknown) {
    log.error('❌ Error auto-populating Estate Planning inputs:', error);
    return fnaErrorResponse(c, error);
  }
});

app.post('/save', async (c) => {
  try {
    log.info('POST /estate-planning-fna/save');
    const authUser = await authenticateUser(c.req.header('Authorization'), 'estate-planning-fna');

    const body = await c.req.json();

    // Validate input
    const parsed = SaveSessionSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ success: false, error: formatZodError(parsed.error) }, 400);
    }

    const { clientId, inputs, results, status, adviserNotes } = parsed.data;

    const sessions = await kv.getByPrefix(`estate-planning-fna:client:${clientId}:`);
    const version = (sessions?.length || 0) + 1;

    const sessionId = `${clientId}-v${version}`;
    const timestamp = new Date().toISOString();

    const session = {
      id: sessionId,
      clientId,
      adviserId: authUser.id,
      version,
      status: status || 'draft',
      inputs,
      results: results || null,
      adviserNotes: adviserNotes || '',
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    const key = `estate-planning-fna:client:${clientId}:${sessionId}`;
    await kv.set(key, session);

    log.info('✅ Estate Planning session saved:', { sessionId });

    return c.json({
      success: true,
      data: session,
    });
  } catch (error: unknown) {
    log.error('❌ Error saving Estate Planning session:', error);
    return fnaErrorResponse(c, error);
  }
});

app.get('/client/:clientId/sessions', async (c) => {
  try {
    log.info('📥 GET /estate-planning-fna/client/:clientId/sessions');
    await authenticateUser(c.req.header('Authorization'));

    const clientId = c.req.param('clientId');

    const sessions = await kv.getByPrefix(`estate-planning-fna:client:${clientId}:`);
    const sortedSessions = (sessions || []).sort(
      (a: VersionedSession, b: VersionedSession) => b.version - a.version,
    );

    log.info(`✅ Retrieved ${sortedSessions.length} Estate Planning sessions for client:`, {
      clientId,
    });

    return c.json({
      success: true,
      data: sortedSessions,
    });
  } catch (error: unknown) {
    log.error('❌ Error fetching Estate Planning sessions:', error);
    return fnaErrorResponse(c, error);
  }
});

app.get('/client/:clientId/latest-published', async (c) => {
  try {
    log.info('📥 GET /estate-planning-fna/client/:clientId/latest-published');
    const clientId = c.req.param('clientId');

    // Optional authentication - allow both authenticated clients and anon key access
    const authHeader = c.req.header('Authorization');
    if (authHeader) {
      try {
        const user = await authenticateUser(authHeader);
        // Check authorization: admins can access all data, regular users only their own
        const isAdmin =
          user.role === 'admin' ||
          user.role === 'super_admin' ||
          user.role === 'super-admin' ||
          user.id === 'admin';
        const isOwnData = user.id === clientId;

        if (!isAdmin && !isOwnData) {
          log.warn(
            `⚠️ User ${user.id} (role: ${user.role}) attempting to access Estate Planning FNA for client ${clientId}`,
          );
          return c.json({ error: 'Unauthorized access to client data' }, 403);
        }
      } catch (_authError) {
        // WORKAROUND: Auth bypass for backward compatibility with client portal
        // Problem: Client portal accesses published FNA data using the anon key without a user session.
        // Why chosen: Removing this would break client-facing FNA display until portal auth is refactored.
        // Proper fix: Require authentication on all FNA reads; update client portal to pass user session token.
        // Revisit: When client portal auth is unified (tracked in Tier B backlog).
        log.info(
          'Authentication failed, allowing unauthenticated access to published Estate Planning FNA',
        );
      }
    }

    const sessions = await kv.getByPrefix(`estate-planning-fna:client:${clientId}:`);

    const published = (sessions || [])
      .filter((s: VersionedSession) => s.status === 'published')
      .sort((a: VersionedSession, b: VersionedSession) => b.version - a.version);

    const latest = published[0] || null;

    log.info(
      latest
        ? `✅ Latest published Estate Planning session found: ${latest.id}`
        : '⚠️ No published Estate Planning FNA',
    );
    return c.json({ success: true, data: latest });
  } catch (error: unknown) {
    log.error('❌ Error fetching latest published Estate Planning FNA:', error);
    return fnaErrorResponse(c, error);
  }
});

app.get('/session/:sessionId', async (c) => {
  try {
    log.info('📥 GET /estate-planning-fna/session/:sessionId');
    await authenticateUser(c.req.header('Authorization'));

    const sessionId = c.req.param('sessionId');
    const clientId = sessionId.split('-v')[0];

    const key = `estate-planning-fna:client:${clientId}:${sessionId}`;
    const session = await kv.get(key);

    if (!session) {
      return c.json(
        {
          success: false,
          error: 'Estate Planning session not found',
        },
        404,
      );
    }

    log.info('✅ Estate Planning session retrieved:', { sessionId });

    return c.json({
      success: true,
      data: session,
    });
  } catch (error: unknown) {
    log.error('❌ Error fetching Estate Planning session:', error);
    return fnaErrorResponse(c, error);
  }
});

app.delete('/session/:sessionId', async (c) => {
  try {
    log.info('📥 DELETE /estate-planning-fna/session/:sessionId');
    await authenticateUser(c.req.header('Authorization'));

    const sessionId = c.req.param('sessionId');
    const clientId = sessionId.split('-v')[0];

    const key = `estate-planning-fna:client:${clientId}:${sessionId}`;
    await kv.del(key);

    log.info('✅ Estate Planning session deleted:', { sessionId });

    return c.json({
      success: true,
    });
  } catch (error: unknown) {
    log.error('❌ Error deleting Estate Planning session:', error);
    return fnaErrorResponse(c, error);
  }
});

export default app;
