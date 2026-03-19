Navigate Wealth Admin Panel

Production Engineering, Architecture & Design System Guidelines (v5)

1. Purpose and Scope

These guidelines define how code, UI, and architecture must be structured and evolved within the Navigate Wealth Admin Panel.

They exist to:

Reduce cognitive load in a large TypeScript codebase
Prevent architectural drift and accidental coupling
Lower production and compliance risk in a regulated financial environment
Enable safe, incremental improvement without rewrites
Ensure consistent UI and UX through a central Design System and established patterns
Maintain professional standards appropriate to a wealth management platform
These guidelines prioritise clear boundaries, predictable structure, and consistency over clever abstractions or premature optimisation.

This document is not a rewrite mandate.
All changes must be incremental, low-risk, and reversible.

2. Rule Hierarchy (Authoritative)
Not all rules have equal weight. Enforcement and review decisions must follow this hierarchy.

Tier 1 — Non-Negotiable (Production or Compliance Risk)
Violations here represent real risk and must be fixed.

Dependency direction and module boundaries
Boundary typing (API, database, external integrations)
No logging of PII or sensitive client data
RLS enforcement for all sensitive data
Consistent error contracts
No business logic in UI components
Design System adherence for shared UI primitives
Consistent visual language across the admin panel
**SHARED CODE must be pure (no side effects, no database calls)**
Tier 2 — Strong Standards (Technical Debt Control)
Violations accumulate technical debt and should be addressed.

Module structure consistency
API ↔ Hooks separation
Query key and cache invalidation discipline
File size and responsibility thresholds
Logging and observability standards
Use of Design System components instead of ad-hoc UI
Consistent spacing, typography, and layout patterns
Accessibility standards (WCAG 2.1 AA minimum)
Tier 3 — Guidelines (Review and Justification)
Violations may be acceptable with documented justification.

Component splitting heuristics
Performance optimisations
UI composition patterns within modules
Animation and transition choices
Micro-interaction details
3. Core Architectural Principles
3.1 Dependency Direction (Non-Negotiable)
All dependencies must flow inward:

Presentation (UI) → Hooks → API → **Shared (Logic/Types)**
Rules:

Business logic must never depend on UI frameworks, routing, or rendering concerns
A module directory is a hard boundary
No code outside a module may access its internals directly
Cross-module access is permitted only through explicitly exported public APIs
Circular dependencies are structural defects and must be removed
This ensures predictable change impact and prevents hidden coupling.

4. Shared Architecture (The Bridge)
To prevent "Split Brain" between Frontend and Backend, we use a Shared Code Strategy.

**Location:** `/shared`
**Contents:** Types, Validation Schemas (Zod), Pure Utility Functions.
**Forbidden:** Database calls, API calls, React Components, Node.js specific APIs.

**Usage Rules:**
1.  **Frontend**: Import via relative paths: `import { x } from '../../shared/modules/y'`
2.  **Backend**: Import via mapped alias: `import { x } from '@shared/modules/y'`
3.  **Synchronization**: The `/shared` folder is synced to `/supabase/functions/server/_shared` at build time.

5. Module Structure (Boundary Contract)
Each module represents one domain responsibility and must follow a consistent internal structure.

Every module must be split across the three layers:

**1. Shared Layer (`/shared/modules/<name>/`)**
- `types.ts`: Domain interfaces
- `validation.ts`: Zod schemas
- `utils.ts`: Pure logic (filtering, sorting, math)

**2. Frontend Layer (`/components/admin/modules/<name>/`)**
- `index.tsx`: Entry point
- `api.ts`: API client
- `hooks/`: React Query hooks
- `components/`: UI components

**3. Backend Layer (`/supabase/functions/server/`)**
- `<name>-service.ts`: Data access, KV operations, logging. Uses `@shared` validation.

6. File Responsibility by Layer
6.1 API Layer (Data and Integration Boundary)
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
Decorative logging (emojis, verbose traces) is permitted only in development and must not reach production
6.2 Types Layer (Single Source of Truth, Scoped)
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
Over-exporting types increases coupling and refactor cost.

6.3 Constants and Configuration
All non-trivial constants must be centralised and typed, including:

Labels and enum mappings
UI status/state mappings
Default filters
Query behaviour (stale times, debounce values)
Date, number, and currency formats
Table column configurations
Navigation breadcrumbs
Typed mappings are mandatory to prevent drift.

