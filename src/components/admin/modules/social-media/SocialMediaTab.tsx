/**
 * Social Media Tab
 *
 * Organised around the weekly pipeline rather than the calendar:
 * - Assets — finished images and videos per channel, ready to post
 * - Weekly pipeline — the post candidates the weekly routines generated
 * - Calendar — Buffer's queue
 * - Compose — a manual post into Buffer (assets and AI content flow in here)
 * - AI generator — text, image, bundle, repurpose, templates, history, analytics
 *   (a segmented control, kept in the address as ?ai=)
 * - Channels — the Buffer connections
 * - Link in bio — the public link page
 *
 * One row of level-1 tabs, kept in the address (?tab=). Automation settings &
 * playbooks open as a page of their own (?tab=weekly&page=automation).
 * The stat cards read real numbers: this week's assets, Buffer's queue, and
 * Buffer's aggregated metrics.
 *
 * @module social-media/SocialMediaTab
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { PlusCircle } from 'lucide-react';
import { useSearchParams } from 'react-router';
import { Skeleton } from '../../../ui/skeleton';
import { Button } from '../../../ui/button';
import { Tabs, TabsContent } from '../../../ui/tabs';
import {
  NavTabsList,
  NavTabsTrigger,
  PageHeader,
  SegmentedList,
  SegmentedTrigger,
  StatCard,
  ErrorState,
  useBreadcrumbTrail,
  useUrlState,
} from '../../layout/page';
import { AutomationSettingsPage } from './assets/AutomationSettingsPage';
import { LinktreeTab } from './LinktreeTab';
import { ChannelAssetsTab } from './channel-assets/ChannelAssetsTab';
import { WeeklyPipelineTab } from './assets/WeeklyPipelineTab';
import { postingWeekKey } from './assets/assetsModel';
import { ChannelsPanel } from './ChannelsPanel';
import { PostCalendar, type CalendarViewMode } from './PostCalendar';
import { covers, unionRange, visibleWindow } from './calendarModel';
import { PostComposer } from './PostComposer';
import { AIAnalyticsDashboard } from './components/AIAnalyticsDashboard';
import { AIArticleRepurposer } from './components/AIArticleRepurposer';
import { AIBrandTemplates } from './components/AIBrandTemplates';
import { AIBundleGenerator } from './components/AIBundleGenerator';
import { AIContentGenerator } from './components/AIContentGenerator';
import { AIGenerationHistory } from './components/AIGenerationHistory';
import { AIImageGenerator } from './components/AIImageGenerator';
import { assetToMediaFile } from './composerModel';
import { useMarkChannelAssetsUsed } from './hooks/useChannelAssets';
import { useSocialAnalytics } from './hooks/useSocialAnalytics';
import { useSocialBatches } from './hooks/useSocialAssets';
import { defaultPostRange, useSocialPosts } from './hooks/useSocialPosts';
import { useSocialProfiles } from './hooks/useSocialProfiles';
import type { ChannelAsset, ComposeRequest, MediaFile, SocialAIPlatform } from './types';

const SOCIAL_TABS = [
  'assets',
  'weekly',
  'calendar',
  'composer',
  'ai-generator',
  'channels',
  'linktree',
] as const;
type SocialTab = (typeof SOCIAL_TABS)[number];

const AI_VIEWS = [
  'text',
  'image',
  'bundle',
  'repurpose',
  'templates',
  'history',
  'ai-analytics',
] as const;
type AiView = (typeof AI_VIEWS)[number];
const AI_VIEW_LABEL: Record<AiView, string> = {
  text: 'Post text',
  image: 'Branded image',
  bundle: 'Bundle',
  repurpose: 'Repurpose',
  templates: 'Templates',
  history: 'History',
  'ai-analytics': 'Analytics',
};

const PAGES = ['', 'automation'] as const;

const TAB_LABEL: Record<SocialTab, string> = {
  assets: 'Assets',
  weekly: 'Weekly pipeline',
  calendar: 'Calendar',
  composer: 'Compose',
  'ai-generator': 'AI generator',
  channels: 'Channels',
  linktree: 'Link in bio',
};

/** Tabs that show the four KPI tiles above their content (per the boards). */
const TABS_WITH_TILES: readonly SocialTab[] = ['assets', 'weekly', 'calendar'];

