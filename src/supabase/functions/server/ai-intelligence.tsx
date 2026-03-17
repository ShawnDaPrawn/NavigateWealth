/**
 * AI Intelligence Agent Routes
 * Backend for the Navigate Wealth Intelligence Agent on the admin Advice Engine page
 * 
 * This agent provides advisers and admin users with:
 * - Client-specific insights and queries
 * - Platform operational intelligence
 * - Compliance and FICA status checks
 * - Policy and product details
 * - Financial analysis and recommendations
 * 
 * Architecture mirrors the client-facing AI Advisor but adapted for internal use
 */

import { Hono } from "npm:hono";
import { createClient } from "jsr:@supabase/supabase-js@2.49.8";
import * as kv from "./kv_store.tsx";
import { createModuleLogger } from "./stderr-logger.ts";
import { getErrMsg } from "./shared-logger-utils.ts";

const app = new Hono();
const log = createModuleLogger('ai-intelligence');

// Root handlers
app.get('/', (c) => c.json({ service: 'ai-intelligence', status: 'active' }));
app.get('', (c) => c.json({ service: 'ai-intelligence', status: 'active' }));

// Lazy Supabase client — must NOT be top-level to avoid deployment crashes in edge functions.
const getSupabase = () => createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

// Workflow configuration
const WORKFLOW_ID = 'wf_692b6eb221fc8190a671198e7251755c0af51c5b55ce7f96';
const getOpenAIKey = () => Deno.env.get('OPENAI_API_KEY');

/**
 * Authentication middleware for admin routes
 */
async function requireAdmin(c: Context, next: Next) {
  try {
    const authHeader = c.req.header('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return c.json({ error: 'Unauthorized: Missing or invalid token' }, 401);
    }

    const token = authHeader.split(' ')[1];
    const { data: { user }, error } = await getSupabase().auth.getUser(token);

    if (error || !user) {
      return c.json({ error: 'Unauthorized: Invalid user session' }, 401);
    }

    // Check if user has appropriate access from KV store
    const profileKey = `user_profile:${user.id}:personal_info`;
    const profile = await kv.get(profileKey);

    log.info('🔐 AI Intelligence auth check:', { 
      userId: user.id, 
      email: user.email, 
      profileExists: !!profile,
      role: profile?.role 
    });

    // Allow admin, super_admin, and adviser roles
    const allowedRoles = ['admin', 'super_admin', 'adviser'];
    if (!profile || !allowedRoles.includes(profile.role)) {
      log.info('❌ Access denied - unauthorized role:', { role: profile?.role });
      return c.json({ error: 'Forbidden: Authorized role required' }, 403);
    }

    // Attach user info to context
    c.set('user', user);
    c.set('profile', profile);

    await next();
  } catch (error) {
    log.error('Auth middleware error:', error);
    return c.json({ error: 'Authentication failed' }, 500);
  }
}

/**
 * Fetch comprehensive client data for AI context
 */
