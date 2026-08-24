/**
 * The Assumptions calculator for a policy's estimated maturity value.
 *
 * WHY THIS IS ITS OWN MODULE-LEVEL COMPONENT
 * ------------------------------------------
 * This was declared inside PolicyFormDialog's body. A component created during
 * render is a NEW component type on every render, so React cannot reconcile it
 * with the previous one — it unmounts the old subtree and mounts a fresh one.
 * Everything held in this component's state went with it: `open`, and the
 * growth/escalation rates the adviser was part way through typing.
 *
 * The trigger was ordinary editing. Any other field on the policy form calls
 * handleFieldChange -> setFormData -> PolicyFormDialog re-renders -> this tool
 * remounts -> the open dialog disappears and the half-entered rates are gone,
 * with no error and nothing written.
 *
 * Declared at module scope the identity is stable, so the dialog survives its
 * parent re-rendering. Everything it used to close over is now an explicit
 * prop, which is also what makes that guarantee visible rather than incidental.
 */
import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Calculator } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from '../../ui/dialog';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import { formatCurrency } from '../../../utils/currencyFormatter';
import { calculateRetirementMaturityValue } from '../../../utils/retirementCalculations';
import { findFieldByKeyIds, type ProductField } from './policyFormModel';

export interface PolicyAssumptionsToolProps {
  /** The maturity-value field this tool writes its result into. */
  field: ProductField;
  /** The active product schema, used to locate the related assumption fields. */
  tableStructure: ProductField[];
  /** Current form values, keyed by field id. */
  formData: Record<string, unknown>;
  /** Writes a value back into the policy form. */
  handleFieldChange: (fieldId: string, value: string | number | boolean) => void;
}

export function PolicyAssumptionsTool({
  field,
  tableStructure,
  formData,
  handleFieldChange,
}: PolicyAssumptionsToolProps) {
  const [open, setOpen] = useState(false);

  // Determine context (Retirement vs Investment)
  const isInvestment = field.keyId === 'invest_maturity_value';

  // Key mappings
  const growthKey = isInvestment ? 'invest_assumptions_growth' : 'retirement_assumptions_growth';
  const escalationKey = isInvestment
    ? 'invest_assumptions_escalation'
    : 'retirement_assumptions_escalation';
  // Note: For voluntary investments, keys are mapped to invest_voluntary category but IDs remain invest_...
  const maturityKey = isInvestment ? 'invest_maturity_date' : 'retirement_maturity_date';
  const contributionKey = isInvestment
    ? 'invest_monthly_contribution'
    : 'retirement_monthly_contribution';

  // Find related fields by keyId
  const growthField = tableStructure.find((f) => f.keyId === growthKey);
  const escalationField = tableStructure.find((f) => f.keyId === escalationKey);
  const currentValueField = isInvestment
    ? findFieldByKeyIds(tableStructure, ['invest_current_value'])
    : findFieldByKeyIds(tableStructure, ['retirement_current_value', 'retirement_fund_value']);
  const maturityDateField = tableStructure.find((f) => f.keyId === maturityKey);
  const contributionField = tableStructure.find((f) => f.keyId === contributionKey);
  const inceptionKey = isInvestment ? 'invest_date_of_inception' : 'retirement_date_of_inception';
  const inceptionField = tableStructure.find((f) => f.keyId === inceptionKey);

  // Get current values (0% escalation = no annual premium increase; growth defaults to 10%)
  const growth = growthField ? Number(formData[growthField.id] ?? 10) : 10;
  const growthNum = Number.isFinite(growth) ? growth : 10;
  const escalation = escalationField ? Number(formData[escalationField.id] ?? 0) : 0;
  const escalationNum = Number.isFinite(escalation) ? escalation : 0;
  const currentValue = currentValueField ? Number(formData[currentValueField.id]) || 0 : 0;
  const contribution = contributionField ? Number(formData[contributionField.id]) || 0 : 0;
  const maturityDate = maturityDateField
    ? (formData[maturityDateField.id] as string | number | Date | null)
    : null;
  const inceptionRaw = inceptionField ? formData[inceptionField.id] : null;

  // Temporary state for the modal
  const [tempGrowth, setTempGrowth] = useState(growthNum);
  const [tempEscalation, setTempEscalation] = useState(escalationNum);

  useEffect(() => {
    if (open) {
      setTempGrowth(growthNum);
      setTempEscalation(escalationNum);
    }
  }, [open, growthNum, escalationNum]);

  const handleCalculate = () => {
    if (!maturityDate) {
      toast.error('Please select a Maturity Date first');
      return;
    }

    // Update assumption fields (if they exist in the schema)
    if (growthField) handleFieldChange(growthField.id, Number(tempGrowth));
    if (escalationField) handleFieldChange(escalationField.id, Number(tempEscalation));

    // Calculate result
    let maturityCalcOptions: { premiumAnniversaryReference: Date } | undefined;
    if (inceptionRaw != null && inceptionRaw !== '') {
      const inc = new Date(inceptionRaw as string | number | Date);
      if (!Number.isNaN(inc.getTime())) {
        maturityCalcOptions = { premiumAnniversaryReference: inc };
      }
    }

    const result = calculateRetirementMaturityValue(
      currentValue,
      contribution,
      Number(tempGrowth),
      Number(tempEscalation),
      new Date(),
      new Date(maturityDate),
      maturityCalcOptions,
    );

    // Update estimated value
    handleFieldChange(field.id, result);
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="h-6 text-xs px-2 border-dashed border-purple-300 text-purple-700 hover:bg-purple-50"
        >
          <Calculator className="w-3 h-3 mr-1.5" />
          Assumptions
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>{isInvestment ? 'Investment' : 'Retirement'} Assumptions</DialogTitle>
          <DialogDescription>
            Growth and premium escalation (0% = none). With a date of inception captured, escalation
            applies on each policy anniversary; otherwise it applies every 12 months from today.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="bg-gray-50 p-3 rounded-md text-xs space-y-1 mb-2">
            <div className="flex justify-between">
              <span className="text-gray-500">Current Value:</span>
              <span className="font-medium">{formatCurrency(currentValue)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Monthly Contribution:</span>
              <span className="font-medium">{formatCurrency(contribution)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Maturity Date:</span>
              <span className="font-medium">
                {maturityDate ? new Date(maturityDate).toLocaleDateString() : '-'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Inception (anniversary):</span>
              <span className="font-medium">
                {inceptionRaw
                  ? new Date(inceptionRaw as string | number | Date).toLocaleDateString()
                  : '—'}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="growth" className="text-xs">
                Annual Growth Rate (%)
              </Label>
              <div className="relative">
                <Input
                  id="growth"
                  type="number"
                  value={tempGrowth}
                  onChange={(e) => setTempGrowth(Number(e.target.value))}
                  className="h-9 pr-8"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 text-xs">
                  %
                </span>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="escalation" className="text-xs">
                Annual Premium Escalation (%)
                <span className="block font-normal text-muted-foreground mt-0.5">
                  Use 0 if the premium does not escalate
                </span>
              </Label>
              <div className="relative">
                <Input
                  id="escalation"
                  type="number"
                  value={tempEscalation}
                  onChange={(e) => setTempEscalation(Number(e.target.value))}
                  className="h-9 pr-8"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 text-xs">
                  %
                </span>
              </div>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={handleCalculate} className="w-full bg-purple-600 hover:bg-purple-700">
            Calculate & Apply
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
