/**
 * FNAAssumptionOverrides — the Step 3 "Adviser Manual Adjustment" table for
 * wizards whose adjustment is an assumption override (Investment INA, Estate).
 *
 * Each row shows the system value beside the adviser's value. Any change
 * needs a recorded reason, the same rule the Rand-override wizards apply.
 */

import { RotateCcw } from 'lucide-react';
import { Badge } from '../../../../ui/badge';
import { Button } from '../../../../ui/button';
import { Input } from '../../../../ui/input';
import { Label } from '../../../../ui/label';
import { Textarea } from '../../../../ui/textarea';
import {
  formatValue,
  fromDisplay,
  isAssumptionChanged,
  isOverrideReasonValid,
  MIN_OVERRIDE_REASON_LENGTH,
  toDisplay,
  type FNAAssumptionRow,
} from './assumptionOverrides';

interface FNAAssumptionOverridesProps {
  rows: readonly FNAAssumptionRow[];
  onChange: (id: string, value: number) => void;
  reason: string;
  onReasonChange: (reason: string) => void;
  /** Set when an override exists; shows the reason requirement. */
  reasonRequired: boolean;
  showReasonError?: boolean;
}

export function FNAAssumptionOverrides({
  rows,
  onChange,
  reason,
  onReasonChange,
  reasonRequired,
  showReasonError = false,
}: FNAAssumptionOverridesProps) {
  const reasonInvalid = !isOverrideReasonValid(reasonRequired, reason);

  return (
    <div className="space-y-6">
      <div className="rounded-lg border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-muted-foreground">
            <tr>
              <th className="text-left font-medium px-4 py-2">Assumption</th>
              <th className="text-right font-medium px-4 py-2">System value</th>
              <th className="text-right font-medium px-4 py-2 w-56">Adviser value</th>
              <th className="px-4 py-2 w-28" aria-label="Status" />
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const changed = isAssumptionChanged(row);
              const inputId = `assumption-${row.id}`;
              return (
                <tr key={row.id} className="border-t">
                  <td className="px-4 py-3">
                    <Label htmlFor={inputId} className="font-medium">
                      {row.label}
                    </Label>
                    {row.hint && <p className="text-xs text-muted-foreground mt-1">{row.hint}</p>}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {formatValue(row.systemValue, row.format)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 justify-end">
                      {row.format === 'currency' && (
                        <span className="text-muted-foreground">R</span>
                      )}
                      <Input
                        id={inputId}
                        type="number"
                        step={row.format === 'currency' ? 1000 : 0.1}
                        className="text-right w-36"
                        value={toDisplay(row.value, row.format)}
                        onChange={(e) => {
                          const parsed = parseFloat(e.target.value);
                          onChange(
                            row.id,
                            fromDisplay(Number.isNaN(parsed) ? 0 : parsed, row.format),
                          );
                        }}
                      />
                      {row.format !== 'currency' && (
                        <span className="text-muted-foreground">%</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {changed ? (
                      <div className="flex items-center justify-end gap-1">
                        <Badge variant="secondary">Overridden</Badge>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          aria-label={`Reset ${row.label} to the system value`}
                          onClick={() => onChange(row.id, row.systemValue)}
                        >
                          <RotateCcw className="h-4 w-4" aria-hidden="true" />
                        </Button>
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">System</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="space-y-2">
        <Label htmlFor="override-reason">
          Reason for adjustment{reasonRequired ? ' *' : ' (only needed if you change a value)'}
        </Label>
        <Textarea
          id="override-reason"
          rows={3}
          value={reason}
          onChange={(e) => onReasonChange(e.target.value)}
          placeholder="Record why the system assumptions do not suit this client"
          aria-invalid={showReasonError && reasonInvalid}
        />
        {showReasonError && reasonInvalid && (
          <p className="text-xs text-destructive">
            Give a reason of at least {MIN_OVERRIDE_REASON_LENGTH} characters for the override.
          </p>
        )}
      </div>
    </div>
  );
}
