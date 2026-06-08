import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { WelcomeMessage } from '../WelcomeMessage';

describe('WelcomeMessage', () => {
  it('renders without crashing', () => {
    const { container } = render(<WelcomeMessage />);
    expect(container.firstChild).toBeDefined();
  });

  it('renders custom content when provided', () => {
    render(<WelcomeMessage content="Custom welcome text" />);
    expect(screen.getByText('Custom welcome text')).toBeDefined();
  });

  it('renders features list when provided', () => {
    const features = [
      { icon: '📊', title: 'Analysis', items: ['View portfolios'] },
      { icon: '💡', title: 'Advice', items: ['Get advice'] },
    ];
    render(<WelcomeMessage features={features} />);
    expect(screen.getByText('Analysis')).toBeDefined();
    expect(screen.getByText('Advice')).toBeDefined();
  });

  it('renders default content without props', () => {
    const { container } = render(<WelcomeMessage />);
    expect(container.innerHTML.length).toBeGreaterThan(0);
  });
});
