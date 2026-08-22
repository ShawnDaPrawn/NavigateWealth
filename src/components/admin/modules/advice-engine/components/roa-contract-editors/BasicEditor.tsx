/**
 * BasicEditor — Identity, status and metadata for a contract.
 *
 * Extracted verbatim from RoAModuleContractManager.tsx (2,125 lines). Behaviour
 * unchanged; only the imports are new.
 */
import { Card, CardContent, CardHeader, CardTitle } from '../../../../../ui/card';
import { Checkbox } from '../../../../../ui/checkbox';
import { Input } from '../../../../../ui/input';
import { Label } from '../../../../../ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../../../ui/select';
import { Textarea } from '../../../../../ui/textarea';
import type { RoAAuthoringMode, RoAModuleContract } from '../../types';
import { DEFAULT_CONVERSATION_CONFIG, toId } from '../roaContractHelpers';

export function BasicEditor({
  draft,
  updateDraft,
}: {
  draft: RoAModuleContract;
  updateDraft: (updater: (current: RoAModuleContract) => RoAModuleContract) => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Basic Information</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="contract-title">Title</Label>
          <Input
            id="contract-title"
            value={draft.title}
            onChange={(event) =>
              updateDraft((current) => ({ ...current, title: event.target.value }))
            }
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="contract-id">Module ID</Label>
          <Input
            id="contract-id"
            value={draft.id}
            onChange={(event) =>
              updateDraft((current) => ({ ...current, id: toId(event.target.value) }))
            }
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="contract-category">Category</Label>
          <Input
            id="contract-category"
            value={draft.category}
            onChange={(event) =>
              updateDraft((current) => ({ ...current, category: event.target.value }))
            }
          />
        </div>
        <div className="space-y-2">
          <Label>Status</Label>
          <Select
            value={draft.status}
            onValueChange={(value) =>
              updateDraft((current) => ({
                ...current,
                status: value as RoAModuleContract['status'],
              }))
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="archived">Archived</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Authoring Mode</Label>
          <Select
            value={draft.authoringMode ?? 'conversation'}
            onValueChange={(value) =>
              updateDraft((current) => {
                const mode = value as RoAAuthoringMode;
                if (mode === 'conversation') {
                  return {
                    ...current,
                    authoringMode: 'conversation',
                    conversation: current.conversation ?? DEFAULT_CONVERSATION_CONFIG,
                  };
                }
                return { ...current, authoringMode: 'form' };
              })
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="conversation">AI Conversation</SelectItem>
              <SelectItem value="form">Form</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Conversation modules are completed via an AI chat. Form modules use the legacy field
            builder.
          </p>
        </div>
        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="contract-description">Description</Label>
          <Textarea
            id="contract-description"
            value={draft.description}
            onChange={(event) =>
              updateDraft((current) => ({ ...current, description: event.target.value }))
            }
            className="min-h-[90px]"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="contract-schema-version">Contract schema version</Label>
          <Input
            id="contract-schema-version"
            value={draft.schemaVersion}
            onChange={(event) =>
              updateDraft((current) => ({
                ...current,
                schemaVersion: event.target.value.trim() || '1.0',
              }))
            }
          />
        </div>
        <div className="flex flex-col gap-4 md:col-span-2">
          <div className="flex items-start gap-3 rounded-lg border bg-muted/20 p-3">
            <Checkbox
              id="contract-flagship"
              checked={draft.metadata?.flagshipModule === true}
              className="mt-0.5"
              onCheckedChange={(checked) =>
                updateDraft((current) => ({
                  ...current,
                  metadata: { ...(current.metadata || {}), flagshipModule: checked === true },
                }))
              }
            />
            <div className="space-y-1">
              <Label
                htmlFor="contract-flagship"
                className="cursor-pointer font-medium leading-none"
              >
                Flagship module
              </Label>
              <p className="text-xs text-muted-foreground">
                Surfaces first in the adviser RoA library with a flagship badge during module
                selection.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3 rounded-lg border bg-muted/20 p-3">
            <Checkbox
              id="contract-replacement-compile"
              checked={draft.compilerHints?.includeReplacementAnalysis === true}
              className="mt-0.5"
              onCheckedChange={(checked) =>
                updateDraft((current) => ({
                  ...current,
                  compilerHints:
                    checked === true ? { includeReplacementAnalysis: true } : undefined,
                }))
              }
            />
            <div className="space-y-1">
              <Label
                htmlFor="contract-replacement-compile"
                className="cursor-pointer font-medium leading-none"
              >
                Include replacement-analysis section when compiling
              </Label>
              <p className="text-xs text-muted-foreground">
                Adds a heightened-care replacement narrative to the canonical RoA when this module
                participates in a compilation.
              </p>
            </div>
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="normalized-key">Normalized Output Key</Label>
          <Input
            id="normalized-key"
            value={draft.output.normalizedKey}
            onChange={(event) =>
              updateDraft((current) => ({
                ...current,
                output: { ...current.output, normalizedKey: event.target.value },
              }))
            }
          />
        </div>
        <div className="space-y-2">
          <Label>Gathering Methods</Label>
          <Input
            value={draft.input.gatheringMethods.join(', ')}
            onChange={(event) =>
              updateDraft((current) => ({
                ...current,
                input: {
                  ...current.input,
                  gatheringMethods: event.target.value
                    .split(',')
                    .map((value) => value.trim())
                    .filter(Boolean) as RoAModuleContract['input']['gatheringMethods'],
                },
              }))
            }
          />
        </div>
      </CardContent>
    </Card>
  );
}
