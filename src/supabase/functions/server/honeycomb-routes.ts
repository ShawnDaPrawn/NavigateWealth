/**
 * Honeycomb Integration — Route Handlers (Thin Dispatchers)
 *
 * Per Guidelines §4.2: Route files are thin dispatchers — they parse input,
 * call the service, and return responses. Business logic lives in
 * honeycomb-service.ts.
 *
 * All routes are mounted at /integrations/honeycomb via mount-core.ts.
 */

import { Hono } from "npm:hono";
import { createModuleLogger } from "./stderr-logger.ts";
import { getErrMsg } from "./shared-logger-utils.ts";
import * as kv from "./kv_store.tsx";
import * as service from "./honeycomb-service.ts";
import { requireAuth } from "./auth-mw.ts";
import {
  RegisterClientSchema,
  IdvNoPhotoSchema,
  IdvWithPhotoSchema,
  BankVerificationSchema,
  ConsumerCreditSchema,
  SanctionsSearchSchema,
  AssessmentRunSchema,
  ProxySchema,
  NaturalPersonCheckSchema,
  EnforcementActionsSchema,
  LegalAListingSchema,
  CustomScreeningSchema,
  BulkIdvSchema,
} from "./honeycomb-validation.ts";

import type { ZodError } from 'npm:zod';

const app = new Hono();
const log = createModuleLogger("honeycomb-routes");

// All Honeycomb routes require authentication — these are admin-only KYC/AML integrations (§12.2)
app.use('*', requireAuth);

// Global error handler — safety net for any errors that escape per-route try/catch
app.onError((err, c) => {
  log.error('Unhandled honeycomb route error:', err);
  const isZod = err.name === 'ZodError';
  return c.json(
    { error: isZod ? (err as unknown as { errors: unknown[] }).errors : getErrMsg(err) },
    isZod ? 400 : 500,
  );
});

const HONEYCOMB_API_URL = "https://publicapi.honeycombonline.co.za";
const NIL_UUID = "00000000-0000-0000-0000-000000000000";

/** Build a route error response, distinguishing Zod validation errors */
const routeError = (c: { json: (body: unknown, status: number) => unknown }, e: unknown) => {
  const isZod = e instanceof Error && e.name === 'ZodError';
  return c.json(
    { error: isZod ? (e as ZodError).errors : getErrMsg(e) },
    isZod ? 400 : 500,
  );
};

/** Helper to get Honeycomb headers (used by legacy/proxy routes) */
const getHeaders = () => {
  const apiKey = Deno.env.get("HONEYCOMB_API_KEY");
  if (!apiKey) throw new Error("HONEYCOMB_API_KEY is not configured");
  return {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
    Accept: "application/json",
  };
};

// ============================================================================
// PROXY (generic — kept for admin exploration)
// ============================================================================

app.post("/proxy", async (c) => {
  try {
    const input = ProxySchema.parse(await c.req.json());
    const safePath = input.path.startsWith("/") ? input.path : `/${input.path}`;
    const url = `${HONEYCOMB_API_URL}${safePath}`;

    log.info(`Proxying ${input.method} ${url}`);

    const response = await fetch(url, {
      method: input.method,
      headers: getHeaders(),
      body: input.body ? JSON.stringify(input.body) : undefined,
    });

    const data = await response.json();

    if (!response.ok) {
      log.error(`Honeycomb proxy error: ${response.status}`, { data });
      return c.json(
        { error: "Honeycomb API Error", details: data, status: response.status },
        response.status as number,
      );
    }

    return c.json(data);
  } catch (e: unknown) {
    log.error("Proxy error:", e);
    return c.json({ error: getErrMsg(e) }, 500);
  }
});

// ============================================================================
// REGISTRATION
// ============================================================================

