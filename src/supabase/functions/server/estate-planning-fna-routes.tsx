/**
 * Estate Planning FNA Routes
 * Backend API endpoints for Estate Planning Financial Needs Analysis
 */

import { Hono } from 'npm:hono';
import { createClient } from 'jsr:@supabase/supabase-js@2.49.8';
import * as kv from './kv_store.tsx';
import { createModuleLogger } from "./stderr-logger.ts";
import { authenticateUser } from "./fna-auth.ts";
import { getErrMsg } from "./shared-logger-utils.ts";
import { SaveSessionSchema } from "./fna-validation.ts";
import { formatZodError } from "./shared-validation-utils.ts";

const estatePlanningRoutes = new Hono();
const log = createModuleLogger('estate-planning-fna-routes');

// Lazy Supabase client — must NOT be top-level to avoid deployment crashes in edge functions.
const getSupabase = () => createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

const LEGAL_DOCS_BUCKET = 'make-91ed8379-legal-docs';

// Lazy bucket initialization — called on first request, not at module load time.
let legalBucketInitialized = false;
async function ensureLegalDocsBucket() {
  if (legalBucketInitialized) return;
  try {
    const supabase = getSupabase();
    const { data: buckets } = await supabase.storage.listBuckets();
    const bucketExists = buckets?.some(bucket => bucket.name === LEGAL_DOCS_BUCKET);

    if (!bucketExists) {
      log.info(`Creating storage bucket: ${LEGAL_DOCS_BUCKET}`);
      const { error } = await supabase.storage.createBucket(LEGAL_DOCS_BUCKET, {
        public: false,
        fileSizeLimit: 52428800, // 50MB
        allowedMimeTypes: [
          'application/pdf',
          'image/jpeg',
          'image/png',
        ]
      });

      if (error) {
        if (error.message?.includes('already exists')) {
          log.info('Legal docs bucket already exists');
        } else {
          log.error('Error creating legal docs bucket:', error);
        }
      } else {
        log.info('Legal docs bucket created successfully');
      }
    }
    legalBucketInitialized = true;
  } catch (error) {
    const errorMessage = getErrMsg(error);
    if (errorMessage.includes('already exists')) {
      legalBucketInitialized = true;
    } else {
      log.warn('Error initializing legal docs bucket (non-critical):', { error });
    }
  }
}

// Root handlers
estatePlanningRoutes.get('/', (c) => c.json({ service: 'estate-planning-fna', status: 'active' }));
estatePlanningRoutes.get('', (c) => c.json({ service: 'estate-planning-fna', status: 'active' }));

/**
 * GET /estate-planning-fna/client/:clientId/auto-populate
 * Auto-populate Estate Planning inputs from client profile and existing data
 */
