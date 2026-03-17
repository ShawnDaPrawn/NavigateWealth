/**
 * Social Media Tab - Refactored (Phase 3)
 * 
 * Main social media management interface featuring:
 * - Calendar view for scheduled posts
 * - Post composer for creating content (with AI pre-population)
 * - AI Generator with text, image, bundle, and history sub-tabs
 * - Profile connector for managing platforms
 * - Real-time stats and analytics
 * 
 * @module social-media/SocialMediaTab
 */

import React, { useState, useMemo, useCallback } from 'react';
import { Button } from '../../../ui/button';
import { Card, CardContent } from '../../../ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../../ui/tabs';
import { 
  Calendar, 
  PlusCircle,
  Users,
  Eye,
  TrendingUp,
  Sparkles,
  Image as ImageIcon,
  Layers,
  Clock,
  Newspaper,
  Palette,
  BarChart3,
  FileText,
} from 'lucide-react';
import { ProfileConnector } from './ProfileConnector';
import { PostComposer } from './PostComposer';
import { PostCalendar } from './PostCalendar';
import { useSocialProfiles } from './hooks/useSocialProfiles';
import { useSocialPosts } from './hooks/useSocialPosts';
import { formatFollowerCount } from './utils';
import type { SocialPlatform, SocialPost, MediaFile, SocialAIPlatform } from './types';
import type { CreatePostRequest } from './api';
import { AIContentGenerator } from './components/AIContentGenerator';
import { AIImageGenerator } from './components/AIImageGenerator';
import { AIGenerationHistory } from './components/AIGenerationHistory';
import { AIBundleGenerator } from './components/AIBundleGenerator';
import { AIArticleRepurposer } from './components/AIArticleRepurposer';
import { AIBrandTemplates } from './components/AIBrandTemplates';
import { AIAnalyticsDashboard } from './components/AIAnalyticsDashboard';
import { DraftPosts } from './components/DraftPosts';

// ============================================================================
// Helpers
// ============================================================================

/** Maps ComposedPostData (content/selectedProfiles) onto CreatePostRequest (body/profiles). */
function mapComposedToRequest(
  postData: Record<string, unknown>,
  overrides?: Partial<CreatePostRequest>,
): CreatePostRequest {
  return {
    body: (postData.content as string) ?? '',
    profiles: (postData.selectedProfiles as string[]) ?? [],
    media: postData.media as CreatePostRequest['media'],
    link: postData.link as CreatePostRequest['link'],
    campaign: postData.campaignId as string | undefined,
    tags: postData.tags as string[] | undefined,
    ...overrides,
  };
}

