import React, { useState, useEffect } from 'react';
import ReactQuill from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';
import { Button } from '../../../../ui/button';
import { Input } from '../../../../ui/input';
import { Label } from '../../../../ui/label';
import { Switch } from '../../../../ui/switch';
import { Card, CardContent } from '../../../../ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../../../ui/tabs';
import { Loader2, ArrowLeft, Save, RefreshCw, Eye, ZoomIn, ZoomOut } from 'lucide-react';
import { communicationApi } from '../api';
import { EmailTemplate, EmailFooterSettings } from '../types';
import { toast } from 'sonner@2.0.3';

interface EmailTemplateEditorProps {
  templateId: string;
  onBack: () => void;
}

const BASE_TEMPLATE = `<!DOCTYPE html>
<html lang="en" style="margin:0; padding:0;">
  <head>
    <meta charset="UTF-8" />
    <title>{{ .Title }} - Navigate Wealth</title>
    <meta name="color-scheme" content="light dark">
    <meta name="supported-color-schemes" content="light dark">
    <style>
      @media (prefers-color-scheme: dark) {
        body.email-body { background-color: #020617 !important; }
        table.email-card { background-color: #020617 !important; border-color: #1f2937 !important; }
        .email-text, .email-heading, .email-footer { color: #e5e7eb !important; }
        .email-muted { color: #9ca3af !important; }
        .email-link { color: #a855f7 !important; }
        .email-button { background-color: #8b5cf6 !important; }
      }
    </style>
  </head>
  <body class="email-body" style="background-color:#f3f4f6; margin:0; padding:40px 0; font-family: Arial, sans-serif;">
    <table align="center" width="600" cellpadding="0" cellspacing="0" class="email-card" style="background-color:#ffffff; border-radius:12px; border:1px solid #e5e7eb; padding:0; text-align:center; font-family: Arial, sans-serif; box-shadow:0 8px 20px rgba(15,23,42,0.10);">
      <tr><td style="height:5px; background:linear-gradient(90deg,#6d28d9,#a855f7,#6d28d9); border-radius:12px 12px 0 0;"></td></tr>
      <tr>
        <td style="padding:30px 32px 24px 32px;">
          <div style="margin-bottom:20px;">
            <span style="font-size:24px; font-weight:bold; color:#000000;">Navigate</span>
            <span style="font-size:24px; font-weight:bold; color:#6d28d9;">Wealth</span>
          </div>
          <div class="email-heading" style="font-size:16px; font-weight:bold; color:#111827; margin-bottom:8px;">{{ .Title }}</div>
          <div class="email-muted" style="font-size:14px; color:#6b7280; margin-bottom:20px;">{{ .Subtitle }}</div>
          <div class="email-text" style="font-size:14px; color:#374151; line-height:1.6; text-align:left; margin:0 auto 8px auto; max-width:100%;">{{ .Greeting }}</div>
          <div class="email-text" style="font-size:14px; color:#374151; line-height:1.6; text-align:left; margin:0 auto 18px auto; max-width:100%;">
            {{ .BodyHtml }}
          </div>
          {{ if .ButtonURL }}
          <p style="text-align:center; margin:10px 0 6px 0;">
            <a href="{{ .ButtonURL }}" class="email-button" style="display:inline-block; background-color:#6d28d9; color:#ffffff; padding:10px 20px; text-decoration:none; border-radius:999px; font-weight:bold; font-size:14px; font-family: Arial, sans-serif;">{{ .ButtonLabel }}</a>
          </p>
          {{ end }}
          {{ if .FooterNote }}
          <div class="email-text" style="font-size:12px; color:#6b7280; line-height:1.6; margin-top:10px; text-align:center;">{{ .FooterNote }}</div>
          {{ end }}
        </td>
      </tr>
      <tr><td style="padding:0 32px;"><hr style="border:none; border-top:1px solid #e5e7eb; margin:0;"></td></tr>
      <tr>
        <td class="email-footer" style="padding:18px 32px 24px 32px; font-size:12px; color:#6b7280; line-height:1.6; text-align:center;">
          {{ .FooterContent }}
        </td>
      </tr>
    </table>
  </body>
</html>`;

