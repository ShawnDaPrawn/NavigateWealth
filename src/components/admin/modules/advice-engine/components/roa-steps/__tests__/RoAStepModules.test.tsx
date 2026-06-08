import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('../../../roaModuleRuntime', () => ({
  getFallbackRuntimeModules: vi.fn().mockReturnValue([]),
  getModuleRuntimeStatus: vi.fn().mockReturnValue({ percentage: 0, complete: false }),
}));

import { RoAStepModules } from '../RoAStepModules';
import type { RoAModule } from '../../../types';

const mockModule: RoAModule = {
  id: 'medical_aid',
  title: 'Medical Aid',
  description: 'Medical aid advice module',
  category: 'Risk',
  fields: [],
  disclosures: [],
  compileOrder: [],
};

describe('RoAStepModules', () => {
  it('renders without crashing with null draft', () => {
    const { container } = render(<RoAStepModules draft={null} onUpdate={vi.fn()} modules={[]} />);
    expect(container.firstChild).toBeDefined();
  });

  it('renders heading', () => {
    render(<RoAStepModules draft={null} onUpdate={vi.fn()} modules={[]} />);
    expect(screen.getByText('Select Advice Modules')).toBeDefined();
  });

  it('renders module in library', () => {
    render(<RoAStepModules draft={null} onUpdate={vi.fn()} modules={[mockModule]} />);
    expect(screen.getByText('Medical Aid')).toBeDefined();
  });

  it('renders empty state when no modules match filter', () => {
    render(<RoAStepModules draft={null} onUpdate={vi.fn()} modules={[]} />);
    expect(screen.getByText(/No modules match/i)).toBeDefined();
  });

  it('shows selected module count', () => {
    render(<RoAStepModules draft={null} onUpdate={vi.fn()} modules={[mockModule]} />);
    expect(screen.getByText(/0 module/i)).toBeDefined();
  });

  it('filters modules by search', () => {
    const anotherModule: RoAModule = {
      ...mockModule,
      id: 'retirement',
      title: 'Retirement Planning',
      description: 'Retirement advice',
    };
    render(
      <RoAStepModules draft={null} onUpdate={vi.fn()} modules={[mockModule, anotherModule]} />,
    );
    const input = screen.getByPlaceholderText(/Title, category/i);
    fireEvent.change(input, { target: { value: 'Retirement' } });
    expect(screen.queryByText('Medical Aid')).toBeNull();
    expect(screen.getByText('Retirement Planning')).toBeDefined();
  });

  it('renders non-empty container', () => {
    const { container } = render(
      <RoAStepModules draft={null} onUpdate={vi.fn()} modules={[mockModule]} />,
    );
    expect(container.innerHTML.length).toBeGreaterThan(0);
  });
});