export function SocialMediaTab() {
  // ============================================================================
  // State
  // ============================================================================
  
  const [activeTab, setActiveTab] = useState('calendar');
  const [selectedProfiles, setSelectedProfiles] = useState<string[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [viewMode, setViewMode] = useState<'month' | 'week' | 'day'>('week');

  // AI → PostComposer pre-population state
  const [composerInitialContent, setComposerInitialContent] = useState<string | undefined>();
  const [composerInitialMedia, setComposerInitialMedia] = useState<MediaFile[] | undefined>();
  const [composerInitialHashtags, setComposerInitialHashtags] = useState<string[] | undefined>();
  // AI Generator inner tab state (controlled so we can switch from History)
  const [aiSubTab, setAiSubTab] = useState('text');

  // ============================================================================
  // Hooks
  // ============================================================================
  
  const { 
    profiles, 
    connectedProfiles,
    connectProfile,
    disconnectProfile,
    syncProfile 
  } = useSocialProfiles();

  const {
    posts,
    createPost,
    deletePost,
    duplicatePost,
    schedulePost,
    publishPost,
    getPostsByStatus,
  } = useSocialPosts();

  // ============================================================================
  // Computed Values
  // ============================================================================
  
  const totalFollowers = useMemo(() => 
    connectedProfiles.reduce((sum, p) => sum + (p.followerCount || 0), 0),
    [connectedProfiles]
  );

  const scheduledPosts = useMemo(() => 
    getPostsByStatus('scheduled'),
    [posts, getPostsByStatus]
  );

  const publishedPosts = useMemo(() => 
    getPostsByStatus('published'),
    [posts, getPostsByStatus]
  );

  const totalEngagement = useMemo(() => 
    publishedPosts.reduce((sum, p) => 
      sum + (p.analytics?.reactions || 0) + 
            (p.analytics?.comments || 0) + 
            (p.analytics?.shares || 0), 0
    ),
    [publishedPosts]
  );

  const draftPosts = useMemo(() =>
    getPostsByStatus('draft'),
    [posts, getPostsByStatus],
  );

  /** Profile ID → { name, platform } lookup for DraftPosts display */
  const profileNameLookup = useMemo(() => {
    const lookup: Record<string, { name: string; platform: SocialPlatform }> = {};
    for (const p of profiles) {
      lookup[p.id] = { name: p.name, platform: p.platform };
    }
    return lookup;
  }, [profiles]);

  // ============================================================================
  // Handlers - Profiles
  // ============================================================================
  
  const handleConnect = async (platform: SocialPlatform) => {
    await connectProfile({ platform });
  };

  const handleDisconnect = async (profileId: string) => {
    await disconnectProfile(profileId);
  };

  const handleRefresh = async (profileId: string) => {
    await syncProfile(profileId);
  };

  // ============================================================================
  // Handlers - Posts
  // ============================================================================
  
  const handleSavePost = async (postData: Record<string, unknown>) => {
    await createPost(mapComposedToRequest(postData));
    clearComposerInitials();
    setActiveTab('calendar');
  };

  const handleSchedulePost = async (postData: Record<string, unknown>, scheduledAt: Date) => {
    await createPost(mapComposedToRequest(postData, { scheduledAt }));
    clearComposerInitials();
    setActiveTab('calendar');
  };

  const handlePublishPost = async (postData: Record<string, unknown>) => {
    await createPost(mapComposedToRequest(postData));
    clearComposerInitials();
    setActiveTab('calendar');
  };

  const handlePostEdit = (post: SocialPost) => {
    // TODO: Implement edit functionality
    console.log('Edit post:', post);
  };

  const handlePostDelete = async (postId: string) => {
    await deletePost(postId);
  };

  const handlePostDuplicate = async (post: SocialPost) => {
    await duplicatePost(post.id);
  };

  const handleCreatePost = (date: Date) => {
    setSelectedDate(date);
    setActiveTab('composer');
  };

  // ============================================================================
  // Handlers — AI → PostComposer wiring
  // ============================================================================

  /** Clear pre-population state after post is saved/published */
  const clearComposerInitials = useCallback(() => {
    setComposerInitialContent(undefined);
    setComposerInitialMedia(undefined);
    setComposerInitialHashtags(undefined);
  }, []);

  /** "Use in Post" for AI-generated text */
  const handleUseTextContent = useCallback(
    (_platform: SocialAIPlatform, content: string, hashtags: string[]) => {
      setComposerInitialContent(content);
      setComposerInitialHashtags(hashtags);
      setActiveTab('composer');
    },
    [],
  );

  /** "Use in Post" for AI-generated image */
  const handleUseImage = useCallback(
    (signedUrl: string, _storagePath: string, platform: string) => {
      const mediaFile: MediaFile = {
        id: `ai_img_${Date.now()}`,
        url: signedUrl,
        type: 'image',
        filename: `navigate-wealth-${platform}-ai.png`,
        size: 0, // Unknown for remote URLs
      };
      setComposerInitialMedia([mediaFile]);
      setActiveTab('composer');
    },
    [],
  );

  /** "Use Both" from bundle generator — text + image together */
  const handleUseBoth = useCallback(
    (
      _platform: SocialAIPlatform,
      content: string,
      hashtags: string[],
      imageUrl: string,
      _imagePath: string,
    ) => {
      setComposerInitialContent(content);
      setComposerInitialHashtags(hashtags);
      const mediaFile: MediaFile = {
        id: `ai_bundle_img_${Date.now()}`,
        url: imageUrl,
        type: 'image',
        filename: `navigate-wealth-bundle-ai.png`,
        size: 0,
      };
      setComposerInitialMedia([mediaFile]);
      setActiveTab('composer');
    },
    [],
  );

  // ============================================================================
  // Render
  // ============================================================================
  
  return (
    <div className="space-y-6">
      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Connected Profiles</p>
                <p className="text-2xl font-bold">{connectedProfiles.length}</p>
              </div>
              <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-blue-50">
                <Users className="h-5 w-5 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Followers</p>
                <p className="text-2xl font-bold">
                  {formatFollowerCount(totalFollowers)}
                </p>
              </div>
              <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-green-50">
                <Eye className="h-5 w-5 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Scheduled Posts</p>
                <p className="text-2xl font-bold">{scheduledPosts.length}</p>
              </div>
              <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-orange-50">
                <Calendar className="h-5 w-5 text-orange-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Engagement</p>
                <p className="text-2xl font-bold">{totalEngagement}</p>
              </div>
              <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-purple-50">
                <TrendingUp className="h-5 w-5 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Action Button */}
      <div className="flex justify-end gap-2">
        <Button
          variant="outline"
          onClick={() => setActiveTab('ai-generator')}
          className="flex items-center gap-2"
        >
          <Sparkles className="h-4 w-4" />
          AI Generator
        </Button>
        <Button 
          onClick={() => {
            clearComposerInitials();
            setActiveTab('composer');
          }}
          className="flex items-center gap-2"
        >
          <PlusCircle className="h-4 w-4" />
          Create Post
        </Button>
      </div>

      {/* Main Content Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="calendar">Calendar &amp; Queue</TabsTrigger>
          <TabsTrigger value="composer">Create Post</TabsTrigger>
          <TabsTrigger value="ai-generator" className="flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5" />
            AI Generator
          </TabsTrigger>
          <TabsTrigger value="profiles">Connected Profiles</TabsTrigger>
        </TabsList>

        <TabsContent value="calendar" className="mt-6">
          <PostCalendar
            posts={posts}
            selectedDate={selectedDate}
            onDateChange={setSelectedDate}
            onPostEdit={handlePostEdit}
            onPostDelete={handlePostDelete}
            onPostDuplicate={handlePostDuplicate}
            onCreatePost={handleCreatePost}
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
              onSave={handleSavePost}
              onSchedule={handleSchedulePost}
              onPublish={handlePublishPost}
              initialContent={composerInitialContent}
              initialMedia={composerInitialMedia}
              initialHashtags={composerInitialHashtags}
            />
          </div>
        </TabsContent>

        <TabsContent value="ai-generator" className="mt-6">
          <div className="max-w-5xl">
            <Tabs value={aiSubTab} onValueChange={setAiSubTab} className="w-full">
              <TabsList className="mb-4">
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
                <TabsTrigger value="drafts" className="flex items-center gap-1.5">
                  <FileText className="h-3.5 w-3.5" />
                  Drafts
                  {draftPosts.length > 0 && (
                    <span
                      className="ml-0.5 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-semibold text-white"
                      style={{ backgroundColor: '#1B2A4A' }}
                    >
                      {draftPosts.length}
                    </span>
                  )}
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
                <AIGenerationHistory
                  onUseText={handleUseTextContent}
                  onUseImage={handleUseImage}
                />
              </TabsContent>

              <TabsContent value="ai-analytics">
                <AIAnalyticsDashboard />
              </TabsContent>

              <TabsContent value="drafts">
                <DraftPosts
                  posts={draftPosts}
                  profileNameLookup={profileNameLookup}
                  onEdit={(post) => {
                    setComposerInitialContent(post.body);
                    setComposerInitialMedia(post.media?.length ? post.media : undefined);
                    setComposerInitialHashtags(post.tags);
                    setActiveTab('composer');
                  }}
                  onDelete={deletePost}
                  onDuplicate={handlePostDuplicate}
                  onSchedule={schedulePost}
                  onPublish={publishPost}
                />
              </TabsContent>
            </Tabs>
          </div>
        </TabsContent>

        <TabsContent value="profiles" className="mt-6">
          <ProfileConnector
            profiles={profiles}
            onConnect={handleConnect}
            onDisconnect={handleDisconnect}
            onRefresh={handleRefresh}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}