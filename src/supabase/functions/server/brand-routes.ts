/**
 * Brand / Corporate Identity — Route Handlers
 *
 * Thin dispatcher: parses input, delegates to BrandService, returns response.
 *
 * Guidelines:
 *   SS4.2  — Route files are thin dispatchers
 *   SS14.2 — Static paths before parameterised /:id routes
 */

import { Hono } from 'npm:hono';
import { requireAuth, requireAdmin } from './auth-mw.ts';
import { asyncHandler } from './error.middleware.ts';
import { createModuleLogger } from './stderr-logger.ts';
import { BrandService } from './brand-service.ts';
import { AdminAuditService } from './admin-audit-service.ts';
import type { LogoEntry, CollateralItem, ColourPalette, TypographyConfig, BrandRule } from './brand-service.ts';

const app = new Hono();
const log = createModuleLogger('brand-routes');
const service = new BrandService();

// ============================================================================
// HEALTH
// ============================================================================

app.get('/health', (c) => c.json({ service: 'brand', status: 'active' }));

// ============================================================================
// SUMMARY (stat cards)
// ============================================================================

app.get('/summary', requireAuth, asyncHandler(async (c) => {
  const summary = await service.getSummary();
  return c.json({ success: true, ...summary });
}));

// ============================================================================
// LOGOS
// ============================================================================

app.get('/logos', requireAuth, asyncHandler(async (c) => {
  const logos = await service.getLogos();
  // Attach signed URLs
  const enriched = await Promise.all(
    logos.map(async (l) => ({
      ...l,
      signedUrl: await service.getLogoSignedUrl(l.storagePath),
    })),
  );
  return c.json({ success: true, logos: enriched });
}));

app.post('/logos/upload', requireAuth, requireAdmin, asyncHandler(async (c) => {
  const formData = await c.req.formData();
  const file = formData.get('file') as File | null;
  const variant = formData.get('variant') as string;
  const label = formData.get('label') as string || variant;
  const usageNotes = formData.get('usageNotes') as string || '';
  const uploadedBy = formData.get('uploadedBy') as string || 'admin';

  if (!file || !variant) {
    return c.json({ error: 'File and variant are required' }, 400);
  }

  const allowedVariants = ['primary', 'reversed', 'icon', 'social', 'monochrome'];
  if (!allowedVariants.includes(variant)) {
    return c.json({ error: `Invalid variant. Must be one of: ${allowedVariants.join(', ')}` }, 400);
  }

  const buffer = new Uint8Array(await file.arrayBuffer());
  const ext = file.name.split('.').pop() || 'png';
  const storagePath = `logos/${variant}_${Date.now()}.${ext}`;

  await service.uploadFile(buffer, storagePath, file.type);

  const entry: LogoEntry = {
    id: crypto.randomUUID(),
    variant: variant as LogoEntry['variant'],
    label,
    fileName: file.name,
    storagePath,
    mimeType: file.type,
    fileSize: file.size,
    usageNotes,
    uploadedAt: new Date().toISOString(),
    uploadedBy,
  };

  const logos = await service.upsertLogo(entry);

  // Audit trail (non-blocking — §12.2)
  AdminAuditService.record({
    actorId: uploadedBy,
    actorRole: 'admin',
    category: 'configuration',
    action: 'brand_logo_uploaded',
    summary: `Brand logo uploaded: ${variant}`,
    severity: 'info',
    entityType: 'brand',
    metadata: { variant, fileName: file.name },
  }).catch(() => {});

  return c.json({ success: true, logos });
}));

app.delete('/logos/:variant', requireAuth, requireAdmin, asyncHandler(async (c) => {
  const variant = c.req.param('variant');
  const logos = await service.deleteLogo(variant);

  // Audit trail
  const adminUserId = c.get('userId') || 'admin';
  AdminAuditService.record({
    actorId: adminUserId,
    actorRole: c.get('userRole') || 'admin',
    category: 'configuration',
    action: 'brand_logo_deleted',
    summary: `Brand logo deleted: ${variant}`,
    severity: 'warning',
    entityType: 'brand',
    metadata: { variant },
  }).catch(() => {});

  return c.json({ success: true, logos });
}));

app.get('/logos/signed-url', requireAuth, asyncHandler(async (c) => {
  const path = c.req.query('path');
  if (!path) return c.json({ error: 'path query param required' }, 400);
  const url = await service.getLogoSignedUrl(path);
  return c.json({ success: true, url });
}));

// ============================================================================
// COLOURS
// ============================================================================

app.get('/colours', requireAuth, asyncHandler(async (c) => {
  const palette = await service.getColourPalette();
  return c.json({ success: true, palette });
}));

app.put('/colours', requireAuth, requireAdmin, asyncHandler(async (c) => {
  const body = await c.req.json() as ColourPalette;
  const saved = await service.saveColourPalette(body);

  AdminAuditService.record({
    actorId: c.get('userId') || 'admin',
    actorRole: c.get('userRole') || 'admin',
    category: 'configuration',
    action: 'brand_colours_updated',
    summary: 'Brand colour palette updated',
    severity: 'info',
    entityType: 'brand',
  }).catch(() => {});

  return c.json({ success: true, palette: saved });
}));