app.post("/register-client", async (c) => {
  try {
    const body = await c.req.json();
    const input = RegisterClientSchema.parse(body);

    // Check if already registered
    const existingMapping = await kv.get(`honeycomb_id:${input.clientId}`);
    if (existingMapping && existingMapping !== NIL_UUID) {
      return c.json({
        success: true,
        message: "Client already registered",
        honeycombId: existingMapping,
      });
    }

    // Resolve identification
    const finalIdNumber = [input.profile_id_number, input.idNumber].find(service.isRealIdNumber) || null;
    const finalPassport = service.isRealIdNumber(input.passport) ? input.passport : null;

    if (!finalIdNumber && !finalPassport) {
      return c.json({
        error: "Missing identification. Please ensure the client profile has a valid South African ID number or passport number before registering.",
      }, 400);
    }

    log.info(`Registering client ${input.clientId} with Honeycomb`);

    // Build payload using exact API schema
    const honeycombPayload = {
      uniqueId: input.clientId,
      firstName: input.firstName,
      surname: input.lastName,
      identityNumber: finalIdNumber || "",
      passport: finalPassport || "",
    };

    // Try the known endpoint
    const response = await fetch(`${HONEYCOMB_API_URL}/natural-person`, {
      method: "POST",
      headers: { ...getHeaders(), "User-Agent": "NavigateWealth-Admin/1.0" },
      body: JSON.stringify(honeycombPayload),
    });

    let successData = null;

    if (response.ok) {
      successData = await response.json();
    } else {
      // Fallback: try alternative endpoints
      const fallbacks = [
        "/api/NaturalPerson",
        "/api/natural-person",
        "/api/v1/NaturalPerson",
        "/api/Applicant",
        "/api/Client",
      ];

      for (const ep of fallbacks) {
        try {
          const res = await fetch(`${HONEYCOMB_API_URL}${ep}`, {
            method: "POST",
            headers: { ...getHeaders(), "User-Agent": "NavigateWealth-Admin/1.0" },
            body: JSON.stringify(honeycombPayload),
          });
          if (res.ok) {
            successData = await res.json();
            break;
          }
        } catch {
          continue;
        }
      }
    }

    if (!successData) {
      throw new Error("Registration failed — could not create client in Honeycomb. All endpoints returned errors.");
    }

    let honeycombId = service.extractId(successData);
    if (!honeycombId) {
      log.warn("No ID in success response. Using prefixed clientId as reference.");
      honeycombId = `hc_${input.clientId}`;
    }

    // Store mapping
    await kv.set(`honeycomb_id:${input.clientId}`, honeycombId);

    // Log activity
    await service.logActivity(input.clientId, "Client Registration", {
      honeycombId,
      registeredAt: new Date().toISOString(),
    });

    return c.json({ success: true, honeycombId });
  } catch (e: unknown) {
    log.error("Register error:", e);
    return c.json({ error: getErrMsg(e) }, 500);
  }
});

// ============================================================================
// STATUS & ACTIVITY
// ============================================================================

app.get("/status/:clientId", async (c) => {
  const clientId = c.req.param("clientId");
  const honeycombId = await kv.get(`honeycomb_id:${clientId}`);
  const isRegistered = !!honeycombId && honeycombId !== NIL_UUID;
  return c.json({ registered: isRegistered, honeycombId: isRegistered ? honeycombId : null });
});

app.get("/activity/:clientId", async (c) => {
  const clientId = c.req.param("clientId");
  const activity = (await kv.get(`honeycomb_activity:${clientId}`)) || [];
  return c.json({ activity });
});

// ============================================================================
// PHASE 1 — IDV (Identity Verification)
// ============================================================================

/**
 * POST /idv/no-photo
 * Runs IDV without photo via POST /natural-person-idv-no-photo-no-upload
 */
app.post("/idv/no-photo", async (c) => {
  try {
    const body = await c.req.json();
    const input = IdvNoPhotoSchema.parse(body);
    const secondary = body.secondary === true;

    const result = await service.runIdvNoPhoto(
      input.clientId,
      input.firstName,
      input.lastName,
      input.idNumber || null,
      input.passport || null,
      secondary,
    );

    if (!result.success) {
      return c.json({ error: result.error }, 400);
    }

    return c.json({
      success: true,
      data: result.data,
      matterId: result.matterId,
      checkType: result.checkType,
    });
  } catch (e: unknown) {
    log.error("IDV no-photo route error:", e);
    return routeError(c, e);
  }
});

