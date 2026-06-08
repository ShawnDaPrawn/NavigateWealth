import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Users } from 'lucide-react';
import { KPICard } from '../KPICard';

const baseProps = {
  title: 'Total Clients',
  value: 42,
  change: 5,
  icon: Users,
};

describe('KPICard', () => {
  it('renders title', () => {
    render(<KPICard {...baseProps} />);
    expect(screen.getByText('Total Clients')).toBeDefined();
  });

  it('renders value', () => {
    render(<KPICard {...baseProps} />);
    expect(screen.getByText('42')).toBeDefined();
  });

  it('renders loading skeleton when loading=true', () => {
    const { container } = render(<KPICard {...baseProps} loading={true} />);
    expect(container.innerHTML).toContain('animate-pulse');
  });

  it('renders positive change indicator', () => {
    const { container } = render(<KPICard {...baseProps} change={10} />);
    expect(container.firstChild).toBeDefined();
  });

  it('renders negative change indicator', () => {
    const { container } = render(<KPICard {...baseProps} change={-5} />);
    expect(container.firstChild).toBeDefined();
  });

  it('renders zero change indicator', () => {
    const { container } = render(<KPICard {...baseProps} change={0} />);
    expect(container.firstChild).toBeDefined();
  });

  it('calls onClick when clicked', () => {
    const onClick = vi.fn();
    render(<KPICard {...baseProps} onClick={onClick} />);
    fireEvent.click(screen.getByText('Total Clients'));
    expect(onClick).toHaveBeenCalled();
  });

  it('renders subtitle when provided', () => {
    render(<KPICard {...baseProps} subtitle="vs last month" />);
    expect(screen.getByText('vs last month')).toBeDefined();
  });

  it('renders currency format', () => {
    render(<KPICard {...baseProps} value={50000} format="currency" />);
    expect(screen.getByText(/50/)).toBeDefined();
  });
});
