import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { ComplianceModule } from '../ComplianceModule';

describe('ComplianceModule', () => {
  it('renders the Compliance heading and says the tools are coming', () => {
    render(
      <MemoryRouter>
        <ComplianceModule />
      </MemoryRouter>,
    );
    expect(screen.getByRole('heading', { level: 1, name: 'Compliance' })).toBeDefined();
    expect(screen.getByText('Soon')).toBeDefined();
    expect(screen.getByText('Compliance tools are coming soon')).toBeDefined();
  });

  it('points to where compliance work lives today', () => {
    render(
      <MemoryRouter>
        <ComplianceModule />
      </MemoryRouter>,
    );
    expect(screen.getByRole('link', { name: 'Open Client Management' }).getAttribute('href')).toBe(
      '/admin?module=clients',
    );
    expect(screen.getByRole('link', { name: 'Open Personnel' }).getAttribute('href')).toBe(
      '/admin?module=personnel',
    );
  });
});
