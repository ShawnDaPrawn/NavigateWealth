/**
 * Step 5 — specific bequests, residue and funeral wishes.
 *
 * Split out of `WillDraftingFlow.tsx` (1,605 lines), where all six steps shared
 * one `return`. Presentational — it owns no state; the flow holds the draft and
 * passes down only the slice this step edits.
 */
import type { Dispatch, SetStateAction } from 'react';
import { Button } from '../../../ui/button';
import { Input } from '../../../ui/input';
import { Label } from '../../../ui/label';
import { Textarea } from '../../../ui/textarea';
import { Separator } from '../../../ui/separator';
import { Plus, Trash2, AlertCircle } from 'lucide-react';
import { type SpecialBequest } from './model';

interface StepSpecificBequestsProps {
  specialBequests: SpecialBequest[];
  addBequest: () => void;
  updateBequest: (id: string, field: keyof SpecialBequest, value: string) => void;
  removeBequest: (id: string) => void;
  residualInstructions: string;
  setResidualInstructions: Dispatch<SetStateAction<string>>;
  funeralWishes: string;
  setFuneralWishes: Dispatch<SetStateAction<string>>;
}

export function StepSpecificBequests({
  specialBequests,
  addBequest,
  updateBequest,
  removeBequest,
  residualInstructions,
  setResidualInstructions,
  funeralWishes,
  setFuneralWishes,
}: StepSpecificBequestsProps) {
  return (
    <div className="space-y-5">
      <div className="flex items-start gap-2 px-3 py-2.5 bg-primary/5 border border-primary/20 rounded-lg">
        <AlertCircle className="h-4 w-4 text-primary mt-0.5 shrink-0" />
        <p className="text-xs text-gray-800">
          Special bequests are specific items or amounts you wish to leave to specific people (e.g.,
          a family heirloom, a cash gift, property). These are distributed before the residual
          estate.
        </p>
      </div>

      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900">Specific Bequests</h3>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="text-xs h-7 gap-1"
          onClick={addBequest}
        >
          <Plus className="h-3 w-3" /> Add Bequest
        </Button>
      </div>

      {specialBequests.length === 0 ? (
        <p className="text-xs text-gray-400 italic px-3 py-2 bg-gray-50 rounded-lg">
          No specific bequests added. This section is optional.
        </p>
      ) : (
        specialBequests.map((bequest, idx) => (
          <div key={bequest.id} className="p-3 border rounded-lg space-y-3 bg-white">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-gray-500">Bequest {idx + 1}</span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0 text-red-400 hover:text-red-600"
                onClick={() => removeBequest(bequest.id)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-gray-700">
                  Item / Amount Description
                </Label>
                <Input
                  value={bequest.description}
                  onChange={(e) => updateBequest(bequest.id, 'description', e.target.value)}
                  placeholder="e.g. My diamond ring, R50,000 cash"
                  className="h-9 text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-gray-700">Beneficiary Name</Label>
                <Input
                  value={bequest.beneficiaryName}
                  onChange={(e) => updateBequest(bequest.id, 'beneficiaryName', e.target.value)}
                  placeholder="Who receives this bequest"
                  className="h-9 text-sm"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-gray-700">
                Conditions <span className="text-xs font-normal text-gray-400">(optional)</span>
              </Label>
              <Textarea
                value={bequest.conditions}
                onChange={(e) => updateBequest(bequest.id, 'conditions', e.target.value)}
                placeholder="e.g. Only upon reaching age 25"
                rows={2}
                className="text-sm resize-none"
              />
            </div>
          </div>
        ))
      )}

      <Separator />

      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-gray-900">Residual Estate Instructions</h3>
        <p className="text-xs text-gray-500">
          Instructions for whatever remains after debts, taxes, and special bequests are settled. If
          left blank, the residual estate will be distributed to your beneficiaries per the
          percentages specified in Step 3.
        </p>
        <Textarea
          value={residualInstructions}
          onChange={(e) => setResidualInstructions(e.target.value)}
          placeholder="e.g. My residual estate should be divided equally among my children."
          rows={3}
          className="text-sm resize-none"
        />
      </div>

      <Separator />

      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-gray-900">
          Funeral Wishes <span className="text-xs font-normal text-gray-400">(optional)</span>
        </h3>
        <Textarea
          value={funeralWishes}
          onChange={(e) => setFuneralWishes(e.target.value)}
          placeholder="e.g. I wish to be cremated / I prefer a burial at..."
          rows={2}
          className="text-sm resize-none"
        />
      </div>
    </div>
  );
}