estatePlanningRoutes.get('/client/:clientId/auto-populate', async (c) => {
  try {
    log.info('📥 GET /estate-planning-fna/client/:clientId/auto-populate');
    const user = await authenticateUser(c.req.header('Authorization'));
    
    const clientId = c.req.param('clientId');
    
    // Fetch client profile - gracefully handle if not found
    const clientProfile = await kv.get(`client-profile:${clientId}`);
    
    let personalDetails: Record<string, unknown> = {};
    let household: Record<string, unknown> = {};
    
    if (clientProfile) {
      personalDetails = clientProfile.personalDetails || {};
      household = clientProfile.household || {};
    } else {
      log.warn('⚠️ Client profile not found, using defaults');
    }
    
    // Build family information
    const familyInfo = {
      fullName: `${personalDetails.firstName || ''} ${personalDetails.lastName || ''}`.trim() || 'Client Name',
      dateOfBirth: personalDetails.dateOfBirth || '',
      age: personalDetails.age || 0,
      maritalStatus: personalDetails.maritalStatus || 'single',
      spouseName: household.spouse?.name || '',
      spouseId: household.spouse?.id || '',
      spouseAge: household.spouse?.age || 0,
      citizenship: 'South Africa',
      taxResidency: 'South Africa',
    };
    
    // Build dependants list
    const dependants = (household.dependants || []).map((dep: EstateDep) => ({
      name: dep.name || '',
      age: dep.age || 0,
      relationship: dep.relationship || 'child',
      specialNeeds: dep.specialNeeds || false,
    }));
    
    // Build will information (default if not stored)
    const willInfo = {
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
      .filter((policy: EstatePolicy) => 
        policy.category === 'risk_planning' && 
        ['life_cover', 'group_life', 'funeral'].includes(policy.policyType)
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
      estateDutyRate: 0.20,
      estateDutyAbatement: 3500000,
      spousalBequest: familyInfo.maritalStatus.startsWith('married'),
      cgtInclusionRate: 0.40,
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
    return c.json({ success: false, error: getErrMsg(error) }, 500);
  }
});

/**
 * POST /estate-planning-fna/save
 * Save Estate Planning session
 */
estatePlanningRoutes.post('/save', async (c) => {
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
    return c.json({ success: false, error: getErrMsg(error) }, 500);
  }
});

/**
 * GET /estate-planning-fna/client/:clientId/sessions
 * Get all Estate Planning sessions for a client
 */
estatePlanningRoutes.get('/client/:clientId/sessions', async (c) => {
  try {
    log.info('📥 GET /estate-planning-fna/client/:clientId/sessions');
    await authenticateUser(c.req.header('Authorization'));
    
    const clientId = c.req.param('clientId');
    
    const sessions = await kv.getByPrefix(`estate-planning-fna:client:${clientId}:`);
    const sortedSessions = (sessions || []).sort((a: VersionedSession, b: VersionedSession) => b.version - a.version);
    
    log.info(`✅ Retrieved ${sortedSessions.length} Estate Planning sessions for client:`, { clientId });
    
    return c.json({
      success: true,
      data: sortedSessions,
    });
  } catch (error: unknown) {
    log.error('❌ Error fetching Estate Planning sessions:', error);
    return c.json({ success: false, error: getErrMsg(error) }, 500);
  }
});

/**
 * GET /estate-planning-fna/client/:clientId/latest-published
 * Get latest published Estate Planning session for a client
 */
estatePlanningRoutes.get('/client/:clientId/latest-published', async (c) => {
  try {
    log.info('📥 GET /estate-planning-fna/client/:clientId/latest-published');
    const clientId = c.req.param('clientId');
    
    // Optional authentication - allow both authenticated clients and anon key access
    const authHeader = c.req.header('Authorization');
    if (authHeader) {
      try {
        const user = await authenticateUser(authHeader);
        // Check authorization: admins can access all data, regular users only their own
        const isAdmin = user.role === 'admin' || user.role === 'super_admin' || user.role === 'super-admin' || user.id === 'admin';
        const isOwnData = user.id === clientId;
        
        if (!isAdmin && !isOwnData) {
          log.warn(`⚠️ User ${user.id} (role: ${user.role}) attempting to access Estate Planning FNA for client ${clientId}`);
          return c.json({ error: 'Unauthorized access to client data' }, 403);
        }
      } catch (authError) {
        // WORKAROUND: Auth bypass for backward compatibility with client portal
        // Problem: Client portal accesses published FNA data using the anon key without a user session.
        // Why chosen: Removing this would break client-facing FNA display until portal auth is refactored.
        // Proper fix: Require authentication on all FNA reads; update client portal to pass user session token.
        // Revisit: When client portal auth is unified (tracked in Tier B backlog).
        log.info('Authentication failed, allowing unauthenticated access to published Estate Planning FNA');
      }
    }
    
    const sessions = await kv.getByPrefix(`estate-planning-fna:client:${clientId}:`);
    
    const published = (sessions || [])
      .filter((s: VersionedSession) => s.status === 'published')
      .sort((a: VersionedSession, b: VersionedSession) => b.version - a.version);
    
    const latest = published[0] || null;
    
    log.info(latest ? `✅ Latest published Estate Planning session found: ${latest.id}` : '⚠️ No published Estate Planning FNA');
    return c.json({ success: true, data: latest });
  } catch (error: unknown) {
    log.error('❌ Error fetching latest published Estate Planning FNA:', error);
    return c.json({ success: false, error: getErrMsg(error) }, 500);
  }
});

/**
 * GET /estate-planning-fna/session/:sessionId
 * Get specific Estate Planning session by ID
 */
estatePlanningRoutes.get('/session/:sessionId', async (c) => {
  try {
    log.info('📥 GET /estate-planning-fna/session/:sessionId');
    await authenticateUser(c.req.header('Authorization'));
    
    const sessionId = c.req.param('sessionId');
    const clientId = sessionId.split('-v')[0];
    
    const key = `estate-planning-fna:client:${clientId}:${sessionId}`;
    const session = await kv.get(key);
    
    if (!session) {
      return c.json({
        success: false,
        error: 'Estate Planning session not found'
      }, 404);
    }
    
    log.info('✅ Estate Planning session retrieved:', { sessionId });
    
    return c.json({
      success: true,
      data: session,
    });
  } catch (error: unknown) {
    log.error('❌ Error fetching Estate Planning session:', error);
    return c.json({ success: false, error: getErrMsg(error) }, 500);
  }
});

/**
 * DELETE /estate-planning-fna/session/:sessionId
 * Delete an Estate Planning session
 */
estatePlanningRoutes.delete('/session/:sessionId', async (c) => {
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
    return c.json({ success: false, error: getErrMsg(error) }, 500);
  }
});

