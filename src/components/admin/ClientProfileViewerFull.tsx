/**
 * FULL CLIENT PROFILE VIEWER FOR ADMIN
 * Complete feature parity with client ProfilePage
 * 
 * This component replicates ALL functionality from /components/pages/ProfilePage.tsx
 * including CRUD operations, validations, file uploads, risk assessment, and more.
 */

import React, { useState } from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Separator } from '../ui/separator';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';
import { EmptyState } from '../pages/profile/EmptyState';
import { toast } from 'sonner@2.0.3';
import { formatCurrency, formatCurrencyInput, cleanCurrencyInput, formatCurrencyDisplay } from '../../utils/currencyFormatter';
import { 
  User, Mail, Phone, MapPin, Briefcase, Heart, Users, CreditCard, Shield, Target,
  Save, PieChart, Check, Wallet, Loader2, Copy, MoreHorizontal, AlertCircle, Banknote
} from 'lucide-react';
import { AddressSection } from './profile-sections/AddressSection';
import { EmploymentSection } from './profile-sections/EmploymentSection';
import { HealthSection } from './profile-sections/HealthSection';
import { FamilySection } from './profile-sections/FamilySection';
import { BankingSection } from './profile-sections/BankingSection';
import { RiskProfileSection } from './profile-sections/RiskProfileSection';
import { AssetsLiabilitiesSection } from './profile-sections/AssetsLiabilitiesSection';
import { BudgetingPage } from '../pages/BudgetingPage';
import { IdentitySection } from './profile-sections/IdentitySection';
import { FieldWithCopy } from './FieldWithCopy';
import { CountrySelect } from '../pages/profile/CountrySelect';
import { 
  Client, 
  ProfileData, 
} from './modules/client-management/types';
import { useClientProfile } from './modules/client-management/hooks/useClientProfile';
import { copyToClipboard } from '../../utils/clipboard';

// Wrapper component for input with copy button using the reusable FieldWithCopy
const InputWithCopy = ({ 
  label, 
  value, 
  fieldName, 
  ...inputProps 
}: { 
  label: string; 
  value: string | number; 
  fieldName: string; 
  [key: string]: unknown;
}) => {
  return (
    <div>
      <Label htmlFor={inputProps.id}>{label}</Label>
      <FieldWithCopy
        {...inputProps}
        value={value}
        className="mt-1.5"
      />
    </div>
  );
};

// Wrapper component for select with copy button
const SelectWithCopy = ({ 
  label, 
  value, 
  onValueChange,
  placeholder,
  children,
  id
}: { 
  label: string; 
  value: string; 
  onValueChange: (value: string) => void;
  placeholder: string;
  children: React.ReactNode;
  id: string;
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async (e: React.MouseEvent) => {
    // Don't prevent default/propagation as it might interfere with clipboard operations
    // e.preventDefault();
    // e.stopPropagation();
    
    try {
      const textToCopy = String(value || '');
      
      if (!textToCopy) {
        toast.error('Nothing to copy');
        return;
      }

      await copyToClipboard(textToCopy);
      setCopied(true);
      toast.success('Copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast.error('Failed to copy');
    }
  };

  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <div className="relative mt-1.5">
        <Select value={value} onValueChange={onValueChange}>
          <SelectTrigger id={id} className="pr-10">
            <SelectValue placeholder={placeholder} />
          </SelectTrigger>
          <SelectContent>
            {children}
          </SelectContent>
        </Select>
        {value && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleCopy}
            tabIndex={-1}
            className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
          >
            {copied ? (
              <Check className="h-4 w-4 text-green-600" />
            ) : (
              <Copy className="h-4 w-4 text-gray-400 hover:text-gray-600" />
            )}
          </Button>
        )}
      </div>
    </div>
  );
};

interface ClientProfileViewerFullProps {
  clientData: Client;
  onSave?: (data: ProfileData) => void;
}

