/**
 * AI Generation History
 *
 * Displays text and image generation history with thumbnails,
 * timestamps, re-use capabilities, and a gallery view for images.
 *
 * @module social-media/components/AIGenerationHistory
 */

import React, { useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../../../ui/card';
import { Button } from '../../../../ui/button';
import { Badge } from '../../../../ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../../../ui/tabs';
import { toast } from 'sonner@2.0.3';
import {
  Clock,
  Copy,
  Check,
  Linkedin,
  Instagram,
  Facebook,
  Twitter,
  FileText,
  Image as ImageIcon,
  Download,
  ArrowRight,
  Loader2,
  Inbox,
  Grid3X3,
  List,
  Sparkles,
} from 'lucide-react';
import { useSocialMediaAI } from '../hooks/useSocialMediaAI';
import type { SocialAIPlatform } from '../types';
import { BRAND } from '../constants';

// ============================================================================
// Constants
// ============================================================================

const PLATFORM_ICONS: Record<string, React.ReactNode> = {
  linkedin: <Linkedin className="h-3.5 w-3.5" />,
  instagram: <Instagram className="h-3.5 w-3.5" />,
  facebook: <Facebook className="h-3.5 w-3.5" />,
  x: <Twitter className="h-3.5 w-3.5" />,
};

const PLATFORM_LABELS: Record<string, string> = {
  linkedin: 'LinkedIn',
  instagram: 'Instagram',
  instagram_story: 'IG Story',
  facebook: 'Facebook',
  x: 'X',
};

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-ZA', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return formatDate(dateStr);
}

// ============================================================================
// Props
// ============================================================================

interface AIGenerationHistoryProps {
  /** Callback to use text content in the post composer */
  onUseText?: (platform: SocialAIPlatform, content: string, hashtags: string[]) => void;
  /** Callback to use an image in the post composer */
  onUseImage?: (signedUrl: string, storagePath: string, platform: string) => void;
}

// ============================================================================
// Component
// ============================================================================

