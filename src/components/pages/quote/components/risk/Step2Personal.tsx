/**
 * Step2Personal of the risk quote wizard. One step slice —
 * see RiskQuoteWizard.tsx for the state machine.
 */
import { Input } from '../../../../ui/input';
import { Label } from '../../../../ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../../ui/select';
import { AlertTriangle } from 'lucide-react';
import {
  MARITAL_OPTIONS,
  QUALIFICATION_OPTIONS,
  SMOKER_OPTIONS,
  formatCurrency,
  needsSpouseIncome,
  parseCurrencyToNumber,
  type PersonalDetails,
} from './model';

export function Step2Personal({
  details,
  onChange,
}: {
  details: PersonalDetails;
  onChange: (d: PersonalDetails) => void;
}) {
  const update = (field: keyof PersonalDetails, value: string) => {
    onChange({ ...details, [field]: value });
  };

  const grossNum = parseCurrencyToNumber(details.income_gross_monthly);
  const netNum = parseCurrencyToNumber(details.income_net_monthly);
  const showNetWarning = grossNum > 0 && netNum > 0 && netNum > grossNum;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-bold text-gray-900 mb-1">Tell us a bit about you</h2>
        <p className="text-sm text-gray-500">These details help us provide an accurate quote.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Occupation */}
        <div className="sm:col-span-2 space-y-1.5">
          <Label className="text-sm font-medium text-gray-700">
            Occupation <span className="text-red-500">*</span>
          </Label>
          <Input
            type="text"
            placeholder="e.g. Project Manager"
            value={details.occupation}
            onChange={(e) => update('occupation', e.target.value)}
            className="bg-white border-gray-300 h-11"
          />
        </div>

        {/* Gross income */}
        <div className="space-y-1.5">
          <Label className="text-sm font-medium text-gray-700">
            Gross monthly income <span className="text-red-500">*</span>
          </Label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">
              R
            </span>
            <Input
              type="text"
              inputMode="numeric"
              placeholder="e.g. 85 000"
              value={details.income_gross_monthly}
              onChange={(e) => update('income_gross_monthly', formatCurrency(e.target.value))}
              className="pl-8 bg-white border-gray-300 h-11"
            />
          </div>
        </div>

        {/* Net income */}
        <div className="space-y-1.5">
          <Label className="text-sm font-medium text-gray-700">
            Net monthly income <span className="text-red-500">*</span>
          </Label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">
              R
            </span>
            <Input
              type="text"
              inputMode="numeric"
              placeholder="e.g. 62 000"
              value={details.income_net_monthly}
              onChange={(e) => update('income_net_monthly', formatCurrency(e.target.value))}
              className="pl-8 bg-white border-gray-300 h-11"
            />
          </div>
          {showNetWarning && (
            <p className="text-xs text-amber-600 flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" />
              Net income is usually lower than gross -- please double-check.
            </p>
          )}
        </div>

        {/* Smoker status */}
        <div className="space-y-1.5">
          <Label className="text-sm font-medium text-gray-700">
            Smoker status <span className="text-red-500">*</span>
          </Label>
          <Select value={details.smoker_status} onValueChange={(v) => update('smoker_status', v)}>
            <SelectTrigger className="h-11 bg-white border-gray-300">
              <SelectValue placeholder="Select..." />
            </SelectTrigger>
            <SelectContent>
              {SMOKER_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Qualification */}
        <div className="space-y-1.5">
          <Label className="text-sm font-medium text-gray-700">Highest qualification</Label>
          <Select
            value={details.highest_qualification}
            onValueChange={(v) => update('highest_qualification', v)}
          >
            <SelectTrigger className="h-11 bg-white border-gray-300">
              <SelectValue placeholder="Select..." />
            </SelectTrigger>
            <SelectContent>
              {QUALIFICATION_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Marital status */}
        <div className="space-y-1.5">
          <Label className="text-sm font-medium text-gray-700">
            Marital status <span className="text-red-500">*</span>
          </Label>
          <Select value={details.marital_status} onValueChange={(v) => update('marital_status', v)}>
            <SelectTrigger className="h-11 bg-white border-gray-300">
              <SelectValue placeholder="Select..." />
            </SelectTrigger>
            <SelectContent>
              {MARITAL_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Spouse income (conditional) */}
        {needsSpouseIncome(details.marital_status) && (
          <div className="space-y-1.5">
            <Label className="text-sm font-medium text-gray-700">
              Spouse / partner monthly income <span className="text-red-500">*</span>
            </Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">
                R
              </span>
              <Input
                type="text"
                inputMode="numeric"
                placeholder="e.g. 45 000"
                value={details.spouse_income_monthly}
                onChange={(e) => update('spouse_income_monthly', formatCurrency(e.target.value))}
                className="pl-8 bg-white border-gray-300 h-11"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
