/**
 * Vasco Chat — Shared Types
 *
 * Canonical type definitions shared between the public AskVascoPage
 * and the logged-in AIAdvisorPage (Ask Vasco portal).
 *
 * @module shared/vasco-chat/types
 */

export interface VascoChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  citations?: VascoCitation[];
  feedback?: 'positive' | 'negative' | null;
  artifacts?: VascoChatArtifact[];
}

export interface VascoCitation {
  title: string;
  slug: string;
  url: string;
}

export interface VascoChatSessionSummary {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  lastMessagePreview: string;
  messageCount: number;
  legacyImported?: boolean;
}

export interface VascoArtifactMetric {
  label: string;
  value: string;
  helper?: string;
  tone?: 'neutral' | 'positive' | 'negative' | 'accent';
}

export interface VascoMetricCardsArtifact {
  type: 'metric_cards';
  title?: string;
  metrics: VascoArtifactMetric[];
}

export interface VascoAssumptionsArtifact {
  type: 'assumptions';
  title?: string;
  items: Array<{
    label: string;
    value: string;
    note?: string;
  }>;
}

export interface VascoProjectionNoteArtifact {
  type: 'projection_note';
  title?: string;
  body: string;
  tone?: 'neutral' | 'warning' | 'success';
}

export interface VascoTableArtifact {
  type: 'table';
  title?: string;
  columns: string[];
  rows: Array<Record<string, string | number | null>>;
}

export interface VascoChartSeriesArtifact {
  key: string;
  label: string;
  color?: string;
}

export interface VascoLineChartArtifact {
  type: 'line_chart';
  title?: string;
  categoryKey: string;
  series: VascoChartSeriesArtifact[];
  data: Array<Record<string, string | number>>;
  valueFormat?: 'currency' | 'percent' | 'number';
}

export interface VascoBarChartArtifact {
  type: 'bar_chart';
  title?: string;
  categoryKey: string;
  series: VascoChartSeriesArtifact[];
  data: Array<Record<string, string | number>>;
  valueFormat?: 'currency' | 'percent' | 'number';
}

export type VascoChatArtifact =
  | VascoMetricCardsArtifact
  | VascoAssumptionsArtifact
  | VascoProjectionNoteArtifact
  | VascoTableArtifact
  | VascoLineChartArtifact
  | VascoBarChartArtifact;

/**
 * SSE stream event types emitted by `/vasco/chat/stream`
 * and `/ai-advisor/chat/stream`.
 */
export type VascoStreamEvent =
  | { type: 'chunk'; content: string }
  | { type: 'done'; sessionId: string; citations: VascoCitation[]; artifacts?: VascoChatArtifact[] }
  | { type: 'error'; message: string };
