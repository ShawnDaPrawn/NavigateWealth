import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';

vi.mock('../api', () => ({
  PublicationsAPI: {
    Templates: {
      getTemplates: vi.fn().mockResolvedValue([]),
      createTemplate: vi.fn(),
      updateTemplate: vi.fn(),
      deleteTemplate: vi.fn(),
    },
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
});

import { ContentTemplates } from '../ContentTemplates';

describe('ContentTemplates', () => {
  it('renders without crashing', () => {
    const { container } = render(<ContentTemplates />);
    expect(container.firstChild).toBeDefined();
  });

  it('renders non-empty container', () => {
    const { container } = render(<ContentTemplates />);
    expect(container.innerHTML.length).toBeGreaterThan(0);
  });
});
