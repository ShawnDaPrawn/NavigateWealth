# Publications Module

## Purpose

Manages articles, categories, and content types for the Navigate Wealth knowledge base and client-facing content. Supports CRUD operations, rich text editing, and market news feeds.

## Architecture

- **Hooks**: `useArticles`, `useCategories`, and `useTypes` all use React Query with keys from `hooks/queryKeys.ts`. Client-side filtering/sorting (e.g., `activeOnly`, `autoSort`) is applied as `useMemo` derivations over cached server data rather than separate API calls.
- **Mutations**: `useArticleActions`, `useCategoryActions`, and `useTypeActions` wrap mutation operations and invalidate the appropriate query keys on success.
- **Form state**: `useArticleForm` manages local form editing state (title, body, metadata) separately from server state.

## Key Constraints

- Categories and types support `sort_order` for deterministic display ordering.
- The barrel export (`hooks/index.ts`) is the only public API for this module's hooks.
