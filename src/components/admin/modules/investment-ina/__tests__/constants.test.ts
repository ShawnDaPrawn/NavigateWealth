import { describe, expect, it } from 'vitest';
import { DEFAULT_ECONOMIC_ASSUMPTIONS, GOAL_TYPE_LABELS, RISK_PROFILE_LABELS } from '../constants';

describe('investment-ina/constants', () => {
  it('DEFAULT_ECONOMIC_ASSUMPTIONS has longTermInflationRate', () => {
    expect(typeof DEFAULT_ECONOMIC_ASSUMPTIONS.longTermInflationRate).toBe('number');
    expect(DEFAULT_ECONOMIC_ASSUMPTIONS.longTermInflationRate).toBeGreaterThan(0);
  });

  it('DEFAULT_ECONOMIC_ASSUMPTIONS.expectedRealReturns covers all profiles', () => {
    const returns = DEFAULT_ECONOMIC_ASSUMPTIONS.expectedRealReturns;
    expect(returns.conservative).toBeLessThan(returns.aggressive);
    expect(returns.moderate).toBeDefined();
    expect(returns.balanced).toBeDefined();
    expect(returns.growth).toBeDefined();
  });

  it('GOAL_TYPE_LABELS has labels for all goal types', () => {
    expect(typeof GOAL_TYPE_LABELS.education).toBe('string');
    expect(typeof GOAL_TYPE_LABELS['home-deposit']).toBe('string');
    expect(typeof GOAL_TYPE_LABELS.other).toBe('string');
  });

  it('RISK_PROFILE_LABELS covers all risk profiles', () => {
    expect(RISK_PROFILE_LABELS.conservative).toBe('Conservative');
    expect(RISK_PROFILE_LABELS.aggressive).toBe('Aggressive');
    expect(RISK_PROFILE_LABELS.balanced).toBeDefined();
  });
});
