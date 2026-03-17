import { Group, Campaign, CachedRecipient, CommunicationClient, SupabaseAdminClient, RecipientSelection, AttachmentRef } from "./communication-types.ts";
import * as kv from "./kv_store.tsx";
import { createClient } from "jsr:@supabase/supabase-js@2.49.8";
import { sendEmail, createEmailTemplate } from "./email-service.ts";
import * as repo from "./communication-repo.ts";
import { logger } from "./stderr-logger.ts";

// --- Client Resolution ---

/**
 * Fetch all valid clients from Supabase Auth and KV Profiles
 * 
 * Excludes soft-deleted and suspended clients so they never receive
 * communications (email, SMS, WhatsApp) or appear in group membership.
 * Uses a two-layer guard:
 *   1. profile.accountStatus ('closed'/'suspended') — fast, set by deleteClient/suspendClient
 *   2. security entry (deleted/suspended flags) — belt-and-suspenders for legacy records
 */
export async function getAllClients(supabase: SupabaseAdminClient): Promise<CommunicationClient[]> {
  const { data: { users }, error } = await supabase.auth.admin.listUsers();
  
  if (error) {
    logger.error("Error fetching users", error);
    throw error;
  }

  // Fetch profiles, policies, AND security entries in parallel
  const profileKeys = users.map((u) => `user_profile:${u.id}:personal_info`);
  const policyKeys = users.map((u) => `policies:client:${u.id}`);
  const securityKeys = users.map((u) => `security:${u.id}`);
  
  let profiles: Record<string, unknown>[] = [];
  let allPoliciesArrays: unknown[] = [];
  let securityEntries: Record<string, unknown>[] = [];

  try {
    const [profilesResult, policiesResult, securityResult] = await Promise.all([
      kv.mget(profileKeys),
      kv.mget(policyKeys),
      kv.mget(securityKeys)
    ]);
    profiles = profilesResult as Record<string, unknown>[];
    allPoliciesArrays = policiesResult as unknown[];
    securityEntries = securityResult as Record<string, unknown>[];
  } catch (e) {
    logger.error("Error fetching profiles, policies, or security entries", e as Error);
    profiles = [];
    allPoliciesArrays = [];
    securityEntries = [];
  }

  // Create Lookup Maps (because mget order is not guaranteed)
  const profileMap = new Map<string, Record<string, unknown>>();
  profiles.forEach((p) => {
     if (p && (p as Record<string, unknown>).userId) profileMap.set((p as Record<string, unknown>).userId as string, p as Record<string, unknown>);
  });

  const policiesMap = new Map<string, Array<Record<string, unknown>>>();
  allPoliciesArrays.forEach((pArray) => {
     if (Array.isArray(pArray) && pArray.length > 0) {
        const clientId = (pArray[0] as Record<string, unknown>).clientId as string;
        if (clientId) policiesMap.set(clientId, pArray as Array<Record<string, unknown>>);
     }
  });

  // Build security lookup — entries may have a userId field or be indexed by key position
  const securityMap = new Map<string, Record<string, unknown>>();
  securityEntries.forEach((sec) => {
    if (sec && typeof sec === 'object') {
      // Try userId field first; fall back to nothing (we'll match by user array index below)
      if (sec.userId) securityMap.set(sec.userId as string, sec);
    }
  });

  let excludedCount = 0;

  const validClients = users
    .map((u, i: number) => {
      const profile = profileMap.get(u.id) || {} as Record<string, unknown>;
      const personalInfo = (profile.personalInformation || {}) as Record<string, unknown>;

      // ── Guard 1: Profile-level accountStatus ──────────────────────────
      const accountStatus = profile.accountStatus;
      if (accountStatus === 'closed' || accountStatus === 'suspended') {
        excludedCount++;
        return null;
      }

      // ── Guard 2: Security entry flags ─────────────────────────────────
      const security = securityMap.get(u.id) || securityEntries[i] || {} as Record<string, unknown>;
      if (security.deleted === true || security.suspended === true) {
        excludedCount++;
        return null;
      }

      // Process policies for this user
      const userPolicies = policiesMap.get(u.id) || [];
      const policyProducts = Array.isArray(userPolicies) ? userPolicies.map((p) => ({
        provider: p.providerName as string | undefined,
        type: p.categoryId as string | undefined,
      })) : [];

      // Merge legacy/profile products with dynamic policy products
      const finalProducts = policyProducts.length > 0 ? policyProducts : ((personalInfo.products || []) as Array<{ provider?: string; type?: string }>);
      
      return {
        id: u.id,
        email: u.email,
        firstName: (personalInfo.firstName as string) || (u.user_metadata?.firstName as string) || ((u.user_metadata?.name as string)?.split(' ')[0]) || 'Client',
        lastName: (personalInfo.lastName as string) || (u.user_metadata?.surname as string) || ((u.user_metadata?.name as string)?.split(' ').slice(1).join(' ')) || '',
        phone: (personalInfo.cellphoneNumber as string) || u.phone || '',
        dateOfBirth: personalInfo.dateOfBirth as string | undefined,
        netWorth: (personalInfo.netWorth as number) || 0,
        products: finalProducts,
        status: (personalInfo.status as string) || (u.user_metadata?.status as string) || 'Active',
        category: (personalInfo.category as string) || (u.user_metadata?.category as string) || 'Standard',
        maritalStatus: (personalInfo.maritalStatus as string) || (u.user_metadata?.maritalStatus as string),
        employmentStatus: (personalInfo.employmentStatus as string) || (u.user_metadata?.employmentStatus as string),
        hasEmailOptIn: true, 
        hasWhatsAppOptIn: true,
        metadata: u.user_metadata || {},
        profile: profile,
      } as CommunicationClient;
    })
    .filter((c): c is CommunicationClient => c !== null);

  if (excludedCount > 0) {
    logger.info(`Excluded ${excludedCount} deleted/suspended clients from communication recipient pool`);
  }

  return validClients;
}

