/**
 * The Personal Information card of the admin client profile viewer. JSX
 * moved verbatim from ClientProfileViewerFull.tsx; every captured name
 * became a prop (state/actions come from useClientProfile at the root).
 */
import React from 'react';
import { Label } from '../../../../../ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../../../ui/card';
import { SelectItem } from '../../../../../ui/select';
import { Separator } from '../../../../../ui/separator';
import { User, Shield, Banknote } from 'lucide-react';
import { CountrySelect } from '../../../../../pages/profile/CountrySelect';
import { CurrencyInputWithCopy, InputWithCopy, SelectWithCopy } from './ProfileFieldsWithCopy';
import type { ClientProfileHook } from './clientProfileHook';

interface ClientProfilePersonalCardProps {
  state: ClientProfileHook['state'];
  actions: ClientProfileHook['actions'];
}

type IncomeField =
  'grossMonthlyIncome' | 'netMonthlyIncome' | 'grossAnnualIncome' | 'netAnnualIncome';

export function ClientProfilePersonalCard({ state, actions }: ClientProfilePersonalCardProps) {
  const setIncome = (field: IncomeField, value: number | undefined) => {
    const numValue = value ?? 0;
    // Only mark dirty if value actually changed
    if (numValue !== (state.profileData[field] || 0)) {
      actions.handleInputChange(field, numValue);
    }
  };

  return (
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
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                actions.handleInputChange('title', e.target.value)
              }
            />
          </div>
          <div className="space-y-2">
            <InputWithCopy
              label="First Name"
              value={state.profileData.firstName}
              id="firstName"
              fieldName="firstName"
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                actions.handleInputChange('firstName', e.target.value)
              }
            />
          </div>
          <div className="space-y-2">
            <InputWithCopy
              label="Middle Name"
              value={state.profileData.middleName}
              id="middleName"
              fieldName="middleName"
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                actions.handleInputChange('middleName', e.target.value)
              }
            />
          </div>
          <div className="space-y-2">
            <InputWithCopy
              label="Last Name"
              value={state.profileData.lastName}
              id="lastName"
              fieldName="lastName"
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                actions.handleInputChange('lastName', e.target.value)
              }
            />
          </div>
          <div className="space-y-2">
            <InputWithCopy
              label="Date of Birth"
              value={state.profileData.dateOfBirth}
              id="dateOfBirth"
              fieldName="dateOfBirth"
              type="date"
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                actions.handleInputChange('dateOfBirth', e.target.value)
              }
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
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                actions.handleInputChange('nationality', e.target.value)
              }
            />
          </div>
          <div className="space-y-2">
            <InputWithCopy
              label="Tax Number"
              value={state.profileData.taxNumber}
              id="taxNumber"
              fieldName="taxNumber"
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                actions.handleInputChange('taxNumber', e.target.value)
              }
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
                <SelectItem value="out_community_no_accrual">
                  Out of Community without Accrual
                </SelectItem>
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
            <CurrencyInputWithCopy
              label="Gross Monthly Income (R)"
              value={state.profileData.grossMonthlyIncome}
              id="grossMonthlyIncome"
              onValueChange={(v) => setIncome('grossMonthlyIncome', v)}
            />
          </div>
          <div className="space-y-2">
            <CurrencyInputWithCopy
              label="Net Monthly Income (R)"
              value={state.profileData.netMonthlyIncome}
              id="netMonthlyIncome"
              onValueChange={(v) => setIncome('netMonthlyIncome', v)}
            />
          </div>
          <div className="space-y-2">
            <CurrencyInputWithCopy
              label="Gross Annual Income (R)"
              value={state.profileData.grossAnnualIncome}
              id="grossAnnualIncome"
              onValueChange={(v) => setIncome('grossAnnualIncome', v)}
            />
          </div>
          <div className="space-y-2">
            <CurrencyInputWithCopy
              label="Net Annual Income (R)"
              value={state.profileData.netAnnualIncome}
              id="netAnnualIncome"
              onValueChange={(v) => setIncome('netAnnualIncome', v)}
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
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                actions.handleInputChange('idNumber', e.target.value)
              }
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
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                actions.handleInputChange('passportNumber', e.target.value)
              }
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
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                actions.handleInputChange('workPermitNumber', e.target.value)
              }
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