export function SocialMediaTab() {
  const [activeTab, setActiveTab] = useUrlState<SocialTab>('tab', 'assets', SOCIAL_TABS);
  const [aiSubTab, setAiSubTab] = useUrlState<AiView>('ai', 'text', AI_VIEWS);
  const [, setSearchParams] = useSearchParams();
  const [page, setPage] = useUrlState<(typeof PAGES)[number]>('page', '', PAGES);
  const backToWeekly = useCallback(
    () =>
      // One update: two setters in a row would each start from the same
      // address and the second would undo the first.
      setSearchParams(
        (current) => {
          const params = new URLSearchParams(current);
          params.delete('page');
          params.delete('section');
          params.set('tab', 'weekly');
          return params;
        },
        { replace: true },
      ),
    [setSearchParams],
  );

  // Top-bar breadcrumb after "Social & Marketing" (matches the boards).
  useBreadcrumbTrail(
    page === 'automation'
      ? [{ label: 'Weekly pipeline', onClick: backToWeekly }, { label: 'Settings & playbooks' }]
      : activeTab === 'ai-generator'
        ? [{ label: 'AI generator' }, { label: AI_VIEW_LABEL[aiSubTab] }]
        : [{ label: TAB_LABEL[activeTab] }],
  );

  const [selectedProfiles, setSelectedProfiles] = useState<string[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [viewMode, setViewMode] = useState<CalendarViewMode>('week');

  // AI → composer pre-population
  const [composerInitialContent, setComposerInitialContent] = useState<string | undefined>();
  const [composerInitialMedia, setComposerInitialMedia] = useState<MediaFile[] | undefined>();
  const [composerInitialHashtags, setComposerInitialHashtags] = useState<string[] | undefined>();

  const {
    profiles,
    loading: profilesLoading,
    error: profilesError,
    fetchProfiles,
  } = useSocialProfiles();
  const {
    posts,
    loading: postsLoading,
    error: postsError,
    refetch: refetchPosts,
    range,
    setRange,
    createPost,
    isCreating,
    deletePost,
    getPostsByStatus,
  } = useSocialPosts();
  const { mutate: markAssetsUsed } = useMarkChannelAssetsUsed();

  // The query window follows the calendar: whatever month/week/day is on screen is
  // unioned into the fetched range, so navigating past the default window still
  // shows Buffer's posts there. The range only grows, so this cannot loop.
  useEffect(() => {
    const visible = visibleWindow(selectedDate, viewMode);
    if (!covers(range, visible)) setRange(unionRange(range, visible));
  }, [selectedDate, viewMode, range, setRange]);
  const defaultRange = useMemo(() => defaultPostRange(), []);
  const batchesQuery = useSocialBatches(16);
  const analytics = useSocialAnalytics(30);

  const postingWeek = postingWeekKey();
  const postingBatch = (batchesQuery.data ?? []).find((b) => b.week_key === postingWeek);
  const assetsThisWeek = postingBatch
    ? Object.values(postingBatch.asset_counts).reduce((sum, n) => sum + n, 0)
    : 0;

  // "Queued in Buffer" counts the default window (two weeks back, nine ahead) so the
  // number does not change as the calendar is navigated further out.
  const scheduledPosts = useMemo(
    () =>
      getPostsByStatus('scheduled').filter(
        (p) =>
          !p.scheduledAt ||
          (p.scheduledAt >= defaultRange.start && p.scheduledAt <= defaultRange.end),
      ),
    [getPostsByStatus, defaultRange],
  );
  const nextScheduled = useMemo(
    () =>
      scheduledPosts
        .map((p) => p.scheduledAt)
        .filter((d): d is Date => Boolean(d) && (d as Date).getTime() > Date.now())
        .sort((a, b) => a.getTime() - b.getTime())[0],
    [scheduledPosts],
  );

  const totals = analytics.data?.totals;
  const engagement =
    totals &&
    ['reactions', 'likes', 'comments', 'shares', 'reposts'].some((k) => totals[k] !== undefined)
      ? (totals.reactions ?? 0) +
        (totals.likes ?? 0) +
        (totals.comments ?? 0) +
        (totals.shares ?? 0) +
        (totals.reposts ?? 0)
      : null;
  const published30d = totals?.postCount ?? null;

  const clearComposerInitials = useCallback(() => {
    setComposerInitialContent(undefined);
    setComposerInitialMedia(undefined);
    setComposerInitialHashtags(undefined);
  }, []);

  const handleCompose = useCallback(
    async (request: ComposeRequest, assetIds: string[]) => {
      const result = await createPost(request);
      if (result && result.created.length > 0) {
        // The picture has gone out, so take it off the shelf. Without this an
        // asset stays `available` and the publishing routine would queue it a
        // second time. Buffer creates one post per channel; the first id is
        // enough to trace the asset back to what carried it.
        if (assetIds.length > 0) {
          markAssetsUsed({ ids: assetIds, bufferPostId: result.created[0]?.postId });
        }
        clearComposerInitials();
        setActiveTab('calendar');
      }
      return result;
    },
    [createPost, clearComposerInitials, markAssetsUsed, setActiveTab],
  );

  const handleCreatePostFromAsset = useCallback(
    (asset: ChannelAsset) => {
      // Everything the asset already knows, carried into the draft so the post
      // starts written rather than blank: the picture, the caption an agent
      // wrote for it, and the channel it was made for. All of it stays
      // editable — this is a starting point, not a commitment.
      setComposerInitialMedia([assetToMediaFile(asset)]);
      setComposerInitialContent(asset.caption ?? '');
      setComposerInitialHashtags(undefined);

      const forChannel = profiles
        .filter((p) => p.isConnected && p.platform === asset.channel)
        .map((p) => p.id);
      if (forChannel.length > 0) setSelectedProfiles(forChannel);

      setActiveTab('composer');
    },
    [profiles, setActiveTab],
  );

  const handleUseTextContent = useCallback(
    (_platform: SocialAIPlatform, content: string, hashtags: string[]) => {
      setComposerInitialContent(content);
      setComposerInitialHashtags(hashtags);
      setActiveTab('composer');
    },
    [setActiveTab],
  );

  const handleUseImage = useCallback(
    (signedUrl: string, storagePath: string, platform: string) => {
      setComposerInitialMedia([
        {
          id: `ai_img_${storagePath}`,
          url: signedUrl,
          storagePath,
          type: 'image',
          filename: `navigate-wealth-${platform}-ai.png`,
          size: 0,
        },
      ]);
      setActiveTab('composer');
    },
    [setActiveTab],
  );

  const handleUseBoth = useCallback(
    (
      _platform: SocialAIPlatform,
      content: string,
      hashtags: string[],
      imageUrl: string,
      imagePath: string,
    ) => {
      setComposerInitialContent(content);
      setComposerInitialHashtags(hashtags);
      setComposerInitialMedia([
        {
          id: `ai_bundle_${imagePath}`,
          url: imageUrl,
          storagePath: imagePath,
          type: 'image',
          filename: 'navigate-wealth-bundle-ai.png',
          size: 0,
        },
      ]);
      setActiveTab('composer');
    },
    [setActiveTab],
  );

  if (page === 'automation') {
    return <AutomationSettingsPage onBack={backToWeekly} />;
  }

  const tiles = (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <StatCard
        label="Assets this week"
        value={assetsThisWeek}
        meta={
          postingBatch
            ? `${postingBatch.scheduled_count} scheduled · ${postingWeek}`
            : `No batch yet for ${postingWeek}`
        }
      />
      <StatCard
        label="Queued in Buffer"
        value={scheduledPosts.length}
        meta={
          nextScheduled
            ? `Next ${nextScheduled.toLocaleString('en-ZA', { weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}`
            : 'Nothing queued'
        }
      />
      <StatCard
        label="Published (30 days)"
        value={published30d ?? '—'}
        meta={analytics.error ? 'Buffer metrics unavailable' : 'From Buffer analytics'}
      />
      <StatCard
        label="Engagement (30 days)"
        value={engagement ?? '—'}
        meta="Reactions, comments and shares"
      />
    </div>
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Social & Marketing"
        description="Social posts through Buffer, AI content and your link-in-bio page."
        actions={
          <Button
            onClick={() => {
              clearComposerInitials();
              setActiveTab('composer');
            }}
          >
            <PlusCircle className="h-4 w-4" aria-hidden="true" />
            Compose post
          </Button>
        }
      />

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as SocialTab)} className="gap-5">
        <NavTabsList aria-label="Social & Marketing">
          <NavTabsTrigger value="assets">Assets</NavTabsTrigger>
          <NavTabsTrigger value="weekly">Weekly pipeline</NavTabsTrigger>
          <NavTabsTrigger value="calendar">Calendar</NavTabsTrigger>
          <NavTabsTrigger value="composer">Compose</NavTabsTrigger>
          <NavTabsTrigger value="ai-generator">AI generator</NavTabsTrigger>
          <NavTabsTrigger value="channels">Channels</NavTabsTrigger>
          <NavTabsTrigger value="linktree">Link in bio</NavTabsTrigger>
        </NavTabsList>

        {TABS_WITH_TILES.includes(activeTab) && tiles}

        <TabsContent value="assets" className="mt-0">
          <ChannelAssetsTab onCreatePost={handleCreatePostFromAsset} />
        </TabsContent>

        <TabsContent value="weekly" className="mt-0">
          <WeeklyPipelineTab onOpenSettings={() => setPage('automation')} />
        </TabsContent>

        <TabsContent value="calendar" className="mt-0">
          {postsError ? (
            <ErrorState
              title="Unable to load Buffer posts"
              onRetry={() => void refetchPosts()}
              details={postsError}
            />
          ) : postsLoading ? (
            <div aria-busy="true" aria-label="Loading the calendar" className="space-y-3">
              <Skeleton className="h-10 w-full rounded-lg" />
              <div className="grid grid-cols-7 gap-2">
                {Array.from({ length: 7 }).map((_, i) => (
                  <Skeleton key={i} className="h-48 rounded-lg" />
                ))}
              </div>
            </div>
          ) : (
            <PostCalendar
              posts={posts}
              profiles={profiles}
              selectedDate={selectedDate}
              onDateChange={setSelectedDate}
              onPostDelete={deletePost}
              onCreatePost={(date) => {
                setSelectedDate(date);
                setActiveTab('composer');
              }}
              viewMode={viewMode}
              onViewModeChange={setViewMode}
            />
          )}
        </TabsContent>

        <TabsContent value="composer" className="mt-0">
          {profilesError ? (
            <ErrorState
              title="Unable to load Buffer channels"
              onRetry={() => void fetchProfiles()}
              details={profilesError}
            />
          ) : profilesLoading ? (
            <div aria-busy="true" aria-label="Loading channels" className="max-w-4xl space-y-3">
              <Skeleton className="h-24 w-full rounded-xl" />
              <Skeleton className="h-48 w-full rounded-xl" />
            </div>
          ) : (
            <div className="max-w-4xl">
              <PostComposer
                profiles={profiles}
                selectedProfiles={selectedProfiles}
                onProfilesChange={setSelectedProfiles}
                onSubmit={handleCompose}
                isSubmitting={isCreating}
                initialContent={composerInitialContent}
                initialMedia={composerInitialMedia}
                initialHashtags={composerInitialHashtags}
              />
            </div>
          )}
        </TabsContent>

        <TabsContent value="ai-generator" className="mt-0">
          <div className="max-w-5xl">
            <Tabs
              value={aiSubTab}
              onValueChange={(v) => setAiSubTab(v as AiView)}
              className="w-full"
            >
              <SegmentedList aria-label="AI generator views" className="mb-4">
                {AI_VIEWS.map((view) => (
                  <SegmentedTrigger key={view} value={view}>
                    {AI_VIEW_LABEL[view]}
                  </SegmentedTrigger>
                ))}
              </SegmentedList>

              <TabsContent value="text">
                <AIContentGenerator onUseContent={handleUseTextContent} />
              </TabsContent>
              <TabsContent value="image">
                <AIImageGenerator onUseImage={handleUseImage} />
              </TabsContent>
              <TabsContent value="bundle">
                <AIBundleGenerator
                  onUseContent={handleUseTextContent}
                  onUseImage={handleUseImage}
                  onUseBoth={handleUseBoth}
                />
              </TabsContent>
              <TabsContent value="repurpose">
                <AIArticleRepurposer onUseContent={handleUseTextContent} />
              </TabsContent>
              <TabsContent value="templates">
                <AIBrandTemplates onUseContent={handleUseTextContent} />
              </TabsContent>
              <TabsContent value="history">
                <AIGenerationHistory onUseText={handleUseTextContent} onUseImage={handleUseImage} />
              </TabsContent>
              <TabsContent value="ai-analytics">
                <AIAnalyticsDashboard />
              </TabsContent>
            </Tabs>
          </div>
        </TabsContent>

        <TabsContent value="channels" className="mt-0">
          <ChannelsPanel />
        </TabsContent>

        <TabsContent value="linktree" className="mt-0">
          <LinktreeTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