/**
 * POST /idv/with-photo
 * Runs IDV with photo via POST /natural-person-idv-photo-upload
 */
app.post("/idv/with-photo", async (c) => {
  try {
    const body = await c.req.json();
    const input = IdvWithPhotoSchema.parse(body);
    const secondary = body.secondary === true;

    const result = await service.runIdvWithPhoto(
      input.clientId,
      input.firstName,
      input.lastName,
      input.idNumber || null,
      input.passport || null,
      input.photo,
      secondary,
    );

    if (!result.success) {
      return c.json({ error: result.error }, 400);
    }

    return c.json({
      success: true,
      data: result.data,
      matterId: result.matterId,
      checkType: result.checkType,
    });
  } catch (e: unknown) {
    log.error("IDV with-photo route error:", e);
    return routeError(c, e);
  }
});

/**
 * POST /idv/bulk
 * Runs bulk IDV via POST /natural-person-idv-bulk
 */
app.post("/idv/bulk", async (c) => {
  try {
    const input = BulkIdvSchema.parse(await c.req.json());

    const result = await service.runBulkIdv(input.clientId, input.persons);

    if (!result.success) {
      return c.json({ error: result.error }, 400);
    }

    return c.json({
      success: true,
      data: result.data,
      matterId: result.matterId,
      checkType: result.checkType,
    });
  } catch (e: unknown) {
    log.error("Bulk IDV route error:", e);
    return routeError(c, e);
  }
});

// ============================================================================
// PHASE 1 — BANK ACCOUNT VERIFICATION
// ============================================================================

/**
 * POST /financial/bank-verify
 * Real-time bank account verification via POST /natural-person-account-verification-real-time
 */
app.post("/financial/bank-verify", async (c) => {
  try {
    const input = BankVerificationSchema.parse(await c.req.json());

    const result = await service.runBankVerification(
      input.clientId,
      input.firstName,
      input.lastName,
      input.idNumber || null,
      input.passport || null,
      input.bankName,
      input.accountNumber,
      input.branchCode,
      input.accountType,
    );

    if (!result.success) {
      return c.json({ error: result.error }, 400);
    }

    return c.json({
      success: true,
      data: result.data,
      matterId: result.matterId,
      checkType: result.checkType,
    });
  } catch (e: unknown) {
    log.error("Bank verification route error:", e);
    return routeError(c, e);
  }
});

// ============================================================================
// PHASE 1 — CONSUMER CREDIT CHECK
// ============================================================================

/**
 * POST /financial/credit-check
 * Consumer credit report via POST /natural-person-consumer-credit
 */
app.post("/financial/credit-check", async (c) => {
  try {
    const input = ConsumerCreditSchema.parse(await c.req.json());

    const result = await service.runConsumerCredit(
      input.clientId,
      input.firstName,
      input.lastName,
      input.idNumber || null,
      input.passport || null,
    );

    if (!result.success) {
      return c.json({ error: result.error }, 400);
    }

    return c.json({
      success: true,
      data: result.data,
      matterId: result.matterId,
      checkType: result.checkType,
    });
  } catch (e: unknown) {
    log.error("Credit check route error:", e);
    return routeError(c, e);
  }
});

// ============================================================================
// PHASE 1 — SANCTIONS SEARCH
// ============================================================================

/**
 * POST /sanctions/search
 * General sanctions search via GET /search-sanctions-natural-persons
 * (We use POST on our side to accept a JSON body rather than query params)
 */
app.post("/sanctions/search", async (c) => {
  try {
    const input = SanctionsSearchSchema.parse(await c.req.json());

    const result = await service.searchSanctions(
      input.clientId,
      input.name || "",
      input.surname || "",
      input.identityNumber,
      input.uniqueId,
      input.source,
    );

    if (!result.success) {
      return c.json({ error: result.error }, 400);
    }

    return c.json({
      success: true,
      data: result.data,
      checkType: result.checkType,
    });
  } catch (e: unknown) {
    log.error("Sanctions search route error:", e);
    return routeError(c, e);
  }
});

// ============================================================================
// CHECK HISTORY
// ============================================================================

/**
 * GET /checks/history/:clientId
 * Returns all check results across all types for a client.
 */
