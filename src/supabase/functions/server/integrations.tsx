import { Hono } from 'npm:hono';
import * as XLSX from 'npm:xlsx';
import { createClient } from 'jsr:@supabase/supabase-js@2.49.8';
import * as kv from './kv_store.tsx';
import { DEFAULT_SCHEMAS } from './default-schemas.ts';
import { createModuleLogger } from "./stderr-logger.ts";
import { getErrMsg } from "./shared-logger-utils.ts";
import { requireAuth } from "./auth-mw.ts";
import { formatZodError } from './shared-validation-utils.ts';
import {
  SaveConfigSchema,
  SaveSchemaInputSchema,
  CreatePolicySchema,
  UpdatePolicySchema,
  ArchivePolicySchema,
  ReinstatePolicySchema,
  RecalculateTotalsSchema,
  PolicyDocumentMetadataSchema,
  DeletePolicyDocumentSchema,
} from './integrations-validation.ts';
import type {
  KvPolicy,
  KvSchema,
  SchemaField,
  KvProvider,
  CustomKey,
  KvFnaEntry,
  PolicyRenewal,
  PolicyDocument,
} from "./integrations-types.ts";
import {
  extractPolicyDocument,
  getProviderTerminology,
  saveProviderTerminology,
  getAllProviderTerminologies,
  generateExtractionDiff,
  buildHistoryEntry,
} from './policy-extraction-service.ts';
import type {
  ExtractionResult,
  FieldMappingEntry,
  ProviderTerminologyMap,
  ExtractionHistoryEntry,
  FieldDiff,
} from './policy-extraction-types.ts';

const app = new Hono();
const log = createModuleLogger('integrations');

// Root handlers
app.get('/', (c) => c.json({ service: 'integrations', status: 'active' }));
app.get('', (c) => c.json({ service: 'integrations', status: 'active' }));

const getByPrefix = async (prefix: string) => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
  const { data, error } = await supabase
    .from("kv_store_91ed8379")
    .select("value")
    .like("key", prefix + "%");
    
  if (error) throw new Error(error.message);
  return data?.map(d => d.value) || [];
};

// --- Types ---

interface IntegrationConfig {
  providerId: string;
  categoryId: string;
  updatedAt: string;
  updatedBy: string;
  fieldMapping: Record<string, string>;
  settings: {
    autoMap: boolean;
    ignoreUnmatched: boolean;
    strictMode: boolean;
  };
}

interface UploadHistory {
  id: string;
  providerId: string;
  categoryId: string;
  fileName: string;
  status: 'success' | 'failed';
  rowCount: number;
  errorCount: number;
  uploadedAt: string;
  errors?: string[];
}

interface IntegrationProvider {
  id: string;
  name: string;
  description?: string;
  categoryIds: string[];
  logoUrl?: string;
  lastAttempted?: string;
  lastUpdateStatus?: 'success' | 'failed' | 'never';
  lastSuccessful?: string;
}

// --- Endpoints ---

// GET /providers - Legacy/Fallback support
// Normalises camelCase ↔ snake_case fields for backward compatibility
app.get("/providers", requireAuth, async (c) => {
  try {
    const providers = await kv.getByPrefix('provider:');
    
    if (!providers) {
      return c.json({ providers: [] });
    }
    
    // Normalise: ensure both camelCase and snake_case fields are present
    // so that all consumers (PolicyFormDialog, IntegrationsTab, etc.) work
    const normalised = providers.map((p: Record<string, unknown>) => ({
      ...p,
      // Canonical snake_case
      category_ids: (p.category_ids as string[] | undefined) || (p.categoryIds as string[] | undefined) || [],
      logo_url: (p.logo_url as string | undefined) || (p.logoUrl as string | undefined) || undefined,
      // Legacy camelCase (for any consumer still expecting it)
      categoryIds: (p.category_ids as string[] | undefined) || (p.categoryIds as string[] | undefined) || [],
      logoUrl: (p.logo_url as string | undefined) || (p.logoUrl as string | undefined) || undefined,
    }));
    
    normalised.sort((a: KvProvider, b: KvProvider) => (a.name || '').localeCompare(b.name || ''));
    
    return c.json({ providers: normalised });
  } catch (e) {
    log.error("Error fetching providers:", e);
    return c.json({ error: "Failed to fetch providers" }, 500);
  }
});

// GET /config
app.get("/config", async (c) => {
  const providerId = c.req.query("providerId");
  const categoryId = c.req.query("categoryId");

  if (!providerId || !categoryId) {
    return c.json({ error: "Missing providerId or categoryId" }, 400);
  }

  const key = `config:mapping:${providerId}:${categoryId}`;
  const config = await kv.get(key);

  if (!config) {
    return c.json({
      providerId,
      categoryId,
      updatedAt: new Date().toISOString(),
      updatedBy: "system",
      fieldMapping: {},
      settings: {
        autoMap: true,
        ignoreUnmatched: false,
        strictMode: false,
      },
    });
  }

  return c.json(config);
});

// POST /config
app.post("/config", async (c) => {
  try {
    const body = await c.req.json();
    const parsed = SaveConfigSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: "Validation failed", ...formatZodError(parsed.error) }, 400);
    }
    const { providerId, categoryId, fieldMapping, settings } = parsed.data;

    const key = `config:mapping:${providerId}:${categoryId}`;
    
    const config: IntegrationConfig = {
      providerId,
      categoryId,
      updatedAt: new Date().toISOString(),
      updatedBy: "user",
      fieldMapping,
      settings,
    };

    await kv.set(key, config);
    return c.json({ success: true, config });

  } catch (e) {
    log.error("Error saving config:", e);
    return c.json({ error: "Failed to save configuration" }, 500);
  }
});

// POST /upload
app.post("/upload", async (c) => {
  try {
    // Wrap parseBody in try/catch — Hono's parseBody calls formData.forEach()
    // internally, which throws if the body cannot be parsed as FormData
    // (e.g. missing/malformed Content-Type boundary, already-consumed stream).
    let body: Record<string, string | File>;
    try {
      body = await c.req.parseBody();
    } catch (parseErr: unknown) {
      log.error('Failed to parse multipart form data:', parseErr);
      return c.json({
        error: 'Invalid form data. Ensure the request uses multipart/form-data encoding.',
        details: parseErr instanceof Error ? parseErr.message : String(parseErr),
      }, 400);
    }

    const file = body['file'];
    const providerId = body['providerId'] as string;
    const categoryId = body['categoryId'] as string;
    const mode = (body['mode'] as string) || 'preview';

    if (!file || !(file instanceof File)) {
      return c.json({ error: "No file uploaded" }, 400);
    }
    if (!providerId || !categoryId) {
      return c.json({ error: "Missing context (provider/category)" }, 400);
    }

    const providerExists = await kv.get(`provider:${providerId}`);
    if (!providerExists) {
        return c.json({ error: "Invalid provider ID" }, 400);
    }

    const configKey = `config:mapping:${providerId}:${categoryId}`;
    const config = (await kv.get(configKey)) as IntegrationConfig | null;

    if (!config && mode === 'commit') {
      return c.json({ error: "No mapping configuration found. Please configure mappings first." }, 400);
    }
    
    const fieldMapping = config?.fieldMapping || {};
    const settings = config?.settings || { autoMap: true, ignoreUnmatched: false, strictMode: false };

    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(new Uint8Array(buffer), { type: "array" });
    const firstSheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[firstSheetName];
    
    const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as unknown[][];
    
    if (jsonData.length === 0) {
       return c.json({ error: "File is empty" }, 400);
    }

    const headers = (jsonData[0] || []) as string[];
    const rawRows = XLSX.utils.sheet_to_json(sheet) as Record<string, unknown>[];
    const rows = jsonData.slice(1);

    if (!headers || headers.length === 0) {
      return c.json({ error: "File has no headers in the first row" }, 400);
    }

    const mappedColumns: string[] = [];
    const unmappedColumns: string[] = [];
    const validationErrors: string[] = [];
    const validRows: Record<string, unknown>[] = [];

    headers.forEach(header => {
      if (fieldMapping[header]) {
        mappedColumns.push(header);
      } else {
        unmappedColumns.push(header);
      }
    });

    if (!settings.ignoreUnmatched && unmappedColumns.length > 0) {
        validationErrors.push(`Unmapped columns detected: ${unmappedColumns.join(', ')}`);
    }

    let processedRowCount = 0;
    let errorRowCount = 0;

    rows.forEach((row, rowIndex) => {
        const rowData: Record<string, unknown> = {};
        let rowHasError = false;

        headers.forEach((header, colIndex) => {
            const targetField = fieldMapping[header];
            const cellValue = row[colIndex];

            if (targetField) {
                rowData[targetField] = cellValue;
            }
        });

        if (rowHasError) {
            errorRowCount++;
        } else {
            validRows.push(rowData);
            processedRowCount++;
        }
    });

    if (settings.strictMode && (unmappedColumns.length > 0 && !settings.ignoreUnmatched)) {
         return c.json({ 
            success: false, 
            error: "Strict Mode Violation: Unmapped columns found.",
            preview: {
                totalRows: rows.length,
                mappedColumns,
                unmappedColumns,
                validationErrors
            }
        }, 400);
    }

    if (mode === 'preview') {
        return c.json({
            success: true,
            preview: {
                totalRows: rows.length,
                mappedColumns,
                unmappedColumns,
                validationErrors,
                sampleData: rawRows.slice(0, 5)
            }
        });
    }

    if (mode === 'commit') {
        const historyEntry: UploadHistory = {
            id: crypto.randomUUID(),
            providerId,
            categoryId,
            fileName: file.name,
            status: validationErrors.length > 0 && settings.strictMode ? 'failed' : 'success',
            rowCount: validRows.length,
            errorCount: errorRowCount + (validationErrors.length > 0 ? 1 : 0),
            uploadedAt: new Date().toISOString(),
            errors: validationErrors
        };

        const historyKey = `history:${providerId}:${categoryId}:${Date.now()}`;
        await kv.set(historyKey, historyEntry);

        return c.json({
            success: true,
            result: {
                insertedRows: validRows.length,
                historyId: historyEntry.id
            }
        });
    }

    return c.json({ error: "Invalid mode" }, 400);

  } catch (e) {
    log.error("Upload error:", e);
    return c.json({ error: "Internal server error during upload", details: getErrMsg(e) }, 500);
  }
});

