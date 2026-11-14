import { useCallback, useEffect, useState, type MutableRefObject } from 'react';
import { Button } from '../../../../../ui/button';
import { NumberInputField } from '../../../../../ui/number-input';
import { Badge } from '../../../../../ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '../../../../../ui/card';
import { Label } from '../../../../../ui/label';
import { Tabs } from '../../../../../ui/tabs';
import { DollarSign, Plus } from 'lucide-react';
import { SegmentedList, SegmentedTrigger, SoonBadge } from '../../../../layout/page';
import { Personnel } from '../../types';

type CommissionEntity = 'personal' | 'company';

interface TabCommissionProps {
  selectedPersonnel: Personnel;
  /** Saves the split and entity; resolves true when saved. */
  onSave?: (
    id: string,
    data: { commissionSplit: number; commissionEntity: CommissionEntity },
  ) => Promise<boolean>;
  /** Filled with this tab's save so the page header's Save can run it. */
  saveRef?: MutableRefObject<(() => void) | null>;
  /** Lets the page header enable its Save button. */
  onFormStateChange?: (state: { dirty: boolean; saving: boolean }) => void;
}

/** 0.7 → 70 (shown as a percentage). */
const toPercent = (split: number | undefined) => Math.round((split || 0) * 10000) / 100;

export function TabCommission({
  selectedPersonnel,
  onSave,
  saveRef,
  onFormStateChange,
}: TabCommissionProps) {
  const initialEntity: CommissionEntity =
    selectedPersonnel.commissionEntity === 'company' ? 'company' : 'personal';
  const initialPercent = toPercent(selectedPersonnel.commissionSplit);
  const [entity, setEntity] = useState<CommissionEntity>(initialEntity);
  const [percent, setPercent] = useState<number | undefined>(initialPercent);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [baseline, setBaseline] = useState({ entity: initialEntity, percent: initialPercent });

  const dirty = entity !== baseline.entity || (percent ?? 0) !== baseline.percent;

  const handleSave = useCallback(async () => {
    if (!onSave) return;
    const value = percent ?? 0;
    if (value < 0 || value > 100) {
      setError('Enter a split between 0 and 100%');
      document.getElementById('commission-split')?.focus();
      return;
    }
    setError(null);
    setSaving(true);
    const saved = await onSave(selectedPersonnel.id, {
      commissionSplit: Math.round(value * 100) / 10000,
      commissionEntity: entity,
    });
    setSaving(false);
    if (saved) setBaseline({ entity, percent: value });
  }, [onSave, percent, entity, selectedPersonnel.id]);

  useEffect(() => {
    if (!saveRef) return;
    saveRef.current = () => void handleSave();
    return () => {
      saveRef.current = null;
    };
  }, [saveRef, handleSave]);

  useEffect(() => {
    onFormStateChange?.({ dirty, saving });
  }, [dirty, saving, onFormStateChange]);

  // Leaving the tab takes its unsaved state with it.
  useEffect(() => () => onFormStateChange?.({ dirty: false, saving: false }), [onFormStateChange]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <DollarSign className="h-5 w-5 text-green-600" aria-hidden="true" />
          Commission structure
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-6 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="commission-split">Standard split (%)</Label>
            <div className="flex items-center gap-2">
              <NumberInputField
                id="commission-split"
                decimals={2}
                value={percent ?? ''}
                onValueChange={(v) => {
                  setPercent(v);
                  if (error) setError(null);
                }}
                disabled={!onSave}
                aria-invalid={error ? true : undefined}
                className={error ? 'border-red-400 focus-visible:ring-red-400' : undefined}
              />
              <span className="text-muted-foreground">%</span>
            </div>
            {error ? (
              <p className="text-xs text-red-600">{error}</p>
            ) : (
              <p className="text-xs text-muted-foreground">
                Base percentage of revenue retained by adviser.
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label id="commission-entity-label">Commission entity</Label>
            <Tabs value={entity} onValueChange={(v) => setEntity(v as CommissionEntity)}>
              <SegmentedList aria-labelledby="commission-entity-label">
                <SegmentedTrigger value="personal" disabled={!onSave}>
                  Personal name
                </SegmentedTrigger>
                <SegmentedTrigger value="company" disabled={!onSave}>
                  Registered company (Pty) Ltd
                </SegmentedTrigger>
              </SegmentedList>
            </Tabs>
          </div>
        </div>

        <div className="border-t pt-4">
          <h4 className="mb-3 font-medium">Referral codes</h4>
          <div className="flex gap-2">
            <Badge variant="outline" className="font-mono">
              REF-{selectedPersonnel.lastName?.toUpperCase() || '001'}
            </Badge>
            <Button size="sm" variant="ghost" disabled aria-label="Add a reference">
              <Plus className="h-3 w-3" aria-hidden="true" />
              <SoonBadge />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
