/**
 * Admin Applications Service
 * Handles business logic for admin operations on applications.
 *
 * Facade: the method bodies live in the applications-service-* slices
 * (queries, decisions, invites, maintenance, helpers); this class binds them
 * so callers keep the AdminApplicationsService.x(...) call shape.
 */
import { getApplications, getApplicationById, getStats } from './applications-service-queries.ts';
import {
  approveApplication,
  declineApplication,
  updateApplicationData,
} from './applications-service-decisions.ts';
import { inviteApplicant, resendInvite } from './applications-service-invites.ts';
import {
  clearApplications,
  deleteApplication,
  migrateApplications,
  deprecateApplications,
  getDeprecatedApplications,
  undeprecateApplications,
  getAllKeys,
  deleteKey,
  nuclearClear,
} from './applications-service-maintenance.ts';

export class AdminApplicationsService {
  static getApplications = getApplications;
  static getApplicationById = getApplicationById;
  static approveApplication = approveApplication;
  static declineApplication = declineApplication;
  static updateApplicationData = updateApplicationData;
  static inviteApplicant = inviteApplicant;
  static resendInvite = resendInvite;
  static getStats = getStats;
  static clearApplications = clearApplications;
  static deleteApplication = deleteApplication;
  static migrateApplications = migrateApplications;
  static deprecateApplications = deprecateApplications;
  static getDeprecatedApplications = getDeprecatedApplications;
  static undeprecateApplications = undeprecateApplications;
  static getAllKeys = getAllKeys;
  static deleteKey = deleteKey;
  static nuclearClear = nuclearClear;
}
