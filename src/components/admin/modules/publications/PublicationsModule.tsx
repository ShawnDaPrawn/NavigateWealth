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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../../ui/tabs';
import { Button } from '../../../ui/button';
import { Badge } from '../../../ui/badge';
import {
  FileText,
  FolderTree,
  Settings,
  Loader2,
  BarChart3,
  PlusCircle,
  Layers,
  RefreshCw,
  CalendarDays,
  Sparkles,
  Zap,
  Users,
  Send,
  Contact,
  Briefcase,
} from 'lucide-react';
import { cn } from '../../../ui/utils';

// Existing module components
import { ArticlesListView } from './ArticlesListView';
import { ArticleEditor } from './ArticleEditor';
import { CategoriesManager } from './CategoriesManager';
import { PublicationsSettings } from './PublicationsSettings';
import { InitializePublications } from './InitializePublications';

// New world-class components
import { ContentAnalytics } from './components/ContentAnalytics';
import { ContentPipeline } from './components/ContentPipeline';
import { PublicationsSkeleton } from './components/PublicationsSkeleton';
import { ContentCalendar } from './components/ContentCalendar';
import { ContentTemplates } from './components/ContentTemplates';
import { TemplatePickerDialog } from './components/TemplatePickerDialog';
import { AIArticleGenerator } from './components/AIArticleGenerator';
import { AutoContentPanel } from './components/AutoContentPanel';

// Lazy-loaded components
const NewsletterSubscribers = React.lazy(() =>
  import('./components/NewsletterSubscribers').then(m => ({ default: m.NewsletterSubscribers }))
);
const NewsletterBroadcast = React.lazy(() =>
  import('./components/NewsletterBroadcast').then(m => ({ default: m.NewsletterBroadcast }))
);
const TeamManager = React.lazy(() =>
  import('./components/TeamManager').then(m => ({ default: m.TeamManager }))
);
const CareersManager = React.lazy(() =>
  import('./components/CareersManager').then(m => ({ default: m.CareersManager }))
);

// Hooks
import { usePublicationsInit, useArticles, useCategories } from './hooks';
import { PublicationsAPI } from './api';
import { useCurrentUserPermissions } from '../personnel/hooks/usePermissions';

// Types
import type { Article, ArticleStatus, ContentTemplate } from './types';
import type { GenerateArticleResult } from './types';
import { toast } from 'sonner@2.0.3';

