import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { EmailPreview } from '../EmailPreview';
import { applySampleMergeFields, sanitizeEmailHtml } from '../../utils/preview';

describe('EmailPreview', () => {
  it('substitutes merge fields with sample values in the envelope and body', () => {
    render(
      <EmailPreview
        subject="Hi {{firstName}}"
        preheader="For {{name}}"
        fromName="Navigate Wealth"
        bodyHtml="<p>Dear {{firstName}}, your address is {{email}}.</p>"
      />,
    );
    expect(screen.getByText('Hi Thandi')).toBeTruthy();
    expect(screen.getByText('For Thandi Nkosi')).toBeTruthy();
    expect(screen.getByText(/Dear Thandi, your address is thandi@example.com/)).toBeTruthy();
    expect(screen.getByText('NW')).toBeTruthy();
  });

  it('strips scripts and event handlers from the body', () => {
    const { container } = render(
      <EmailPreview
        subject="s"
        bodyHtml='<p onclick="alert(1)">safe</p><script>alert(2)</script>'
      />,
    );
    expect(container.querySelector('script')).toBeNull();
    expect(container.querySelector('[onclick]')).toBeNull();
    expect(screen.getByText('safe')).toBeTruthy();
  });

  it('shows a placeholder when the body is empty and a device toggle on request', () => {
    render(<EmailPreview subject="" bodyHtml="<p>  </p>" allowDeviceToggle />);
    expect(screen.getByText(/Your email content will appear here/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Mobile preview' })).toBeTruthy();
  });
});

describe('helpers', () => {
  it('replace every occurrence of every token', () => {
    expect(applySampleMergeFields('{{firstName}} {{firstName}} {{unsubscribeUrl}}')).toBe(
      'Thandi Thandi #',
    );
  });

  it('sanitize keeps ordinary formatting', () => {
    expect(sanitizeEmailHtml('<h2>Hi</h2><a href="https://x.co">x</a>')).toContain('href=');
  });
});
