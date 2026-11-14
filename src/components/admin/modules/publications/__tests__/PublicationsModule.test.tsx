/**
 * Publications: the article editor and Generate with AI are pages with their
 * own address, form pages hide the module's header and tabs, and the top-bar
 * breadcrumb follows where you are.
 */
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router';
import { BreadcrumbContext, type Crumb } from '../../../layout/page';

const ARTICLE = { id: 'a-1', title: 'Gap cover explained', status: 'draft' };

const init = vi.hoisted(() => ({
  state: {
    isInitialized: true as boolean | null,
    loadError: null as Error | null,
    checkInitialization: () => undefined as unknown,
  },
  articlesError: null as string | null,
}));

vi.mock('../hooks', () => ({
  usePublicationsInit: () => ({
    ...init.state,
    isLoading: false,
    initialize: vi.fn(),
    isInitializing: false,
  }),
  useArticles: () => ({
    articles: [ARTICLE],
    isLoading: false,
    error: init.articlesError,
    isRefreshing: false,
    refetch: vi.fn(),
  }),
  useCategories: () => ({
    categories: [],
    isLoading: false,
    isRefreshing: false,
    refetch: vi.fn(),
  }),
}));
vi.mock('../../personnel', () => ({
  useCurrentUserPermissions: () => ({ canDo: () => true }),
}));
vi.mock('../ArticleEditor', () => ({
  ArticleEditor: (props: { article?: { title: string } | null; onBack: () => void }) => (
    <div>
      <h1>{props.article ? 'Edit article' : 'New article'}</h1>
      <span>{props.article?.title}</span>
      <button onClick={props.onBack}>editor-back</button>
    </div>
  ),
}));
vi.mock('../components/AIArticleGenerator', () => ({
  AIArticleGenerator: () => <h1>Generate article with AI</h1>,
}));
vi.mock('../ArticlesListView', () => ({ ArticlesListView: () => <div>Articles list</div> }));
vi.mock('../components/ContentAnalytics', () => ({ ContentAnalytics: () => <div>Analytics</div> }));
vi.mock('../components/ArticleEmailEngagementPanel', () => ({
  ArticleEmailEngagementPanel: () => null,
}));
vi.mock('../components/ContentTemplates', () => ({
  ContentTemplates: () => <div>Template form page</div>,
}));
vi.mock('../components/TemplatePickerDialog', () => ({ TemplatePickerDialog: () => null }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { PublicationsModule } from '../PublicationsModule';

const crumbs = { trail: [] as Crumb[] };

function Location() {
  return <div data-testid="location">{useLocation().search}</div>;
}

function renderAt(search: string) {
  return render(
    <BreadcrumbContext.Provider
      value={{
        trail: [],
        setTrail: (trail) => {
          crumbs.trail = trail;
        },
      }}
    >
      <MemoryRouter initialEntries={[`/admin${search}`]}>
        <PublicationsModule />
        <Location />
      </MemoryRouter>
    </BreadcrumbContext.Provider>,
  );
}

beforeEach(() => {
  crumbs.trail = [];
  init.state = { isInitialized: true, loadError: null, checkInitialization: vi.fn() };
  init.articlesError = null;
});

describe('PublicationsModule', () => {
  it('shows an error, never the setup screen, when the status check fails', () => {
    const retry = vi.fn();
    init.state = {
      isInitialized: null,
      loadError: new Error('400 Bad Request'),
      checkInitialization: retry,
    };
    renderAt('?tab=articles');
    expect(screen.getByText('Unable to load Publications')).toBeDefined();
    expect(screen.queryByText(/set up publications/i)).toBeNull();
    expect(screen.queryByRole('button', { name: /initialise/i })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(retry).toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: /show details/i }));
    expect(screen.getByText('400 Bad Request')).toBeDefined();
  });

  it('shows "Setup required" only when the API reports the system is not set up', () => {
    init.state = { isInitialized: false, loadError: null, checkInitialization: vi.fn() };
    renderAt('');
    expect(screen.getByText('Setup required')).toBeDefined();
    expect(screen.getByRole('heading', { name: 'Set up Publications' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Initialise publications' })).toBeDefined();
  });

  it('shows the shared error state on article-backed tabs when articles fail to load', () => {
    init.articlesError = 'Failed to fetch articles';
    renderAt('?tab=pipeline');
    expect(screen.getByText('Unable to load articles')).toBeDefined();
  });

  it('opens an article named in the address as a page, and goes back to the list', () => {
    renderAt('?tab=articles&article=a-1');
    expect(screen.getByRole('heading', { level: 1, name: 'Edit article' })).toBeDefined();
    expect(screen.getByText('Gap cover explained')).toBeDefined();
    expect(crumbs.trail.map((c) => c.label)).toEqual(['Articles', 'Gap cover explained']);
    fireEvent.click(screen.getByRole('button', { name: 'editor-back' }));
    expect(screen.getByTestId('location').textContent).not.toContain('article=');
    expect(screen.getByRole('heading', { level: 1, name: 'Publications' })).toBeDefined();
  });

  it('drops an unknown article from the address and stays on the list', () => {
    renderAt('?tab=articles&article=nope');
    expect(screen.getByRole('heading', { level: 1, name: 'Publications' })).toBeDefined();
    expect(screen.getByTestId('location').textContent).not.toContain('article=');
  });

  it('shows Generate with AI as a page of its own', () => {
    renderAt('?article=generate');
    expect(
      screen.getByRole('heading', { level: 1, name: 'Generate article with AI' }),
    ).toBeDefined();
    expect(crumbs.trail.map((c) => c.label)).toEqual(['New article', 'Generate with AI']);
  });

  it('hides the header and tabs while a form page is open, and names it in the breadcrumb', () => {
    renderAt('?tab=templates&page=template-new');
    expect(screen.getByText('Template form page')).toBeDefined();
    expect(screen.queryByRole('heading', { level: 1, name: 'Publications' })).toBeNull();
    expect(crumbs.trail.map((c) => c.label)).toEqual(['Templates', 'New template']);
  });

  it('has New article as the one primary action and names the tab in the breadcrumb', () => {
    renderAt('?tab=articles');
    expect(screen.getByRole('button', { name: /new article/i })).toBeDefined();
    expect(crumbs.trail.map((c) => c.label)).toEqual(['Articles']);
  });
});
