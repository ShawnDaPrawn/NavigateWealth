/**
 * AI Management Module — Public Barrel
 *
 * Single entry point for this module per §4.3.
 */

export { AIManagementModule } from './AIManagementModule';
export { AIManagementSkeleton } from './components/AIManagementSkeleton';
export type {
  AIAgentConfig,
  AnalyticsSummary,
  FeedbackEntry,
  HandoffRequest,
  KBEntry,
  KBEntryType,
  KBEntryStatus,
  KBStats,
} from './types';
