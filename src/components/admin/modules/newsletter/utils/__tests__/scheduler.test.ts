import { describe, expect, it } from 'vitest';
import type { NewsletterProcessorState } from '../../types';
import { SCHEDULER_STALE_AFTER_MS, schedulerHealth } from '../scheduler';

const NOW = new Date('2026-09-05T10:00:00.000Z').getTime();

function state(overrides: Partial<NewsletterProcessorState>): NewsletterProcessorState {
  return {
    mode: 'cron',
    lastRunAt: new Date(NOW).toISOString(),
    lastCronRunAt: new Date(NOW - 20_000).toISOString(),
    lastSuccessAt: new Date(NOW).toISOString(),
    lastError: null,
    lastHeartbeatAt: new Date(NOW).toISOString(),
    activeCampaignCount: 0,
    processedInLastRun: 0,
    sentInLastRun: 0,
    failedInLastRun: 0,
    ...overrides,
  };
}

describe('schedulerHealth', () => {
  it('reports unknown before any run has been recorded', () => {
    expect(schedulerHealth(null, NOW).level).toBe('unknown');
  });

  it('reports missing when only the browser accelerator has ever run', () => {
    expect(schedulerHealth(state({ mode: 'manual', lastCronRunAt: null }), NOW).level).toBe(
      'missing',
    );
  });

  it('reports live for a recent cron check-in and stale once it goes quiet', () => {
    expect(schedulerHealth(state({}), NOW).level).toBe('live');
    const quiet = new Date(NOW - SCHEDULER_STALE_AFTER_MS - 1).toISOString();
    expect(schedulerHealth(state({ lastCronRunAt: quiet }), NOW).level).toBe('stale');
  });
});