async function getClientContext(clientId: string, userId: string) {
  try {
    // Fetch client profile from KV store
    const profileKey = `user_profile:${clientId}:personal_info`;
    const clientProfile = await kv.get(profileKey);

    if (!clientProfile) {
      log.info('❌ Client profile not found:', { clientId });
      return null;
    }

    const [
      policies,
      compliance,
      riskProfile,
      beneficiaries,
      notes,
      communications,
      clientKeys,
      riskPlanningFNAs,
      medicalFNAs,
      retirementFNAs,
      investmentINAs,
      taxPlanningFNAs,
      estatePlanningFNAs,
      esignDocuments,
      tasks,
      calendarEvents
    ] = await Promise.all([
      // Policies and products
      getSupabase()
        .from('kv_store_91ed8379')
        .select('*')
        .like('key', `client:${clientId}:policy:%`),
      
      // Compliance and FICA status
      getSupabase()
        .from('kv_store_91ed8379')
        .select('*')
        .like('key', `client:${clientId}:compliance:%`),
      
      // Risk profile
      getSupabase()
        .from('kv_store_91ed8379')
        .select('*')
        .eq('key', `client:${clientId}:risk_profile`)
        .single(),
      
      // Beneficiaries
      getSupabase()
        .from('kv_store_91ed8379')
        .select('*')
        .like('key', `client:${clientId}:beneficiary:%`),
      
      // Notes
      getSupabase()
        .from('kv_store_91ed8379')
        .select('*')
        .like('key', `client:${clientId}:note:%`)
        .order('key', { ascending: false })
        .limit(10),
      
      // Communication logs (from KV)
      (async () => {
        const logs = await kv.getByPrefix(`communication_log:${clientId}:`);
        return {
          data: logs
            .sort((a: Record<string, unknown>, b: Record<string, unknown>) => new Date((b.created_at as string) || 0).getTime() - new Date((a.created_at as string) || 0).getTime())
            .slice(0, 10)
        };
      })(),

      // Client Keys (totals and calculations)
      kv.get(`user_profile:${clientId}:client_keys`),

      // Risk Planning FNAs
      kv.getByPrefix(`risk-planning-fna:client:${clientId}:`),

      // Medical FNAs
      kv.getByPrefix(`medical-fna:client:${clientId}:`),

      // Retirement FNAs
      kv.getByPrefix(`retirement-fna:client:${clientId}:`),

      // Investment INAs
      kv.getByPrefix(`investment-ina:client:${clientId}:`),

      // Tax Planning FNAs
      kv.getByPrefix(`tax-planning-fna:client:${clientId}:`),

      // Estate Planning FNAs
      kv.getByPrefix(`estate-planning-fna:client:${clientId}:`),

      // E-sign documents
      getSupabase()
        .from('kv_store_91ed8379')
        .select('*')
        .like('key', `esign:client:${clientId}:%`),

      // Client tasks
      getSupabase()
        .from('kv_store_91ed8379')
        .select('*')
        .like('key', `task:client:${clientId}:%`),

      // Calendar events
      getSupabase()
        .from('kv_store_91ed8379')
        .select('*')
        .like('key', `calendar:client:${clientId}:%`)
    ]);

    return {
      profile: clientProfile,
      policies: policies.data || [],
      compliance: compliance.data || [],
      riskProfile: riskProfile.data,
      beneficiaries: beneficiaries.data || [],
      notes: notes.data || [],
      communications: communications.data || [],
      clientKeys: clientKeys || null,
      
      // FNAs and INAs
      fnas: {
        riskPlanning: riskPlanningFNAs || [],
        medical: medicalFNAs || [],
        retirement: retirementFNAs || [],
        investment: investmentINAs || [],
        taxPlanning: taxPlanningFNAs || [],
        estatePlanning: estatePlanningFNAs || []
      },

      // Other client data
      esignDocuments: esignDocuments.data || [],
      tasks: tasks.data || [],
      calendarEvents: calendarEvents.data || []
    };
  } catch (error) {
    log.error('Error fetching client context:', error);
    return null;
  }
}

/**
 * Fetch platform operational insights
 */
async function getPlatformContext(userId: string) {
  try {
    const [
      pendingApplications,
      pendingRequests,
      upcomingReminders,
      pendingTasks,
      recentActivities
    ] = await Promise.all([
      // Pending applications
      getSupabase()
        .from('kv_store_91ed8379')
        .select('*')
        .like('key', 'application:%')
        .filter('value->>status', 'in', '("pending","in_progress")'),
      
      // Pending client requests
      getSupabase()
        .from('kv_store_91ed8379')
        .select('*')
        .like('key', 'request:%')
        .filter('value->>status', 'eq', 'pending'),
      
      // Upcoming reminders (from reminders table)
      getSupabase()
        .from('reminders')
        .select('*')
        .gte('due_at', new Date().toISOString())
        .in('status', ['pending', 'in_progress'])
        .order('due_at', { ascending: true })
        .limit(20),
      
      // Pending tasks/to-dos (from tasks table)
      getSupabase()
        .from('tasks')
        .select('*')
        .in('status', ['new', 'in_progress'])
        .order('priority', { ascending: false })
        .limit(20),
      
      // Recent platform activities (if stored in KV)
      getSupabase()
        .from('kv_store_91ed8379')
        .select('*')
        .like('key', 'activity:%')
        .order('key', { ascending: false })
        .limit(20)
    ]);

    return {
      pendingApplications: pendingApplications.data || [],
      pendingRequests: pendingRequests.data || [],
      upcomingReminders: upcomingReminders.data || [],
      pendingTasks: pendingTasks.data || [],
      recentActivities: recentActivities.data || []
    };
  } catch (error) {
    log.error('Error fetching platform context:', error);
    return null;
  }
}

