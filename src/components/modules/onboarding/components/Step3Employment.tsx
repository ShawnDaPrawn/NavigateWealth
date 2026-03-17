import React from 'react';
import { Label } from '../../../ui/label';
import { Input } from '../../../ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../ui/select';
import { Textarea } from '../../../ui/textarea';
import { StepProps } from '../types';
import { INDUSTRIES, INCOME_RANGES, EXPENSE_RANGES } from '../constants';
import {
  INPUT_CLASS,
  SELECT_TRIGGER_CLASS,
  TEXTAREA_CLASS,
  LABEL_CLASS,
  SECTION_CONTAINER_CLASS,
  SECTION_CONTAINER_SPACED_CLASS,
} from '../form-styles';
import { Briefcase, DollarSign, Info, Building2 } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '../../../ui/tooltip';

function FieldHint({ text }: { text: string }) {
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button type="button" className="inline-flex ml-1 text-gray-400 hover:text-gray-600 transition-colors">
            <Info className="h-3.5 w-3.5" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-[260px] text-xs">
          <p>{text}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function SectionHeader({ icon: Icon, title, description }: { icon: React.ElementType; title: string; description?: string }) {
  return (
    <div className="flex items-center gap-3 mb-5">
      <div className="h-9 w-9 rounded-lg bg-[#6d28d9]/10 flex items-center justify-center flex-shrink-0">
        <Icon className="h-4.5 w-4.5 text-[#6d28d9]" />
      </div>
      <div>
        <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">{title}</h3>
        {description && <p className="text-xs text-gray-500 mt-0.5">{description}</p>}
      </div>
    </div>
  );
}

export function Step3Employment({ data, updateData }: StepProps) {
  const showEmployerFields = data.employmentStatus === 'employed' || data.employmentStatus === 'contract';
  const showSelfEmployedFields = data.employmentStatus === 'self-employed';
  const showIncomeFields = data.employmentStatus && data.employmentStatus !== '';

  return (
    <div className="space-y-10">
      {/* Employment Status */}
      <div>
        <SectionHeader icon={Briefcase} title="Employment Status" />
        <div className={SECTION_CONTAINER_CLASS}>
          <div>
            <Label htmlFor="employmentStatus" className={LABEL_CLASS}>Current Status <span className="text-red-500">*</span></Label>
            <Select value={data.employmentStatus} onValueChange={(value) => updateData('employmentStatus', value)}>
              <SelectTrigger id="employmentStatus" className={`${SELECT_TRIGGER_CLASS} max-w-md`}>
                <SelectValue placeholder="Select your employment status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="employed">Employed</SelectItem>
                <SelectItem value="self-employed">Self-Employed</SelectItem>
                <SelectItem value="retired">Retired</SelectItem>
                <SelectItem value="student">Student</SelectItem>
                <SelectItem value="unemployed">Unemployed</SelectItem>
                <SelectItem value="contract">Contract Worker</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Employer Details */}
      {showEmployerFields && (
        <div className="animate-in fade-in slide-in-from-top-4 duration-300">
          <SectionHeader icon={Building2} title="Employer Details" description="Information about your current employer" />
          <div className={SECTION_CONTAINER_SPACED_CLASS}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <Label htmlFor="jobTitle" className={LABEL_CLASS}>Job Title <span className="text-red-500">*</span></Label>
                <Input id="jobTitle" value={data.jobTitle} onChange={(e) => updateData('jobTitle', e.target.value)} placeholder="e.g. Financial Manager" className={INPUT_CLASS} />
              </div>
              <div>
                <Label htmlFor="employerName" className={LABEL_CLASS}>Employer Name <span className="text-red-500">*</span></Label>
                <Input id="employerName" value={data.employerName} onChange={(e) => updateData('employerName', e.target.value)} placeholder="Company Name" className={INPUT_CLASS} />
              </div>
            </div>
            <div>
              <Label htmlFor="industry" className={LABEL_CLASS}>Industry <span className="text-red-500">*</span></Label>
              <Select value={data.industry} onValueChange={(value) => {
                updateData('industry', value);
                if (value !== 'Other') updateData('industryOther', '');
              }}>
                <SelectTrigger id="industry" className={`${SELECT_TRIGGER_CLASS} max-w-md`}>
                  <SelectValue placeholder="Select industry" />
                </SelectTrigger>
                <SelectContent className="max-h-[280px]">
                  {INDUSTRIES.map(i => <SelectItem key={i} value={i}>{i}</SelectItem>)}
                </SelectContent>
              </Select>
              {data.industry === 'Other' && (
                <div className="mt-3 animate-in fade-in slide-in-from-top-2 duration-200">
                  <Label htmlFor="industryOther" className={LABEL_CLASS}>Please specify your industry <span className="text-red-500">*</span></Label>
                  <Input
                    id="industryOther"
                    value={data.industryOther}
                    onChange={(e) => updateData('industryOther', e.target.value)}
                    placeholder="e.g. Cryptocurrency, Space Technology"
                    className={`${INPUT_CLASS} max-w-md`}
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Self-Employed Details */}
      {showSelfEmployedFields && (
        <div className="animate-in fade-in slide-in-from-top-4 duration-300">
          <SectionHeader icon={Building2} title="Business Details" description="Information about your business" />
          <div className={SECTION_CONTAINER_SPACED_CLASS}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <Label htmlFor="selfEmployedCompanyName" className={LABEL_CLASS}>Company / Trading Name</Label>
                <Input id="selfEmployedCompanyName" value={data.selfEmployedCompanyName} onChange={(e) => updateData('selfEmployedCompanyName', e.target.value)} placeholder="Your Business Name" className={INPUT_CLASS} />
              </div>
              <div>
                <Label htmlFor="selfEmployedIndustry" className={LABEL_CLASS}>Industry <span className="text-red-500">*</span></Label>
                <Select value={data.selfEmployedIndustry} onValueChange={(value) => {
                  updateData('selfEmployedIndustry', value);
                  if (value !== 'Other') updateData('selfEmployedIndustryOther', '');
                }}>
                  <SelectTrigger id="selfEmployedIndustry" className={SELECT_TRIGGER_CLASS}>
                    <SelectValue placeholder="Select industry" />
                  </SelectTrigger>
                  <SelectContent className="max-h-[280px]">
                    {INDUSTRIES.map(i => <SelectItem key={i} value={i}>{i}</SelectItem>)}
                  </SelectContent>
                </Select>
                {data.selfEmployedIndustry === 'Other' && (
                  <div className="mt-3 animate-in fade-in slide-in-from-top-2 duration-200">
                    <Label htmlFor="selfEmployedIndustryOther" className={LABEL_CLASS}>Please specify your industry <span className="text-red-500">*</span></Label>
                    <Input
                      id="selfEmployedIndustryOther"
                      value={data.selfEmployedIndustryOther}
                      onChange={(e) => updateData('selfEmployedIndustryOther', e.target.value)}
                      placeholder="e.g. Cryptocurrency, Space Technology"
                      className={INPUT_CLASS}
                    />
                  </div>
                )}
              </div>
            </div>
            <div>
              <Label htmlFor="selfEmployedDescription" className={LABEL_CLASS}>Nature of Business <span className="text-red-500">*</span></Label>
              <Textarea id="selfEmployedDescription" value={data.selfEmployedDescription} onChange={(e) => updateData('selfEmployedDescription', e.target.value)} placeholder="Briefly describe what your business does..." className={`${TEXTAREA_CLASS} h-24`} />
            </div>
          </div>
        </div>
      )}

      {/* Income Information */}
      {showIncomeFields && (
        <div className="animate-in fade-in slide-in-from-top-4 duration-300">
          <SectionHeader
            icon={DollarSign}
            title="Financial Overview"
            description="A rough estimate helps your advisor prepare — exact figures are not required"
          />
          <div className={SECTION_CONTAINER_CLASS}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <Label htmlFor="grossMonthlyIncome" className={LABEL_CLASS}>
                  Gross Monthly Income
                  <FieldHint text="Your total monthly income before deductions. This helps us understand your financial position for planning purposes. Select 'Prefer not to say' if you'd rather discuss this in person." />
                </Label>
                <Select value={data.grossMonthlyIncome} onValueChange={(value) => updateData('grossMonthlyIncome', value)}>
                  <SelectTrigger id="grossMonthlyIncome" className={SELECT_TRIGGER_CLASS}>
                    <SelectValue placeholder="Select range" />
                  </SelectTrigger>
                  <SelectContent>
                    {INCOME_RANGES.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="monthlyExpensesEstimate" className={LABEL_CLASS}>
                  Estimated Monthly Expenses
                  <FieldHint text="An approximate total of your monthly expenses including bond/rent, insurance, food, transport, etc." />
                </Label>
                <Select value={data.monthlyExpensesEstimate} onValueChange={(value) => updateData('monthlyExpensesEstimate', value)}>
                  <SelectTrigger id="monthlyExpensesEstimate" className={SELECT_TRIGGER_CLASS}>
                    <SelectValue placeholder="Select range" />
                  </SelectTrigger>
                  <SelectContent>
                    {EXPENSE_RANGES.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <p className="text-xs text-gray-400 mt-4">
              These ranges help your advisor prepare for your first meeting. You can discuss specifics in person.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}