/**
 * Helper: Determine asset liquidity
 */
function determineAssetLiquidity(type: string, subType: string): 'liquid' | 'semi_liquid' | 'illiquid' {
  if (type === 'financial') {
    if (['bank_account', 'cash', 'money_market'].includes(subType)) return 'liquid';
    if (['unit_trust', 'shares'].includes(subType)) return 'liquid';
    if (subType === 'endowment') return 'semi_liquid';
  }
  if (type === 'property' || type === 'business') return 'illiquid';
  if (type === 'personal') return 'illiquid';
  return 'semi_liquid';
}

// ==================== WILL MANAGEMENT ROUTES ====================

/**
 * Parse a willId into its components.
 * Format: {clientId}-{type}-v{version}
 * Type is 'last_will' or 'living_will' (contains underscore, not hyphen).
 * Cannot use simple split('-') because 'living_will' would break.
 */
function parseWillId(willId: string): { clientId: string; type: string } {
  const lastWillMatch = willId.match(/^(.+)-(last_will)-v\d+$/);
  const livingWillMatch = willId.match(/^(.+)-(living_will)-v\d+$/);
  const match = lastWillMatch || livingWillMatch;
  if (!match) {
    throw new Error(`Invalid willId format: ${willId}`);
  }
  return { clientId: match[1], type: match[2] };
}

/**
 * GET /estate-planning-fna/wills/client/:clientId/profile-prefill
 * Fetch client profile data for will pre-fill.
 * Uses FNA auth (accepts anon key) so the wizard doesn't need a real user token.
 * Reads from both the personal_info and client_keys KV entries
 * (the Universal Key Manager) to provide comprehensive pre-fill data.
 */
estatePlanningRoutes.get('/wills/client/:clientId/profile-prefill', async (c) => {
  try {
    log.info('📥 GET /estate-planning-fna/wills/client/:clientId/profile-prefill');
    await authenticateUser(c.req.header('Authorization'));

    const clientId = c.req.param('clientId');

    // Read both KV entries in parallel for comprehensive pre-fill
    const [profile, clientKeys] = await Promise.all([
      kv.get(`user_profile:${clientId}:personal_info`),
      kv.get(`user_profile:${clientId}:client_keys`),
    ]);

    if (!profile && !clientKeys) {
      log.warn('⚠️ No client data found for will pre-fill', { clientId });
      return c.json({ success: true, profile: null, clientKeys: null });
    }

    log.info('✅ Client data retrieved for will pre-fill', {
      clientId,
      hasProfile: !!profile,
      hasClientKeys: !!clientKeys,
      profileKeys: profile ? Object.keys(profile) : [],
      clientKeyIds: clientKeys ? Object.keys(clientKeys) : [],
    });

    return c.json({ success: true, profile, clientKeys });
  } catch (error: unknown) {
    log.error('❌ Error fetching client profile for will pre-fill:', error);
    const message = getErrMsg(error);
    return c.json({ success: false, error: message }, message === 'Unauthorized' ? 401 : 500);
  }
});

/**
 * POST /estate-planning-fna/wills/create
 * Create a new will draft
 */
