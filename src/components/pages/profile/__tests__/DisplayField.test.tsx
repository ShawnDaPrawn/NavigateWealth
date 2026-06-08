import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DisplayField } from '../DisplayField';

describe('DisplayField', () => {
  it('renders label', () => {
    render(<DisplayField label="Full Name" value="Jane Smith" />);
    expect(screen.getByText('Full Name')).toBeDefined();
  });

  it('renders text value', () => {
    render(<DisplayField label="Email" value="jane@example.com" />);
    expect(screen.getByText('jane@example.com')).toBeDefined();
  });

  it('renders true boolean value with check icon', () => {
    const { container } = render(<DisplayField label="Active" value={true} type="boolean" />);
    expect(container.innerHTML).toContain('svg');
  });

  it('renders false boolean value', () => {
    const { container } = render(<DisplayField label="Active" value={false} type="boolean" />);
    expect(container.firstChild).toBeDefined();
  });

  it('renders badge type', () => {
    render(<DisplayField label="Status" value="Approved" type="badge" />);
    expect(screen.getByText('Approved')).toBeDefined();
  });

  it('applies custom className', () => {
    const { container } = render(
      <DisplayField label="Test" value="val" className="custom-class" />,
    );
    expect(container.innerHTML).toContain('custom-class');
  });
});
