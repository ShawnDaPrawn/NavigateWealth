/**
 * AI Article Repurposer
 *
 * Fetches published articles from the Publications module and provides
 * a streamlined flow to repurpose them into social media posts using AI.
 * Supports text-only or bundle (text+image) generation in one flow.
 *
 * @module social-media/components/AIArticleRepurposer
 */

import React, { useState, useCallback, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../../../ui/card';
import { Button } from '../../../../ui/button';
import { Badge } from '../../../../ui/badge';
import { Input } from '../../../../ui/input';
import { Label } from '../../../../ui/label';
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
  FileText,
  Loader2,
  Sparkles,
  Search,
  Check,
  Copy,
  ArrowRight,
  Linkedin,
  Instagram,
  Facebook,
  Twitter,
  AlertCircle,
  Inbox,
  RefreshCw,
  Newspaper,
  Image as ImageIcon,
  Layers,
} from 'lucide-react';
import { projectId, publicAnonKey } from '../../../../../utils/supabase/info';
import { useSocialMediaAI } from '../hooks/useSocialMediaAI';
import type { SocialAIPlatform, ContentTone, ContentGoal, ImageStyle } from '../types';
import { BRAND } from '../constants';

// ============================================================================
// Types
// ============================================================================

interface PublishedArticle {
  id: string;
  title: string;
  subtitle?: string | null;
  excerpt: string;
  body?: string | null;
  content?: string | null;
  status: string;
  published_at?: string | null;
  created_at: string;
}

// ============================================================================
// Constants
// ============================================================================

const PLATFORM_CONFIG: Record<
  SocialAIPlatform,
  { label: string; icon: React.ReactNode }
> = {
  linkedin: { label: 'LinkedIn', icon: <Linkedin className="h-4 w-4" /> },
  instagram: { label: 'Instagram', icon: <Instagram className="h-4 w-4" /> },
  facebook: { label: 'Facebook', icon: <Facebook className="h-4 w-4" /> },
  x: { label: 'X (Twitter)', icon: <Twitter className="h-4 w-4" /> },
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

const IMAGE_STYLE_OPTIONS: { value: ImageStyle; label: string }[] = [
  { value: 'editorial', label: 'Editorial' },
  { value: 'photorealistic', label: 'Photorealistic' },
  { value: 'abstract', label: 'Abstract' },
  { value: 'conceptual', label: 'Conceptual' },
  { value: 'lifestyle', label: 'Lifestyle' },
  { value: 'data_visualisation', label: 'Data Visualisation' },
];

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-ZA', { day: '2-digit', month: 'short', year: 'numeric' });
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
}

// ============================================================================
// Props
// ============================================================================

interface AIArticleRepurposerProps {
  onUseContent?: (platform: SocialAIPlatform, content: string, hashtags: string[]) => void;
}

// ============================================================================
// Component
// ============================================================================