estatePlanningRoutes.post('/wills/create', async (c) => {
  try {
    log.info('📥 POST /estate-planning-fna/wills/create');
    const user = await authenticateUser(c.req.header('Authorization'));
    
    const body = await c.req.json();
    const { clientId, type, data } = body;
    
    if (!clientId || !type || !data) {
      return c.json({
        success: false,
        error: 'Missing required fields: clientId, type, data'
      }, 400);
    }
    
    // Validate type
    if (!['last_will', 'living_will'].includes(type)) {
      return c.json({
        success: false,
        error: 'Invalid will type. Must be "last_will" or "living_will"'
      }, 400);
    }
    
    // Get existing wills to determine version
    const existingWills = await kv.getByPrefix(`will:${clientId}:${type}:`);
    const version = (existingWills?.length || 0) + 1;
    
    const willId = `${clientId}-${type}-v${version}`;
    const timestamp = new Date().toISOString();
    
    const will = {
      id: willId,
      clientId,
      clientName: data?.personalDetails?.fullName || '',
      type,
      version,
      status: 'draft',
      data,
      createdBy: user?.email || user?.id || 'admin',
      createdAt: timestamp,
      updatedAt: timestamp,
      finalizedAt: null,
      finalizedBy: null,
    };
    
    const key = `will:${clientId}:${type}:${willId}`;
    await kv.set(key, will);
    
    log.info('✅ Will draft created:', { willId, type });
    
    return c.json({
      success: true,
      data: will,
    });
  } catch (error: unknown) {
    log.error('❌ Error creating will draft:', error);
    const message = getErrMsg(error);
    return c.json({ success: false, error: message }, message === 'Unauthorized' ? 401 : 500);
  }
});

/**
 * PUT /estate-planning-fna/wills/:willId
 * Update an existing will draft's data
 */
estatePlanningRoutes.put('/wills/:willId', async (c) => {
  try {
    log.info('📥 PUT /estate-planning-fna/wills/:willId');
    await authenticateUser(c.req.header('Authorization'));
    
    const willId = c.req.param('willId');
    const { clientId, type } = parseWillId(willId);
    
    const key = `will:${clientId}:${type}:${willId}`;
    const existingWill = await kv.get(key);
    
    if (!existingWill) {
      return c.json({
        success: false,
        error: 'Will not found'
      }, 404);
    }
    
    if (existingWill.status === 'finalized') {
      return c.json({
        success: false,
        error: 'Cannot update a finalized will'
      }, 400);
    }
    
    const body = await c.req.json();
    const { data } = body;
    
    if (!data) {
      return c.json({
        success: false,
        error: 'Missing required field: data'
      }, 400);
    }
    
    const updatedWill = {
      ...existingWill,
      data,
      updatedAt: new Date().toISOString(),
    };
    
    await kv.set(key, updatedWill);
    
    log.info('✅ Will draft updated:', { willId });
    
    return c.json({
      success: true,
      data: updatedWill,
    });
  } catch (error: unknown) {
    log.error('❌ Error updating will draft:', error);
    const message = getErrMsg(error);
    return c.json({ success: false, error: message }, message === 'Unauthorized' ? 401 : 500);
  }
});

/**
 * GET /estate-planning-fna/wills/client/:clientId
 * Get all wills for a client
 */
estatePlanningRoutes.get('/wills/client/:clientId', async (c) => {
  try {
    log.info('📥 GET /estate-planning-fna/wills/client/:clientId');
    await authenticateUser(c.req.header('Authorization'));
    
    const clientId = c.req.param('clientId');
    
    const wills = await kv.getByPrefix(`will:${clientId}:`);
    const sortedWills = (wills || []).sort((a: VersionedSession, b: VersionedSession) => 
      new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
    );
    
    log.info(`✅ Retrieved ${sortedWills.length} wills for client:`, { clientId });
    
    return c.json({
      success: true,
      data: sortedWills,
    });
  } catch (error: unknown) {
    log.error('❌ Error fetching wills:', error);
    const message = getErrMsg(error);
    return c.json({ success: false, error: message }, message === 'Unauthorized' ? 401 : 500);
  }
});

/**
 * GET /estate-planning-fna/wills/:willId
 * Get specific will by ID
 */
