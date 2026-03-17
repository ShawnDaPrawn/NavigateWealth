# Requests Module

## Purpose

Manages the full lifecycle of administrative and quote requests, from template definition through compliance review, lifecycle stages, sign-off, and finalisation. Templates are blueprints; requests are runtime instances.

## Architecture

- **Templates**: Defined via a multi-step wizard (basics, fields, assignees, compliance, lifecycle, sign-off, finalisation). Stored in KV with versioning support.
- **Requests**: Created from templates, progressing through configurable lifecycle stages with SLA tracking and compliance checkpoints.
- **Hooks**: `useRequests` and `useTemplates` use React Query with keys from `hooks/queryKeys.ts`. CRUD operations use `useMutation` with automatic cache invalidation.
- **Single-item hooks**: `useRequest(id)` and `useTemplate(id)` provide detail-level queries with `enabled` guards.

## Key Constraints

- Templates support versioning: updating an active template can create a new version rather than mutating in place.
- Archive (soft delete) is used for templates, not hard delete, to preserve compliance history.
- All `any` types in the audit log (`AuditLogEntry`) have been replaced with `unknown` for type safety.
