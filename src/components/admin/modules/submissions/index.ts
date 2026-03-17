/**
 * Submissions Manager — Public Barrel
 *
 * Single entry point for this module per §4.3.
 * UI aligned to TaskManagementModule pattern (§8.1).
 */

export { SubmissionsModule } from './SubmissionsModule';
export { SubmissionsSkeleton } from './components/SubmissionsSkeleton';
export type { Submission, SubmissionType, SubmissionStatus } from './types';
export { submissionsApi } from './api';