/**
 * Search for clients by name or partial identifier
 * Excludes soft-deleted, suspended, and closed accounts
 */
async function searchClients(searchTerm: string) {
  try {
    // Fetch all user profiles from KV store
    const { data, error } = await getSupabase()
      .from('kv_store_91ed8379')
      .select('*')
      .like('key', 'user_profile:%:personal_info');

    if (error) throw error;

    log.info(`🔍 Searching clients for term: "${searchTerm}", found ${data?.length || 0} total profiles`);

    // Filter profiles by search term
    const searchLower = searchTerm.toLowerCase();
    const textMatches = (data || [])
      .filter(item => {
        const profile = item.value;
        if (!profile) return false;

        // Exclude admin users from client search
        if (profile.role === 'admin' || profile.role === 'super_admin') {
          return false;
        }

        // Check accountStatus — exclude closed and suspended accounts
        const excludedAccountStatuses = ['closed', 'suspended'];
        if (profile.accountStatus && excludedAccountStatuses.includes(profile.accountStatus)) {
          return false;
        }

        // Only include approved clients and those in application stages
        // If no applicationStatus is set, include by default (for backwards compatibility)
        const excludedStatuses = ['archived', 'rejected', 'withdrawn', 'cancelled', 'suspended'];
        
        if (profile.applicationStatus) {
          // If status exists and is explicitly excluded, filter out
          if (excludedStatuses.includes(profile.applicationStatus)) {
            return false;
          }
        }

        // Get name fields (handle different field name variations)
        const firstName = profile.firstName || profile.first_name || profile.personalInformation?.firstName || '';
        const lastName = profile.surname || profile.last_name || profile.personalInformation?.lastName || '';
        const email = profile.email || profile.personalInformation?.email || '';
        const fullName = `${firstName} ${lastName}`.toLowerCase();

        // Match against search term
        return (
          firstName.toLowerCase().includes(searchLower) ||
          lastName.toLowerCase().includes(searchLower) ||
          fullName.includes(searchLower) ||
          email.toLowerCase().includes(searchLower)
        );
      })
      .slice(0, 20) // Take extra to account for security-filtered removals
      .map(item => {
        // Extract user_id from key pattern: user_profile:{userId}:personal_info
        const userIdMatch = item.key.match(/user_profile:([^:]+):/);
        const userId = userIdMatch ? userIdMatch[1] : null;

        const profile = item.value;
        
        return {
          user_id: userId,
          first_name: profile.firstName || profile.first_name || profile.personalInformation?.firstName || '',
          last_name: profile.surname || profile.last_name || profile.personalInformation?.lastName || '',
          email: profile.email || profile.personalInformation?.email || '',
          phone: profile.phone || profile.phoneNumber || profile.personalInformation?.cellphone || ''
        };
      })
      .filter(profile => profile.user_id && profile.first_name); // Only return profiles with valid user_id and name

    // Cross-reference security entries to exclude soft-deleted and suspended accounts
    const validProfiles: typeof textMatches = [];
    for (const profile of textMatches) {
      try {
        const security = await kv.get(`security:${profile.user_id}`);
        if (security?.deleted === true) {
          log.info('Excluding deleted client from search results', { userId: profile.user_id });
          continue;
        }
        if (security?.suspended === true) {
          log.info('Excluding suspended client from search results', { userId: profile.user_id });
          continue;
        }
        validProfiles.push(profile);
      } catch {
        // If security entry doesn't exist or errors, include the profile
        validProfiles.push(profile);
      }
      if (validProfiles.length >= 10) break;
    }

    // Note: Orphaned KV profiles (auth account fully removed) are handled by
    // the periodic cleanup job at POST /clients/maintenance/cleanup, which
    // marks them accountStatus:'closed'. This avoids expensive per-request
    // auth.admin.getUserById() calls during search.

    log.info(`✅ Found ${validProfiles.length} matching active client profiles (from ${textMatches.length} text matches)`);
    
    return validProfiles;
  } catch (error) {
    log.error('Error searching clients:', error);
    return [];
  }
}

/**
 * Build system prompt with context
 */