estatePlanningRoutes.get('/wills/:willId', async (c) => {
  try {
    log.info('📥 GET /estate-planning-fna/wills/:willId');
    await authenticateUser(c.req.header('Authorization'));
    
    const willId = c.req.param('willId');
    const { clientId, type } = parseWillId(willId);
    
    const key = `will:${clientId}:${type}:${willId}`;
    const will = await kv.get(key);
    
    if (!will) {
      return c.json({
        success: false,
        error: 'Will not found'
      }, 404);
    }
    
    log.info('✅ Will retrieved:', { willId });
    
    return c.json({
      success: true,
      data: will,
    });
  } catch (error: unknown) {
    log.error('❌ Error fetching will:', error);
    const message = getErrMsg(error);
    return c.json({ success: false, error: message }, message === 'Unauthorized' ? 401 : 500);
  }
});

/**
 * PUT /estate-planning-fna/wills/:willId/finalize
 * Finalize a will (when original signed document is collected)
 */
estatePlanningRoutes.put('/wills/:willId/finalize', async (c) => {
  try {
    log.info('📥 PUT /estate-planning-fna/wills/:willId/finalize');
    const user = await authenticateUser(c.req.header('Authorization'));
    
    const willId = c.req.param('willId');
    const { clientId, type } = parseWillId(willId);
    
    const key = `will:${clientId}:${type}:${willId}`;
    const will = await kv.get(key);
    
    if (!will) {
      return c.json({
        success: false,
        error: 'Will not found'
      }, 404);
    }
    
    if (will.status === 'finalized') {
      return c.json({
        success: false,
        error: 'Will is already finalized'
      }, 400);
    }

    if (will.status === 'signed') {
      return c.json({
        success: false,
        error: 'Will already has a signed copy attached'
      }, 400);
    }
    
    const updatedWill = {
      ...will,
      status: 'finalized',
      updatedAt: new Date().toISOString(),
      finalizedAt: new Date().toISOString(),
      finalizedBy: user.id,
    };
    
    await kv.set(key, updatedWill);
    
    log.info('✅ Will finalized:', { willId });
    
    return c.json({
      success: true,
      data: updatedWill,
    });
  } catch (error: unknown) {
    log.error('❌ Error finalizing will:', error);
    const message = getErrMsg(error);
    return c.json({ success: false, error: message }, message === 'Unauthorized' ? 401 : 500);
  }
});

/**
 * DELETE /estate-planning-fna/wills/:willId
 * Delete a draft will. Only draft wills can be deleted — published/finalized wills
 * are immutable for compliance retention.
 */
estatePlanningRoutes.delete('/wills/:willId', async (c) => {
  try {
    log.info('📥 DELETE /estate-planning-fna/wills/:willId');
    await authenticateUser(c.req.header('Authorization'));
    
    const willId = c.req.param('willId');
    const { clientId, type } = parseWillId(willId);
    
    const key = `will:${clientId}:${type}:${willId}`;
    const existingWill = await kv.get(key);

    if (!existingWill) {
      return c.json({
        success: false,
        error: 'Will not found',
      }, 404);
    }

    // Only draft wills may be deleted — published/finalized wills are retained for compliance
    if (existingWill.status !== 'draft') {
      return c.json({
        success: false,
        error: `Cannot delete a ${existingWill.status} will. Only draft wills can be discarded.`,
      }, 400);
    }

    await kv.del(key);
    
    log.info('✅ Draft will discarded:', { willId, type });
    
    return c.json({
      success: true,
    });
  } catch (error: unknown) {
    log.error('❌ Error deleting will:', error);
    const message = getErrMsg(error);
    return c.json({ success: false, error: message }, message === 'Unauthorized' ? 401 : 500);
  }
});

// ==================== SIGNED DOCUMENT ATTACHMENT ROUTES ====================

/**
 * POST /estate-planning-fna/wills/:willId/attach-signed
 * Upload a scanned signed copy of a will and update the will record.
 * Stores the file in Supabase Storage (legal-docs bucket).
 * Updates the will KV record with signedDocumentPath, signedDocumentFileName, signedAt.
 */