7. Hooks (Data Access Layer)
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
8. Presentation Layer (UI)
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
9. Design System Integration (Non-Negotiable for Shared UI)
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
9.1 Fundamental Rule: Preserve Existing UI Standards
When the Design System does not explicitly define a pattern, defer to the existing UI patterns already established in the Navigate Wealth Admin Panel.

Survey similar components across modules before creating new UI
Match existing spacing, sizing, and interaction patterns
Maintain visual consistency with established conventions
Document deviations only when intentional and justified
The goal is cohesive evolution, not fragmentation.

9.2 Design System Rules
Tier 1 (Non-Negotiable):

Shared UI components must come from the Design System
Visual tokens (colours, spacing, fonts) must never be hard-coded outside the Design System
If the Design System does not support a required pattern, it must be extended rather than bypassed
Tier 2 (Strong Standards):

Modules may create composed components, but must not re-implement primitives
Custom UI must use Design System tokens for spacing, colour, and typography
Complex components should compose Design System primitives
The Design System is treated as infrastructure, not a convenience library.

9.3 UI Standards for Navigate Wealth Admin Panel
Visual Hierarchy:

Primary actions use high-contrast, prominent buttons
Secondary actions use lower-contrast styling
Destructive actions require confirmation and use warning colours
Data Presentation:

Financial data must be formatted consistently (currency, percentages)
Dates follow a standard format across all modules
Status indicators use consistent colour coding and iconography
Tables use consistent column sizing, sorting, and filtering patterns
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
Success feedback is brief and non-intrusive
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
9.4 AI Builder Guidelines
AI builders operating on the codebase must:

Reference the Design System for all UI construction
Survey existing module implementations for established patterns
Fill in missing details using Design System tokens and components
Avoid introducing parallel UI abstractions
Match the visual language of existing admin panel UI
Document any new patterns that emerge
When changing client-facing schema, KV key patterns, portfolio summary logic, FNA/INA storage, communication history, or document history, update the authenticated Ask Vasco context (`/ai-advisor`, agent `vasco-authenticated`) in the same logical change
Prefer reusing shared client-context aggregators and maintain backwards-compatible reads during migrations so authenticated Ask Vasco remains informed while schemas evolve
10. TypeScript Standards
10.1 Type Safety (Strict by Default)
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

10.2 Type Organisation
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
}

// Input types
export interface CreateClientInput {
  name: string;
  email: string;
  status?: ClientStatus;
}

// UI types (internal, not exported)
interface ClientListItem extends Client {
  // Additional derived properties for display
}
11. Error Handling and Observability
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
12. State Management
12.1 Client (UI) State
Local UI concerns only:

Modal visibility
Form input values
Filter selections
Table sorting and pagination
Accordion/collapse states
Keep state close to where it is used.
Avoid unnecessary lifting or globalisation.

12.2 Server State
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
13. Validation and Security (Financial Domain)
13.1 Validation
Client-side validation for UX:

Immediate feedback to users
Format guidance
Required field enforcement
Server-side validation for security:

All inputs validated again on server
Business rule enforcement
Data integrity checks
Error messages must be:

Clear and actionable
Appropriate for financial professionals
Specific about what went wrong
13.2 Security (Non-Negotiable)
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
14. Performance and Bundling
Performance rules are context-aware:

Frontend:

Lazy loading is encouraged for route-level code splitting
Debounce search inputs (300-500ms typical)
Virtualise long lists (100+ items)
Paginate large datasets
Cache expensive computations with useMemo
Memoize callbacks with useCallback only when necessary
Server/Edge:

Avoid dynamic imports in server or edge runtimes
Batch database queries where possible
Use database indexes for common queries
General:

Optimise only after correctness and clarity are established
Do not micro-optimise trivial paths
Measure before optimising
Document performance-critical sections
15. Testing Strategy (Risk-Based)
Testing focuses on what can break production, not coverage percentages.

Priority areas:

Business rules and calculations (Unit Tests on Shared Logic)
Validation logic (Unit Tests on Shared Logic)
API error handling
Critical user workflows
Compliance-sensitive paths
Financial calculations
Data transformations
Avoid:

Snapshot spam
Testing third-party internals
Trivial rendering tests without behavioural value
Over-mocking (test real integration points)
Testing levels:

Unit tests for utilities and business logic
Integration tests for hooks and API layers
End-to-end tests for critical workflows
16. Documentation and Governance
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
17. Enforcement and Process
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
18. Definition of Done (Authoritative)
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
When rules conflict with reality, document the exception and evolve the standard.

The goal is shared understanding and long-term safety, not blind compliance.