function buildSystemPrompt(clientContext: ClientContext, platformContext: PlatformContext) {
  // Extract client name for the prompt
  let clientName = 'Client';
  if (clientContext?.profile) {
    const firstName = clientContext.profile.firstName || clientContext.profile.first_name || clientContext.profile.personalInformation?.firstName || '';
    const lastName = clientContext.profile.surname || clientContext.profile.last_name || clientContext.profile.personalInformation?.lastName || '';
    clientName = `${firstName} ${lastName}`.trim() || 'Client';
  }

  return `You are the Navigate Wealth Intelligence Agent, an AI assistant for financial advisers and admin users at Navigate Wealth, a South African financial services firm.

## Your Purpose
You help advisers and admin users by:
- Answering questions about specific clients and their financial situations
- Providing platform operational insights (pending tasks, applications, events)
- Explaining compliance requirements and FICA status
- Analyzing policies, products, and financial strategies
- Surfacing risks, gaps, and opportunities in client portfolios
- Summarizing client positions and communication history

## Data Access
You have access to:
${clientContext ? `
### Client-Specific Data (${clientName})

#### Profile & Basic Information
- Full client profile available
- Client Keys/Totals: ${clientContext.clientKeys ? 'Available' : 'Not calculated'}
${clientContext.clientKeys ? `\nClient Financial Totals:\n${JSON.stringify(clientContext.clientKeys, null, 2)}` : ''}

#### Policies & Products
- Policies: ${clientContext.policies.length} policy/product records
${clientContext.policies.length > 0 ? `\nPolicies:\n${clientContext.policies.map((p: KvEntry) => JSON.stringify(p.value, null, 2)).join('\n')}` : ''}

#### Compliance & Risk
- Compliance Status: ${clientContext.compliance.length} compliance records
- Risk Profile: ${clientContext.riskProfile ? 'Available' : 'Not set'}
${clientContext.riskProfile ? `\nRisk Profile:\n${JSON.stringify(clientContext.riskProfile, null, 2)}` : ''}
${clientContext.compliance.length > 0 ? `\nCompliance Records:\n${clientContext.compliance.map((c: KvEntry) => JSON.stringify(c.value, null, 2)).join('\n')}` : ''}

#### Beneficiaries
- Beneficiaries: ${clientContext.beneficiaries.length} beneficiary records
${clientContext.beneficiaries.length > 0 ? `\nBeneficiaries:\n${clientContext.beneficiaries.map((b: KvEntry) => JSON.stringify(b.value, null, 2)).join('\n')}` : ''}

#### Financial Needs Analyses (FNAs) & Investment Needs Analyses (INAs)
- Risk Planning FNAs: ${clientContext.fnas.riskPlanning.length} sessions
- Medical FNAs: ${clientContext.fnas.medical.length} sessions
- Retirement FNAs: ${clientContext.fnas.retirement.length} sessions
- Investment INAs: ${clientContext.fnas.investment.length} sessions
- Tax Planning FNAs: ${clientContext.fnas.taxPlanning.length} sessions
- Estate Planning FNAs: ${clientContext.fnas.estatePlanning.length} sessions

${clientContext.fnas.riskPlanning.length > 0 ? `\n##### Risk Planning FNAs:\n${clientContext.fnas.riskPlanning.map((fna: FnaEntry) => `- Version ${fna.version || 'N/A'}, Status: ${fna.status || 'draft'}, Created: ${fna.createdAt || 'N/A'}\n  ${JSON.stringify(fna, null, 2)}`).join('\n')}` : ''}

${clientContext.fnas.medical.length > 0 ? `\n##### Medical FNAs:\n${clientContext.fnas.medical.map((fna: FnaEntry) => `- Version ${fna.version || 'N/A'}, Status: ${fna.status || 'draft'}, Created: ${fna.createdAt || 'N/A'}\n  ${JSON.stringify(fna, null, 2)}`).join('\n')}` : ''}

${clientContext.fnas.retirement.length > 0 ? `\n##### Retirement FNAs:\n${clientContext.fnas.retirement.map((fna: FnaEntry) => `- Version ${fna.version || 'N/A'}, Status: ${fna.status || 'draft'}, Created: ${fna.createdAt || 'N/A'}\n  ${JSON.stringify(fna, null, 2)}`).join('\n')}` : ''}

${clientContext.fnas.investment.length > 0 ? `\n##### Investment INAs:\n${clientContext.fnas.investment.map((ina: FnaEntry) => `- Version ${ina.version || 'N/A'}, Status: ${ina.status || 'draft'}, Created: ${ina.createdAt || 'N/A'}\n  ${JSON.stringify(ina, null, 2)}`).join('\n')}` : ''}

${clientContext.fnas.taxPlanning.length > 0 ? `\n##### Tax Planning FNAs:\n${clientContext.fnas.taxPlanning.map((fna: FnaEntry) => `- Version ${fna.version || 'N/A'}, Status: ${fna.status || 'draft'}, Created: ${fna.createdAt || 'N/A'}\n  ${JSON.stringify(fna, null, 2)}`).join('\n')}` : ''}

${clientContext.fnas.estatePlanning.length > 0 ? `\n##### Estate Planning FNAs:\n${clientContext.fnas.estatePlanning.map((fna: FnaEntry) => `- Version ${fna.version || 'N/A'}, Status: ${fna.status || 'draft'}, Created: ${fna.createdAt || 'N/A'}\n  ${JSON.stringify(fna, null, 2)}`).join('\n')}` : ''}

#### Documents & Tasks
- E-Sign Documents: ${clientContext.esignDocuments.length} documents
- Tasks: ${clientContext.tasks.length} tasks
- Calendar Events: ${clientContext.calendarEvents.length} events
${clientContext.esignDocuments.length > 0 ? `\nE-Sign Documents:\n${clientContext.esignDocuments.map((doc: KvEntry) => JSON.stringify(doc.value, null, 2)).join('\n')}` : ''}
${clientContext.tasks.length > 0 ? `\nTasks:\n${clientContext.tasks.map((task: KvEntry) => JSON.stringify(task.value, null, 2)).join('\n')}` : ''}
${clientContext.calendarEvents.length > 0 ? `\nCalendar Events:\n${clientContext.calendarEvents.map((event: KvEntry) => JSON.stringify(event.value, null, 2)).join('\n')}` : ''}

#### Notes & Communications
- Recent Notes: ${clientContext.notes.length} notes
- Recent Communications: ${clientContext.communications.length} communication logs
${clientContext.notes.length > 0 ? `\nRecent Notes:\n${clientContext.notes.map((note: KvEntry) => JSON.stringify(note.value, null, 2)).join('\n')}` : ''}
${clientContext.communications.length > 0 ? `\nRecent Communications:\n${clientContext.communications.map((comm: unknown) => JSON.stringify(comm, null, 2)).join('\n')}` : ''}

#### Full Profile Details:
${JSON.stringify(clientContext.profile, null, 2)}
` : ''}
${platformContext ? `
### Platform Operational Data
- Pending Applications: ${platformContext.pendingApplications.length}
- Pending Requests: ${platformContext.pendingRequests.length}
- Upcoming Reminders: ${platformContext.upcomingReminders.length}
- Pending Tasks/To-Dos: ${platformContext.pendingTasks.length}
- Recent Activities: ${platformContext.recentActivities.length}

${platformContext.pendingTasks.length > 0 ? `
#### Pending Tasks Details:
${platformContext.pendingTasks.map((item: TaskEntry) => {
  return `- **${item.title}** (${item.status}, ${item.priority} priority)${item.due_date ? ` - Due: ${new Date(item.due_date).toLocaleDateString()}` : ''}${item.description ? `\n  ${item.description}` : ''}`;
}).join('\n')}
` : ''}

${platformContext.upcomingReminders.length > 0 ? `
#### Upcoming Reminders Details:
${platformContext.upcomingReminders.map((item: ReminderEntry) => {
  return `- **${item.title}** (${item.type}) - Due: ${new Date(item.due_at!).toLocaleDateString()}${item.description ? `\n  ${item.description}` : ''}`;
}).join('\n')}
` : ''}
` : ''}

## Response Guidelines
1. **Always structure responses properly**:
   - Use clear headings (## for main sections, ### for subsections)
   - Use bullet points for lists
   - Use tables for comparative data (format as Markdown)
   - End with "Next Steps" or "Recommendations" section

2. **Be precise and factual**:
   - Only use data provided in the context
   - If information is missing, explicitly say so
   - Never fabricate or hallucinate data
   - Cite specific sources (e.g., "According to the risk profile on file...")

3. **Respect role-based access**:
   - Only discuss data the user has access to
   - If uncertain about access, be conservative

4. **Handle ambiguity**:
   - If a client name is ambiguous, ask for clarification
   - Provide a shortlist of potential matches

5. **Be compliant and professional**:
   - Follow FAIS Act guidelines
   - Remind advisers to verify before advising clients
   - Highlight compliance gaps or risks

6. **Provide actionable insights**:
   - Don't just report data—analyze it
   - Highlight opportunities, risks, and gaps
   - Suggest next steps

## South African Context
- You understand South African financial regulations (FAIS, FICA, NCA, etc.)
- You're familiar with local products (RAs, TFSAs, medical aids, etc.)
- You know SARS tax rules and retirement fund regulations
- You use ZAR as currency

## Examples of Good Responses
✅ "Based on John Smith's risk profile (moderate), his current equity allocation of 85% exceeds the recommended range of 60-70% for his age (52). Consider rebalancing."
✅ "There are 3 pending FICA documents for Sarah Johnson (ID verification, proof of address, bank statement). These must be completed before proceeding with the new policy application."
✅ "No active life cover policy found for this client. Given their dependents and outstanding bond (R1.2M), this represents a significant risk gap."

## Examples of Bad Responses
❌ "The client probably has insurance." (Guessing)
❌ "I recommend product X." (Too prescriptive without full context)
❌ "Everything looks fine." (Not analytical enough)

Now respond to the adviser's query with structured, accurate, and actionable intelligence.`;
}

