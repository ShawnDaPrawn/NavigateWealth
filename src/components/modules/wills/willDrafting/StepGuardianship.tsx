/**
 * Step 4 — guardians for minor children.
 *
 * Split out of `WillDraftingFlow.tsx` (1,605 lines), where all six steps shared
 * one `return`. Presentational — it owns no state; the flow holds the draft and
 * passes down only the slice this step edits.
 */
import type { Dispatch, SetStateAction } from 'react';
import { Button } from '../../../ui/button';
import { Input } from '../../../ui/input';
import { Label } from '../../../ui/label';
import { Separator } from '../../../ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../ui/select';
import { cn } from '../../../ui/utils';
import { CheckCircle2, Plus, Trash2, AlertCircle } from 'lucide-react';
import { type Guardian, RELATIONSHIP_OPTIONS } from './model';

interface StepGuardianshipProps {
  hasMinorChildren: boolean | null;
  setHasMinorChildren: Dispatch<SetStateAction<boolean | null>>;
  guardians: Guardian[];
  setGuardians: Dispatch<SetStateAction<Guardian[]>>;
  addGuardian: (isAlternate?: boolean) => void;
  updateGuardian: (id: string, field: keyof Guardian, value: string | boolean) => void;
  removeGuardian: (id: string) => void;
}

export function StepGuardianship({
  hasMinorChildren,
  setHasMinorChildren,
  guardians,
  setGuardians,
  addGuardian,
  updateGuardian,
  removeGuardian,
}: StepGuardianshipProps) {
  return (
    <div className="space-y-5">
      <div className="space-y-3">
        <Label className="text-sm font-medium text-gray-900">
          Do you have minor children (under 18)? <span className="text-red-500">*</span>
        </Label>
        <div className="flex gap-3">
          <Button
            type="button"
            variant={hasMinorChildren === true ? 'default' : 'outline'}
            size="sm"
            onClick={() => {
              setHasMinorChildren(true);
              if (guardians.length === 0) addGuardian(false);
            }}
            className={cn(
              'min-w-[80px]',
              hasMinorChildren === true && 'bg-primary hover:bg-primary/90 text-primary-foreground',
            )}
          >
            Yes
          </Button>
          <Button
            type="button"
            variant={hasMinorChildren === false ? 'default' : 'outline'}
            size="sm"
            onClick={() => {
              setHasMinorChildren(false);
              setGuardians([]);
            }}
            className={cn(
              'min-w-[80px]',
              hasMinorChildren === false &&
                'bg-primary hover:bg-primary/90 text-primary-foreground',
            )}
          >
            No
          </Button>
        </div>
      </div>

      {hasMinorChildren && (
        <div className="space-y-4">
          <div className="flex items-start gap-2 px-3 py-2.5 bg-amber-50 border border-amber-200 rounded-lg">
            <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
            <p className="text-xs text-amber-800">
              Under South African law, guardianship nominations in a will are not automatically
              binding. The High Court (Upper Guardian) has the final say but will give strong weight
              to your documented wishes.
            </p>
          </div>

          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-900">Nominated Guardians</h3>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="text-xs h-7 gap-1"
              onClick={() => addGuardian(false)}
            >
              <Plus className="h-3 w-3" /> Add Guardian
            </Button>
          </div>

          {guardians
            .filter((g) => !g.isAlternate)
            .map((guard, idx) => (
              <div key={guard.id} className="p-3 border rounded-lg space-y-3 bg-white">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-gray-500">Guardian {idx + 1}</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0 text-red-400 hover:text-red-600"
                    onClick={() => removeGuardian(guard.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-gray-700">Full Name</Label>
                    <Input
                      value={guard.fullName}
                      onChange={(e) => updateGuardian(guard.id, 'fullName', e.target.value)}
                      placeholder="Guardian's full name"
                      className="h-9 text-sm"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-gray-700">Relationship</Label>
                    <Select
                      value={guard.relationship}
                      onValueChange={(v) => updateGuardian(guard.id, 'relationship', v)}
                    >
                      <SelectTrigger className="h-9 text-sm">
                        <SelectValue placeholder="Select" />
                      </SelectTrigger>
                      <SelectContent>
                        {RELATIONSHIP_OPTIONS.filter(
                          (r) => r !== 'Charity/Organisation' && r !== 'Trust',
                        ).map((opt) => (
                          <SelectItem key={opt} value={opt}>
                            {opt}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-gray-700">Cellphone</Label>
                    <Input
                      type="tel"
                      value={guard.cellphone}
                      onChange={(e) => updateGuardian(guard.id, 'cellphone', e.target.value)}
                      placeholder="+27 82 000 0000"
                      className="h-9 text-sm"
                    />
                  </div>
                </div>
              </div>
            ))}

          <Separator />

          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-gray-900">Alternate Guardian</h3>
              <p className="text-xs text-gray-500">If your primary guardian is unable to act.</p>
            </div>
            {guardians.filter((g) => g.isAlternate).length === 0 && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="text-xs h-7 gap-1"
                onClick={() => addGuardian(true)}
              >
                <Plus className="h-3 w-3" /> Add
              </Button>
            )}
          </div>

          {guardians
            .filter((g) => g.isAlternate)
            .map((guard) => (
              <div
                key={guard.id}
                className="p-3 border border-dashed rounded-lg space-y-3 bg-white"
              >
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-gray-700">Full Name</Label>
                    <Input
                      value={guard.fullName}
                      onChange={(e) => updateGuardian(guard.id, 'fullName', e.target.value)}
                      placeholder="Alternate guardian's name"
                      className="h-9 text-sm"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-gray-700">Cellphone</Label>
                    <Input
                      type="tel"
                      value={guard.cellphone}
                      onChange={(e) => updateGuardian(guard.id, 'cellphone', e.target.value)}
                      placeholder="+27 82 000 0000"
                      className="h-9 text-sm"
                    />
                  </div>
                </div>
              </div>
            ))}
        </div>
      )}

      {hasMinorChildren === false && (
        <div className="flex items-start gap-2 px-3 py-2.5 bg-green-50 border border-green-200 rounded-lg">
          <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
          <p className="text-xs text-green-800">
            No guardianship clause is needed. You can proceed to the next step.
          </p>
        </div>
      )}
    </div>
  );
}
