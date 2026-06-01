/**
 * External Form Templates - upload PDFs, map fields, fill from client data.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { FileUp, Loader2, Sparkles } from 'lucide-react';
import { Link } from 'react-router';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../ui/card';
import { Button } from '../../../ui/button';
import { Input } from '../../../ui/input';
import { Label } from '../../../ui/label';
import { Badge } from '../../../ui/badge';
import { Checkbox } from '../../../ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../../ui/table';
import { Alert, AlertDescription } from '../../../ui/alert';
import type {
  FormTemplateRecord,
  TemplatePrefillResolveResponse,
} from '../../../../shared/form-prefill/types';
import {
  autoMapTemplateFields,
  TEMPLATE_MAPPING_OPTIONS,
} from '../../../../shared/form-prefill/template-field-mapping';
import {
  fillFormTemplate,
  listFormTemplates,
  previewTemplatePrefill,
  updateTemplateMappings,
  uploadFormTemplate,
} from '../../../../services/form-prefill-api';
import { PrefillReviewModal } from './PrefillReviewModal';
import { ClientPicker } from '../resources/components/ClientPicker';
import { projectId } from '../../../../utils/supabase/info';

interface ClientOption {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
}

interface FormTemplatesModuleProps {
  selectedClientId?: string;
}

export function FormTemplatesModule({
  selectedClientId: selectedClientIdProp,
}: FormTemplatesModuleProps) {
  const [templates, setTemplates] = useState<FormTemplateRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [name, setName] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [prefillResult, setPrefillResult] = useState<TemplatePrefillResolveResponse | null>(null);
  const [prefillLoading, setPrefillLoading] = useState(false);
  const [selectedClient, setSelectedClient] = useState<ClientOption | null>(null);
  const [attachToDocuments, setAttachToDocuments] = useState(true);
  const [linkedClientLabel, setLinkedClientLabel] = useState<string | null>(null);

  const effectiveClientId = selectedClientIdProp ?? selectedClient?.id;

  useEffect(() => {
    if (!selectedClientIdProp) {
      setLinkedClientLabel(null);
      return;
    }

    let cancelled = false;
    void (async () => {
      try {
        const storageKey = `sb-${projectId}-auth-token`;
        const stored = localStorage.getItem(storageKey);
        const token = stored ? JSON.parse(stored).access_token : '';
        if (!token) return;

        const res = await fetch(
          `https://${projectId}.supabase.co/functions/v1/make-server-91ed8379/profile/all-users`,
          { headers: { Authorization: `Bearer ${token}` } },
        );
        if (!res.ok) return;
        const data = await res.json();
        const match = (data.users ?? []).find((u: { id: string }) => u.id === selectedClientIdProp);
        if (cancelled || !match) return;
        const first =
          match.user_metadata?.firstName ||
          match.profile?.personalInformation?.firstName ||
          match.name?.split(' ')[0] ||
          'Client';
        const last =
          match.user_metadata?.surname ||
          match.profile?.personalInformation?.lastName ||
          match.name?.split(' ').slice(1).join(' ') ||
          '';
        setLinkedClientLabel(`${first} ${last}`.trim());
      } catch {
        if (!cancelled) setLinkedClientLabel(null);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [selectedClientIdProp]);

  const loadTemplates = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listFormTemplates();
      setTemplates(data);
      if (data[0] && !selectedTemplateId) setSelectedTemplateId(data[0].id);
    } catch {
      toast.error('Failed to load form templates');
    } finally {
      setLoading(false);
    }
  }, [selectedTemplateId]);

  useEffect(() => {
    void loadTemplates();
  }, [loadTemplates]);

  const selectedTemplate = templates.find((template) => template.id === selectedTemplateId) ?? null;
  const mappedFieldCount =
    selectedTemplate?.fields.filter((field) => Boolean(field.canonicalKey)).length ?? 0;

  const handleUpload = async () => {
    if (!file || !name.trim()) {
      toast.error('Provide a template name and PDF file');
      return;
    }

    setUploading(true);
    try {
      const base64Content = await fileToBase64(file);
      const created = await uploadFormTemplate({
        name: name.trim(),
        fileName: file.name,
        mimeType: file.type || 'application/pdf',
        base64Content,
      });
      const autoAssignedCount = created.fields.filter((field) =>
        Boolean(field.canonicalKey),
      ).length;
      toast.success(
        `Template uploaded - auto-assigned ${autoAssignedCount} of ${created.fields.length} field(s)`,
      );
      setName('');
      setFile(null);
      setSelectedTemplateId(created.id);
      await loadTemplates();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleAutoMap = async () => {
    if (!selectedTemplate) return;

    const { fields } = autoMapTemplateFields(selectedTemplate.fields, { onlyUnmapped: true });
    const assignedCount = fields.reduce((count, field, index) => {
      const previous = selectedTemplate.fields[index];
      return !previous?.canonicalKey && field.canonicalKey ? count + 1 : count;
    }, 0);

    if (assignedCount === 0) {
      toast.message('No additional field matches found');
      return;
    }

    try {
      const updated = await updateTemplateMappings(selectedTemplate.id, fields);
      setTemplates((prev) =>
        prev.map((template) => (template.id === updated.id ? updated : template)),
      );
      toast.success(`Auto-assigned ${assignedCount} field(s)`);
    } catch {
      toast.error('Failed to auto-assign fields');
    }
  };

  const handleMappingChange = async (fieldId: string, canonicalKey: string) => {
    if (!selectedTemplate) return;

    const fields = selectedTemplate.fields.map((field) =>
      field.id === fieldId ? { ...field, canonicalKey } : field,
    );

    try {
      const updated = await updateTemplateMappings(selectedTemplate.id, fields);
      setTemplates((prev) =>
        prev.map((template) => (template.id === updated.id ? updated : template)),
      );
      toast.success('Field mapping saved');
    } catch {
      toast.error('Failed to save mapping');
    }
  };

  const handleFillPreview = async () => {
    if (!selectedTemplate || !effectiveClientId) {
      toast.error('Select a client before previewing a template fill');
      return;
    }

    setPrefillLoading(true);
    setReviewOpen(true);
    try {
      const preview = await previewTemplatePrefill(selectedTemplate.id, effectiveClientId);
      setPrefillResult(preview);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Preview failed');
      setReviewOpen(false);
    } finally {
      setPrefillLoading(false);
    }
  };

  const downloadFilledPdf = async () => {
    if (!selectedTemplate || !effectiveClientId) return;

    try {
      const result = await fillFormTemplate(selectedTemplate.id, effectiveClientId, {
        attachToDocuments,
      });
      const link = document.createElement('a');
      link.href = `data:application/pdf;base64,${result.filledBase64}`;
      link.download = result.fileName;
      link.click();
      const attachMsg = result.attachedDocument ? ' and attached to client documents' : '';
      toast.success(`Filled ${result.filledFields.length} field(s)${attachMsg}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Fill failed');
    }
  };

  const templateReviewResult = prefillResult
    ? {
        formId: 'retirement-fna-step1' as const,
        clientId: prefillResult.clientId,
        matches: prefillResult.matches,
        unmatchedFormFields: prefillResult.unmatchedFormFields,
        proposedValues: Object.fromEntries(
          prefillResult.matches.map((match) => [match.formField, match.proposedValue]),
        ),
        resolverVersion: prefillResult.resolverVersion,
      }
    : null;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <FileUp className="h-5 w-5" />
            Form Template Library
          </CardTitle>
          <CardDescription>
            Upload insurer or provider PDFs once, auto-assign obvious fields, then fine-tune any
            exceptions.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {selectedClientIdProp && (
            <Alert className="border-purple-100 bg-purple-50/40">
              <Sparkles className="h-4 w-4 text-purple-600" />
              <AlertDescription className="text-sm">
                Filling for{' '}
                <span className="font-medium">{linkedClientLabel ?? 'selected client'}</span> (from
                client drawer).{' '}
                <Link
                  to={`/admin?module=clients&clientId=${encodeURIComponent(selectedClientIdProp)}`}
                  className="font-medium text-primary hover:underline"
                >
                  Open client record
                </Link>
              </AlertDescription>
            </Alert>
          )}

          {!selectedClientIdProp && (
            <div className="space-y-2">
              <Label>Client for fill / preview</Label>
              <ClientPicker
                selectedClient={selectedClient}
                onSelect={(client) => setSelectedClient(client as ClientOption | null)}
              />
            </div>
          )}

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="template-name">Template name</Label>
              <Input
                id="template-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="template-file">PDF file</Label>
              <Input
                id="template-file"
                type="file"
                accept="application/pdf,.pdf"
                onChange={(event) => setFile(event.target.files?.[0] ?? null)}
              />
            </div>
          </div>
          <Button onClick={() => void handleUpload()} disabled={uploading}>
            {uploading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <FileUp className="mr-2 h-4 w-4" />
            )}
            Upload template
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Mapping studio</CardTitle>
          <CardDescription>
            The tool now auto-assigns what it can on upload, and you can re-run it for older
            templates.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading templates...
            </div>
          ) : templates.length === 0 ? (
            <p className="text-sm text-muted-foreground">No templates uploaded yet.</p>
          ) : (
            <>
              <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select template" />
                </SelectTrigger>
                <SelectContent>
                  {templates.map((template) => (
                    <SelectItem key={template.id} value={template.id}>
                      {template.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {selectedTemplate && (
                <>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={selectedTemplate.status === 'ready' ? 'default' : 'outline'}>
                      {selectedTemplate.status}
                    </Badge>
                    <Badge variant="secondary">{selectedTemplate.fields.length} fields</Badge>
                    <Badge variant="outline">
                      {mappedFieldCount}/{selectedTemplate.fields.length} mapped
                    </Badge>
                    <Button size="sm" variant="outline" onClick={() => void handleAutoMap()}>
                      <Sparkles className="mr-1 h-4 w-4" />
                      Auto-assign unmapped
                    </Button>
                    {effectiveClientId && (
                      <Button size="sm" variant="outline" onClick={() => void handleFillPreview()}>
                        <Sparkles className="mr-1 h-4 w-4" />
                        Preview client fill
                      </Button>
                    )}
                    {effectiveClientId && (
                      <Button size="sm" onClick={() => void downloadFilledPdf()}>
                        Download filled PDF
                      </Button>
                    )}
                  </div>

                  <label className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={attachToDocuments}
                      onCheckedChange={(value) => setAttachToDocuments(value === true)}
                    />
                    Attach filled PDF to client documents when downloading
                  </label>

                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>PDF field</TableHead>
                        <TableHead>Client data key</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedTemplate.fields.map((field) => (
                        <TableRow key={field.id}>
                          <TableCell>{field.label}</TableCell>
                          <TableCell>
                            <Select
                              value={field.canonicalKey ?? '__none__'}
                              onValueChange={(value) =>
                                void handleMappingChange(
                                  field.id,
                                  value === '__none__' ? '' : value,
                                )
                              }
                            >
                              <SelectTrigger className="h-8">
                                <SelectValue placeholder="Map to client data" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="__none__">Not mapped</SelectItem>
                                {TEMPLATE_MAPPING_OPTIONS.map((option) => (
                                  <SelectItem key={option.canonicalKey} value={option.canonicalKey}>
                                    {option.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <PrefillReviewModal
        open={reviewOpen}
        onOpenChange={setReviewOpen}
        loading={prefillLoading}
        result={templateReviewResult}
        clientId={effectiveClientId}
        previewOnly
        onApply={() => undefined}
        onSkip={() => setReviewOpen(false)}
      />
    </div>
  );
}

async function fileToBase64(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  let binary = '';
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}
