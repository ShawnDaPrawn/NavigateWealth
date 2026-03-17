/**
 * AI Bundle Generator
 *
 * Generates a complete social media content bundle (post text + branded image)
 * in a single flow. Both are generated in parallel on the server.
 *
 * @module social-media/components/AIBundleGenerator
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
  AlertCircle,
  ArrowRight,
  Layers,
  Image as ImageIcon,
  FileText,
  Download,
} from 'lucide-react';
import { useSocialMediaAI } from '../hooks/useSocialMediaAI';
import { BRAND } from '../constants';
import type {
  SocialAIPlatform,
  ContentTone,
  ContentGoal,
  ImageStyle,
  GenerateBundleInput,
  GeneratedPlatformPost,
  GeneratedImage,
} from '../types';

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

const TONE_OPTIONS: { value: ContentTone; label: string }[] = [
  { value: 'professional', label: 'Professional' },
  { value: 'conversational', label: 'Conversational' },
  { value: 'authoritative', label: 'Authoritative' },
  { value: 'friendly', label: 'Friendly' },
  { value: 'educational', label: 'Educational' },
];

const GOAL_OPTIONS: { value: ContentGoal; label: string }[] = [
  { value: 'engagement', label: 'Engagement' },
  { value: 'awareness', label: 'Brand Awareness' },
  { value: 'education', label: 'Education' },
  { value: 'promotion', label: 'Promotion' },
  { value: 'thought_leadership', label: 'Thought Leadership' },
];

const IMAGE_STYLE_OPTIONS: { value: ImageStyle; label: string; description: string }[] = [
  { value: 'editorial', label: 'Editorial', description: 'Magazine-quality photography' },
  { value: 'photorealistic', label: 'Photorealistic', description: 'Natural, real-world look' },
  { value: 'abstract', label: 'Abstract', description: 'Artistic, conceptual shapes' },
  { value: 'conceptual', label: 'Conceptual', description: 'Metaphorical visuals' },
  { value: 'lifestyle', label: 'Lifestyle', description: 'People-focused scenes' },
  { value: 'data_visualisation', label: 'Data Visual', description: 'Charts & infographics' },
];

// ============================================================================
// Props
// ============================================================================

interface AIBundleGeneratorProps {
  onUseContent?: (platform: SocialAIPlatform, content: string, hashtags: string[]) => void;
  onUseImage?: (signedUrl: string, storagePath: string, platform: string) => void;
  onUseBoth?: (
    platform: SocialAIPlatform,
    content: string,
    hashtags: string[],
    imageUrl: string,
    imagePath: string,
  ) => void;
}

// ============================================================================
// Component
// ============================================================================

export function AIBundleGenerator({ onUseContent, onUseImage, onUseBoth }: AIBundleGeneratorProps) {
  // Form state
  const [platform, setPlatform] = useState<SocialAIPlatform>('linkedin');
  const [topic, setTopic] = useState('');
  const [tone, setTone] = useState<ContentTone>('professional');
  const [goal, setGoal] = useState<ContentGoal>('engagement');
  const [imageStyle, setImageStyle] = useState<ImageStyle>('editorial');
  const [imageSubject, setImageSubject] = useState('');
  const [includeHashtags, setIncludeHashtags] = useState(true);
  const [includeCTA, setIncludeCTA] = useState(true);
  const [additionalInstructions, setAdditionalInstructions] = useState('');
  const [copiedPlatform, setCopiedPlatform] = useState<string | null>(null);

  // Results
  const [generatedPosts, setGeneratedPosts] = useState<GeneratedPlatformPost[]>([]);
  const [generatedImage, setGeneratedImage] = useState<GeneratedImage | null>(null);

  const {
    generateBundle,
    isGeneratingBundle,
    isConfigured,
    statusLoading,
  } = useSocialMediaAI();

  // ============================================================================
  // Handlers
  // ============================================================================

  const handleGenerate = useCallback(async () => {
    if (!topic.trim()) {
      toast.error('Please enter a topic');
      return;
    }

    const subject = imageSubject.trim() || topic.trim();

    const input: GenerateBundleInput = {
      text: {
        platforms: [platform],
        topic: topic.trim(),
        tone,
        goal,
        includeHashtags,
        includeCTA,
        additionalInstructions: additionalInstructions.trim() || undefined,
      },
      image: {
        platform: platform,
        subject,
        style: imageStyle,
        topic: topic.trim(),
        quality: 'standard',
      },
    };

    try {
      const response = await generateBundle(input);
      if (response.success && response.data) {
        setGeneratedPosts(response.data.text.posts);
        const firstImage = response.data.image.images[0] ?? null;
        setGeneratedImage(firstImage);
      }
    } catch {
      // Error handled by hook
    }
  }, [
    topic, platform, tone, goal, imageStyle, imageSubject,
    includeHashtags, includeCTA, additionalInstructions, generateBundle,
  ]);

  const handleCopy = useCallback(async (post: GeneratedPlatformPost) => {
    const fullContent = post.hashtags.length > 0
      ? `${post.content}\n\n${post.hashtags.map((h) => `#${h}`).join(' ')}`
      : post.content;
    await navigator.clipboard.writeText(fullContent);
    setCopiedPlatform(post.platform);
    toast.success('Copied to clipboard');
    setTimeout(() => setCopiedPlatform(null), 2000);
  }, []);

  const handleDownloadImage = useCallback(async () => {
    if (!generatedImage) return;
    try {
      const response = await fetch(generatedImage.signedUrl);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `navigate-wealth-${platform}-bundle-${Date.now()}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success('Image downloaded');
    } catch {
      toast.error('Failed to download image');
    }
  }, [generatedImage, platform]);

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

  const hasResults = generatedPosts.length > 0 || generatedImage !== null;

  return (
    <div className="space-y-6">
      {/* Input Form */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-lg">
            <div className="flex items-center justify-center h-8 w-8 rounded-lg" style={{ backgroundColor: BRAND.navyLight }}>
              <Layers className="h-4 w-4" style={{ color: BRAND.navy }} />
            </div>
            Content Bundle Generator
          </CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Generate a complete post — text and branded image — in one step
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Platform */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Platform</Label>
            <div className="flex flex-wrap gap-2">
              {(Object.entries(PLATFORM_CONFIG) as [SocialAIPlatform, typeof PLATFORM_CONFIG[SocialAIPlatform]][]).map(
                ([key, config]) => {
                  const isSelected = platform === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setPlatform(key)}
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
            <Label htmlFor="bundle-topic" className="text-sm font-medium">
              Topic <span className="text-red-500">*</span>
            </Label>
            <Input
              id="bundle-topic"
              placeholder="e.g., Tax-free savings accounts for young professionals"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              maxLength={500}
            />
          </div>

          {/* Tone & Goal */}
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
                      {opt.label}
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
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Image Settings */}
          <div className="border-t pt-4 space-y-4">
            <Label className="text-sm font-medium flex items-center gap-1.5">
              <ImageIcon className="h-4 w-4 text-muted-foreground" />
              Image Settings
            </Label>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Visual Style</Label>
                <Select value={imageStyle} onValueChange={(v) => setImageStyle(v as ImageStyle)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {IMAGE_STYLE_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        <span className="font-medium">{opt.label}</span>
                        <span className="text-muted-foreground ml-1">— {opt.description}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">
                  Image Subject (optional — defaults to topic)
                </Label>
                <Input
                  placeholder="Custom image subject..."
                  value={imageSubject}
                  onChange={(e) => setImageSubject(e.target.value)}
                  maxLength={500}
                />
              </div>
            </div>
          </div>

          {/* Options */}
          <div className="flex flex-wrap gap-6">
            <div className="flex items-center gap-2">
              <Checkbox
                id="bundle-hashtags"
                checked={includeHashtags}
                onCheckedChange={(checked) => setIncludeHashtags(checked === true)}
              />
              <Label htmlFor="bundle-hashtags" className="text-sm cursor-pointer">
                Include hashtags
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="bundle-cta"
                checked={includeCTA}
                onCheckedChange={(checked) => setIncludeCTA(checked === true)}
              />
              <Label htmlFor="bundle-cta" className="text-sm cursor-pointer">
                Include call-to-action
              </Label>
            </div>
          </div>

          {/* Additional Instructions */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Additional Instructions (optional)</Label>
            <Textarea
              placeholder="Any specific requirements..."
              value={additionalInstructions}
              onChange={(e) => setAdditionalInstructions(e.target.value)}
              rows={2}
              maxLength={500}
            />
          </div>

          {/* Generate Button */}
          <div className="flex justify-end pt-2">
            <Button
              onClick={handleGenerate}
              disabled={isGeneratingBundle || !topic.trim()}
              className="flex items-center gap-2"
            >
              {isGeneratingBundle ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Generating Bundle...
                </>
              ) : (
                <>
                  <Layers className="h-4 w-4" />
                  Generate Text + Image
                </>
              )}
            </Button>
          </div>

          {isGeneratingBundle && (
            <div className="flex items-center gap-3 p-3 rounded-lg text-sm" style={{ backgroundColor: BRAND.navyLight, color: BRAND.navy }}>
              <Loader2 className="h-4 w-4 animate-spin flex-shrink-0" />
              <span>
                Generating post text and branded image in parallel. This typically
                takes 15–30 seconds...
              </span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Results */}
      {hasResults && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Check className="h-5 w-5 text-green-600" />
            <h3 className="text-lg font-semibold">Generated Bundle</h3>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Text Result */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <FileText className="h-4 w-4" />
                Post Text
              </div>

              {generatedPosts.map((post) => {
                const config = PLATFORM_CONFIG[post.platform];
                const isCopied = copiedPlatform === post.platform;

                return (
                  <Card key={post.platform} className="bg-gray-50 border">
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 font-semibold text-sm text-gray-800">
                          {config?.icon}
                          {config?.label || post.platform}
                        </div>
                        <Badge variant="secondary" className="text-xs font-normal">
                          {post.characterCount}/{post.characterLimit}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="bg-white rounded-lg p-3 text-sm leading-relaxed whitespace-pre-wrap border border-gray-100">
                        {post.content}
                      </div>

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

                      <div className="flex items-center gap-2 pt-1">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleCopy(post)}
                          className="flex items-center gap-1.5 text-xs"
                        >
                          {isCopied ? (
                            <><Check className="h-3 w-3 text-green-600" /> Copied</>
                          ) : (
                            <><Copy className="h-3 w-3" /> Copy</>
                          )}
                        </Button>
                        {onUseContent && (
                          <Button
                            size="sm"
                            onClick={() =>
                              onUseContent(post.platform, post.content, post.hashtags)
                            }
                            className="flex items-center gap-1.5 text-xs"
                          >
                            <ArrowRight className="h-3 w-3" />
                            Use Text
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            {/* Image Result */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <ImageIcon className="h-4 w-4" />
                Branded Image
              </div>

              {generatedImage && (
                <Card className="border overflow-hidden">
                  <div className="aspect-square bg-gray-50">
                    <img
                      src={generatedImage.signedUrl}
                      alt="AI-generated branded image"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="text-xs">
                        {generatedImage.dimensions}
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        {imageStyle}
                      </Badge>
                    </div>

                    {generatedImage.revisedPrompt && (
                      <p className="text-xs text-muted-foreground line-clamp-2">
                        {generatedImage.revisedPrompt}
                      </p>
                    )}

                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleDownloadImage}
                        className="flex items-center gap-1.5 text-xs"
                      >
                        <Download className="h-3 w-3" />
                        Download
                      </Button>
                      {onUseImage && (
                        <Button
                          size="sm"
                          onClick={() =>
                            onUseImage(
                              generatedImage.signedUrl,
                              generatedImage.storagePath,
                              platform,
                            )
                          }
                          className="flex items-center gap-1.5 text-xs"
                        >
                          <ArrowRight className="h-3 w-3" />
                          Use Image
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Use Both button */}
              {generatedPosts.length > 0 && generatedImage && onUseBoth && (
                <Button
                  className="w-full flex items-center justify-center gap-2"
                  onClick={() => {
                    const post = generatedPosts[0];
                    onUseBoth(
                      post.platform,
                      post.content,
                      post.hashtags,
                      generatedImage.signedUrl,
                      generatedImage.storagePath,
                    );
                  }}
                >
                  <Layers className="h-4 w-4" />
                  Use Both in Post
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}