/**
 * Call OpenAI workflow for AI response
 */
async function callOpenAIWorkflow(messages: ChatMessage[], systemPrompt: string) {
  const OPENAI_API_KEY = getOpenAIKey();
  if (!OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY not configured');
  }

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: systemPrompt },
          ...messages
        ],
        temperature: 0.7,
        max_tokens: 2000
      })
    });

    if (!response.ok) {
      const error = await response.json();
      log.error('OpenAI API error:', error);
      
      // Handle specific error codes
      if (response.status === 429) {
        throw new Error('OpenAI API rate limit exceeded. Please wait a moment and try again, or check your API quota at https://platform.openai.com/usage');
      }
      
      if (response.status === 401) {
        throw new Error('OpenAI API authentication failed. Please check your API key.');
      }
      
      throw new Error(`OpenAI API error: ${response.status} - ${error.error?.message || 'Unknown error'}`);
    }

    const data = await response.json();
    return data.choices[0].message.content;
  } catch (error: unknown) {
    // Log full error for debugging
    log.error('Error in /chat endpoint:', {
      name: error instanceof Error ? error.name : undefined,
      message: getErrMsg(error),
      stack: error instanceof Error ? error.stack : undefined,
      error: error
    });
    
    // Extract error message safely
    const errorMessage = getErrMsg(error);
  }
}

