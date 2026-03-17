/**
 * AI Brand Templates
 *
 * Pre-configured content templates for common Navigate Wealth social media
 * post types, plus user-created custom templates persisted in KV store.
 *
 * @module social-media/components/AIBrandTemplates
 */

import React, { useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../../../ui/card';
import { Button } from '../../../../ui/button';
import { Badge } from '../../../../ui/badge';
import { Input } from '../../../../ui/input';
import { Label } from '../../../../ui/label';
import { Textarea } from '../../../../ui/textarea';
import { Checkbox } from '../../../../ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../../ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '../../../../ui/dialog';
import { toast } from 'sonner@2.0.3';
import {
  Sparkles,
  Loader2,
  Check,
  Copy,
  ArrowRight,
  Linkedin,
  Instagram,
  Facebook,
  Twitter,
  BookOpen,
  TrendingUp,
  Users,
  Shield,
  Calendar,
  Award,
  Lightbulb,
  BarChart3,
  RefreshCw,
  Palette,
  Plus,
  Pencil,
  Trash2,
  FileText,
  Star,
} from 'lucide-react';
import { useSocialMediaAI } from '../hooks/useSocialMediaAI';
import { useCustomTemplates } from '../hooks/useCustomTemplates';
import type { SocialAIPlatform, ContentTone, ContentGoal } from '../types';
import { BRAND } from '../constants';

// ============================================================================
// Built-in Template Definition
// ============================================================================

interface BuiltinTemplate {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  bgColor: string;
  platforms: SocialAIPlatform[];
  tone: ContentTone;
  goal: ContentGoal;
  topicPrompt: string;
  includeHashtags: boolean;
  includeCTA: boolean;
  additionalInstructions: string;
  isBuiltin: true;
}

type TemplateItem = BuiltinTemplate | (CustomBrandTemplate & { isBuiltin: false });

const BUILTIN_TEMPLATES: BuiltinTemplate[] = [
  {
    id: 'builtin-market-update', name: 'Market Update',
    description: 'Weekly or daily market commentary with key takeaways',
    icon: 'TrendingUp', color: 'text-blue-700', bgColor: 'bg-blue-50',
    platforms: ['linkedin', 'x'], tone: 'authoritative', goal: 'thought_leadership',
    topicPrompt: 'Weekly market update: ', includeHashtags: true, includeCTA: true,
    additionalInstructions: 'Focus on SA market context. Reference JSE, rand performance, and global macro factors. Include 1-2 actionable insights for investors.',
    isBuiltin: true,
  },
  {
    id: 'builtin-financial-tip', name: 'Financial Tip',
    description: 'Educational bite-sized financial advice',
    icon: 'Lightbulb', color: 'text-amber-700', bgColor: 'bg-amber-50',
    platforms: ['linkedin', 'instagram', 'facebook'], tone: 'educational', goal: 'education',
    topicPrompt: '', includeHashtags: true, includeCTA: true,
    additionalInstructions: 'Make complex financial concepts simple. Use concrete examples relevant to South African professionals. Avoid jargon.',
    isBuiltin: true,
  },
  {
    id: 'builtin-client-success', name: 'Client Success Story',
    description: 'Anonymised client outcome or milestone celebration',
    icon: 'Award', color: 'text-emerald-700', bgColor: 'bg-emerald-50',
    platforms: ['linkedin', 'facebook'], tone: 'friendly', goal: 'awareness',
    topicPrompt: 'Client milestone: ', includeHashtags: true, includeCTA: true,
    additionalInstructions: 'Use anonymised details only — never real names. Focus on the journey and outcome. Celebrate the client\'s discipline and planning.',
    isBuiltin: true,
  },
  {
    id: 'builtin-team-spotlight', name: 'Team Spotlight',
    description: 'Highlight team members, culture, or company news',
    icon: 'Users', color: 'text-purple-700', bgColor: 'bg-purple-50',
    platforms: ['linkedin', 'instagram'], tone: 'friendly', goal: 'awareness',
    topicPrompt: 'Team spotlight: ', includeHashtags: true, includeCTA: false,
    additionalInstructions: 'Humanise the brand. Show the people behind Navigate Wealth. Keep it warm, authentic, and professional.',
    isBuiltin: true,
  },
  {
    id: 'builtin-regulatory-update', name: 'Regulatory Update',
    description: 'Tax law changes, SARS updates, compliance news',
    icon: 'Shield', color: 'text-red-700', bgColor: 'bg-red-50',
    platforms: ['linkedin'], tone: 'professional', goal: 'education',
    topicPrompt: 'Regulatory update: ', includeHashtags: true, includeCTA: true,
    additionalInstructions: 'Explain what changed, who it affects, and what clients should do. Reference specific legislation where relevant.',
    isBuiltin: true,
  },
  {
    id: 'builtin-event-promotion', name: 'Event / Webinar',
    description: 'Promote upcoming webinars, workshops, or events',
    icon: 'Calendar', color: 'text-indigo-700', bgColor: 'bg-indigo-50',
    platforms: ['linkedin', 'instagram', 'facebook', 'x'], tone: 'conversational', goal: 'promotion',
    topicPrompt: 'Upcoming event: ', includeHashtags: true, includeCTA: true,
    additionalInstructions: 'Create urgency without being pushy. Highlight the value attendees will get. Include clear registration CTA.',
    isBuiltin: true,
  },
  {
    id: 'builtin-thought-leadership', name: 'Thought Leadership',
    description: 'Opinion piece on industry trends or future outlook',
    icon: 'BookOpen', color: 'text-teal-700', bgColor: 'bg-teal-50',
    platforms: ['linkedin'], tone: 'authoritative', goal: 'thought_leadership',
    topicPrompt: '', includeHashtags: true, includeCTA: true,
    additionalInstructions: 'Take a clear position. Support it with data or experience. Invite discussion.',
    isBuiltin: true,
  },
  {
    id: 'builtin-data-insight', name: 'Data & Stats',
    description: 'Share compelling financial statistics or research findings',
    icon: 'BarChart3', color: 'text-cyan-700', bgColor: 'bg-cyan-50',
    platforms: ['linkedin', 'x'], tone: 'professional', goal: 'engagement',
    topicPrompt: '', includeHashtags: true, includeCTA: true,
    additionalInstructions: 'Lead with the most surprising statistic. Provide context. Cite the source. End with a question. Use South African data where possible.',
    isBuiltin: true,
  },
];

// ============================================================================
// Icon resolver
// ============================================================================

const ICON_MAP: Record<string, React.ReactNode> = {
  TrendingUp: <TrendingUp className="h-5 w-5" />,
  Lightbulb: <Lightbulb className="h-5 w-5" />,
  Award: <Award className="h-5 w-5" />,
  Users: <Users className="h-5 w-5" />,
  Shield: <Shield className="h-5 w-5" />,
  Calendar: <Calendar className="h-5 w-5" />,
  BookOpen: <BookOpen className="h-5 w-5" />,
  BarChart3: <BarChart3 className="h-5 w-5" />,
  Star: <Star className="h-5 w-5" />,
  FileText: <FileText className="h-5 w-5" />,
  Sparkles: <Sparkles className="h-5 w-5" />,
  Palette: <Palette className="h-5 w-5" />,
};
function resolveIcon(slug: string): React.ReactNode {
  return ICON_MAP[slug] || <FileText className="h-5 w-5" />;
}

// ============================================================================
// Constants
// ============================================================================

const PLATFORM_DISPLAY: Record<SocialAIPlatform, { label: string; icon: React.ReactNode }> = {
  linkedin: { label: 'LinkedIn', icon: <Linkedin className="h-4 w-4" /> },
  instagram: { label: 'Instagram', icon: <Instagram className="h-4 w-4" /> },
  facebook: { label: 'Facebook', icon: <Facebook className="h-4 w-4" /> },
  x: { label: 'X', icon: <Twitter className="h-4 w-4" /> },
};

const PLATFORM_CARD_CONFIG: Record<SocialAIPlatform, { color: string; bgColor: string }> = {
  linkedin: { color: 'text-blue-700', bgColor: 'bg-blue-50' },
  instagram: { color: 'text-pink-600', bgColor: 'bg-pink-50' },
  facebook: { color: 'text-blue-600', bgColor: 'bg-blue-50' },
  x: { color: 'text-gray-900', bgColor: 'bg-gray-50' },
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

const ICON_OPTIONS = Object.keys(ICON_MAP);

const COLOUR_PRESETS = [
  { color: 'text-blue-700', bgColor: 'bg-blue-50', label: 'Blue' },
  { color: 'text-emerald-700', bgColor: 'bg-emerald-50', label: 'Emerald' },
  { color: 'text-amber-700', bgColor: 'bg-amber-50', label: 'Amber' },
  { color: 'text-purple-700', bgColor: 'bg-purple-50', label: 'Purple' },
  { color: 'text-red-700', bgColor: 'bg-red-50', label: 'Red' },
  { color: 'text-indigo-700', bgColor: 'bg-indigo-50', label: 'Indigo' },
  { color: 'text-teal-700', bgColor: 'bg-teal-50', label: 'Teal' },
  { color: 'text-cyan-700', bgColor: 'bg-cyan-50', label: 'Cyan' },
];

// ============================================================================
// Props
// ============================================================================

interface AIBrandTemplatesProps {
  onUseContent?: (platform: SocialAIPlatform, content: string, hashtags: string[]) => void;
}

// ============================================================================
// Component
// ============================================================================

export function AIBrandTemplates({ onUseContent }: AIBrandTemplatesProps) {
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateItem | null>(null);
  const [customTopic, setCustomTopic] = useState('');
  const [generatedPosts, setGeneratedPosts] = useState<GeneratedPlatformPost[]>([]);
  const [copiedPlatform, setCopiedPlatform] = useState<string | null>(null);

  // Template editor state
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<CustomBrandTemplate | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Form fields
  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formIcon, setFormIcon] = useState('Star');
  const [formColorIdx, setFormColorIdx] = useState(0);
  const [formPlatforms, setFormPlatforms] = useState<SocialAIPlatform[]>(['linkedin']);
  const [formTone, setFormTone] = useState<ContentTone>('professional');
  const [formGoal, setFormGoal] = useState<ContentGoal>('engagement');
  const [formTopicPrompt, setFormTopicPrompt] = useState('');
  const [formHashtags, setFormHashtags] = useState(true);
  const [formCTA, setFormCTA] = useState(true);
  const [formInstructions, setFormInstructions] = useState('');

  const { generatePostText, isGenerating, isConfigured, statusLoading } = useSocialMediaAI();
  const {
    templates: customTemplates, templatesLoading,
    createTemplate, isCreating,
    updateTemplate, isUpdating,
    deleteTemplate, isDeleting,
  } = useCustomTemplates();

  const allTemplates: TemplateItem[] = [
    ...BUILTIN_TEMPLATES,
    ...customTemplates.map((t) => ({ ...t, isBuiltin: false as const })),
  ];

  // ============================================================================
  // Template Editor
  // ============================================================================

  const openCreateEditor = useCallback(() => {
    setEditingTemplate(null);
    setFormName(''); setFormDescription(''); setFormIcon('Star'); setFormColorIdx(0);
    setFormPlatforms(['linkedin']); setFormTone('professional'); setFormGoal('engagement');
    setFormTopicPrompt(''); setFormHashtags(true); setFormCTA(true); setFormInstructions('');
    setEditorOpen(true);
  }, []);

  const openEditEditor = useCallback((template: CustomBrandTemplate) => {
    setEditingTemplate(template);
    setFormName(template.name); setFormDescription(template.description);
    setFormIcon(template.icon);
    const idx = COLOUR_PRESETS.findIndex((p) => p.color === template.color);
    setFormColorIdx(idx >= 0 ? idx : 0);
    setFormPlatforms(template.platforms); setFormTone(template.tone); setFormGoal(template.goal);
    setFormTopicPrompt(template.topicPrompt); setFormHashtags(template.includeHashtags);
    setFormCTA(template.includeCTA); setFormInstructions(template.additionalInstructions);
    setEditorOpen(true);
  }, []);

  const handleSaveTemplate = useCallback(async () => {
    if (!formName.trim() || !formDescription.trim() || !formInstructions.trim()) {
      toast.error('Please fill in all required fields');
      return;
    }
    const preset = COLOUR_PRESETS[formColorIdx] || COLOUR_PRESETS[0];
    const data: CreateCustomTemplateInput = {
      name: formName.trim(), description: formDescription.trim(),
      icon: formIcon, color: preset.color, bgColor: preset.bgColor,
      platforms: formPlatforms, tone: formTone, goal: formGoal,
      topicPrompt: formTopicPrompt.trim(), includeHashtags: formHashtags,
      includeCTA: formCTA, additionalInstructions: formInstructions.trim(),
    };
    try {
      if (editingTemplate) {
        await updateTemplate({ id: editingTemplate.id, updates: data });
      } else {
        await createTemplate(data);
      }
      setEditorOpen(false);
    } catch { /* hook handles toast */ }
  }, [formName, formDescription, formIcon, formColorIdx, formPlatforms, formTone, formGoal, formTopicPrompt, formHashtags, formCTA, formInstructions, editingTemplate, createTemplate, updateTemplate]);

  const handleDeleteTemplate = useCallback(async (id: string) => {
    try {
      await deleteTemplate(id);
      setDeleteConfirmId(null);
      if (selectedTemplate && !selectedTemplate.isBuiltin && selectedTemplate.id === id) {
        setSelectedTemplate(null);
      }
    } catch { /* hook handles toast */ }
  }, [deleteTemplate, selectedTemplate]);

  // ============================================================================
  // Generation
  // ============================================================================

  const handleSelectTemplate = useCallback((template: TemplateItem) => {
    setSelectedTemplate(template);
    setCustomTopic(template.topicPrompt);
    setGeneratedPosts([]);
  }, []);

  const handleGenerate = useCallback(async () => {
    if (!selectedTemplate || !customTopic.trim()) {
      toast.error('Please enter the topic details');
      return;
    }
    const input: GeneratePostTextInput = {
      platforms: selectedTemplate.platforms as SocialAIPlatform[],
      topic: customTopic.trim(),
      tone: selectedTemplate.tone as ContentTone,
      goal: selectedTemplate.goal as ContentGoal,
      includeHashtags: selectedTemplate.includeHashtags,
      includeCTA: selectedTemplate.includeCTA,
      additionalInstructions: selectedTemplate.additionalInstructions,
    };
    try {
      const response = await generatePostText(input);
      if (response.success && response.data) {
        setGeneratedPosts(response.data.posts);
      }
    } catch { /* hook */ }
  }, [selectedTemplate, customTopic, generatePostText]);

  const handleCopy = useCallback(async (post: GeneratedPlatformPost) => {
    const text = post.hashtags.length > 0
      ? `${post.content}\n\n${post.hashtags.map((h) => `#${h}`).join(' ')}`
      : post.content;
    await navigator.clipboard.writeText(text);
    setCopiedPlatform(post.platform);
    toast.success('Copied to clipboard');
    setTimeout(() => setCopiedPlatform(null), 2000);
  }, []);

  const toggleFormPlatform = useCallback((p: SocialAIPlatform) => {
    setFormPlatforms((prev) => prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]);
  }, []);

  // ============================================================================
  // Render
  // ============================================================================

  if (statusLoading) {
    return (
      <Card><CardContent className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        <span className="ml-2 text-muted-foreground">Loading...</span>
      </CardContent></Card>
    );
  }

  if (!isConfigured) {
    return (
      <Card><CardContent className="flex flex-col items-center justify-center py-12 text-center">
        <Sparkles className="h-12 w-12 text-amber-500 mb-4" />
        <h3 className="text-lg font-semibold mb-2">AI Service Not Configured</h3>
        <p className="text-muted-foreground max-w-md">Configure the OpenAI API key to use brand templates.</p>
      </CardContent></Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Template Grid */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-lg">
                <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-orange-50">
                  <Palette className="h-4 w-4 text-orange-600" />
                </div>
                Brand Templates
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Pre-configured templates with Navigate Wealth brand voice and optimal platform settings
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={openCreateEditor} className="flex items-center gap-1.5">
              <Plus className="h-4 w-4" /> New Template
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {allTemplates.map((template) => {
              const isSelected = selectedTemplate?.id === template.id;
              const isCustom = !template.isBuiltin;
              return (
                <div
                  key={template.id}
                  className={`relative p-3 rounded-lg border text-left transition-all cursor-pointer ${isSelected ? `${template.bgColor} border-current ring-1 ring-current ${template.color}` : 'bg-white border-gray-200 hover:border-gray-300 hover:shadow-sm'}`}
                  onClick={() => handleSelectTemplate(template)}
                >
                  {isCustom && (
                    <div className="absolute top-1.5 right-1.5 flex gap-1">
                      <button type="button" onClick={(e) => { e.stopPropagation(); openEditEditor(template as CustomBrandTemplate); }}
                        className="p-1 rounded hover:bg-white/80 text-gray-400 hover:text-gray-700"><Pencil className="h-3 w-3" /></button>
                      <button type="button" onClick={(e) => { e.stopPropagation(); setDeleteConfirmId(template.id); }}
                        className="p-1 rounded hover:bg-red-50 text-gray-400 hover:text-red-600"><Trash2 className="h-3 w-3" /></button>
                    </div>
                  )}
                  <div className={`flex items-center gap-2 mb-1.5 ${isSelected ? template.color : 'text-gray-700'}`}>
                    {resolveIcon(template.icon)}
                    <span className="text-sm font-semibold">{template.name}</span>
                    {isCustom && <Badge variant="outline" className="text-[9px] px-1 py-0">Custom</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-2">{template.description}</p>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {template.platforms.map((p) => (
                      <span key={p} className="text-[9px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded capitalize">
                        {p === 'x' ? 'X' : p}
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
          {templatesLoading && (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              <span className="ml-2 text-xs text-muted-foreground">Loading custom templates...</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Generation Panel */}
      {selectedTemplate && (
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <div className={`flex items-center justify-center h-6 w-6 rounded ${selectedTemplate.bgColor} ${selectedTemplate.color}`}>
                {resolveIcon(selectedTemplate.icon)}
              </div>
              {selectedTemplate.name}
              {!selectedTemplate.isBuiltin && <Badge variant="outline" className="text-[10px]">Custom</Badge>}
            </CardTitle>
            <div className="flex flex-wrap gap-2 mt-1">
              <Badge variant="secondary" className="text-[10px]">{selectedTemplate.tone}</Badge>
              <Badge variant="outline" className="text-[10px]">{(selectedTemplate.goal as string).replace('_', ' ')}</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium">Topic Details <span className="text-red-500">*</span></Label>
              <Input placeholder={`Enter your ${selectedTemplate.name.toLowerCase()} topic...`} value={customTopic} onChange={(e) => setCustomTopic(e.target.value)} maxLength={500} />
            </div>
            <div className="flex justify-end">
              <Button onClick={handleGenerate} disabled={isGenerating || !customTopic.trim()} className="flex items-center gap-2">
                {isGenerating ? <><Loader2 className="h-4 w-4 animate-spin" /> Generating...</> : <><Sparkles className="h-4 w-4" /> Generate from Template</>}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Generated Posts */}
      {generatedPosts.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold flex items-center gap-2"><Check className="h-5 w-5 text-green-600" /> Generated Content</h3>
            <Button variant="outline" size="sm" onClick={handleGenerate} disabled={isGenerating}>
              <RefreshCw className={`h-4 w-4 mr-1.5 ${isGenerating ? 'animate-spin' : ''}`} /> Regenerate
            </Button>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {generatedPosts.map((post) => {
              const pcfg = PLATFORM_CARD_CONFIG[post.platform];
              const pdis = PLATFORM_DISPLAY[post.platform];
              const isCopied = copiedPlatform === post.platform;
              return (
                <Card key={post.platform} className={`${pcfg?.bgColor || 'bg-gray-50'} border`}>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className={`flex items-center gap-2 ${pcfg?.color || ''} font-semibold`}>{pdis?.icon}{pdis?.label || post.platform}</div>
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

      {/* Template Editor Dialog */}
      <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editingTemplate ? 'Edit Template' : 'Create Custom Template'}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Name <span className="text-red-500">*</span></Label>
              <Input value={formName} onChange={(e) => setFormName(e.target.value)} maxLength={100} placeholder="e.g., Weekly Newsletter Promo" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Description <span className="text-red-500">*</span></Label>
              <Input value={formDescription} onChange={(e) => setFormDescription(e.target.value)} maxLength={300} placeholder="Short description" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Icon</Label>
                <div className="flex flex-wrap gap-1.5">
                  {ICON_OPTIONS.map((slug) => (
                    <button key={slug} type="button" onClick={() => setFormIcon(slug)}
                      className={`p-1.5 rounded border transition-all ${formIcon === slug ? 'border-gray-400 bg-gray-50' : 'border-gray-200 hover:border-gray-300'}`}>
                      <span className="h-4 w-4 block">{resolveIcon(slug)}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Colour</Label>
                <div className="flex flex-wrap gap-1.5">
                  {COLOUR_PRESETS.map((preset, idx) => (
                    <button key={idx} type="button" onClick={() => setFormColorIdx(idx)} title={preset.label}
                      className={`w-6 h-6 rounded-full ${preset.bgColor} border-2 transition-all ${formColorIdx === idx ? 'border-gray-800 ring-2 ring-offset-1 ring-gray-300' : 'border-transparent'}`}>
                      <span className={`block w-3 h-3 rounded-full mx-auto ${preset.color.replace('text-', 'bg-')}`} />
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Platforms</Label>
              <div className="flex flex-wrap gap-2">
                {(Object.keys(PLATFORM_DISPLAY) as SocialAIPlatform[]).map((p) => {
                  const isActive = formPlatforms.includes(p);
                  return (
                    <button key={p} type="button" onClick={() => toggleFormPlatform(p)}
                      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded border text-xs font-medium transition-all ${isActive ? 'bg-gray-50 text-gray-900 border-gray-400' : 'bg-white text-gray-500 border-gray-200'}`}>
                      {PLATFORM_DISPLAY[p].icon} {PLATFORM_DISPLAY[p].label}
                      {isActive && <Check className="h-3 w-3" />}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Tone</Label>
                <Select value={formTone} onValueChange={(v) => setFormTone(v as ContentTone)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{TONE_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Goal</Label>
                <Select value={formGoal} onValueChange={(v) => setFormGoal(v as ContentGoal)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{GOAL_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Topic Prompt Prefix (optional)</Label>
              <Input value={formTopicPrompt} onChange={(e) => setFormTopicPrompt(e.target.value)} maxLength={200} placeholder="e.g., Weekly market update: " />
            </div>
            <div className="flex gap-6">
              <div className="flex items-center gap-2">
                <Checkbox id="tpl-hashtags" checked={formHashtags} onCheckedChange={(c) => setFormHashtags(c === true)} />
                <Label htmlFor="tpl-hashtags" className="text-sm cursor-pointer">Hashtags</Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox id="tpl-cta" checked={formCTA} onCheckedChange={(c) => setFormCTA(c === true)} />
                <Label htmlFor="tpl-cta" className="text-sm cursor-pointer">CTA</Label>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">AI Instructions <span className="text-red-500">*</span></Label>
              <Textarea value={formInstructions} onChange={(e) => setFormInstructions(e.target.value)} maxLength={1000} rows={4} placeholder="Describe what the AI should focus on..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditorOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveTemplate} disabled={isCreating || isUpdating || !formName.trim() || !formInstructions.trim()}>
              {(isCreating || isUpdating) ? <><Loader2 className="h-4 w-4 animate-spin mr-1.5" /> Saving...</> : editingTemplate ? 'Save Changes' : 'Create Template'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={!!deleteConfirmId} onOpenChange={() => setDeleteConfirmId(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Delete Template</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Are you sure you want to delete this custom template? This action cannot be undone.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirmId(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => deleteConfirmId && handleDeleteTemplate(deleteConfirmId)} disabled={isDeleting}>
              {isDeleting ? <><Loader2 className="h-4 w-4 animate-spin mr-1.5" /> Deleting...</> : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}