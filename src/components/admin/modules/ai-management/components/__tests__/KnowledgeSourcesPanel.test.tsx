import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { KnowledgeSourcesPanel } from '../KnowledgeSourcesPanel';
import type { KnowledgeIndexStatus } from '../../types';

function status(overrides: Partial<KnowledgeIndexStatus> = {}): KnowledgeIndexStatus {
  return {
    indexed: true,
    articles: [
      { articleId: 'a1', title: 'A', slug: 'a', chunkCount: 2, indexedAt: '2026-01-01T00:00:00Z' },
    ],
    kbEntries: [],
    totalChunks: 2,
    lastFullIndex: '2026-01-01T00:00:00Z',
    lastUpdated: '2026-01-01T00:00:00Z',
    publishedArticleCount: 1,
    activeKbCount: 0,
    pendingArticles: 0,
    pendingKbEntries: 0,
    staleSources: 0,
    ...overrides,
  };
}

const noop = () => {};

describe('KnowledgeSourcesPanel', () => {
  it('says "up to date" when everything published and live is indexed', () => {
    render(
      <KnowledgeSourcesPanel
        status={status()}
        isLoading={false}
        onRebuild={noop}
        isRebuilding={false}
      />,
    );
    expect(screen.getByRole('status').textContent).toMatch(/Up to date/);
    expect(screen.getByText(/1 of 1 article indexed/)).toBeDefined();
    expect(screen.getByText(/0 of 0 live entries indexed/)).toBeDefined();
  });

  it('counts what is waiting and what is stale in plain words', () => {
    render(
      <KnowledgeSourcesPanel
        status={status({ activeKbCount: 3, pendingKbEntries: 2, staleSources: 1 })}
        isLoading={false}
        onRebuild={noop}
        isRebuilding={false}
      />,
    );
    const text = screen.getByRole('status').textContent ?? '';
    expect(text).toContain('2 sources waiting to be indexed');
    expect(text).toContain('1 stale source to remove');
  });

  it('tells the admin when nothing has ever been indexed', () => {
    render(
      <KnowledgeSourcesPanel
        status={status({ indexed: false, articles: [], lastUpdated: null, pendingArticles: 1 })}
        isLoading={false}
        onRebuild={noop}
        isRebuilding={false}
      />,
    );
    expect(screen.getByRole('status').textContent).toMatch(/never been indexed/);
    expect(screen.getByText('Never indexed')).toBeDefined();
  });

  it('distinguishes "no sources at all" from "not indexed"', () => {
    render(
      <KnowledgeSourcesPanel
        status={status({
          indexed: false,
          articles: [],
          publishedArticleCount: 0,
          lastUpdated: null,
        })}
        isLoading={false}
        onRebuild={noop}
        isRebuilding={false}
      />,
    );
    expect(screen.getByRole('status').textContent).toMatch(/no knowledge sources yet/);
  });

  it('reports when the status itself could not be loaded', () => {
    render(
      <KnowledgeSourcesPanel
        status={null}
        isLoading={false}
        onRebuild={noop}
        isRebuilding={false}
      />,
    );
    expect(screen.getByRole('status').textContent).toMatch(/Could not check/);
  });

  it('disables the rebuild button while loading or rebuilding, and calls back otherwise', () => {
    const onRebuild = vi.fn();
    const { rerender } = render(
      <KnowledgeSourcesPanel
        status={undefined}
        isLoading
        onRebuild={onRebuild}
        isRebuilding={false}
      />,
    );
    expect(
      (screen.getByRole('button', { name: /rebuild index/i }) as HTMLButtonElement).disabled,
    ).toBe(true);

    rerender(
      <KnowledgeSourcesPanel
        status={status()}
        isLoading={false}
        onRebuild={onRebuild}
        isRebuilding
      />,
    );
    expect(
      (screen.getByRole('button', { name: /rebuilding/i }) as HTMLButtonElement).disabled,
    ).toBe(true);

    rerender(
      <KnowledgeSourcesPanel
        status={status()}
        isLoading={false}
        onRebuild={onRebuild}
        isRebuilding={false}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /rebuild index/i }));
    expect(onRebuild).toHaveBeenCalledTimes(1);
  });
});
