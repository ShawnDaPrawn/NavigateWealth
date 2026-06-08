import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('../../admin/modules/esign/api', () => ({
  esignApi: {
    verifyDocumentHash: vi.fn().mockResolvedValue({ verified: true, message: 'OK' }),
  },
}));

import { VerifyDocumentPage } from '../VerifyDocumentPage';

describe('VerifyDocumentPage', () => {
  it('renders without crashing', () => {
    const { container } = render(<VerifyDocumentPage />);
    expect(container.firstChild).toBeDefined();
  });

  it('renders verify heading', () => {
    render(<VerifyDocumentPage />);
    expect(screen.getByText(/Verify Document Integrity/i)).toBeDefined();
  });

  it('renders upload drag area', () => {
    const { container } = render(<VerifyDocumentPage />);
    expect(container.innerHTML).toContain('pdf');
  });

  it('renders non-empty container', () => {
    const { container } = render(<VerifyDocumentPage />);
    expect(container.innerHTML.length).toBeGreaterThan(0);
  });
});