// GET /history
app.get("/history", async (c) => {
    const providerId = c.req.query("providerId");
    const categoryId = c.req.query("categoryId");

    if (!providerId || !categoryId) {
        return c.json({ error: "Missing providerId or categoryId" }, 400);
    }

    try {
        const prefix = `history:${providerId}:${categoryId}`;
        const historyItems = await kv.getByPrefix(prefix);
        
        const sorted = ((historyItems || []) as UploadHistory[]).sort((a, b) => 
            new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime()
        );

        return c.json(sorted);
    } catch (e) {
        log.error("History fetch error:", e);
         return c.json([]);
    }
});

// GET /schemas
app.get("/schemas", async (c) => {
  const categoryId = c.req.query("categoryId");
  if (!categoryId) return c.json({ error: "Missing categoryId" }, 400);

  try {
    const key = `config:schema:${categoryId}`;
    let schema = await kv.get(key);
    
    if (!schema) {
      schema = DEFAULT_SCHEMAS[categoryId] || { fields: [] };
      log.info('Using default schema for category', { categoryId });
    }

    return c.json(schema || { fields: [] });
  } catch (e) {
    log.error("Error fetching schema, returning default:", e as Error, { categoryId });
    const defaultSchema = DEFAULT_SCHEMAS[categoryId] || { fields: [] };
    return c.json(defaultSchema);
  }
});

// GET /schemas/batch — returns all schemas in one call (defaults merged with custom overrides)
// Used by the client overview dashboard to avoid 13+ individual schema calls
app.get("/schemas/batch", async (c) => {
  try {
    // Fetch all custom schema overrides in one batch KV read
    const customSchemas = await kv.getByPrefix("config:schema:");
    const customMap: Record<string, unknown> = {};
    if (Array.isArray(customSchemas)) {
      for (const schema of customSchemas) {
        const s = schema as KvSchema;
        if (s?.categoryId && s?.fields) {
          customMap[s.categoryId] = s;
        }
      }
    }

    // Merge: custom overrides take precedence over defaults
    const allSchemas: Record<string, unknown> = {};
    for (const [catId, defaultSchema] of Object.entries(DEFAULT_SCHEMAS)) {
      allSchemas[catId] = customMap[catId] || defaultSchema;
    }
    // Include any custom schemas for categories not in defaults
    for (const [catId, schema] of Object.entries(customMap)) {
      if (!allSchemas[catId]) {
        allSchemas[catId] = schema;
      }
    }

    return c.json({ schemas: allSchemas });
  } catch (e) {
    log.error("Error fetching batch schemas, returning defaults:", e as Error);
    return c.json({ schemas: DEFAULT_SCHEMAS });
  }
});

// GET /custom-keys
app.get("/custom-keys", async (c) => {
  const categoryId = c.req.query("categoryId");
  
  if (!categoryId) {
    return c.json({ error: "Missing categoryId" }, 400);
  }
  
  try {
    const customKeysKey = `config:custom_keys:${categoryId}`;
    const customKeys = (await kv.get(customKeysKey)) || [];
    
    return c.json({ customKeys });
  } catch (e) {
    log.error("Error fetching custom keys:", e);
    return c.json({ customKeys: [] });
  }
});

// POST /schemas
app.post("/schemas", async (c) => {
  try {
    const body = await c.req.json();
    const parsed = SaveSchemaInputSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: "Validation failed", ...formatZodError(parsed.error) }, 400);
    }
    const { categoryId, fields } = parsed.data;

    const key = `config:schema:${categoryId}`;
    const schema = {
      categoryId,
      fields,
      updatedAt: new Date().toISOString()
    };

    await kv.set(key, schema);
    
    autoGenerateCustomKeysForSchema(categoryId, fields).catch((e) => {
      log.error("Background error generating custom keys:", e);
    });
    
    return c.json({ success: true, schema });

  } catch (e) {
    log.error("Error saving schema:", e);
    return c.json({ error: "Failed to save schema" }, 500);
  }
});

// --- POLICY MANAGEMENT ENDPOINTS ---

// GET /policies
app.get("/policies", async (c) => {
  try {
    const clientId = c.req.query("clientId");
    const categoryId = c.req.query("categoryId");
    const includeArchived = c.req.query("includeArchived") === 'true';

    if (!clientId) {
      return c.json({ error: "Missing clientId" }, 400);
    }

    const policiesKey = `policies:client:${clientId}`;
    let policies = (await kv.get(policiesKey)) || [];

    if (categoryId) {
      if (categoryId === 'retirement_planning') {
        policies = policies.filter((p: KvPolicy) => 
          p.categoryId === 'retirement_planning' || 
          p.categoryId === 'retirement_pre' || 
          p.categoryId === 'retirement_post'
        );
      } else if (categoryId === 'investments') {
        policies = policies.filter((p: KvPolicy) => 
          p.categoryId === 'investments' || 
          p.categoryId === 'investments_voluntary' || 
          p.categoryId === 'investments_guaranteed'
        );
      } else {
        policies = policies.filter((p: KvPolicy) => p.categoryId === categoryId);
      }
    }

    if (!includeArchived) {
      policies = policies.filter((p: KvPolicy) => !p.archived);
    } else {
      policies = policies.filter((p: KvPolicy) => p.archived);
    }

    return c.json({ policies });
  } catch (e) {
    log.error("Error fetching policies, returning empty array:", e as Error, { clientId: c.req.query("clientId"), categoryId: c.req.query("categoryId") });
    return c.json({ policies: [] });
  }
});

// POST /policies/archive
app.post("/policies/archive", async (c) => {
  try {
    const body = await c.req.json();
    const parsed = ArchivePolicySchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: "Validation failed", ...formatZodError(parsed.error) }, 400);
    }
    const { id, clientId, reason } = parsed.data;

    const policiesKey = `policies:client:${clientId}`;
    let policies = (await kv.get(policiesKey)) || [];

    const policyIndex = policies.findIndex((p: KvPolicy) => p.id === id);
    
    if (policyIndex === -1) {
      return c.json({ error: "Policy not found" }, 404);
    }

    policies[policyIndex] = {
      ...policies[policyIndex],
      archived: true,
      archivedReason: reason,
      archivedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await kv.set(policiesKey, policies);
    await recalculateClientTotals(clientId);

    return c.json({ success: true, policy: policies[policyIndex] });
  } catch (e) {
    log.error("Error archiving policy:", e);
    return c.json({ error: "Failed to archive policy" }, 500);
  }
});

// POST /policies/reinstate
app.post("/policies/reinstate", async (c) => {
  try {
    const body = await c.req.json();
    const parsed = ReinstatePolicySchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: "Validation failed", ...formatZodError(parsed.error) }, 400);
    }
    const { id, clientId } = parsed.data;

    const policiesKey = `policies:client:${clientId}`;
    let policies = (await kv.get(policiesKey)) || [];

    const policyIndex = policies.findIndex((p: KvPolicy) => p.id === id);
    
    if (policyIndex === -1) {
      return c.json({ error: "Policy not found" }, 404);
    }

    policies[policyIndex] = {
      ...policies[policyIndex],
      archived: false,
      archivedReason: undefined,
      archivedAt: undefined,
      updatedAt: new Date().toISOString(),
    };

    await kv.set(policiesKey, policies);
    await recalculateClientTotals(clientId);

    return c.json({ success: true, policy: policies[policyIndex] });
  } catch (e) {
    log.error("Error reinstating policy:", e);
    return c.json({ error: "Failed to reinstate policy" }, 500);
  }
});