export function AIArticleRepurposer({ onUseContent }: AIArticleRepurposerProps) {
  const [articles, setArticles] = useState<PublishedArticle[]>([]);
  const [articlesLoading, setArticlesLoading] = useState(true);
  const [articlesError, setArticlesError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedArticle, setSelectedArticle] = useState<PublishedArticle | null>(null);

  // Generation settings
  const [selectedPlatforms, setSelectedPlatforms] = useState<SocialAIPlatform[]>(['linkedin']);
  const [tone, setTone] = useState<ContentTone>('professional');
  const [goal, setGoal] = useState<ContentGoal>('awareness');
  const [includeHashtags, setIncludeHashtags] = useState(true);
  const [includeCTA, setIncludeCTA] = useState(true);

  // Bundle mode (text + image)
  const [bundleMode, setBundleMode] = useState(false);
  const [imageStyle, setImageStyle] = useState<ImageStyle>('editorial');
  const [imagePlatform, setImagePlatform] = useState<SocialAIPlatform>('linkedin');

  // Results
  const [generatedPosts, setGeneratedPosts] = useState<GeneratedPlatformPost[]>([]);
  const [generatedImages, setGeneratedImages] = useState<GeneratedImage[]>([]);
  const [copiedPlatform, setCopiedPlatform] = useState<string | null>(null);

  const {
    generatePostText,
    generateBundle,
    isGenerating,
    isGeneratingBundle,
    isConfigured,
    statusLoading,
  } = useSocialMediaAI();

  const isProcessing = isGenerating || isGeneratingBundle;

  // ============================================================================
  // Fetch published articles
  // ============================================================================

  const fetchArticles = useCallback(async () => {
    setArticlesLoading(true);
    setArticlesError(null);
    try {
      const baseUrl = `https://${projectId}.supabase.co/functions/v1/make-server-91ed8379/publications`;
      const response = await fetch(`${baseUrl}/articles?status=published`, {
        headers: { Authorization: `Bearer ${publicAnonKey}` },
      });
      if (!response.ok) throw new Error(`Failed to fetch articles: ${response.status}`);
      const data = await response.json();
      const list = data.data || data || [];
      setArticles(Array.isArray(list) ? list : []);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      console.error('AIArticleRepurposer: Failed to fetch articles', msg);
      setArticlesError(msg);
    } finally {
      setArticlesLoading(false);
    }
  }, []);

  useEffect(() => { fetchArticles(); }, [fetchArticles]);

  const filteredArticles = articles.filter((a) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return a.title.toLowerCase().includes(q) || (a.excerpt || '').toLowerCase().includes(q);
  });

  // ============================================================================
  // Handlers
  // ============================================================================

  const togglePlatform = useCallback((platform: SocialAIPlatform) => {
    setSelectedPlatforms((prev) =>
      prev.includes(platform) ? prev.filter((p) => p !== platform) : [...prev, platform],
    );
  }, []);

  const handleGenerate = useCallback(async () => {
    if (!selectedArticle) { toast.error('Please select an article to repurpose'); return; }
    if (selectedPlatforms.length === 0) { toast.error('Please select at least one platform'); return; }

    const articleBody = selectedArticle.body || selectedArticle.content || '';
    const plainContent = stripHtml(articleBody);

    const textInput: GeneratePostTextInput = {
      platforms: selectedPlatforms,
      topic: selectedArticle.title,
      tone, goal, includeHashtags, includeCTA,
      articleTitle: selectedArticle.title,
      articleContent: plainContent.slice(0, 8000),
      additionalInstructions:
        'Repurpose this article into engaging social media posts. Capture the key insights and value proposition. Do not simply summarise — create compelling, platform-native content that drives engagement.',
    };

    try {
      if (bundleMode) {
        // Bundle: text + image in parallel
        const response = await generateBundle({
          text: textInput,
          image: {
            platform: imagePlatform,
            subject: `Visual representation of: ${selectedArticle.title}`,
            style: imageStyle,
            topic: selectedArticle.title,
            additionalInstructions: 'Create a compelling image that complements an article being repurposed for social media.',
          },
        });
        if (response.success && response.data) {
          setGeneratedPosts(response.data.text.posts);
          setGeneratedImages(response.data.image.images);
        }
      } else {
        // Text only
        const response = await generatePostText(textInput);
        if (response.success && response.data) {
          setGeneratedPosts(response.data.posts);
          setGeneratedImages([]);
        }
      }
    } catch { /* hook handles */ }
  }, [selectedArticle, selectedPlatforms, tone, goal, includeHashtags, includeCTA, bundleMode, imageStyle, imagePlatform, generatePostText, generateBundle]);

  const handleCopy = useCallback(async (post: GeneratedPlatformPost) => {
    const fullContent = post.hashtags.length > 0
      ? `${post.content}\n\n${post.hashtags.map((h) => `#${h}`).join(' ')}`
      : post.content;
    await navigator.clipboard.writeText(fullContent);
    setCopiedPlatform(post.platform);
    toast.success('Copied to clipboard');
    setTimeout(() => setCopiedPlatform(null), 2000);
  }, []);

  // ============================================================================
  // Render
  // ============================================================================

  if (statusLoading) {
    return (
      <Card><CardContent className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        <span className="ml-2 text-muted-foreground">Checking AI service...</span>
      </CardContent></Card>
    );
  }

  if (!isConfigured) {
    return (
      <Card><CardContent className="flex flex-col items-center justify-center py-12 text-center">
        <AlertCircle className="h-12 w-12 text-amber-500 mb-4" />
        <h3 className="text-lg font-semibold mb-2">AI Service Not Configured</h3>
        <p className="text-muted-foreground max-w-md">The OpenAI API key is not configured.</p>
      </CardContent></Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Article Selection */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-lg">
            <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-emerald-50">
              <Newspaper className="h-4 w-4 text-emerald-600" />
            </div>
            Repurpose Article
          </CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Select a published article and generate platform-specific social media posts
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search articles..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9" />
          </div>

          {articlesLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              <span className="ml-2 text-sm text-muted-foreground">Loading articles...</span>
            </div>
          ) : articlesError ? (
            <div className="flex flex-col items-center py-8 text-center">
              <AlertCircle className="h-8 w-8 text-amber-500 mb-2" />
              <p className="text-sm text-muted-foreground mb-2">Unable to load articles from the Publications module.</p>
              <Button variant="outline" size="sm" onClick={fetchArticles}><RefreshCw className="h-3 w-3 mr-1.5" />Retry</Button>
            </div>
          ) : filteredArticles.length === 0 ? (
            <div className="flex flex-col items-center py-8 text-center">
              <Inbox className="h-8 w-8 text-gray-400 mb-2" />
              <p className="text-sm text-muted-foreground">
                {articles.length === 0 ? 'No published articles found. Publish an article first.' : 'No articles match your search.'}
              </p>
            </div>
          ) : (
            <div className="space-y-2 max-h-[320px] overflow-y-auto pr-1">
              {filteredArticles.map((article) => {
                const isSelected = selectedArticle?.id === article.id;
                return (
                  <button key={article.id} type="button" onClick={() => setSelectedArticle(isSelected ? null : article)}
                    className={`w-full text-left p-3 rounded-lg border transition-all ${isSelected ? 'border-emerald-500 bg-emerald-50 ring-1 ring-emerald-200' : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50/50'}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <FileText className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                          <span className="text-sm font-medium line-clamp-1">{article.title}</span>
                        </div>
                        <p className="text-xs text-muted-foreground line-clamp-2 ml-5">
                          {article.excerpt || (article.body ? stripHtml(article.body).slice(0, 120) : '')}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-1 flex-shrink-0">
                        {article.published_at && <span className="text-[10px] text-muted-foreground">{formatDate(article.published_at)}</span>}
                        {isSelected && <Check className="h-4 w-4 text-emerald-600" />}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Generation Settings */}
      {selectedArticle && (
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-sm font-medium">
              Generate Social Posts from: <span className="text-emerald-700">{selectedArticle.title}</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Platform Selection */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Target Platforms</Label>
              <div className="flex flex-wrap gap-2">
                {(Object.entries(PLATFORM_CONFIG) as [SocialAIPlatform, typeof PLATFORM_CONFIG[SocialAIPlatform]][]).map(
                  ([key, config]) => {
                    const isSelected = selectedPlatforms.includes(key);
                    return (
                      <button key={key} type="button" onClick={() => togglePlatform(key)}
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition-all duration-150 ${isSelected ? 'bg-gray-50 text-gray-900 border-current' : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'}`}>
                        {config.icon} {config.label} {isSelected && <Check className="h-3 w-3" />}
                      </button>
                    );
                  },
                )}
              </div>
            </div>

            {/* Tone & Goal */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium">Tone</Label>
                <Select value={tone} onValueChange={(v) => setTone(v as ContentTone)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{TONE_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium">Goal</Label>
                <Select value={goal} onValueChange={(v) => setGoal(v as ContentGoal)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{GOAL_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>

            {/* Options */}
            <div className="flex flex-wrap gap-6">
              <div className="flex items-center gap-2">
                <Checkbox id="repurpose-hashtags" checked={includeHashtags} onCheckedChange={(c) => setIncludeHashtags(c === true)} />
                <Label htmlFor="repurpose-hashtags" className="text-sm cursor-pointer">Include hashtags</Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox id="repurpose-cta" checked={includeCTA} onCheckedChange={(c) => setIncludeCTA(c === true)} />
                <Label htmlFor="repurpose-cta" className="text-sm cursor-pointer">Include call-to-action</Label>
              </div>
            </div>

            {/* Bundle Mode Toggle */}
            <div className="border rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Layers className="h-4 w-4" style={{ color: BRAND.navy }} />
                  <Label className="text-sm font-medium cursor-pointer" htmlFor="bundle-toggle">
                    Generate with Branded Image
                  </Label>
                </div>
                <Checkbox id="bundle-toggle" checked={bundleMode} onCheckedChange={(c) => setBundleMode(c === true)} />
              </div>
              <p className="text-xs text-muted-foreground">
                Enable to generate a branded image alongside your text posts (text + image in parallel via bundle API).
              </p>

              {bundleMode && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t">
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Image Style</Label>
                    <Select value={imageStyle} onValueChange={(v) => setImageStyle(v as ImageStyle)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{IMAGE_STYLE_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Image Platform</Label>
                    <Select value={imagePlatform} onValueChange={(v) => setImagePlatform(v as SocialAIPlatform)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {(Object.entries(PLATFORM_CONFIG) as [SocialAIPlatform, typeof PLATFORM_CONFIG[SocialAIPlatform]][]).map(
                          ([key, config]) => <SelectItem key={key} value={key}>{config.label}</SelectItem>,
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}
            </div>

            {/* Generate Button */}
            <div className="flex justify-end">
              <Button onClick={handleGenerate} disabled={isProcessing || selectedPlatforms.length === 0} className="flex items-center gap-2">
                {isProcessing ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> {bundleMode ? 'Generating Bundle...' : 'Generating...'}</>
                ) : (
                  <>{bundleMode ? <Layers className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />} {bundleMode ? 'Repurpose as Bundle' : 'Repurpose Article'}</>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Generated Image (bundle mode) */}
      {generatedImages.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <ImageIcon className="h-4 w-4" style={{ color: BRAND.navy }} /> Generated Image
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {generatedImages.map((img, idx) => (
                <div key={idx} className="relative rounded-lg overflow-hidden border border-gray-200">
                  <img src={img.signedUrl} alt={`AI-generated for ${img.platform}`} className="w-full h-auto" loading="lazy" />
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-3">
                    <div className="flex items-center justify-between">
                      <Badge className="bg-white/20 text-white text-xs">{img.platform} &middot; {img.dimensions}</Badge>
                      {onUseContent && (
                        <Button size="sm" variant="secondary" className="text-xs h-7" onClick={() => {
                          const firstPost = generatedPosts[0];
                          if (firstPost) onUseContent(firstPost.platform, firstPost.content, firstPost.hashtags);
                        }}>
                          <ArrowRight className="h-3 w-3 mr-1" /> Use in Post
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Generated Posts */}
      {generatedPosts.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Check className="h-5 w-5 text-green-600" />
              Repurposed Content
              {bundleMode && generatedImages.length > 0 && (
                <Badge variant="secondary" className="text-xs"><Layers className="h-3 w-3 mr-1" /> Bundle</Badge>
              )}
            </h3>
            <Button variant="outline" size="sm" onClick={handleGenerate} disabled={isProcessing} className="flex items-center gap-2">
              <RefreshCw className={`h-4 w-4 ${isProcessing ? 'animate-spin' : ''}`} /> Regenerate
            </Button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {generatedPosts.map((post) => {
              const config = PLATFORM_CONFIG[post.platform];
              const isCopied = copiedPlatform === post.platform;
              return (
                <Card key={post.platform} className="bg-gray-50 border">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 font-semibold text-gray-800">{config?.icon}{config?.label || post.platform}</div>
                      <Badge variant="secondary" className="text-xs font-normal">{post.characterCount}/{post.characterLimit}</Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="bg-white rounded-lg p-4 text-sm leading-relaxed whitespace-pre-wrap border border-gray-100">{post.content}</div>
                    {post.hashtags.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {post.hashtags.map((tag, i) => <span key={i} className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: BRAND.navyLight, color: BRAND.navy }}>#{tag}</span>)}
                      </div>
                    )}
                    {post.callToAction && (
                      <div className="flex items-start gap-2 p-2 bg-white rounded border border-gray-100">
                        <ArrowRight className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                        <p className="text-xs text-gray-600">{post.callToAction}</p>
                      </div>
                    )}
                    <div className="flex items-center gap-2 pt-1">
                      <Button variant="outline" size="sm" onClick={() => handleCopy(post)} className="flex items-center gap-1.5 text-xs">
                        {isCopied ? <><Check className="h-3 w-3 text-green-600" /> Copied</> : <><Copy className="h-3 w-3" /> Copy</>}
                      </Button>
                      {onUseContent && (
                        <Button size="sm" onClick={() => onUseContent(post.platform, post.content, post.hashtags)} className="flex items-center gap-1.5 text-xs">
                          <ArrowRight className="h-3 w-3" /> Use in Post
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}