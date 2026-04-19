Navigate Wealth Admin Panel

Production Engineering, Architecture & Design System Guidelines (v5)

> **Companion document - read in tandem.**
> `docs/PRODUCTION-READINESS.md` is the *status & roadmap*: what is
> actually landed on clean `main`, what is only proposed or stashed, what to
> do next, and the incident log. **This file** is the *rules*: how code must
> be structured. When in doubt about *what to do next*, consult
> PRODUCTION-READINESS. When in doubt about *how to do it*, consult this
> file. If status text and the repository disagree, verify the repository
> first and update the status document.

Purpose and Scope
These guidelines define how code, UI, and architecture must be structured and evolved within the Navigate Wealth Admin Panel.

They exist to:

Reduce cognitive load in a large TypeScript codebase
Prevent architectural drift and accidental coupling
Lower production and compliance risk in a regulated financial environment
Enable safe, incremental improvement without rewrites
Ensure consistent UI and UX through a central Design System and established patterns
Maintain professional standards appropriate to a wealth management platform
These guidelines prioritise clear boundaries, predictable structure, and consistency over clever abstractions or premature optimisation.

This document is not a rewrite mandate. All changes must be incremental, low-risk, and reversible.

Rule Hierarchy (Authoritative)
Not all rules have equal weight. Enforcement and review decisions must follow this hierarchy.

Tier 1 — Non-Negotiable (Production or Compliance Risk) Violations here represent real risk and must be fixed.

Dependency direction and module boundaries
Boundary typing (API, database, external integrations)
No logging of PII or sensitive client data
RLS enforcement for all sensitive data
Consistent error contracts
No business logic in UI components
Design System adherence for shared UI primitives
Consistent visual language across the admin panel
Multi-entry KV data consistency for entity lifecycle operations
Stdout corruption prevention in edge/serverless runtimes
Tier 2 — Strong Standards (Technical Debt Control) Violations accumulate technical debt and should be addressed.

Module structure consistency (frontend and backend)
API ↔ Hooks separation
Query key and cache invalidation discipline
File size and responsibility thresholds
Logging and observability standards
Use of Design System components instead of ad-hoc UI
Consistent spacing, typography, and layout patterns
Accessibility standards (WCAG 2.1 AA minimum)
KV key naming conventions
Backend route, service, and validation file conventions
Filename and repository layout conventions (§4.4)
Tier 3 — Guidelines (Review and Justification) Violations may be acceptable with documented justification.

Component splitting heuristics
Performance optimisations
UI composition patterns within modules
Animation and transition choices
Micro-interaction details
Core Architectural Principles
3.1 Dependency Direction (Non-Negotiable)

All dependencies must flow inward:

Presentation (UI) → Hooks → API → Types
Rules:

Business logic must never depend on UI frameworks, routing, or rendering concerns
A module directory is a hard boundary
No code outside a module may access its internals directly
Cross-module access is permitted only through explicitly exported public APIs
Circular dependencies are structural defects and must be removed
This ensures predictable change impact and prevents hidden coupling.

3.2 Three-Tier Server Architecture

The application follows a strict three-tier architecture:

Frontend (React) → Server (Hono Edge Function) → Data (Supabase Auth + KV Store)
Rules:

The frontend never accesses Supabase directly for data mutations — all writes go through the server
The server is the single authority for business logic, validation, and data integrity
The KV store is the persistence layer; the server owns all read/write patterns
Supabase Auth is used for identity; the server enforces authorisation
Module Structure (Boundary Contract)
4.1 Frontend Module Structure

Each module represents one domain responsibility and must follow a consistent internal structure.

If a file does not clearly belong in the module's structure, the module is likely doing too much and must be split.

Every module must contain:

module-name/
├── index.tsx              # Single presentation entry point (UI only)
├── api.ts                 # Data boundary (Supabase, external services)
├── types.ts               # Centralised type definitions
├── constants.ts           # Labels, mappings, configuration
├── hooks/                 # React Query hooks (only API consumers)
│   ├── useModuleData.ts
│   └── useModuleMutations.ts
├── components/            # Reusable, module-scoped components
│   ├── ModuleList.tsx
│   ├── ModuleForm.tsx
│   └── ModuleFilters.tsx
├── utils.ts               # Pure utility functions (optional)
└── README.md              # Lightweight technical documentation
This structure exists for discoverability, ownership, and safe evolution.

4.2 Backend Module Structure

Server-side code in /supabase/functions/server/ follows a parallel convention:

