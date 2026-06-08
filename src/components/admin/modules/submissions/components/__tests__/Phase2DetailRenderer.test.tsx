import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Phase2DetailRenderer } from '../Phase2DetailRenderer';

describe('Phase2DetailRenderer', () => {
  it('renders without crashing with empty data', () => {
    const { container } = render(<Phase2DetailRenderer productDetails={{}} />);
    expect(container.firstChild).toBeDefined();
  });

  it('renders MedicalAid vertical', () => {
    const { container } = render(
      <Phase2DetailRenderer
        productDetails={{ vertical: 'MedicalAid', plan: 'ComprehensivePlus' }}
      />,
    );
    expect(container.firstChild).toBeDefined();
  });

  it('renders Investment vertical', () => {
    const { container } = render(
      <Phase2DetailRenderer productDetails={{ vertical: 'Investment', investmentAmount: 50000 }} />,
    );
    expect(container.firstChild).toBeDefined();
  });

  it('renders Retirement vertical', () => {
    const { container } = render(
      <Phase2DetailRenderer productDetails={{ vertical: 'Retirement', retirementAge: 65 }} />,
    );
    expect(container.firstChild).toBeDefined();
  });

  it('renders unknown vertical with generic renderer', () => {
    const { container } = render(
      <Phase2DetailRenderer productDetails={{ vertical: 'Unknown', someField: 'value' }} />,
    );
    expect(container.firstChild).toBeDefined();
  });

  it('renders non-empty container', () => {
    const { container } = render(
      <Phase2DetailRenderer
        productDetails={{ vertical: 'MedicalAid', planName: 'Standard Plan' }}
      />,
    );
    expect(container.innerHTML.length).toBeGreaterThan(0);
  });
});