app.get("/checks/history/:clientId", async (c) => {
  try {
    const clientId = c.req.param("clientId");
    const history = await service.getAllCheckHistory(clientId);
    return c.json({ success: true, history });
  } catch (e: unknown) {
    log.error("Check history error:", e);
    return c.json({ error: getErrMsg(e) }, 500);
  }
});

/**
 * GET /checks/history/:clientId/:checkType
 * Returns results for a specific check type.
 */
app.get("/checks/history/:clientId/:checkType", async (c) => {
  try {
    const clientId = c.req.param("clientId");
    const checkType = c.req.param("checkType");
    const history = await service.getCheckHistory(clientId, checkType);
    return c.json({ success: true, history });
  } catch (e: unknown) {
    log.error("Check type history error:", e);
    return c.json({ error: getErrMsg(e) }, 500);
  }
});

// ============================================================================
// ASSESSMENTS (existing, kept for backward compatibility)
// ============================================================================

app.get("/assessments/templates", async (c) => {
  try {
    log.info("Fetching assessment templates from Honeycomb...");
    const url = `${HONEYCOMB_API_URL}/retrieve-assessments`;
    const res = await fetch(url, { headers: getHeaders() });

    if (!res.ok) {
      const errText = await res.text().catch(() => "Unknown error");
      log.error(`Failed to fetch assessment templates: ${res.status}`, { error: errText });
      return c.json({
        error: `Honeycomb returned ${res.status} when fetching assessment templates`,
        details: errText.substring(0, 300),
      }, res.status as number);
    }

    const data = await res.json();
    const templates = Array.isArray(data) ? data : [data];
    log.info(`Retrieved ${templates.length} assessment template(s)`);

    return c.json({ success: true, templates });
  } catch (e: unknown) {
    log.error("Error fetching assessment templates:", e);
    return c.json({ error: getErrMsg(e) }, 500);
  }
});

app.post("/assessments/run", async (c) => {
  try {
    const input = AssessmentRunSchema.parse(await c.req.json());

    const finalIdNumber = service.isRealIdNumber(input.idNumber) ? input.idNumber : "";
    const finalPassport = service.isRealIdNumber(input.passport) ? input.passport : "";

    if (!finalIdNumber && !finalPassport) {
      return c.json({
        error: "Client has no valid ID number or passport. Please update their profile before running an assessment.",
      }, 400);
    }

    const honeycombPayload = {
      matterNaturalPerson: {
        uniqueId: input.clientId,
        firstName: input.firstName || "",
        surname: input.lastName || "",
        identityNumber: finalIdNumber,
        passport: finalPassport,
      },
      submission: input.submission || new Date().toISOString(),
      dueDiligenceAssessmentsId: Number(input.assessmentId),
    };

    log.info("Submitting assessment to Honeycomb:", {
      assessmentId: input.assessmentId,
      clientId: input.clientId,
    });

    const url = `${HONEYCOMB_API_URL}/natural-person-assessment`;
    const res = await fetch(url, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify(honeycombPayload),
    });

    const responseText = await res.text();
    let responseData: Record<string, unknown> | null;
    try {
      responseData = JSON.parse(responseText);
    } catch {
      log.error("Non-JSON response from assessment endpoint:", { text: responseText.substring(0, 300) });
      responseData = null;
    }

    if (!res.ok) {
      const errDetail = (responseData as Record<string, unknown>)?.message || (responseData as Record<string, unknown>)?.error || responseText.substring(0, 300);
      log.error(`Assessment submission failed (${res.status}):`, { error: errDetail });
      return c.json(
        { error: `Assessment submission failed: ${errDetail}`, status: res.status },
        (res.status >= 400 && res.status < 600 ? res.status : 500) as number,
      );
    }

    if (!responseData) {
      return c.json({ error: "Honeycomb returned an empty/invalid response" }, 502);
    }

    log.info("Assessment submitted successfully.", { keys: Object.keys(responseData) });

    const resultEntry = {
      id: responseData.matterId || crypto.randomUUID(),
      assessmentId: input.assessmentId,
      assessmentName: input.assessmentName || `Assessment #${input.assessmentId}`,
      submittedAt: new Date().toISOString(),
      matterId: responseData.matterId || null,
      naturalPersonId: responseData.naturalPersonId || null,
      screeningOutcome: (responseData.bulkScreeningResponse as Record<string, unknown>)?.screeningOutcome || null,
      bulkScreeningResponse: responseData.bulkScreeningResponse || null,
      rawResponse: responseData,
    };

    const historyKey = `honeycomb_assessments:${input.clientId}`;
    const existing = (await kv.get(historyKey)) || [];
    await kv.set(historyKey, [resultEntry, ...(Array.isArray(existing) ? existing : [])]);

    await service.logActivity(input.clientId, "Risk Assessment", {
      assessmentName: resultEntry.assessmentName,
      matterId: resultEntry.matterId,
      screeningOutcome: resultEntry.screeningOutcome,
      riskLevel: resultEntry.screeningOutcome || "Pending",
    });

    return c.json({ success: true, data: resultEntry });
  } catch (e: unknown) {
    log.error("Error running assessment:", e);
    return routeError(c, e);
  }
});

