import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';

const fetchMock = vi.fn();

vi.stubGlobal('fetch', fetchMock);
vi.mock('../Logo', () => ({
  Logo: () => <div data-testid="dashboard-footer-logo" />,
}));

import { DashboardFooter } from '../DashboardFooter';

function buildDocumentResponse(slug: string, title: string) {
  return {
    available: true,
    slug,
    document: {
      id: `${slug}-id`,
      slug,
      title,
      description: `${title} description`,
      blocks: [],
      contentHtml: `<h2>${title}</h2><p>${title} content</p>`,
      version: '1.0',
      updatedAt: '2026-05-12T08:00:00.000Z',
      effectiveDate: '2026-05-12',
      section: 'privacy-data-protection',
      toc: [{ id: 'intro', title: 'Introduction', level: 2 }],
      renderMode: 'versioned_document',
    },
  };
}

describe('DashboardFooter', () => {
  afterEach(() => {
    cleanup();
    fetchMock.mockReset();
    window.history.replaceState({}, '', '/');
  });

  it('opens the Privacy Notice dialog from the Privacy Policy footer link', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => buildDocumentResponse('privacy-notice', 'Privacy Notice'),
    });

    render(<DashboardFooter />);

    fireEvent.click(screen.getByRole('button', { name: /Privacy Policy/i }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('/resources/legal/privacy-notice'),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: expect.any(String),
          }),
        }),
      );
    });

    const privacyDialog = await screen.findByRole('dialog');
    expect(privacyDialog.textContent).toContain('Privacy Notice');
    expect(window.location.pathname).toBe('/');
    expect(window.location.search).toBe('');
  });

  it('maps FAIS Conflict of Interest Policy to the specific legal document slug', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => buildDocumentResponse('conflict-of-interest', 'Conflict of Interest'),
    });

    render(<DashboardFooter />);

    fireEvent.click(screen.getByRole('button', { name: /FAIS Conflict of Interest Policy/i }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('/resources/legal/conflict-of-interest'),
        expect.any(Object),
      );
    });

    const conflictDialog = await screen.findByRole('dialog');
    expect(conflictDialog.textContent).toContain('Conflict of Interest');
  });
});
