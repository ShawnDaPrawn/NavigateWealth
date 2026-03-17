/**
 * Shared Types — Barrel Export
 *
 * Single entry point for all shared types used by both
 * Frontend (React) and Backend (Hono Edge Function).
 *
 * Import convention:
 *   Frontend:  import type { AccountStatus } from '../../shared/types';
 *   Backend:   import type { AccountStatus } from './shared-types.ts'; // re-export
 *
 * §4.3: Each module must have exactly one barrel file.
 * §9.3: API response types must be synchronised between server and frontend.
 */

export type {
  // Client domain
  AccountStatus,
  ApplicationStatus,
  AccountType,
  UserRole,
  BaseClient,
  ClientSecurity,
  Address,
  StatusConfig,
  StatusConfigMap,

  // API response wrappers
  SuccessResponse,
  ErrorResponse,
  PaginatedResponse,
} from './client';

export type {
  // API contracts
  PaginationParams,
  SortParams,
  SearchParams,
  ListQueryParams,
  CreateResponse,
  UpdateResponse,
  DeleteResponse,
  DryRunParams,
  DryRunResult,
  HttpMethod,
} from './api';

export type {
  // Calendar domain
  EventType,
  EventStatus,
  LocationType,
  ReminderType,
  ReminderStatus,
  ReminderPriority,
  CalendarView,
  CalendarEvent,
  Reminder,
} from './calendar';

export type {
  // Logging & error types
  LogLevel,
  LogContext,
  AppError,
  ILogger,
} from './logger';