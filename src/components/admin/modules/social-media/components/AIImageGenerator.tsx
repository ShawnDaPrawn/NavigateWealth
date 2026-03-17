/**
 * AI Image Generator
 *
 * Generates branded social media images using DALL-E 3 with Navigate Wealth
 * brand identity baked into every prompt. Supports platform-specific dimensions
 * and multiple visual styles.
 *
 * @module social-media/components/AIImageGenerator
 */

import React, { useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../../../ui/card';
import { Button } from '../../../../ui/button';
import { Input } from '../../../../ui/input';
import { Label } from '../../../../ui/label';
import { Textarea } from '../../../../ui/textarea';
import { Badge } from '../../../../ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../../ui/select';
import { toast } from 'sonner@2.0.3';
import {
  Image as ImageIcon,
  Loader2,
  Download,
  Copy,
  Check,
  Linkedin,
  Instagram,
  Facebook,
  Twitter,
  Sparkles,
  Camera,
  Paintbrush,
  Layers,
  Lightbulb,
  Users,
  BarChart3,
  Maximize2,
  Shield,
  AlertTriangle,
} from 'lucide-react';
import { useSocialMediaAI } from '../hooks/useSocialMediaAI';
import type { SocialAIPlatform, ImageStyle } from '../types';
import { BRAND } from '../constants';

// ============================================================================
// Constants
// ============================================================================

type ImagePlatform = SocialAIPlatform | 'instagram_story';

const PLATFORM_CONFIG: Record<
  ImagePlatform,
  { label: string; icon: React.ReactNode; dimensions: string; aspect: string }
> = {
  linkedin: {
    label: 'LinkedIn',
    icon: <Linkedin className="h-4 w-4" />,
    dimensions: '1792×1024',
    aspect: 'Landscape (1.91:1)',
  },
  instagram: {
    label: 'Instagram Feed',
    icon: <Instagram className="h-4 w-4" />,
    dimensions: '1024×1024',
    aspect: 'Square (1:1)',
  },
  instagram_story: {
    label: 'Instagram Story',
    icon: <Instagram className="h-4 w-4" />,
    dimensions: '1024×1792',
    aspect: 'Portrait (9:16)',
  },
  facebook: {
    label: 'Facebook',
    icon: <Facebook className="h-4 w-4" />,
    dimensions: '1792×1024',
    aspect: 'Landscape (1.91:1)',
  },
  x: {
    label: 'X (Twitter)',
    icon: <Twitter className="h-4 w-4" />,
    dimensions: '1792×1024',
    aspect: 'Landscape (16:9)',
  },
};

const STYLE_OPTIONS: {
  value: ImageStyle;
  label: string;
  description: string;
  icon: React.ReactNode;
}[] = [
  {
    value: 'editorial',
    label: 'Editorial',
    description: 'Magazine-quality, dramatic lighting',
    icon: <Camera className="h-4 w-4" />,
  },
  {
    value: 'photorealistic',
    label: 'Photorealistic',
    description: 'High-res photograph, natural look',
    icon: <ImageIcon className="h-4 w-4" />,
  },
  {
    value: 'abstract',
    label: 'Abstract',
    description: 'Geometric shapes, bold colour blocking',
    icon: <Paintbrush className="h-4 w-4" />,
  },
  {
    value: 'conceptual',
    label: 'Conceptual',
    description: 'Metaphorical, symbolic storytelling',
    icon: <Lightbulb className="h-4 w-4" />,
  },
  {
    value: 'lifestyle',
    label: 'Lifestyle',
    description: 'Candid, warm, authentic moments',
    icon: <Users className="h-4 w-4" />,
  },
  {
    value: 'data_visualisation',
    label: 'Data Visualisation',
    description: 'Charts, graphs, growth patterns',
    icon: <BarChart3 className="h-4 w-4" />,
  },
];

// ============================================================================
// Props
// ============================================================================

interface AIImageGeneratorProps {
  /** Callback when user wants to attach the generated image to a post */
  onUseImage?: (signedUrl: string, storagePath: string, platform: string) => void;
}

// ============================================================================
// Component
// ============================================================================

export function AIImageGenerator({ onUseImage }: AIImageGeneratorProps) {
  // Form state
  const [platform, setPlatform] = useState<ImagePlatform>('linkedin');
  const [subject, setSubject] = useState('');
  const [style, setStyle] = useState<ImageStyle>('editorial');
  const [topic, setTopic] = useState('');
  const [additionalInstructions, setAdditionalInstructions] = useState('');
  const [quality, setQuality] = useState<'standard' | 'hd'>('standard');
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Generated result
  const [generatedImage, setGeneratedImage] = useState<GeneratedImage | null>(null);
  const [copiedUrl, setCopiedUrl] = useState(false);

  // Hook
  const {
    generateImage,
    isGeneratingImage,
    isConfigured,
    statusLoading,
  } = useSocialMediaAI();

  // ============================================================================
  // Handlers
  // ============================================================================

  const handleGenerate = useCallback(async () => {
    if (!subject.trim()) {
      toast.error('Please describe the image you want to generate');
      return;
    }

    const input: GenerateImageInput = {
      platform,
      subject: subject.trim(),
      style,
      topic: topic.trim() || undefined,
      additionalInstructions: additionalInstructions.trim() || undefined,
      quality,
    };

    try {
      const response = await generateImage(input);
      if (response.success && response.data?.images?.[0]) {
        setGeneratedImage(response.data.images[0]);
      }
    } catch {
      // Handled by hook
    }
  }, [platform, subject, style, topic, additionalInstructions, quality, generateImage]);

  const handleCopyUrl = useCallback(async () => {
    if (!generatedImage?.signedUrl) return;
    await navigator.clipboard.writeText(generatedImage.signedUrl);
    setCopiedUrl(true);
    toast.success('Image URL copied to clipboard');
    setTimeout(() => setCopiedUrl(false), 2000);
  }, [generatedImage]);

  const handleDownload = useCallback(async () => {
    if (!generatedImage?.signedUrl) return;
    try {
      const response = await fetch(generatedImage.signedUrl);
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
  }, [generatedImage, platform]);

  const handleUse = useCallback(() => {
    if (generatedImage && onUseImage) {
      onUseImage(generatedImage.signedUrl, generatedImage.storagePath, generatedImage.platform);
    }
  }, [generatedImage, onUseImage]);

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
          <AlertTriangle className="h-12 w-12 text-amber-500 mb-4" />
          <h3 className="text-lg font-semibold mb-2">AI Service Not Configured</h3>
          <p className="text-muted-foreground max-w-md">
            The OpenAI API key is not configured. Please contact your administrator
            to enable AI image generation.
          </p>
        </CardContent>
      </Card>
    );
  }

  const selectedPlatformConfig = PLATFORM_CONFIG[platform];

  // ============================================================================
  // Render
  // ============================================================================

  return (
    <div className="space-y-6">
      {/* Input Form */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-lg">
            <div className="flex items-center justify-center h-8 w-8 rounded-lg" style={{ backgroundColor: BRAND.navyLight }}>
              <ImageIcon className="h-4 w-4" style={{ color: BRAND.navy }} />
            </div>
            AI Image Generator
          </CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Generate branded social media images with Navigate Wealth visual identity
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Brand Notice */}
          <div className="flex items-start gap-3 p-3 rounded-lg border" style={{ backgroundColor: BRAND.navyLight, borderColor: BRAND.navy + '20' }}>
            <Shield className="h-5 w-5 mt-0.5 flex-shrink-0" style={{ color: BRAND.navy }} />
            <div className="text-sm">
              <p className="font-medium" style={{ color: BRAND.navy }}>Navigate Wealth Branding Applied</p>
              <p className="mt-0.5 text-gray-600">
                All generated images follow the Navigate Wealth visual identity — navy &amp; gold colour palette,
                premium editorial style, and South African context. If the Corporate Identity module
                has a stored colour palette, those colours are automatically used.
              </p>
            </div>
          </div>

          {/* Platform Selection */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Platform &amp; Dimensions</Label>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
              {(Object.entries(PLATFORM_CONFIG) as [ImagePlatform, typeof PLATFORM_CONFIG[ImagePlatform]][]).map(
                ([key, config]) => {
                  const isSelected = platform === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setPlatform(key)}
                      className={`
                        flex flex-col items-center gap-1 px-3 py-3 rounded-lg border text-xs font-medium
                        transition-all duration-150
                        ${isSelected
                          ? 'bg-white text-gray-900 border-gray-400 shadow-sm ring-1 ring-gray-300'
                          : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'
                        }
                      `}
                    >
                      <span className="flex items-center gap-1.5">
                        {config.icon}
                        {config.label}
                      </span>
                      <span className="text-[10px] opacity-70">{config.dimensions}</span>
                    </button>
                  );
                },
              )}
            </div>
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Maximize2 className="h-3 w-3" />
              {selectedPlatformConfig.aspect} — {selectedPlatformConfig.dimensions}px
            </p>
          </div>

          {/* Image Subject */}
          <div className="space-y-2">
            <Label htmlFor="ai-image-subject" className="text-sm font-medium">
              Image Description <span className="text-red-500">*</span>
            </Label>
            <Textarea
              id="ai-image-subject"
              placeholder="e.g., A diverse group of professionals reviewing financial plans at a modern Cape Town office with Table Mountain visible through floor-to-ceiling windows"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              rows={3}
              maxLength={500}
            />
            <p className="text-xs text-muted-foreground">{subject.length}/500 characters</p>
          </div>

          {/* Visual Style */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Visual Style</Label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {STYLE_OPTIONS.map((opt) => {
                const isSelected = style === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setStyle(opt.value)}
                    className={`
                      flex items-start gap-2 px-3 py-2.5 rounded-lg border text-left text-sm
                      transition-all duration-150
                      ${isSelected
                        ? 'bg-white text-gray-900 border-gray-400 shadow-sm ring-1 ring-gray-300'
                        : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'
                      }
                    `}
                  >
                    <span className={`mt-0.5 ${isSelected ? 'text-gray-900' : 'text-gray-400'}`}>
                      {opt.icon}
                    </span>
                    <span>
                      <span className="font-medium block">{opt.label}</span>
                      <span className="text-xs opacity-70">{opt.description}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Topic Context (optional but visible) */}
          <div className="space-y-2">
            <Label htmlFor="ai-image-topic" className="text-sm font-medium">
              Topic Context <span className="text-muted-foreground font-normal">(optional)</span>
            </Label>
            <Input
              id="ai-image-topic"
              placeholder="e.g., Retirement planning for young professionals"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              maxLength={300}
            />
            <p className="text-xs text-muted-foreground">
              Helps the AI tailor the image to your post&apos;s subject matter
            </p>
          </div>

          {/* Advanced Options */}
          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="text-sm text-blue-600 hover:text-blue-700 font-medium"
          >
            {showAdvanced ? 'Hide' : 'Show'} advanced options
          </button>

          {showAdvanced && (
            <div className="space-y-4 border-t pt-4">
              {/* Quality */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Image Quality</Label>
                <Select value={quality} onValueChange={(v) => setQuality(v as 'standard' | 'hd')}>
                  <SelectTrigger className="w-48">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="standard">Standard</SelectItem>
                    <SelectItem value="hd">HD (Higher detail, slower)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Additional Instructions */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Additional Style Instructions</Label>
                <Textarea
                  placeholder="e.g., Include warm golden-hour lighting, use navy as the dominant background colour..."
                  value={additionalInstructions}
                  onChange={(e) => setAdditionalInstructions(e.target.value)}
                  rows={2}
                  maxLength={500}
                />
              </div>
            </div>
          )}

          {/* Generate Button */}
          <div className="flex items-center justify-between pt-2">
            <p className="text-xs text-muted-foreground">
              Images are generated by DALL-E 3 and stored in Supabase Storage
            </p>
            <Button
              onClick={handleGenerate}
              disabled={isGeneratingImage || !subject.trim()}
              className="flex items-center gap-2"
            >
              {isGeneratingImage ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Generating (~15s)...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  Generate Image
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Generated Result */}
      {generatedImage && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Check className="h-5 w-5 text-green-600" />
                Generated Image
              </CardTitle>
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="text-xs">
                  {generatedImage.dimensions}
                </Badge>
                <Badge
                  variant="secondary"
                  className="text-xs"
                >
                  {selectedPlatformConfig.icon}
                  <span className="ml-1">{selectedPlatformConfig.label}</span>
                </Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Image Preview */}
            <div className="relative rounded-lg overflow-hidden border bg-gray-50">
              <img
                src={generatedImage.signedUrl}
                alt={`AI-generated ${platform} image`}
                className="w-full h-auto"
                loading="lazy"
              />
            </div>

            {/* Revised Prompt (collapsible) */}
            <details className="text-sm">
              <summary className="cursor-pointer text-muted-foreground hover:text-foreground font-medium">
                View DALL-E revised prompt
              </summary>
              <p className="mt-2 p-3 bg-gray-50 rounded-lg text-xs text-gray-600 leading-relaxed">
                {generatedImage.revisedPrompt}
              </p>
            </details>

            {/* Actions */}
            <div className="flex items-center gap-2 pt-1">
              <Button
                variant="outline"
                size="sm"
                onClick={handleDownload}
                className="flex items-center gap-1.5 text-xs"
              >
                <Download className="h-3 w-3" />
                Download
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopyUrl}
                className="flex items-center gap-1.5 text-xs"
              >
                {copiedUrl ? (
                  <>
                    <Check className="h-3 w-3 text-green-600" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="h-3 w-3" />
                    Copy URL
                  </>
                )}
              </Button>
              {onUseImage && (
                <Button
                  size="sm"
                  onClick={handleUse}
                  className="flex items-center gap-1.5 text-xs"
                >
                  <ImageIcon className="h-3 w-3" />
                  Use in Post
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={handleGenerate}
                disabled={isGeneratingImage}
                className="flex items-center gap-1.5 text-xs ml-auto"
              >
                <Sparkles className={`h-3 w-3 ${isGeneratingImage ? 'animate-spin' : ''}`} />
                Regenerate
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}