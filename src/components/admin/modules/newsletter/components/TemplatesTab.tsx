/**
 * Newsletter Studio — reusable campaign templates.
 * Templates seed new campaigns (subject + body with merge fields).
 */
import { useState } from 'react';
import DOMPurify from 'dompurify';
import { FileText, Loader2, Pencil, Plus, Trash2 } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '../../../../ui/alert-dialog';
import { Button } from '../../../../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../../../ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../../../ui/dialog';
import { Input } from '../../../../ui/input';
import { Label } from '../../../../ui/label';
import { Textarea } from '../../../../ui/textarea';
import {
  useDeleteTemplate,
  useSaveTemplate,
  useStudioTemplates,
} from '../hooks/useNewsletterStudio';
import type { NewsletterStudioTemplate } from '../types';

export function TemplatesTab() {
  const { data: templates = [], isLoading } = useStudioTemplates();
  const saveTemplate = useSaveTemplate();
  const deleteTemplate = useDeleteTemplate();

  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<NewsletterStudioTemplate | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [subject, setSubject] = useState('');
  const [bodyHtml, setBodyHtml] = useState('');

  const openEditor = (template: NewsletterStudioTemplate | null) => {
    setEditing(template);
    setName(template?.name ?? '');
    setDescription(template?.description ?? '');
    setSubject(template?.subject ?? '');
    setBodyHtml(template?.bodyHtml ?? '');
    setEditorOpen(true);
  };

  const handleSave = async () => {
    await saveTemplate.mutateAsync({
      id: editing?.id,
      input: {
        name: name.trim(),
        description: description.trim() || undefined,
        subject: subject.trim() || undefined,
        bodyHtml,
      },
    });
    setEditorOpen(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Reusable starting points for campaigns — merge fields like{' '}
          <code className="rounded bg-muted px-1 py-0.5">{'{{firstName}}'}</code> are personalized
          per recipient at send time.
        </p>
        <Button onClick={() => openEditor(null)}>
          <Plus className="mr-1 h-4 w-4" aria-hidden /> New template
        </Button>
      </div>

      {isLoading ? (
        <p className="py-10 text-center text-sm text-muted-foreground">Loading templates…</p>
      ) : templates.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            <FileText className="mx-auto mb-2 h-8 w-8 opacity-40" aria-hidden />
            No templates yet. Create one to speed up recurring campaigns.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {templates.map((template) => (
            <Card key={template.id} className="flex flex-col">
              <CardHeader className="pb-2">
                <CardTitle className="truncate text-base">{template.name}</CardTitle>
                {template.description ? (
                  <p className="line-clamp-2 text-xs text-muted-foreground">
                    {template.description}
                  </p>
                ) : null}
              </CardHeader>
              <CardContent className="flex flex-1 flex-col gap-3">
                <div
                  className="pointer-events-none h-32 flex-1 overflow-hidden rounded-md border bg-background p-2 text-xs [&_*]:!max-w-full"
                  // Sanitized preview of admin-authored template HTML.
                  dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(template.bodyHtml) }}
                />
                <div className="flex items-center justify-end gap-2">
                  <Button variant="outline" size="sm" onClick={() => openEditor(template)}>
                    <Pencil className="mr-1 h-3.5 w-3.5" aria-hidden /> Edit
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="outline" size="sm">
                        <Trash2 className="mr-1 h-3.5 w-3.5" aria-hidden /> Delete
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete "{template.name}"?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Campaigns already created from it are unaffected.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Keep it</AlertDialogCancel>
                        <AlertDialogAction onClick={() => deleteTemplate.mutate(template.id)}>
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit template' : 'New template'}</DialogTitle>
            <DialogDescription>
              HTML body with optional merge fields. Campaigns started from this template can still
              be edited freely.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="nl-template-name">Name</Label>
                <Input
                  id="nl-template-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={200}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="nl-template-subject">Default subject</Label>
                <Input
                  id="nl-template-subject"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  maxLength={300}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="nl-template-description">Description</Label>
              <Input
                id="nl-template-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={500}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="nl-template-body">Body HTML</Label>
              <Textarea
                id="nl-template-body"
                value={bodyHtml}
                onChange={(e) => setBodyHtml(e.target.value)}
                rows={12}
                className="font-mono text-xs"
                placeholder={'<h2>Hi {{firstName}},</h2>\n<p>…</p>'}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditorOpen(false)}>
              Close
            </Button>
            <Button
              onClick={handleSave}
              disabled={saveTemplate.isPending || !name.trim() || !bodyHtml.trim()}
            >
              {saveTemplate.isPending ? (
                <Loader2 className="mr-1 h-4 w-4 animate-spin" aria-hidden />
              ) : null}
              Save template
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