estatePlanningRoutes.post('/wills/:willId/attach-signed', async (c) => {
  try {
    log.info('POST /estate-planning-fna/wills/:willId/attach-signed');
    const user = await authenticateUser(c.req.header('Authorization'));
    await ensureLegalDocsBucket();

    const willId = c.req.param('willId');
    const { clientId, type } = parseWillId(willId);

    // Fetch the will record
    const kvKey = `will:${clientId}:${type}:${willId}`;
    const will = await kv.get(kvKey);

    if (!will) {
      return c.json({ success: false, error: 'Will not found' }, 404);
    }

    // Only finalized or published wills can have signed documents attached
    if (will.status === 'draft') {
      return c.json({
        success: false,
        error: 'Cannot attach a signed document to a draft will. Please finalize the will first.',
      }, 400);
    }

    // Parse multipart form
    const formData = await c.req.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return c.json({ success: false, error: 'No file provided' }, 400);
    }

    // Validate file type (PDF or image)
    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png'];
    if (!allowedTypes.includes(file.type)) {
      return c.json({
        success: false,
        error: 'Invalid file type. Only PDF, JPEG, and PNG files are allowed.',
      }, 400);
    }

    // Upload to Supabase Storage
    const fileExtension = file.name.split('.').pop() || 'pdf';
    const storagePath = `signed-wills/${clientId}/${willId}.${fileExtension}`;
    const fileBuffer = await file.arrayBuffer();

    const supabase = getSupabase();
    const { error: uploadError } = await supabase.storage
      .from(LEGAL_DOCS_BUCKET)
      .upload(storagePath, fileBuffer, {
        contentType: file.type,
        upsert: true, // Allow re-uploading (replacing previous signed copy)
      });

    if (uploadError) {
      log.error('Storage upload failed for signed will document:', uploadError);
      return c.json({
        success: false,
        error: `Failed to upload signed document: ${uploadError.message}`,
      }, 500);
    }

    // Update will KV record with signed document info
    const timestamp = new Date().toISOString();
    const updatedWill = {
      ...will,
      status: 'signed',
      signedDocumentPath: storagePath,
      signedDocumentFileName: file.name,
      signedDocumentFileSize: file.size,
      signedAt: timestamp,
      signedBy: user?.email || user?.id || 'admin',
      updatedAt: timestamp,
    };

    await kv.set(kvKey, updatedWill);

    log.info('Signed document attached to will:', { willId, storagePath });

    return c.json({
      success: true,
      data: updatedWill,
    });
  } catch (error: unknown) {
    log.error('Error attaching signed document to will:', error);
    const message = getErrMsg(error);
    return c.json({ success: false, error: message }, message === 'Unauthorized' ? 401 : 500);
  }
});

/**
 * GET /estate-planning-fna/wills/:willId/signed-document
 * Get a signed URL to download the signed document for a will.
 */
estatePlanningRoutes.get('/wills/:willId/signed-document', async (c) => {
  try {
    log.info('GET /estate-planning-fna/wills/:willId/signed-document');
    await authenticateUser(c.req.header('Authorization'));

    const willId = c.req.param('willId');
    const { clientId, type } = parseWillId(willId);

    const kvKey = `will:${clientId}:${type}:${willId}`;
    const will = await kv.get(kvKey);

    if (!will) {
      return c.json({ success: false, error: 'Will not found' }, 404);
    }

    if (!will.signedDocumentPath) {
      return c.json({ success: false, error: 'No signed document attached to this will' }, 404);
    }

    const supabase = getSupabase();
    const { data, error } = await supabase.storage
      .from(LEGAL_DOCS_BUCKET)
      .createSignedUrl(will.signedDocumentPath, 3600); // 1 hour expiry

    if (error || !data?.signedUrl) {
      log.error('Failed to create signed URL for will document:', error);
      return c.json({ success: false, error: 'Failed to generate download URL' }, 500);
    }

    return c.json({
      success: true,
      url: data.signedUrl,
      fileName: will.signedDocumentFileName || 'signed-will.pdf',
    });
  } catch (error: unknown) {
    log.error('Error fetching signed document URL:', error);
    const message = getErrMsg(error);
    return c.json({ success: false, error: message }, message === 'Unauthorized' ? 401 : 500);
  }
});

/**
 * DELETE /estate-planning-fna/wills/:willId/signed-document
 * Remove the signed document from a will (reverts status back to finalized).
 */
