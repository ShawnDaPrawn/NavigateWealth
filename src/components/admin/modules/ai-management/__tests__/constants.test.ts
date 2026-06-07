import { describe, it, expect } from 'vitest';
import {
  ENDPOINTS,
  AGENT_STATUS_CONFIG,
  HANDOFF_STATUS_CONFIG,
  FEEDBACK_RATING_CONFIG,
  DEFAULT_AGENTS,
  QUERY_STALE_TIME,
  ANALYTICS_STALE_TIME,
  TAB_CONFIG,
  KB_ENTRY_TYPE_CONFIG,
  KB_STATUS_CONFIG,
  KB_DEFAULT_CATEGORIES,
} from '../constants';

describe('ai-management ENDPOINTS', () => {
  it('has static string endpoints for VASCO_CONFIG and AGENTS_LIST', () => {
    expect(typeof ENDPOINTS.VASCO_CONFIG).toBe('string');
    expect(typeof ENDPOINTS.AGENTS_LIST).toBe('string');
  });

  it('AGENT_DETAIL returns a URL containing the agent id', () => {
    expect(ENDPOINTS.AGENT_DETAIL('agent-1')).toContain('agent-1');
  });

  it('KB_DETAIL returns a URL containing the kb id', () => {
    expect(ENDPOINTS.KB_DETAIL('kb-42')).toContain('kb-42');
  });

  it('PROMPT_BUNDLE, PROMPT_DRAFT, PROMPT_PUBLISH return URLs with agentId and context', () => {
    expect(ENDPOINTS.PROMPT_BUNDLE('vasco', 'public')).toContain('vasco');
    expect(ENDPOINTS.PROMPT_BUNDLE('vasco', 'public')).toContain('public');
    expect(ENDPOINTS.PROMPT_DRAFT('vasco', 'public')).toContain('draft');
    expect(ENDPOINTS.PROMPT_PUBLISH('vasco', 'public')).toContain('publish');
  });
});

describe('AGENT_STATUS_CONFIG', () => {
  it('covers active, disabled, and maintenance statuses', () => {
    expect(AGENT_STATUS_CONFIG.active).toBeDefined();
    expect(AGENT_STATUS_CONFIG.disabled).toBeDefined();
    expect(AGENT_STATUS_CONFIG.maintenance).toBeDefined();
  });

  it('active has green badge, disabled has gray badge', () => {
    expect(AGENT_STATUS_CONFIG.active.badgeClass).toContain('green');
    expect(AGENT_STATUS_CONFIG.disabled.badgeClass).toContain('gray');
  });

  it('every status has label, badgeClass, and dotClass', () => {
    Object.values(AGENT_STATUS_CONFIG).forEach((cfg) => {
      expect(cfg.label.length).toBeGreaterThan(0);
      expect(cfg.badgeClass.length).toBeGreaterThan(0);
      expect(cfg.dotClass.length).toBeGreaterThan(0);
    });
  });
});

describe('HANDOFF_STATUS_CONFIG', () => {
  it('covers new, contacted, converted, and closed statuses', () => {
    expect(HANDOFF_STATUS_CONFIG.new).toBeDefined();
    expect(HANDOFF_STATUS_CONFIG.contacted).toBeDefined();
    expect(HANDOFF_STATUS_CONFIG.converted).toBeDefined();
    expect(HANDOFF_STATUS_CONFIG.closed).toBeDefined();
  });

  it('converted has green badge', () => {
    expect(HANDOFF_STATUS_CONFIG.converted.badgeClass).toContain('green');
  });
});

describe('FEEDBACK_RATING_CONFIG', () => {
  it('covers positive and negative ratings', () => {
    expect(FEEDBACK_RATING_CONFIG.positive).toBeDefined();
    expect(FEEDBACK_RATING_CONFIG.negative).toBeDefined();
  });

  it('positive has green badge, negative has red badge', () => {
    expect(FEEDBACK_RATING_CONFIG.positive.badgeClass).toContain('green');
    expect(FEEDBACK_RATING_CONFIG.negative.badgeClass).toContain('red');
  });

  it('each rating has label, badgeClass, and icon', () => {
    Object.values(FEEDBACK_RATING_CONFIG).forEach((cfg) => {
      expect(cfg.label.length).toBeGreaterThan(0);
      expect(cfg.icon.length).toBeGreaterThan(0);
    });
  });
});

