/**
 * TemplatePanel — the supplier's "invoice standard".
 *
 * Upload an example invoice, run the AI analysis to extract a template spec,
 * compare the example and the rendered template side by side, browse/activate
 * versions, and hand-tune the spec in the editor.
 */

import { useMemo, useRef, useState } from 'react';
import { FileText, Pencil, Sparkles, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '../../../../../ui/badge';
import { Button } from '../../../../../ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../../../ui/card';
import { ALLOWED_FILE_ACCEPT, MAX_FILE_BYTES } from '../constants';
import {
  useAnalyzeTemplate,
  useActivateTemplate,
  useExampleInvoiceUrl,
  useSupplierLogoUrl,
  useUploadExampleInvoice,
} from '../hooks/useSuppliers';
import type { Supplier, SupplierTemplate } from '../types';
import { sampleInvoiceData } from '../invoiceMath';
import { InvoicePreview } from './InvoicePreview';
import { TemplateEditorDialog } from './TemplateEditorDialog';

interface TemplatePanelProps {
  supplier: Supplier;
  templates: SupplierTemplate[];
}

export function TemplatePanel({ supplier, templates }: TemplatePanelProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const uploadExample = useUploadExampleInvoice();
  const analyze = useAnalyzeTemplate();
  const activate = useActivateTemplate();
  const { data: example } = useExampleInvoiceUrl(supplier.id, Boolean(supplier.exampleInvoice));
  const { data: logoUrl } = useSupplierLogoUrl(supplier.id, Boolean(supplier.logo));

  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);

  const selectedTemplate = useMemo(
    () =>
      templates.find((t) => t.id === (selectedTemplateId ?? supplier.activeTemplateId)) ??
      templates[0] ??
      null,
    [templates, selectedTemplateId, supplier.activeTemplateId],
  );

  const sampleData = useMemo(() => sampleInvoiceData(supplier), [supplier]);

  const handleExampleFile = (file: File | undefined) => {
    if (!file) return;
    if (file.size > MAX_FILE_BYTES) {
      toast.error('File exceeds the 10MB limit');
      return;
    }
    uploadExample.mutate({ supplierId: supplier.id, file });
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Example Invoice</CardTitle>
          <CardDescription>
            Upload a real invoice from this supplier, then let the AI derive an invoice standard
            matching its look, feel and layout. The file is sent to the AI provider for analysis.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-3">
          <input
            ref={fileRef}
            type="file"
            accept={ALLOWED_FILE_ACCEPT}
            className="hidden"
            onChange={(e) => {
              handleExampleFile(e.target.files?.[0]);
              e.target.value = '';
            }}
          />
          <Button
            type="button"
            variant="outline"
            onClick={() => fileRef.current?.click()}
            disabled={uploadExample.isPending}
          >
            <Upload className="h-4 w-4 mr-2" />
            {uploadExample.isPending
              ? 'Uploading…'
              : supplier.exampleInvoice
                ? 'Replace Example'
                : 'Upload Example'}
          </Button>
          {supplier.exampleInvoice ? (
            <span className="text-sm text-muted-foreground inline-flex items-center gap-1">
              <FileText className="h-4 w-4" />
              {supplier.exampleInvoice.fileName}
            </span>
          ) : null}
          <Button
            type="button"
            onClick={() => analyze.mutate(supplier.id)}
            disabled={!supplier.exampleInvoice || analyze.isPending}
          >
            <Sparkles className="h-4 w-4 mr-2" />
            {analyze.isPending ? 'Analyzing…' : 'Analyze with AI'}
          </Button>
          {analyze.isPending ? (
            <span className="text-sm text-muted-foreground">
              Reading the example invoice — this can take up to a minute…
            </span>
          ) : null}
        </CardContent>
      </Card>

      {templates.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Template Versions</CardTitle>
            <CardDescription>
              Each analysis or manual edit creates a new version. Invoices keep the version they
              were created with.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {templates.map((template) => {
              const isActive = template.id === supplier.activeTemplateId;
              const isSelected = template.id === selectedTemplate?.id;
              return (
                <div
                  key={template.id}
                  className={`flex flex-wrap items-center gap-2 rounded-lg border p-3 cursor-pointer ${
                    isSelected ? 'border-primary bg-primary/5' : ''
                  }`}
                  onClick={() => setSelectedTemplateId(template.id)}
                >
                  <span className="font-medium">v{template.version}</span>
                  <Badge variant={template.source === 'ai' ? 'default' : 'secondary'}>
                    {template.source === 'ai' ? 'AI' : 'Manual'}
                  </Badge>
                  {isActive ? <Badge variant="outline">Active</Badge> : null}
                  {template.aiMeta ? (
                    <span className="text-xs text-muted-foreground">
                      {Math.round(template.aiMeta.confidence * 100)}% confidence ·{' '}
                      {template.aiMeta.model}
                    </span>
                  ) : null}
                  <span className="text-xs text-muted-foreground ml-auto">
                    {new Date(template.createdAt).toLocaleString()}
                  </span>
                  {!isActive ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={activate.isPending}
                      onClick={(e) => {
                        e.stopPropagation();
                        activate.mutate({ supplierId: supplier.id, templateId: template.id });
                      }}
                    >
                      Activate
                    </Button>
                  ) : null}
                </div>
              );
            })}
            {selectedTemplate?.aiMeta?.notes ? (
              <p className="text-xs text-muted-foreground border-l-2 border-primary/40 pl-3 mt-2">
                AI notes on v{selectedTemplate.version}: {selectedTemplate.aiMeta.notes}
              </p>
            ) : null}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            No template yet — upload an example invoice and run the AI analysis, or start from the
            default layout in the editor below.
          </CardContent>
        </Card>
      )}

      <div className="flex items-center gap-2">
        <Button type="button" variant="outline" onClick={() => setEditorOpen(true)}>
          <Pencil className="h-4 w-4 mr-2" />
          {selectedTemplate ? 'Adjust Template' : 'Create Template Manually'}
        </Button>
        <p className="text-xs text-muted-foreground">
          Fine-tune colours, labels and layout when the AI likeness isn't exact.
        </p>
      </div>

      {/* Side-by-side: uploaded example vs the rendered template with sample data. */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Original Example</CardTitle>
          </CardHeader>
          <CardContent>
            {example?.url ? (
              example.contentType === 'application/pdf' ? (
                <iframe
                  src={example.url}
                  title="Example invoice"
                  className="w-full h-[560px] rounded border"
                />
              ) : (
                <img
                  src={example.url}
                  alt="Example invoice"
                  className="max-w-full rounded border"
                />
              )
            ) : (
              <p className="text-sm text-muted-foreground py-10 text-center">
                Upload an example invoice to compare.
              </p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Rendered Template{selectedTemplate ? ` (v${selectedTemplate.version})` : ''}
            </CardTitle>
          </CardHeader>
          <CardContent className="overflow-auto">
            {selectedTemplate ? (
              <InvoicePreview
                spec={selectedTemplate.spec}
                supplier={supplier}
                data={sampleData}
                logoUrl={logoUrl}
                scale={0.55}
              />
            ) : (
              <p className="text-sm text-muted-foreground py-10 text-center">
                No template to preview yet.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <TemplateEditorDialog
        open={editorOpen}
        onOpenChange={setEditorOpen}
        supplier={supplier}
        baseTemplate={selectedTemplate}
        logoUrl={logoUrl}
      />
    </div>
  );
}
