/**
 * Pipeline labels/colours, interval options, and the form shape for the
 * content sources manager. Moved verbatim from ContentSourcesManager.tsx.
 */
import type { PipelineId } from '../types';

export const PIPELINE_LABELS: Record<PipelineId, string> = {
  market_commentary: 'Market Commentary',
  regulatory_monitor: 'Regulatory Monitor',
  news_commentary: 'News Commentary',
  calendar_content: 'Calendar Content',
};

export const PIPELINE_COLORS: Record<PipelineId, string> = {
  market_commentary: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  regulatory_monitor: 'bg-blue-100 text-blue-700 border-blue-200',
  news_commentary: 'bg-purple-100 text-purple-700 border-purple-200',
  calendar_content: 'bg-amber-100 text-amber-700 border-amber-200',
};

export const INTERVAL_OPTIONS = [
  { value: 0, label: 'No minimum' },
  { value: 1, label: 'Every hour' },
  { value: 3, label: 'Every 3 hours' },
  { value: 6, label: 'Every 6 hours' },
  { value: 12, label: 'Every 12 hours' },
  { value: 24, label: 'Once a day' },
  { value: 48, label: 'Every 2 days' },
  { value: 168, label: 'Once a week' },
];

export const EMPTY_FORM: FormState = {
  name: '',
  url: '',
  pipelines: [],
  isActive: true,
  checkIntervalHours: 24,
  maxArticlesPerRun: 1,
  maxArticlesPerDay: 2,
  maxArticlesPerWeek: 5,
  filterKeywords: '',
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface FormState {
  name: string;
  url: string;
  pipelines: PipelineId[];
  isActive: boolean;
  checkIntervalHours: number;
  maxArticlesPerRun: number;
  maxArticlesPerDay: number;
  maxArticlesPerWeek: number;
  filterKeywords: string;
}
