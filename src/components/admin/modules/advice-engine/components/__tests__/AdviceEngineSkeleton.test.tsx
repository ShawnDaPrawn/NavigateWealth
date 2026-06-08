import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { AdviceEngineSkeleton } from '../AdviceEngineSkeleton';

describe('AdviceEngineSkeleton', () => {
  it('renders without crashing', () => {
    const { container } = render(<AdviceEngineSkeleton />);
    expect(container.firstChild).toBeDefined();
  });

  it('renders a non-empty container', () => {
    const { container } = render(<AdviceEngineSkeleton />);
    expect(container.innerHTML.length).toBeGreaterThan(0);
  });
});
