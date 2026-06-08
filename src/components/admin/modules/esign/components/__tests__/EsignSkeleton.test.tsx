import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { EsignSkeleton, SkeletonStack, SkeletonCardGrid, SkeletonList } from '../EsignSkeleton';

describe('EsignSkeleton', () => {
  it('renders without crashing', () => {
    const { container } = render(<EsignSkeleton />);
    expect(container.firstChild).toBeDefined();
  });

  it('renders a non-empty container', () => {
    const { container } = render(<EsignSkeleton />);
    expect(container.innerHTML.length).toBeGreaterThan(0);
  });
});

describe('SkeletonStack', () => {
  it('renders without crashing', () => {
    const { container } = render(<SkeletonStack />);
    expect(container.firstChild).toBeDefined();
  });

  it('renders with custom rows and height', () => {
    const { container } = render(<SkeletonStack rows={6} height="h-8" />);
    expect(container.firstChild).toBeDefined();
  });
});

describe('SkeletonCardGrid', () => {
  it('renders without crashing', () => {
    const { container } = render(<SkeletonCardGrid />);
    expect(container.firstChild).toBeDefined();
  });

  it('renders with custom cards count', () => {
    const { container } = render(<SkeletonCardGrid cards={5} />);
    expect(container.firstChild).toBeDefined();
  });
});

describe('SkeletonList', () => {
  it('renders without crashing', () => {
    const { container } = render(<SkeletonList />);
    expect(container.firstChild).toBeDefined();
  });

  it('renders with custom items count', () => {
    const { container } = render(<SkeletonList items={8} />);
    expect(container.firstChild).toBeDefined();
  });
});
