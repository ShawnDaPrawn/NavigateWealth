import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { IntakeReadOnlyReview } from '@/components/client/fna-intake/IntakeReadOnlyReview';

describe('IntakeReadOnlyReview', () => {
  it('renders flattened submitted answers', () => {
    render(
      <IntakeReadOnlyReview
        domain="tax"
        inputs={{ age: 42, employmentIncome: 850000 }}
      />,
    );

    expect(screen.getByText('Tax planning discovery')).toBeTruthy();
    expect(screen.getByText('42')).toBeTruthy();
    expect(screen.getByText(/850[\s,]?000/)).toBeTruthy();
  });
});