server/
├── {domain}-routes.ts         # Hono route handlers (thin — delegates to service)
├── {domain}-service.ts        # Business logic and orchestration
├── {domain}-validation.ts     # Zod schemas for input validation
├── {domain}-types.ts          # Server-side type definitions (optional, if complex)
Rules:

Route files are thin dispatchers — they parse input, call the service, and return responses
Services own business logic, KV access patterns, and cross-entity consistency
Validation schemas are defined separately and applied in route handlers
Services may import other services for cross-domain orchestration, but must not import route handlers

Example:

// {domain}-routes.ts — thin dispatcher
app.post('/action', requireAuth, asyncHandler(async (c) => {
  const input = ActionSchema.parse(await c.req.json());
  const result = await service.performAction(input);
  return c.json({ success: true, ...result });
}));

// {domain}-service.ts — business logic
async performAction(input: ActionInput): Promise<ActionResult> {
  // Validation, KV reads/writes, cross-entry consistency
}
4.3 Barrel Export Conventions

Module exports must use a single, unambiguous entry point.

Rules:

Each module must have exactly one barrel file (index.tsx for frontend, default export for backend routes)
Never create both types.ts and types/index.ts in the same module — this causes resolution ambiguity
If a types file grows large enough to warrant splitting, use a single types/index.ts that re-exports from sub-files
Named exports are preferred over default exports for discoverability (except route modules which use export default app)

4.4 Code filenames, storage, and repository organisation

These rules complement §4.1–4.3. They do not replace module boundary or KV rules elsewhere.

**Filenames — frontend (`src/`)**

- React components: **PascalCase** and **`.tsx`** (e.g. `ClientList.tsx`, `ModuleFilters.tsx`).
- Hooks: **`use` + camelCase**, **`.ts`**, colocated under `hooks/` (e.g. `useClientList.ts`).
- Module scaffolding files: fixed names **`api.ts`**, **`types.ts`**, **`constants.ts`**, **`utils.ts`**, **`index.tsx`** as in §4.1 — **camelCase** filenames for these roles.
- Admin feature directories under `components/admin/modules/`: **kebab-case** folder names (e.g. `client-management/`, `product-management/`).

**Filenames — server (`supabase/functions/server/`)**

- Keep the established pattern: **`{domain}-routes.ts`**, **`{domain}-service.ts`**, **`{domain}-validation.ts`**, optional **`{domain}-types.ts`** — hyphenated domain slug; suffix denotes responsibility (see §4.2).
- Mount registration stays in the existing **`mount-*.ts`** files; do not invent parallel entry trees.

**Storage boundaries**

- **KV**: structured JSON values and key patterns per §5.4; never large binaries in KV.
- **Supabase Storage**: files and blobs (PDFs, images, uploads). Bucket names, path prefixes, and lifecycle rules are owned by the relevant **`-service.ts`** / module **README** — document new buckets or path schemes there in the same change.
- **Browser**: `localStorage` / `sessionStorage` only for non-sensitive UX state; never secrets, tokens, or durable PII.

**Repository layout**

- **`src/`**: application source; import alias **`@/`** → `src/` (see project `tsconfig` / Vite config).
- **`src/shared/`**: shared types, Zod schemas, pure utilities; sync to edge per existing bridge process — not duplicated ad hoc under `server/`.
- **`public/`**: static assets served as-is (brand assets, built **`robots.txt`** / **`sitemap.xml`** from `scripts/generate-seo-files.mjs` where applicable).
- **`scripts/`**: build and maintenance automation only; not imported by runtime bundles.
- **Repo root**: **`package.json`**, **`vite.config.ts`**, **`tsconfig.json`**, **`vercel.json`** stay at root unless a tooling migration explicitly moves them.
- **Ignored local artefacts** (e.g. per **`.gitignore`** such as **`.codex-*.log`**): must not be committed; they are not part of the product surface.

File Responsibility by Layer

5.1 API Layer (Data and Integration Boundary)

The API layer is the only layer allowed to interact with:

Supabase
Databases
External services
Server-side logic
Responsibilities:

All queries and mutations
Client-side authentication checks for UX only
Mapping raw database responses into stable application-level models where clarity improves
Returning predictable, typed results or controlled fallbacks
Clarifications:

Client-side auth checks are not security; they are UX gating only
All real authorisation is enforced by Supabase RLS and server-side constraints
Raw errors must never escape this layer
Logging (API and Server Contexts)

Logs must be structured, contextual, and environment-aware.