// ============================================================================
// TYPOGRAPHY
// ============================================================================

app.get('/typography', requireAuth, asyncHandler(async (c) => {
  const config = await service.getTypography();
  return c.json({ success: true, config });
}));

app.put('/typography', requireAuth, requireAdmin, asyncHandler(async (c) => {
  const body = await c.req.json() as TypographyConfig;
  const saved = await service.saveTypography(body);

  AdminAuditService.record({
    actorId: c.get('userId') || 'admin',
    actorRole: c.get('userRole') || 'admin',
    category: 'configuration',
    action: 'brand_typography_updated',
    summary: 'Brand typography configuration updated',
    severity: 'info',
    entityType: 'brand',
  }).catch(() => {});

  return c.json({ success: true, config: saved });
}));

// ============================================================================
// COLLATERAL
// ============================================================================

app.get('/collateral', requireAuth, asyncHandler(async (c) => {
  const items = await service.getCollateral();
  const enriched = await Promise.all(
    items.map(async (item) => ({
      ...item,
      signedUrl: await service.getCollateralSignedUrl(item.storagePath),
    })),
  );
  return c.json({ success: true, items: enriched });
}));

app.post('/collateral/upload', requireAuth, requireAdmin, asyncHandler(async (c) => {
  const formData = await c.req.formData();
  const file = formData.get('file') as File | null;
  const name = formData.get('name') as string;
  const category = formData.get('category') as string || 'other';
  const description = formData.get('description') as string || '';
  const uploadedBy = formData.get('uploadedBy') as string || 'admin';

  if (!file || !name) {
    return c.json({ error: 'File and name are required' }, 400);
  }

  const buffer = new Uint8Array(await file.arrayBuffer());
  const ext = file.name.split('.').pop() || 'bin';
  const storagePath = `collateral/${category}/${Date.now()}_${file.name}`;

  await service.uploadFile(buffer, storagePath, file.type);

  const item: CollateralItem = {
    id: crypto.randomUUID(),
    name,
    category: category as CollateralItem['category'],
    description,
    fileName: file.name,
    storagePath,
    mimeType: file.type,
    fileSize: file.size,
    uploadedAt: new Date().toISOString(),
    uploadedBy,
  };

  const items = await service.upsertCollateral(item);
  return c.json({ success: true, items });
}));

app.delete('/collateral/:id', requireAuth, requireAdmin, asyncHandler(async (c) => {
  const id = c.req.param('id');
  const items = await service.deleteCollateral(id);
  return c.json({ success: true, items });
}));

// ============================================================================
// GUIDELINES
// ============================================================================

app.get('/guidelines', requireAuth, asyncHandler(async (c) => {
  const guidelines = await service.getGuidelines();
  // If there's a PDF, generate a signed URL
  let pdfUrl: string | null = null;
  if (guidelines?.pdfStoragePath) {
    pdfUrl = await service.getCollateralSignedUrl(guidelines.pdfStoragePath);
  }
  return c.json({ success: true, guidelines, pdfUrl });
}));

app.put('/guidelines/rules', requireAuth, requireAdmin, asyncHandler(async (c) => {
  const { rules, updatedBy } = await c.req.json() as { rules: BrandRule[]; updatedBy: string };
  await service.saveGuidelineRules(rules, updatedBy);

  AdminAuditService.record({
    actorId: updatedBy || c.get('userId') || 'admin',
    actorRole: c.get('userRole') || 'admin',
    category: 'configuration',
    action: 'brand_guidelines_rules_updated',
    summary: `Brand guideline rules updated (${rules.length} rules)`,
    severity: 'info',
    entityType: 'brand',
    metadata: { ruleCount: rules.length },
  }).catch(() => {});

  return c.json({ success: true });
}));

app.put('/guidelines/voice', requireAuth, requireAdmin, asyncHandler(async (c) => {
  const { voice, updatedBy } = await c.req.json() as { voice: { tone: string; terminology: string; notes: string }; updatedBy: string };
  await service.saveGuidelineVoice(voice, updatedBy);

  AdminAuditService.record({
    actorId: updatedBy || c.get('userId') || 'admin',
    actorRole: c.get('userRole') || 'admin',
    category: 'configuration',
    action: 'brand_guidelines_voice_updated',
    summary: 'Brand voice & terminology guidelines updated',
    severity: 'info',
    entityType: 'brand',
  }).catch(() => {});

  return c.json({ success: true });
}));

app.post('/guidelines/pdf', requireAuth, requireAdmin, asyncHandler(async (c) => {
  const formData = await c.req.formData();
  const file = formData.get('file') as File | null;
  if (!file) return c.json({ error: 'PDF file required' }, 400);

  const buffer = new Uint8Array(await file.arrayBuffer());
  const storagePath = `guidelines/brand_guidelines_${Date.now()}.pdf`;

  await service.uploadFile(buffer, storagePath, 'application/pdf');
  await service.saveGuidelinePdf({ pdfStoragePath: storagePath, pdfFileName: file.name });

  return c.json({ success: true });
}));

export default app;