// --- Group Logic ---

/**
 * Resolve Group Membership (Dynamic + Manual)
 */
export async function resolveGroupMembership(group: Group, allClients: CommunicationClient[]): Promise<CommunicationClient[]> {
  const manualMemberIds = new Set(group.clientIds || []);
  const dynamicMemberIds = new Set<string>();

  // If there is a filter config, apply it
  if (group.filterConfig) {
    const { 
      productFilters, 
      netWorthFilters, 
      ageFilters, 
      maritalStatusFilters,
      employmentStatusFilters 
    } = group.filterConfig;

    for (const client of allClients) {
      let matches = true;

      // 1. Product Filters
      if (productFilters && productFilters.length > 0) {
        const clientProducts = client.products || [];
        const hasMatch = productFilters.some((filter) => {
          return clientProducts.some((cp) => {
            const providerMatch = !filter.provider || cp.provider === filter.provider;
            const typeMatch = !filter.type || cp.type === filter.type;
            return providerMatch && typeMatch;
          });
        });
        if (!hasMatch) matches = false;
      }

      // 2. Net Worth Filters
      if (matches && netWorthFilters && netWorthFilters.length > 0) {
        const clientNetWorth = client.netWorth || 0;
        const inBand = netWorthFilters.some((band) => {
          const min = band.min ?? -Infinity;
          const max = band.max ?? Infinity;
          return clientNetWorth >= min && clientNetWorth < max;
        });
        if (!inBand) matches = false;
      }

      // 3. Age Filters
      if (matches && ageFilters && ageFilters.length > 0) {
        if (!client.dateOfBirth) {
          matches = false;
        } else {
          const dob = new Date(client.dateOfBirth);
          const ageDifMs = Date.now() - dob.getTime();
          const ageDate = new Date(ageDifMs);
          const age = Math.abs(ageDate.getUTCFullYear() - 1970);

          const inRange = ageFilters.some((range) => {
             const min = range.min ?? 0;
             const max = range.max ?? 150;
             return age >= min && age <= max;
          });
          
          if (!inRange) matches = false;
        }
      }

      // 4. Marital Status Filters
      if (matches && maritalStatusFilters && maritalStatusFilters.length > 0) {
         const status = client.maritalStatus || 'unknown';
         if (!maritalStatusFilters.includes(status)) {
            matches = false;
         }
      }

      // 5. Employment Status Filters
      if (matches && employmentStatusFilters && employmentStatusFilters.length > 0) {
         const status = client.employmentStatus || 'unknown';
         if (!employmentStatusFilters.includes(status)) {
            matches = false;
         }
      }

      if (matches) {
        dynamicMemberIds.add(client.id);
      }
    }
  }

  // Combine Manual + Dynamic
  const finalIds = new Set([...manualMemberIds, ...dynamicMemberIds]);
  
  return allClients.filter(c => finalIds.has(c.id));
}