export function PublicationsModule() {
  const [activeTab, setActiveTab] = useState('analytics');
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);
  const [showEditor, setShowEditor] = useState(false);
  const [showTemplatePicker, setShowTemplatePicker] = useState(false);
  const [showAIGenerator, setShowAIGenerator] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<ContentTemplate | null>(null);
  const [aiGeneratedResult, setAiGeneratedResult] = useState<(GenerateArticleResult & { categoryId?: string }) | null>(null);

  const { isInitialized, isLoading: initLoading, checkInitialization } = usePublicationsInit();
  const {
    articles,
    isLoading: articlesLoading,
    isRefreshing: articlesRefreshing,
    refetch: refetchArticles,
  } = useArticles();
  const {
    categories,
    isLoading: categoriesLoading,
    isRefreshing: categoriesRefreshing,
    refetch: refetchCategories,
  } = useCategories({ activeOnly: false });
  const { canDo } = useCurrentUserPermissions();

  // NOTE: useScheduledPublishProcessor and useAutoContentProcessor have been
  // lifted to AdminDashboardPage so they run regardless of which tab is active.
  // They were previously here but only fired when the Publications tab was open.

  const canCreate = canDo('publications', 'create');
  const canEdit = canDo('publications', 'edit');
  const canDelete = canDo('publications', 'delete');
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

  const handleAIGenerated = useCallback((result: GenerateArticleResult & { categoryId?: string }) => {
    setAiGeneratedResult(result);
    setShowAIGenerator(false);
    setShowEditor(true);
  }, []);

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
    await Promise.all([
      refetchArticles(),
      refetchCategories(),
      checkInitialization(),
    ]);
  }, [checkInitialization, refetchArticles, refetchCategories]);

  // Kanban status change handler
  const handleStatusChange = useCallback(async (articleId: string, newStatus: ArticleStatus) => {
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
  }, [refetchArticles, canPublish]);

  // ── Quick stats for tab badges ───────────────────────────────────────

  const stats = useMemo(() => ({
    total: articles.length,
    published: articles.filter(a => a.status === 'published').length,
    drafts: articles.filter(a => a.status === 'draft').length,
    categories: categories.length,
  }), [articles, categories]);

  // ── Loading state ────────────────────────────────────────────────────

  if (isLoading) {
    return <PublicationsSkeleton />;
  }

  // ── Initialization gate ──────────────────────────────────────────────

  if (isInitialized === false) {
    return (
      <div className="space-y-6 p-6">
        <ModuleHeader
          title="Publications"
          subtitle="First-time setup required"
        />
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
          key={selectedArticle?.id || `new-${selectedTemplate?.id || aiGeneratedResult?.suggestedSlug || 'blank'}`}
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
    <div className="space-y-0">
      {/* Header */}
      <div className="px-6 pt-6 pb-4 border-b bg-white sticky top-0 z-20">
        <div className="flex items-center justify-between">
          <ModuleHeader
            title="Publications"
            subtitle="Manage articles, content pipeline, and analytics"
          />
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              className="gap-1.5"
              disabled={isRefreshing}
            >
              <RefreshCw className={cn('h-3.5 w-3.5', isRefreshing && 'animate-spin')} />
              <span className="hidden sm:inline">Refresh</span>
            </Button>
            <Button
              onClick={handleCreateNew}
              size="sm"
              className="gap-1.5 bg-purple-600 hover:bg-purple-700"
              disabled={!canCreate}
            >
              <PlusCircle className="h-3.5 w-3.5" />
              New Article
            </Button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="px-6 pt-4">
        <div className="overflow-x-auto scrollbar-hide -mx-1 px-1">
          <TabsList className="bg-gray-100/80 p-1 w-max min-w-full">
            <TabsTrigger value="analytics" className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Analytics
            </TabsTrigger>
            <TabsTrigger value="articles" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Articles
              {stats.total > 0 && (
                <Badge variant="secondary" className="ml-1 text-[10px] px-1.5 py-0 h-4">
                  {stats.total}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="pipeline" className="flex items-center gap-2">
              <Layers className="h-4 w-4" />
              Pipeline
              {stats.drafts > 0 && (
                <Badge variant="outline" className="ml-1 text-[10px] px-1.5 py-0 h-4 border-orange-300 text-orange-600">
                  {stats.drafts}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="calendar" className="flex items-center gap-2">
              <CalendarDays className="h-4 w-4" />
              Calendar
            </TabsTrigger>
            <TabsTrigger value="templates" className="flex items-center gap-2">
              <Sparkles className="h-4 w-4" />
              Templates
            </TabsTrigger>
            <TabsTrigger value="automation" className="flex items-center gap-2">
              <Zap className="h-4 w-4" />
              Automation
            </TabsTrigger>
            <TabsTrigger value="categories" className="flex items-center gap-2">
              <FolderTree className="h-4 w-4" />
              Categories
            </TabsTrigger>
            <TabsTrigger value="subscribers" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Subscribers
            </TabsTrigger>
            <TabsTrigger value="broadcast" className="flex items-center gap-2">
              <Send className="h-4 w-4" />
              Broadcast
            </TabsTrigger>
            <TabsTrigger value="team" className="flex items-center gap-2">
              <Contact className="h-4 w-4" />
              Team
            </TabsTrigger>
            <TabsTrigger value="careers" className="flex items-center gap-2">
              <Briefcase className="h-4 w-4" />
              Careers
            </TabsTrigger>
            <TabsTrigger value="settings" className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              Settings
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Analytics Tab */}
        <TabsContent value="analytics" className="mt-6">
          {articlesLoading ? (
            <LoadingPlaceholder message="Loading analytics..." />
          ) : (
            <ContentAnalytics
              articles={articles}
              categories={categories}
            />
          )}
        </TabsContent>

        {/* Articles Tab */}
        <TabsContent value="articles" className="mt-6">
          <ArticlesListView
            onCreateNew={handleCreateNew}
            onEditArticle={handleEditArticle}
          />
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
          <AutoContentPanel
            categories={categories}
            onArticlesGenerated={refetchArticles}
          />
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

        {/* Broadcast Tab */}
        <TabsContent value="broadcast" className="mt-6">
          <React.Suspense fallback={<LoadingPlaceholder message="Loading broadcast..." />}>
            <NewsletterBroadcast />
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
