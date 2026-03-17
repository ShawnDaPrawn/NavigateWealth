# Client Management Module

## Purpose

Central hub for viewing, editing, and managing client records. This is the highest-traffic admin module and the primary entry point for advisers interacting with client data.

## Architecture

- **Data flow**: `useClientList` (React Query) fetches the full client list from the server; transformation from `ApiUser` to `Client` happens in the hook layer, not in UI components.
- **Profile editing**: `useClientProfile` is intentionally a hybrid hook (React Query fetch + local form state) because profile editing involves extensive local UI state (edit modes, delete confirmations, currency display values). The initial data load uses the backend API; edits are tracked locally until saved.
- **Lifecycle operations** (suspend, unsuspend, soft-delete): Handled via `useClientActions`, which calls dedicated server endpoints. These endpoints enforce multi-entry KV consistency (security + profile entries updated together per Guidelines 12.3).

## Key Constraints

- **Multi-entry consistency**: Any lifecycle state change must update both `security:{userId}` and `user_profile:{userId}:personal_info` KV entries atomically. See Guidelines 5.4 and 12.3.
- **Derived display state**: Account status displayed in the UI is derived via `deriveAccountStatus()` in `utils.ts`, not inline in JSX (Guidelines 7.1).
- **Downstream guards**: The communication module cross-references `accountStatus` and security flags before including clients in recipient lists.

## Query Keys

Centralised in `hooks/queryKeys.ts`. All cache invalidation must use these keys to prevent stale data.