estatePlanningRoutes.delete('/wills/:willId/signed-document', async (c) => {
  try {
    log.info('DELETE /estate-planning-fna/wills/:willId/signed-document');
    await authenticateUser(c.req.header('Authorization'));

    const willId = c.req.param('willId');
    const { clientId, type } = parseWillId(willId);

    const kvKey = `will:${clientId}:${type}:${willId}`;
    const will = await kv.get(kvKey);

    if (!will) {
      return c.json({ success: false, error: 'Will not found' }, 404);
    }

    if (!will.signedDocumentPath) {
      return c.json({ success: false, error: 'No signed document to remove' }, 404);
    }

    // Remove file from storage
    const supabase = getSupabase();
    const { error: deleteError } = await supabase.storage
      .from(LEGAL_DOCS_BUCKET)
      .remove([will.signedDocumentPath]);

    if (deleteError) {
      log.warn('Failed to delete signed document from storage (non-critical):', deleteError);
    }

    // Revert will status and clear signed document fields
    const updatedWill = {
      ...will,
      status: 'finalized',
      signedDocumentPath: null,
      signedDocumentFileName: null,
      signedDocumentFileSize: null,
      signedAt: null,
      signedBy: null,
      updatedAt: new Date().toISOString(),
    };

    await kv.set(kvKey, updatedWill);

    log.info('Signed document removed from will:', { willId });

    return c.json({ success: true, data: updatedWill });
  } catch (error: unknown) {
    log.error('Error removing signed document:', error);
    const message = getErrMsg(error);
    return c.json({ success: false, error: message }, message === 'Unauthorized' ? 401 : 500);
  }
});

// ==================== ESTATE DOCUMENTS (AD-HOC LEGAL DOCS) ====================

/**
 * POST /estate-planning-fna/estate-docs/:clientId/upload
 * Upload an ad-hoc estate/legal document not tied to a specific will record.
 * E.g., trust deeds, power of attorney, codicils, pre-existing wills.
 */