export async function updateGroupWithRecalculation(group: Group, supabase: SupabaseAdminClient) {
    const allClients = await getAllClients(supabase);
    const members = await resolveGroupMembership(group, allClients);
    
    group.clientCount = members.length;

    // Update DB
    await repo.saveGroup(group);

    // Update Cache
    const cachedMembers: CachedRecipient[] = members.map(m => ({
        id: m.id,
        email: m.email,
        firstName: m.firstName,
        lastName: m.lastName,
        phone: m.phone
    }));
    await repo.setGroupMembersCache(group.id, cachedMembers);
    
    return group;
}

// --- Campaign Logic ---

export function resolveMergeFields(template: string, client: CommunicationClient | CachedRecipient): string {
  if (!template) return '';
  let result = template;
  result = result.replace(/{{first_name}}/g, client.firstName || '');
  result = result.replace(/{{surname}}/g, client.lastName || '');
  result = result.replace(/{{full_name}}/g, `${client.firstName || ''} ${client.lastName || ''}`.trim());
  result = result.replace(/{{email}}/g, client.email || '');
  result = result.replace(/{{phone}}/g, client.phone || '');
  return result;
}

export async function resolveRecipients(selection: RecipientSelection, supabase: SupabaseAdminClient): Promise<CommunicationClient[]> {
  
  if (selection.recipientType === 'single') {
    const selectedId = selection.selectedRecipients[0]?.id;
    const allClients = await getAllClients(supabase);
    return allClients.filter((c) => c.id === selectedId);
  }
  
  if (selection.recipientType === 'multiple') {
    const selectedIds = selection.selectedRecipients.map((r) => r.id);
    const allClients = await getAllClients(supabase);
    return allClients.filter((c) => selectedIds.includes(c.id));
  }
  
  if (selection.recipientType === 'group') {
    const groupSelection = selection.selectedGroup;
    
    if (groupSelection.type === 'custom') {
      // 1. Try Cache First
      const cachedMembers = await repo.getGroupMembersCache(groupSelection.id);
      if (cachedMembers && Array.isArray(cachedMembers) && cachedMembers.length > 0) {
          logger.info(`Using cached members for group ${groupSelection.id}`, { count: cachedMembers.length });
          return cachedMembers;
      }

      // 2. Fallback to fresh calculation
      logger.info(`Cache miss for group ${groupSelection.id}. Recalculating...`);
      const storedGroup = await repo.getGroup(groupSelection.id);
      const group = storedGroup || groupSelection; 
      
      const allClients = await getAllClients(supabase);
      const members = await resolveGroupMembership(group, allClients);
      
      // Update cache for next time
      const cached: CachedRecipient[] = members.map(m => ({
        id: m.id,
        email: m.email,
        firstName: m.firstName,
        lastName: m.lastName,
        phone: m.phone
      }));
      await repo.setGroupMembersCache(group.id, cached);
      
      return members;
    }
    
    if (groupSelection.type === 'system') {
      const allClients = await getAllClients(supabase);
      if (groupSelection.id === 'sys_all') return allClients;
      return allClients;
    }
  }
  
  return [];
}

