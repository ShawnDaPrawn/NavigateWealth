/**
 * Publications Module — Main Entry Point
 *
 * World-class content management interface for the Navigate Wealth Admin Panel.
 *
 * Sections:
 *  1. Analytics — KPI cards, publishing velocity, category distribution, pipeline
 *  2. Articles  — List / card / kanban views with bulk actions, filtering, sorting
 *  3. Categories — CRUD + drag-to-reorder management
 *  4. Settings  — Export/import, maintenance, SEO defaults
 *
 * All articles belong to a single type: "Insights & Education".
 *
 * @module publications
 */

import React, { useState, useMemo, useCallback } from 'react';
import { Tabs, TabsContent } from '../../../ui/tabs';
import { PageHeader, NavTabsList, NavTabsTrigger, useUrlState } from '../../layout/page';
import { Button } from '../../../ui/button';

import { Loader2, PlusCircle, RefreshCw } from 'lucide-react';
import { cn } from '../../../ui/utils';

// Existing module components
import { ArticlesListView } from './ArticlesListView';
import { ArticleEditor } from './ArticleEditor';
import { CategoriesManager } from './CategoriesManager';
import { PublicationsSettings } from './PublicationsSettings';
import { InitializePublications } from './InitializePublications';

// New world-class components
import { ContentAnalytics } from './components/ContentAnalytics';
import { ArticleEmailEngagementPanel } from './components/ArticleEmailEngagementPanel';
import { ContentPipeline } from './components/ContentPipeline';
import { PublicationsSkeleton } from './components/PublicationsSkeleton';
import { ContentCalendar } from './components/ContentCalendar';
import { ContentTemplates } from './components/ContentTemplates';
import { TemplatePickerDialog } from './components/TemplatePickerDialog';
import { AIArticleGenerator } from './components/AIArticleGenerator';
import { AutoContentPanel } from './components/AutoContentPanel';

// Lazy-loaded components
const NewsletterSubscribers = React.lazy(() =>
  import('./components/NewsletterSubscribers').then((m) => ({ default: m.NewsletterSubscribers })),
);
const TeamManager = React.lazy(() =>
  import('./components/TeamManager').then((m) => ({ default: m.TeamManager })),
);
const CareersManager = React.lazy(() =>
  import('./components/CareersManager').then((m) => ({ default: m.CareersManager })),
);

// Hooks
import { usePublicationsInit, useArticles, useCategories } from './hooks';
import { PublicationsAPI } from './api';
import { useCurrentUserPermissions } from '../personnel';

// Types
import type { Article, ArticleStatus, ContentTemplate } from './types';
import type { GenerateArticleResult } from './types';
import { toast } from 'sonner';

const PUBLICATION_TABS = [
  'analytics',
  'articles',
  'pipeline',
  'calendar',
  'templates',
  'automation',
  'categories',
  'subscribers',
  'team',
  'careers',
  'settings',
] as const;

