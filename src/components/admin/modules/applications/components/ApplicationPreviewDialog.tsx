/**
 * Application Preview Dialog
 *
 * Renders a read-only preview of the client-facing application form
 * so admins can see exactly what prospective clients experience.
 */

import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '../../../../ui/dialog';
import { Button } from '../../../../ui/button';
import { Badge } from '../../../../ui/badge';
import { Card } from '../../../../ui/card';
import { Progress } from '../../../../ui/progress';
import {
  User,
  MapPin,
  Briefcase,
  FileText,
  Shield,
  ArrowRight,
  ArrowLeft,
  CheckCircle,
  Check,
  ChevronRight,
  Eye,
  Monitor,
  Users,
  Fingerprint,
  Heart,
  Mail,
  Clock,
  Building2,
  DollarSign,
  Target,
  Package,
  Scale,
  PenLine,
  type LucideIcon,
} from 'lucide-react';

import { Label } from '../../../../ui/label';
import { Input } from '../../../../ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../../ui/select';
import { Checkbox } from '../../../../ui/checkbox';

const PREVIEW_STEPS: { number: number; title: string; icon: LucideIcon; subtitle: string }[] = [
  { number: 1, title: 'Personal', icon: User, subtitle: 'Tell us about yourself' },
  { number: 2, title: 'Contact', icon: MapPin, subtitle: 'How can we reach you?' },
  { number: 3, title: 'Employment', icon: Briefcase, subtitle: 'Your professional background' },
  { number: 4, title: 'Services', icon: FileText, subtitle: 'What brings you to Navigate Wealth?' },
  { number: 5, title: 'Terms', icon: Shield, subtitle: 'Review and confirm' },
];

const TITLES = ['Mr', 'Mrs', 'Ms', 'Miss', 'Dr', 'Prof'];
const GENDERS = ['Male', 'Female', 'Other', 'Prefer not to say'];
const MARITAL_STATUSES = ['Single', 'Married', 'Divorced', 'Widowed', 'Life Partner'];
const MARITAL_REGIMES = ['In Community of Property', 'Out of Community of Property (with accrual)', 'Out of Community of Property (without accrual)'];
const PROVINCES = ['Eastern Cape', 'Free State', 'Gauteng', 'KwaZulu-Natal', 'Limpopo', 'Mpumalanga', 'Northern Cape', 'North West', 'Western Cape'];
const ACCOUNT_REASON_OPTIONS = [
  'Investment Management', 'Life Assurance', 'Medical Aid', 'Estate Planning',
  'Retirement Planning', 'Tax Planning', 'Risk Management', 'Financial Planning',
  'Employee Benefits', 'Other',
];
const URGENCY_OPTIONS = [
  { value: 'immediately', label: 'Immediately', description: "I need to get started right away" },
  { value: 'within_1_month', label: 'Within 1 month', description: "I'd like to begin soon" },
  { value: 'within_3_months', label: 'Within 3 months', description: "I'm planning ahead" },
  { value: 'exploring', label: 'Just exploring', description: "I want to understand my options" },
];

const EXISTING_PRODUCTS = [
  'Retirement Annuity', 'Pension / Provident Fund', 'Life Insurance', 'Disability Cover',
  'Medical Aid', 'Unit Trust', 'Endowment', 'Tax-Free Savings Account',
  'Offshore Investment', 'Estate Planning', 'Short-term Insurance', 'None of the above',
];

function PreviewSectionHeader({ icon: Icon, title, description }: { icon: React.ElementType; title: string; description?: string }) {
  return (
    <div className="flex items-center gap-2.5 mb-4">
      <div className="h-7 w-7 rounded-md bg-[#6d28d9]/10 flex items-center justify-center flex-shrink-0">
        <Icon className="h-3.5 w-3.5 text-[#6d28d9]" />
      </div>
      <div>
        <h3 className="text-xs font-semibold text-gray-900 uppercase tracking-wide">{title}</h3>
        {description && <p className="text-[10px] text-gray-500 mt-0.5">{description}</p>}
      </div>
    </div>
  );
}

