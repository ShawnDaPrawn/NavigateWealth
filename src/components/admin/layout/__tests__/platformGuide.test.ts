import { describe, expect, it } from 'vitest';
import { moduleConfig, moduleGroups } from '../config';
import { PLATFORM_MODULES, renderPlatformGuide } from '../../../../shared/platform-guide';

/** Modules an outside AI agent is never sent to. */
const NOT_FOR_AGENTS = ['password-manager', 'locked'];

describe('Navigate Wealth platform map for AI agents', () => {
  it('names every sidebar module an agent could work in, with the sidebar’s own label', () => {
    const sidebar = moduleGroups
      .flatMap((g) => g.modules)
      .filter((m) => !NOT_FOR_AGENTS.includes(m));
    expect(PLATFORM_MODULES.map((m) => m.id).sort()).toEqual([...sidebar].sort());
    for (const m of PLATFORM_MODULES)
      expect(m.name).toBe(moduleConfig[m.id as keyof typeof moduleConfig].label);
  });

  it('gives each module a deep link into the admin panel', () => {
    expect(renderPlatformGuide()).toContain(
      'https://www.navigatewealth.co/admin?module=product-management',
    );
  });
});
