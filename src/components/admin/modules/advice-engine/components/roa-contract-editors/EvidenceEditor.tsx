/**
 * EvidenceEditor — Evidence requirements attached to a contract.
 *
 * Extracted verbatim from RoAModuleContractManager.tsx (2,125 lines). Behaviour
 * unchanged; only the imports are new.
 */
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '../../../../../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../../../../ui/card';
import { Input } from '../../../../../ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../../../ui/select';
import type { RoAModuleContract } from '../../types';
import { toId } from '../roaContractHelpers';
import type { EvidenceRequirement } from '../roaContractHelpers';

export function EvidenceEditor({
  draft,
  updateDraft,
  schemaFormat,
}: {
  draft: RoAModuleContract;
  updateDraft: (updater: (current: RoAModuleContract) => RoAModuleContract) => void;
  schemaFormat?: { allowedEvidenceTypes: EvidenceRequirement['type'][] };
}) {
  const updateEvidence = (index: number, patch: Partial<EvidenceRequirement>) =>
    updateDraft((current) => {
      const requirements = [...current.evidence.requirements];
      requirements[index] = { ...requirements[index], ...patch };
      return { ...current, evidence: { requirements } };
    });

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="text-base">Evidence Requirements</CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              updateDraft((current) => ({
                ...current,
                evidence: {
                  requirements: [
                    ...current.evidence.requirements,
                    {
                      id: `evidence_${current.evidence.requirements.length + 1}`,
                      label: 'New Evidence',
                      type: 'other',
                      required: false,
                    },
                  ],
                },
              }))
            }
          >
            <Plus className="h-4 w-4 mr-2" />
            Evidence
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {draft.evidence.requirements.map((item, index) => (
          <div
            key={`${item.id}-${index}`}
            className="grid gap-3 rounded-md border p-3 md:grid-cols-[1fr_1fr_160px_auto_auto]"
          >
            <Input
              value={item.id}
              onChange={(event) => updateEvidence(index, { id: toId(event.target.value) })}
            />
            <Input
              value={item.label}
              onChange={(event) => updateEvidence(index, { label: event.target.value })}
            />
            <Select
              value={item.type}
              onValueChange={(value) =>
                updateEvidence(index, { type: value as EvidenceRequirement['type'] })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(schemaFormat?.allowedEvidenceTypes || ['other']).map((type) => (
                  <SelectItem key={type} value={type}>
                    {type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant={item.required ? 'default' : 'outline'}
              onClick={() => updateEvidence(index, { required: !item.required })}
            >
              Required
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() =>
                updateDraft((current) => ({
                  ...current,
                  evidence: {
                    requirements: current.evidence.requirements.filter(
                      (_, itemIndex) => itemIndex !== index,
                    ),
                  },
                }))
              }
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
