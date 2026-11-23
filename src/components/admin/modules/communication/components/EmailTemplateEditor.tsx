import { useState, useEffect, useCallback } from 'react';
import ReactQuill from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';
import { Button } from '../../../../ui/button';
import { Input } from '../../../../ui/input';
import { Label } from '../../../../ui/label';
import { Switch } from '../../../../ui/switch';
import { Card, CardContent } from '../../../../ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../../../ui/tabs';
import { Loader2, ChevronLeft, Save, RefreshCw, Eye, ZoomIn, ZoomOut } from 'lucide-react';
import { renderEmailLayout } from '@/shared/email/emailLayout';
import { communicationApi } from '../api';
import { EmailTemplate, EmailFooterSettings } from '../types';
import { toast } from 'sonner';
import { EmailPreviewFrame, EmailSchemeToggle, type EmailPreviewScheme } from './EmailPreviewFrame';

interface EmailTemplateEditorProps {
  templateId: string;
  onBack: () => void;
}

/** Example values for merge fields, so the preview reads like a real email. */
const PREVIEW_SAMPLE: Record<string, string> = {
  Name: 'John Doe',
  FirstName: 'John',
  RecipientName: 'John Doe',
  SenderName: 'Navigate Wealth',
};

/** `{{ .Name }}` → sample text; any `…Link` / `…Url` → '#'; anything else is left visible. */
function fillSample(value: string | undefined): string {
  return (value ?? '').replace(/\{\{\s*\.([A-Za-z0-9_]+)\s*\}\}/g, (match, key: string) => {
    if (PREVIEW_SAMPLE[key]) return PREVIEW_SAMPLE[key];
    if (/(Link|Url|URL)$/.test(key)) return '#';
    return match;
  });
}

