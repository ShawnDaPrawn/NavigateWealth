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

import { useState, useCallback, useEffect } from 'react';
import { Card, CardContent } from '../../../ui/card';
import { Button } from '../../../ui/button';
import { Badge } from '../../../ui/badge';
import { Input } from '../../../ui/input';
import { Label } from '../../../ui/label';
import { Textarea } from '../../../ui/textarea';
import { Switch } from '../../../ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../../../ui/dialog';
import { ErrorState, FormErrorBanner, StatCard, useConfirm } from '../../layout/page';
import { Skeleton } from '../../../ui/skeleton';
import { toast } from 'sonner';
import {
  Plus,
  Pencil,
  Trash2,
  Eye,
  Copy,
  Check,
  Loader2,
  ArrowUp,
  ArrowDown,
  Settings,
  Inbox,
  Zap,
} from 'lucide-react';
import { normalizeNavigateWealthUrl } from '../../../../utils/siteOrigin';
import { BRAND } from './constants';
import {
  QUICK_ADD_TEMPLATES,
  SOCIAL_PLATFORMS,
  BASE,
  fetchJson,
  type LinktreeLink,
  type LinktreeSettings,
  type QuickAddTemplate,
  validateLinkForm,
} from './linktree/linktreeModel';
import { QuickAddDialog } from './linktree/QuickAddDialog';
import { LinktreeSettingsDialog } from './linktree/LinktreeSettingsDialog';

