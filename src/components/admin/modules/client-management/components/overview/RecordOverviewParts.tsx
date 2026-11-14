/**
 * CM-Overview parts for the adviser's client record page: the compact pillar
 * tiles, the "What needs doing" card and the "Financial health" card.
 *
 * The client portal keeps its own overview (PillarCard, UnifiedActionItems);
 * these are only used when the overview sits inside the admin record page.
 */

import { useState } from 'react';
import { HEALTH_SUB_SCORE_CONFIG } from '../../constants';
import type { HealthSubScores } from '../../utils';
import type { PillarData } from '../clientOverview/pillars';
import type { ActionItem } from '../clientOverview/actionItems';
import type { ActionItemAction } from './ActionItems';
import { DsButton } from '../../../../layout/page';
import { cn } from '../../../../../ui/utils';

const HEALTH_PILL: Record<PillarData['health'], { tone: string; label: string }> = {
  healthy: { tone: 'ok', label: 'Healthy' },
  attention: { tone: 'warn', label: 'Review' },
  critical: { tone: 'bad', label: 'Shortfall' },
  'no-data': { tone: '', label: 'No data' },
};

const FNA_LINE: Record<string, string> = {
  published: 'FNA published',
  draft: 'FNA draft',
  not_started: 'No FNA',
  error: 'FNA error',
  loading: 'FNA …',
};

/** Which health sub-score belongs to which pillar. */
const PILLAR_SCORE: Record<string, keyof typeof HEALTH_SUB_SCORE_CONFIG> = {
  'risk-planning': 'risk',
  'medical-aid': 'medicalAid',
  retirement: 'retirement',
  investment: 'investments',
  estate: 'estatePlanning',
};

const meterTone = (score: number) => (score >= 75 ? 'ok' : score >= 40 ? 'warn' : 'bad');

export function PillarTiles({
  pillars,
  subScores,
  onOpen,
}: {
  pillars: PillarData[];
  subScores: HealthSubScores;
  onOpen?: () => void;
}) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
      {pillars.map((pillar) => {
        const pill = HEALTH_PILL[pillar.health];
        const key = PILLAR_SCORE[pillar.id];
        const hasData = key ? subScores.hasData[key] : false;
        const score = key ? subScores[key] : 0;
        const line = [
          `${pillar.policyCount} ${pillar.policyCount === 1 ? 'policy' : 'policies'}`,
          pillar.fnaStatus ? FNA_LINE[pillar.fnaStatus] : null,
        ]
          .filter(Boolean)
          .join(' · ');
        const Tag = onOpen ? 'button' : 'div';
        return (
          <Tag
            key={pillar.id}
            {...(onOpen ? { type: 'button' as const, onClick: onOpen } : {})}
            className={cn(
              'ds-card flex flex-col gap-2 p-3.5 text-left',
              onOpen && 'transition-colors hover:border-[#c4b5fd]',
            )}
          >
            <span className="flex items-center justify-between gap-2">
              <b className="text-[13.5px] font-semibold text-nw-ink">{pillar.title}</b>
              <span className={cn('ds-pill', pill.tone)}>{pill.label}</span>
            </span>
            <span
              className={cn('ds-meter', hasData && meterTone(score))}
              role="img"
              aria-label={hasData ? `${pillar.title} score ${score}%` : `${pillar.title}: no data`}
            >
              <i style={{ width: `${hasData ? Math.max(score, 2) : 0}%` }} />
            </span>
            <span className="ds-meta">{line}</span>
            <span className="ds-meta">
              {pillar.primaryValue} · {pillar.primaryLabel}
            </span>
          </Tag>
        );
      })}
    </div>
  );
}

const PRIORITY_PILL: Record<ActionItem['priority'], { tone: string; label: string }> = {
  urgent: { tone: 'bad', label: 'Act now' },
  attention: { tone: 'warn', label: 'Monitor' },
  recommended: { tone: '', label: 'Nice to have' },
};

const CATEGORY_LINE: Record<ActionItem['category'], string> = {
  fna: 'Financial review',
  coverage: 'Cover',
  renewal: 'Renewal',
  profile: 'Client info',
  compliance: 'Documents & compliance',
};

const COLLAPSED_COUNT = 6;

export function NeedsDoingCard({
  items,
  actionFor,
}: {
  items: ActionItem[];
  actionFor?: (item: ActionItem) => ActionItemAction | undefined;
}) {
  const [showAll, setShowAll] = useState(false);
  const shown = showAll ? items : items.slice(0, COLLAPSED_COUNT);
  return (
    <section className="ds-card min-w-0 overflow-hidden" aria-label="What needs doing">
      <div className="ds-card-h">
        <h2 className="ds-h2 !text-[15px]">What needs doing</h2>
        <span className="ds-meta">
          {items.length === 0
            ? 'Nothing outstanding'
            : `${items.length} ${items.length === 1 ? 'action' : 'actions'}`}
        </span>
      </div>
      {shown.map((item) => {
        const pill = PRIORITY_PILL[item.priority];
        const action = actionFor?.(item);
        return (
          <div key={item.id} className="ds-todo-row flex-wrap sm:flex-nowrap">
            <span className={cn('ds-pill w-[104px] shrink-0 justify-center', pill.tone)}>
              {pill.label}
            </span>
            <div className="grow min-w-0">
              <b className="block text-[13.5px] font-medium text-nw-ink">{item.title}</b>
              <span className="ds-meta">{item.detail || CATEGORY_LINE[item.category]}</span>
            </div>
            {action && (
              <DsButton size="sm" className="shrink-0 print:hidden" onClick={action.run}>
                {action.label}
              </DsButton>
            )}
          </div>
        );
      })}
      {items.length > COLLAPSED_COUNT && (
        <div className="border-t border-nw-line px-4 py-2.5 print:hidden">
          <DsButton size="sm" variant="ghost" onClick={() => setShowAll((v) => !v)}>
            {showAll ? 'Show fewer' : `Show all ${items.length}`}
          </DsButton>
        </div>
      )}
    </section>
  );
}

const SUB_SCORE_ORDER: Array<keyof typeof HEALTH_SUB_SCORE_CONFIG> = [
  'risk',
  'medicalAid',
  'retirement',
  'investments',
  'estatePlanning',
];

export function FinancialHealthCard({
  score,
  subScores,
}: {
  score: number;
  subScores: HealthSubScores;
}) {
  return (
    <section className="ds-card overflow-hidden" aria-label="Financial health">
      <div className="ds-card-h">
        <h2 className="ds-h2 !text-[15px]">Financial health</h2>
        <span className={cn('ds-pill', meterTone(score))}>Score {score}</span>
      </div>
      <div className="ds-card-b flex flex-col gap-3">
        {SUB_SCORE_ORDER.map((key) => {
          const value = subScores[key];
          const hasData = subScores.hasData[key];
          return (
            <div key={key} className="flex flex-col gap-1.5">
              <div className="flex justify-between text-[13.5px]">
                <span className="text-nw-text-2">{HEALTH_SUB_SCORE_CONFIG[key].label}</span>
                <b className="font-semibold text-nw-ink">{hasData ? `${value}%` : '—'}</b>
              </div>
              <div className={cn('ds-meter', hasData && meterTone(value))}>
                <i style={{ width: `${hasData ? Math.max(value, 2) : 0}%` }} />
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
