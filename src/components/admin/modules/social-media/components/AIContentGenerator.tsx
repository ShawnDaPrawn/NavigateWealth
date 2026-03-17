/**
 * AI Content Generator
 *
 * UI component for generating AI-powered social media post text.
 * Supports multi-platform generation with platform-specific previews.
 *
 * @module social-media/components/AIContentGenerator
 */

import React, { useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../../../ui/card';
import { Button } from '../../../../ui/button';
import { Input } from '../../../../ui/input';
import { Label } from '../../../../ui/label';
import { Textarea } from '../../../../ui/textarea';
import { Badge } from '../../../../ui/badge';
import { Checkbox } from '../../../../ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../../ui/select';
import { toast } from 'sonner@2.0.3';
import {
  Sparkles,
  Loader2,
  Copy,
  Check,
  Linkedin,
  Instagram,
  Facebook,
  Twitter,
  Plus,
  X,
  AlertCircle,
  Hash,
  Target,
  MessageSquare,
  ArrowRight,
  RefreshCw,
  Clock,
} from 'lucide-react';
import { useSocialMediaAI } from '../hooks/useSocialMediaAI';
import type { SocialAIPlatform, ContentTone, ContentGoal } from '../types';
import { BRAND } from '../constants';

// ============================================================================
// Constants
// ============================================================================

const PLATFORM_CONFIG: Record<
  SocialAIPlatform,
  { label: string; icon: React.ReactNode }
> = {
  linkedin: {
    label: 'LinkedIn',
    icon: <Linkedin className="h-4 w-4" />,
  },
  instagram: {
    label: 'Instagram',
    icon: <Instagram className="h-4 w-4" />,
  },
  facebook: {
    label: 'Facebook',
    icon: <Facebook className="h-4 w-4" />,
  },
  x: {
    label: 'X (Twitter)',
    icon: <Twitter className="h-4 w-4" />,
  },
};

const TONE_OPTIONS: { value: ContentTone; label: string; description: string }[] = [
  { value: 'professional', label: 'Professional', description: 'Authoritative, data-driven' },
  { value: 'conversational', label: 'Conversational', description: 'Approachable, relatable' },
  { value: 'authoritative', label: 'Authoritative', description: 'Expert thought leadership' },
  { value: 'friendly', label: 'Friendly', description: 'Warm, community-building' },
  { value: 'educational', label: 'Educational', description: 'Informative, value-adding' },
];

const GOAL_OPTIONS: { value: ContentGoal; label: string; icon: React.ReactNode }[] = [
  { value: 'engagement', label: 'Engagement', icon: <MessageSquare className="h-4 w-4" /> },
  { value: 'awareness', label: 'Brand Awareness', icon: <Target className="h-4 w-4" /> },
  { value: 'education', label: 'Education', icon: <Hash className="h-4 w-4" /> },
  { value: 'promotion', label: 'Promotion', icon: <ArrowRight className="h-4 w-4" /> },
  { value: 'thought_leadership', label: 'Thought Leadership', icon: <Sparkles className="h-4 w-4" /> },
];

// ============================================================================
// Props
// ============================================================================

interface AIContentGeneratorProps {
  /** Callback when user wants to use generated content in the post composer */
  onUseContent?: (platform: SocialAIPlatform, content: string, hashtags: string[]) => void;
}

// ============================================================================
// Component
// ============================================================================

export function AIContentGenerator({ onUseContent }: AIContentGeneratorProps) {
  // Form state
  const [selectedPlatforms, setSelectedPlatforms] = useState<SocialAIPlatform[]>(['linkedin']);
  const [topic, setTopic] = useState('');
  const [tone, setTone] = useState<ContentTone>('professional');
  const [goal, setGoal] = useState<ContentGoal>('engagement');
  const [includeHashtags, setIncludeHashtags] = useState(true);
  const [includeCTA, setIncludeCTA] = useState(true);
  const [keyPoints, setKeyPoints] = useState<string[]>([]);
  const [currentKeyPoint, setCurrentKeyPoint] = useState('');
  const [articleContent, setArticleContent] = useState('');
  const [articleTitle, setArticleTitle] = useState('');
  const [additionalInstructions, setAdditionalInstructions] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [copiedPlatform, setCopiedPlatform] = useState<string | null>(null);

  // Generated results
  const [generatedPosts, setGeneratedPosts] = useState<GeneratedPlatformPost[]>([]);

  // Hook
  const {
    generatePostText,
    isGenerating,
    isConfigured,
    statusLoading,
  } = useSocialMediaAI();

  // ============================================================================
  // Handlers
  // ============================================================================

  const togglePlatform = useCallback((platform: SocialAIPlatform) => {
    setSelectedPlatforms((prev) =>
      prev.includes(platform)
        ? prev.filter((p) => p !== platform)
        : [...prev, platform],
    );
  }, []);

  const addKeyPoint = useCallback(() => {
    if (currentKeyPoint.trim() && keyPoints.length < 5) {
      setKeyPoints((prev) => [...prev, currentKeyPoint.trim()]);
      setCurrentKeyPoint('');
    }
  }, [currentKeyPoint, keyPoints.length]);

  const removeKeyPoint = useCallback((index: number) => {
    setKeyPoints((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleGenerate = useCallback(async () => {
    if (!topic.trim()) {
      toast.error('Please enter a topic for your post');
      return;
    }
    if (selectedPlatforms.length === 0) {
      toast.error('Please select at least one platform');
      return;
    }

    const input: GeneratePostTextInput = {
      platforms: selectedPlatforms,
      topic: topic.trim(),
      tone,
      goal,
      includeHashtags,
      includeCTA,
      keyPoints: keyPoints.length > 0 ? keyPoints : undefined,
      articleContent: articleContent.trim() || undefined,
      articleTitle: articleTitle.trim() || undefined,
      additionalInstructions: additionalInstructions.trim() || undefined,
    };

    try {
      const response = await generatePostText(input);
      if (response.success && response.data) {
        setGeneratedPosts(response.data.posts);
      }
    } catch {
      // Error is handled by the hook's onError
    }
  }, [
    topic, selectedPlatforms, tone, goal, includeHashtags, includeCTA,
    keyPoints, articleContent, articleTitle, additionalInstructions, generatePostText,
  ]);

  const handleCopy = useCallback(async (platform: string, content: string, hashtags: string[]) => {
    const fullContent = hashtags.length > 0
      ? `${content}\n\n${hashtags.map((h) => `#${h}`).join(' ')}`
      : content;
    
    await navigator.clipboard.writeText(fullContent);
    setCopiedPlatform(platform);
    toast.success('Copied to clipboard');
    setTimeout(() => setCopiedPlatform(null), 2000);
  }, []);

  const handleUseInPost = useCallback((post: GeneratedPlatformPost) => {
    if (onUseContent) {
      onUseContent(post.platform, post.content, post.hashtags);
    }
  }, [onUseContent]);

  // ============================================================================
  // Render — Loading / Not Configured
  // ============================================================================

  if (statusLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          <span className="ml-2 text-muted-foreground">Checking AI service...</span>
        </CardContent>
      </Card>
    );
  }

  if (!isConfigured) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <AlertCircle className="h-12 w-12 text-amber-500 mb-4" />
          <h3 className="text-lg font-semibold mb-2">AI Service Not Configured</h3>
          <p className="text-muted-foreground max-w-md">
            The OpenAI API key is not configured. Please contact your administrator
            to enable AI content generation.
          </p>
        </CardContent>
      </Card>
    );
  }

  // ============================================================================
  // Render — Main
  // ============================================================================

  return (
    <div className="space-y-6">
      {/* Input Form */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-lg">
            <div className="flex items-center justify-center h-8 w-8 rounded-lg" style={{ backgroundColor: BRAND.navyLight }}>
              <Sparkles className="h-4 w-4" style={{ color: BRAND.navy }} />
            </div>
            AI Content Generator
          </CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Generate platform-optimised social media posts using AI
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Platform Selection */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Target Platforms</Label>
            <div className="flex flex-wrap gap-2">
              {(Object.entries(PLATFORM_CONFIG) as [SocialAIPlatform, typeof PLATFORM_CONFIG[SocialAIPlatform]][]).map(
                ([platform, config]) => {
                  const isSelected = selectedPlatforms.includes(platform);
                  return (
                    <button
                      key={platform}
                      type="button"
                      onClick={() => togglePlatform(platform)}
                      className={`
                        flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium
                        transition-all duration-150
                        ${isSelected
                          ? 'bg-white text-gray-900 border-gray-400 shadow-sm'
                          : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'
                        }
                      `}
                    >
                      {config.icon}
                      {config.label}
                      {isSelected && <Check className="h-3 w-3" />}
                    </button>
                  );
                },
              )}
            </div>
          </div>

          {/* Topic */}
          <div className="space-y-2">
            <Label htmlFor="ai-topic" className="text-sm font-medium">
              Topic <span className="text-red-500">*</span>
            </Label>
            <Input
              id="ai-topic"
              placeholder="e.g., Benefits of tax-free savings accounts for young professionals"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              maxLength={500}
            />
            <p className="text-xs text-muted-foreground">{topic.length}/500 characters</p>
          </div>

          {/* Tone & Goal - side by side */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium">Tone</Label>
              <Select value={tone} onValueChange={(v) => setTone(v as ContentTone)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TONE_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      <span className="font-medium">{opt.label}</span>
                      <span className="text-muted-foreground ml-1">— {opt.description}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium">Content Goal</Label>
              <Select value={goal} onValueChange={(v) => setGoal(v as ContentGoal)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {GOAL_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      <div className="flex items-center gap-2">
                        {opt.icon}
                        <span>{opt.label}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Options Row */}
          <div className="flex flex-wrap gap-6">
            <div className="flex items-center gap-2">
              <Checkbox
                id="include-hashtags"
                checked={includeHashtags}
                onCheckedChange={(checked) => setIncludeHashtags(checked === true)}
              />
              <Label htmlFor="include-hashtags" className="text-sm cursor-pointer">
                Include hashtags
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="include-cta"
                checked={includeCTA}
                onCheckedChange={(checked) => setIncludeCTA(checked === true)}
              />
              <Label htmlFor="include-cta" className="text-sm cursor-pointer">
                Include call-to-action
              </Label>
            </div>
          </div>

          {/* Key Points */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Key Points (optional)</Label>
            <div className="flex gap-2">
              <Input
                placeholder="Add a key point to cover..."
                value={currentKeyPoint}
                onChange={(e) => setCurrentKeyPoint(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addKeyPoint();
                  }
                }}
                maxLength={200}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addKeyPoint}
                disabled={!currentKeyPoint.trim() || keyPoints.length >= 5}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            {keyPoints.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {keyPoints.map((point, index) => (
                  <Badge
                    key={index}
                    variant="secondary"
                    className="flex items-center gap-1 py-1 px-2"
                  >
                    {point}
                    <button
                      type="button"
                      onClick={() => removeKeyPoint(index)}
                      className="ml-1 hover:text-red-500"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
            <p className="text-xs text-muted-foreground">{keyPoints.length}/5 key points</p>
          </div>

          {/* Advanced Options Toggle */}
          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="text-sm text-blue-600 hover:text-blue-700 font-medium"
          >
            {showAdvanced ? 'Hide' : 'Show'} advanced options
          </button>

          {showAdvanced && (
            <div className="space-y-4 border-t pt-4">
              {/* Article Repurposing */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">
                  Repurpose Article Content (optional)
                </Label>
                <Input
                  placeholder="Article title"
                  value={articleTitle}
                  onChange={(e) => setArticleTitle(e.target.value)}
                  maxLength={300}
                />
                <Textarea
                  placeholder="Paste article content here to repurpose into social posts..."
                  value={articleContent}
                  onChange={(e) => setArticleContent(e.target.value)}
                  rows={4}
                  maxLength={10000}
                />
              </div>

              {/* Additional Instructions */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">
                  Additional Instructions (optional)
                </Label>
                <Textarea
                  placeholder="Any specific requirements or instructions for the AI..."
                  value={additionalInstructions}
                  onChange={(e) => setAdditionalInstructions(e.target.value)}
                  rows={2}
                  maxLength={500}
                />
              </div>
            </div>
          )}

          {/* Generate Button */}
          <div className="flex justify-end pt-2">
            <Button
              onClick={handleGenerate}
              disabled={isGenerating || !topic.trim() || selectedPlatforms.length === 0}
              className="flex items-center gap-2"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  Generate Content
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Generated Results */}
      {generatedPosts.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Check className="h-5 w-5 text-green-600" />
              Generated Content
            </h3>
            <Button
              variant="outline"
              size="sm"
              onClick={handleGenerate}
              disabled={isGenerating}
              className="flex items-center gap-2"
            >
              <RefreshCw className={`h-4 w-4 ${isGenerating ? 'animate-spin' : ''}`} />
              Regenerate
            </Button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {generatedPosts.map((post) => {
              const config = PLATFORM_CONFIG[post.platform];
              return (
                <PlatformPostPreview
                  key={post.platform}
                  post={post}
                  config={config}
                  isCopied={copiedPlatform === post.platform}
                  onCopy={() => handleCopy(post.platform, post.content, post.hashtags)}
                  onUseInPost={onUseContent ? () => handleUseInPost(post) : undefined}
                />
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Platform Post Preview Sub-component
// ============================================================================

interface PlatformPostPreviewProps {
  post: GeneratedPlatformPost;
  config: { label: string; icon: React.ReactNode };
  isCopied: boolean;
  onCopy: () => void;
  onUseInPost?: () => void;
}

function PlatformPostPreview({
  post,
  config,
  isCopied,
  onCopy,
  onUseInPost,
}: PlatformPostPreviewProps) {
  const charPercent = Math.min(
    (post.characterCount / post.characterLimit) * 100,
    100,
  );
  const isOverLimit = !post.withinLimit;

  return (
    <Card className="border">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className={`flex items-center gap-2 text-gray-900 font-semibold`}>
            {config.icon}
            {config.label}
          </div>
          <div className="flex items-center gap-1">
            {isOverLimit && (
              <Badge variant="destructive" className="text-xs">
                Over limit
              </Badge>
            )}
            <Badge variant="secondary" className="text-xs font-normal">
              {post.characterCount}/{post.characterLimit}
            </Badge>
          </div>
        </div>
        {/* Character limit bar */}
        <div className="w-full bg-gray-200 rounded-full h-1 mt-2">
          <div
            className={`h-1 rounded-full transition-all ${
              isOverLimit ? 'bg-red-500' : charPercent > 80 ? 'bg-amber-500' : 'bg-green-500'
            }`}
            style={{ width: `${Math.min(charPercent, 100)}%` }}
          />
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Post content */}
        <div className="bg-white rounded-lg p-4 text-sm leading-relaxed whitespace-pre-wrap border border-gray-100">
          {post.content}
        </div>

        {/* Hashtags */}
        {post.hashtags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {post.hashtags.map((tag, i) => (
              <span
                key={i}
                className="text-xs px-2 py-0.5 rounded-full"
                style={{ backgroundColor: BRAND.navyLight, color: BRAND.navy }}
              >
                #{tag}
              </span>
            ))}
          </div>
        )}

        {/* CTA */}
        {post.callToAction && (
          <div className="flex items-start gap-2 p-2 bg-white rounded border border-gray-100">
            <ArrowRight className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-gray-600">{post.callToAction}</p>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-2 pt-1">
          <Button
            variant="outline"
            size="sm"
            onClick={onCopy}
            className="flex items-center gap-1.5 text-xs"
          >
            {isCopied ? (
              <>
                <Check className="h-3 w-3 text-green-600" />
                Copied
              </>
            ) : (
              <>
                <Copy className="h-3 w-3" />
                Copy
              </>
            )}
          </Button>
          {onUseInPost && (
            <Button
              size="sm"
              onClick={onUseInPost}
              className="flex items-center gap-1.5 text-xs"
            >
              <ArrowRight className="h-3 w-3" />
              Use in Post
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}