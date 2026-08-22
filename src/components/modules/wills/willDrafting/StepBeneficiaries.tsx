/**
 * Step 3 — who inherits, and in what share.
 *
 * Split out of `WillDraftingFlow.tsx` (1,605 lines), where all six steps shared
 * one `return`. Presentational — it owns no state; the flow holds the draft and
 * passes down only the slice this step edits.
 */
import { Button } from '../../../ui/button';
import { Input } from '../../../ui/input';
import { Label } from '../../../ui/label';
import { Badge } from '../../../ui/badge';
import { Separator } from '../../../ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../ui/select';
import { cn } from '../../../ui/utils';
import { Plus, Trash2, AlertCircle } from 'lucide-react';
import { type Beneficiary, RELATIONSHIP_OPTIONS } from './model';

interface StepBeneficiariesProps {
  beneficiaries: Beneficiary[];
  shareTotal: number;
  addBeneficiary: (isAlternate?: boolean) => void;
  updateBeneficiary: (
    id: string,
    field: keyof Beneficiary,
    value: string | number | boolean,
  ) => void;
  removeBeneficiary: (id: string) => void;
}

export function StepBeneficiaries({
  beneficiaries,
  shareTotal,
  addBeneficiary,
  updateBeneficiary,
  removeBeneficiary,
}: StepBeneficiariesProps) {
  return (
    <div className="space-y-5">
      <div className="flex items-start gap-2 px-3 py-2.5 bg-primary/5 border border-primary/20 rounded-lg">
        <AlertCircle className="h-4 w-4 text-primary mt-0.5 shrink-0" />
        <p className="text-xs text-gray-800">
          Specify who should inherit your estate and in what proportion. Share percentages for
          primary beneficiaries should total 100%.
        </p>
      </div>

      {/* Share percentage indicator */}
      <div className="flex items-center justify-between px-3 py-2 bg-gray-50 rounded-lg border">
        <span className="text-xs font-medium text-gray-700">Total Share Allocation</span>
        <Badge
          variant="outline"
          className={cn(
            'text-xs',
            shareTotal === 100
              ? 'bg-green-50 text-green-700 border-green-200'
              : shareTotal > 100
                ? 'bg-red-50 text-red-700 border-red-200'
                : 'bg-amber-50 text-amber-700 border-amber-200',
          )}
        >
          {shareTotal}% of 100%
        </Badge>
      </div>

      {/* Primary beneficiaries */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-900">Primary Beneficiaries</h3>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="text-xs h-7 gap-1"
            onClick={() => addBeneficiary(false)}
          >
            <Plus className="h-3 w-3" /> Add
          </Button>
        </div>

        {beneficiaries
          .filter((b) => !b.isAlternate)
          .map((ben, idx) => (
            <div key={ben.id} className="p-3 border rounded-lg space-y-3 bg-white">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-gray-500">Beneficiary {idx + 1}</span>
                {beneficiaries.filter((b) => !b.isAlternate).length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0 text-red-400 hover:text-red-600"
                    onClick={() => removeBeneficiary(ben.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div className="sm:col-span-2 space-y-1.5">
                  <Label className="text-xs font-medium text-gray-700">
                    Full Name <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    value={ben.fullName}
                    onChange={(e) => updateBeneficiary(ben.id, 'fullName', e.target.value)}
                    placeholder="Beneficiary's full name"
                    className="h-9 text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-gray-700">Relationship</Label>
                  <Select
                    value={ben.relationship}
                    onValueChange={(v) => updateBeneficiary(ben.id, 'relationship', v)}
                  >
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent>
                      {RELATIONSHIP_OPTIONS.map((opt) => (
                        <SelectItem key={opt} value={opt}>
                          {opt}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-gray-700">Share %</Label>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    value={ben.sharePercentage}
                    onChange={(e) =>
                      updateBeneficiary(ben.id, 'sharePercentage', Number(e.target.value))
                    }
                    className="h-9 text-sm"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-gray-700">ID Number</Label>
                <Input
                  value={ben.idNumber}
                  onChange={(e) => updateBeneficiary(ben.id, 'idNumber', e.target.value)}
                  placeholder="SA ID number (optional)"
                  maxLength={13}
                  className="h-9 text-sm"
                />
              </div>
            </div>
          ))}
      </div>

      <Separator />

      {/* Alternate beneficiaries */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-gray-900">Alternate Beneficiaries</h3>
            <p className="text-xs text-gray-500">
              If a primary beneficiary predeceases you, their share goes to the alternate.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="text-xs h-7 gap-1"
            onClick={() => addBeneficiary(true)}
          >
            <Plus className="h-3 w-3" /> Add
          </Button>
        </div>

        {beneficiaries.filter((b) => b.isAlternate).length === 0 ? (
          <p className="text-xs text-gray-400 italic px-3 py-2 bg-gray-50 rounded-lg">
            No alternate beneficiaries added yet. This is optional but recommended.
          </p>
        ) : (
          beneficiaries
            .filter((b) => b.isAlternate)
            .map((ben, idx) => (
              <div key={ben.id} className="p-3 border rounded-lg space-y-3 bg-white border-dashed">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-gray-500">Alternate {idx + 1}</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0 text-red-400 hover:text-red-600"
                    onClick={() => removeBeneficiary(ben.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-gray-700">Full Name</Label>
                    <Input
                      value={ben.fullName}
                      onChange={(e) => updateBeneficiary(ben.id, 'fullName', e.target.value)}
                      placeholder="Alternate's full name"
                      className="h-9 text-sm"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-gray-700">Relationship</Label>
                    <Select
                      value={ben.relationship}
                      onValueChange={(v) => updateBeneficiary(ben.id, 'relationship', v)}
                    >
                      <SelectTrigger className="h-9 text-sm">
                        <SelectValue placeholder="Select" />
                      </SelectTrigger>
                      <SelectContent>
                        {RELATIONSHIP_OPTIONS.map((opt) => (
                          <SelectItem key={opt} value={opt}>
                            {opt}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-gray-700">ID Number</Label>
                    <Input
                      value={ben.idNumber}
                      onChange={(e) => updateBeneficiary(ben.id, 'idNumber', e.target.value)}
                      placeholder="Optional"
                      maxLength={13}
                      className="h-9 text-sm"
                    />
                  </div>
                </div>
              </div>
            ))
        )}
      </div>
    </div>
  );
}
