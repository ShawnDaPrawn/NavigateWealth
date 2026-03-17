# Product Management Module

## Purpose

Manages financial product providers and product category schemas (field definitions). Allows administrators to configure what data fields are collected for each product category (e.g., life insurance, retirement annuity).

## Architecture

- **Providers**: `useProviders` uses React Query for the provider list with client-side duplicate name checking before create/update. Mutations use toast-based loading/success/error feedback.
- **Product schemas**: `useProductSchema` is a hybrid hook: the initial schema fetch uses React Query, while local field edits (add, remove, reorder fields) remain in `useState` as legitimate UI state. The dirty flag (`hasUnsavedChanges`) tracks divergence from the persisted schema.
- **Defaults**: `defaults.ts` provides fallback field definitions per product category, used when no persisted schema exists in the KV store.

## Query Keys

Centralised in `hooks/queryKeys.ts`. Schema keys include the `categoryId` parameter for per-category cache granularity.

## Key Constraints

- Provider name uniqueness is enforced client-side before API calls; the server may also enforce this.
- Schema saves reload from the server after persistence to pick up any server-side normalisation.