estatePlanningRoutes.post('/estate-docs/:clientId/upload', async (c) => {
  try {
    log.info('POST /estate-planning-fna/estate-docs/:clientId/upload');
    const user = await authenticateUser(c.req.header('Authorization'));
    await ensureLegalDocsBucket();

    const clientId = c.req.param('clientId');
    const formData = await c.req.formData();

    const file = formData.get('file') as File | null;
    const title = formData.get('title') as string | null;
    const documentType = formData.get('documentType') as string | null;
    const notes = formData.get('notes') as string | null;
    const signingDate = formData.get('signingDate') as string | null;

    if (!file) {
      return c.json({ success: false, error: 'No file provided' }, 400);
    }

    if (!title || !documentType) {
      return c.json({ success: false, error: 'Title and document type are required' }, 400);
    }

    // Validate file type
    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png'];
    if (!allowedTypes.includes(file.type)) {
      return c.json({
        success: false,
        error: 'Invalid file type. Only PDF, JPEG, and PNG files are allowed.',
      }, 400);
    }

    // Generate unique document ID
    const docId = `edoc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const fileExtension = file.name.split('.').pop() || 'pdf';
    const storagePath = `estate-docs/${clientId}/${docId}.${fileExtension}`;
    const fileBuffer = await file.arrayBuffer();

    const supabase = getSupabase();
    const { error: uploadError } = await supabase.storage
      .from(LEGAL_DOCS_BUCKET)
      .upload(storagePath, fileBuffer, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      log.error('Storage upload failed for estate document:', uploadError);
      return c.json({
        success: false,
        error: `Failed to upload document: ${uploadError.message}`,
      }, 500);
    }

    const timestamp = new Date().toISOString();
    const document = {
      id: docId,
      clientId,
      title,
      documentType,
      notes: notes || '',
      signingDate: signingDate || null,
      fileName: file.name,
      fileSize: file.size,
      filePath: storagePath,
      mimeType: file.type,
      uploadedBy: user?.email || user?.id || 'admin',
      uploadedAt: timestamp,
      updatedAt: timestamp,
    };

    const kvKey = `estate_doc:${clientId}:${docId}`;
    await kv.set(kvKey, document);

    log.info('Estate document uploaded:', { docId, clientId, documentType });

    return c.json({ success: true, data: document });
  } catch (error: unknown) {
    log.error('Error uploading estate document:', error);
    const message = getErrMsg(error);
    return c.json({ success: false, error: message }, message === 'Unauthorized' ? 401 : 500);
  }
});

/**
 * GET /estate-planning-fna/estate-docs/:clientId
 * List all estate documents for a client.
 */
estatePlanningRoutes.get('/estate-docs/:clientId', async (c) => {
  try {
    log.info('GET /estate-planning-fna/estate-docs/:clientId');
    await authenticateUser(c.req.header('Authorization'));

    const clientId = c.req.param('clientId');
    const docs = await kv.getByPrefix(`estate_doc:${clientId}:`);

    const sorted = (docs || []).sort(
      (a: { uploadedAt?: string }, b: { uploadedAt?: string }) =>
        new Date(b.uploadedAt || 0).getTime() - new Date(a.uploadedAt || 0).getTime()
    );

    log.info(`Retrieved ${sorted.length} estate documents for client:`, { clientId });

    return c.json({ success: true, data: sorted });
  } catch (error: unknown) {
    log.error('Error fetching estate documents:', error);
    const message = getErrMsg(error);
    return c.json({ success: false, error: message }, message === 'Unauthorized' ? 401 : 500);
  }
});

/**
 * GET /estate-planning-fna/estate-docs/:clientId/:docId/download
 * Get a signed URL to download an estate document.
 */
estatePlanningRoutes.get('/estate-docs/:clientId/:docId/download', async (c) => {
  try {
    log.info('GET /estate-planning-fna/estate-docs/:clientId/:docId/download');
    await authenticateUser(c.req.header('Authorization'));

    const clientId = c.req.param('clientId');
    const docId = c.req.param('docId');

    const kvKey = `estate_doc:${clientId}:${docId}`;
    const doc = await kv.get(kvKey);

    if (!doc) {
      return c.json({ success: false, error: 'Estate document not found' }, 404);
    }

    const supabase = getSupabase();
    const { data, error } = await supabase.storage
      .from(LEGAL_DOCS_BUCKET)
      .createSignedUrl(doc.filePath, 3600);

    if (error || !data?.signedUrl) {
      log.error('Failed to create signed URL for estate document:', error);
      return c.json({ success: false, error: 'Failed to generate download URL' }, 500);
    }

    return c.json({
      success: true,
      url: data.signedUrl,
      fileName: doc.fileName,
    });
  } catch (error: unknown) {
    log.error('Error fetching estate document download URL:', error);
    const message = getErrMsg(error);
    return c.json({ success: false, error: message }, message === 'Unauthorized' ? 401 : 500);
  }
});

/**
 * DELETE /estate-planning-fna/estate-docs/:clientId/:docId
 * Delete an estate document (from storage and KV).
 */
estatePlanningRoutes.delete('/estate-docs/:clientId/:docId', async (c) => {
  try {
    log.info('DELETE /estate-planning-fna/estate-docs/:clientId/:docId');
    await authenticateUser(c.req.header('Authorization'));

    const clientId = c.req.param('clientId');
    const docId = c.req.param('docId');

    const kvKey = `estate_doc:${clientId}:${docId}`;
    const doc = await kv.get(kvKey);

    if (!doc) {
      return c.json({ success: false, error: 'Estate document not found' }, 404);
    }

    // Remove from storage
    const supabase = getSupabase();
    const { error: deleteError } = await supabase.storage
      .from(LEGAL_DOCS_BUCKET)
      .remove([doc.filePath]);

    if (deleteError) {
      log.warn('Failed to delete estate document from storage (non-critical):', deleteError);
    }

    // Remove from KV
    await kv.del(kvKey);

    log.info('Estate document deleted:', { docId, clientId });

    return c.json({ success: true });
  } catch (error: unknown) {
    log.error('Error deleting estate document:', error);
    const message = getErrMsg(error);
    return c.json({ success: false, error: message }, message === 'Unauthorized' ? 401 : 500);
  }
});

export default estatePlanningRoutes;

// Shared KV-derived types for estate planning
interface EstateDep { name?: string; age?: number; relationship?: string; specialNeeds?: boolean; [key: string]: unknown }
interface EstateAsset { type?: string; description?: string; owner?: string; ownershipPercentage?: number; estimatedValue?: number; location?: string; ownership?: string; [key: string]: unknown }
interface EstateLiability { type?: string; description?: string; creditor?: string; amountOwing?: number; [key: string]: unknown }
interface EstatePolicy { type?: string; category?: string; product_category?: string; productCategory?: string; provider?: string; name?: string; coverAmount?: number; currentValue?: number; beneficiaryDesignation?: string; policyNumber?: string; status?: string; [key: string]: unknown }
interface VersionedSession { version: number; status?: string; createdAt?: string; publishedAt?: string; [key: string]: unknown }