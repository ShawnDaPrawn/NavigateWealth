/**
 * Step1Business of the employee benefits quote wizard. One step slice —
 * see EmployeeBenefitsQuoteWizard.tsx for the state machine.
 */
import { useState } from 'react';
import { Input } from '../../../../ui/input';
import { Label } from '../../../../ui/label';
import { ChevronDown } from 'lucide-react';
import {
  EMPLOYEE_COUNT_OPTIONS,
  INDUSTRY_SECTORS,
  SA_PROVINCES,
  type BusinessState,
} from './model';

export function Step1Business({
  business,
  onChange,
}: {
  business: BusinessState;
  onChange: (b: BusinessState) => void;
}) {
  const [sectorOpen, setSectorOpen] = useState(false);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-bold text-gray-900 mb-1">Tell us about your business</h2>
        <p className="text-sm text-gray-500">
          Basic company information to help us prepare your employee benefits proposal.
        </p>
      </div>

      <div className="space-y-1.5">
        <Label className="text-sm font-medium text-gray-700">
          Registered company name <span className="text-red-500">*</span>
        </Label>
        <Input
          type="text"
          placeholder="e.g. Acme Holdings (Pty) Ltd"
          value={business.company_name}
          onChange={(e) => onChange({ ...business, company_name: e.target.value })}
          className="bg-white border-gray-300 h-11"
        />
      </div>

      <div className="space-y-1.5">
        <Label className="text-sm font-medium text-gray-700">
          Trading name <span className="text-gray-400 text-xs">(optional, if different)</span>
        </Label>
        <Input
          type="text"
          placeholder="e.g. Acme Solutions"
          value={business.trading_name}
          onChange={(e) => onChange({ ...business, trading_name: e.target.value })}
          className="bg-white border-gray-300 h-11"
        />
      </div>

      {/* Industry sector dropdown */}
      <div className="space-y-1.5">
        <Label className="text-sm font-medium text-gray-700">
          Industry sector <span className="text-red-500">*</span>
        </Label>
        <div className="relative">
          <button
            type="button"
            onClick={() => setSectorOpen(!sectorOpen)}
            className={`w-full flex items-center justify-between h-11 px-3 rounded-md border text-sm text-left transition-colors ${
              business.industry_sector
                ? 'border-gray-300 bg-white text-gray-900'
                : 'border-gray-300 bg-white text-gray-400'
            }`}
          >
            {business.industry_sector || 'Select industry sector'}
            <ChevronDown
              className={`h-4 w-4 text-gray-400 transition-transform ${sectorOpen ? 'rotate-180' : ''}`}
            />
          </button>
          {sectorOpen && (
            <div className="absolute z-20 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
              {INDUSTRY_SECTORS.map((sector) => (
                <button
                  key={sector}
                  type="button"
                  onClick={() => {
                    onChange({ ...business, industry_sector: sector });
                    setSectorOpen(false);
                  }}
                  className={`w-full text-left px-3 py-2.5 text-sm hover:bg-gray-50 transition-colors ${
                    business.industry_sector === sector
                      ? 'bg-primary/5 text-primary font-medium'
                      : 'text-gray-700'
                  }`}
                >
                  {sector}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Employee count */}
      <div className="space-y-2">
        <Label className="text-sm font-medium text-gray-700">
          Number of employees <span className="text-red-500">*</span>
        </Label>
        <div className="flex flex-wrap gap-2">
          {EMPLOYEE_COUNT_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChange({ ...business, employee_count: opt.value })}
              className={`px-3.5 py-2 rounded-lg border text-sm font-medium transition-all ${
                business.employee_count === opt.value
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Province */}
      <div className="space-y-2">
        <Label className="text-sm font-medium text-gray-700">
          Location (Province) <span className="text-red-500">*</span>
        </Label>
        <div className="flex flex-wrap gap-2">
          {SA_PROVINCES.map((prov) => (
            <button
              key={prov}
              type="button"
              onClick={() => onChange({ ...business, province: prov })}
              className={`px-3.5 py-2 rounded-lg border text-sm font-medium transition-all ${
                business.province === prov
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
              }`}
            >
              {prov}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
