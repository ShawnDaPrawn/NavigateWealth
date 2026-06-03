import { Hono } from 'npm:hono';
import portalRoutes from './integrations-portal-routes.ts';
import providerRoutes from './integrations-provider-routes.ts';
import uploadRoutes from './integrations-upload-routes.ts';
import schemaRoutes from './integrations-schema-routes.ts';
import policyRoutes from './integrations-policy-routes.ts';
import policyDocumentRoutes from './integrations-policy-documents-routes.ts';
import policyExtractionRoutes from './integrations-policy-extraction-routes.ts';

const app = new Hono();

// Root handlers
app.get('/', (c) => c.json({ service: 'integrations', status: 'active' }));
app.get('', (c) => c.json({ service: 'integrations', status: 'active' }));

// --- Provider / Config / Template routes ---
app.route('/', providerRoutes);

// --- Portal automation routes ---
app.route('/', portalRoutes);

// --- Upload / History / Sync-run routes ---
app.route('/', uploadRoutes);

// --- Schema / Custom-key routes ---
app.route('/', schemaRoutes);

// --- Policy management routes ---
app.route('/', policyRoutes);

// --- Policy document routes ---
app.route('/', policyDocumentRoutes);

// --- Policy-extraction and provider-terminology routes ---
app.route('/', policyExtractionRoutes);

export default app;