export function EmailTemplateEditor({ templateId, onBack }: EmailTemplateEditorProps) {
  const [template, setTemplate] = useState<EmailTemplate | null>(null);
  const [footerSettings, setFooterSettings] = useState<EmailFooterSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('edit');
  const [scale, setScale] = useState(0.9);
  const [scheme, setScheme] = useState<EmailPreviewScheme>('light');

  const loadTemplate = useCallback(async () => {
    setLoading(true);
    try {
      const [templateData, footerData] = await Promise.all([
        communicationApi.getTemplate(templateId),
        communicationApi.getFooterSettings(),
      ]);
      setTemplate(templateData);
      setFooterSettings(footerData);
    } catch (error) {
      toast.error('Failed to load template');
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, [templateId]);

  useEffect(() => {
    loadTemplate();
  }, [templateId, loadTemplate]);

  const handleSave = async () => {
    if (!template) return;
    setSaving(true);
    try {
      await communicationApi.saveTemplate(template);
      toast.success('Template saved successfully');
    } catch (error) {
      toast.error('Failed to save template');
      console.error(error);
    } finally {
      setSaving(false);
    }
  };

  /** The real layout, as the server sends it, with this template and the saved footer. */
  const generatePreview = () => {
    if (!template) return '';
    return renderEmailLayout({
      title: fillSample(template.title),
      subtitle: fillSample(template.subtitle),
      greeting: fillSample(template.greeting),
      bodyHtml: fillSample(template.bodyHtml),
      buttonUrl: fillSample(template.buttonUrl),
      buttonLabel: fillSample(template.buttonLabel),
      footerNote: fillSample(template.footerNote),
      footer: footerSettings,
    });
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary mb-2" />
        <p className="text-muted-foreground">Loading template...</p>
      </div>
    );
  }

  if (!template) {
    return (
      <div className="space-y-4">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex w-fit items-center gap-1 rounded text-sm text-nw-text-2 hover:text-nw-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nw-violet/60"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          Back to transactional emails
        </button>
        <p>Template not found</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <div>
          <button
            type="button"
            onClick={onBack}
            className="inline-flex w-fit items-center gap-1 rounded text-sm text-nw-text-2 hover:text-nw-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nw-violet/60"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
            Back to transactional emails
          </button>
        </div>
        <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-end sm:justify-between border-b pb-6 mt-2">
          <div>
            <h1 className="text-[26px] leading-tight font-semibold tracking-tight text-nw-ink">
              {template.name}
            </h1>
            <p className="text-muted-foreground mt-1">
              Customize the content and settings for this email
            </p>
          </div>
          <div className="flex items-center gap-3 pb-1">
            <div className="flex items-center gap-2 mr-4 bg-muted/50 px-3 py-1.5 rounded-lg border">
              <Switch
                checked={!!template.enabled}
                onCheckedChange={(checked) => setTemplate({ ...template, enabled: checked })}
                id="enabled-mode"
              />
              <Label htmlFor="enabled-mode" className="text-sm cursor-pointer font-medium">
                {template.enabled ? 'Enabled' : 'Disabled'}
              </Label>
            </div>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Save changes
            </Button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-[calc(100vh-280px)]">
        <div className="flex flex-col h-full overflow-hidden">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
            <TabsList className="w-full">
              <TabsTrigger value="edit">Edit Content</TabsTrigger>
              <TabsTrigger value="settings">Settings & Meta</TabsTrigger>
            </TabsList>

            <TabsContent
              value="edit"
              className="flex-1 flex flex-col mt-4 min-h-0 space-y-4 overflow-y-auto pr-2"
            >
              <Card>
                <CardContent className="pt-6 space-y-4">
                  <div className="space-y-2">
                    <Label>Greeting</Label>
                    <Input
                      value={template.greeting}
                      onChange={(e) => setTemplate({ ...template, greeting: e.target.value })}
                      placeholder="e.g. Hi {{ .Name }},"
                    />
                    <p className="text-xs text-muted-foreground">
                      Available variables: <code>{'{{ .Name }}'}</code>
                    </p>
                  </div>

                  <div className="space-y-2 flex-1 flex flex-col">
                    <Label>Email Body (Rich Text)</Label>
                    <div className="editor-container h-[400px]">
                      <ReactQuill
                        theme="snow"
                        value={template.bodyHtml}
                        onChange={(value) => setTemplate({ ...template, bodyHtml: value })}
                        className="h-[350px]"
                        modules={{
                          toolbar: [
                            [{ header: [1, 2, 3, false] }],
                            ['bold', 'italic', 'underline', 'strike'],
                            [{ list: 'ordered' }, { list: 'bullet' }],
                            ['link', 'clean'],
                          ],
                        }}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6 space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Button Label</Label>
                      <Input
                        value={template.buttonLabel}
                        onChange={(e) => setTemplate({ ...template, buttonLabel: e.target.value })}
                        placeholder="e.g. Get Started"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Button URL</Label>
                      <Input
                        value={template.buttonUrl}
                        onChange={(e) => setTemplate({ ...template, buttonUrl: e.target.value })}
                        placeholder="e.g. {{ .Link }}"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Footer Note</Label>
                    <Input
                      value={template.footerNote}
                      onChange={(e) => setTemplate({ ...template, footerNote: e.target.value })}
                      placeholder="Small text under the button"
                    />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="settings" className="mt-4 space-y-4">
              <Card>
                <CardContent className="pt-6 space-y-4">
                  <div className="space-y-2">
                    <Label>Email Subject Line</Label>
                    <Input
                      value={template.subject}
                      onChange={(e) => setTemplate({ ...template, subject: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Header Title</Label>
                    <Input
                      value={template.title}
                      onChange={(e) => setTemplate({ ...template, title: e.target.value })}
                      placeholder="e.g. Welcome to Navigate Wealth"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Subtitle</Label>
                    <Input
                      value={template.subtitle}
                      onChange={(e) => setTemplate({ ...template, subtitle: e.target.value })}
                      placeholder="e.g. We are glad to have you"
                    />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        {/* Live Preview */}
        <div className="hidden lg:flex flex-col h-full bg-gray-100 rounded-xl border overflow-hidden">
          <div className="p-3 bg-white border-b flex items-center justify-between">
            <span className="text-sm font-medium flex items-center text-muted-foreground">
              <Eye className="h-4 w-4 mr-2" />
              Live Preview
            </span>
            <div className="flex items-center gap-1 flex-wrap">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setScale((s) => Math.max(0.5, s - 0.1))}
                disabled={scale <= 0.5}
                aria-label="Zoom out"
              >
                <ZoomOut className="h-4 w-4" />
              </Button>
              <span className="text-xs text-muted-foreground w-12 text-center">
                {Math.round(scale * 100)}%
              </span>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setScale((s) => Math.min(1.5, s + 0.1))}
                disabled={scale >= 1.5}
                aria-label="Zoom in"
              >
                <ZoomIn className="h-4 w-4" />
              </Button>
              <div className="w-px h-4 bg-border mx-1" aria-hidden="true" />
              <EmailSchemeToggle value={scheme} onChange={setScheme} />
              <div className="w-px h-4 bg-border mx-1" aria-hidden="true" />
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setTemplate({ ...template })}
                aria-label="Refresh preview"
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <div className="flex-1 overflow-auto p-4 flex items-start justify-center bg-gray-50/50">
            <EmailPreviewFrame
              html={generatePreview()}
              scheme={scheme}
              scale={scale}
              title="Email Preview"
              className="w-auto shrink-0 overflow-hidden rounded-xl shadow-xl"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