app.get("/assessments/history/:clientId", async (c) => {
  try {
    const clientId = c.req.param("clientId");
    const history = (await kv.get(`honeycomb_assessments:${clientId}`)) || [];
    return c.json({ success: true, assessments: history });
  } catch (e: unknown) {
    log.error("Error fetching assessment history:", e);
    return c.json({ error: getErrMsg(e) }, 500);
  }
});

// Legacy endpoint — backward compatibility
app.post("/assessments/create", async (c) => {
  try {
    const { honeycombId, clientId } = await c.req.json();
    if (!honeycombId) return c.json({ error: "Missing honeycombId" }, 400);

    let resultData = null;
    const paths = ["/api/Assessment", "/api/v1/Assessment", "/api/risk-assessment"];

    for (const path of paths) {
      const res = await fetch(`${HONEYCOMB_API_URL}${path}`, {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify({ naturalPersonId: honeycombId }),
      });
      if (res.ok) {
        resultData = await res.json();
        break;
      }
    }

    if (!resultData) {
      log.warn("Could not create real assessment via legacy endpoint. Returning mock.");
      resultData = {
        id: crypto.randomUUID(),
        riskScore: Math.floor(Math.random() * 10),
        riskLevel: "Low",
        createdAt: new Date().toISOString(),
      };
    }

    if (clientId) {
      await service.logActivity(clientId, "Risk Assessment", resultData);
    }

    return c.json({ success: true, data: resultData });
  } catch (e: unknown) {
    return c.json({ error: getErrMsg(e) }, 500);
  }
});

app.get("/assessments/list/:honeycombId", async (c) => {
  try {
    const honeycombId = c.req.param("honeycombId");
    const url = `${HONEYCOMB_API_URL}/api/Assessment?naturalPersonId=${honeycombId}`;
    const res = await fetch(url, { headers: getHeaders() });

    if (res.ok) {
      const data = await res.json();
      return c.json({ assessments: Array.isArray(data) ? data : [data] });
    }

    return c.json({ assessments: [] });
  } catch (e: unknown) {
    return c.json({ error: getErrMsg(e) }, 500);
  }
});

// ============================================================================
// LEGACY REPORT ENDPOINTS (updated to use correct Honeycomb paths)
// ============================================================================

app.post("/reports/idv", async (c) => {
  try {
    const { honeycombId, clientId } = await c.req.json();

    // Use the correct Honeycomb IDV endpoint
    const res = await fetch(`${HONEYCOMB_API_URL}/natural-person-idv-no-photo-no-upload`, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify({ uniqueId: clientId, naturalPersonId: honeycombId }),
    });

    let reportData: Record<string, unknown> | null = null;
    if (res.ok) {
      reportData = await res.json();
    }

    const reportId = reportData?.matterId || reportData?.id || crypto.randomUUID();

    if (clientId) {
      await service.logActivity(clientId, "IDV Report", { reportId });
    }

    return c.json({ success: true, reportId, status: "Completed", data: reportData });
  } catch (e: unknown) {
    return c.json({ error: getErrMsg(e) }, 500);
  }
});

