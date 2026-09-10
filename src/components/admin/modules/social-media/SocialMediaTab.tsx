/**
 * Social Media Tab
 *
 * Organised around the weekly pipeline rather than the calendar:
 * - Assets — what the routines generated and scheduled for each channel
 * - Calendar — Buffer's queue
 * - Compose — a manual post into Buffer (AI generator content flows in here)
 * - AI Generator — text, image, bundle, repurpose, templates, history, analytics
 * - Channels — the Buffer connections
 *
 * The stat cards read real numbers: this week's assets, Buffer's queue, and
 * Buffer's aggregated metrics.
 *
 * @module social-media/SocialMediaTab
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  BarChart3,
  Calendar,
  Clock,
  Image as ImageIcon,
  Layers,
  Newspaper,
  Palette,
  PlusCircle,
  Send,
  Sparkles,
  TrendingUp,
} from 'lucide-react';
import { Button } from '../../../ui/button';
import { Card, CardContent } from '../../../ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../../ui/tabs';
import { AssetsTab } from './assets/AssetsTab';
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
import { useSocialAnalytics } from './hooks/useSocialAnalytics';
import { useSocialBatches } from './hooks/useSocialAssets';
import { defaultPostRange, useSocialPosts } from './hooks/useSocialPosts';
import { useSocialProfiles } from './hooks/useSocialProfiles';
import type { ComposeRequest, MediaFile, SocialAIPlatform } from './types';

interface StatCardProps {
  label: string;
  value: string | number;
  hint?: string;
  icon: typeof Calendar;
  tone: 'blue' | 'green' | 'orange' | 'purple';
}

const TONES: Record<StatCardProps['tone'], string> = {
  blue: 'bg-blue-50 text-blue-600',
  green: 'bg-green-50 text-green-600',
  orange: 'bg-orange-50 text-orange-600',
  purple: 'bg-purple-50 text-purple-600',
};

/** §8.3 stat card: white card, tinted icon container, big number, muted label. */
function StatCard({ label, value, hint, icon: Icon, tone }: StatCardProps) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className="text-2xl font-bold">{value}</p>
            {hint && <p className="text-xs text-muted-foreground mt-0.5">{hint}</p>}
          </div>
          <div className={`flex items-center justify-center h-10 w-10 rounded-lg ${TONES[tone]}`}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function SocialMediaTab() {
  const [activeTab, setActiveTab] = useState('assets');
  const [aiSubTab, setAiSubTab] = useState('text');
  const [selectedProfiles, setSelectedProfiles] = useState<string[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [viewMode, setViewMode] = useState<CalendarViewMode>('week');

  // AI → composer pre-population
  const [composerInitialContent, setComposerInitialContent] = useState<string | undefined>();
  const [composerInitialMedia, setComposerInitialMedia] = useState<MediaFile[] | undefined>();
  const [composerInitialHashtags, setComposerInitialHashtags] = useState<string[] | undefined>();

  const { profiles } = useSocialProfiles();
  const { posts, range, setRange, createPost, isCreating, deletePost, getPostsByStatus } =
    useSocialPosts();

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
    async (request: ComposeRequest) => {
      const result = await createPost(request);
      if (result && result.created.length > 0) {
        clearComposerInitials();
        setActiveTab('calendar');
      }
      return result;
    },
    [createPost, clearComposerInitials],
  );

  const handleUseTextContent = useCallback(
    (_platform: SocialAIPlatform, content: string, hashtags: string[]) => {
      setComposerInitialContent(content);
      setComposerInitialHashtags(hashtags);
      setActiveTab('composer');
    },
    [],
  );

  const handleUseImage = useCallback((signedUrl: string, storagePath: string, platform: string) => {
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
  }, []);

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
    [],
  );

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard
          label="Assets this week"
          value={assetsThisWeek}
          hint={
            postingBatch
              ? `${postingBatch.scheduled_count} scheduled · ${postingWeek}`
              : `No batch yet for ${postingWeek}`
          }
          icon={Layers}
          tone="blue"
        />
        <StatCard
          label="Queued in Buffer"
          value={scheduledPosts.length}
          hint={
            nextScheduled
              ? `Next ${nextScheduled.toLocaleString('en-ZA', { weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}`
              : 'Nothing queued'
          }
          icon={Calendar}
          tone="orange"
        />
        <StatCard
          label="Published (30 days)"
          value={published30d ?? '—'}
          hint={analytics.error ? 'Buffer metrics unavailable' : 'From Buffer analytics'}
          icon={Send}
          tone="green"
        />
        <StatCard
          label="Engagement (30 days)"
          value={engagement ?? '—'}
          hint="Reactions, comments and shares"
          icon={TrendingUp}
          tone="purple"
        />
      </div>

      <div className="flex justify-end">
        <Button
          onClick={() => {
            clearComposerInitials();
            setActiveTab('composer');
          }}
          className="flex items-center gap-2"
        >
          <PlusCircle className="h-4 w-4" />
          Compose
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="flex flex-wrap h-auto">
          <TabsTrigger value="assets">Assets</TabsTrigger>
          <TabsTrigger value="calendar">Calendar</TabsTrigger>
          <TabsTrigger value="composer">Compose</TabsTrigger>
          <TabsTrigger value="ai-generator" className="flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5" />
            AI Generator
          </TabsTrigger>
          <TabsTrigger value="channels">Channels</TabsTrigger>
        </TabsList>

        <TabsContent value="assets" className="mt-6">
          <AssetsTab />
        </TabsContent>

        <TabsContent value="calendar" className="mt-6">
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
        </TabsContent>

        <TabsContent value="composer" className="mt-6">
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
        </TabsContent>

        <TabsContent value="ai-generator" className="mt-6">
          <div className="max-w-5xl">
            <Tabs value={aiSubTab} onValueChange={setAiSubTab} className="w-full">
              <TabsList className="mb-4 flex flex-wrap h-auto">
                <TabsTrigger value="text" className="flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5" />
                  Post Text
                </TabsTrigger>
                <TabsTrigger value="image" className="flex items-center gap-1.5">
                  <ImageIcon className="h-3.5 w-3.5" />
                  Branded Image
                </TabsTrigger>
                <TabsTrigger value="bundle" className="flex items-center gap-1.5">
                  <Layers className="h-3.5 w-3.5" />
                  Bundle
                </TabsTrigger>
                <TabsTrigger value="repurpose" className="flex items-center gap-1.5">
                  <Newspaper className="h-3.5 w-3.5" />
                  Repurpose
                </TabsTrigger>
                <TabsTrigger value="templates" className="flex items-center gap-1.5">
                  <Palette className="h-3.5 w-3.5" />
                  Templates
                </TabsTrigger>
                <TabsTrigger value="history" className="flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5" />
                  History
                </TabsTrigger>
                <TabsTrigger value="ai-analytics" className="flex items-center gap-1.5">
                  <BarChart3 className="h-3.5 w-3.5" />
                  Analytics
                </TabsTrigger>
              </TabsList>

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

        <TabsContent value="channels" className="mt-6">
          <ChannelsPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}