export function AIGenerationHistory({ onUseText, onUseImage }: AIGenerationHistoryProps) {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [imageView, setImageView] = useState<'grid' | 'list'>('grid');

  const {
    history,
    historyLoading,
    imageHistory,
    imageHistoryLoading,
  } = useSocialMediaAI();

  const handleCopyText = useCallback(async (post: GeneratedPlatformPost) => {
    const fullContent = post.hashtags.length > 0
      ? `${post.content}\n\n${post.hashtags.map((h) => `#${h}`).join(' ')}`
      : post.content;
    await navigator.clipboard.writeText(fullContent);
    setCopiedId(`${post.platform}-${post.content.slice(0, 20)}`);
    toast.success('Copied to clipboard');
    setTimeout(() => setCopiedId(null), 2000);
  }, []);

  const handleDownloadImage = useCallback(async (signedUrl: string, platform: string) => {
    try {
      const response = await fetch(signedUrl);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `navigate-wealth-${platform}-${Date.now()}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success('Image downloaded');
    } catch {
      toast.error('Failed to download image');
    }
  }, []);

  const isLoading = historyLoading || imageHistoryLoading;

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          <span className="ml-2 text-muted-foreground">Loading history...</span>
        </CardContent>
      </Card>
    );
  }

  const hasTextHistory = history.length > 0;
  const hasImageHistory = imageHistory.length > 0;
  const hasAnyHistory = hasTextHistory || hasImageHistory;

  if (!hasAnyHistory) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-16 text-center">
          <div className="flex items-center justify-center h-14 w-14 rounded-full bg-gray-50 mb-4">
            <Inbox className="h-7 w-7 text-gray-400" />
          </div>
          <h3 className="text-lg font-semibold mb-1">No Generation History</h3>
          <p className="text-sm text-muted-foreground max-w-sm">
            Generated text and images will appear here. Switch to the Post Text
            or Branded Image tabs to start generating.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Tabs defaultValue={hasTextHistory ? 'text' : 'images'} className="w-full">
        <div className="flex items-center justify-between mb-4">
          <TabsList>
            <TabsTrigger value="text" className="flex items-center gap-1.5">
              <FileText className="h-3.5 w-3.5" />
              Text ({history.length})
            </TabsTrigger>
            <TabsTrigger value="images" className="flex items-center gap-1.5">
              <ImageIcon className="h-3.5 w-3.5" />
              Images ({imageHistory.length})
            </TabsTrigger>
          </TabsList>
        </div>

        {/* ============================================================== */}
        {/* TEXT HISTORY */}
        {/* ============================================================== */}

        <TabsContent value="text">
          {!hasTextHistory ? (
            <Card>
              <CardContent className="py-8 text-center text-sm text-muted-foreground">
                No text generation history yet.
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {history.map((record: AIGenerationRecord) => (
                <Card key={record.id} className="border">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Sparkles className="h-4 w-4 text-purple-500" />
                        <CardTitle className="text-sm font-medium">
                          {record.input.topic.slice(0, 80)}
                          {record.input.topic.length > 80 ? '...' : ''}
                        </CardTitle>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="text-xs font-normal">
                          {record.input.tone}
                        </Badge>
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {timeAgo(record.createdAt)}
                        </span>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {record.result.posts.map((post) => {
                        const copyKey = `${post.platform}-${post.content.slice(0, 20)}`;
                        const isCopied = copiedId === copyKey;

                        return (
                          <div
                            key={post.platform}
                            className="border rounded-lg p-3 bg-gray-50/50"
                          >
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-1.5 text-xs font-medium">
                                {PLATFORM_ICONS[post.platform]}
                                {PLATFORM_LABELS[post.platform] || post.platform}
                              </div>
                              <Badge variant="secondary" className="text-[10px]">
                                {post.characterCount}/{post.characterLimit}
                              </Badge>
                            </div>
                            <p className="text-xs text-gray-700 line-clamp-3 mb-2 whitespace-pre-wrap">
                              {post.content}
                            </p>
                            {post.hashtags.length > 0 && (
                              <div className="flex flex-wrap gap-1 mb-2">
                                {post.hashtags.slice(0, 4).map((tag, i) => (
                                  <span
                                    key={i}
                                    className="text-[10px] px-1.5 py-0.5 rounded-full"
                                    style={{ backgroundColor: BRAND.navyLight, color: BRAND.navy }}
                                  >
                                    #{tag}
                                  </span>
                                ))}
                              </div>
                            )}
                            <div className="flex items-center gap-1.5">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 text-[10px] px-2"
                                onClick={() => handleCopyText(post)}
                              >
                                {isCopied ? (
                                  <Check className="h-3 w-3 mr-1 text-green-600" />
                                ) : (
                                  <Copy className="h-3 w-3 mr-1" />
                                )}
                                {isCopied ? 'Copied' : 'Copy'}
                              </Button>
                              {onUseText && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 text-[10px] px-2"
                                  onClick={() =>
                                    onUseText(
                                      post.platform,
                                      post.content,
                                      post.hashtags,
                                    )
                                  }
                                >
                                  <ArrowRight className="h-3 w-3 mr-1" />
                                  Use
                                </Button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ============================================================== */}
        {/* IMAGE GALLERY */}
        {/* ============================================================== */}

        <TabsContent value="images">
          {!hasImageHistory ? (
            <Card>
              <CardContent className="py-8 text-center text-sm text-muted-foreground">
                No image generation history yet.
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {/* View toggle */}
              <div className="flex items-center justify-end gap-1">
                <Button
                  variant={imageView === 'grid' ? 'secondary' : 'ghost'}
                  size="sm"
                  className="h-7 w-7 p-0"
                  onClick={() => setImageView('grid')}
                >
                  <Grid3X3 className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant={imageView === 'list' ? 'secondary' : 'ghost'}
                  size="sm"
                  className="h-7 w-7 p-0"
                  onClick={() => setImageView('list')}
                >
                  <List className="h-3.5 w-3.5" />
                </Button>
              </div>

              {imageView === 'grid' ? (
                /* Grid View */
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {imageHistory.map((record: AIImageRecord) => {
                    const image = record.result.images[0];
                    if (!image) return null;
                    const platform = record.input.platform;

                    return (
                      <div key={record.id} className="group relative">
                        <div className="aspect-square rounded-lg overflow-hidden border bg-gray-50">
                          <img
                            src={image.signedUrl}
                            alt={`AI-generated ${platform} image`}
                            className="w-full h-full object-cover transition-transform group-hover:scale-105"
                            loading="lazy"
                          />
                        </div>

                        {/* Overlay on hover */}
                        <div className="absolute inset-0 rounded-lg bg-black/0 group-hover:bg-black/40 transition-all flex items-end opacity-0 group-hover:opacity-100">
                          <div className="p-2 w-full flex items-center justify-between">
                            <div className="flex items-center gap-1">
                              <Button
                                variant="secondary"
                                size="sm"
                                className="h-6 text-[10px] px-2"
                                onClick={() =>
                                  handleDownloadImage(image.signedUrl, platform)
                                }
                              >
                                <Download className="h-3 w-3" />
                              </Button>
                              {onUseImage && (
                                <Button
                                  size="sm"
                                  className="h-6 text-[10px] px-2"
                                  onClick={() =>
                                    onUseImage(
                                      image.signedUrl,
                                      image.storagePath,
                                      platform,
                                    )
                                  }
                                >
                                  <ArrowRight className="h-3 w-3 mr-0.5" />
                                  Use
                                </Button>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Meta below */}
                        <div className="mt-1.5 flex items-center justify-between">
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            {PLATFORM_ICONS[platform] || (
                              <ImageIcon className="h-3 w-3" />
                            )}
                            {PLATFORM_LABELS[platform] || platform}
                          </div>
                          <span className="text-[10px] text-muted-foreground">
                            {timeAgo(record.createdAt)}
                          </span>
                        </div>
                        <p className="text-[10px] text-gray-500 line-clamp-1 mt-0.5">
                          {record.input.style} · {image.dimensions}
                        </p>
                      </div>
                    );
                  })}
                </div>
              ) : (
                /* List View */
                <div className="space-y-3">
                  {imageHistory.map((record: AIImageRecord) => {
                    const image = record.result.images[0];
                    if (!image) return null;
                    const platform = record.input.platform;

                    return (
                      <Card key={record.id} className="border">
                        <CardContent className="p-3">
                          <div className="flex gap-4">
                            {/* Thumbnail */}
                            <div className="w-24 h-24 rounded-lg overflow-hidden border bg-gray-50 flex-shrink-0">
                              <img
                                src={image.signedUrl}
                                alt={`AI-generated ${platform} image`}
                                className="w-full h-full object-cover"
                                loading="lazy"
                              />
                            </div>

                            {/* Details */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <Badge
                                  variant="secondary"
                                  className="text-[10px] flex items-center gap-1"
                                >
                                  {PLATFORM_ICONS[platform]}
                                  {PLATFORM_LABELS[platform] || platform}
                                </Badge>
                                <Badge
                                  variant="outline"
                                  className="text-[10px]"
                                >
                                  {record.input.style}
                                </Badge>
                                <Badge
                                  variant="outline"
                                  className="text-[10px]"
                                >
                                  {image.dimensions}
                                </Badge>
                              </div>
                              <p className="text-xs text-gray-600 line-clamp-2 mb-1.5">
                                {record.input.subject}
                              </p>
                              <div className="flex items-center gap-1.5">
                                <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                                  <Clock className="h-3 w-3" />
                                  {formatDate(record.createdAt)}
                                </span>
                              </div>
                            </div>

                            {/* Actions */}
                            <div className="flex flex-col gap-1 flex-shrink-0">
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 text-xs"
                                onClick={() =>
                                  handleDownloadImage(
                                    image.signedUrl,
                                    platform,
                                  )
                                }
                              >
                                <Download className="h-3 w-3 mr-1" />
                                Download
                              </Button>
                              {onUseImage && (
                                <Button
                                  size="sm"
                                  className="h-7 text-xs"
                                  onClick={() =>
                                    onUseImage(
                                      image.signedUrl,
                                      image.storagePath,
                                      platform,
                                    )
                                  }
                                >
                                  <ArrowRight className="h-3 w-3 mr-1" />
                                  Use in Post
                                </Button>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}