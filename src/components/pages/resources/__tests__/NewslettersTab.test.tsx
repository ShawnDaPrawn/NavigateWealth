/**
 * NewslettersTab — the archive a visitor actually uses.
 *
 * Pins what the owner asked for: this year and three more as tabs, five more
 * behind "Older", only the months that have an issue, and each item offering
 * both a read-online link and a PDF download.
 */
import { describe, it, expect } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { NewslettersTab } from '../NewslettersTab';
import type { PublicNewsletter } from '../newsletterArchive';

const NOW = new Date('2026-06-15T00:00:00Z');

const newsletter = (issueMonth: string, title: string): PublicNewsletter => {
  const [year, month] = issueMonth.split('-').map(Number);
  return {
    slug: `${issueMonth}-${title.toLowerCase().replace(/\s+/g, '-')}`,
    title,
    description: `About ${title}.`,
    issueMonth,
    year,
    month,
    pdfUrl: `https://cdn.test/${issueMonth}.pdf`,
    pdfFileName: `${issueMonth}.pdf`,
    pdfSizeBytes: 2 * 1024 * 1024,
    publishedAt: `${issueMonth}-05T09:00:00.000Z`,
  };
};

const ITEMS = [
  newsletter('2026-05', 'May Review'),
  newsletter('2026-02', 'February Review'),
  newsletter('2025-11', 'November Review'),
  newsletter('2019-04', 'Ancient Review'),
];

const renderTab = (items = ITEMS, isLoading = false) =>
  render(
    <MemoryRouter>
      <NewslettersTab newsletters={items} isLoading={isLoading} now={NOW} />
    </MemoryRouter>,
  );

describe('NewslettersTab', () => {
  it('opens on the newest year and lists only the months that have an issue', () => {
    renderTab();
    const tabs = screen.getAllByRole('tab');
    expect(tabs.map((t) => t.textContent)).toEqual(['2026', '2025']);
    expect(tabs[0].getAttribute('aria-selected')).toBe('true');

    const months = screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent);
    expect(months).toEqual(['May 2026', 'February 2026']);
  });

  it('switches year when another tab is chosen', () => {
    renderTab();
    fireEvent.click(screen.getByRole('tab', { name: '2025' }));
    expect(screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent)).toEqual([
      'November 2025',
    ]);
    expect(screen.queryByText('May Review')).toBeNull();
  });

  it('keeps a year older than the four tabs behind the Older dropdown', () => {
    renderTab();
    expect(screen.queryByRole('tab', { name: '2019' })).toBeNull();
    expect(screen.getByRole('button', { name: /older years/i })).toBeTruthy();
  });

  it('offers a year no further back than the Older window reaches', () => {
    // 2016 is ten years before "now" — outside 2026-2023 and 2022-2018.
    renderTab([...ITEMS, newsletter('2016-01', 'Too Old')]);
    fireEvent.click(screen.getByRole('button', { name: /older years/i }));
    expect(screen.queryByText('2016')).toBeNull();
  });

  it('gives each newsletter a read-online link and a PDF download', () => {
    renderTab();
    const card = screen.getByText('May Review').closest('div')!;
    const scope = within(card.parentElement!.parentElement!);
    const read = scope.getByRole('link', { name: /read online/i });
    expect(read.getAttribute('href')).toBe('/resources/newsletter/2026-05-may-review');
    const download = scope.getByRole('link', { name: /download pdf/i });
    expect(download.getAttribute('href')).toBe('https://cdn.test/2026-05.pdf');
    expect(download.getAttribute('download')).toBe('2026-05.pdf');
  });

  it('shows a loading state and, when there is nothing, says so plainly', () => {
    const { unmount } = renderTab([], true);
    expect(screen.getByText(/loading newsletters/i)).toBeTruthy();
    unmount();

    renderTab([], false);
    expect(screen.getByText('No newsletters yet')).toBeTruthy();
    expect(screen.queryByRole('tab')).toBeNull();
  });

  it('falls back to the newest year available when this year has nothing yet', () => {
    renderTab([newsletter('2025-11', 'November Review')]);
    const tabs = screen.getAllByRole('tab');
    expect(tabs.map((t) => t.textContent)).toEqual(['2025']);
    expect(screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent)).toEqual([
      'November 2025',
    ]);
  });
});