export function LinktreeTab() {
  const [links, setLinks] = useState<LinktreeLink[]>([]);
  const [settings, setSettings] = useState<LinktreeSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Dialog state
  const [editDialog, setEditDialog] = useState(false);
  const [editingLink, setEditingLink] = useState<LinktreeLink | null>(null);
  const [settingsDialog, setSettingsDialog] = useState(false);
  const [copied, setCopied] = useState(false);
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [quickAddCategory, setQuickAddCategory] = useState<string>('all');
  const [addingTemplateId, setAddingTemplateId] = useState<string | null>(null);

  // Form state
  const [formTitle, setFormTitle] = useState('');
  const [formUrl, setFormUrl] = useState('');
  const [formErrors, setFormErrors] = useState<{ title?: string; url?: string }>({});
  const { confirm, confirmDialog } = useConfirm();
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

  const [loadError, setLoadError] = useState<string | null>(null);
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setLoadError(null);
      const [linksData, settingsData] = await Promise.all([
        fetchJson<LinktreeLink[]>(`${BASE}/links`),
        fetchJson<LinktreeSettings>(`${BASE}/settings`),
      ]);
      setLinks(linksData || []);
      setSettings(settingsData);
    } catch (err) {
      console.error('[LinktreeTab] Failed to load:', err);
      setLoadError(err instanceof Error ? err.message : 'Failed to load the link page');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // --------------------------------------------------------------------------
  // CRUD
  // --------------------------------------------------------------------------

  const handleSaveLink = useCallback(async () => {
    const errors = validateLinkForm(formTitle, formUrl);
    setFormErrors(errors);
    if (errors.title || errors.url) {
      document.getElementById(errors.title ? 'link-title' : 'link-url')?.focus();
      return;
    }
    setSaving(true);
    try {
      if (editingLink) {
        await fetchJson(`${BASE}/links/${editingLink.id}`, {
          method: 'PUT',
          body: JSON.stringify({
            title: formTitle.trim(),
            url: normalizeNavigateWealthUrl(formUrl),
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
            url: normalizeNavigateWealthUrl(formUrl),
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

  const handleQuickAdd = useCallback(
    async (template: QuickAddTemplate) => {
      const templateKey = `${template.title}-${template.url}`;
      setAddingTemplateId(templateKey);
      try {
        await fetchJson(`${BASE}/links`, {
          method: 'POST',
          body: JSON.stringify({
            title: template.title,
            url: normalizeNavigateWealthUrl(template.url),
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
    },
    [fetchData],
  );

  const handleDelete = useCallback(
    async (id: string) => {
      try {
        await fetchJson(`${BASE}/links/${id}`, { method: 'DELETE' });
        toast.success('Link deleted');
        await fetchData();
      } catch {
        toast.error('Failed to delete link');
      }
    },
    [fetchData],
  );

  const handleToggleEnabled = useCallback(
    async (link: LinktreeLink) => {
      try {
        await fetchJson(`${BASE}/links/${link.id}`, {
          method: 'PUT',
          body: JSON.stringify({ enabled: !link.enabled }),
        });
        await fetchData();
      } catch {
        toast.error('Failed to toggle link');
      }
    },
    [fetchData],
  );

  const handleMove = useCallback(
    async (index: number, direction: 'up' | 'down') => {
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
    },
    [links, fetchData],
  );

  const handleSaveSettings = useCallback(async () => {
    setSaving(true);
    try {
      // Filter out empty social profile entries
      const cleanProfiles: Record<string, string> = {};
      for (const [key, val] of Object.entries(sSocialProfiles)) {
        if (val.trim()) cleanProfiles[key] = normalizeNavigateWealthUrl(val);
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
    setFormErrors({});
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

  const filteredTemplates =
    quickAddCategory === 'all'
      ? QUICK_ADD_TEMPLATES
      : QUICK_ADD_TEMPLATES.filter((t) => t.category === quickAddCategory);

  // Social profiles configured count
  const socialProfileCount = Object.values(settings?.socialProfiles || {}).filter(Boolean).length;

  // --------------------------------------------------------------------------
  // Loading
  // --------------------------------------------------------------------------

  if (loading) {
    return (
      <div aria-busy="true" aria-label="Loading link in bio" className="space-y-3">
        <Skeleton className="h-9 w-full rounded-lg" />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-14 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  if (loadError) {
    return (
      <ErrorState
        title="Unable to load your link page"
        onRetry={() => void fetchData()}
        details={loadError}
      />
    );
  }

  // --------------------------------------------------------------------------
  // Render
  // --------------------------------------------------------------------------

  return (
    <div className="space-y-6">
      {/* Public page + actions */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2 text-sm">
          <span className="text-nw-text-3">Your public link page:</span>
          <a
            href={publicUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="truncate font-medium text-nw-ink hover:underline"
          >
            {publicUrl}
          </a>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleCopyUrl} className="gap-1.5">
            {copied ? (
              <Check className="h-3.5 w-3.5 text-green-600" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
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
          <Button variant="outline" size="sm" onClick={openSettings} className="gap-1.5">
            <Settings className="h-3.5 w-3.5" />
            Settings
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setQuickAddOpen(true)}
            className="gap-1.5"
          >
            <Zap className="h-3.5 w-3.5" style={{ color: BRAND.gold }} />
            Quick add
          </Button>
          <Button size="sm" onClick={() => openEdit()} className="gap-1.5">
            <Plus className="h-3.5 w-3.5" />
            Add link
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Total links" value={links.length} />
        <StatCard label="Active links" value={links.filter((l) => l.enabled).length} />
        <StatCard label="Total clicks" value={totalClicks} />
        <StatCard label="Social profiles" value={socialProfileCount} />
      </div>

      {/* Social Profiles Preview (if configured) */}
      {socialProfileCount > 0 && (
        <Card>
          <CardContent className="py-3 px-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">
                  Social profiles on public page:
                </span>
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
              <Button
                variant="ghost"
                size="sm"
                onClick={openSettings}
                className="h-7 text-xs text-muted-foreground"
              >
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
              No links yet
            </h3>
            <p className="text-sm text-muted-foreground max-w-xs mb-4">
              Add your website, booking page, social profiles and any other links.
            </p>
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={() => setQuickAddOpen(true)} className="gap-1.5">
                <Zap className="h-4 w-4" style={{ color: BRAND.gold }} />
                Quick add
              </Button>
              <Button onClick={() => openEdit()}>
                <Plus className="h-4 w-4 mr-1.5" />
                Add link
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {sortedLinks.map((link, index) => (
            <Card
              key={link.id}
              className={`transition-shadow hover:shadow-sm ${!link.enabled ? 'opacity-50' : ''}`}
            >
              <CardContent className="py-3 px-4">
                <div className="flex items-center gap-3">
                  {/* Reorder */}
                  <div className="flex flex-col gap-0.5">
                    <button
                      type="button"
                      aria-label={`Move ${link.title} up`}
                      onClick={() => handleMove(index, 'up')}
                      disabled={index === 0}
                      className="p-0.5 rounded hover:bg-gray-100 disabled:opacity-30 text-gray-400"
                    >
                      <ArrowUp className="h-3 w-3" />
                    </button>
                    <button
                      type="button"
                      aria-label={`Move ${link.title} down`}
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
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                          Hidden
                        </Badge>
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
                    aria-label={`Show ${link.title} on the public page`}
                    checked={link.enabled}
                    onCheckedChange={() => handleToggleEnabled(link)}
                  />

                  {/* Actions */}
                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openEdit(link)}
                      className="h-7"
                    >
                      <Pencil className="h-3 w-3" aria-hidden="true" />
                      Edit
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      aria-label={`Delete ${link.title}`}
                      onClick={async () => {
                        const ok = await confirm({
                          title: 'Delete link',
                          description: `Are you sure you want to delete “${link.title}”? This cannot be undone.`,
                          confirmLabel: 'Delete',
                          destructive: true,
                        });
                        if (ok) void handleDelete(link.id);
                      }}
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
      <QuickAddDialog
        open={quickAddOpen}
        onOpenChange={setQuickAddOpen}
        quickAddCategory={quickAddCategory}
        setQuickAddCategory={setQuickAddCategory}
        filteredTemplates={filteredTemplates}
        isTemplateAdded={isTemplateAdded}
        addingTemplateId={addingTemplateId}
        onQuickAdd={handleQuickAdd}
      />
      {/* ================================================================== */}
      {/* Edit / Create Dialog                                                */}
      {/* ================================================================== */}
      <Dialog open={editDialog} onOpenChange={setEditDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingLink ? 'Edit link' : 'Add link'}</DialogTitle>
            {!editingLink && (
              <button
                type="button"
                className="w-fit text-left text-sm text-nw-violet-600 hover:underline"
                onClick={() => {
                  setEditDialog(false);
                  setQuickAddOpen(true);
                }}
              >
                Or start from a Quick add template
              </button>
            )}
          </DialogHeader>
          <div className="space-y-4 py-2">
            <FormErrorBanner
              count={(formErrors.title ? 1 : 0) + (formErrors.url ? 1 : 0)}
              action={editingLink ? 'save the link' : 'add the link'}
            />
            <div className="space-y-1.5">
              <Label htmlFor="link-title" className="text-sm font-medium">
                Title *
              </Label>
              <Input
                id="link-title"
                placeholder="e.g., Book a consultation"
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
                maxLength={100}
                aria-invalid={Boolean(formErrors.title)}
                aria-describedby={formErrors.title ? 'link-title-error' : undefined}
              />
              {formErrors.title && (
                <p id="link-title-error" className="text-xs text-red-600">
                  {formErrors.title}
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="link-url" className="text-sm font-medium">
                URL *
              </Label>
              <Input
                id="link-url"
                placeholder="https://www.navigatewealth.co/contact"
                value={formUrl}
                onChange={(e) => setFormUrl(e.target.value)}
                maxLength={500}
                aria-invalid={Boolean(formErrors.url)}
                aria-describedby={formErrors.url ? 'link-url-error' : undefined}
              />
              {formErrors.url && (
                <p id="link-url-error" className="text-xs text-red-600">
                  {formErrors.url}
                </p>
              )}
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
              <Label htmlFor="link-visible" className="text-sm">
                Visible on public page
              </Label>
              <Switch id="link-visible" checked={formEnabled} onCheckedChange={setFormEnabled} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveLink} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : null}
              {editingLink ? 'Save changes' : 'Add link'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ================================================================== */}
      {/* Settings Dialog                                                     */}
      {/* ================================================================== */}
      <LinktreeSettingsDialog
        open={settingsDialog}
        onOpenChange={setSettingsDialog}
        sTitle={sTitle}
        setSTitle={setSTitle}
        sBio={sBio}
        setSBio={setSBio}
        sTheme={sTheme}
        setSTheme={setSTheme}
        sSocialProfiles={sSocialProfiles}
        setSSocialProfiles={setSSocialProfiles}
        saving={saving}
        onSave={handleSaveSettings}
      />

      {confirmDialog}
    </div>
  );
}
