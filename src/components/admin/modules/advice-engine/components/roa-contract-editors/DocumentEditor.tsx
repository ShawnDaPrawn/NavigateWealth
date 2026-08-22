/**
 * DocumentEditor — Document sections and their runtime templates.
 *
 * Extracted verbatim from RoAModuleContractManager.tsx (2,125 lines). Behaviour
 * unchanged; only the imports are new.
 */
import React from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '../../../../../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../../../../ui/card';
import { Input } from '../../../../../ui/input';
import { Label } from '../../../../../ui/label';
import { Textarea } from '../../../../../ui/textarea';
import { renderRuntimeTemplate } from '../../roaModuleRuntime';
import type { RoAModuleContract } from '../../types';
import {
  TOKEN_EXAMPLES,
  getSampleTemplateContext,
  getTemplateIssues,
  getTemplateTokenOptions,
  toId,
} from '../roaContractHelpers';
import type { DocumentSection } from '../roaContractHelpers';
import { TokenPicker } from './TokenPicker';

export function DocumentEditor({
  draft,
  updateDraft,
}: {
  draft: RoAModuleContract;
  updateDraft: (updater: (current: RoAModuleContract) => RoAModuleContract) => void;
}) {
  const textareaRefs = React.useRef<Record<number, HTMLTextAreaElement | null>>({});
  const tokenOptions = React.useMemo(() => getTemplateTokenOptions(draft), [draft]);
  const sampleContext = React.useMemo(() => getSampleTemplateContext(draft), [draft]);
  const templateIssues = React.useMemo(() => getTemplateIssues(draft), [draft]);

  const updateSection = (index: number, patch: Partial<DocumentSection>) =>
    updateDraft((current) => {
      const documentSections = [...current.documentSections];
      documentSections[index] = { ...documentSections[index], ...patch };
      const compileOrder = [...documentSections]
        .sort((a, b) => a.order - b.order)
        .map((section) => section.id)
        .filter(Boolean);
      return {
        ...current,
        documentSections,
        compileOrder,
      };
    });

  const insertToken = (index: number, token: string) => {
    const textarea = textareaRefs.current[index];
    const current = draft.documentSections[index]?.template || '';
    const start = textarea?.selectionStart ?? current.length;
    const end = textarea?.selectionEnd ?? current.length;
    const next = `${current.slice(0, start)}${token}${current.slice(end)}`;
    updateSection(index, { template: next });
    window.setTimeout(() => {
      textarea?.focus();
      const cursor = start + token.length;
      textarea?.setSelectionRange(cursor, cursor);
    }, 0);
  };

  return (
    <div className="space-y-4">
      {templateIssues.length > 0 && (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          <div className="font-medium">Publish checks</div>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {templateIssues.slice(0, 6).map((issue) => (
              <li key={issue}>{issue}</li>
            ))}
          </ul>
        </div>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="text-base">Document Sections</CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                updateDraft((current) => ({
                  ...current,
                  documentSections: [
                    ...current.documentSections,
                    {
                      id: `section_${current.documentSections.length + 1}`,
                      title: 'New Section',
                      purpose: '',
                      order: (current.documentSections.length + 1) * 10,
                      required: true,
                      template: '## New Section\n{{module.rationale}}',
                    },
                  ],
                }))
              }
            >
              <Plus className="h-4 w-4 mr-2" />
              Section
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="rounded-md border bg-muted/30 p-3">
            <div className="text-sm font-medium">Common tokens</div>
            <div className="mt-2 flex flex-wrap gap-2">
              {TOKEN_EXAMPLES.map((token) => (
                <code key={token} className="rounded border bg-background px-2 py-1 text-xs">
                  {token}
                </code>
              ))}
            </div>
          </div>
          {draft.documentSections.map((section, index) => (
            <div
              key={`${section.id}-${index}`}
              className="grid gap-3 rounded-md border p-3 md:grid-cols-[120px_1fr_1fr_auto_auto]"
            >
              <Input
                type="number"
                value={section.order}
                onChange={(event) => updateSection(index, { order: Number(event.target.value) })}
              />
              <Input
                value={section.id}
                onChange={(event) => updateSection(index, { id: toId(event.target.value) })}
              />
              <Input
                value={section.title}
                onChange={(event) => updateSection(index, { title: event.target.value })}
              />
              <Button
                variant={section.required ? 'default' : 'outline'}
                onClick={() => updateSection(index, { required: !section.required })}
              >
                Required
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() =>
                  updateDraft((current) => ({
                    ...current,
                    documentSections: current.documentSections.filter(
                      (_, itemIndex) => itemIndex !== index,
                    ),
                  }))
                }
              >
                <Trash2 className="h-4 w-4" />
              </Button>
              <Textarea
                value={section.purpose}
                onChange={(event) => updateSection(index, { purpose: event.target.value })}
                className="md:col-span-5 min-h-[70px]"
              />
              <div className="space-y-2 md:col-span-5">
                <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
                  <Label>Output Template</Label>
                  <TokenPicker
                    tokens={tokenOptions}
                    onInsert={(token) => insertToken(index, token)}
                  />
                </div>
                <Textarea
                  ref={(node) => {
                    textareaRefs.current[index] = node;
                  }}
                  value={section.template}
                  onChange={(event) => updateSection(index, { template: event.target.value })}
                  className="min-h-[180px] font-mono text-xs"
                  placeholder="Use safe tokens like {{client.displayName}} and {{module.rationale}}"
                />
              </div>
              <div className="space-y-2 md:col-span-5">
                <Label>Live Preview</Label>
                <pre className="max-h-72 overflow-auto whitespace-pre-wrap rounded-md border bg-muted/20 p-3 text-sm leading-relaxed">
                  {renderRuntimeTemplate(section.template || section.purpose, sampleContext)}
                </pre>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