export function PublicationsModule() {
  // The open tab is in the address (?tab=pipeline).
  const [activeTab, setActiveTab] = useUrlState('tab', 'analytics', PUBLICATION_TABS);
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);
  const [showEditor, setShowEditor] = useState(false);
  const [showTemplatePicker, setShowTemplatePicker] = useState(false);
  const [showAIGenerator, setShowAIGenerator] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<ContentTemplate | null>(null);
  const [aiGeneratedResult, setAiGeneratedResult] = useState<
    (GenerateArticleResult & { categoryId?: string }) | null
  >(null);

  const { isInitialized, isLoading: initLoading, checkInitialization } = usePublicationsInit();
  const {
    articles,
    isLoading: articlesLoading,
    isRefreshing: articlesRefreshing,
    refetch: refetchArticles,
  } = useArticles();
  const {
    categories,
    isLoading: _categoriesLoading,
    isRefreshing: categoriesRefreshing,
    refetch: refetchCategories,
  } = useCategories({ activeOnly: false });
  const { canDo } = useCurrentUserPermissions();

  // Scheduled publishing and auto-content run from pg_cron on the server, not
  // from this page (see AdminDashboardPage's "No background jobs here").

  const canCreate = canDo('publications', 'create');
  const canPublish = canDo('publications', 'publish');
  const isRefreshing = articlesRefreshing || categoriesRefreshing;

  const isLoading = initLoading;

  // ── Article actions ──────────────────────────────────────────────────

  const handleCreateNew = useCallback(() => {
    setSelectedArticle(null);
    setSelectedTemplate(null);
    setAiGeneratedResult(null);
    setShowTemplatePicker(true);
  }, []);

  const handleOpenAIGenerator = useCallback(() => {
    setShowTemplatePicker(false);
    setSelectedTemplate(null);
    setShowAIGenerator(true);
  }, []);

  const handleAIGenerated = useCallback(
    (result: GenerateArticleResult & { categoryId?: string }) => {
      setAiGeneratedResult(result);
      setShowAIGenerator(false);
      setShowEditor(true);
    },
    [],
  );

  const handleTemplateSelected = useCallback((template: ContentTemplate) => {
    setSelectedTemplate(template);
    setShowTemplatePicker(false);
    setShowEditor(true);
  }, []);

  const handleSkipTemplate = useCallback(() => {
    setSelectedTemplate(null);
    setShowTemplatePicker(false);
    setShowEditor(true);
  }, []);

  const handleCancelTemplatePicker = useCallback(() => {
    setSelectedTemplate(null);
    setShowTemplatePicker(false);
  }, []);

  const handleCancelAIGenerator = useCallback(() => {
    setShowAIGenerator(false);
  }, []);

  const handleEditArticle = useCallback((article: Article) => {
    setSelectedArticle(article);
    setShowEditor(true);
  }, []);

  const handleBackToList = useCallback(() => {
    setShowEditor(false);
    setSelectedArticle(null);
    refetchArticles();
    checkInitialization();
  }, [refetchArticles, checkInitialization]);

  const handleArticleSaved = useCallback(() => {
    setShowEditor(false);
    setSelectedArticle(null);
    refetchArticles();
    checkInitialization();
  }, [refetchArticles, checkInitialization]);

  const handleRefresh = useCallback(async () => {
    await Promise.all([refetchArticles(), refetchCategories(), checkInitialization()]);
  }, [checkInitialization, refetchArticles, refetchCategories]);

  // Kanban status change handler
  const handleStatusChange = useCallback(
    async (articleId: string, newStatus: ArticleStatus) => {
      // Gate publish action behind capability
      if (newStatus === 'published' && !canPublish) {
        toast.error('You do not have permission to publish articles');
        return;
      }
      try {
        if (newStatus === 'published') {
          await PublicationsAPI.Articles.publishArticle(articleId);
        } else if (newStatus === 'archived') {
          await PublicationsAPI.Articles.archiveArticle(articleId);
        } else {
          await PublicationsAPI.Articles.updateArticle({ id: articleId, status: newStatus });
        }
        toast.success(`Article moved to ${newStatus.replace('_', ' ')}`);
        refetchArticles();
      } catch (err) {
        toast.error('Failed to update article status');
        console.error('Status change error:', err);
      }
    },
    [refetchArticles, canPublish],
  );

  // ── Quick stats for tab badges ───────────────────────────────────────

  const stats = useMemo(
    () => ({
      total: articles.length,
      published: articles.filter((a) => a.status === 'published').length,
      drafts: articles.filter((a) => a.status === 'draft').length,
      categories: categories.length,
    }),
    [articles, categories],
  );

  // ── Loading state ────────────────────────────────────────────────────

  if (isLoading) {
    return <PublicationsSkeleton />;
  }

  // ── Initialization gate ──────────────────────────────────────────────

  if (isInitialized === false) {
    return (
      <div className="space-y-6 p-6">
        <ModuleHeader title="Publications" subtitle="First-time setup required" />
        <div className="max-w-2xl mx-auto mt-12">
          <InitializePublications onInitialized={checkInitialization} />
        </div>
      </div>
    );
  }

  // ── Article editor (full-screen takeover) ────────────────────────────

  if (showEditor) {
    return (
      <div className="p-6">
        <ArticleEditor
          key={
            selectedArticle?.id ||
            `new-${selectedTemplate?.id || aiGeneratedResult?.suggestedSlug || 'blank'}`
          }
          article={selectedArticle}
          initialTemplate={selectedTemplate}
          aiGeneratedResult={aiGeneratedResult}
          onBack={handleBackToList}
          onSaved={handleArticleSaved}
        />
      </div>
    );
  }

  // ── Main module shell ────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-6 p-6 lg:p-8">
      <PageHeader
        title="Publications"
        description="Articles, content pipeline, subscribers and website content."
        actions={
          <>
            <Button variant="outline" onClick={handleRefresh} disabled={isRefreshing}>
              <RefreshCw
                className={cn('h-4 w-4', isRefreshing && 'animate-spin')}
                aria-hidden="true"
              />
              Refresh
            </Button>
            <Button onClick={handleCreateNew} disabled={!canCreate}>
              <PlusCircle className="h-4 w-4" aria-hidden="true" />
              New article
            </Button>
          </>
        }
      />

      {/* Tabs */}
      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as (typeof PUBLICATION_TABS)[number])}
        className="gap-0"
      >
        <div>
          <NavTabsList aria-label="Publications">
            <NavTabsTrigger value="analytics">Analytics</NavTabsTrigger>
            <NavTabsTrigger value="articles" count={stats.total || undefined}>
              Articles
            </NavTabsTrigger>
            <NavTabsTrigger value="pipeline" count={stats.drafts || undefined}>
              Pipeline
            </NavTabsTrigger>
            <NavTabsTrigger value="calendar">Calendar</NavTabsTrigger>
            <NavTabsTrigger value="templates">Templates</NavTabsTrigger>
            <NavTabsTrigger value="automation">Automation</NavTabsTrigger>
            <NavTabsTrigger value="categories">Categories</NavTabsTrigger>
            <NavTabsTrigger value="subscribers">Subscribers</NavTabsTrigger>
            <NavTabsTrigger value="team">Team</NavTabsTrigger>
            <NavTabsTrigger value="careers">Careers</NavTabsTrigger>
            <NavTabsTrigger value="settings">Settings</NavTabsTrigger>
          </NavTabsList>
        </div>

        {/* Analytics Tab */}
        <TabsContent value="analytics" className="mt-6">
          {articlesLoading ? (
            <LoadingPlaceholder message="Loading analytics..." />
          ) : (
            <div className="space-y-6">
              <ContentAnalytics articles={articles} categories={categories} />
              <ArticleEmailEngagementPanel />
            </div>
          )}
        </TabsContent>

        {/* Articles Tab */}
        <TabsContent value="articles" className="mt-6">
          <ArticlesListView onCreateNew={handleCreateNew} onEditArticle={handleEditArticle} />
        </TabsContent>

        {/* Pipeline Tab */}
        <TabsContent value="pipeline" className="mt-6">
          {articlesLoading ? (
            <LoadingPlaceholder message="Loading pipeline..." />
          ) : (
            <ContentPipeline
              articles={articles}
              categories={categories}
              onEditArticle={handleEditArticle}
              onCreateNew={handleCreateNew}
              onStatusChange={handleStatusChange}
            />
          )}
        </TabsContent>

        {/* Calendar Tab */}
        <TabsContent value="calendar" className="mt-6">
          {articlesLoading ? (
            <LoadingPlaceholder message="Loading calendar..." />
          ) : (
            <ContentCalendar
              articles={articles}
              categories={categories}
              onEditArticle={handleEditArticle}
              onCreateNew={handleCreateNew}
            />
          )}
        </TabsContent>

        {/* Templates Tab */}
        <TabsContent value="templates" className="mt-6">
          <ContentTemplates />
        </TabsContent>

        {/* Automation Tab */}
        <TabsContent value="automation" className="mt-6">
          <AutoContentPanel categories={categories} onArticlesGenerated={refetchArticles} />
        </TabsContent>

        {/* Categories Tab */}
        <TabsContent value="categories" className="mt-6">
          <CategoriesManager />
        </TabsContent>

        {/* Subscribers Tab */}
        <TabsContent value="subscribers" className="mt-6">
          <React.Suspense fallback={<LoadingPlaceholder message="Loading subscribers..." />}>
            <NewsletterSubscribers />
          </React.Suspense>
        </TabsContent>

        {/* Team Tab */}
        <TabsContent value="team" className="mt-6">
          <React.Suspense fallback={<LoadingPlaceholder message="Loading team manager..." />}>
            <TeamManager />
          </React.Suspense>
        </TabsContent>

        {/* Careers Tab */}
        <TabsContent value="careers" className="mt-6">
          <React.Suspense fallback={<LoadingPlaceholder message="Loading careers manager..." />}>
            <CareersManager />
          </React.Suspense>
        </TabsContent>

        {/* Settings Tab */}
        <TabsContent value="settings" className="mt-6">
          <PublicationsSettings />
        </TabsContent>
      </Tabs>

      {/* Template Picker Dialog */}
      <TemplatePickerDialog
        isOpen={showTemplatePicker}
        onClose={handleCancelTemplatePicker}
        onSelect={handleTemplateSelected}
        onSkip={handleSkipTemplate}
        onOpenAIGenerator={handleOpenAIGenerator}
      />

      {/* AI Article Generator Dialog */}
      <AIArticleGenerator
        isOpen={showAIGenerator}
        onClose={handleCancelAIGenerator}
        onGenerated={handleAIGenerated}
        categories={categories}
      />
    </div>
  );
}

// ── Shared sub-components ────────────────────────────────────────────────

function ModuleHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight text-gray-900">{title}</h1>
      <p className="text-sm text-muted-foreground mt-0.5">{subtitle}</p>
    </div>
  );
}

function LoadingPlaceholder({ message }: { message: string }) {
  return (
    <div className="flex items-center justify-center py-20 gap-3">
      <Loader2 className="h-5 w-5 animate-spin text-purple-600" />
      <span className="text-sm text-muted-foreground">{message}</span>
    </div>
  );
}
