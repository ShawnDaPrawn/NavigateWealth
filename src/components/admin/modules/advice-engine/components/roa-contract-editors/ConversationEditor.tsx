/**
 * ConversationEditor — Conversation-mode authoring: prompts, narrative sections and uploads.
 *
 * Extracted verbatim from RoAModuleContractManager.tsx (2,125 lines). Behaviour
 * unchanged; only the imports are new.
 */
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '../../../../../ui/button';
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
import type {
  RoAConversationNarrativeSection,
  RoAConversationUpload,
  RoAModuleContract,
  RoAModuleConversationConfig,
} from '../../types';
import { getConversationConfig, toId } from '../roaContractHelpers';

export function ConversationEditor({
  draft,
  updateDraft,
}: {
  draft: RoAModuleContract;
  updateDraft: (updater: (current: RoAModuleContract) => RoAModuleContract) => void;
}) {
  const conversation = getConversationConfig(draft);

  const updateConversation = (patch: Partial<RoAModuleConversationConfig>) =>
    updateDraft((current) => ({
      ...current,
      conversation: { ...getConversationConfig(current), ...patch },
    }));

  const updateNarrativeSection = (index: number, patch: Partial<RoAConversationNarrativeSection>) =>
    updateDraft((current) => {
      const config = getConversationConfig(current);
      const narrativeSections = [...config.narrativeSections];
      narrativeSections[index] = { ...narrativeSections[index], ...patch };
      return { ...current, conversation: { ...config, narrativeSections } };
    });

  const updateUpload = (index: number, patch: Partial<RoAConversationUpload>) =>
    updateDraft((current) => {
      const config = getConversationConfig(current);
      const uploads = [...config.uploads];
      uploads[index] = { ...uploads[index], ...patch };
      return { ...current, conversation: { ...config, uploads } };
    });

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Conversation Setup</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="conversation-instructions">Assistant Instructions</Label>
            <Textarea
              id="conversation-instructions"
              value={conversation.instructions}
              onChange={(event) => updateConversation({ instructions: event.target.value })}
              className="min-h-[160px]"
              placeholder="Tell the assistant what to gather and how to behave in this module."
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="conversation-opening">Opening Message</Label>
            <Input
              id="conversation-opening"
              value={conversation.openingMessage || ''}
              onChange={(event) => updateConversation({ openingMessage: event.target.value })}
              placeholder="First message the adviser sees."
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="text-base">Narrative Sections</CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                updateDraft((current) => {
                  const config = getConversationConfig(current);
                  return {
                    ...current,
                    conversation: {
                      ...config,
                      narrativeSections: [
                        ...config.narrativeSections,
                        {
                          id: `section_${config.narrativeSections.length + 1}`,
                          title: 'New Section',
                          description: '',
                          required: true,
                          order: (config.narrativeSections.length + 1) * 10,
                        },
                      ],
                    },
                  };
                })
              }
            >
              <Plus className="h-4 w-4 mr-2" />
              Section
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {conversation.narrativeSections.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Add at least one narrative section the assistant should produce.
            </p>
          )}
          {conversation.narrativeSections.map((section, index) => (
            <div
              key={`${section.id}-${index}`}
              className="grid gap-3 rounded-md border p-3 md:grid-cols-[100px_1fr_1fr_auto_auto]"
            >
              <Input
                type="number"
                value={section.order}
                onChange={(event) =>
                  updateNarrativeSection(index, { order: Number(event.target.value) })
                }
                placeholder="Order"
              />
              <Input
                value={section.id}
                onChange={(event) =>
                  updateNarrativeSection(index, { id: toId(event.target.value) })
                }
                placeholder="ID"
              />
              <Input
                value={section.title}
                onChange={(event) => updateNarrativeSection(index, { title: event.target.value })}
                placeholder="Title"
              />
              <Button
                variant={section.required ? 'default' : 'outline'}
                onClick={() => updateNarrativeSection(index, { required: !section.required })}
              >
                Required
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() =>
                  updateDraft((current) => {
                    const config = getConversationConfig(current);
                    return {
                      ...current,
                      conversation: {
                        ...config,
                        narrativeSections: config.narrativeSections.filter(
                          (_, itemIndex) => itemIndex !== index,
                        ),
                      },
                    };
                  })
                }
              >
                <Trash2 className="h-4 w-4" />
              </Button>
              <Textarea
                value={section.description}
                onChange={(event) =>
                  updateNarrativeSection(index, { description: event.target.value })
                }
                className="md:col-span-5 min-h-[70px]"
                placeholder="Describe what this section should cover."
              />
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="text-base">Uploads</CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                updateDraft((current) => {
                  const config = getConversationConfig(current);
                  return {
                    ...current,
                    conversation: {
                      ...config,
                      uploads: [
                        ...config.uploads,
                        {
                          id: `upload_${config.uploads.length + 1}`,
                          label: 'New Upload',
                          required: false,
                          acceptedMimeTypes: [],
                          guidance: '',
                          visionEligible: false,
                        },
                      ],
                    },
                  };
                })
              }
            >
              <Plus className="h-4 w-4 mr-2" />
              Upload
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {conversation.uploads.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No uploads are requested for this module.
            </p>
          )}
          {conversation.uploads.map((upload, index) => (
            <div key={`${upload.id}-${index}`} className="space-y-3 rounded-md border p-3">
              <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto_auto]">
                <Input
                  value={upload.id}
                  onChange={(event) => updateUpload(index, { id: toId(event.target.value) })}
                  placeholder="ID"
                />
                <Input
                  value={upload.label}
                  onChange={(event) => updateUpload(index, { label: event.target.value })}
                  placeholder="Label"
                />
                <Button
                  variant={upload.required ? 'default' : 'outline'}
                  onClick={() => updateUpload(index, { required: !upload.required })}
                >
                  Required
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() =>
                    updateDraft((current) => {
                      const config = getConversationConfig(current);
                      return {
                        ...current,
                        conversation: {
                          ...config,
                          uploads: config.uploads.filter((_, itemIndex) => itemIndex !== index),
                        },
                      };
                    })
                  }
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <Input
                  value={(upload.acceptedMimeTypes || []).join(', ')}
                  onChange={(event) =>
                    updateUpload(index, {
                      acceptedMimeTypes: event.target.value
                        .split(',')
                        .map((value) => value.trim())
                        .filter(Boolean),
                    })
                  }
                  placeholder="Accepted MIME types, comma separated"
                />
                <Input
                  value={upload.guidance || ''}
                  onChange={(event) => updateUpload(index, { guidance: event.target.value })}
                  placeholder="Guidance"
                />
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id={`upload-vision-${index}`}
                  checked={upload.visionEligible === true}
                  onCheckedChange={(checked) =>
                    updateUpload(index, { visionEligible: checked === true })
                  }
                />
                <Label htmlFor={`upload-vision-${index}`} className="cursor-pointer text-sm">
                  Vision eligible (image can be analysed by the assistant)
                </Label>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Completion</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          <div className="space-y-2">
            <Label>Mode</Label>
            <Select
              value={conversation.completion.mode}
              onValueChange={(value) =>
                updateConversation({
                  completion: {
                    ...conversation.completion,
                    mode: value as RoAModuleConversationConfig['completion']['mode'],
                  },
                })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ai-signal">AI signal</SelectItem>
                <SelectItem value="manual">Manual</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="completion-min-turns">Minimum turns</Label>
            <Input
              id="completion-min-turns"
              type="number"
              value={conversation.completion.minTurns ?? 0}
              onChange={(event) =>
                updateConversation({
                  completion: {
                    ...conversation.completion,
                    minTurns: Number(event.target.value) || 0,
                  },
                })
              }
            />
          </div>
          <div className="flex items-end">
            <div className="flex items-center gap-2 rounded-lg border bg-muted/20 p-3">
              <Checkbox
                id="completion-require-uploads"
                checked={conversation.completion.requireAllUploads === true}
                onCheckedChange={(checked) =>
                  updateConversation({
                    completion: {
                      ...conversation.completion,
                      requireAllUploads: checked === true,
                    },
                  })
                }
              />
              <Label htmlFor="completion-require-uploads" className="cursor-pointer text-sm">
                Require all uploads before completion
              </Label>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