interface ApplicationPreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function PreviewStep1() {
  return (
    <div className="space-y-6">
      <div>
        <PreviewSectionHeader icon={Users} title="Basic Details" description="Your legal name as it appears on official documents" />
        <div className="bg-gray-50/60 border border-gray-100 rounded-lg p-4 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div className="md:col-span-1">
              <Label className="text-xs">Title *</Label>
              <Select value="Mr" disabled>
                <SelectTrigger className="mt-1 opacity-75 h-9 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>{TITLES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="md:col-span-3">
              <Label className="text-xs">First Name *</Label>
              <Input value="John" readOnly className="mt-1 opacity-75 h-9 text-xs" />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <Label className="text-xs">Middle Name(s)</Label>
              <Input placeholder="Optional" readOnly className="mt-1 opacity-75 h-9 text-xs" />
            </div>
            <div>
              <Label className="text-xs">Last Name *</Label>
              <Input value="Smith" readOnly className="mt-1 opacity-75 h-9 text-xs" />
            </div>
            <div>
              <Label className="text-xs">Known As</Label>
              <Input placeholder="e.g. Johnny" readOnly className="mt-1 opacity-75 h-9 text-xs" />
            </div>
          </div>
        </div>
      </div>

      <div>
        <PreviewSectionHeader icon={Fingerprint} title="Identification & Personal Information" description="Required for FICA compliance" />
        <div className="bg-gray-50/60 border border-gray-100 rounded-lg p-4 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Date of Birth *</Label>
              <Input type="date" value="1985-03-15" readOnly className="mt-1 opacity-75 h-9 text-xs" />
            </div>
            <div>
              <Label className="text-xs">Gender *</Label>
              <Select value="Male" disabled>
                <SelectTrigger className="mt-1 opacity-75 h-9 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>{GENDERS.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Nationality *</Label>
              <Input value="South African" readOnly className="mt-1 opacity-75 h-9 text-xs" />
            </div>
            <div>
              <Label className="text-xs">SA Tax Resident?</Label>
              <div className="flex gap-4 mt-2">
                <span className="text-xs text-gray-500 flex items-center gap-1.5">
                  <span className="w-3.5 h-3.5 rounded-full border-2 border-[#6d28d9] flex items-center justify-center"><span className="w-1.5 h-1.5 rounded-full bg-[#6d28d9]" /></span>
                  Yes
                </span>
                <span className="text-xs text-gray-400 flex items-center gap-1.5">
                  <span className="w-3.5 h-3.5 rounded-full border-2 border-gray-300" />
                  No
                </span>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <Label className="text-xs">ID Type *</Label>
              <Select value="sa_id" disabled>
                <SelectTrigger className="mt-1 opacity-75 h-9 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="sa_id">SA ID Number</SelectItem>
                  <SelectItem value="passport">Passport Number</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="md:col-span-2">
              <Label className="text-xs">SA ID Number *</Label>
              <Input value="850315XXXXXXX" readOnly className="mt-1 opacity-75 h-9 text-xs" />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Tax Number</Label>
              <Input placeholder="Optional" readOnly className="mt-1 opacity-75 h-9 text-xs" />
            </div>
            <div>
              <Label className="text-xs">Number of Dependants</Label>
              <Select value="2" disabled>
                <SelectTrigger className="mt-1 opacity-75 h-9 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {['0', '1', '2', '3', '4', '5', '6+'].map(n => <SelectItem key={n} value={n}>{n}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </div>

      <div>
        <PreviewSectionHeader icon={Heart} title="Marital Status" description="Your marital regime affects estate and financial planning" />
        <div className="bg-gray-50/60 border border-gray-100 rounded-lg p-4 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Status *</Label>
              <Select value="Married" disabled>
                <SelectTrigger className="mt-1 opacity-75 h-9 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>{MARITAL_STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Marital Regime *</Label>
              <Select value="Out of Community of Property (with accrual)" disabled>
                <SelectTrigger className="mt-1 opacity-75 h-9 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>{MARITAL_REGIMES.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div className="pt-2 border-t border-gray-200">
            <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-2">Spouse / Partner Details</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Spouse First Name</Label>
                <Input value="Jane" readOnly className="mt-1 opacity-75 h-9 text-xs" />
              </div>
              <div>
                <Label className="text-xs">Spouse Last Name</Label>
                <Input value="Smith" readOnly className="mt-1 opacity-75 h-9 text-xs" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function PreviewStep2() {
  return (
    <div className="space-y-6">
      <div>
        <PreviewSectionHeader icon={Mail} title="Contact Details" description="Your primary contact information" />
        <div className="bg-gray-50/60 border border-gray-100 rounded-lg p-4 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Email Address *</Label>
              <Input type="email" value="john.smith@example.com" readOnly className="mt-1 opacity-75 h-9 text-xs" />
            </div>
            <div>
              <Label className="text-xs">Alternative Email</Label>
              <Input type="email" readOnly placeholder="Optional" className="mt-1 opacity-75 h-9 text-xs" />
            </div>
            <div>
              <Label className="text-xs">Cellphone Number *</Label>
              <Input type="tel" value="+27 82 123 4567" readOnly className="mt-1 opacity-75 h-9 text-xs" />
            </div>
            <div>
              <Label className="text-xs">Alternative Cellphone</Label>
              <Input type="tel" readOnly placeholder="Optional" className="mt-1 opacity-75 h-9 text-xs" />
            </div>
          </div>
        </div>
      </div>

      <div>
        <PreviewSectionHeader icon={Clock} title="Communication Preferences" description="Help us reach you at the right time, in the right way" />
        <div className="bg-gray-50/60 border border-gray-100 rounded-lg p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Preferred Contact Method</Label>
              <Select value="Email" disabled>
                <SelectTrigger className="mt-1 opacity-75 h-9 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {['Email', 'Phone Call', 'WhatsApp', 'SMS'].map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Best Time to Contact</Label>
              <Select value="Morning (8am–12pm)" disabled>
                <SelectTrigger className="mt-1 opacity-75 h-9 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {['Morning (8am–12pm)', 'Afternoon (12pm–5pm)', 'Evening (5pm–8pm)', 'No preference'].map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </div>

      <div>
        <PreviewSectionHeader icon={MapPin} title="Residential Address" description="Your physical address for FICA purposes" />
        <div className="bg-gray-50/60 border border-gray-100 rounded-lg p-4 space-y-3">
          <div>
            <Label className="text-xs">Address Line 1 *</Label>
            <Input value="123 Main Road" readOnly className="mt-1 opacity-75 h-9 text-xs" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">City *</Label>
              <Input value="Johannesburg" readOnly className="mt-1 opacity-75 h-9 text-xs" />
            </div>
            <div>
              <Label className="text-xs">Province/State *</Label>
              <Select value="Gauteng" disabled>
                <SelectTrigger className="mt-1 opacity-75 h-9 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>{PROVINCES.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Postal Code *</Label>
              <Input value="2196" readOnly className="mt-1 opacity-75 h-9 text-xs" />
            </div>
            <div>
              <Label className="text-xs">Country *</Label>
              <Input value="South Africa" readOnly className="mt-1 opacity-75 h-9 text-xs" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function PreviewStep3() {
  return (
    <div className="space-y-6">
      <div>
        <PreviewSectionHeader icon={Briefcase} title="Employment Status" />
        <div className="bg-gray-50/60 border border-gray-100 rounded-lg p-4">
          <Label className="text-xs">Current Status *</Label>
          <Select value="employed" disabled>
            <SelectTrigger className="mt-1 opacity-75 h-9 text-xs max-w-md"><SelectValue /></SelectTrigger>
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

      <div>
        <PreviewSectionHeader icon={Building2} title="Employer Details" description="Information about your current employer" />
        <div className="bg-gray-50/60 border border-gray-100 rounded-lg p-4 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Job Title *</Label>
              <Input value="Financial Manager" readOnly className="mt-1 opacity-75 h-9 text-xs" />
            </div>
            <div>
              <Label className="text-xs">Employer Name *</Label>
              <Input value="Acme Holdings Ltd" readOnly className="mt-1 opacity-75 h-9 text-xs" />
            </div>
          </div>
          <div>
            <Label className="text-xs">Industry *</Label>
            <Select value="Banking & Finance" disabled>
              <SelectTrigger className="mt-1 opacity-75 h-9 text-xs max-w-md"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Banking & Finance">Banking &amp; Finance</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <div>
        <PreviewSectionHeader icon={DollarSign} title="Financial Overview" description="A rough estimate helps your advisor prepare" />
        <div className="bg-gray-50/60 border border-gray-100 rounded-lg p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Gross Monthly Income</Label>
              <Select value="R80,000 – R120,000" disabled>
                <SelectTrigger className="mt-1 opacity-75 h-9 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="R80,000 – R120,000">R80,000 – R120,000</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Estimated Monthly Expenses</Label>
              <Select value="R40,000 – R60,000" disabled>
                <SelectTrigger className="mt-1 opacity-75 h-9 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="R40,000 – R60,000">R40,000 – R60,000</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <p className="text-[10px] text-gray-400 mt-2">These ranges help your advisor prepare for your first meeting.</p>
        </div>
      </div>
    </div>
  );
}

function PreviewStep4() {
  const selectedReasons = ['Investment Management', 'Retirement Planning', 'Estate Planning'];

  return (
    <div className="space-y-6">
      <div>
        <PreviewSectionHeader icon={Target} title="Services of Interest" description="Select all the areas where you'd like guidance" />
        <div className="bg-gray-50/60 border border-gray-100 rounded-lg p-4">
          <p className="text-xs text-gray-500 mb-3">Please select all that apply *</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {ACCOUNT_REASON_OPTIONS.map((reason) => {
              const isSelected = selectedReasons.includes(reason);
              return (
                <div
                  key={reason}
                  className={`flex items-center gap-2.5 p-2.5 rounded-lg border-2 ${
                    isSelected ? 'bg-[#6d28d9]/5 border-[#6d28d9]/30' : 'bg-white border-gray-100'
                  }`}
                >
                  <div className={`h-4 w-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                    isSelected ? 'bg-[#6d28d9] border-[#6d28d9]' : 'border-gray-300'
                  }`}>
                    {isSelected && <CheckCircle className="h-3 w-3 text-white" />}
                  </div>
                  <span className={`text-xs ${isSelected ? 'font-medium text-gray-900' : 'text-gray-600'}`}>{reason}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div>
        <PreviewSectionHeader icon={Clock} title="Timeline" description="How soon would you like to get started?" />
        <div className="bg-gray-50/60 border border-gray-100 rounded-lg p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {URGENCY_OPTIONS.map((option) => {
              const isSelected = option.value === 'within_1_month';
              return (
                <div key={option.value} className={`p-3 rounded-lg border-2 ${isSelected ? 'bg-[#6d28d9]/5 border-[#6d28d9]/30' : 'bg-white border-gray-100'}`}>
                  <div className="flex items-center gap-2">
                    <div className={`h-3.5 w-3.5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${isSelected ? 'border-[#6d28d9]' : 'border-gray-300'}`}>
                      {isSelected && <div className="h-1.5 w-1.5 rounded-full bg-[#6d28d9]" />}
                    </div>
                    <div>
                      <div className={`text-xs font-medium ${isSelected ? 'text-gray-900' : 'text-gray-600'}`}>{option.label}</div>
                      <div className="text-[10px] text-gray-500">{option.description}</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div>
        <PreviewSectionHeader icon={Package} title="Existing Financial Products" description="Do you currently have any of the following?" />
        <div className="bg-gray-50/60 border border-gray-100 rounded-lg p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1.5">
            {EXISTING_PRODUCTS.map(p => (
              <div key={p} className="flex items-center gap-2 p-2 rounded bg-[#6d28d9]/5 border border-[#6d28d9]/20">
                <Checkbox checked disabled className="h-3.5 w-3.5" />
                <span className="text-xs font-medium text-gray-900">{p}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function PreviewStep5() {
  return (
    <div className="space-y-6">
      <div>
        <PreviewSectionHeader icon={Scale} title="Legal Agreements" description="Please read and accept the following" />
        <div className="bg-gray-50/60 border border-gray-100 rounded-lg p-4 space-y-3">
          {[
            { icon: FileText, label: 'I accept the Terms and Conditions *', desc: "By creating an account, you agree to Navigate Wealth's Terms of Service and Privacy Policy." },
            { icon: Shield, label: 'POPIA Consent *', desc: 'I consent to the processing of my personal information in accordance with POPIA.' },
            { icon: CheckCircle, label: 'Disclosure Acknowledgment *', desc: 'I acknowledge that I have read and understood the disclosure documents provided.' },
            { icon: Scale, label: 'FAIS Disclosure *', desc: 'I acknowledge that Navigate Wealth is an authorised financial services provider under FAIS.' },
          ].map((item, idx) => (
            <div key={idx} className="flex items-start gap-3 p-3 bg-white rounded-lg border border-gray-100">
              <item.icon className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" />
              <div className="space-y-1 flex-1">
                <div className="flex items-center gap-2">
                  <Checkbox checked={false} disabled className="h-3.5 w-3.5" />
                  <Label className="font-medium text-xs">{item.label}</Label>
                </div>
                <p className="text-[10px] text-gray-500 pl-5">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-gray-50/60 border border-gray-100 rounded-lg p-4">
        <div className="flex items-center gap-2">
          <Checkbox checked={false} disabled className="h-3.5 w-3.5" />
          <Label className="font-medium text-xs">I would like to receive marketing communications, newsletters, and market updates</Label>
        </div>
        <p className="text-[10px] text-gray-400 mt-1 pl-5">You can unsubscribe at any time.</p>
      </div>

      <div>
        <PreviewSectionHeader icon={PenLine} title="Digital Signature" description="Type your full legal name to confirm this application" />
        <div className="bg-gray-50/60 border border-gray-100 rounded-lg p-4">
          <Label className="text-xs">Full Legal Name *</Label>
          <Input value="" readOnly placeholder="Type your full name" className="mt-1 opacity-75 h-9 text-xs italic" />
          <p className="text-[10px] text-gray-400 mt-1.5">By typing your name and submitting, you confirm all information is true and accurate.</p>
        </div>
      </div>
    </div>
  );
}

const STEP_COMPONENTS = [PreviewStep1, PreviewStep2, PreviewStep3, PreviewStep4, PreviewStep5];

export function ApplicationPreviewDialog({ open, onOpenChange }: ApplicationPreviewDialogProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const totalSteps = PREVIEW_STEPS.length;
  const progress = ((currentStep - 1) / (totalSteps - 1)) * 100;
  const StepComponent = STEP_COMPONENTS[currentStep - 1];
  const currentStepConfig = PREVIEW_STEPS[currentStep - 1];

  const handleNext = () => {
    if (currentStep < totalSteps) setCurrentStep(prev => prev + 1);
  };

  const handlePrevious = () => {
    if (currentStep > 1) setCurrentStep(prev => prev - 1);
  };

  const handleOpenChange = (isOpen: boolean) => {
    if (isOpen) setCurrentStep(1);
    onOpenChange(isOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-6xl max-h-[92vh] overflow-hidden flex flex-col p-0">
        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-gray-200 bg-gradient-to-r from-purple-50 to-white flex-shrink-0">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3 text-xl">
              <div className="h-9 w-9 rounded-lg bg-[#6d28d9] flex items-center justify-center">
                <Monitor className="h-5 w-5 text-white" />
              </div>
              Client Application Preview
            </DialogTitle>
            <DialogDescription className="text-sm">
              This is a read-only preview of the enhanced application form that prospective clients complete when onboarding with Navigate Wealth.
            </DialogDescription>
          </DialogHeader>
          <Badge variant="outline" className="mt-3 text-xs font-medium border-purple-200 text-purple-700 bg-purple-50">
            <Eye className="h-3 w-3 mr-1.5" />
            Preview Mode — No data is submitted
          </Badge>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto">
          <div className="bg-gradient-to-br from-gray-50 via-white to-purple-50/30 min-h-full">
            <div className="max-w-5xl mx-auto px-6 py-6">
              <div className="flex gap-6">
                {/* Left Sidebar - Steps Navigation */}
                <div className="hidden lg:block lg:w-56 flex-shrink-0">
                  <Card className="p-4 shadow-sm">
                    <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Application Steps</h3>
                    <div className="space-y-1">
                      {PREVIEW_STEPS.map((step) => {
                        const Icon = step.icon;
                        const isCompleted = currentStep > step.number;
                        const isCurrent = currentStep === step.number;

                        return (
                          <div
                            key={step.number}
                            className={`flex items-center gap-2 p-2.5 rounded-lg transition-all cursor-pointer ${
                              isCurrent
                                ? 'bg-[#6d28d9] text-white shadow-md'
                                : isCompleted
                                ? 'bg-green-50 text-green-700'
                                : 'bg-gray-50 text-gray-500 hover:bg-gray-100'
                            }`}
                            onClick={() => setCurrentStep(step.number)}
                          >
                            <div
                              className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${
                                isCurrent ? 'bg-white/20' : isCompleted ? 'bg-green-100' : 'bg-white'
                              }`}
                            >
                              {isCompleted ? (
                                <Check className="h-3.5 w-3.5" />
                              ) : (
                                <Icon className="h-3.5 w-3.5" />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-xs font-medium truncate">{step.title}</div>
                            </div>
                            {isCurrent && <ChevronRight className="h-3.5 w-3.5 flex-shrink-0" />}
                          </div>
                        );
                      })}
                    </div>

                    <div className="mt-3 pt-3 border-t border-gray-200">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[10px] text-gray-500">Progress</span>
                        <span className="text-[10px] font-bold text-[#6d28d9]">{Math.round(progress)}%</span>
                      </div>
                      <Progress value={progress} className="h-1.5" />
                    </div>
                  </Card>
                </div>

                {/* Main Form Area */}
                <div className="flex-1 min-w-0">
                  {/* Mobile step indicator */}
                  <div className="lg:hidden mb-4">
                    <Card className="p-3 shadow-sm">
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <div className="text-sm font-medium text-gray-900">Step {currentStep} of {totalSteps}</div>
                          <div className="text-xs text-gray-500">{currentStepConfig.title}</div>
                        </div>
                        <Badge className="bg-[#6d28d9] hover:bg-[#6d28d9] text-xs">{Math.round(progress)}%</Badge>
                      </div>
                      <Progress value={progress} className="h-1.5" />
                    </Card>
                  </div>

                  <Card className="shadow-lg">
                    {/* Step Header */}
                    <div className="border-b border-gray-100 bg-gradient-to-r from-white via-white to-purple-50/30 p-5">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-[#6d28d9] to-[#5b21b6] flex items-center justify-center shadow-lg shadow-purple-200/40">
                          {React.createElement(currentStepConfig.icon, { className: 'h-5 w-5 text-white' })}
                        </div>
                        <div>
                          <h2 className="text-base font-bold text-gray-900">{currentStepConfig.title} Information</h2>
                          <p className="text-xs text-gray-500 mt-0.5">{currentStepConfig.subtitle}</p>
                        </div>
                      </div>
                    </div>

                    {/* Step Content */}
                    <div className="p-5">
                      <StepComponent />

                      {/* Navigation */}
                      <div className="mt-6 pt-5 border-t border-gray-100 flex items-center justify-between">
                        <Button
                          variant="outline"
                          onClick={handlePrevious}
                          disabled={currentStep === 1}
                          className="h-9 px-5 text-xs"
                        >
                          <ArrowLeft className="mr-1.5 h-3.5 w-3.5" />
                          Previous
                        </Button>

                        {currentStep < totalSteps ? (
                          <Button
                            onClick={handleNext}
                            className="h-9 px-6 text-xs bg-[#6d28d9] hover:bg-[#5b21b6]"
                          >
                            Continue
                            <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                          </Button>
                        ) : (
                          <Button
                            disabled
                            className="h-9 px-6 text-xs bg-green-600 hover:bg-green-700 opacity-60 cursor-not-allowed"
                          >
                            Submit Application
                            <CheckCircle className="ml-1.5 h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </Card>
                </div>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}