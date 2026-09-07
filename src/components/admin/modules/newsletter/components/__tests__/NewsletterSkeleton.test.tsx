import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { NewsletterSkeleton } from '../NewsletterSkeleton';
import { CampaignStatusBadge, DeliveryStatusBadge } from '../StatusBadge';

describe('NewsletterSkeleton', () => {
  it('renders the first-paint placeholder', () => {
    render(<NewsletterSkeleton />);
    expect(screen.getByTestId('newsletter-skeleton')).toBeTruthy();
  });
});

describe('status badges', () => {
  it('labels every campaign status', () => {
    render(
      <>
        <CampaignStatusBadge status="draft" />
        <CampaignStatusBadge status="sending" />
        <CampaignStatusBadge status="finished" />
      </>,
    );
    expect(screen.getByText('Draft')).toBeTruthy();
    expect(screen.getByText('Sending')).toBeTruthy();
    expect(screen.getByText('Sent')).toBeTruthy();
  });

  it('labels delivery statuses, falling back safely on unknowns', () => {
    render(
      <>
        <DeliveryStatusBadge status="sent" />
        <DeliveryStatusBadge status={'mystery' as never} />
      </>,
    );
    expect(screen.getByText('Delivered')).toBeTruthy();
    expect(screen.getByText('Pending')).toBeTruthy();
  });
});