/**
 * GET /status - Check API configuration status
 */
app.get('/status', requireAdmin, async (c) => {
  try {
    const configured = !!getOpenAIKey();
    // Don't expose any part of the API key to frontend for security
    
    return c.json({
      configured
    });
  } catch (error) {
    log.error('Error checking status:', error);
    return c.json({ error: 'Failed to check status' }, 500);
  }
});

/**
 * POST /chat - Send a message to the AI Intelligence Agent
 */
app.post('/chat', requireAdmin, async (c) => {
  try {
    const user = c.get('user');
    const body = await c.req.json();
    const { message, clientId, conversationHistory } = body;

    if (!message || typeof message !== 'string') {
      return c.json({ error: 'Invalid message' }, 400);
    }

    // Fetch context based on query
    let clientContext = null;
    let platformContext = null;

    // If clientId provided, fetch client-specific data
    if (clientId && clientId !== 'no-client') {
      clientContext = await getClientContext(clientId, user.id);
      
      if (!clientContext) {
        return c.json({ error: 'Client not found or access denied' }, 404);
      }
    }

    // Check if query is about platform operations (not client-specific)
    const isPlatformQuery = message.toLowerCase().match(/pending|application|todo|task|reminder|event|review|report|status|dashboard|due|coming up/);
    if (isPlatformQuery || !clientId) {
      platformContext = await getPlatformContext(user.id);
    }

    // Check if query mentions a client name but no clientId selected
    const mentionsClient = message.match(/for ([\w\s]+)|about ([\w\s]+)|client ([\w\s]+)/i);
    if (mentionsClient && !clientId) {
      const searchTerm = mentionsClient[1] || mentionsClient[2] || mentionsClient[3];
      const matchingClients = await searchClients(searchTerm.trim());
      
      if (matchingClients.length > 1) {
        // Ambiguous - ask for clarification
        const clientList = matchingClients.map((c, i) => 
          `${i + 1}. ${c.first_name} ${c.last_name} (${c.email})`
        ).join('\n');
        
        return c.json({
          reply: `I found ${matchingClients.length} clients matching "${searchTerm}":\n\n${clientList}\n\nPlease select a specific client from the dropdown to continue with your query.`,
          ambiguous: true,
          matches: matchingClients
        });
      }
      
      if (matchingClients.length === 1) {
        // Single match - fetch context for this client
        clientContext = await getClientContext(matchingClients[0].user_id, user.id);
      }
    }

    // Build system prompt with context
    const systemPrompt = buildSystemPrompt(clientContext, platformContext);

    // Prepare messages for OpenAI
    const messages = [
      ...(conversationHistory || []),
      { role: 'user', content: message }
    ];

    // Call OpenAI workflow
    const reply = await callOpenAIWorkflow(messages, systemPrompt);

    // Save to conversation history in kv_store
    const conversationKey = `ai_intelligence:${user.id}:conversation:${Date.now()}`;
    await getSupabase()
      .from('kv_store_91ed8379')
      .insert({
        key: conversationKey,
        value: {
          query: message,
          reply,
          clientId: clientId || null,
          timestamp: new Date().toISOString(),
          userId: user.id
        }
      });

    return c.json({
      reply,
      conversationId: conversationKey
    });

  } catch (error: unknown) {
    // Log full error for debugging — outer /chat endpoint catch
    log.error('Error in /chat endpoint (outer):', {
      name: error instanceof Error ? error.name : undefined,
      message: getErrMsg(error),
      stack: error instanceof Error ? error.stack : undefined,
      error: error
    });
    
    // Extract error message safely
    const errorMessage = getErrMsg(error);
    
    if (errorMessage.includes('OPENAI_API_KEY')) {
      return c.json({
        error: 'OpenAI API key not configured. Please add OPENAI_API_KEY to Supabase secrets.',
        details: errorMessage
      }, 401);
    }
    
    return c.json({
      error: 'Failed to process request',
      details: errorMessage
    }, 500);
  }
});

