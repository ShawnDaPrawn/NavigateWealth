/**
 * Client estate intake — will status and asset/liability facts (no death-estate modeling).
 */

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Trash2 } from 'lucide-react';

interface AssetRow {
  id: string;
  description: string;
  value: number;
}

interface LiabilityRow {
  id: string;
  description: string;
  value: number;
}

interface EstateIntakeStep1Props {
  initialInputs?: Record<string, unknown>;
  onContinue: (inputs: Record<string, unknown>) => void;
  onSaveDraft: (inputs: Record<string, unknown>) => void;
  isSaving?: boolean;
  readOnly?: boolean;
}

function emptyAsset(): AssetRow {
  return { id: crypto.randomUUID(), description: '', value: 0 };
}

function emptyLiability(): LiabilityRow {
  return { id: crypto.randomUUID(), description: '', value: 0 };
}

export function EstateIntakeStep1({
  initialInputs = {},
  onContinue,
  onSaveDraft,
  isSaving = false,
  readOnly = false,
}: EstateIntakeStep1Props) {
  const willInfo = (initialInputs.willInfo ?? {}) as { hasValidWill?: string };
  const familyInfo = (initialInputs.familyInfo ?? {}) as { maritalStatus?: string };

  const [hasValidWill, setHasValidWill] = useState(willInfo.hasValidWill ?? 'unknown');
  const [maritalStatus, setMaritalStatus] = useState(familyInfo.maritalStatus ?? 'single');
  const [assets, setAssets] = useState<AssetRow[]>(() => {
    const existing = initialInputs.assets as AssetRow[] | undefined;
    return existing?.length ? existing : [emptyAsset()];
  });
  const [liabilities, setLiabilities] = useState<LiabilityRow[]>(() => {
    const existing = initialInputs.liabilities as LiabilityRow[] | undefined;
    return existing?.length ? existing : [emptyLiability()];
  });
  const [notes, setNotes] = useState(String(initialInputs.planningNotes ?? ''));

  const buildInputs = (): Record<string, unknown> => ({
    willInfo: { hasValidWill },
    familyInfo: { maritalStatus },
    assets,
    liabilities,
    planningNotes: notes,
  });

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Estate basics</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Do you have a valid will?</Label>
            <Select disabled={readOnly} value={hasValidWill} onValueChange={setHasValidWill}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="yes">Yes</SelectItem>
                <SelectItem value="no">No</SelectItem>
                <SelectItem value="unknown">Not sure</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Marital status</Label>
            <Select disabled={readOnly} value={maritalStatus} onValueChange={setMaritalStatus}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="single">Single</SelectItem>
                <SelectItem value="married_in_community">Married (in community)</SelectItem>
                <SelectItem value="married_out_community">Married (out of community)</SelectItem>
                <SelectItem value="divorced">Divorced</SelectItem>
                <SelectItem value="widowed">Widowed</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Assets</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {assets.map((asset, index) => (
            <div key={asset.id} className="grid gap-2 md:grid-cols-[1fr_140px_auto]">
              <Input
                disabled={readOnly}
                placeholder="Description (e.g. Primary residence)"
                value={asset.description}
                onChange={(e) =>
                  setAssets((prev) =>
                    prev.map((a, i) => (i === index ? { ...a, description: e.target.value } : a)),
                  )
                }
              />
              <Input
                type="number"
                disabled={readOnly}
                placeholder="Value (R)"
                value={asset.value || ''}
                onChange={(e) =>
                  setAssets((prev) =>
                    prev.map((a, i) =>
                      i === index ? { ...a, value: Number(e.target.value) || 0 } : a,
                    ),
                  )
                }
              />
              {!readOnly && assets.length > 1 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => setAssets((prev) => prev.filter((_, i) => i !== index))}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          ))}
          {!readOnly && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setAssets((prev) => [...prev, emptyAsset()])}
            >
              <Plus className="mr-2 h-4 w-4" />
              Add asset
            </Button>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Liabilities</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {liabilities.map((liability, index) => (
            <div key={liability.id} className="grid gap-2 md:grid-cols-[1fr_140px_auto]">
              <Input
                disabled={readOnly}
                placeholder="Description (e.g. Home loan)"
                value={liability.description}
                onChange={(e) =>
                  setLiabilities((prev) =>
                    prev.map((l, i) => (i === index ? { ...l, description: e.target.value } : l)),
                  )
                }
              />
              <Input
                type="number"
                disabled={readOnly}
                placeholder="Balance (R)"
                value={liability.value || ''}
                onChange={(e) =>
                  setLiabilities((prev) =>
                    prev.map((l, i) =>
                      i === index ? { ...l, value: Number(e.target.value) || 0 } : l,
                    ),
                  )
                }
              />
              {!readOnly && liabilities.length > 1 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => setLiabilities((prev) => prev.filter((_, i) => i !== index))}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          ))}
          {!readOnly && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setLiabilities((prev) => [...prev, emptyLiability()])}
            >
              <Plus className="mr-2 h-4 w-4" />
              Add liability
            </Button>
          )}
        </CardContent>
      </Card>

      <div className="space-y-1.5">
        <Label>Additional notes</Label>
        <Textarea
          disabled={readOnly}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
        />
      </div>

      {!readOnly && (
        <div className="flex flex-wrap justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={isSaving}
            onClick={() => onSaveDraft(buildInputs())}
          >
            Save draft
          </Button>
          <Button type="button" disabled={isSaving} onClick={() => onContinue(buildInputs())}>
            Continue
          </Button>
        </div>
      )}
    </div>
  );
}
