/**
 * Estate Planning — Step 1: Information Gathering
 *
 * Client values come from the client keys through the shared review prefill
 * (form id `estate-fna-step1`), the same path every FNA uses. Assets,
 * liabilities, life policies and dependants are the client's records and are
 * loaded by the wizard. Nothing is applied without the adviser seeing it.
 */

import { useEffect, useState } from 'react';
import { AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { Alert, AlertDescription } from '../../../../ui/alert';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../../ui/card';
import { Input } from '../../../../ui/input';
import { Label } from '../../../../ui/label';
import { Switch } from '../../../../ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../../ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../../../ui/tabs';
import { FNAStepNavigation } from '../../fna';
import { useFormPrefill } from '../../form-prefill';
import type { EstatePlanningInputs, FamilyInformation, WillInformation } from '../types';
import { formatCurrency } from '../utils';
import {
  findEstateStep1Problem,
  mergePrefillIntoEstateInputs,
  type EstateStep1Tab,
} from './estateWizardInputs';

const MARITAL_STATUS_LABELS: Record<FamilyInformation['maritalStatus'], string> = {
  single: 'Single',
  married_cop: 'Married in community of property',
  married_anc: 'Married out of community (ANC)',
  married_customary: 'Customary marriage',
  divorced: 'Divorced',
  widowed: 'Widowed',
};

const WILL_OPTIONS: Record<WillInformation['hasValidWill'], string> = {
  yes: 'Yes',
  no: 'No',
  unknown: 'Unknown',
};

const EXECUTOR_OPTIONS: Record<WillInformation['executorNominated'], string> = {
  person: 'A person',
  professional: 'A professional executor',
  none: 'None',
  unknown: 'Unknown',
};

interface Step1Props {
  clientId: string;
  inputs: EstatePlanningInputs;
  onChange: (next: EstatePlanningInputs) => void;
  onNext: () => void;
  /** False once the adviser has already reviewed the client record in this wizard. */
  autoStartPrefill: boolean;
}

export function Step1InformationGathering({
  clientId,
  inputs,
  onChange,
  onNext,
  autoStartPrefill,
}: Step1Props) {
  const [activeTab, setActiveTab] = useState<EstateStep1Tab>('family');
  const [prefillStarted, setPrefillStarted] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  // The review stays available throughout; only the automatic start is gated.
  const { PrefillUI, startPrefill } = useFormPrefill({
    clientId,
    formId: 'estate-fna-step1',
    currentValues: inputs as unknown as Record<string, unknown>,
    onApplyValues: (values) => onChange(mergePrefillIntoEstateInputs(inputs, values)),
  });

  useEffect(() => {
    if (autoStartPrefill && clientId && !prefillStarted) {
      setPrefillStarted(true);
      void startPrefill();
    }
  }, [autoStartPrefill, clientId, prefillStarted, startPrefill]);

  const setFamily = (updates: Partial<FamilyInformation>) =>
    onChange({ ...inputs, familyInfo: { ...inputs.familyInfo, ...updates } });
  const setWill = (updates: Partial<WillInformation>) =>
    onChange({ ...inputs, willInfo: { ...inputs.willInfo, ...updates } });

  const handleNext = () => {
    const found = findEstateStep1Problem(inputs);
    if (found) {
      setActiveTab(found.tab);
      setProblem(found.message);
      toast.error(found.message);
      return;
    }
    setProblem(null);
    onNext();
  };

  const totalAssets = inputs.assets.reduce((sum, a) => sum + (a.currentValue || 0), 0);
  const totalLiabilities = inputs.liabilities.reduce(
    (sum, l) => sum + (l.outstandingBalance || 0),
    0,
  );
  const totalCover = inputs.lifePolicies.reduce((sum, p) => sum + (p.sumAssured || 0), 0);

  return (
    <div className="space-y-6">
      {PrefillUI}

      {problem && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="text-sm">{problem}</AlertDescription>
        </Alert>
      )}

      <Tabs
        value={activeTab}
        onValueChange={(tab) => setActiveTab(tab as EstateStep1Tab)}
        className="w-full"
      >
        <TabsList className="w-full h-auto p-1">
          <TabsTrigger value="family" className="text-sm px-6 py-2.5">
            Family
          </TabsTrigger>
          <TabsTrigger value="will" className="text-sm px-6 py-2.5">
            Will & Structures
          </TabsTrigger>
          <TabsTrigger value="records" className="text-sm px-6 py-2.5">
            Estate Records
          </TabsTrigger>
        </TabsList>

        <TabsContent value="family" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Personal & Family</CardTitle>
              <CardDescription>From the client record — review before continuing</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="estate-full-name">Full Name *</Label>
                <Input
                  id="estate-full-name"
                  value={inputs.familyInfo.fullName}
                  onChange={(e) => setFamily({ fullName: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="estate-dob">Date of Birth</Label>
                  <Input
                    id="estate-dob"
                    type="date"
                    value={inputs.familyInfo.dateOfBirth}
                    onChange={(e) => setFamily({ dateOfBirth: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="estate-age">Age *</Label>
                  <Input
                    id="estate-age"
                    type="number"
                    value={inputs.familyInfo.age || ''}
                    onChange={(e) => setFamily({ age: parseInt(e.target.value, 10) || 0 })}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Marital Status</Label>
                <Select
                  value={inputs.familyInfo.maritalStatus}
                  onValueChange={(value) =>
                    setFamily({ maritalStatus: value as FamilyInformation['maritalStatus'] })
                  }
                >
                  <SelectTrigger aria-label="Marital status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(MARITAL_STATUS_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="estate-spouse">Spouse Name</Label>
                <Input
                  id="estate-spouse"
                  value={inputs.familyInfo.spouseName ?? ''}
                  onChange={(e) => setFamily({ spouseName: e.target.value })}
                />
              </div>
              <div className="md:col-span-2 text-sm text-muted-foreground">
                Dependants on record: {inputs.dependants.length}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="will" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Will & Structures</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Valid will in place</Label>
                <Select
                  value={inputs.willInfo.hasValidWill}
                  onValueChange={(value) =>
                    setWill({ hasValidWill: value as WillInformation['hasValidWill'] })
                  }
                >
                  <SelectTrigger aria-label="Valid will in place">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(WILL_OPTIONS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Executor nominated</Label>
                <Select
                  value={inputs.willInfo.executorNominated}
                  onValueChange={(value) =>
                    setWill({ executorNominated: value as WillInformation['executorNominated'] })
                  }
                >
                  <SelectTrigger aria-label="Executor nominated">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(EXECUTOR_OPTIONS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Guardian nominated</Label>
                <Select
                  value={inputs.willInfo.guardianNominated}
                  onValueChange={(value) =>
                    setWill({ guardianNominated: value as WillInformation['guardianNominated'] })
                  }
                >
                  <SelectTrigger aria-label="Guardian nominated">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(WILL_OPTIONS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center justify-between rounded-lg border p-3">
                <Label htmlFor="estate-will-update">Will needs updating</Label>
                <Switch
                  id="estate-will-update"
                  checked={inputs.willInfo.willNeedsUpdate}
                  onCheckedChange={(checked) => setWill({ willNeedsUpdate: checked })}
                />
              </div>
              <div className="flex items-center justify-between rounded-lg border p-3">
                <Label htmlFor="estate-offshore">Offshore assets</Label>
                <Switch
                  id="estate-offshore"
                  checked={inputs.hasOffshorAssets}
                  onCheckedChange={(checked) => onChange({ ...inputs, hasOffshorAssets: checked })}
                />
              </div>
              <div className="flex items-center justify-between rounded-lg border p-3">
                <Label htmlFor="estate-trusts">Trusts in place</Label>
                <Switch
                  id="estate-trusts"
                  checked={inputs.hasTrusts}
                  onCheckedChange={(checked) => onChange({ ...inputs, hasTrusts: checked })}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="records" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Estate Records</CardTitle>
              <CardDescription>
                From the client&apos;s assets, liabilities and policies
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="rounded-lg border p-3">
                  <p className="text-muted-foreground">Assets ({inputs.assets.length})</p>
                  <p className="text-lg font-semibold">R{formatCurrency(totalAssets)}</p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-muted-foreground">Liabilities ({inputs.liabilities.length})</p>
                  <p className="text-lg font-semibold">R{formatCurrency(totalLiabilities)}</p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-muted-foreground">
                    Life policies ({inputs.lifePolicies.length})
                  </p>
                  <p className="text-lg font-semibold">R{formatCurrency(totalCover)}</p>
                </div>
              </div>
              {inputs.assets.length === 0 && (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription className="text-sm">
                    No assets are on record. Add them in the client&apos;s Assets section for a
                    meaningful estate calculation.
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <FNAStepNavigation step={1} onNext={handleNext} />
    </div>
  );
}
