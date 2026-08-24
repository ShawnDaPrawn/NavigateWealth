/**
 * The module narratives editor of the RoA review step (with its per-module
 * panel and the conversation-mode check). Moved verbatim from
 * RoAStepReview.tsx.
 */
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Badge } from '../../../../../ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '../../../../../ui/card';
import { Label } from '../../../../../ui/label';
import { Textarea } from '../../../../../ui/textarea';
import { MessageSquare, Save } from 'lucide-react';
import { RoADraft, RoAModule } from '../DraftRoAInterface';
import { roaApi } from '../../api';
import { getFallbackRuntimeModule } from '../../roaModuleRuntime';
import type { RoAModuleNarrative } from '../../types';
import { isConversationModule } from './roaReviewRender';

interface ModuleNarrativesEditorProps {
  draft: RoADraft;
  onUpdate: (updates: Partial<RoADraft>) => void;
  modules?: RoAModule[];
}

/**
 * Renders editable narratives generated from each conversation module. Each
 * section is an editable textarea persisted on blur via saveModuleNarrative.
 */
export function ModuleNarrativesEditor({ draft, onUpdate, modules }: ModuleNarrativesEditorProps) {
  const isLocked = Boolean(draft.lockedAt);
  const conversationModuleIds = draft.selectedModules.filter((moduleId) => {
    const module =
      modules?.find((item) => item.id === moduleId) || getFallbackRuntimeModule(moduleId);
    return isConversationModule(module) && Boolean(draft.moduleNarratives?.[moduleId]);
  });

  if (conversationModuleIds.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5" />
          Module Narratives
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Review and refine the narratives generated from each module conversation. Edits are saved
          when you leave a section.
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        {conversationModuleIds.map((moduleId) => {
          const module =
            modules?.find((item) => item.id === moduleId) || getFallbackRuntimeModule(moduleId);
          const narrative = draft.moduleNarratives?.[moduleId];
          if (!narrative) return null;
          return (
            <ModuleNarrativePanel
              key={moduleId}
              draftId={draft.id}
              moduleId={moduleId}
              moduleTitle={module?.title || moduleId}
              narrative={narrative}
              disabled={isLocked}
              onSaved={(updatedNarrative) =>
                onUpdate({
                  moduleNarratives: {
                    ...(draft.moduleNarratives || {}),
                    [moduleId]: updatedNarrative,
                  },
                })
              }
            />
          );
        })}
      </CardContent>
    </Card>
  );
}

interface ModuleNarrativePanelProps {
  draftId: string;
  moduleId: string;
  moduleTitle: string;
  narrative: RoAModuleNarrative;
  disabled: boolean;
  onSaved: (narrative: RoAModuleNarrative) => void;
}

function ModuleNarrativePanel({
  draftId,
  moduleId,
  moduleTitle,
  narrative,
  disabled,
  onSaved,
}: ModuleNarrativePanelProps) {
  // Local edit buffer keyed by section id.
  const [drafts, setDrafts] = useState<Record<string, string>>(() =>
    Object.fromEntries(narrative.sections.map((section) => [section.id, section.markdown])),
  );
  const [savingId, setSavingId] = useState<string | null>(null);

  useEffect(() => {
    setDrafts(
      Object.fromEntries(narrative.sections.map((section) => [section.id, section.markdown])),
    );
  }, [narrative]);

  const saveSection = async (sectionId: string) => {
    const original = narrative.sections.find((section) => section.id === sectionId)?.markdown ?? '';
    const next = drafts[sectionId] ?? '';
    if (next === original) return; // No change — skip the round trip.

    setSavingId(sectionId);
    try {
      const sections = narrative.sections.map((section) => ({
        id: section.id,
        markdown: section.id === sectionId ? next : (drafts[section.id] ?? section.markdown),
      }));
      const result = await roaApi.saveModuleNarrative(draftId, moduleId, sections);
      onSaved(result.narrative);
      toast.success('Narrative saved');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to save narrative');
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="space-y-4 rounded-lg border p-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-semibold">{moduleTitle}</h3>
        <Badge variant="outline">{narrative.sections.length} sections</Badge>
      </div>
      {narrative.sections.map((section) => (
        <div key={section.id} className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="font-medium">{section.title}</Label>
            {savingId === section.id && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <Save className="h-3 w-3" />
                Saving...
              </span>
            )}
          </div>
          <Textarea
            value={drafts[section.id] ?? ''}
            onChange={(event) =>
              setDrafts((prev) => ({ ...prev, [section.id]: event.target.value }))
            }
            onBlur={() => void saveSection(section.id)}
            disabled={disabled || savingId === section.id}
            className="min-h-[140px] font-mono text-sm"
          />
        </div>
      ))}
    </div>
  );
}
