import { describe, expect, it } from 'vitest';
import {
  TEAM_IMAGES,
  SERVICE_IMAGES,
  PLACEHOLDER_COLORS,
  IMAGE_PRIORITIES,
  RECOMMENDED_SIZES,
} from '../imageConstants';

describe('imageConstants', () => {
  it('TEAM_IMAGES has michael, sarah, and david entries', () => {
    expect(typeof TEAM_IMAGES.michael).toBe('string');
    expect(typeof TEAM_IMAGES.sarah).toBe('string');
    expect(typeof TEAM_IMAGES.david).toBe('string');
  });

  it('TEAM_IMAGES URLs reference unsplash', () => {
    expect(TEAM_IMAGES.michael).toContain('unsplash');
    expect(TEAM_IMAGES.sarah).toContain('unsplash');
  });

  it('SERVICE_IMAGES has expected service keys', () => {
    expect(typeof SERVICE_IMAGES.riskManagement).toBe('string');
    expect(typeof SERVICE_IMAGES.retirementPlanning).toBe('string');
    expect(typeof SERVICE_IMAGES.investmentManagement).toBe('string');
    expect(typeof SERVICE_IMAGES.financialPlanning).toBe('string');
  });

  it('PLACEHOLDER_COLORS has hex values', () => {
    expect(PLACEHOLDER_COLORS.purple).toMatch(/^#/);
    expect(PLACEHOLDER_COLORS.gray).toMatch(/^#/);
  });

  it('IMAGE_PRIORITIES has hero, card, and avatar keys', () => {
    expect(IMAGE_PRIORITIES.hero).toBe('high');
    expect(IMAGE_PRIORITIES.belowFold).toBe('low');
    expect(IMAGE_PRIORITIES.card).toBe('auto');
  });

  it('RECOMMENDED_SIZES has dimensions for hero and card', () => {
    expect(RECOMMENDED_SIZES.hero.width).toBeGreaterThan(0);
    expect(RECOMMENDED_SIZES.card.width).toBeGreaterThan(0);
    expect(RECOMMENDED_SIZES.avatar.width).toBeGreaterThan(0);
  });
});
