/**
 * Linktree Tab — Admin management UI for link-in-bio page
 *
 * CRUD for company links that render on a public /links page.
 * Persisted via KV store linktree:links / linktree:settings.
 *
 * Features:
 *   - Full CRUD for links with reordering
 *   - Quick Add templates for common Navigate Wealth links
 *   - Social profile management (icon row on public page)
 *   - Settings (title, bio, theme)
 *   - Click analytics per link
 *
 * @module social-media/LinktreeTab
 */

import React, { useState, useCallback, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../../ui/card';
import { Button } from '../../../ui/button';
import { Badge } from '../../../ui/badge';
import { Input } from '../../../ui/input';
import { Label } from '../../../ui/label';
import { Textarea } from '../../../ui/textarea';
import { Switch } from '../../../ui/switch';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '../../../ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../ui/select';
import { toast } from 'sonner@2.0.3';
import {
  Link as LinkIcon,
  Plus,
  Pencil,
  Trash2,
  ExternalLink,
  Eye,
  Copy,
  Check,
  Globe,
  Instagram,
  Loader2,
  ArrowUp,
  ArrowDown,
  BarChart3,
  Settings,
  Inbox,
  MousePointer,
  Linkedin,
  Youtube,
  Facebook,
  Twitter,
  Mail,
  Phone,
  MapPin,
  CalendarCheck,
  FileText,
  BookOpen,
  Zap,
  X,
} from 'lucide-react';
import { projectId, publicAnonKey } from '../../../../utils/supabase/info';
import { BRAND } from './constants';

// ============================================================================
// Types
// ============================================================================

interface LinktreeLink {
  id: string;
  title: string;
  url: string;
  icon?: string;
  description?: string;
  enabled: boolean;
  order: number;
  clicks: number;
  createdAt: string;
  updatedAt: string;
}

interface LinktreeSettings {
  title: string;
  bio: string;
  avatarUrl?: string;
  theme: 'navy' | 'gold' | 'light' | 'dark';
  showBranding: boolean;
  socialProfiles?: Record<string, string>;
}

// ============================================================================
// Quick Add Templates
// ============================================================================

interface QuickAddTemplate {
  title: string;
  url: string;
  description: string;
  icon: React.ReactNode;
  category: 'website' | 'social' | 'contact' | 'content';
}

const QUICK_ADD_TEMPLATES: QuickAddTemplate[] = [
  {
    title: 'Company Website',
    url: 'https://navigatewealth.co.za',
    description: 'Visit our official website',
    icon: <Globe className="h-4 w-4" />,
    category: 'website',
  },
  {
    title: 'Book a Consultation',
    url: 'https://navigatewealth.co.za/contact',
    description: 'Schedule a free financial planning session',
    icon: <CalendarCheck className="h-4 w-4" />,
    category: 'contact',
  },
  {
    title: 'Our Services',
    url: 'https://navigatewealth.co.za/services',
    description: 'Explore our financial planning solutions',
    icon: <FileText className="h-4 w-4" />,
    category: 'website',
  },
  {
    title: 'Latest Blog Posts',
    url: 'https://navigatewealth.co.za/blog',
    description: 'Financial insights and market updates',
    icon: <BookOpen className="h-4 w-4" />,
    category: 'content',
  },
  {
    title: 'LinkedIn',
    url: 'https://www.linkedin.com/company/navigate-wealth',
    description: 'Follow us on LinkedIn',
    icon: <Linkedin className="h-4 w-4" />,
    category: 'social',
  },
  {
    title: 'Instagram',
    url: 'https://www.instagram.com/navigatewealth',
    description: 'Follow us on Instagram',
    icon: <Instagram className="h-4 w-4" />,
    category: 'social',
  },
  {
    title: 'Facebook',
    url: 'https://www.facebook.com/navigatewealth',
    description: 'Like us on Facebook',
    icon: <Facebook className="h-4 w-4" />,
    category: 'social',
  },
  {
    title: 'YouTube Channel',
    url: 'https://www.youtube.com/@navigatewealth',
    description: 'Watch our financial planning videos',
    icon: <Youtube className="h-4 w-4" />,
    category: 'content',
  },
  {
    title: 'Email Us',
    url: 'mailto:info@navigatewealth.co.za',
    description: 'Get in touch via email',
    icon: <Mail className="h-4 w-4" />,
    category: 'contact',
  },
  {
    title: 'Call Us',
    url: 'tel:+27126672505',
    description: '(012) 667 2505',
    icon: <Phone className="h-4 w-4" />,
    category: 'contact',
  },
  {
    title: 'Office Location',
    url: 'https://maps.google.com/?q=Route+21+Corporate+Park+Centurion',
    description: 'Route 21 Corporate Park, Centurion',
    icon: <MapPin className="h-4 w-4" />,
    category: 'contact',
  },
];

// Social profile platform definitions
const SOCIAL_PLATFORMS = [
  { key: 'instagram', label: 'Instagram', icon: <Instagram className="h-4 w-4" />, placeholder: 'https://instagram.com/navigatewealth' },
  { key: 'linkedin', label: 'LinkedIn', icon: <Linkedin className="h-4 w-4" />, placeholder: 'https://linkedin.com/company/navigate-wealth' },
  { key: 'facebook', label: 'Facebook', icon: <Facebook className="h-4 w-4" />, placeholder: 'https://facebook.com/navigatewealth' },
  { key: 'youtube', label: 'YouTube', icon: <Youtube className="h-4 w-4" />, placeholder: 'https://youtube.com/@navigatewealth' },
  { key: 'twitter', label: 'X (Twitter)', icon: <Twitter className="h-4 w-4" />, placeholder: 'https://x.com/navigatewealth' },
  { key: 'email', label: 'Email', icon: <Mail className="h-4 w-4" />, placeholder: 'mailto:info@navigatewealth.co.za' },
] as const;

const CATEGORY_LABELS: Record<string, string> = {
  website: 'Website',
  social: 'Social Media',
  contact: 'Contact',
  content: 'Content',
};

// ============================================================================
// API
// ============================================================================

const BASE = `https://${projectId}.supabase.co/functions/v1/make-server-91ed8379/linktree`;
const headers = () => ({
  'Content-Type': 'application/json',
  Authorization: `Bearer ${publicAnonKey}`,
});

async function fetchJson<T>(url: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(url, { headers: headers(), ...opts });
  const data = await res.json();
  if (!data.success) throw new Error(data.error || 'Request failed');
  return data.data;
}

// ============================================================================
// Component
// ============================================================================

export function LinktreeTab() {
  const [links, setLinks] = useState<LinktreeLink[]>([]);
  const [settings, setSettings] = useState<LinktreeSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Dialog state
  const [editDialog, setEditDialog] = useState(false);
  const [editingLink, setEditingLink] = useState<LinktreeLink | null>(null);
  const [settingsDialog, setSettingsDialog] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [quickAddCategory, setQuickAddCategory] = useState<string>('all');
  const [addingTemplateId, setAddingTemplateId] = useState<string | null>(null);

  // Form state
  const [formTitle, setFormTitle] = useState('');
  const [formUrl, setFormUrl] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formEnabled, setFormEnabled] = useState(true);

  // Settings form
  const [sTitle, setSTitle] = useState('');
  const [sBio, setSBio] = useState('');
  const [sTheme, setSTheme] = useState<LinktreeSettings['theme']>('navy');
  const [sSocialProfiles, setSSocialProfiles] = useState<Record<string, string>>({});

  const publicUrl = `${window.location.origin}/links`;

  // --------------------------------------------------------------------------
  // Data fetching
  // --------------------------------------------------------------------------

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [linksData, settingsData] = await Promise.all([
        fetchJson<LinktreeLink[]>(`${BASE}/links`),
        fetchJson<LinktreeSettings>(`${BASE}/settings`),
      ]);
      setLinks(linksData || []);
      setSettings(settingsData);
    } catch (err) {
      console.error('[LinktreeTab] Failed to load:', err);
      toast.error('Failed to load Linktree data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // --------------------------------------------------------------------------
  // CRUD
  // --------------------------------------------------------------------------

  const handleSaveLink = useCallback(async () => {
    if (!formTitle.trim() || !formUrl.trim()) {
      toast.error('Title and URL are required');
      return;
    }
    setSaving(true);
    try {
      if (editingLink) {
        await fetchJson(`${BASE}/links/${editingLink.id}`, {
          method: 'PUT',
          body: JSON.stringify({
            title: formTitle.trim(),
            url: formUrl.trim(),
            description: formDescription.trim() || undefined,
            enabled: formEnabled,
          }),
        });
        toast.success('Link updated');
      } else {
        await fetchJson(`${BASE}/links`, {
          method: 'POST',
          body: JSON.stringify({
            title: formTitle.trim(),
            url: formUrl.trim(),
            description: formDescription.trim() || undefined,
            enabled: formEnabled,
          }),
        });
        toast.success('Link created');
      }
      setEditDialog(false);
      setEditingLink(null);
      await fetchData();
    } catch (err) {
      console.error('[LinktreeTab] Save error:', err);
      toast.error('Failed to save link');
    } finally {
      setSaving(false);
    }
  }, [formTitle, formUrl, formDescription, formEnabled, editingLink, fetchData]);

  const handleQuickAdd = useCallback(async (template: QuickAddTemplate) => {
    const templateKey = `${template.title}-${template.url}`;
    setAddingTemplateId(templateKey);
    try {
      await fetchJson(`${BASE}/links`, {
        method: 'POST',
        body: JSON.stringify({
          title: template.title,
          url: template.url,
          description: template.description,
          enabled: true,
        }),
      });
      toast.success(`Added "${template.title}"`);
      await fetchData();
    } catch (err) {
      console.error('[LinktreeTab] Quick add error:', err);
      toast.error('Failed to add link');
    } finally {
      setAddingTemplateId(null);
    }
  }, [fetchData]);

  const handleDelete = useCallback(async (id: string) => {
    try {
      await fetchJson(`${BASE}/links/${id}`, { method: 'DELETE' });
      setDeleteConfirmId(null);
      toast.success('Link deleted');
      await fetchData();
    } catch {
      toast.error('Failed to delete link');
    }
  }, [fetchData]);

  const handleToggleEnabled = useCallback(async (link: LinktreeLink) => {
    try {
      await fetchJson(`${BASE}/links/${link.id}`, {
        method: 'PUT',
        body: JSON.stringify({ enabled: !link.enabled }),
      });
      await fetchData();
    } catch {
      toast.error('Failed to toggle link');
    }
  }, [fetchData]);

  const handleMove = useCallback(async (index: number, direction: 'up' | 'down') => {
    const sorted = [...links].sort((a, b) => a.order - b.order);
    const swapIndex = direction === 'up' ? index - 1 : index + 1;
    if (swapIndex < 0 || swapIndex >= sorted.length) return;

    const ids = sorted.map((l) => l.id);
    [ids[index], ids[swapIndex]] = [ids[swapIndex], ids[index]];

    try {
      await fetchJson(`${BASE}/reorder`, {
        method: 'PUT',
        body: JSON.stringify({ orderedIds: ids }),
      });
      await fetchData();
    } catch {
      toast.error('Failed to reorder');
    }
  }, [links, fetchData]);

  const handleSaveSettings = useCallback(async () => {
    setSaving(true);
    try {
      // Filter out empty social profile entries
      const cleanProfiles: Record<string, string> = {};
      for (const [key, val] of Object.entries(sSocialProfiles)) {
        if (val.trim()) cleanProfiles[key] = val.trim();
      }

      await fetchJson(`${BASE}/settings`, {
        method: 'PUT',
        body: JSON.stringify({
          title: sTitle,
          bio: sBio,
          theme: sTheme,
          socialProfiles: cleanProfiles,
        }),
      });
      setSettingsDialog(false);
      toast.success('Settings saved');
      await fetchData();
    } catch {
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  }, [sTitle, sBio, sTheme, sSocialProfiles, fetchData]);

  const openEdit = (link?: LinktreeLink) => {
    setEditingLink(link || null);
    setFormTitle(link?.title || '');
    setFormUrl(link?.url || '');
    setFormDescription(link?.description || '');
    setFormEnabled(link?.enabled ?? true);
    setEditDialog(true);
  };

  const openSettings = () => {
    if (settings) {
      setSTitle(settings.title);
      setSBio(settings.bio);
      setSTheme(settings.theme);
      setSSocialProfiles(settings.socialProfiles || {});
    }
    setSettingsDialog(true);
  };

  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(publicUrl);
    } catch {
      // Fallback for restricted permissions
      const textArea = document.createElement('textarea');
      textArea.value = publicUrl;
      textArea.style.position = 'fixed';
      textArea.style.opacity = '0';
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
    }
    setCopied(true);
    toast.success('Link copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  };

  const totalClicks = links.reduce((sum, l) => sum + l.clicks, 0);
  const sortedLinks = [...links].sort((a, b) => a.order - b.order);

  // Check which quick-add templates are already added (by URL match)
  const existingUrls = new Set(links.map((l) => l.url.toLowerCase().replace(/\/$/, '')));
  const isTemplateAdded = (template: QuickAddTemplate) =>
    existingUrls.has(template.url.toLowerCase().replace(/\/$/, ''));

  const filteredTemplates = quickAddCategory === 'all'
    ? QUICK_ADD_TEMPLATES
    : QUICK_ADD_TEMPLATES.filter((t) => t.category === quickAddCategory);

  // Social profiles configured count
  const socialProfileCount = Object.values(settings?.socialProfiles || {}).filter(Boolean).length;

  // --------------------------------------------------------------------------
  // Loading
  // --------------------------------------------------------------------------

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          <span className="ml-2 text-muted-foreground">Loading Linktree...</span>
        </CardContent>
      </Card>
    );
  }

  // --------------------------------------------------------------------------
  // Render
  // --------------------------------------------------------------------------

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className="flex items-center justify-center h-10 w-10 rounded-lg"
            style={{ backgroundColor: BRAND.navyLight }}
          >
            <LinkIcon className="h-5 w-5" style={{ color: BRAND.navy }} />
          </div>
          <div>
            <h2 className="text-xl font-semibold" style={{ color: BRAND.navy }}>
              Link in Bio
            </h2>
            <p className="text-sm text-muted-foreground">
              Manage your company links page for social media profiles
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={openSettings} className="gap-1.5">
            <Settings className="h-3.5 w-3.5" />
            Settings
          </Button>
          <Button variant="outline" size="sm" onClick={handleCopyUrl} className="gap-1.5">
            {copied ? <Check className="h-3.5 w-3.5 text-green-600" /> : <Copy className="h-3.5 w-3.5" />}
            Copy URL
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.open(publicUrl, '_blank')}
            className="gap-1.5"
          >
            <Eye className="h-3.5 w-3.5" />
            Preview
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setQuickAddOpen(true)}
            className="gap-1.5"
          >
            <Zap className="h-3.5 w-3.5" style={{ color: BRAND.gold }} />
            Quick Add
          </Button>
          <Button
            size="sm"
            onClick={() => openEdit()}
            className="gap-1.5 text-white"
            style={{ backgroundColor: BRAND.navy }}
          >
            <Plus className="h-3.5 w-3.5" />
            Add Link
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center h-9 w-9 rounded-lg bg-gray-50">
                <LinkIcon className="h-4 w-4 text-gray-500" />
              </div>
              <div>
                <p className="text-2xl font-semibold">{links.length}</p>
                <p className="text-xs text-muted-foreground">Total Links</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center h-9 w-9 rounded-lg bg-green-50">
                <Globe className="h-4 w-4 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-semibold">{links.filter((l) => l.enabled).length}</p>
                <p className="text-xs text-muted-foreground">Active Links</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center h-9 w-9 rounded-lg" style={{ backgroundColor: BRAND.goldLight }}>
                <MousePointer className="h-4 w-4" style={{ color: BRAND.gold }} />
              </div>
              <div>
                <p className="text-2xl font-semibold">{totalClicks}</p>
                <p className="text-xs text-muted-foreground">Total Clicks</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center h-9 w-9 rounded-lg bg-purple-50">
                <Instagram className="h-4 w-4 text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-semibold">{socialProfileCount}</p>
                <p className="text-xs text-muted-foreground">Social Profiles</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Public URL banner */}
      <Card className="border" style={{ borderColor: BRAND.navy + '20' }}>
        <CardContent className="py-3 px-4 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm">
            <Instagram className="h-4 w-4 text-pink-500" />
            <span className="text-muted-foreground">Your public link page:</span>
            <a
              href={publicUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium hover:underline"
              style={{ color: BRAND.navy }}
            >
              {publicUrl}
            </a>
          </div>
          <Button variant="ghost" size="sm" onClick={handleCopyUrl} className="h-7 px-2">
            {copied ? <Check className="h-3.5 w-3.5 text-green-600" /> : <Copy className="h-3.5 w-3.5" />}
          </Button>
        </CardContent>
      </Card>

      {/* Social Profiles Preview (if configured) */}
      {socialProfileCount > 0 && (
        <Card>
          <CardContent className="py-3 px-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Social profiles on public page:</span>
                <div className="flex items-center gap-1.5">
                  {SOCIAL_PLATFORMS.filter((p) => settings?.socialProfiles?.[p.key]).map((p) => (
                    <a
                      key={p.key}
                      href={settings?.socialProfiles?.[p.key]}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center h-7 w-7 rounded-lg bg-gray-50 hover:bg-gray-100 text-gray-600 hover:text-gray-900 transition-colors"
                      title={p.label}
                    >
                      {p.icon}
                    </a>
                  ))}
                </div>
              </div>
              <Button variant="ghost" size="sm" onClick={openSettings} className="h-7 text-xs text-muted-foreground">
                Edit
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Links List */}
      {sortedLinks.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div
              className="flex items-center justify-center h-12 w-12 rounded-full mb-4"
              style={{ backgroundColor: BRAND.navyLight }}
            >
              <Inbox className="h-5 w-5" style={{ color: BRAND.navy }} />
            </div>
            <h3 className="text-base font-semibold mb-1" style={{ color: BRAND.navy }}>
              No Links Yet
            </h3>
            <p className="text-sm text-muted-foreground max-w-xs mb-4">
              Add your company website, booking page, social profiles, and any other relevant links.
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={() => setQuickAddOpen(true)}
                className="gap-1.5"
              >
                <Zap className="h-4 w-4" style={{ color: BRAND.gold }} />
                Quick Add Templates
              </Button>
              <Button onClick={() => openEdit()} className="text-white" style={{ backgroundColor: BRAND.navy }}>
                <Plus className="h-4 w-4 mr-1.5" />
                Add Custom Link
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {sortedLinks.map((link, index) => (
            <Card key={link.id} className={`transition-shadow hover:shadow-sm ${!link.enabled ? 'opacity-50' : ''}`}>
              <CardContent className="py-3 px-4">
                <div className="flex items-center gap-3">
                  {/* Reorder */}
                  <div className="flex flex-col gap-0.5">
                    <button
                      onClick={() => handleMove(index, 'up')}
                      disabled={index === 0}
                      className="p-0.5 rounded hover:bg-gray-100 disabled:opacity-30 text-gray-400"
                    >
                      <ArrowUp className="h-3 w-3" />
                    </button>
                    <button
                      onClick={() => handleMove(index, 'down')}
                      disabled={index === sortedLinks.length - 1}
                      className="p-0.5 rounded hover:bg-gray-100 disabled:opacity-30 text-gray-400"
                    >
                      <ArrowDown className="h-3 w-3" />
                    </button>
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium truncate">{link.title}</p>
                      {!link.enabled && (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0">Hidden</Badge>
                      )}
                    </div>
                    <a
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-muted-foreground hover:underline truncate block"
                    >
                      {link.url}
                    </a>
                  </div>

                  {/* Clicks */}
                  <div className="text-center px-3">
                    <p className="text-sm font-semibold">{link.clicks}</p>
                    <p className="text-[10px] text-muted-foreground">clicks</p>
                  </div>

                  {/* Toggle */}
                  <Switch
                    checked={link.enabled}
                    onCheckedChange={() => handleToggleEnabled(link)}
                  />

                  {/* Actions */}
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openEdit(link)}
                      className="h-7 w-7 p-0 text-muted-foreground hover:text-gray-700"
                    >
                      <Pencil className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setDeleteConfirmId(link.id)}
                      className="h-7 w-7 p-0 text-muted-foreground hover:text-red-600"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* ================================================================== */}
      {/* Quick Add Dialog                                                    */}
      {/* ================================================================== */}
      <Dialog open={quickAddOpen} onOpenChange={setQuickAddOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5" style={{ color: BRAND.gold }} />
              Quick Add Links
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground -mt-2">
            Pre-configured templates for common Navigate Wealth links. Click to add instantly.
          </p>

          {/* Category filter */}
          <div className="flex items-center gap-1.5 py-1">
            {['all', 'website', 'social', 'contact', 'content'].map((cat) => (
              <Button
                key={cat}
                variant={quickAddCategory === cat ? 'default' : 'outline'}
                size="sm"
                className={`h-7 text-xs ${quickAddCategory === cat ? 'text-white' : ''}`}
                style={quickAddCategory === cat ? { backgroundColor: BRAND.navy } : undefined}
                onClick={() => setQuickAddCategory(cat)}
              >
                {cat === 'all' ? 'All' : CATEGORY_LABELS[cat]}
              </Button>
            ))}
          </div>

          {/* Templates grid */}
          <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
            {filteredTemplates.map((template) => {
              const added = isTemplateAdded(template);
              const templateKey = `${template.title}-${template.url}`;
              const isAdding = addingTemplateId === templateKey;

              return (
                <div
                  key={templateKey}
                  className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                    added ? 'bg-green-50/50 border-green-200/50' : 'bg-white border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div
                    className="flex items-center justify-center h-9 w-9 rounded-lg flex-shrink-0"
                    style={{ backgroundColor: added ? '#dcfce7' : BRAND.navyLight }}
                  >
                    <span style={{ color: added ? '#16a34a' : BRAND.navy }}>
                      {added ? <Check className="h-4 w-4" /> : template.icon}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{template.title}</p>
                    <p className="text-xs text-muted-foreground truncate">{template.description}</p>
                  </div>
                  {added ? (
                    <Badge variant="outline" className="text-[10px] text-green-700 border-green-300 bg-green-50">
                      Added
                    </Badge>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleQuickAdd(template)}
                      disabled={isAdding}
                      className="h-7 text-xs gap-1"
                    >
                      {isAdding ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Plus className="h-3 w-3" />
                      )}
                      Add
                    </Button>
                  )}
                </div>
              );
            })}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setQuickAddOpen(false)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ================================================================== */}
      {/* Edit / Create Dialog                                                */}
      {/* ================================================================== */}
      <Dialog open={editDialog} onOpenChange={setEditDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingLink ? 'Edit Link' : 'Add Link'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Title *</Label>
              <Input
                placeholder="e.g., Book a Consultation"
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
                maxLength={100}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">URL *</Label>
              <Input
                placeholder="https://navigatewealth.co.za/contact"
                value={formUrl}
                onChange={(e) => setFormUrl(e.target.value)}
                maxLength={500}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Description (optional)</Label>
              <Textarea
                placeholder="Brief description shown below the link"
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                rows={2}
                maxLength={200}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label className="text-sm">Visible on public page</Label>
              <Switch checked={formEnabled} onCheckedChange={setFormEnabled} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialog(false)}>Cancel</Button>
            <Button
              onClick={handleSaveLink}
              disabled={saving || !formTitle.trim() || !formUrl.trim()}
              className="text-white"
              style={{ backgroundColor: BRAND.navy }}
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : null}
              {editingLink ? 'Save Changes' : 'Add Link'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ================================================================== */}
      {/* Settings Dialog                                                     */}
      {/* ================================================================== */}
      <Dialog open={settingsDialog} onOpenChange={setSettingsDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Page Settings</DialogTitle>
          </DialogHeader>
          <div className="space-y-5 py-2">
            {/* General */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">General</h3>
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Page Title</Label>
                <Input value={sTitle} onChange={(e) => setSTitle(e.target.value)} maxLength={100} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Bio / Tagline</Label>
                <Textarea value={sBio} onChange={(e) => setSBio(e.target.value)} rows={2} maxLength={200} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Theme</Label>
                <Select value={sTheme} onValueChange={(v) => setSTheme(v as LinktreeSettings['theme'])}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="navy">Navy (Brand Default)</SelectItem>
                    <SelectItem value="gold">Gold Accent</SelectItem>
                    <SelectItem value="light">Light</SelectItem>
                    <SelectItem value="dark">Dark</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Social Profiles */}
            <div className="space-y-3">
              <div>
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Social Profiles</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Displayed as icon buttons below your bio on the public page
                </p>
              </div>
              {SOCIAL_PLATFORMS.map((platform) => (
                <div key={platform.key} className="flex items-center gap-2">
                  <div
                    className="flex items-center justify-center h-8 w-8 rounded-lg flex-shrink-0"
                    style={{ backgroundColor: BRAND.navyLight }}
                  >
                    <span style={{ color: BRAND.navy }}>{platform.icon}</span>
                  </div>
                  <Input
                    placeholder={platform.placeholder}
                    value={sSocialProfiles[platform.key] || ''}
                    onChange={(e) =>
                      setSSocialProfiles((prev) => ({
                        ...prev,
                        [platform.key]: e.target.value,
                      }))
                    }
                    className="flex-1 text-sm"
                  />
                  {sSocialProfiles[platform.key] && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 text-muted-foreground hover:text-red-500"
                      onClick={() =>
                        setSSocialProfiles((prev) => {
                          const next = { ...prev };
                          delete next[platform.key];
                          return next;
                        })
                      }
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSettingsDialog(false)}>Cancel</Button>
            <Button
              onClick={handleSaveSettings}
              disabled={saving}
              className="text-white"
              style={{ backgroundColor: BRAND.navy }}
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : null}
              Save Settings
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ================================================================== */}
      {/* Delete Confirmation                                                 */}
      {/* ================================================================== */}
      <Dialog open={!!deleteConfirmId} onOpenChange={() => setDeleteConfirmId(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Delete Link</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            Are you sure you want to delete this link? This cannot be undone.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirmId(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => deleteConfirmId && handleDelete(deleteConfirmId)}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