export function EmailTemplateEditor({ templateId, onBack }: EmailTemplateEditorProps) {
  const [template, setTemplate] = useState<EmailTemplate | null>(null);
  const [footerSettings, setFooterSettings] = useState<EmailFooterSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('edit');
  const [scale, setScale] = useState(0.9);

  useEffect(() => {
    loadTemplate();
  }, [templateId]);

  const loadTemplate = async () => {
    setLoading(true);
    try {
      const [templateData, footerData] = await Promise.all([
        communicationApi.getTemplate(templateId),
        communicationApi.getFooterSettings()
      ]);
      setTemplate(templateData);
      setFooterSettings(footerData);
    } catch (error) {
      toast.error('Failed to load template');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

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

  const generatePreview = () => {
    if (!template) return '';
    
    let html = BASE_TEMPLATE
      .replace('{{ .Title }}', template.title || '') // Header title
      .replace('{{ .Title }}', template.title || '') // Meta title
      .replace('{{ .Subtitle }}', template.subtitle || '')
      .replace('{{ .Greeting }}', template.greeting || '')
      .replace('{{ .BodyHtml }}', template.bodyHtml || '')
      .replace('{{ .ButtonLabel }}', template.buttonLabel || '')
      .replace('{{ .ButtonURL }}', template.buttonUrl || '')
      .replace('{{ .FooterNote }}', template.footerNote || '')
      .replace('{{ .Year }}', new Date().getFullYear().toString());

    // Handle conditional rendering for button
    if (!template.buttonUrl) {
        // Remove button block if no URL
        html = html.replace(/{{ if .ButtonURL }}[\s\S]*?{{ end }}/, '');
    } else {
        html = html.replace('{{ if .ButtonURL }}', '').replace('{{ end }}', '');
    }

    // Handle conditional rendering for footer note
    if (!template.footerNote) {
        html = html.replace(/{{ if .FooterNote }}[\s\S]*?{{ end }}/, '');
    } else {
        html = html.replace('{{ if .FooterNote }}', '').replace('{{ end }}', '');
    }

    // Build footer content from settings
    let footerHtml = '';
    if (footerSettings) {
        const socialLinksHtml = footerSettings.socialLinks
            ? Object.entries(footerSettings.socialLinks)
                .filter(([_, url]) => url)
                .map(([platform, url]) => {
                    const label = platform.charAt(0).toUpperCase() + platform.slice(1);
                    return `<a href="${url}" class="email-link" style="color:#6d28d9; text-decoration:none; margin: 0 5px;">${label}</a>`;
                })
                .join(' | ')
            : '';

        const socialSection = socialLinksHtml 
            ? `<p style="margin:12px 0 0;"><strong>Follow us:</strong><br />${socialLinksHtml}</p>`
            : '';

        const copyright = footerSettings.copyrightText.replace('{{Year}}', new Date().getFullYear().toString());
        
        const emailLink = footerSettings.contactEmail 
            ? `<p style="margin:8px 0 0;">Email: <a href="mailto:${footerSettings.contactEmail}" class="email-link" style="color:#6d28d9; text-decoration:none;">${footerSettings.contactEmail}</a></p>`
            : '';

        footerHtml = `
          <p style="margin:0;"><strong>${footerSettings.companyName}</strong><br />Independent Financial Advisory Services</p>
          <p style="margin:8px 0 0;">${footerSettings.address}</p>
          ${emailLink}
          ${socialSection}
          <p style="margin:12px 0 0;" class="email-muted">${copyright}</p>
        `;
    }

    html = html.replace('{{ .FooterContent }}', footerHtml);

    // Simple variable substitution for preview
    html = html.replace(/{{ .Name }}/g, 'John Doe');
    html = html.replace(/{{ .InviteLink }}/g, '#');
    html = html.replace(/{{ .DashboardLink }}/g, '#');
    html = html.replace(/{{ .ApplicationLink }}/g, '#');
    html = html.replace(/{{ .ResetLink }}/g, '#');

    return html;
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary mb-2" />
        <p className="text-muted-foreground">Loading template...</p>
      </div>
    );
  }

  if (!template) return <div>Template not found</div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <div>
          <Button variant="ghost" size="sm" onClick={onBack} className="-ml-2 text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Templates
          </Button>
        </div>
        <div className="flex items-end justify-between border-b pb-6 mt-2">
          <div>
            <h2 className="text-3xl font-bold tracking-tight">{template.name}</h2>
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
              {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
              Save Changes
            </Button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-[calc(100vh-280px)]">
        <div className="flex flex-col h-full overflow-hidden">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="edit">Edit Content</TabsTrigger>
              <TabsTrigger value="settings">Settings & Meta</TabsTrigger>
            </TabsList>
            
            <TabsContent value="edit" className="flex-1 flex flex-col mt-4 min-h-0 space-y-4 overflow-y-auto pr-2">
              <Card>
                <CardContent className="pt-6 space-y-4">
                  <div className="space-y-2">
                    <Label>Greeting</Label>
                    <Input 
                      value={template.greeting} 
                      onChange={(e) => setTemplate({ ...template, greeting: e.target.value })}
                      placeholder="e.g. Hi {{ .Name }},"
                    />
                    <p className="text-xs text-muted-foreground">Available variables: <code>{'{{ .Name }}'}</code></p>
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
                            [{ 'header': [1, 2, 3, false] }],
                            ['bold', 'italic', 'underline', 'strike'],
                            [{ 'list': 'ordered'}, { 'list': 'bullet' }],
                            ['link', 'clean']
                          ],
                        }}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6 space-y-4">
                   <div className="grid grid-cols-2 gap-4">
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
            <div className="flex items-center gap-1">
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => setScale(s => Math.max(0.5, s - 0.1))}
                disabled={scale <= 0.5}
                aria-label="Zoom out"
              >
                <ZoomOut className="h-4 w-4" />
              </Button>
              <span className="text-xs text-muted-foreground w-12 text-center">{Math.round(scale * 100)}%</span>
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => setScale(s => Math.min(1.5, s + 0.1))}
                disabled={scale >= 1.5}
                aria-label="Zoom in"
              >
                <ZoomIn className="h-4 w-4" />
              </Button>
              <div className="w-px h-4 bg-border mx-1" aria-hidden="true" />
              <Button variant="ghost" size="icon" onClick={() => setTemplate({...template})} aria-label="Refresh preview">
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <div className="flex-1 overflow-auto p-4 flex items-start justify-center bg-gray-50/50">
             <div 
               style={{ 
                 width: `${600 * scale}px`,
                 height: `${1000 * scale}px`,
                 transition: 'width 0.2s, height 0.2s'
               }}
               className="relative shrink-0"
             >
               <div 
                 className="absolute top-0 left-0 w-[600px] h-[1000px] bg-white shadow-xl rounded-xl overflow-hidden transition-transform duration-200"
                 style={{ 
                   transform: `scale(${scale})`,
                   transformOrigin: 'top left'
                 }}
               >
                  <iframe 
                    srcDoc={generatePreview()}
                    className="w-full h-full border-none"
                    title="Email Preview"
                  />
               </div>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
}