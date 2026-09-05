/**
 * Step 2 — the executor, and an optional alternate.
 *
 * Split out of `WillDraftingFlow.tsx` (1,605 lines), where all six steps shared
 * one `return`. Presentational — it owns no state; the flow holds the draft and
 * passes down only the slice this step edits.
 */
import { Input } from '../../../ui/input';
import { Label } from '../../../ui/label';
import { Separator } from '../../../ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../ui/select';
import { AlertCircle } from 'lucide-react';
import { type Executor } from './model';

interface StepExecutorProps {
  executor: Executor;
  alternateExecutor: Executor;
  updateExecutor: (target: 'primary' | 'alternate', field: keyof Executor, value: string) => void;
}

export function StepExecutor({ executor, alternateExecutor, updateExecutor }: StepExecutorProps) {
  return (
    <div className="space-y-6">
      <div className="flex items-start gap-2 px-3 py-2.5 bg-amber-50 border border-amber-200 rounded-lg">
        <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
        <p className="text-xs text-amber-800">
          Your executor is responsible for administering your estate after death. Consider
          appointing a trusted individual or professional estate administrator.
        </p>
      </div>

      {/* Primary executor */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-gray-900">Primary Executor</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-gray-700">
              Full Name <span className="text-red-500">*</span>
            </Label>
            <Input
              value={executor.fullName}
              onChange={(e) => updateExecutor('primary', 'fullName', e.target.value)}
              placeholder="Executor's full legal name"
              className="h-10 text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-gray-700">ID Number</Label>
            <Input
              value={executor.idNumber}
              onChange={(e) => updateExecutor('primary', 'idNumber', e.target.value)}
              placeholder="SA ID number"
              maxLength={13}
              className="h-10 text-sm"
            />
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-gray-700">Relationship</Label>
            <Select
              value={executor.relationship}
              onValueChange={(v) => updateExecutor('primary', 'relationship', v)}
            >
              <SelectTrigger className="h-10 text-sm">
                <SelectValue placeholder="Select" />
              </SelectTrigger>
              <SelectContent>
                {[
                  'Spouse',
                  'Family Member',
                  'Friend',
                  'Attorney',
                  'Professional Executor',
                  'Other',
                ].map((opt) => (
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
              value={executor.cellphone}
              onChange={(e) => updateExecutor('primary', 'cellphone', e.target.value)}
              placeholder="+27 82 000 0000"
              className="h-10 text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-gray-700">Email</Label>
            <Input
              type="email"
              value={executor.email}
              onChange={(e) => updateExecutor('primary', 'email', e.target.value)}
              placeholder="executor@email.co.za"
              className="h-10 text-sm"
            />
          </div>
        </div>
      </div>

      <Separator />

      {/* Alternate executor */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-gray-900">
          Alternate Executor{' '}
          <span className="text-xs font-normal text-gray-400">(Recommended)</span>
        </h3>
        <p className="text-xs text-gray-500">
          If your primary executor is unable or unwilling to act, this person will take over.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-gray-700">Full Name</Label>
            <Input
              value={alternateExecutor.fullName}
              onChange={(e) => updateExecutor('alternate', 'fullName', e.target.value)}
              placeholder="Alternate executor's name"
              className="h-10 text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-gray-700">Cellphone</Label>
            <Input
              type="tel"
              value={alternateExecutor.cellphone}
              onChange={(e) => updateExecutor('alternate', 'cellphone', e.target.value)}
              placeholder="+27 82 000 0000"
              className="h-10 text-sm"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
