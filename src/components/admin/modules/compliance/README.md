# Compliance Module

## Purpose

Centralises all regulatory compliance tracking for the Navigate Wealth platform, covering FAIS, AML/FICA, POPI/PAIA, statutory reporting, TCF, record keeping, debarment, conflicts of interest, documents and insurance, new business, and complaints.

## Architecture

- **Query hooks**: `useComplianceQueries.ts` is the single source of truth for all compliance data fetching. It exports a `complianceKeys` factory and individual hooks per compliance domain, all using React Query with consistent `staleTime` and `gcTime` from `constants.ts`.
- **Mutation hooks**: `useComplianceMutations.ts` provides create/update/delete operations per domain, with automatic cache invalidation via the `complianceKeys` factory.
- **Legacy hooks**: The original `useState`/`useEffect` hooks (`useFAISRecords.ts`, `useStatutoryRecords.ts`, etc.) are retained and re-exported as `*Legacy` from the barrel for backward compatibility. New code should use the React Query versions exclusively.
- **API layer**: Split by compliance domain (`faisApi`, `amlFicaApi`, etc.) in `api.ts`, each with typed request/response contracts.

## Key Constraints

- This module has one of the strictest compliance requirements in the codebase. All data access must respect RLS policies.
- Never log personal client data (names, ID numbers, financial details) in any compliance hook or API call.
- The barrel export (`hooks/index.ts`) is the only public API. Do not import individual hook files from outside this module.
