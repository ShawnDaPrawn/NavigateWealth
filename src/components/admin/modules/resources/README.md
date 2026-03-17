# Resources Module

## Purpose

Provides a library of dynamic forms, legal templates, letter templates, and request forms that advisers use in client-facing workflows. Supports a block-based form builder for creating and editing resource templates.

## Architecture

- **Data fetching**: `useResources` uses React Query for the resource list. The full list is always fetched (no server-side filtering); category, search, and client-type filters are applied client-side via `useMemo` for responsive filtering without extra API calls.
- **Mutations**: Create, update, delete, and duplicate operations use `useMutation` with automatic cache invalidation.
- **Filter state**: Filter/sort state is local UI state (`useState`) per Guidelines 11.1, not stored in the query cache.
- **Form builder**: The `builder/` subdirectory contains the block-based editor types (`FormBlock`, `BlockData`, etc.) and rendering components.
- **Letter rendering**: `LetterRenderer` and `LetterheadPdfLayout` handle letterhead-style PDF generation with company branding.

## Query Keys

Centralised in `hooks/queryKeys.ts`.

## Key Constraints

- `FormDefinition.component` is a React component reference (not a string), assigned at transformation time based on the resource category.
- Block data types use `unknown` (not `any`) for the index signature to maintain type safety.
