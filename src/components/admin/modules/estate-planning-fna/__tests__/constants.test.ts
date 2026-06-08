import { describe, expect, it } from 'vitest';
import { ESTATE_PLANNING_CONSTANTS } from '../constants';

describe('estate-planning-fna/constants', () => {
  it('ESTATE_PLANNING_CONSTANTS has ESTATE_DUTY_RATE', () => {
    expect(ESTATE_PLANNING_CONSTANTS.ESTATE_DUTY_RATE).toBe(0.2);
  });

  it('ESTATE_PLANNING_CONSTANTS has a positive ESTATE_DUTY_ABATEMENT', () => {
    expect(ESTATE_PLANNING_CONSTANTS.ESTATE_DUTY_ABATEMENT).toBeGreaterThan(0);
  });

  it('ESTATE_PLANNING_CONSTANTS has executor fee and conveyancing defaults', () => {
    expect(ESTATE_PLANNING_CONSTANTS.DEFAULT_EXECUTOR_FEE_PERCENTAGE).toBeGreaterThan(0);
    expect(ESTATE_PLANNING_CONSTANTS.DEFAULT_CONVEYANCING_FEE_PER_PROPERTY).toBeGreaterThan(0);
  });

  it('ESTATE_PLANNING_CONSTANTS has liquidity thresholds', () => {
    expect(ESTATE_PLANNING_CONSTANTS.LIQUIDITY_SHORTFALL_SEVERE_THRESHOLD).toBeGreaterThan(
      ESTATE_PLANNING_CONSTANTS.LIQUIDITY_SHORTFALL_MODERATE_THRESHOLD,
    );
  });

  it('ESTATE_PLANNING_CONSTANTS CGT inclusion rate is 0.4', () => {
    expect(ESTATE_PLANNING_CONSTANTS.CGT_INCLUSION_RATE_INDIVIDUAL).toBe(0.4);
  });
});