describe('DEFAULT_AGENTS', () => {
  it('is a non-empty array', () => {
    expect(Array.isArray(DEFAULT_AGENTS)).toBe(true);
    expect(DEFAULT_AGENTS.length).toBeGreaterThan(0);
  });

  it('every agent has id, name, model, status, and features', () => {
    DEFAULT_AGENTS.forEach((agent) => {
      expect(agent.id.length).toBeGreaterThan(0);
      expect(agent.name.length).toBeGreaterThan(0);
      expect(agent.model.length).toBeGreaterThan(0);
      expect(agent.status).toBeDefined();
      expect(agent.features).toBeDefined();
    });
  });

  it('contains vasco-public and advice-engine agents', () => {
    const ids = DEFAULT_AGENTS.map((a) => a.id);
    expect(ids).toContain('vasco-public');
    expect(ids).toContain('advice-engine');
  });

  it('vasco-public agent has handoff and streaming enabled', () => {
    const vasco = DEFAULT_AGENTS.find((a) => a.id === 'vasco-public');
    expect(vasco?.features.handoffEnabled).toBe(true);
    expect(vasco?.features.streamingEnabled).toBe(true);
  });
});

describe('query timing constants', () => {
  it('ANALYTICS_STALE_TIME > QUERY_STALE_TIME', () => {
    expect(ANALYTICS_STALE_TIME).toBeGreaterThan(QUERY_STALE_TIME);
  });

  it('both timing constants are positive numbers', () => {
    expect(QUERY_STALE_TIME).toBeGreaterThan(0);
    expect(ANALYTICS_STALE_TIME).toBeGreaterThan(0);
  });
});

describe('TAB_CONFIG', () => {
  it('is a non-empty array with id, label, and icon fields', () => {
    expect(TAB_CONFIG.length).toBeGreaterThan(0);
    TAB_CONFIG.forEach((tab) => {
      expect(tab.id.length).toBeGreaterThan(0);
      expect(tab.label.length).toBeGreaterThan(0);
      expect(tab.icon.length).toBeGreaterThan(0);
    });
  });

  it('contains dashboard, agents, knowledge-base, and analytics tabs', () => {
    const ids = TAB_CONFIG.map((t) => t.id);
    expect(ids).toContain('dashboard');
    expect(ids).toContain('agents');
    expect(ids).toContain('knowledge-base');
    expect(ids).toContain('analytics');
  });
});

describe('KB_ENTRY_TYPE_CONFIG', () => {
  it('covers qa, article, snippet, faq, and policy types', () => {
    expect(KB_ENTRY_TYPE_CONFIG.qa).toBeDefined();
    expect(KB_ENTRY_TYPE_CONFIG.article).toBeDefined();
    expect(KB_ENTRY_TYPE_CONFIG.snippet).toBeDefined();
    expect(KB_ENTRY_TYPE_CONFIG.faq).toBeDefined();
    expect(KB_ENTRY_TYPE_CONFIG.policy).toBeDefined();
  });

  it('every type has label, icon, badgeClass, and description', () => {
    Object.values(KB_ENTRY_TYPE_CONFIG).forEach((cfg) => {
      expect(cfg.label.length).toBeGreaterThan(0);
      expect(cfg.icon.length).toBeGreaterThan(0);
      expect(cfg.badgeClass.length).toBeGreaterThan(0);
      expect(cfg.description.length).toBeGreaterThan(0);
    });
  });
});

describe('KB_STATUS_CONFIG', () => {
  it('covers draft, active, and archived statuses', () => {
    expect(KB_STATUS_CONFIG.draft).toBeDefined();
    expect(KB_STATUS_CONFIG.active).toBeDefined();
    expect(KB_STATUS_CONFIG.archived).toBeDefined();
  });

  it('active has green badge', () => {
    expect(KB_STATUS_CONFIG.active.badgeClass).toContain('green');
  });
});

describe('KB_DEFAULT_CATEGORIES', () => {
  it('is a non-empty array of strings', () => {
    expect(KB_DEFAULT_CATEGORIES.length).toBeGreaterThan(0);
    KB_DEFAULT_CATEGORIES.forEach((cat) => expect(typeof cat).toBe('string'));
  });

  it('contains Financial Planning and Retirement categories', () => {
    expect(KB_DEFAULT_CATEGORIES).toContain('Financial Planning');
    expect(KB_DEFAULT_CATEGORIES).toContain('Retirement');
  });
});
