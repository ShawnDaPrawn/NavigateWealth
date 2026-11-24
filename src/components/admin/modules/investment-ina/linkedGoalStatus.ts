/**
 * Which investment policies a client's goals rely on, and how each goal stands.
 *
 * Goals are captured in the goals analysis (this module's wizard) and nowhere
 * else: the standalone goal planner, which kept a second, simpler list of
 * goals with its own maths, was retired in 2026-11 so that an adviser sees one
 * answer to "is this goal on track?". The policy tables mark each linked
 * investment from the latest PUBLISHED analysis, the one the client also sees.
 */
import type { GoalStatus, InvestmentINASession } from './types';

/** What a policy table shows under an investment that funds a goal. */
export interface InvestmentGoalLink {
  name: string;
  status: 'On Track' | 'At Risk' | 'Critical';
  /** The goal's target in today's rands. */
  targetAmount?: number;
  /** Extra each month needed to close the gap (0 when on track). */
  requiredMonthly?: number;
  targetDate?: string;
}

const STATUS_LABEL: Record<GoalStatus, InvestmentGoalLink['status']> = {
  'on-track': 'On Track',
  overfunded: 'On Track',
  'slight-shortfall': 'At Risk',
  'moderate-shortfall': 'At Risk',
  'significant-shortfall': 'Critical',
};

const SEVERITY: Record<InvestmentGoalLink['status'], number> = {
  'On Track': 0,
  'At Risk': 1,
  Critical: 2,
};

/**
 * Policy id → the goal it funds. An investment earmarked for several goals is
 * marked with the goal in the worst state, so a shortfall is never hidden
 * behind a goal that happens to be on track.
 */
export function goalLinksByPolicyId(
  session: Pick<InvestmentINASession, 'inputs' | 'results'> | null | undefined,
): Record<string, InvestmentGoalLink> {
  const goals = session?.inputs?.goals ?? [];
  const results = session?.results?.goalResults ?? [];
  const links: Record<string, InvestmentGoalLink> = {};

  for (const goal of goals) {
    const result = results.find((r) => r.goalId === goal.id);
    if (!result) continue;
    const link: InvestmentGoalLink = {
      name: goal.goalName,
      status: STATUS_LABEL[result.goalStatus] ?? 'At Risk',
      targetAmount: goal.goalAmountToday,
      requiredMonthly: result.requiredContributions?.requiredAdditionalMonthly ?? 0,
      targetDate: goal.targetDate,
    };
    for (const policyId of goal.linkedInvestmentIds ?? []) {
      const existing = links[policyId];
      if (!existing || SEVERITY[link.status] > SEVERITY[existing.status]) {
        links[policyId] = link;
      }
    }
  }

  return links;
}