// --- File/Asset Logic ---

export async function ensureStorageBucket(supabase: SupabaseAdminClient) {
  const bucketName = 'communication-assets';
  try {
    const { data: buckets } = await supabase.storage.listBuckets();
    if (!buckets?.some((b) => b.name === bucketName)) {
      await supabase.storage.createBucket(bucketName, { public: false, fileSizeLimit: 10485760 });
    }
  } catch (e) {
    logger.error("Error checking/creating bucket", e as Error);
  }
  return bucketName;
}

export async function processAttachments(attachments: AttachmentRef[], supabase: SupabaseAdminClient) {
  if (!attachments || attachments.length === 0) return [];
  const processed = [];
  for (const att of attachments) {
    try {
      const { data, error } = await supabase.storage.from(att.bucket).download(att.path);
      if (error) continue;
      const arrayBuffer = await data.arrayBuffer();
      const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
      processed.push({
        content: base64,
        filename: att.name,
        type: att.type || 'application/octet-stream',
        disposition: 'attachment'
      });
    } catch (e) {
      logger.error(`Error processing attachment ${att.name}`, e as Error);
    }
  }
  return processed;
}

// --- Scheduled Task ---

export async function processScheduledCampaigns() {
  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  try {
    const now = new Date();
    const campaignResult = await repo.getCampaigns();
    const dueCampaigns = campaignResult.data.filter((cmp) => {
      if (cmp.status !== 'scheduled' || !cmp.scheduling.startDate) return false;
      return new Date(cmp.scheduling.startDate) <= now;
    });

    const results = [];
    const stripHtml = (html: string) => html.replace(/<[^>]*>?/gm, '');

    for (const campaign of dueCampaigns) {
      campaign.status = 'sending';
      await repo.saveCampaign(campaign);
      
      const recipients = await resolveRecipients(campaign, supabase);
      const sendGridAttachments = await processAttachments(campaign.attachments, supabase);
      let sentCount = 0;

      for (const recipient of recipients) {
        if (!recipient.email) continue;
        const subject = resolveMergeFields(campaign.subject, recipient);
        const htmlBody = createEmailTemplate(resolveMergeFields(campaign.bodyHtml, recipient), { title: subject });
        const textBody = stripHtml(resolveMergeFields(campaign.bodyHtml, recipient));
        try {
          await sendEmail(recipient.email, subject, htmlBody, textBody, sendGridAttachments);
          
          // Log to KV Store instead of missing table
          const msgId = crypto.randomUUID();
          const logEntry = {
            id: msgId,
            recipient_id: recipient.id,
            sender_name: 'Navigate Wealth',
            sender_role: 'System',
            subject: subject,
            content: textBody, // Storing text version for preview/display
            body: htmlBody, // Storing full HTML version if needed
            category: 'General', // TODO: Add category to campaign model
            created_at: new Date().toISOString(),
            read: false,
            priority: 'normal',
            campaign_id: campaign.id
          };
          
          const key = `communication_log:${recipient.id}:${msgId}`;
          await kv.set(key, logEntry);
          await kv.set(`msg_lookup:${msgId}`, { fullKey: key });

          sentCount++;
        } catch (e) {
          logger.error(`Failed to send email to ${recipient.email}`, e as Error);
        }
      }

      campaign.status = 'completed';
      campaign.stats = { sent: sentCount, failed: recipients.length - sentCount, total: recipients.length };
      campaign.updatedAt = new Date().toISOString();
      await repo.saveCampaign(campaign);
      results.push({ id: campaign.id, sent: sentCount });
    }
    return { processed: results.length, results };
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}