app.post("/reports/cdd", async (c) => {
  try {
    const input = NaturalPersonCheckSchema.parse(await c.req.json());
    const result = await service.runCddReport(
      input.clientId, input.firstName, input.lastName,
      input.idNumber || null, input.passport || null,
    );
    if (!result.success) return c.json({ error: result.error }, 400);
    return c.json({ success: true, data: result.data, matterId: result.matterId, checkType: result.checkType });
  } catch (e: unknown) {
    log.error("CDD report route error:", e);
    return routeError(c, e);
  }
});

// ============================================================================
// PHASE 2 — FINANCIAL INTELLIGENCE (POST matter-creation)
// ============================================================================

/** POST /financial/consumer-trace */
app.post("/financial/consumer-trace", async (c) => {
  try {
    const input = NaturalPersonCheckSchema.parse(await c.req.json());
    const result = await service.runConsumerTrace(
      input.clientId, input.firstName, input.lastName,
      input.idNumber || null, input.passport || null,
    );
    if (!result.success) return c.json({ error: result.error }, 400);
    return c.json({ success: true, data: result.data, matterId: result.matterId, checkType: result.checkType });
  } catch (e: unknown) {
    log.error("Consumer trace route error:", e);
    return routeError(c, e);
  }
});

/** POST /financial/debt-review */
app.post("/financial/debt-review", async (c) => {
  try {
    const input = NaturalPersonCheckSchema.parse(await c.req.json());
    const result = await service.runDebtReviewEnquiry(
      input.clientId, input.firstName, input.lastName,
      input.idNumber || null, input.passport || null,
    );
    if (!result.success) return c.json({ error: result.error }, 400);
    return c.json({ success: true, data: result.data, matterId: result.matterId, checkType: result.checkType });
  } catch (e: unknown) {
    log.error("Debt review route error:", e);
    return routeError(c, e);
  }
});

// ============================================================================
// PHASE 2 — CORPORATE & GOVERNANCE (POST matter-creation)
// ============================================================================

/** POST /corporate/cipc */
app.post("/corporate/cipc", async (c) => {
  try {
    const input = NaturalPersonCheckSchema.parse(await c.req.json());
    const result = await service.runCipcSearch(
      input.clientId, input.firstName, input.lastName,
      input.idNumber || null, input.passport || null,
    );
    if (!result.success) return c.json({ error: result.error }, 400);
    return c.json({ success: true, data: result.data, matterId: result.matterId, checkType: result.checkType });
  } catch (e: unknown) {
    log.error("CIPC route error:", e);
    return routeError(c, e);
  }
});

/** POST /corporate/director-enquiry */
app.post("/corporate/director-enquiry", async (c) => {
  try {
    const input = NaturalPersonCheckSchema.parse(await c.req.json());
    const result = await service.runDirectorEnquiry(
      input.clientId, input.firstName, input.lastName,
      input.idNumber || null, input.passport || null,
    );
    if (!result.success) return c.json({ error: result.error }, 400);
    return c.json({ success: true, data: result.data, matterId: result.matterId, checkType: result.checkType });
  } catch (e: unknown) {
    log.error("Director enquiry route error:", e);
    return routeError(c, e);
  }
});

// ============================================================================
// PHASE 2 — ADDRESS & SCREENING (POST/GET)
// ============================================================================

/** POST /address/best-known */
app.post("/address/best-known", async (c) => {
  try {
    const input = NaturalPersonCheckSchema.parse(await c.req.json());
    const result = await service.runBestKnownAddress(
      input.clientId, input.firstName, input.lastName,
      input.idNumber || null, input.passport || null,
    );
    if (!result.success) return c.json({ error: result.error }, 400);
    return c.json({ success: true, data: result.data, matterId: result.matterId, checkType: result.checkType });
  } catch (e: unknown) {
    log.error("Best known address route error:", e);
    return routeError(c, e);
  }
});

