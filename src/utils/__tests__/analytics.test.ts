import { describe, it, expect, vi, beforeEach } from 'vitest';
import { trackConsultationFlowStarted } from '../analytics';

describe('trackConsultationFlowStarted', () => {
  beforeEach(() => {
    // Clear window properties before each test
    delete (window as { gtag?: unknown }).gtag;
    delete (window as { dataLayer?: unknown }).dataLayer;
  });

  it('pushes event to dataLayer when gtag is absent', () => {
    trackConsultationFlowStarted({ source: 'homepage' });
    expect(window.dataLayer).toBeDefined();
    expect(window.dataLayer![0]).toMatchObject({
      event: 'consultation_flow_started',
      source: 'homepage',
    });
  });

  it('calls gtag when available', () => {
    const gtag = vi.fn();
    (window as { gtag?: unknown }).gtag = gtag;
    trackConsultationFlowStarted({ campaign: 'spring' });
    expect(gtag).toHaveBeenCalledWith('event', 'consultation_flow_started', { campaign: 'spring' });
  });

  it('appends to existing dataLayer array', () => {
    window.dataLayer = [{ event: 'previous_event' }];
    trackConsultationFlowStarted();
    expect(window.dataLayer).toHaveLength(2);
    expect(window.dataLayer[1]).toMatchObject({ event: 'consultation_flow_started' });
  });

  it('works without params', () => {
    expect(() => trackConsultationFlowStarted()).not.toThrow();
    expect(window.dataLayer![0]).toMatchObject({ event: 'consultation_flow_started' });
  });
});