// POST /policies
app.post("/policies", async (c) => {
  try {
    const body = await c.req.json();
    const parsed = CreatePolicySchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: "Validation failed", ...formatZodError(parsed.error) }, 400);
    }
    const { clientId, categoryId, providerId, providerName, data } = parsed.data;

    const provider = await kv.get(`provider:${providerId}`);
    if (!provider) {
        return c.json({ error: "Invalid provider ID" }, 400);
    }
    const safeProviderName = (provider as KvProvider).name || providerName;

    const policyId = `policy_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const policy = {
      id: policyId,
      clientId,
      categoryId,
      providerId,
      providerName: safeProviderName,
      data,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const policiesKey = `policies:client:${clientId}`;
    let policies = (await kv.get(policiesKey)) || [];
    
    policies.push(policy);
    
    await kv.set(policiesKey, policies);
    await recalculateClientTotals(clientId);

    return c.json({ success: true, policy });
  } catch (e) {
    log.error("Error creating policy:", e);
    return c.json({ error: "Failed to create policy" }, 500);
  }
});

// PUT /policies
app.put("/policies", async (c) => {
  try {
    const body = await c.req.json();
    const parsed = UpdatePolicySchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: "Validation failed", ...formatZodError(parsed.error) }, 400);
    }
    const { id, clientId, categoryId, providerId, providerName, data } = parsed.data;

    if (!id || !clientId) {
      return c.json({ error: "Missing policy id or clientId" }, 400);
    }

    const policiesKey = `policies:client:${clientId}`;
    let policies = (await kv.get(policiesKey)) || [];

    const policyIndex = policies.findIndex((p: KvPolicy) => p.id === id);
    
    if (policyIndex === -1) {
      return c.json({ error: "Policy not found" }, 404);
    }

    let newProviderName = providerName || policies[policyIndex].providerName;
    if (providerId && providerId !== policies[policyIndex].providerId) {
         const provider = await kv.get(`provider:${providerId}`);
         if (!provider) {
             return c.json({ error: "Invalid provider ID" }, 400);
         }
         newProviderName = (provider as KvProvider).name;
    }

    policies[policyIndex] = {
      ...policies[policyIndex],
      categoryId: categoryId || policies[policyIndex].categoryId,
      providerId: providerId || policies[policyIndex].providerId,
      providerName: newProviderName,
      data: data || policies[policyIndex].data,
      updatedAt: new Date().toISOString(),
    };

    await kv.set(policiesKey, policies);
    await recalculateClientTotals(clientId);

    return c.json({ success: true, policy: policies[policyIndex] });
  } catch (e) {
    log.error("Error updating policy:", e);
    return c.json({ error: "Failed to update policy" }, 500);
  }
});

// DELETE /policies
app.delete("/policies", async (c) => {
  try {
    const id = c.req.query("id");
    const clientId = c.req.query("clientId");

    if (!id || !clientId) {
      return c.json({ error: "Missing policy id or clientId" }, 400);
    }

    const policiesKey = `policies:client:${clientId}`;
    let policies = (await kv.get(policiesKey)) || [];

    // Find the policy to check for attached document before removing
    const policyToDelete = (policies as KvPolicy[]).find((p: KvPolicy) => p.id === id);

    const initialLength = policies.length;
    policies = policies.filter((p: KvPolicy) => p.id !== id);

    if (policies.length === initialLength) {
      return c.json({ error: "Policy not found" }, 404);
    }

    // Clean up attached document from storage if present
    if (policyToDelete?.document?.storageKey) {
      try {
        const supabase = createClient(
          Deno.env.get('SUPABASE_URL')!,
          Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
        );
        await supabase.storage
          .from(POLICY_DOC_BUCKET)
          .remove([policyToDelete.document.storageKey]);
        log.info('Deleted attached document during policy deletion', {
          policyId: id,
          storageKey: policyToDelete.document.storageKey,
        });
      } catch (docErr) {
        // Non-fatal: log and continue
        log.error('Failed to delete attached document during policy deletion (non-fatal):', docErr);
      }
    }

    await kv.set(policiesKey, policies);

    return c.json({ success: true });
  } catch (e) {
    log.error("Error deleting policy:", e);
    return c.json({ error: "Failed to delete policy" }, 500);
  }
});

// --- DASHBOARD STATS ENDPOINTS ---

// POST /recalculate-totals
app.post("/recalculate-totals", async (c) => {
  try {
    const body = await c.req.json();
    const parsed = RecalculateTotalsSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: "Validation failed", ...formatZodError(parsed.error) }, 400);
    }
    const { clientId } = parsed.data;

    await recalculateClientTotals(clientId);

    return c.json({ success: true, message: "Totals recalculated successfully" });
  } catch (e) {
    log.error("Error triggering recalculation:", e);
    return c.json({ error: "Failed to recalculate totals" }, 500);
  }
});

// GET /dashboard-stats
app.get("/dashboard-stats", async (c) => {
  try {
    const allPoliciesKeys = await getByPrefix("policies:client:");
    let totalActivePolicies = 0;
    let newPoliciesCount = 0;
    
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    for (const policies of allPoliciesKeys) {
      if (Array.isArray(policies)) {
        totalActivePolicies += policies.length;
        
        newPoliciesCount += policies.filter((p: KvPolicy) => {
           return p.createdAt && new Date(p.createdAt) >= startOfMonth;
        }).length;
      }
    }

    const riskFnaKeys = await getByPrefix("risk_planning_fna:client:");
    const medicalFnaKeys = await getByPrefix("medical_fna:client:");
    const retirementFnaKeys = await getByPrefix("retirement_fna:client:");
    const investmentInaKeys = await getByPrefix("investment_ina:client:");
    const taxPlanningKeys = await getByPrefix("tax_planning_fna:client:");
    const estatePlanningKeys = await getByPrefix("estate_planning_fna:client:");

    let publishedFnasCount = 0;

    const countPublished = (items: KvFnaEntry[]) => {
      if (!items || !Array.isArray(items)) return 0;
      return items.filter((item) => item?.status === 'published').length;
    };

    publishedFnasCount += countPublished(riskFnaKeys);
    publishedFnasCount += countPublished(medicalFnaKeys);
    publishedFnasCount += countPublished(retirementFnaKeys);
    publishedFnasCount += countPublished(investmentInaKeys);
    publishedFnasCount += countPublished(taxPlanningKeys);
    publishedFnasCount += countPublished(estatePlanningKeys);

    log.info('Dashboard stats calculated', {
      activePolicies: totalActivePolicies,
      newPoliciesCount,
      publishedFnas: publishedFnasCount
    });

    return c.json({
      activePolicies: totalActivePolicies,
      newPoliciesCount,
      publishedFnas: publishedFnasCount,
    });
  } catch (e) {
    log.error("Error fetching dashboard stats:", e);
    return c.json({
      activePolicies: 0,
      newPoliciesCount: 0,
      publishedFnas: 0,
    });
  }
});

// GET /policy-renewals
app.get("/policy-renewals", requireAuth, async (c) => {
  try {
    log.info('Fetching policy renewal data for calendar');
    
    const allPoliciesEntries = await getByPrefix("policies:client:");
    
    const customSchemas = await getByPrefix("config:schema:");
    const schemaMap: Record<string, SchemaField[]> = {};
    
    for (const schema of customSchemas) {
      const s = schema as KvSchema;
      if (s && s.categoryId && s.fields) {
        schemaMap[s.categoryId] = s.fields;
      }
    }
    
    for (const [catId, schema] of Object.entries(DEFAULT_SCHEMAS)) {
      if (!schemaMap[catId] && (schema as { fields?: SchemaField[] }).fields) {
        schemaMap[catId] = (schema as { fields: SchemaField[] }).fields;
      }
    }
    
    const inceptionFieldMap: Record<string, { fieldId: string; fieldName: string }[]> = {};
    for (const [catId, fields] of Object.entries(schemaMap)) {
      const inceptionFields: { fieldId: string; fieldName: string }[] = [];
      for (const field of fields) {
        const fieldType = (field.type || '').toLowerCase();
        const fieldName = (field.name || '').toLowerCase();
        
        if (
          fieldType === 'date_inception' ||
          fieldName.includes('inception') ||
          fieldName.includes('commencement') ||
          fieldName.includes('start date') ||
          (fieldName === 'anniversary date' && catId.includes('retirement'))
        ) {
          inceptionFields.push({ fieldId: field.id, fieldName: field.name });
        }
      }
      if (inceptionFields.length > 0) {
        inceptionFieldMap[catId] = inceptionFields;
      }
    }
    
    const renewals: PolicyRenewal[] = [];
    
    const categoryLabels: Record<string, string> = {
      risk_planning: 'Risk Planning',
      medical_aid: 'Medical Aid',
      retirement_planning: 'Retirement Planning',
      retirement_pre: 'Pre-Retirement',
      retirement_post: 'Post-Retirement',
      investments: 'Investments',
      investments_voluntary: 'Voluntary Investments',
      investments_guaranteed: 'Guaranteed Investments',
      employee_benefits: 'Employee Benefits',
      employee_benefits_risk: 'Employee Benefits (Risk)',
      employee_benefits_retirement: 'Employee Benefits (Retirement)',
      tax_planning: 'Tax Planning',
      estate_planning: 'Estate Planning',
    };
    
    for (const policies of allPoliciesEntries) {
      if (!Array.isArray(policies)) continue;
      
      for (const policy of policies) {
        if (!policy || !policy.data || policy.archived) continue;
        
        const catId = policy.categoryId;
        
        const fieldsToCheck = inceptionFieldMap[catId] || [];
        
        const schemaFields = schemaMap[catId] || [];
        
        let inceptionDate: string | null = null;
        let inceptionFieldName: string = 'Date of Inception';
        
        for (const { fieldId, fieldName } of fieldsToCheck) {
          const val = policy.data[fieldId];
          if (val && isValidDate(val)) {
            inceptionDate = val;
            inceptionFieldName = fieldName;
            break;
          }
        }
        
        if (!inceptionDate) {
          for (const field of schemaFields) {
            const fieldType = (field.type || '').toLowerCase();
            if (fieldType === 'date_inception') {
              const val = policy.data[field.id];
              if (val && isValidDate(val)) {
                inceptionDate = val;
                inceptionFieldName = field.name || 'Date of Inception';
                break;
              }
            }
          }
        }
        
        if (!inceptionDate) continue;
        
        let policyNumber = '';
        for (const field of schemaFields) {
          const fn = (field.name || '').toLowerCase();
          if (fn.includes('policy number') || fn.includes('policy no') || fn.includes('reference')) {
            policyNumber = policy.data[field.id] || '';
            if (policyNumber) break;
          }
        }
        
        renewals.push({
          clientId: policy.clientId,
          policyId: policy.id,
          providerName: policy.providerName || 'Unknown Provider',
          categoryId: catId,
          categoryLabel: categoryLabels[catId] || catId,
          policyNumber,
          inceptionDate,
          inceptionFieldName,
        });
      }
    }
    
    log.info(`Found ${renewals.length} policies with renewal dates`);
    return c.json({ renewals });
    
  } catch (e) {
    log.error("Error fetching policy renewals:", e);
    return c.json({ renewals: [] });
  }
});

// ============================================================================
// POLICY DOCUMENT ENDPOINTS
// ============================================================================

const POLICY_DOC_BUCKET = 'make-91ed8379-policy-documents';

// Lazy bucket initialization — called on first document request, not at module load time.
let policyDocBucketInitialized = false;

async function ensurePolicyDocBucket(): Promise<void> {
  if (policyDocBucketInitialized) return;
  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );
    const { data: buckets } = await supabase.storage.listBuckets();
    const bucketExists = buckets?.some(bucket => bucket.name === POLICY_DOC_BUCKET);

    if (!bucketExists) {
      log.info(`Creating policy document storage bucket: ${POLICY_DOC_BUCKET}`);
      const { error } = await supabase.storage.createBucket(POLICY_DOC_BUCKET, {
        public: false,
        fileSizeLimit: 20971520, // 20MB
        allowedMimeTypes: ['application/pdf'],
      });

      if (error) {
        if (error.message?.includes('already exists')) {
          log.info('Policy document bucket already exists');
        } else {
          log.error('Error creating policy document bucket:', error);
          return;
        }
      } else {
        log.info('Policy document bucket created successfully');
      }
    } else {
      log.info('Policy document bucket already exists');
    }
    policyDocBucketInitialized = true;
  } catch (error) {
    const errorMessage = getErrMsg(error);
    if (errorMessage.includes('already exists')) {
      policyDocBucketInitialized = true;
    } else {
      log.error('Error initializing policy document bucket (non-critical):', { error });
    }
  }
}

/**
 * POST /policy-documents/upload
 * Upload (or replace) a policy document for a specific policy line item.
 * Accepts multipart/form-data with fields: file, policyId, clientId, documentType, uploadedBy.
 */
app.post('/policy-documents/upload', requireAuth, async (c) => {
  try {
    await ensurePolicyDocBucket();

    let formData: Record<string, string | File>;
    try {
      formData = await c.req.parseBody();
    } catch (parseErr) {
      log.error('Failed to parse policy document upload form data:', parseErr);
      return c.json({
        error: 'Invalid form data. Ensure the request uses multipart/form-data encoding.',
      }, 400);
    }

    const file = formData['file'];
    if (!file || !(file instanceof File)) {
      return c.json({ error: 'No file provided' }, 400);
    }

    // Validate metadata
    const metadata = PolicyDocumentMetadataSchema.safeParse({
      policyId: formData['policyId'],
      clientId: formData['clientId'],
      documentType: formData['documentType'] || 'policy_schedule',
      uploadedBy: formData['uploadedBy'],
    });

    if (!metadata.success) {
      return c.json({ error: 'Validation failed', ...formatZodError(metadata.error) }, 400);
    }

    const { policyId, clientId, documentType, uploadedBy } = metadata.data;

    // Validate file type
    if (file.type !== 'application/pdf') {
      return c.json({ error: 'Only PDF files are accepted' }, 400);
    }

    // Validate file size (20MB)
    if (file.size > 20971520) {
      return c.json({ error: 'File exceeds maximum size of 20MB' }, 400);
    }

    // Load the policy to confirm it exists
    const policiesKey = `policies:client:${clientId}`;
    const policies = (await kv.get(policiesKey)) || [];
    const policyIndex = (policies as KvPolicy[]).findIndex((p: KvPolicy) => p.id === policyId);

    if (policyIndex === -1) {
      return c.json({ error: 'Policy not found' }, 404);
    }

    const policy = (policies as KvPolicy[])[policyIndex];

    // If there's an existing document, delete it from storage first (one-active-doc rule)
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    if (policy.document?.storageKey) {
      log.info('Replacing existing policy document', {
        policyId,
        oldStorageKey: policy.document.storageKey,
      });

      const { error: deleteError } = await supabase.storage
        .from(POLICY_DOC_BUCKET)
        .remove([policy.document.storageKey]);

      if (deleteError) {
        // Non-fatal — log and continue (the old file becomes orphaned but the new one still uploads)
        log.error('Failed to delete previous policy document (non-fatal):', deleteError);
      }
    }

    // Upload the new document
    const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const storageKey = `${clientId}/${policyId}/${Date.now()}_${sanitizedFileName}`;

    const fileBuffer = await file.arrayBuffer();
    const { error: uploadError } = await supabase.storage
      .from(POLICY_DOC_BUCKET)
      .upload(storageKey, fileBuffer, {
        contentType: 'application/pdf',
        upsert: false,
      });

    if (uploadError) {
      log.error('Policy document upload error:', uploadError);
      return c.json({ error: `Upload failed: ${uploadError.message}` }, 500);
    }

    // Build document metadata
    const categoryLabels: Record<string, string> = {
      risk_planning: 'Risk Planning',
      medical_aid: 'Medical Aid',
      retirement_planning: 'Retirement Planning',
      retirement_pre: 'Pre-Retirement',
      retirement_post: 'Post-Retirement',
      investments: 'Investments',
      investments_voluntary: 'Voluntary Investments',
      investments_guaranteed: 'Guaranteed Investments',
      employee_benefits: 'Employee Benefits',
      employee_benefits_risk: 'Employee Benefits (Risk)',
      employee_benefits_retirement: 'Employee Benefits (Retirement)',
      tax_planning: 'Tax Planning',
      estate_planning: 'Estate Planning',
    };

    const docMeta: PolicyDocument = {
      storageKey,
      fileName: file.name,
      fileSize: file.size,
      mimeType: 'application/pdf',
      provider: policy.providerName || '',
      productType: categoryLabels[policy.categoryId] || policy.categoryId,
      documentType,
      uploadDate: new Date().toISOString(),
      uploadedBy,
    };

    // Update the policy record with document metadata
    (policies as KvPolicy[])[policyIndex] = {
      ...policy,
      document: docMeta,
      updatedAt: new Date().toISOString(),
    };

    await kv.set(policiesKey, policies);

    log.info('Policy document uploaded successfully', { policyId, storageKey });

    return c.json({ success: true, document: docMeta });
  } catch (e) {
    log.error('Error uploading policy document:', e);
    return c.json({ error: `Failed to upload policy document: ${getErrMsg(e)}` }, 500);
  }
});

/**
 * GET /policy-documents/download
 * Returns a signed URL for downloading a policy document.
 * Query params: policyId, clientId
 */
app.get('/policy-documents/download', requireAuth, async (c) => {
  try {
    const policyId = c.req.query('policyId');
    const clientId = c.req.query('clientId');

    if (!policyId || !clientId) {
      return c.json({ error: 'Missing policyId or clientId' }, 400);
    }

    const policiesKey = `policies:client:${clientId}`;
    const policies = (await kv.get(policiesKey)) || [];
    const policy = (policies as KvPolicy[]).find((p: KvPolicy) => p.id === policyId);

    if (!policy) {
      return c.json({ error: 'Policy not found' }, 404);
    }

    if (!policy.document?.storageKey) {
      return c.json({ error: 'No document attached to this policy' }, 404);
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { data, error } = await supabase.storage
      .from(POLICY_DOC_BUCKET)
      .createSignedUrl(policy.document.storageKey, 3600); // 1 hour expiry

    if (error || !data?.signedUrl) {
      log.error('Failed to create signed URL for policy document:', error);
      return c.json({ error: 'Failed to generate download URL' }, 500);
    }

    return c.json({
      success: true,
      url: data.signedUrl,
      document: policy.document,
    });
  } catch (e) {
    log.error('Error generating policy document download URL:', e);
    return c.json({ error: `Failed to get document: ${getErrMsg(e)}` }, 500);
  }
});

/**
 * DELETE /policy-documents
 * Remove a policy document from storage and clear metadata from the policy record.
 * Body: { policyId, clientId }
 */
app.delete('/policy-documents', requireAuth, async (c) => {
  try {
    const body = await c.req.json();
    const parsed = DeletePolicyDocumentSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: 'Validation failed', ...formatZodError(parsed.error) }, 400);
    }

    const { policyId, clientId } = parsed.data;

    const policiesKey = `policies:client:${clientId}`;
    const policies = (await kv.get(policiesKey)) || [];
    const policyIndex = (policies as KvPolicy[]).findIndex((p: KvPolicy) => p.id === policyId);

    if (policyIndex === -1) {
      return c.json({ error: 'Policy not found' }, 404);
    }

    const policy = (policies as KvPolicy[])[policyIndex];

    if (!policy.document?.storageKey) {
      return c.json({ error: 'No document attached to this policy' }, 404);
    }

    // Delete from storage
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { error: deleteError } = await supabase.storage
      .from(POLICY_DOC_BUCKET)
      .remove([policy.document.storageKey]);

    if (deleteError) {
      log.error('Failed to delete policy document from storage:', deleteError);
      // Continue anyway — clear metadata even if storage delete fails
    }

    // Clear document metadata from the policy
    const { document: _removed, ...policyWithoutDoc } = policy;
    (policies as KvPolicy[])[policyIndex] = {
      ...policyWithoutDoc,
      updatedAt: new Date().toISOString(),
    } as KvPolicy;

    await kv.set(policiesKey, policies);

    log.info('Policy document removed', { policyId, clientId });

    return c.json({ success: true });
  } catch (e) {
    log.error('Error removing policy document:', e);
    return c.json({ error: `Failed to remove document: ${getErrMsg(e)}` }, 500);
  }
});

// ============================================================================
// POLICY EXTRACTION ENDPOINTS (Phase 2)
// ============================================================================

/**
 * POST /policy-extraction/extract
 * Trigger AI extraction on a policy's attached document.
 * Body: { policyId, clientId }
 */
app.post('/policy-extraction/extract', requireAuth, async (c) => {
  try {
    const body = await c.req.json();
    const { policyId, clientId } = body;

    if (!policyId || !clientId) {
      return c.json({ error: 'Missing policyId or clientId' }, 400);
    }

    const policiesKey = `policies:client:${clientId}`;
    const policies = (await kv.get(policiesKey)) || [];
    const policyIndex = (policies as KvPolicy[]).findIndex((p: KvPolicy) => p.id === policyId);

    if (policyIndex === -1) {
      return c.json({ error: 'Policy not found' }, 404);
    }

    const policy = (policies as KvPolicy[])[policyIndex];

    if (!policy.document?.storageKey) {
      return c.json({ error: 'No document attached to this policy. Upload a document first.' }, 400);
    }

    // Phase 3: Preserve previous extraction in history before overwriting
    const previousExtraction = policy.extraction;

    if (previousExtraction && (previousExtraction.status === 'completed' || previousExtraction.status === 'failed')) {
      // Pass the stored field mappings snapshot for comparison in history
      const previousFieldMappings = policy.lastFieldMappingsSnapshot
        ? policy.lastFieldMappingsSnapshot.map(s => ({
            canonicalKey: s.k, schemaFieldId: s.f, schemaFieldName: s.n, value: s.v, confidence: s.c,
          }))
        : undefined;

      const historyEntry = buildHistoryEntry(
        previousExtraction,
        previousExtraction.appliedFields?.length || 0,
        policy.document?.fileName,
        previousFieldMappings,
      );

      const existingHistory = policy.extractionHistory || [];
      // Keep last 10 history entries to prevent unbounded growth
      const trimmedHistory = [...existingHistory, historyEntry].slice(-10);

      (policies as KvPolicy[])[policyIndex] = {
        ...policy,
        extractionHistory: trimmedHistory,
      };
    }

    // Mark extraction as pending
    (policies as KvPolicy[])[policyIndex] = {
      ...(policies as KvPolicy[])[policyIndex],
      extraction: {
        extractedData: null,
        extractedAt: new Date().toISOString(),
        confidence: 0,
        status: 'pending',
        model: 'gpt-4o',
      },
      updatedAt: new Date().toISOString(),
    };
    await kv.set(policiesKey, policies);

    // Run the extraction (this can take 10-30 seconds)
    const { extraction, fieldMappings } = await extractPolicyDocument(policy);

    // Phase 3: Generate diff comparing new extraction against current policy data
    let diff: FieldDiff[] | undefined;
    if (extraction.status === 'completed') {
      const changedFields = fieldMappings.filter(m => {
        const current = policy.data?.[m.schemaFieldId];
        return current !== undefined && current !== null && current !== '' &&
          String(current) !== String(m.value);
      });

      if (changedFields.length > 0) {
        diff = changedFields.map(m => ({
          schemaFieldId: m.schemaFieldId,
          fieldName: m.schemaFieldName,
          oldValue: policy.data?.[m.schemaFieldId] ?? null,
          newValue: m.value,
          oldConfidence: 0,
          newConfidence: m.confidence,
          changed: true,
        }));
      }
    }

    // Save the extraction result and field mappings snapshot for future history comparison
    (policies as KvPolicy[])[policyIndex] = {
      ...(policies as KvPolicy[])[policyIndex],
      extraction,
      lastFieldMappingsSnapshot: fieldMappings.slice(0, 50).map(fm => ({
        k: fm.canonicalKey, f: fm.schemaFieldId, n: fm.schemaFieldName, v: fm.value, c: fm.confidence,
      })),
      updatedAt: new Date().toISOString(),
    };
    await kv.set(policiesKey, policies);

    return c.json({
      success: true,
      extraction,
      fieldMappings,
      diff: diff || [],
      historyCount: (policies as KvPolicy[])[policyIndex].extractionHistory?.length || 0,
    });
  } catch (e) {
    log.error('Error extracting policy data:', e);
    return c.json({ error: `Extraction failed: ${getErrMsg(e)}` }, 500);
  }
});

/**
 * GET /policy-extraction/result
 * Get the latest extraction result and field mappings for a policy.
 * Query params: policyId, clientId
 */
app.get('/policy-extraction/result', requireAuth, async (c) => {
  try {
    const policyId = c.req.query('policyId');
    const clientId = c.req.query('clientId');

    if (!policyId || !clientId) {
      return c.json({ error: 'Missing policyId or clientId' }, 400);
    }

    const policiesKey = `policies:client:${clientId}`;
    const policies = (await kv.get(policiesKey)) || [];
    const policy = (policies as KvPolicy[]).find((p: KvPolicy) => p.id === policyId);

    if (!policy) {
      return c.json({ error: 'Policy not found' }, 404);
    }

    if (!policy.extraction) {
      return c.json({ error: 'No extraction result available' }, 404);
    }

    return c.json({
      success: true,
      extraction: policy.extraction,
    });
  } catch (e) {
    log.error('Error fetching extraction result:', e);
    return c.json({ error: `Failed to get extraction result: ${getErrMsg(e)}` }, 500);
  }
});

/**
 * GET /policy-extraction/history
 * Get the extraction history for a policy.
 * Query params: policyId, clientId
 */
app.get('/policy-extraction/history', requireAuth, async (c) => {
  try {
    const policyId = c.req.query('policyId');
    const clientId = c.req.query('clientId');

    if (!policyId || !clientId) {
      return c.json({ error: 'Missing policyId or clientId' }, 400);
    }

    const policiesKey = `policies:client:${clientId}`;
    const policies = (await kv.get(policiesKey)) || [];
    const policy = (policies as KvPolicy[]).find((p: KvPolicy) => p.id === policyId);

    if (!policy) {
      return c.json({ error: 'Policy not found' }, 404);
    }

    return c.json({
      success: true,
      history: policy.extractionHistory || [],
      currentExtraction: policy.extraction || null,
    });
  } catch (e) {
    log.error('Error fetching extraction history:', e);
    return c.json({ error: `Failed to get extraction history: ${getErrMsg(e)}` }, 500);
  }
});

/**
 * GET /policy-extraction/compare
 * Compare two extraction history entries side-by-side.
 * Query params: policyId, clientId, leftId, rightId
 * Returns: { fields: ComparisonField[] }
 *
 * If rightId is 'current', compares against the live extraction.
 */
app.get('/policy-extraction/compare', requireAuth, async (c) => {
  try {
    const policyId = c.req.query('policyId');
    const clientId = c.req.query('clientId');
    const leftId = c.req.query('leftId');
    const rightId = c.req.query('rightId');

    if (!policyId || !clientId || !leftId || !rightId) {
      return c.json({ error: 'Missing policyId, clientId, leftId, or rightId' }, 400);
    }

    const policiesKey = `policies:client:${clientId}`;
    const policies = (await kv.get(policiesKey)) || [];
    const policy = (policies as KvPolicy[]).find((p: KvPolicy) => p.id === policyId);

    if (!policy) {
      return c.json({ error: 'Policy not found' }, 404);
    }

    const history = policy.extractionHistory || [];

    // Resolve left entry
    const leftEntry = history.find(h => h.id === leftId);
    if (!leftEntry) {
      return c.json({ error: `Left entry '${leftId}' not found in history` }, 404);
    }

    // Resolve right entry — 'current' means the live extraction's stored snapshot
    let rightSnapshot: Array<{ k: string; f: string; n: string; v: unknown; c: number }> | undefined;
    let rightMeta: { confidence: number; extractedAt: string } | undefined;

    if (rightId === 'current') {
      rightSnapshot = policy.lastFieldMappingsSnapshot;
      rightMeta = policy.extraction
        ? { confidence: policy.extraction.confidence, extractedAt: policy.extraction.extractedAt }
        : undefined;
    } else {
      const rightEntry = history.find(h => h.id === rightId);
      if (!rightEntry) {
        return c.json({ error: `Right entry '${rightId}' not found in history` }, 404);
      }
      rightSnapshot = rightEntry.fieldMappingsSnapshot;
      rightMeta = { confidence: rightEntry.confidence, extractedAt: rightEntry.extractedAt };
    }

    const leftSnapshot = leftEntry.fieldMappingsSnapshot;

    // Build comparison fields
    if (!leftSnapshot && !rightSnapshot) {
      return c.json({
        success: true,
        fields: [],
        message: 'Neither entry has field mapping snapshots. Comparison data is unavailable for extractions before snapshot storage was enabled.',
      });
    }

    const leftMap = new Map((leftSnapshot || []).map(s => [s.f, s]));
    const rightMap = new Map((rightSnapshot || []).map(s => [s.f, s]));
    const allFieldIds = new Set([...leftMap.keys(), ...rightMap.keys()]);

    const fields: Array<{
      fieldName: string;
      schemaFieldId: string;
      leftValue: unknown;
      rightValue: unknown;
      leftConfidence: number;
      rightConfidence: number;
      changed: boolean;
      confidenceDelta: number;
    }> = [];

    for (const fieldId of allFieldIds) {
      const left = leftMap.get(fieldId);
      const right = rightMap.get(fieldId);

      const leftVal = left?.v ?? null;
      const rightVal = right?.v ?? null;
      const leftConf = left?.c ?? 0;
      const rightConf = right?.c ?? 0;

      fields.push({
        fieldName: right?.n || left?.n || fieldId,
        schemaFieldId: fieldId,
        leftValue: leftVal,
        rightValue: rightVal,
        leftConfidence: leftConf,
        rightConfidence: rightConf,
        changed: String(leftVal) !== String(rightVal),
        confidenceDelta: rightConf - leftConf,
      });
    }

    // Sort: changed first, then by name
    fields.sort((a, b) => {
      if (a.changed !== b.changed) return a.changed ? -1 : 1;
      return a.fieldName.localeCompare(b.fieldName);
    });

    return c.json({
      success: true,
      fields,
      leftMeta: { confidence: leftEntry.confidence, extractedAt: leftEntry.extractedAt },
      rightMeta,
    });
  } catch (e) {
    log.error('Error comparing extractions:', e);
    return c.json({ error: `Comparison failed: ${getErrMsg(e)}` }, 500);
  }
});

/**
 * POST /policy-extraction/apply
 * Apply selected extracted fields to the policy's data.
 * Body: { policyId, clientId, fieldsToApply: { schemaFieldId: value }[] }
 */
app.post('/policy-extraction/apply', requireAuth, async (c) => {
  try {
    const body = await c.req.json();
    const { policyId, clientId, fieldsToApply } = body;

    if (!policyId || !clientId || !fieldsToApply || typeof fieldsToApply !== 'object') {
      return c.json({ error: 'Missing policyId, clientId, or fieldsToApply' }, 400);
    }

    const policiesKey = `policies:client:${clientId}`;
    const policies = (await kv.get(policiesKey)) || [];
    const policyIndex = (policies as KvPolicy[]).findIndex((p: KvPolicy) => p.id === policyId);

    if (policyIndex === -1) {
      return c.json({ error: 'Policy not found' }, 404);
    }

    const policy = (policies as KvPolicy[])[policyIndex];

    // Merge extracted fields into the policy data (skip locked fields)
    const updatedData = { ...policy.data };
    const appliedFieldIds: string[] = [];
    const skippedLockedIds: string[] = [];
    const lockedSet = new Set(policy.lockedFields || []);

    for (const [fieldId, value] of Object.entries(fieldsToApply)) {
      if (lockedSet.has(fieldId)) {
        skippedLockedIds.push(fieldId);
        continue;
      }
      updatedData[fieldId] = value;
      appliedFieldIds.push(fieldId);
    }

    // Update the policy with the new data and mark extraction as applied
    (policies as KvPolicy[])[policyIndex] = {
      ...policy,
      data: updatedData,
      extraction: policy.extraction ? {
        ...policy.extraction,
        appliedAt: new Date().toISOString(),
        appliedFields: appliedFieldIds,
      } : undefined,
      updatedAt: new Date().toISOString(),
    };

    await kv.set(policiesKey, policies);
    await recalculateClientTotals(clientId);

    log.info('Extracted data applied to policy', {
      policyId,
      fieldsApplied: appliedFieldIds.length,
    });

    return c.json({
      success: true,
      appliedFields: appliedFieldIds,
      skippedLockedFields: skippedLockedIds,
      policy: (policies as KvPolicy[])[policyIndex],
    });
  } catch (e) {
    log.error('Error applying extracted data:', e);
    return c.json({ error: `Failed to apply extracted data: ${getErrMsg(e)}` }, 500);
  }
});

/**
 * POST /policy-extraction/lock-fields
 * Lock or unlock schema fields to protect them from AI extraction overwrite.
 * Body: { policyId, clientId, fieldIds: string[], action: 'lock' | 'unlock' }
 */
app.post('/policy-extraction/lock-fields', requireAuth, async (c) => {
  try {
    const body = await c.req.json();
    const { policyId, clientId, fieldIds, action } = body;

    if (!policyId || !clientId || !Array.isArray(fieldIds) || !['lock', 'unlock'].includes(action)) {
      return c.json({ error: 'Missing or invalid policyId, clientId, fieldIds (array), or action (lock|unlock)' }, 400);
    }

    const policiesKey = `policies:client:${clientId}`;
    const policies = (await kv.get(policiesKey)) || [];
    const policyIndex = (policies as KvPolicy[]).findIndex((p: KvPolicy) => p.id === policyId);

    if (policyIndex === -1) {
      return c.json({ error: 'Policy not found' }, 404);
    }

    const policy = (policies as KvPolicy[])[policyIndex];
    const currentLocked = new Set(policy.lockedFields || []);

    if (action === 'lock') {
      for (const fid of fieldIds) currentLocked.add(fid);
    } else {
      for (const fid of fieldIds) currentLocked.delete(fid);
    }

    const updatedLockedFields = Array.from(currentLocked);

    (policies as KvPolicy[])[policyIndex] = {
      ...policy,
      lockedFields: updatedLockedFields,
      updatedAt: new Date().toISOString(),
    };

    await kv.set(policiesKey, policies);

    log.info('Policy field locks updated', {
      policyId,
      action,
      fieldIds,
      totalLocked: updatedLockedFields.length,
    });

    return c.json({
      success: true,
      lockedFields: updatedLockedFields,
    });
  } catch (e) {
    log.error('Error updating field locks:', e);
    return c.json({ error: `Failed to update field locks: ${getErrMsg(e)}` }, 500);
  }
});

// ============================================================================
// PROVIDER TERMINOLOGY ENDPOINTS (Phase 2)
// ============================================================================

/**
 * GET /provider-terminology
 * Get terminology mapping for a specific provider, or all provider mappings.
 * Query params: providerId (optional — if omitted, returns all)
 */
app.get('/provider-terminology', requireAuth, async (c) => {
  try {
    const providerId = c.req.query('providerId');

    if (providerId) {
      const map = await getProviderTerminology(providerId);
      return c.json({ success: true, terminology: map });
    }

    const all = await getAllProviderTerminologies();
    return c.json({ success: true, terminologies: all });
  } catch (e) {
    log.error('Error fetching provider terminology:', e);
    return c.json({ error: `Failed to get terminology: ${getErrMsg(e)}` }, 500);
  }
});

/**
 * POST /provider-terminology
 * Save or update a provider's terminology mapping.
 * Body: ProviderTerminologyMap
 */
app.post('/provider-terminology', requireAuth, async (c) => {
  try {
    const body = await c.req.json();

    if (!body.providerId || !body.providerName) {
      return c.json({ error: 'Missing providerId or providerName' }, 400);
    }

    const map: ProviderTerminologyMap = {
      providerId: body.providerId,
      providerName: body.providerName,
      benefitMappings: body.benefitMappings || {},
      productMappings: body.productMappings || {},
      updatedAt: new Date().toISOString(),
      updatedBy: body.updatedBy || 'admin',
    };

    await saveProviderTerminology(map);

    return c.json({ success: true, terminology: map });
  } catch (e) {
    log.error('Error saving provider terminology:', e);
    return c.json({ error: `Failed to save terminology: ${getErrMsg(e)}` }, 500);
  }
});

// ============================================================================
// EXTRACTION QUALITY STATS ENDPOINT
// ============================================================================

/**
 * GET /policy-extraction/quality-stats
 * Aggregated extraction quality metrics across all policies.
 * Returns: per-provider stats, overall stats, low-confidence field frequency,
 *          and extraction timeline data.
 */
app.get('/policy-extraction/quality-stats', requireAuth, async (c) => {
  try {
    // Fetch all client policy keys
    const allPolicyEntries = await kv.getByPrefix('policies:client:');

    interface ProviderStats {
      providerId: string;
      providerName: string;
      totalPolicies: number;
      withDocuments: number;
      withExtractions: number;
      completedExtractions: number;
      failedExtractions: number;
      avgConfidence: number;
      confidenceSum: number;
      totalFieldsMapped: number;
      totalWarnings: number;
      lockedFieldCount: number;
    }

    const providerMap = new Map<string, ProviderStats>();
    const fieldConfidenceMap = new Map<string, { fieldName: string; totalConfidence: number; count: number; lowCount: number }>();
    const timelineEntries: Array<{ date: string; confidence: number; provider: string; status: string }> = [];
    let totalPolicies = 0;
    let totalWithDocs = 0;
    let totalWithExtractions = 0;
    let totalCompleted = 0;
    let totalFailed = 0;
    let totalLockedFields = 0;
    let overallConfidenceSum = 0;

    for (const entry of allPolicyEntries) {
      const policies = (Array.isArray(entry) ? entry : []) as KvPolicy[];
      for (const policy of policies) {
        if (policy.archived) continue;
        totalPolicies++;

        // Get or create provider stats
        let pStats = providerMap.get(policy.providerId);
        if (!pStats) {
          pStats = {
            providerId: policy.providerId,
            providerName: policy.providerName,
            totalPolicies: 0,
            withDocuments: 0,
            withExtractions: 0,
            completedExtractions: 0,
            failedExtractions: 0,
            avgConfidence: 0,
            confidenceSum: 0,
            totalFieldsMapped: 0,
            totalWarnings: 0,
            lockedFieldCount: 0,
          };
          providerMap.set(policy.providerId, pStats);
        }
        pStats.totalPolicies++;

        if (policy.document) {
          totalWithDocs++;
          pStats.withDocuments++;
        }

        if (policy.lockedFields?.length) {
          totalLockedFields += policy.lockedFields.length;
          pStats.lockedFieldCount += policy.lockedFields.length;
        }

        if (policy.extraction) {
          totalWithExtractions++;
          pStats.withExtractions++;

          if (policy.extraction.status === 'completed') {
            totalCompleted++;
            pStats.completedExtractions++;
            pStats.confidenceSum += policy.extraction.confidence;
            overallConfidenceSum += policy.extraction.confidence;
            pStats.totalWarnings += policy.extraction.validationWarnings?.length || 0;

            // Timeline entry
            timelineEntries.push({
              date: policy.extraction.extractedAt,
              confidence: policy.extraction.confidence,
              provider: policy.providerName,
              status: 'completed',
            });

            // Field-level confidence tracking from snapshot
            if (policy.lastFieldMappingsSnapshot) {
              pStats.totalFieldsMapped += policy.lastFieldMappingsSnapshot.length;
              for (const fm of policy.lastFieldMappingsSnapshot) {
                let fStats = fieldConfidenceMap.get(fm.f);
                if (!fStats) {
                  fStats = { fieldName: fm.n, totalConfidence: 0, count: 0, lowCount: 0 };
                  fieldConfidenceMap.set(fm.f, fStats);
                }
                fStats.totalConfidence += fm.c;
                fStats.count++;
                if (fm.c < 0.5) fStats.lowCount++;
              }
            }
          } else if (policy.extraction.status === 'failed') {
            totalFailed++;
            pStats.failedExtractions++;

            timelineEntries.push({
              date: policy.extraction.extractedAt,
              confidence: 0,
              provider: policy.providerName,
              status: 'failed',
            });
          }
        }
      }
    }

    // Compute averages
    const providerStats = Array.from(providerMap.values()).map(ps => ({
      ...ps,
      avgConfidence: ps.completedExtractions > 0
        ? Math.round((ps.confidenceSum / ps.completedExtractions) * 100) / 100
        : 0,
      successRate: ps.withExtractions > 0
        ? Math.round(((ps.completedExtractions / ps.withExtractions) * 100) * 10) / 10
        : 0,
    }));

    // Sort providers by extraction count descending
    providerStats.sort((a, b) => b.withExtractions - a.withExtractions);

    // Low-confidence fields (fields that frequently have confidence < 0.5)
    const lowConfidenceFields = Array.from(fieldConfidenceMap.entries())
      .map(([fieldId, s]) => ({
        fieldId,
        fieldName: s.fieldName,
        avgConfidence: Math.round((s.totalConfidence / s.count) * 100) / 100,
        occurrences: s.count,
        lowConfidenceCount: s.lowCount,
        lowConfidenceRate: Math.round((s.lowCount / s.count) * 100),
      }))
      .filter(f => f.lowConfidenceCount > 0)
      .sort((a, b) => b.lowConfidenceRate - a.lowConfidenceRate)
      .slice(0, 15);

    // Sort timeline chronologically and limit
    timelineEntries.sort((a, b) => a.date.localeCompare(b.date));

    return c.json({
      success: true,
      overview: {
        totalPolicies,
        totalWithDocuments: totalWithDocs,
        totalExtractions: totalWithExtractions,
        completedExtractions: totalCompleted,
        failedExtractions: totalFailed,
        avgConfidence: totalCompleted > 0
          ? Math.round((overallConfidenceSum / totalCompleted) * 100) / 100
          : 0,
        successRate: totalWithExtractions > 0
          ? Math.round(((totalCompleted / totalWithExtractions) * 100) * 10) / 10
          : 0,
        totalLockedFields,
      },
      providerStats,
      lowConfidenceFields,
      timeline: timelineEntries.slice(-50),
    });
  } catch (e) {
    log.error('Error computing extraction quality stats:', e);
    return c.json({ error: `Failed to compute quality stats: ${getErrMsg(e)}` }, 500);
  }
});

// ============================================================================
// BULK RE-EXTRACTION ENDPOINT (Phase 3)
// ============================================================================

/**
 * POST /policy-extraction/bulk-reextract
 * Find all policies for a given provider that have documents attached
 * and queue them for re-extraction. Supports dry-run mode (default: true).
 * Body: { providerId, dryRun?: boolean }
 */
app.post('/policy-extraction/bulk-reextract', requireAuth, async (c) => {
  try {
    const body = await c.req.json();
    const { providerId, dryRun = true } = body;

    if (!providerId) {
      return c.json({ error: 'Missing providerId' }, 400);
    }

    // Scan all client policy keys to find policies with this provider
    const allClientEntries = await kv.getByPrefix('policies:client:');
    const candidates: Array<{
      clientId: string;
      policyId: string;
      providerName: string;
      fileName: string;
      hasExistingExtraction: boolean;
    }> = [];

    for (const entry of allClientEntries || []) {
      // getByPrefix returns raw values — each is the array of KvPolicy[]
      const policies = (Array.isArray(entry) ? entry : []) as KvPolicy[];

      for (const policy of policies) {
        if (
          policy.providerId === providerId &&
          policy.document?.storageKey &&
          !policy.archived
        ) {
          candidates.push({
            clientId: policy.clientId,
            policyId: policy.id,
            providerName: policy.providerName,
            fileName: policy.document.fileName,
            hasExistingExtraction: !!policy.extraction?.extractedData,
          });
        }
      }
    }

    if (dryRun) {
      return c.json({
        success: true,
        dryRun: true,
        candidateCount: candidates.length,
        candidates: candidates.map(cand => ({
          policyId: cand.policyId,
          fileName: cand.fileName,
          hasExistingExtraction: cand.hasExistingExtraction,
        })),
        message: `Found ${candidates.length} policies with documents for this provider. Set dryRun: false to execute.`,
      });
    }

    // Live run — stream NDJSON progress events as each policy is processed
    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        const send = (data: Record<string, unknown>) => {
          controller.enqueue(encoder.encode(JSON.stringify(data) + '\n'));
        };

        let successCount = 0;
        let failCount = 0;
        const total = candidates.length;

        send({ type: 'start', total, providerId });

        for (let i = 0; i < candidates.length; i++) {
          const cand = candidates[i];
          send({
            type: 'progress',
            current: i + 1,
            total,
            policyId: cand.policyId,
            fileName: cand.fileName,
            status: 'processing',
          });

          try {
            const policiesKey = `policies:client:${cand.clientId}`;
            const policies = ((await kv.get(policiesKey)) || []) as KvPolicy[];
            const policyIndex = policies.findIndex(p => p.id === cand.policyId);

            if (policyIndex === -1) {
              send({
                type: 'result',
                current: i + 1,
                total,
                policyId: cand.policyId,
                fileName: cand.fileName,
                status: 'skipped',
                error: 'Policy not found',
              });
              continue;
            }

            const policy = policies[policyIndex];

            // Preserve previous extraction in history with field mappings snapshot
            if (policy.extraction && (policy.extraction.status === 'completed' || policy.extraction.status === 'failed')) {
              const prevFM = policy.lastFieldMappingsSnapshot
                ? policy.lastFieldMappingsSnapshot.map(s => ({
                    canonicalKey: s.k, schemaFieldId: s.f, schemaFieldName: s.n, value: s.v, confidence: s.c,
                  }))
                : undefined;

              const historyEntry = buildHistoryEntry(
                policy.extraction,
                policy.extraction.appliedFields?.length || 0,
                policy.document?.fileName,
                prevFM,
              );
              const existingHistory = policy.extractionHistory || [];
              policies[policyIndex] = {
                ...policy,
                extractionHistory: [...existingHistory, historyEntry].slice(-10),
              };
            }

            const { extraction, fieldMappings: newFM } = await extractPolicyDocument(policy);

            policies[policyIndex] = {
              ...policies[policyIndex],
              extraction,
              lastFieldMappingsSnapshot: newFM.slice(0, 50).map(fm => ({
                k: fm.canonicalKey, f: fm.schemaFieldId, n: fm.schemaFieldName, v: fm.value, c: fm.confidence,
              })),
              updatedAt: new Date().toISOString(),
            };
            await kv.set(policiesKey, policies);

            successCount++;
            send({
              type: 'result',
              current: i + 1,
              total,
              policyId: cand.policyId,
              fileName: cand.fileName,
              status: extraction.status,
              confidence: extraction.confidence,
            });
          } catch (err) {
            failCount++;
            send({
              type: 'result',
              current: i + 1,
              total,
              policyId: cand.policyId,
              fileName: cand.fileName,
              status: 'failed',
              error: getErrMsg(err),
            });
          }
        }

        log.info('Bulk re-extraction complete', {
          providerId,
          total,
          success: successCount,
          failed: failCount,
        });

        send({
          type: 'complete',
          totalProcessed: total,
          successCount,
          failCount,
        });

        controller.close();
      },
    });

    return new Response(stream, {
      status: 200,
      headers: {
        'Content-Type': 'application/x-ndjson',
        'Transfer-Encoding': 'chunked',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'no-cache',
      },
    });
  } catch (e) {
    log.error('Bulk re-extraction error:', e);
    return c.json({ error: `Bulk re-extraction failed: ${getErrMsg(e)}` }, 500);
  }
});

export default app;

// Helper function to recalculate client totals
async function recalculateClientTotals(clientId: string) {
  try {
    log.info('Recalculating client totals', { clientId });
    
    const policiesKey = `policies:client:${clientId}`; 
    const allPolicies = (await kv.get(policiesKey)) || [];
    
    log.info(`Found ${allPolicies.length} total policies for client`, { clientId });
    
    const totals: Record<string, number> = {};
    
    const totalKeyMappings: Record<string, string[]> = {
      risk_life_cover_total: ['risk_life_cover'],
      risk_severe_illness_total: ['risk_severe_illness'],
      risk_disability_total: ['risk_disability'],
      risk_temporary_icb_total: ['risk_temporary_icb'],
      risk_permanent_icb_total: ['risk_permanent_icb'],
      risk_total_premium: ['risk_monthly_premium'],
      medical_aid_total_premium: ['medical_aid_monthly_premium'],
      retirement_total_contribution: ['retirement_monthly_contribution'],
      retirement_fund_value_total: ['retirement_fund_value'],
      post_retirement_capital_total: ['post_retirement_capital_value'],
      post_retirement_income_total: ['post_retirement_drawdown_amount'],
      invest_total_contribution: ['invest_monthly_contribution'],
      eb_total_premium: ['eb_monthly_premium', 'eb_risk_monthly_premium', 'eb_retirement_contribution_employee', 'eb_retirement_contribution_employer'],
      estate_total_annual_fee: ['estate_annual_fee'],
      tax_total_annual_fee: ['tax_annual_fee'],
    };
    
    const totalKeyToCategoryIds: Record<string, string[]> = {
      risk_life_cover_total:         ['risk_planning'],
      risk_severe_illness_total:     ['risk_planning'],
      risk_disability_total:         ['risk_planning'],
      risk_temporary_icb_total:      ['risk_planning'],
      risk_permanent_icb_total:      ['risk_planning'],
      risk_total_premium:            ['risk_planning'],
      medical_aid_total_premium:     ['medical_aid'],
      retirement_total_contribution: ['retirement_planning', 'retirement_pre'],
      retirement_fund_value_total:   ['retirement_planning', 'retirement_pre'],
      post_retirement_capital_total: ['retirement_post'],
      post_retirement_income_total:  ['retirement_post'],
      invest_total_contribution:     ['investments', 'investments_voluntary', 'investments_guaranteed'],
      eb_total_premium:              ['employee_benefits', 'employee_benefits_risk', 'employee_benefits_retirement'],
      estate_total_annual_fee:       ['estate_planning'],
      tax_total_annual_fee:          ['tax_planning'],
    };
    
    for (const [totalKey, individualKeys] of Object.entries(totalKeyMappings)) {
      let total = 0;
      
      const categoryIds = totalKeyToCategoryIds[totalKey] || [];
      
      const categoryPolicies = allPolicies.filter((p: KvPolicy) => categoryIds.includes(p.categoryId) && !p.archived);
      
      for (const policy of categoryPolicies) {
        if (!policy.data) continue;
        
        const schemaKey = `config:schema:${policy.categoryId}`;
        let schema = await kv.get(schemaKey);
        
        if (!schema) {
          schema = DEFAULT_SCHEMAS[policy.categoryId];
        }
        
        const schemaRecord = schema as KvSchema | null;
        if (!schemaRecord?.fields) continue;
        
        const fields = schemaRecord.fields;
        
        for (const [fieldId, value] of Object.entries(policy.data)) {
          const fieldDef = fields.find((f: SchemaField) => f.id === fieldId);
          
          if (!fieldDef || !fieldDef.keyId) continue;
          
          if (individualKeys.includes(fieldDef.keyId)) {
            const numValue = Number(value) || 0;
            if (numValue > 0) {
              total += numValue;
            }
          }
        }
      }
      
      totals[totalKey] = total;
    }
    
    const clientKeysKey = `user_profile:${clientId}:client_keys`;
    await kv.set(clientKeysKey, totals);
    
    log.info('Client key totals saved to ' + clientKeysKey, { totals });
  } catch (e) {
    log.error('Error recalculating client totals:', e);
  }
}

// Helper function to auto-generate custom keys for unmapped fields in a schema
async function autoGenerateCustomKeysForSchema(categoryId: string, fields: SchemaField[]) {
  try {
    log.info('Auto-generating custom keys for unmapped fields', { categoryId, fieldCount: fields.length });
    
    const customKeysKey = `config:custom_keys:${categoryId}`;
    const existingCustomKeys = (await kv.get(customKeysKey)) || [];
    
    const categoryMap: Record<string, string> = {
      'risk_planning': 'risk',
      'medical_aid': 'medical_aid',
      'retirement_planning': 'retirement',
      'investments': 'invest',
      'employee_benefits': 'employee_benefits',
      'estate_planning': 'estate_planning',
      'tax_planning': 'tax',
    };
    
    const keyCategory = categoryMap[categoryId];
    if (!keyCategory) return;
    
    const newCustomKeys: CustomKey[] = [];
    let keysAdded = 0;
    
    for (const field of fields) {
      if (!field.name || field.name.trim() === '') continue;
      
      if (!field.keyId || field.keyId === '') {
        const sanitizedName = field.name
          .toLowerCase()
          .replace(/[^a-z0-9\s]/g, '')
          .replace(/\s+/g, '_')
          .substring(0, 50);
        
        const customKeyId = `custom_${keyCategory}_${sanitizedName}`;
        
        const keyExists = (existingCustomKeys as CustomKey[]).some((k) => k.id === customKeyId);
        
        if (!keyExists) {
          const newKey = {
            id: customKeyId,
            category: keyCategory,
            name: field.name,
            description: `Custom key for ${field.name} (auto-generated from product structure)`,
            dataType: field.type === 'currency' ? 'currency' : 
                      field.type === 'number' ? 'number' :
                      field.type === 'date' ? 'date' : 'text',
            isCalculated: false,
            isCustom: true,
            createdAt: new Date().toISOString(),
            sourceField: field.id
          };
          
          newCustomKeys.push(newKey);
          keysAdded++;
        }
      }
    }
    
    if (newCustomKeys.length > 0) {
      const updatedCustomKeys = [...existingCustomKeys, ...newCustomKeys];
      await kv.set(customKeysKey, updatedCustomKeys);
      log.info(`Added ${keysAdded} new custom keys to ${customKeysKey}`);
    }
    
  } catch (e) {
    log.error('Error auto-generating custom keys:', e);
  }
}

// Helper function to check if a string is a valid date
function isValidDate(dateString: string): boolean {
  const date = new Date(dateString);
  return !isNaN(date.getTime());
}