import { useState, useEffect } from 'react';
import { Settings, Mail, Edit, Loader2, Bell, Megaphone } from 'lucide-react';
import { Button } from '../../../../ui/button';
import { Switch } from '../../../../ui/switch';
import { Badge } from '../../../../ui/badge';
import { Separator } from '../../../../ui/separator';
import { EmailTemplateEditor } from './EmailTemplateEditor';
import { GlobalFooterEditor } from './GlobalFooterEditor';
import { communicationApi } from '../api';
import { EmailTemplate } from '../types';
import { toast } from 'sonner';
import { Crumbs } from './Crumbs';
import { useRecordInUrl } from '../../../layout/page';

/** The address value for the global footer editor (?edit=footer). */
const FOOTER_EDIT_ID = 'footer';

interface TransactionalEmailsManagerProps {
  /**
   * Called with true while an editor (a template or the global footer) is
   * open as a page of its own, so the module can hide its header and tabs.
   */
  onEditorPageChange?: (open: boolean) => void;
}

export function TransactionalEmailsManager({
  onEditorPageChange,
}: TransactionalEmailsManagerProps) {
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  const [isEditingFooter, setIsEditingFooter] = useState(false);
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTemplates();
  }, []);

  // The open editor is in the address (?edit=<templateId> or ?edit=footer).
  useRecordInUrl('edit', isEditingFooter ? FOOTER_EDIT_ID : editingTemplateId, {
    ready: !loading,
    openFromUrl: (id) => {
      if (id === FOOTER_EDIT_ID) {
        setIsEditingFooter(true);
        return 'opened';
      }
      if (loading) return 'waiting';
      if (!templates.some((t) => t.id === id)) {
        toast.error('Email template not found');
        return 'missing';
      }
      setEditingTemplateId(id);
      return 'opened';
    },
    closeFromUrl: () => {
      setIsEditingFooter(false);
      setEditingTemplateId(null);
    },
  });

  const editorOpen = isEditingFooter || !!editingTemplateId;
  useEffect(() => {
    onEditorPageChange?.(editorOpen);
  }, [editorOpen, onEditorPageChange]);

  const loadTemplates = async () => {
    setLoading(true);
    try {
      const data = await communicationApi.getAllTemplates();
      setTemplates(data);
    } catch (error) {
      toast.error('Failed to load email templates');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = async (id: string, currentEnabled: boolean) => {
    const newEnabled = !currentEnabled;
    // Optimistic update
    setTemplates((prev) => prev.map((t) => (t.id === id ? { ...t, enabled: newEnabled } : t)));

    try {
      await communicationApi.toggleTemplate(id, newEnabled);
      toast.success(`Email type ${newEnabled ? 'enabled' : 'disabled'}`);
    } catch (_error) {
      // Revert on error
      setTemplates((prev) =>
        prev.map((t) => (t.id === id ? { ...t, enabled: currentEnabled } : t)),
      );
      toast.error('Failed to update setting');
    }
  };

  const generalTemplate = templates.find((t) => t.id === 'general_campaign');
  const systemTemplates = templates.filter((t) => t.id !== 'general_campaign');

  const backToList = { label: 'Transactional emails', onClick: () => setEditingTemplateId(null) };

  if (isEditingFooter) {
    return (
      <>
        <Crumbs
          trail={[
            { label: 'Transactional emails', onClick: () => setIsEditingFooter(false) },
            { label: 'Global footer' },
          ]}
        />
        <GlobalFooterEditor onBack={() => setIsEditingFooter(false)} />
      </>
    );
  }

  if (editingTemplateId) {
    return (
      <>
        <Crumbs
          trail={[
            backToList,
            { label: templates.find((t) => t.id === editingTemplateId)?.name || 'Template' },
          ]}
        />
        <EmailTemplateEditor
          templateId={editingTemplateId}
          onBack={() => {
            setEditingTemplateId(null);
            loadTemplates(); // Reload to get updates
          }}
        />
      </>
    );
  }

  return (
    <div className="space-y-8">
      <Crumbs trail={[{ label: 'Transactional emails' }]} />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-nw-ink">Email settings &amp; templates</h2>
          <p className="text-sm text-nw-text-3">
            System notifications and the base template every bulk email uses.
          </p>
        </div>
        <Button variant="outline" onClick={() => setIsEditingFooter(true)}>
          <Settings className="h-4 w-4" aria-hidden="true" />
          Global footer settings
        </Button>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center h-64 border rounded-lg bg-gray-50/50">
          <Loader2 className="h-8 w-8 animate-spin text-primary mb-2" />
          <p className="text-muted-foreground">Loading settings…</p>
        </div>
      ) : (
        <div className="space-y-10">
          {/* General Communication Section */}
          <section>
            <div className="flex items-center gap-2 mb-4">
              <Megaphone className="h-5 w-5 text-primary" />
              <h3 className="text-lg font-semibold text-gray-900">General communication</h3>
            </div>
            <div className="grid grid-cols-1">
              {generalTemplate && (
                <div className="flex items-center justify-between p-4 border rounded-lg bg-white hover:border-primary/50 transition-colors shadow-sm">
                  <div className="flex items-center gap-4">
                    <div className="h-10 w-10 rounded-lg bg-blue-50 flex items-center justify-center shrink-0 text-blue-600">
                      <Settings className="h-5 w-5" />
                    </div>
                    <div>
                      <h4 className="font-medium text-gray-900">{generalTemplate.name}</h4>
                      <p className="text-sm text-muted-foreground">
                        Base template for marketing campaigns and bulk emails
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setEditingTemplateId(generalTemplate.id)}
                    >
                      <Edit className="h-3.5 w-3.5 mr-2" />
                      Manage template
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* System Notifications Section */}
          <section>
            <div className="flex items-center gap-2 mb-4">
              <Bell className="h-5 w-5 text-primary" />
              <h3 className="text-lg font-semibold text-gray-900">System notifications</h3>
            </div>
            <div className="grid grid-cols-1 gap-3">
              {systemTemplates.map((template) => (
                <div
                  key={template.id}
                  className="flex items-center justify-between p-4 border rounded-lg bg-white hover:border-primary/50 transition-colors shadow-sm group"
                >
                  <div className="flex items-center gap-4 min-w-0 flex-1 mr-4">
                    <div
                      className={`h-10 w-10 rounded-lg flex items-center justify-center shrink-0 ${
                        template.enabled
                          ? 'bg-primary/10 text-primary'
                          : 'bg-gray-100 text-gray-400'
                      }`}
                    >
                      <Mail className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <h4
                          className={`font-medium truncate ${template.enabled ? 'text-gray-900' : 'text-gray-500'}`}
                        >
                          {template.name}
                        </h4>
                        {!template.enabled && (
                          <Badge
                            variant="secondary"
                            className="text-[10px] h-5 px-1.5 bg-gray-100 text-gray-500"
                          >
                            Disabled
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground truncate">{template.subject}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-6 shrink-0">
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={!!template.enabled}
                        onCheckedChange={() => handleToggle(template.id, template.enabled)}
                        id={`toggle-${template.id}`}
                      />
                    </div>
                    <Separator orientation="vertical" className="h-6" />
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setEditingTemplateId(template.id)}
                      className="text-muted-foreground hover:text-primary"
                    >
                      <Edit className="h-4 w-4" />
                      <span className="sr-only">Edit {template.name}</span>
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
