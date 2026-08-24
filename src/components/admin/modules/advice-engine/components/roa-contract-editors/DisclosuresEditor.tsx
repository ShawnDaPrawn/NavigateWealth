/**
 * DisclosuresEditor — Disclosure text blocks.
 *
 * Extracted verbatim from RoAModuleContractManager.tsx (2,125 lines). Behaviour
 * unchanged; only the imports are new.
 */
import { Card, CardContent, CardHeader, CardTitle } from '../../../../../ui/card';
import { Label } from '../../../../../ui/label';
import { Textarea } from '../../../../../ui/textarea';
import type { RoAModuleContract } from '../../types';
import { arrayToLines, linesToArray, toId } from '../roaContractHelpers';

export function DisclosuresEditor({
  draft,
  updateDraft,
}: {
  draft: RoAModuleContract;
  updateDraft: (updater: (current: RoAModuleContract) => RoAModuleContract) => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Disclosures and Validation</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label>Disclosures</Label>
          <Textarea
            value={arrayToLines(draft.disclosures)}
            onChange={(event) =>
              updateDraft((current) => ({
                ...current,
                disclosures: linesToArray(event.target.value),
              }))
            }
            className="min-h-[240px]"
          />
        </div>
        <div className="space-y-2">
          <Label>Compile Order</Label>
          <Textarea
            value={arrayToLines(draft.compileOrder)}
            onChange={(event) =>
              updateDraft((current) => ({
                ...current,
                compileOrder: linesToArray(event.target.value),
              }))
            }
            className="min-h-[240px]"
          />
        </div>
        <div className="space-y-2 md:col-span-2">
          <Label>Blocking and Warning Rules</Label>
          <Textarea
            value={draft.validation.rules
              .map((rule) => `${rule.id}|${rule.severity}|${rule.message}`)
              .join('\n')}
            onChange={(event) =>
              updateDraft((current) => ({
                ...current,
                validation: {
                  ...current.validation,
                  rules: linesToArray(event.target.value).map((line) => {
                    const [id, severity, ...messageParts] = line.split('|');
                    return {
                      id: toId(id || 'rule'),
                      severity: severity === 'blocking' ? 'blocking' : 'warning',
                      message: messageParts.join('|') || '',
                    };
                  }),
                },
              }))
            }
            className="min-h-[180px]"
          />
        </div>
      </CardContent>
    </Card>
  );
}