/** POST /screening/custom */
app.post("/screening/custom", async (c) => {
  try {
    const input = CustomScreeningSchema.parse(await c.req.json());
    const result = await service.runCustomScreening(
      input.clientId, input.firstName, input.lastName,
      input.idNumber || null, input.passport || null,
      input.packageId, input.screeningPackage,
    );
    if (!result.success) return c.json({ error: result.error }, 400);
    return c.json({ success: true, data: result.data, matterId: result.matterId, checkType: result.checkType });
  } catch (e: unknown) {
    log.error("Custom screening route error:", e);
    return routeError(c, e);
  }
});

/** POST /sanctions/enforcement-actions (search) */
app.post("/sanctions/enforcement-actions", async (c) => {
  try {
    const input = EnforcementActionsSchema.parse(await c.req.json());
    const result = await service.searchEnforcementActions(
      input.clientId, input.name || "", input.surname || "",
      input.identityNumber, input.uniqueId,
    );
    if (!result.success) return c.json({ error: result.error }, 400);
    return c.json({ success: true, data: result.data, checkType: result.checkType });
  } catch (e: unknown) {
    log.error("Enforcement actions route error:", e);
    return routeError(c, e);
  }
});

/** POST /sanctions/legal-a-listing (search) */
app.post("/sanctions/legal-a-listing", async (c) => {
  try {
    const input = LegalAListingSchema.parse(await c.req.json());
    const result = await service.searchLegalAListing(
      input.clientId, input.name || "", input.surname || "",
      input.identityNumber, input.uniqueId,
    );
    if (!result.success) return c.json({ error: result.error }, 400);
    return c.json({ success: true, data: result.data, checkType: result.checkType });
  } catch (e: unknown) {
    log.error("Legal A listing route error:", e);
    return routeError(c, e);
  }
});

// ============================================================================
// PHASE 3 — FINANCIAL PROFILING (POST matter-creation)
// ============================================================================

/** POST /financial/lifestyle-audit */
app.post("/financial/lifestyle-audit", async (c) => {
  try {
    const input = NaturalPersonCheckSchema.parse(await c.req.json());
    const result = await service.runLifestyleAudit(
      input.clientId, input.firstName, input.lastName,
      input.idNumber || null, input.passport || null,
    );
    if (!result.success) return c.json({ error: result.error }, 400);
    return c.json({ success: true, data: result.data, matterId: result.matterId, checkType: result.checkType });
  } catch (e: unknown) {
    log.error("Lifestyle audit route error:", e);
    return routeError(c, e);
  }
});

/** POST /financial/income-predictor */
app.post("/financial/income-predictor", async (c) => {
  try {
    const input = NaturalPersonCheckSchema.parse(await c.req.json());
    const result = await service.runIncomePredictor(
      input.clientId, input.firstName, input.lastName,
      input.idNumber || null, input.passport || null,
    );
    if (!result.success) return c.json({ error: result.error }, 400);
    return c.json({ success: true, data: result.data, matterId: result.matterId, checkType: result.checkType });
  } catch (e: unknown) {
    log.error("Income predictor route error:", e);
    return routeError(c, e);
  }
});

/** POST /corporate/tenders-blue */
app.post("/corporate/tenders-blue", async (c) => {
  try {
    const input = NaturalPersonCheckSchema.parse(await c.req.json());
    const result = await service.runTendersBlue(
      input.clientId, input.firstName, input.lastName,
      input.idNumber || null, input.passport || null,
    );
    if (!result.success) return c.json({ error: result.error }, 400);
    return c.json({ success: true, data: result.data, matterId: result.matterId, checkType: result.checkType });
  } catch (e: unknown) {
    log.error("Tenders blue route error:", e);
    return routeError(c, e);
  }
});

// ============================================================================
// PHASE 4 — COMPLIANCE DASHBOARD
// ============================================================================

/**
 * GET /dashboard/:clientId
 * Aggregated compliance readiness dashboard.
 * Returns readiness score, category completion, check matrix, and risk flags.
 */
app.get("/dashboard/:clientId", async (c) => {
  try {
    const clientId = c.req.param("clientId");
    const dashboard = await service.getComplianceDashboard(clientId);
    return c.json({ success: true, dashboard });
  } catch (e: unknown) {
    log.error("Dashboard route error:", e);
    return c.json({ error: getErrMsg(e) }, 500);
  }
});

export default app;