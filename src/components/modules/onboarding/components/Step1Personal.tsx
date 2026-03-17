import React from 'react';
import { Label } from '../../../ui/label';
import { Input } from '../../../ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../ui/select';
import { RadioGroup, RadioGroupItem } from '../../../ui/radio-group';
import { StepProps } from '../types';
import { TITLES, GENDERS, MARITAL_STATUSES, MARITAL_REGIMES } from '../constants';
import {
  INPUT_CLASS,
  SELECT_TRIGGER_CLASS,
  LABEL_CLASS,
  SECTION_CONTAINER_SPACED_CLASS,
} from '../form-styles';
import { Info, Users, Heart, Fingerprint } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '../../../ui/tooltip';

import { DateSegmentInput } from './DateSegmentInput';

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

export function Step1Personal({ data, updateData }: StepProps) {
  const showSpouseFields = data.maritalStatus === 'Married' || data.maritalStatus === 'Life Partner';

  return (
    <div className="space-y-10">
      {/* Basic Details */}
      <div>
        <SectionHeader icon={Users} title="Basic Details" description="Your legal name as it appears on official documents" />
        <div className={SECTION_CONTAINER_SPACED_CLASS}>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
            <div className="md:col-span-1">
              <Label htmlFor="title" className={LABEL_CLASS}>Title <span className="text-red-500">*</span></Label>
              <Select value={data.title} onValueChange={(value) => updateData('title', value)}>
                <SelectTrigger id="title" className={SELECT_TRIGGER_CLASS}>
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  {TITLES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="md:col-span-3">
              <Label htmlFor="firstName" className={LABEL_CLASS}>First Name <span className="text-red-500">*</span></Label>
              <Input id="firstName" value={data.firstName} onChange={(e) => updateData('firstName', e.target.value)} placeholder="John" className={INPUT_CLASS} />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div>
              <Label htmlFor="middleName" className={LABEL_CLASS}>Middle Name(s)</Label>
              <Input id="middleName" value={data.middleName} onChange={(e) => updateData('middleName', e.target.value)} placeholder="Optional" className={INPUT_CLASS} />
            </div>
            <div>
              <Label htmlFor="lastName" className={LABEL_CLASS}>Last Name <span className="text-red-500">*</span></Label>
              <Input id="lastName" value={data.lastName} onChange={(e) => updateData('lastName', e.target.value)} placeholder="Smith" className={INPUT_CLASS} />
            </div>
            <div>
              <Label htmlFor="preferredName" className={LABEL_CLASS}>
                Known As
                <FieldHint text="The name you prefer to be called. We'll use this in all correspondence." />
              </Label>
              <Input id="preferredName" value={data.preferredName} onChange={(e) => updateData('preferredName', e.target.value)} placeholder="e.g. Johnny" className={INPUT_CLASS} />
            </div>
          </div>
        </div>
      </div>

      {/* Identification */}
      <div>
        <SectionHeader icon={Fingerprint} title="Identification & Personal Information" description="Required for FICA compliance" />
        <div className={SECTION_CONTAINER_SPACED_CLASS}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <Label htmlFor="dateOfBirth" className={LABEL_CLASS}>Date of Birth <span className="text-red-500">*</span></Label>
              <DateSegmentInput
                id="dateOfBirth"
                value={data.dateOfBirth}
                onChange={(val) => updateData('dateOfBirth', val)}
              />
            </div>
            <div>
              <Label htmlFor="gender" className={LABEL_CLASS}>Gender <span className="text-red-500">*</span></Label>
              <Select value={data.gender} onValueChange={(value) => updateData('gender', value)}>
                <SelectTrigger id="gender" className={SELECT_TRIGGER_CLASS}>
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  {GENDERS.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <Label htmlFor="nationality" className={LABEL_CLASS}>Nationality <span className="text-red-500">*</span></Label>
              <Input id="nationality" value={data.nationality} onChange={(e) => updateData('nationality', e.target.value)} placeholder="South African" className={INPUT_CLASS} />
            </div>
            <div>
              <Label className={LABEL_CLASS}>
                SA Tax Resident?
                <FieldHint text="This affects how your financial planning is structured, particularly for investment and estate planning." />
              </Label>
              <RadioGroup
                value={data.isSATaxResident === null ? '' : data.isSATaxResident ? 'yes' : 'no'}
                onValueChange={(value) => updateData('isSATaxResident', value === 'yes')}
                className="flex gap-4 mt-3"
              >
                <label htmlFor="taxResYes" className="flex items-center gap-2.5 px-4 py-2.5 rounded-lg border border-gray-300 bg-white shadow-sm cursor-pointer hover:border-[#6d28d9]/40 transition-colors has-[*[data-state=checked]]:border-[#6d28d9] has-[*[data-state=checked]]:bg-[#6d28d9]/5 has-[*[data-state=checked]]:shadow-md">
                  <RadioGroupItem value="yes" id="taxResYes" />
                  <span className="text-sm font-medium text-gray-700">Yes</span>
                </label>
                <label htmlFor="taxResNo" className="flex items-center gap-2.5 px-4 py-2.5 rounded-lg border border-gray-300 bg-white shadow-sm cursor-pointer hover:border-[#6d28d9]/40 transition-colors has-[*[data-state=checked]]:border-[#6d28d9] has-[*[data-state=checked]]:bg-[#6d28d9]/5 has-[*[data-state=checked]]:shadow-md">
                  <RadioGroupItem value="no" id="taxResNo" />
                  <span className="text-sm font-medium text-gray-700">No</span>
                </label>
              </RadioGroup>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div>
              <Label htmlFor="idType" className={LABEL_CLASS}>ID Type <span className="text-red-500">*</span></Label>
              <Select value={data.idType} onValueChange={(value) => updateData('idType', value)}>
                <SelectTrigger id="idType" className={SELECT_TRIGGER_CLASS}>
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sa_id">SA ID Number</SelectItem>
                  <SelectItem value="passport">Passport Number</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="md:col-span-2">
              <Label htmlFor="idNumber" className={LABEL_CLASS}>
                {data.idType === 'passport' ? 'Passport Number' : data.idType === 'sa_id' ? 'SA ID Number' : 'ID / Passport Number'} <span className="text-red-500">*</span>
              </Label>
              <Input
                id="idNumber"
                value={data.idNumber}
                onChange={(e) => updateData('idNumber', e.target.value)}
                placeholder={data.idType === 'sa_id' ? '13-digit SA ID number' : data.idType === 'passport' ? 'Passport number' : 'Select ID type first'}
                className={INPUT_CLASS}
                maxLength={data.idType === 'sa_id' ? 13 : undefined}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <Label htmlFor="taxNumber" className={LABEL_CLASS}>Tax Number</Label>
              <Input id="taxNumber" value={data.taxNumber} onChange={(e) => updateData('taxNumber', e.target.value)} placeholder="Optional" className={INPUT_CLASS} />
            </div>
            <div>
              <Label htmlFor="numberOfDependants" className={LABEL_CLASS}>
                Number of Dependants
                <FieldHint text="Includes children, elderly parents, or anyone financially dependent on you. Helps us assess your risk and cover needs." />
              </Label>
              <Select value={data.numberOfDependants} onValueChange={(value) => updateData('numberOfDependants', value)}>
                <SelectTrigger id="numberOfDependants" className={SELECT_TRIGGER_CLASS}>
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  {['0', '1', '2', '3', '4', '5', '6+'].map(n => <SelectItem key={n} value={n}>{n}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </div>

      {/* Marital Status */}
      <div>
        <SectionHeader icon={Heart} title="Marital Status" description="Your marital regime affects estate and financial planning" />
        <div className={SECTION_CONTAINER_SPACED_CLASS}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <Label htmlFor="maritalStatus" className={LABEL_CLASS}>Status <span className="text-red-500">*</span></Label>
              <Select value={data.maritalStatus} onValueChange={(value) => updateData('maritalStatus', value)}>
                <SelectTrigger id="maritalStatus" className={SELECT_TRIGGER_CLASS}>
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  {MARITAL_STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {showSpouseFields && (
              <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                <Label htmlFor="maritalRegime" className={LABEL_CLASS}>
                  Marital Regime <span className="text-red-500">*</span>
                  <FieldHint text="Your marital regime determines how assets are shared. If unsure, check your antenuptial contract (ANC)." />
                </Label>
                <Select value={data.maritalRegime} onValueChange={(value) => updateData('maritalRegime', value)}>
                  <SelectTrigger id="maritalRegime" className={SELECT_TRIGGER_CLASS}>
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent>
                    {MARITAL_REGIMES.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          {/* Regime explanation */}
          {showSpouseFields && data.maritalRegime && (
            <div className="animate-in fade-in duration-300 p-4 bg-blue-50 rounded-lg border border-blue-200">
              <p className="text-xs text-blue-800 leading-relaxed">
                {data.maritalRegime === 'In Community of Property' && (
                  <span><strong>In Community of Property:</strong> All assets and liabilities are jointly owned. This has significant implications for estate planning and creditor protection.</span>
                )}
                {data.maritalRegime === 'Out of Community of Property (with accrual)' && (
                  <span><strong>ANC with Accrual:</strong> Separate estates during the marriage, with accrual sharing at dissolution. Each spouse keeps what they brought in, but growth is shared.</span>
                )}
                {data.maritalRegime === 'Out of Community of Property (without accrual)' && (
                  <span><strong>ANC without Accrual:</strong> Complete separation of estates. Each spouse&apos;s assets and debts remain their own throughout the marriage.</span>
                )}
              </p>
            </div>
          )}

          {/* Spouse Details */}
          {showSpouseFields && (
            <div className="animate-in fade-in slide-in-from-top-4 duration-300 pt-5 border-t border-gray-200">
              <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-5">
                Spouse / Partner Details
                <span className="ml-2 text-gray-400 font-normal normal-case tracking-normal">(helps us prepare for your first meeting)</span>
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <Label htmlFor="spouseFirstName" className={LABEL_CLASS}>Spouse First Name</Label>
                  <Input id="spouseFirstName" value={data.spouseFirstName} onChange={(e) => updateData('spouseFirstName', e.target.value)} placeholder="First name" className={INPUT_CLASS} />
                </div>
                <div>
                  <Label htmlFor="spouseLastName" className={LABEL_CLASS}>Spouse Last Name</Label>
                  <Input id="spouseLastName" value={data.spouseLastName} onChange={(e) => updateData('spouseLastName', e.target.value)} placeholder="Last name" className={INPUT_CLASS} />
                </div>
                <div>
                  <Label htmlFor="spouseDateOfBirth" className={LABEL_CLASS}>Spouse Date of Birth</Label>
                  <DateSegmentInput
                    id="spouseDateOfBirth"
                    value={data.spouseDateOfBirth}
                    onChange={(val) => updateData('spouseDateOfBirth', val)}
                  />
                </div>
                <div>
                  <Label htmlFor="spouseEmployed" className={LABEL_CLASS}>Spouse Employment Status</Label>
                  <Select value={data.spouseEmployed} onValueChange={(value) => updateData('spouseEmployed', value)}>
                    <SelectTrigger id="spouseEmployed" className={SELECT_TRIGGER_CLASS}>
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="employed">Employed</SelectItem>
                      <SelectItem value="self-employed">Self-Employed</SelectItem>
                      <SelectItem value="unemployed">Not Employed</SelectItem>
                      <SelectItem value="retired">Retired</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}