export function ClientProfileViewerFull({ clientData, onSave }: ClientProfileViewerFullProps) {
  const [activeSection, setActiveSection] = useState('personal');
  const { state, actions } = useClientProfile(clientData, onSave);

  // Local display state for currency inputs
  const [grossIncomeDisplay, setGrossIncomeDisplay] = useState<string | null>(null);
  const [netIncomeDisplay, setNetIncomeDisplay] = useState<string | null>(null);
  const [grossAnnualIncomeDisplay, setGrossAnnualIncomeDisplay] = useState<string | null>(null);
  const [netAnnualIncomeDisplay, setNetAnnualIncomeDisplay] = useState<string | null>(null);

  const sections = [
    { id: 'personal', label: 'Personal Info', icon: User },
    { id: 'contact', label: 'Contact Details', icon: Mail },
    { id: 'identity', label: 'Identity', icon: Shield },
    { id: 'address', label: 'Address', icon: MapPin },
    { id: 'employment', label: 'Employment', icon: Briefcase },
    { id: 'health', label: 'Health Info', icon: Heart },
    { id: 'family', label: 'Family', icon: Users },
    { id: 'banking', label: 'Banking', icon: CreditCard },
    { id: 'risk', label: 'Risk Profile', icon: Target },
    { id: 'assets', label: 'Assets & Liabilities', icon: PieChart },
    { id: 'budgeting', label: 'Budgeting', icon: Wallet }
  ];

  // Show loading state while fetching data
  if (state.loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-[#6d28d9] mb-3" />
          <p className="text-sm text-gray-600">Loading client profile...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* SUBTABS - Level 2: Secondary Navigation within Personal Details tab */}
      <div className="mb-6 pb-4 border-b border-gray-200">
        <div className="flex items-center gap-2 overflow-x-auto">
          {sections.map((section) => {
            const Icon = section.icon;
            return (
              <button
                key={section.id}
                onClick={() => setActiveSection(section.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
                  activeSection === section.id
                    ? 'bg-white text-[#6d28d9] border-2 border-[#6d28d9] shadow-sm'
                    : 'bg-transparent text-gray-600 hover:bg-gray-100 border border-gray-300 hover:border-gray-400'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                <span>{section.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {state.error && (
        <Alert variant="destructive" className="mb-4">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>
            {state.error}
          </AlertDescription>
        </Alert>
      )}

      {state.hasChanges && (
        <div className="mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-yellow-500 animate-pulse"></div>
            <span className="text-sm font-medium text-yellow-900">You have unsaved changes</span>
          </div>
          <Button onClick={actions.handleSave} disabled={state.saving} className="bg-green-600 hover:bg-green-700">
            {state.saving ? <div className="contents"><Loader2 className="h-4 w-4 mr-2 animate-spin" />Saving...</div> : <div className="contents"><Save className="h-4 w-4 mr-2" />Save Changes</div>}
          </Button>
        </div>
      )}

      <div className="flex-1 overflow-y-auto pr-2">
        {/* Personal Information Section */}
        {activeSection === 'personal' && (
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-[#6d28d9]/10 flex items-center justify-center">
                  <User className="h-5 w-5 text-[#6d28d9]" />
                </div>
                <div>
                  <CardTitle>Personal Information</CardTitle>
                  <CardDescription>Basic personal details</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <InputWithCopy 
                    label="Title" 
                    value={state.profileData.title} 
                    id="title"
                    fieldName="title"
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => actions.handleInputChange('title', e.target.value)} 
                  />
                </div>
                <div className="space-y-2">
                  <InputWithCopy 
                    label="First Name" 
                    value={state.profileData.firstName} 
                    id="firstName"
                    fieldName="firstName"
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => actions.handleInputChange('firstName', e.target.value)} 
                  />
                </div>
                <div className="space-y-2">
                  <InputWithCopy 
                    label="Middle Name" 
                    value={state.profileData.middleName} 
                    id="middleName"
                    fieldName="middleName"
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => actions.handleInputChange('middleName', e.target.value)} 
                  />
                </div>
                <div className="space-y-2">
                  <InputWithCopy 
                    label="Last Name" 
                    value={state.profileData.lastName} 
                    id="lastName"
                    fieldName="lastName"
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => actions.handleInputChange('lastName', e.target.value)} 
                  />
                </div>
                <div className="space-y-2">
                  <InputWithCopy 
                    label="Date of Birth" 
                    value={state.profileData.dateOfBirth} 
                    id="dateOfBirth"
                    fieldName="dateOfBirth"
                    type="date"
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => actions.handleInputChange('dateOfBirth', e.target.value)} 
                  />
                </div>
                <div className="space-y-2">
                  <InputWithCopy 
                    label="Age" 
                    value={(() => {
                      if (!state.profileData.dateOfBirth) return '';
                      const birthDate = new Date(state.profileData.dateOfBirth);
                      const today = new Date();
                      let age = today.getFullYear() - birthDate.getFullYear();
                      const monthDiff = today.getMonth() - birthDate.getMonth();
                      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
                        age--;
                      }
                      return age >= 0 ? age : '';
                    })()}
                    id="age"
                    fieldName="age"
                    readOnly
                    className="bg-gray-50 text-gray-500 cursor-not-allowed"
                  />
                </div>
                <div className="space-y-2">
                  <SelectWithCopy 
                    label="Gender" 
                    value={state.profileData.gender} 
                    onValueChange={(value) => actions.handleInputChange('gender', value)}
                    placeholder="Select gender"
                    id="gender"
                  >
                    <SelectItem value="male">Male</SelectItem>
                    <SelectItem value="female">Female</SelectItem>
                  </SelectWithCopy>
                </div>
                <div className="space-y-2">
                  <InputWithCopy 
                    label="Nationality" 
                    value={state.profileData.nationality} 
                    id="nationality"
                    fieldName="nationality"
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => actions.handleInputChange('nationality', e.target.value)} 
                  />
                </div>
                <div className="space-y-2">
                  <InputWithCopy 
                    label="Tax Number" 
                    value={state.profileData.taxNumber} 
                    id="taxNumber"
                    fieldName="taxNumber"
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => actions.handleInputChange('taxNumber', e.target.value)} 
                  />
                </div>
                <div className="space-y-2">
                  <SelectWithCopy 
                    label="Marital Status" 
                    value={state.profileData.maritalStatus} 
                    onValueChange={(value) => actions.handleInputChange('maritalStatus', value)}
                    placeholder="Select status"
                    id="maritalStatus"
                  >
                    <SelectItem value="single">Single</SelectItem>
                    <SelectItem value="married">Married</SelectItem>
                    <SelectItem value="divorced">Divorced</SelectItem>
                    <SelectItem value="widowed">Widowed</SelectItem>
                  </SelectWithCopy>
                </div>
                {state.profileData.maritalStatus === 'married' && (
                  <div className="space-y-2">
                    <SelectWithCopy 
                      label="Marital Regime" 
                      value={state.profileData.maritalRegime} 
                      onValueChange={(value) => actions.handleInputChange('maritalRegime', value)}
                      placeholder="Select regime"
                      id="maritalRegime"
                    >
                      <SelectItem value="in_community">In Community of Property</SelectItem>
                      <SelectItem value="out_community_accrual">Out of Community with Accrual</SelectItem>
                      <SelectItem value="out_community_no_accrual">Out of Community without Accrual</SelectItem>
                    </SelectWithCopy>
                  </div>
                )}
              </div>

              <Separator className="my-6" />
              <div className="flex items-center gap-3 mb-4">
                <div className="h-10 w-10 rounded-full bg-green-500/10 flex items-center justify-center">
                  <Banknote className="h-5 w-5 text-green-600" />
                </div>
                <h3 className="text-lg font-medium">Income Information</h3>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <InputWithCopy 
                    label="Gross Monthly Income (R)" 
                    value={grossIncomeDisplay !== null ? grossIncomeDisplay : formatCurrencyDisplay(state.profileData.grossMonthlyIncome)} 
                    id="grossMonthlyIncome"
                    fieldName="grossMonthlyIncome"
                    type="text"
                    placeholder="0.00"
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                      // Allow raw typing — no reformatting while editing to avoid cursor issues
                      const raw = e.target.value.replace(/[^0-9.]/g, '');
                      setGrossIncomeDisplay(raw);
                    }}
                    onBlur={() => {
                      const numValue = parseFloat(grossIncomeDisplay || '0') || 0;
                      // Only mark dirty if value actually changed
                      if (numValue !== (state.profileData.grossMonthlyIncome || 0)) {
                        actions.handleInputChange('grossMonthlyIncome', numValue);
                      }
                      setGrossIncomeDisplay(null);
                    }}
                    onFocus={() => {
                      if (grossIncomeDisplay === null) {
                        const val = state.profileData.grossMonthlyIncome;
                        setGrossIncomeDisplay(val ? val.toString() : '');
                      }
                    }}
                  />
                </div>
                <div className="space-y-2">
                  <InputWithCopy 
                    label="Net Monthly Income (R)" 
                    value={netIncomeDisplay !== null ? netIncomeDisplay : formatCurrencyDisplay(state.profileData.netMonthlyIncome)} 
                    id="netMonthlyIncome"
                    fieldName="netMonthlyIncome"
                    type="text"
                    placeholder="0.00"
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                      const raw = e.target.value.replace(/[^0-9.]/g, '');
                      setNetIncomeDisplay(raw);
                    }}
                    onBlur={() => {
                      const numValue = parseFloat(netIncomeDisplay || '0') || 0;
                      if (numValue !== (state.profileData.netMonthlyIncome || 0)) {
                        actions.handleInputChange('netMonthlyIncome', numValue);
                      }
                      setNetIncomeDisplay(null);
                    }}
                    onFocus={() => {
                      if (netIncomeDisplay === null) {
                        const val = state.profileData.netMonthlyIncome;
                        setNetIncomeDisplay(val ? val.toString() : '');
                      }
                    }}
                  />
                </div>
                <div className="space-y-2">
                  <InputWithCopy 
                    label="Gross Annual Income (R)" 
                    value={grossAnnualIncomeDisplay !== null ? grossAnnualIncomeDisplay : formatCurrencyDisplay(state.profileData.grossAnnualIncome)} 
                    id="grossAnnualIncome"
                    fieldName="grossAnnualIncome"
                    type="text"
                    placeholder="0.00"
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                      const raw = e.target.value.replace(/[^0-9.]/g, '');
                      setGrossAnnualIncomeDisplay(raw);
                    }}
                    onBlur={() => {
                      const numValue = parseFloat(grossAnnualIncomeDisplay || '0') || 0;
                      if (numValue !== (state.profileData.grossAnnualIncome || 0)) {
                        actions.handleInputChange('grossAnnualIncome', numValue);
                      }
                      setGrossAnnualIncomeDisplay(null);
                    }}
                    onFocus={() => {
                      if (grossAnnualIncomeDisplay === null) {
                        const val = state.profileData.grossAnnualIncome;
                        setGrossAnnualIncomeDisplay(val ? val.toString() : '');
                      }
                    }}
                  />
                </div>
                <div className="space-y-2">
                  <InputWithCopy 
                    label="Net Annual Income (R)" 
                    value={netAnnualIncomeDisplay !== null ? netAnnualIncomeDisplay : formatCurrencyDisplay(state.profileData.netAnnualIncome)} 
                    id="netAnnualIncome"
                    fieldName="netAnnualIncome"
                    type="text"
                    placeholder="0.00"
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                      const raw = e.target.value.replace(/[^0-9.]/g, '');
                      setNetAnnualIncomeDisplay(raw);
                    }}
                    onBlur={() => {
                      const numValue = parseFloat(netAnnualIncomeDisplay || '0') || 0;
                      if (numValue !== (state.profileData.netAnnualIncome || 0)) {
                        actions.handleInputChange('netAnnualIncome', numValue);
                      }
                      setNetAnnualIncomeDisplay(null);
                    }}
                    onFocus={() => {
                      if (netAnnualIncomeDisplay === null) {
                        const val = state.profileData.netAnnualIncome;
                        setNetAnnualIncomeDisplay(val ? val.toString() : '');
                      }
                    }}
                  />
                </div>
              </div>

              <Separator className="my-6" />
              <div className="flex items-center gap-3 mb-4">
                <div className="h-10 w-10 rounded-full bg-blue-500/10 flex items-center justify-center">
                  <Shield className="h-5 w-5 text-blue-600" />
                </div>
                <h3 className="text-lg font-medium">Identity</h3>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="idCountry">ID Country</Label>
                  <div className="mt-1.5">
                    <CountrySelect
                      id="idCountry"
                      value={state.profileData.idCountry}
                      onValueChange={(value) => actions.handleInputChange('idCountry', value)}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <InputWithCopy
                    label="ID Number"
                    value={state.profileData.idNumber}
                    id="idNumber"
                    fieldName="idNumber"
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => actions.handleInputChange('idNumber', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="passportCountry">Passport Country</Label>
                  <div className="mt-1.5">
                    <CountrySelect
                      id="passportCountry"
                      value={state.profileData.passportCountry}
                      onValueChange={(value) => actions.handleInputChange('passportCountry', value)}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <InputWithCopy
                    label="Passport Number"
                    value={state.profileData.passportNumber}
                    id="passportNumber"
                    fieldName="passportNumber"
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => actions.handleInputChange('passportNumber', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="employmentCountry">Country of Employment</Label>
                  <div className="mt-1.5">
                    <CountrySelect
                      id="employmentCountry"
                      value={state.profileData.employmentCountry}
                      onValueChange={(value) => actions.handleInputChange('employmentCountry', value)}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <InputWithCopy
                    label="Work Permit Number"
                    value={state.profileData.workPermitNumber}
                    id="workPermitNumber"
                    fieldName="workPermitNumber"
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => actions.handleInputChange('workPermitNumber', e.target.value)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Contact Details Section */}
        {activeSection === 'contact' && (
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-[#6d28d9]/10 flex items-center justify-center">
                  <Phone className="h-5 w-5 text-[#6d28d9]" />
                </div>
                <div>
                  <CardTitle>Contact Details</CardTitle>
                  <CardDescription>Contact information and preferences</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <InputWithCopy 
                    label="Email" 
                    value={state.profileData.email} 
                    id="email"
                    fieldName="email"
                    type="email"
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => actions.handleInputChange('email', e.target.value)} 
                  />
                </div>
                <div className="space-y-2">
                  <InputWithCopy 
                    label="Secondary Email" 
                    value={state.profileData.secondaryEmail} 
                    id="secondaryEmail"
                    fieldName="secondaryEmail"
                    type="email"
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => actions.handleInputChange('secondaryEmail', e.target.value)} 
                  />
                </div>
                <div className="space-y-2">
                  <InputWithCopy 
                    label="Phone Number" 
                    value={state.profileData.phoneNumber} 
                    id="phoneNumber"
                    fieldName="phoneNumber"
                    type="tel"
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => actions.handleInputChange('phoneNumber', e.target.value)} 
                  />
                </div>
                <div className="space-y-2">
                  <InputWithCopy 
                    label="Alternative Phone" 
                    value={state.profileData.alternativePhone} 
                    id="alternativePhone"
                    fieldName="alternativePhone"
                    type="tel"
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => actions.handleInputChange('alternativePhone', e.target.value)} 
                  />
                </div>
                <div className="space-y-2">
                  <SelectWithCopy 
                    label="Preferred Contact Method" 
                    value={state.profileData.preferredContactMethod} 
                    onValueChange={(value) => actions.handleInputChange('preferredContactMethod', value)}
                    placeholder="Select method"
                    id="preferredContactMethod"
                  >
                    <SelectItem value="email">Email</SelectItem>
                    <SelectItem value="phone">Phone</SelectItem>
                    <SelectItem value="whatsapp">WhatsApp</SelectItem>
                  </SelectWithCopy>
                </div>
              </div>

              <Separator className="my-6" />
              <h3 className="text-lg font-medium mb-4">Emergency Contact</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <InputWithCopy 
                    label="Contact Name" 
                    value={state.profileData.emergencyContactName} 
                    id="emergencyContactName"
                    fieldName="emergencyContactName"
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => actions.handleInputChange('emergencyContactName', e.target.value)} 
                  />
                </div>
                <div className="space-y-2">
                  <InputWithCopy 
                    label="Relationship" 
                    value={state.profileData.emergencyContactRelationship} 
                    id="emergencyContactRelationship"
                    fieldName="emergencyContactRelationship"
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => actions.handleInputChange('emergencyContactRelationship', e.target.value)} 
                  />
                </div>
                <div className="space-y-2">
                  <InputWithCopy 
                    label="Phone Number" 
                    value={state.profileData.emergencyContactPhone} 
                    id="emergencyContactPhone"
                    fieldName="emergencyContactPhone"
                    type="tel"
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => actions.handleInputChange('emergencyContactPhone', e.target.value)} 
                  />
                </div>
                <div className="space-y-2">
                  <InputWithCopy 
                    label="Email" 
                    value={state.profileData.emergencyContactEmail} 
                    id="emergencyContactEmail"
                    fieldName="emergencyContactEmail"
                    type="email"
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => actions.handleInputChange('emergencyContactEmail', e.target.value)} 
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Identity Section */}
        {activeSection === 'identity' && (
          <IdentitySection
            profileData={state.profileData}
            identityDocsInEditMode={state.identityDocsInEditMode}
            hasDocumentType={actions.hasDocumentType}
            addIdentityDocument={actions.addIdentityDocument}
            handleDocumentUpload={actions.handleDocumentUpload}
            updateIdentityDocument={actions.updateIdentityDocument}
            confirmDeleteIdentityDocument={actions.confirmDeleteIdentityDocument}
            removeIdentityDocument={actions.removeIdentityDocument}
            saveIdentityDocument={actions.saveIdentityDocument}
            cancelEditIdentityDocument={actions.cancelEditIdentityDocument}
            editIdentityDocument={actions.editIdentityDocument}
            getDocumentTypeLabel={actions.getDocumentTypeLabel}
            getDocumentTypeIcon={actions.getDocumentTypeIcon}
            identityDocToDelete={state.identityDocToDelete}
            setIdentityDocToDelete={actions.setIdentityDocToDelete}
            userId={clientData.id}
          />
        )}

        {/* Address Section */}
        {activeSection === 'address' && (
          <AddressSection
            profileData={state.profileData}
            handleInputChange={actions.handleInputChange}
            proofOfResidenceInEditMode={state.proofOfResidenceInEditMode}
            handleProofOfResidenceUpload={actions.handleProofOfResidenceUpload}
            saveProofOfResidence={actions.saveProofOfResidence}
            editProofOfResidence={actions.editProofOfResidence}
            confirmDeleteProofOfResidence={actions.confirmDeleteProofOfResidence}
            removeProofOfResidence={actions.removeProofOfResidence}
            proofOfResidenceToDelete={state.proofOfResidenceToDelete}
            setProofOfResidenceToDelete={actions.setProofOfResidenceToDelete}
            copyToClipboard={(text: string, fieldName: string) => copyToClipboard(text)}
          />
        )}

        {/* Employment Section */}
        {activeSection === 'employment' && (
          <EmploymentSection
            profileData={state.profileData}
            handleInputChange={actions.handleInputChange}
            employersInEditMode={state.employersInEditMode}
            selfEmployedInEditMode={state.selfEmployedInEditMode}
            addEmployer={actions.addEmployer}
            updateEmployer={actions.updateEmployer}
            saveEmployer={actions.saveEmployer}
            editEmployer={actions.editEmployer}
            cancelEditEmployer={actions.cancelEditEmployer}
            confirmDeleteEmployer={actions.confirmDeleteEmployer}
            removeEmployer={actions.removeEmployer}
            saveSelfEmployed={actions.saveSelfEmployed}
            editSelfEmployed={actions.editSelfEmployed}
            cancelEditSelfEmployed={actions.cancelEditSelfEmployed}
            employerToDelete={state.employerToDelete}
            setEmployerToDelete={actions.setEmployerToDelete}
            copyToClipboard={(text: string, fieldName: string) => copyToClipboard(text)}
          />
        )}

        {/* Health Section */}
        {activeSection === 'health' && (
          <HealthSection
            profileData={state.profileData}
            handleInputChange={actions.handleInputChange}
            chronicConditionsInEditMode={state.chronicConditionsInEditMode}
            addChronicCondition={actions.addChronicCondition}
            updateChronicCondition={actions.updateChronicCondition}
            saveChronicCondition={actions.saveChronicCondition}
            editChronicCondition={actions.editChronicCondition}
            cancelEditChronicCondition={actions.cancelEditChronicCondition}
            confirmDeleteChronicCondition={actions.confirmDeleteChronicCondition}
            removeChronicCondition={actions.removeChronicCondition}
            chronicConditionToDelete={state.chronicConditionToDelete}
            setChronicConditionToDelete={actions.setChronicConditionToDelete}
          />
        )}

        {/* Family Section */}
        {activeSection === 'family' && (
          <FamilySection
            profileData={state.profileData}
            familyMembersInEditMode={state.familyMembersInEditMode}
            addFamilyMember={actions.addFamilyMember}
            updateFamilyMember={actions.updateFamilyMember}
            saveFamilyMember={actions.saveFamilyMember}
            editFamilyMember={actions.editFamilyMember}
            cancelEditFamilyMember={actions.cancelEditFamilyMember}
            confirmDeleteFamilyMember={actions.confirmDeleteFamilyMember}
            removeFamilyMember={actions.removeFamilyMember}
            familyMemberToDelete={state.familyMemberToDelete}
            setFamilyMemberToDelete={actions.setFamilyMemberToDelete}
          />
        )}

        {/* Banking Section */}
        {activeSection === 'banking' && (
          <BankingSection
            profileData={state.profileData}
            bankAccountsInEditMode={state.bankAccountsInEditMode}
            addBankAccount={actions.addBankAccount}
            updateBankAccount={actions.updateBankAccount}
            saveBankAccount={actions.saveBankAccount}
            editBankAccount={actions.editBankAccount}
            cancelEditBankAccount={actions.cancelEditBankAccount}
            confirmDeleteBankAccount={actions.confirmDeleteBankAccount}
            removeBankAccount={actions.removeBankAccount}
            handleProofOfBankUpload={actions.handleProofOfBankUpload}
            confirmDeleteProofOfBank={actions.confirmDeleteProofOfBank}
            removeProofOfBank={actions.removeProofOfBank}
            bankAccountToDelete={state.bankAccountToDelete}
            setBankAccountToDelete={actions.setBankAccountToDelete}
            proofOfBankToDelete={state.proofOfBankToDelete}
            setProofOfBankToDelete={actions.setProofOfBankToDelete}
            copyToClipboard={(text: string, fieldName: string) => copyToClipboard(text)}
          />
        )}

        {/* Risk Profile Section */}
        {activeSection === 'risk' && (
          <RiskProfileSection
            profileData={state.profileData}
            updateRiskQuestion={actions.updateRiskQuestion}
            resetRiskAssessment={actions.resetRiskAssessment}
            assessmentStarted={state.assessmentStarted}
            setAssessmentStarted={actions.setAssessmentStarted}
            allQuestionsAnswered={actions.allQuestionsAnswered}
          />
        )}

        {/* Assets & Liabilities Section */}
        {activeSection === 'assets' && (
          <AssetsLiabilitiesSection
            assets={state.profileData.assets || []}
            liabilities={state.profileData.liabilities || []}
            assetsInEditMode={state.assetsInEditMode}
            liabilitiesInEditMode={state.liabilitiesInEditMode}
            addAsset={actions.addAsset}
            updateAsset={actions.updateAsset}
            saveAsset={actions.saveAsset}
            editAsset={actions.editAsset}
            cancelEditAsset={actions.cancelEditAsset}
            confirmDeleteAsset={actions.confirmDeleteAsset}
            removeAsset={actions.removeAsset}
            addLiability={actions.addLiability}
            updateLiability={actions.updateLiability}
            saveLiability={actions.saveLiability}
            editLiability={actions.editLiability}
            cancelEditLiability={actions.cancelEditLiability}
            confirmDeleteLiability={actions.confirmDeleteLiability}
            removeLiability={actions.removeLiability}
            assetToDelete={state.assetToDelete}
            setAssetToDelete={actions.setAssetToDelete}
            liabilityToDelete={state.liabilityToDelete}
            setLiabilityToDelete={actions.setLiabilityToDelete}
            assetDisplayValues={state.assetDisplayValues}
            setAssetDisplayValues={actions.setAssetDisplayValues}
            liabilityDisplayValues={state.liabilityDisplayValues}
            setLiabilityDisplayValues={actions.setLiabilityDisplayValues}
            cleanCurrencyInput={cleanCurrencyInput}
            formatCurrencyInput={formatCurrencyInput}
            formatCurrency={formatCurrency}
          />
        )}

        {/* Budgeting Section - Reusing the BudgetingPage component */}
        {activeSection === 'budgeting' && (
          <div className="h-full">
            <BudgetingPage 
              userId={clientData.id} 
              embedded={true}
              incomeValidationError={state.incomeValidationError}
              setIncomeValidationError={actions.setIncomeValidationError}
              grossIncomeDisplay={state.grossIncomeDisplay}
              setGrossIncomeDisplay={actions.setGrossIncomeDisplay}
              netIncomeDisplay={state.netIncomeDisplay}
              setNetIncomeDisplay={actions.setNetIncomeDisplay}
              profileData={state.profileData}
              handleInputChange={actions.handleInputChange}
            />
          </div>
        )}


      </div>
    </div>
  );
}