Never log PII or sensitive data (client names, account numbers, financial details)
Avoid stdout logging in runtimes where it can corrupt responses (e.g. edge/serverless)
All console.log calls in the Hono server are redirected to console.error via console-override.ts to prevent stdout corruption — this must never be removed or bypassed
Decorative logging (emojis, verbose traces) is permitted only in development and must not reach production
Use the createModuleLogger utility for server-side logging — it provides structured, prefixed output via stderr
5.2 Types Layer (Single Source of Truth, Scoped)

All module-level types live in the module's types definition, but not all types are public.

Types are conceptually split into:

Public types: exported and used across module boundaries
Internal types: private implementation details
Rules:

Database row types may mirror the schema exactly
Application/UI models may diverge when it improves clarity
Explicit mapping is preferred over leaking database shape into UI
Input, update, and filter types must be distinct and intentional
Types are treated as documentation and contracts
API response types on the frontend must match the server's response shape — when the server adds fields, the frontend type must be updated in the same change
Over-exporting types increases coupling and refactor cost.

5.3 Constants and Configuration

All non-trivial constants must be centralised and typed, including:

Labels and enum mappings
UI status/state mappings (including badge styling, colour tokens, and labels)
Default filters
API endpoint paths
Query behaviour (stale times, debounce values)
Date, number, and currency formats
Table column configurations
Navigation breadcrumbs
Typed mappings are mandatory to prevent drift.

Example (status indicator config):

export const ACCOUNT_STATUS_CONFIG = {
  active: {
    label: 'Active',
    badgeClass: 'bg-green-600 hover:bg-green-700 text-white',
    dotClass: 'bg-green-500',
  },
  suspended: {
    label: 'Suspended',
    badgeClass: 'bg-amber-500 hover:bg-amber-600 text-white',
    dotClass: 'bg-amber-500',
  },
  closed: {
    label: 'Closed',
    badgeClass: 'bg-red-600 hover:bg-red-700 text-white',
    dotClass: 'bg-red-500',
  },
} as const;

5.4 KV Store Conventions

The KV store is the primary persistence layer. Consistent key naming and multi-entry patterns are critical.

Key Naming Convention:

{entity_type}:{entity_id}:{facet}
Examples:

user_profile:{userId}:personal_info     # Client profile data
security:{userId}                        # Auth/security flags (suspended, deleted)
application:{applicationId}              # Application data
policy:{policyId}                        # Policy data
user_profile:{userId}:client_keys        # Aggregated financial keys
Rules:

Keys must be deterministic and reconstructable from entity identifiers
Key prefixes define scan boundaries — use getByPrefix for batch retrieval
Never store large binary data in KV — use Supabase Storage for files
KV values should be JSON-serialisable objects, not raw strings
Multi-Entry Consistency (Non-Negotiable):

When a single logical entity spans multiple KV entries (e.g., a client has both a user_profile:*:personal_info entry and a security:* entry), all related entries must be updated together when the entity's state changes.

// ✅ Good: Both entries updated in the same operation
await Promise.all([
  kv.set(`security:${userId}`, { ...security, deleted: true, suspended: true }),
  kv.set(profileKey, { ...profile, accountStatus: 'closed' }),
]);

// ❌ Bad: Only one entry updated, creating inconsistency
await kv.set(`security:${userId}`, { ...security, deleted: true });
// profile.accountStatus still says 'active' — downstream queries will disagree
Violations of multi-entry consistency have caused production bugs where deleted clients continued to receive communications.

Hooks (Data Access Layer)
Hooks are the only consumers of APIs.

Rules:

All server state is managed by React Query
Server data must never be stored in local UI state
Hooks must be narrowly scoped and named after intent (e.g. useClientDetails, useApplicationList)
Query keys must be deterministic and centrally defined
Mutations must invalidate relevant queries and provide user feedback
Hooks may orchestrate data flow but must not contain business rules
Example:

export function useClientList(filters: ClientFilters) {
  return useQuery({
    queryKey: ['clients', 'list', filters],
    queryFn: () => api.getClients(filters),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}
Presentation Layer (UI)
UI components:

Handle layout, interaction, and local UI state only
Never perform data access directly
Never embed business logic
Must handle loading, empty, and error states explicitly
Must use Design System components for all shared UI primitives
File size limits are review triggers, not absolutes:

Large files require a responsibility review
Split components for clarity, not to satisfy arbitrary limits
Component Responsibilities:

// ✅ Good: Clear separation
function ClientList() {
  const { data, isLoading } = useClientList(filters);
  
  if (isLoading) return <LoadingSpinner />;
  if (!data?.length) return <EmptyState />;
  
  return <Table data={data} columns={columns} />;
}

// ❌ Bad: Business logic in UI
function ClientList() {
  const [data, setData] = useState([]);
  
  useEffect(() => {
    fetch('/api/clients').then(res => {
      const filtered = res.filter(c => c.status === 'active'); // Business logic
      setData(filtered);
    });
  }, []);
  
  return <div>{/* ... */}</div>;
}

7.1 Derived Display State

When the display status of an entity depends on multiple source fields, derive it in a pure utility function — never inline the logic in JSX.

// ✅ Good: Pure utility in utils.ts
export function deriveAccountStatus(client: Client): 'active' | 'suspended' | 'closed' {
  if (client.deleted || client.accountStatus === 'closed') return 'closed';
  if (client.suspended || client.accountStatus === 'suspended') return 'suspended';
  return 'active';
}

// Then use in UI:
const status = deriveAccountStatus(client);
const cfg = ACCOUNT_STATUS_CONFIG[status];
return <Badge className={cfg.badgeClass}>{cfg.label}</Badge>;

// ❌ Bad: Inline derivation scattered across components
<Badge className={client.deleted ? 'bg-red-600' : client.suspended ? 'bg-amber-500' : 'bg-green-600'}>
  {client.deleted ? 'Closed' : client.suspended ? 'Suspended' : 'Active'}
</Badge>
Design System Integration (Non-Negotiable for Shared UI)
A central Design System exists and is the authoritative source for:

Typography scales and weights
Spacing and layout grids
Colour palette and semantic tokens
Form controls (inputs, selects, checkboxes, radio buttons)
Buttons and interactive elements
Tables and data grids
Modals, dialogs, and overlays
Cards and containers
Icons and iconography
Navigation patterns
Loading states and skeletons
Feedback components (toasts, alerts, banners)
Interactive patterns (dropdowns, tooltips, popovers)

8.1 Fundamental Rule: Preserve Existing UI Standards

When the Design System does not explicitly define a pattern, defer to the existing UI patterns already established in the Navigate Wealth Admin Panel.

Survey similar components across modules before creating new UI
Match existing spacing, sizing, and interaction patterns
Maintain visual consistency with established conventions
Document deviations only when intentional and justified
The goal is cohesive evolution, not fragmentation.

8.2 Design System Rules

Tier 1 (Non-Negotiable):

Shared UI components must come from the Design System
Visual tokens (colours, spacing, fonts) must never be hard-coded outside the Design System
If the Design System does not support a required pattern, it must be extended rather than bypassed
Tier 2 (Strong Standards):

Modules may create composed components, but must not re-implement primitives
Custom UI must use Design System tokens for spacing, colour, and typography
Complex components should compose Design System primitives
The Design System is treated as infrastructure, not a convenience library.

8.3 UI Standards for Navigate Wealth Admin Panel

Visual Hierarchy:

Primary actions use high-contrast, prominent buttons
Secondary actions use lower-contrast styling
Destructive actions require confirmation and use warning colours
Data Presentation:

Financial data must be formatted consistently (currency, percentages)
Dates follow a standard format across all modules (en-ZA locale: dd MMM yyyy)
Status indicators use consistent colour coding and iconography
Tables use consistent column sizing, sorting, and filtering patterns
Status Indicator Standards:

All status indicators across the admin panel must follow a consistent colour vocabulary:

Colour	Meaning	Usage
Green	Active / Success	Active accounts, approved applications
Amber	Warning / Suspended	Suspended accounts, pending actions
Red	Closed / Error	Closed accounts, failed operations
Blue	Informational	Preview modes, neutral indicators
Purple	Brand / System	Platform actions, system operations
Status indicators should be config-driven (see §5.3) rather than hard-coded in JSX. This ensures a single source of truth for status presentation.

Stat Card Standards:

Stat cards (the summary cards at the top of module pages) follow this established pattern:

White card background
bg-gray-50 (or semantic colour variant) icon container with rounded corners
Large bold number, small muted description text
Icons use muted or semantic colour appropriate to the metric
Form Patterns:

All forms follow consistent validation and error display
Required fields are clearly marked
Field labels are descriptive and consistent
Multi-step forms show clear progress indicators
Form submissions provide immediate feedback
Navigation:

Module navigation is consistent across the admin panel
Breadcrumbs show current location and allow quick traversal
The Cmd+K command palette is the standard for quick navigation
Active states are visually distinct
Feedback and States:

Loading states use consistent spinners or skeleton screens
Empty states provide clear guidance on next actions
Error states explain what went wrong and how to resolve
Success feedback is brief and non-intrusive (toast notifications)
Accessibility (WCAG 2.1 AA Minimum):

All interactive elements are keyboard accessible
Focus states are clearly visible
Colour is never the only means of conveying information
Form errors are announced to screen readers
Sufficient colour contrast for all text
Alt text for all meaningful images
Responsive Behaviour:

Admin panel is optimised for desktop (1280px+ primary)
Graceful degradation for smaller viewports
Tables adapt to smaller screens (stacking, horizontal scroll, or column hiding)
Modals and overlays remain usable on all screen sizes

8.4 AI Builder Guidelines

AI builders operating on the codebase must:

Reference the Design System for all UI construction
Survey existing module implementations for established patterns
Fill in missing details using Design System tokens and components
Avoid introducing parallel UI abstractions
Match the visual language of existing admin panel UI
Document any new patterns that emerge
When changing client-facing schema, KV key patterns, portfolio summary logic, FNA/INA storage, communication history, or document history, update the authenticated Ask Vasco context (`/ai-advisor`, agent `vasco-authenticated`) in the same logical change
Prefer reusing shared client-context aggregators and maintain backwards-compatible reads during migrations so authenticated Ask Vasco remains informed while schemas evolve
Platform-Specific Constraints (Figma Make):

Use react-router — never react-router-dom (not available in this environment)
Use <div className="contents"> instead of React.Fragment (<>) when wrapping elements that need to avoid layout interference — this prevents data-fg-* attribute warnings
Use import { toast } from 'sonner@2.0.3' — the version specifier is required
Use import { useForm } from 'react-hook-form@7.55.0' — the version specifier is required
Icon resolution helpers (resolveIconComponent() / resolveIcon()) convert slug strings from config maps to Lucide components with FileText as the fallback — use these instead of hard-coding icon imports in config-driven UI
TypeScript Standards

9.1 Type Safety (Strict by Default)

Strict mode is required for all new code.

any is forbidden except for documented edge cases
unknown is preferred over any
All function inputs and outputs must be typed
Component props must be explicitly defined
Enum-like values should use as const or TypeScript enums
Boundary typing is critical:

API inputs/outputs
Database queries
External integrations
Form schemas
State management boundaries
Untyped boundaries are the most common source of production bugs.

9.2 Type Organisation

Module-Level Types:

// types.ts

// Database types
export interface ClientRow {
  id: string;
  name: string;
  email: string;
  status: ClientStatus;
  created_at: string;
}

// Application types (may diverge from DB)
export interface Client {
  id: string;
  name: string;
  email: string;
  status: ClientStatus;
  createdAt: Date; // Transformed
  deleted: boolean;
  suspended: boolean;
  accountStatus?: string;
}

// Input types
export interface CreateClientInput {
  name: string;
  email: string;
}

export interface UpdateClientInput {
  name?: string;
  email?: string;
  status?: ClientStatus;
}

// Filter types
export interface ClientFilters {
  status?: ClientStatus[];
  search?: string;
  dateRange?: [Date, Date];
  accountStatus?: 'all' | 'active' | 'suspended' | 'closed';
}

// UI types (internal, not exported)
interface ClientListItem extends Client {
  // Additional derived properties for display
}

9.3 API Response Type Synchronisation

Frontend API response types must mirror the server's actual response shape. When the server adds, removes, or renames fields:

The frontend ApiUser (or equivalent response type) must be updated in the same logical change
The hook transformation layer must map new fields into the application-level type
Stale response types are a source of silent data loss
Error Handling and Observability
Errors are part of the application contract.

Rules:

Never swallow errors silently
Never expose raw stack traces to users
Use a single, consistent error shape across the application
Partial failures must degrade gracefully
Logs must always include context, never sensitive data
Every module must be protected by an error boundary to prevent cascading failures
Error Shape:

interface AppError {
  message: string;        // User-facing message
  code?: string;          // Machine-readable error code
  context?: unknown;      // Contextual information (no PII)
  timestamp: Date;
}
User-Facing Error Messages:

Must be clear and actionable
Must not expose implementation details
Must suggest next steps where possible
Must be appropriate for a financial professional audience
Example:

// ✅ Good
"Unable to load client data. Please check your connection and try again."

// ❌ Bad
"Error: ECONNREFUSED at Socket.connect (net.js:1174:16)"
State Management

11.1 Client (UI) State

Local UI concerns only:

Modal visibility
Form input values
Filter selections
Table sorting and pagination
Accordion/collapse states
Keep state close to where it is used. Avoid unnecessary lifting or globalisation.

11.2 Server State

React Query only.

Cache invalidation on mutation is mandatory
Optimistic updates only when UX-critical and demonstrably safe
Error states must be handled explicitly
Loading states must be handled explicitly
Query Key Conventions:

// Consistent, deterministic query keys
['clients', 'list', filters]
['clients', 'detail', clientId]
['applications', 'list', { status, dateRange }]
['personnel', 'detail', personnelId]
Validation and Security (Financial Domain)

12.1 Validation

Client-side validation for UX:

Immediate feedback to users
Format guidance
Required field enforcement
Server-side validation for security:

All inputs validated again on server (Zod schemas in {domain}-validation.ts)
Business rule enforcement
Data integrity checks
Error messages must be:

Clear and actionable
Appropriate for financial professionals
Specific about what went wrong

12.2 Security (Non-Negotiable)

Never log personal client data:

Client names
Account numbers
Financial details
Contact information
Identification numbers
Enforce RLS for all sensitive tables:

All database queries respect Row Level Security
Never bypass RLS in application code
Never trust client-side permissions:

All authorization is server-side
Client-side checks are UX only
Maintain audit trails for sensitive actions:

Track who made changes
Track when changes were made
Track what changed
Maintain compliance records
Use soft deletes for compliance-relevant data:

Mark as deleted, don't remove
Maintain history for auditing
Allow recovery when appropriate
12.3 Client Lifecycle Management (Non-Negotiable)

Client accounts follow a defined lifecycle with strict multi-entry consistency:

Active → Suspended → Active (unsuspend)
Active → Closed (soft-delete)
Suspended → Closed (soft-delete)
Suspension:

Sets suspended: true on the security:{userId} KV entry
Stashes the previous accountStatus in the security entry for later restoration
Sets accountStatus: 'suspended' on the profile KV entry
Both entries must be updated together
Unsuspension:

Sets suspended: false on the security entry
Restores the previous accountStatus from the security entry (defaults to 'approved')
Soft-Delete (Closure):

Sets deleted: true and suspended: true on the security entry
Sets accountStatus: 'closed' on the profile entry
Auth account is not removed (compliance retention)
Downstream Guards:

Any code path that enumerates clients for action (communication, group membership, reporting) must:

Check profile.accountStatus for fast filtering ('closed', 'suspended')
Cross-reference security:{userId} flags as a belt-and-suspenders check
Exclude deleted and suspended clients from recipient lists, group calculations, and active client counts
This two-layer guard exists because legacy records may have inconsistent status values that have not yet been backfilled.

Performance and Bundling
Performance rules are context-aware:

Frontend:

Lazy loading is encouraged for route-level code splitting
All admin modules are lazy-loaded via React.lazy() with dynamic imports
Debounce search inputs (300–500ms typical)
Virtualise long lists (100+ items)
Paginate large datasets
Cache expensive computations with useMemo
Memoize callbacks with useCallback only when necessary
Server/Edge:

The Hono server uses a lazy-loading architecture via lazy-router.ts — route modules are dynamically imported on first request and cached for subsequent requests
Route modules are registered in mount files (mount-core.ts, mount-modules.ts, mount-fna.ts) — these are lightweight and load no module code at registration time
New route modules must be added to the appropriate mount file and follow the lazy() registration pattern
Batch KV reads with Promise.all() when fetching multiple entries for the same request (e.g., profile + security + policies)
Use kv.mget() or kv.getByPrefix() for batch retrieval when fetching entries for multiple entities
Never use console.log for debugging on the server — stdout corruption will break HTTP responses; use console.error or the module logger
Deno Import Conventions (Server Only):

// External packages — use npm: or jsr: specifiers
import { Hono } from 'npm:hono';
import { createClient } from 'jsr:@supabase/supabase-js@2.49.8';

// Node built-ins — always use node: specifier
import process from 'node:process';
import { Buffer } from 'node:buffer';

// Hono middleware — import from subpaths, not from 'npm:hono/middleware'
import { cors } from 'npm:hono/cors';
import { logger } from 'npm:hono/logger';
General:

Optimise only after correctness and clarity are established
Do not micro-optimise trivial paths
Measure before optimising
Document performance-critical sections
Admin Operations and Maintenance

14.1 Destructive or Batch Operations

Any admin operation that modifies data in bulk must follow the dry-run-first pattern:

Expose a dryRun parameter (default: true for safety)
In dry-run mode, perform all reads and logic but skip all writes
Return a full audit summary regardless of mode
Require explicit confirmation before live execution
// Server route example
app.post('/maintenance/cleanup', requireAuth, requireAdmin, asyncHandler(async (c) => {
  const { dryRun = true } = await c.req.json();
  const result = await runCleanup(dryRun);
  return c.json({ success: true, dryRun, ...result });
}));
Frontend patterns for destructive admin operations:

Use an AlertDialog for confirmation before live runs
Display results with clear "Preview" vs "Applied" badges
Show duration and affected record counts
Provide a detail table for audit review
Refresh dependent data after a live run completes
14.2 Maintenance Endpoints

Register maintenance endpoints before parameterised /:id routes to prevent path collisions:

// ✅ Good: Static paths registered first
app.post('/maintenance/cleanup', requireAuth, requireAdmin, handler);
app.get('/:id', requireAuth, requireAdmin, handler);

// ❌ Bad: /:id would catch '/maintenance/cleanup'
app.get('/:id', requireAuth, requireAdmin, handler);
app.post('/maintenance/cleanup', requireAuth, requireAdmin, handler);
Testing Strategy (Risk-Based)
Testing focuses on what can break production, not coverage percentages.

Priority areas:

Business rules and calculations
Validation logic
API error handling
Critical user workflows
Compliance-sensitive paths
Financial calculations
Data transformations
Multi-entry KV consistency (lifecycle operations)
Avoid:

Snapshot spam
Testing third-party internals
Trivial rendering tests without behavioural value
Over-mocking (test real integration points)
Testing levels:

Unit tests for utilities and business logic
Integration tests for hooks and API layers
End-to-end tests for critical workflows
Documentation and Governance
Every module must include:

A short architectural overview explaining why, not what (README.md)
Documentation for non-obvious constraints (compliance, performance, security)
Comments only where logic is complex or regulated
Examples of key workflows when non-obvious
Code comments should explain:

Why this approach was chosen
Why alternatives were rejected
Compliance or regulatory requirements
Performance considerations
Known limitations or edge cases
Avoid comments that:

Duplicate what the code obviously does
Will become stale as code changes
Apologise for bad code (fix the code instead)
Known Workarounds Register:

When a workaround is introduced for a known bug or platform limitation, it must be documented at the point of use with:

What the problem is
Why this workaround was chosen
What the proper fix would look like
A searchable tag (e.g., // WORKAROUND: [description])
Enforcement and Process
Standards without enforcement decay.

Required:

Lint rules for boundaries and circular dependencies
CI gates for linting, type checking, and tests
PR checklists aligned to these guidelines
Documented exceptions with rationale and revisit dates
Design System compliance checks
Pull Request Checklist:

 Structure and boundaries respected
 Types are stricter or equal (no regression)
 No new circular dependencies
 Errors and logs comply with standards
 Existing behaviour preserved
 Critical flows remain covered
 Design System rules followed
 UI patterns match existing standards
 No PII in logs
 Security considerations addressed
 Multi-entry KV consistency verified (if lifecycle operations)
 API response types synchronised between server and frontend
Definition of Done (Authoritative)
A change is complete only when:

Structure and boundaries are respected — module architecture maintained
Types are stricter or equal — no type safety regression
No new coupling is introduced — dependency direction enforced
Errors and logs comply with standards — no PII, proper error handling
Existing behaviour is preserved — no regressions
Critical flows remain covered — tests updated where necessary
Design System rules are followed — UI consistency maintained
Accessibility standards met — keyboard navigation, screen readers, contrast
Documentation updated — README, comments, or inline docs reflect changes
Security reviewed — RLS, validation, sensitive data handling
Data consistency verified — multi-entry KV updates are atomic and complete
API contracts honoured — frontend types match server response shapes
Final Principles

Clarity over cleverness — code should be obvious, not impressive
Explicit over implicit — be clear about intent
Boring is beautiful — predictable patterns over novel solutions
Delete before you add — remove complexity before introducing more
Types are documentation — make illegal states unrepresentable
Test the paths that matter — focus on risk, not metrics
Security and compliance are non-optional — financial data demands rigor
Consistency enables speed — familiar patterns reduce cognitive load
UI is a user contract — visual consistency builds trust
Multi-entry consistency is non-negotiable — if two records describe one entity, both must be correct
When rules conflict with reality, document the exception and evolve the standard.

The goal is shared understanding and long-term safety, not blind compliance.

Changelog: v4 → v5

Section	Change

§2 Tier 1	Added multi-entry KV consistency and stdout corruption prevention
§2 Tier 2	Added KV key naming and backend file conventions
§3.2	New. Three-tier server architecture
§4.2	New. Backend module structure (-routes, -service, -validation)
§4.3	New. Barrel export conventions (single entry point, no dual-file barrels)
§4.4	New. Code filenames, storage, and repository organisation (naming, KV vs Storage, repo layout, ignored artefacts)
§5.1	Expanded logging: console-override.ts, createModuleLogger, stderr convention
§5.3	Added API endpoint paths and status indicator config pattern with example
§5.4	New. KV store conventions: key naming, multi-entry consistency with examples
§7.1	New. Derived display state: pure utility pattern for multi-field status derivation
§8.3	Added status colour vocabulary table and stat card standards
§8.4	Added Figma Make platform-specific constraints for AI builders
§9.2	Updated Client example to include deleted, suspended, accountStatus fields
§9.3	New. API response type synchronisation
§12.3	New. Client lifecycle management: suspend/unsuspend/soft-delete patterns with downstream guards
§13	Added lazy-router architecture, KV batch read patterns, Deno import conventions
§14	New. Admin operations: dry-run-first pattern, maintenance endpoint ordering
§15	Added multi-entry KV consistency to test priorities
§16	New. Known workarounds register (// WORKAROUND: tag)
§17	Added KV consistency and API contract checklist items
§18	Added data consistency and API contract items to Definition of Done
§19 — Centralised Key Registries (Non-Negotiable)

The platform maintains two complementary key registries. Both are single-source-of-truth and must not be duplicated.

19.1 React Query Key Factory (`/utils/queryKeys.ts`)

All React Query keys MUST be defined in `/utils/queryKeys.ts`.

Convention:
  domainKeys.all            -> root prefix (invalidates everything in the domain)
  domainKeys.lists()        -> all list variants
  domainKeys.list(filters)  -> specific filtered list
  domainKeys.details()      -> all detail variants
  domainKeys.detail(id)     -> specific entity

Rules:
- New domains add their key factory object to `/utils/queryKeys.ts` — never in module code
- Module-level `hooks/queryKeys.ts` files are re-export shims only:
    export { fooKeys } from '../../../../../utils/queryKeys';
  They exist for backward-compatible local imports and must never define keys
- Inline query key arrays (`queryKey: ['foo', id]`) are forbidden — always reference the factory
- Keys must be deterministic and reconstructable from entity identifiers
- Root prefixes must be unique across the file — collisions cause unintended cache invalidation
- Extending a factory key inline (e.g., `[...permissionKeys.all, 'audit', id]`) is acceptable
  for one-off queries, but recurring patterns must be promoted to the factory

Adding a new module:
1. Add the key factory to `/utils/queryKeys.ts` under a new section header
2. Create the module's `hooks/queryKeys.ts` as a one-line re-export
3. Import from `./queryKeys` in all hook files within the module

19.2 Universal Key Manager (Product / Financial Data Keys)

All financial data point identifiers MUST be registered in the Universal Key Manager
(`/components/admin/modules/resources/key-manager/`).

The canonical key definitions live in `/components/admin/modules/product-management/keyManagerConstants.ts`.

Key ID Convention:
  {category}_{metric}                # Individual field (e.g., risk_life_cover)
  {category}_{metric}_total          # Calculated aggregate (e.g., risk_life_cover_total)
  {category}_{metric}_recommended    # FNA recommendation (e.g., risk_life_cover_recommended)
  profile_{section}_{field}          # Client profile field (e.g., profile_personal_first_name)

Rules:

- Every financial data point consumed or produced by any module must have a registered ProductKey
- New keys are added to the appropriate array in `keyManagerConstants.ts` (RISK_KEYS, MEDICAL_AID_KEYS, etc.)
- The `KEY_USAGE_MAP` in `key-manager/constants.ts` must be updated when a module starts consuming an existing key
- Module code accesses keys via the `KeyAPI` facade — never by importing raw key arrays directly
- Keys used across modules must be `isCalculated: false` (assignable) or `isCalculated: true` (derived) — never ambiguous
- Key IDs are immutable once deployed; renaming requires a data migration

19.3 BaseClient Type (`/shared/types/client.ts`)

All module-level Client interfaces MUST extend `BaseClient` from `/shared/types/client.ts`.

BaseClient provides: id, firstName, lastName, email, phone?, idNumber?, accountStatus?

Rules:
- Module-specific fields are added to the extending interface, not to BaseClient
- BaseClient must remain minimal — only fields needed by cross-module utilities belong here
- If a module's API returns a different field shape (e.g., snake_case), the api.ts layer normalises
  to BaseClient fields; the raw shape is typed separately as an internal DTO
- New shared fields require updating BaseClient AND all extending interfaces in the same change

Pull Request Checklist additions:
  [ ] No new query key arrays defined outside `/utils/queryKeys.ts`
  [ ] New financial data points registered in Universal Key Manager
  [ ] Module Client types extend BaseClient


Principles	Added multi-entry consistency principle
home