/**
 * GET /history - Get conversation history
 */
app.get('/history', requireAdmin, async (c) => {
  try {
    const user = c.get('user');
    
    const { data, error } = await getSupabase()
      .from('kv_store_91ed8379')
      .select('*')
      .like('key', `ai_intelligence:${user.id}:conversation:%`)
      .order('key', { ascending: false })
      .limit(50);

    if (error) throw error;

    const messages = (data || []).map(item => ({
      query: item.value.query,
      reply: item.value.reply,
      timestamp: item.value.timestamp,
      clientId: item.value.clientId
    }));

    return c.json({ messages });
  } catch (error) {
    log.error('Error fetching history:', error);
    return c.json({ error: 'Failed to fetch history' }, 500);
  }
});

/**
 * DELETE /history - Clear conversation history
 */
app.delete('/history', requireAdmin, async (c) => {
  try {
    const user = c.get('user');
    
    // Delete all conversation history for this user
    const { error } = await getSupabase()
      .from('kv_store_91ed8379')
      .delete()
      .like('key', `ai_intelligence:${user.id}:conversation:%`);

    if (error) throw error;

    return c.json({ success: true });
  } catch (error) {
    log.error('Error clearing history:', error);
    return c.json({ error: 'Failed to clear history' }, 500);
  }
});

/**
 * POST /search-clients - Search for clients
 */
app.post('/search-clients', requireAdmin, async (c) => {
  try {
    const body = await c.req.json();
    const { searchTerm } = body;

    if (!searchTerm || searchTerm.length < 2) {
      return c.json({ clients: [] });
    }

    const clients = await searchClients(searchTerm);
    return c.json({ clients });
  } catch (error) {
    log.error('Error searching clients:', error);
    return c.json({ error: 'Failed to search clients' }, 500);
  }
});

export default app;