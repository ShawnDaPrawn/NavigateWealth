import React from 'react';
import type { ProfileData, HandleInputChange } from '../types';
import { CountrySelect } from '../CountrySelect';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../ui/card';
import { Input } from '../../../ui/input';
import { Label } from '../../../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../ui/select';
import { Alert, AlertDescription } from '../../../ui/alert';
import { Separator } from '../../../ui/separator';
import { formatCurrency, formatCurrencyInput, cleanCurrencyInput } from '../../../../utils/currencyFormatter';
import { User, AlertCircle, IdCard } from 'lucide-react';

interface PersonalInfoSectionProps {
  profileData: ProfileData;
  handleInputChange: HandleInputChange;
  grossIncomeDisplay: string | null;
  setGrossIncomeDisplay: React.Dispatch<React.SetStateAction<string | null>>;
  netIncomeDisplay: string | null;
  setNetIncomeDisplay: React.Dispatch<React.SetStateAction<string | null>>;
  grossAnnualIncomeDisplay: string | null;
  setGrossAnnualIncomeDisplay: React.Dispatch<React.SetStateAction<string | null>>;
  netAnnualIncomeDisplay: string | null;
  setNetAnnualIncomeDisplay: React.Dispatch<React.SetStateAction<string | null>>;
  incomeValidationError: string;
  setIncomeValidationError: React.Dispatch<React.SetStateAction<string>>;
  setProfileData: React.Dispatch<React.SetStateAction<ProfileData>>;
  setSaveSuccess: React.Dispatch<React.SetStateAction<boolean>>;
}

export function PersonalInfoSection({
  profileData,
  handleInputChange,
  grossIncomeDisplay,
  setGrossIncomeDisplay,
  netIncomeDisplay,
  setNetIncomeDisplay,
  grossAnnualIncomeDisplay,
  setGrossAnnualIncomeDisplay,
  netAnnualIncomeDisplay,
  setNetAnnualIncomeDisplay,
  incomeValidationError,
  setIncomeValidationError,
  setProfileData,
  setSaveSuccess,
}: PersonalInfoSectionProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-[#6d28d9]/10 flex items-center justify-center">
            <User className="h-5 w-5 text-[#6d28d9]" />
          </div>
          <div>
            <CardTitle>Personal Information</CardTitle>
            <CardDescription>Your basic personal details</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <Label htmlFor="title">Title</Label>
            <Select
              value={profileData.title}
              onValueChange={(value) => handleInputChange('title', value)}
            >
              <SelectTrigger id="title" className="mt-1.5">
                <SelectValue placeholder="Select title" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Mr">Mr</SelectItem>
                <SelectItem value="Mrs">Mrs</SelectItem>
                <SelectItem value="Ms">Ms</SelectItem>
                <SelectItem value="Miss">Miss</SelectItem>
                <SelectItem value="Dr">Dr</SelectItem>
                <SelectItem value="Prof">Prof</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="firstName">First Name *</Label>
            <Input
              id="firstName"
              value={profileData.firstName}
              onChange={(e) => handleInputChange('firstName', e.target.value)}
              placeholder="Enter first name"
              className="mt-1.5"
            />
          </div>

          <div>
            <Label htmlFor="middleName">Middle Name</Label>
            <Input
              id="middleName"
              value={profileData.middleName}
              onChange={(e) => handleInputChange('middleName', e.target.value)}
              placeholder="Enter middle name"
              className="mt-1.5"
            />
          </div>

          <div className="sm:col-span-2 lg:col-span-3">
            <Label htmlFor="lastName">Last Name *</Label>
            <Input
              id="lastName"
              value={profileData.lastName}
              onChange={(e) => handleInputChange('lastName', e.target.value)}
              placeholder="Enter last name"
              className="mt-1.5"
            />
          </div>
        </div>

        <Separator />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="dateOfBirth">Date of Birth *</Label>
            <Input
              id="dateOfBirth"
              type="date"
              value={profileData.dateOfBirth}
              onChange={(e) => handleInputChange('dateOfBirth', e.target.value)}
              className="mt-1.5"
            />
          </div>

          <div>
            <Label htmlFor="gender">Gender</Label>
            <Select
              value={profileData.gender}
              onValueChange={(value) => handleInputChange('gender', value)}
            >
              <SelectTrigger id="gender" className="mt-1.5">
                <SelectValue placeholder="Select gender" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="male">Male</SelectItem>
                <SelectItem value="female">Female</SelectItem>
                <SelectItem value="other">Other</SelectItem>
                <SelectItem value="prefer-not-to-say">Prefer not to say</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="nationality">Nationality</Label>
            <Input
              id="nationality"
              value={profileData.nationality}
              onChange={(e) => handleInputChange('nationality', e.target.value)}
              placeholder="Enter nationality"
              className="mt-1.5"
            />
          </div>

          <div>
            <Label htmlFor="taxNumber">Tax Number</Label>
            <Input
              id="taxNumber"
              value={profileData.taxNumber}
              onChange={(e) => handleInputChange('taxNumber', e.target.value)}
              placeholder="Enter tax number"
              className="mt-1.5"
            />
          </div>
        </div>

        <Separator />

        <div className="space-y-4">
          <h4 className="text-sm text-gray-700">Income Information</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="grossIncome">Gross Monthly Income (Pre-Tax) *</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">R</span>
                <Input
                  id="grossIncome"
                  type="text"
                  value={grossIncomeDisplay !== null ? grossIncomeDisplay : (profileData.grossIncome ? formatCurrencyInput(profileData.grossIncome.toString()) : '')}
                  onChange={(e) => {
                    const formatted = formatCurrencyInput(e.target.value);
                    setGrossIncomeDisplay(formatted);
                  }}
                  onBlur={() => {
                    const value = cleanCurrencyInput(grossIncomeDisplay || '');
                    const numValue = parseFloat(value) || 0;
                    
                    setProfileData(prev => ({
                      ...prev,
                      grossIncome: numValue,
                      grossAnnualIncome: numValue * 12
                    }));
                    setSaveSuccess(false);
                    setGrossIncomeDisplay(null);
                    
                    if (profileData.netIncome > numValue && numValue > 0) {
                      setIncomeValidationError(`Net income (${formatCurrency(profileData.netIncome)}) cannot exceed gross income (${formatCurrency(numValue)})`);
                    } else {
                      setIncomeValidationError('');
                    }
                  }}
                  onFocus={() => {
                    if (grossIncomeDisplay === null) {
                      setGrossIncomeDisplay(profileData.grossIncome ? formatCurrencyInput(profileData.grossIncome.toString()) : '');
                    }
                  }}
                  placeholder="0.00"
                  className={`mt-1.5 pl-8 ${incomeValidationError ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : ''}`}
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">Your total monthly income before tax deductions</p>
            </div>

            <div>
              <Label htmlFor="netIncome">Net Monthly Income (Post-Tax) *</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">R</span>
                <Input
                  id="netIncome"
                  type="text"
                  value={netIncomeDisplay !== null ? netIncomeDisplay : (profileData.netIncome ? formatCurrencyInput(profileData.netIncome.toString()) : '')}
                  onChange={(e) => {
                    const formatted = formatCurrencyInput(e.target.value);
                    setNetIncomeDisplay(formatted);
                  }}
                  onBlur={() => {
                    const value = cleanCurrencyInput(netIncomeDisplay || '');
                    const numValue = parseFloat(value) || 0;
                    
                    setProfileData(prev => ({
                      ...prev,
                      netIncome: numValue,
                      netAnnualIncome: numValue * 12
                    }));
                    setSaveSuccess(false);
                    setNetIncomeDisplay(null);
                    
                    if (numValue > profileData.grossIncome && profileData.grossIncome > 0) {
                      setIncomeValidationError(`Net income (${formatCurrency(numValue)}) cannot exceed gross income (${formatCurrency(profileData.grossIncome)})`);
                    } else {
                      setIncomeValidationError('');
                    }
                  }}
                  onFocus={() => {
                    if (netIncomeDisplay === null) {
                      setNetIncomeDisplay(profileData.netIncome ? formatCurrencyInput(profileData.netIncome.toString()) : '');
                    }
                  }}
                  placeholder="0.00"
                  className={`mt-1.5 pl-8 ${incomeValidationError ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : ''}`}
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">Your take-home pay after tax (used for budgeting)</p>
            </div>

            {/* Annual Fields */}
            <div>
              <Label htmlFor="grossAnnualIncome">Gross Annual Income (Pre-Tax)</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">R</span>
                <Input
                  id="grossAnnualIncome"
                  type="text"
                  value={grossAnnualIncomeDisplay !== null ? grossAnnualIncomeDisplay : (profileData.grossAnnualIncome ? formatCurrencyInput(profileData.grossAnnualIncome.toString()) : '')}
                  onChange={(e) => {
                    const formatted = formatCurrencyInput(e.target.value);
                    setGrossAnnualIncomeDisplay(formatted);
                  }}
                  onBlur={() => {
                    const value = cleanCurrencyInput(grossAnnualIncomeDisplay || '');
                    const numValue = parseFloat(value) || 0;
                    handleInputChange('grossAnnualIncome', numValue);
                    setGrossAnnualIncomeDisplay(null);
                  }}
                  onFocus={() => {
                    if (grossAnnualIncomeDisplay === null) {
                      setGrossAnnualIncomeDisplay(profileData.grossAnnualIncome ? formatCurrencyInput(profileData.grossAnnualIncome.toString()) : '');
                    }
                  }}
                  placeholder="0.00"
                  className="mt-1.5 pl-8"
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">Automatically calculated, but can be amended</p>
            </div>

            <div>
              <Label htmlFor="netAnnualIncome">Net Annual Income (Post-Tax)</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">R</span>
                <Input
                  id="netAnnualIncome"
                  type="text"
                  value={netAnnualIncomeDisplay !== null ? netAnnualIncomeDisplay : (profileData.netAnnualIncome ? formatCurrencyInput(profileData.netAnnualIncome.toString()) : '')}
                  onChange={(e) => {
                    const formatted = formatCurrencyInput(e.target.value);
                    setNetAnnualIncomeDisplay(formatted);
                  }}
                  onBlur={() => {
                    const value = cleanCurrencyInput(netAnnualIncomeDisplay || '');
                    const numValue = parseFloat(value) || 0;
                    handleInputChange('netAnnualIncome', numValue);
                    setNetAnnualIncomeDisplay(null);
                  }}
                  onFocus={() => {
                    if (netAnnualIncomeDisplay === null) {
                      setNetAnnualIncomeDisplay(profileData.netAnnualIncome ? formatCurrencyInput(profileData.netAnnualIncome.toString()) : '');
                    }
                  }}
                  placeholder="0.00"
                  className="mt-1.5 pl-8"
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">Automatically calculated, but can be amended</p>
            </div>
          </div>
          
          {/* Income Validation Error */}
          {incomeValidationError && (
            <Alert className="border-red-200 bg-red-50 mt-4">
              <AlertCircle className="h-4 w-4 text-red-600" />
              <AlertDescription className="text-sm text-red-800">
                <strong>Validation Error:</strong> {incomeValidationError}
              </AlertDescription>
            </Alert>
          )}
        </div>

        <Separator />

        <div className="space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <IdCard className="h-4 w-4 text-gray-500" />
            <h4 className="text-sm font-medium text-gray-700">Identity</h4>
          </div>
          
          {/* ID Document */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="idCountry">ID Country</Label>
              <div className="mt-1.5">
                <CountrySelect
                  id="idCountry"
                  value={profileData.idCountry}
                  onValueChange={(value) => handleInputChange('idCountry', value)}
                />
              </div>
            </div>
            <div>
              <Label htmlFor="idNumber">ID Number</Label>
              <Input
                id="idNumber"
                value={profileData.idNumber}
                onChange={(e) => handleInputChange('idNumber', e.target.value)}
                placeholder="Enter ID number"
                className="mt-1.5"
              />
            </div>
          </div>

          {/* Passport */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="passportCountry">Passport Country</Label>
              <div className="mt-1.5">
                <CountrySelect
                  id="passportCountry"
                  value={profileData.passportCountry}
                  onValueChange={(value) => handleInputChange('passportCountry', value)}
                />
              </div>
            </div>
            <div>
              <Label htmlFor="passportNumber">Passport Number</Label>
              <Input
                id="passportNumber"
                value={profileData.passportNumber}
                onChange={(e) => handleInputChange('passportNumber', e.target.value)}
                placeholder="Enter passport number"
                className="mt-1.5"
              />
            </div>
          </div>

          {/* Work Permit */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="employmentCountry">Country of Employment</Label>
              <div className="mt-1.5">
                <CountrySelect
                  id="employmentCountry"
                  value={profileData.employmentCountry}
                  onValueChange={(value) => handleInputChange('employmentCountry', value)}
                />
              </div>
            </div>
            <div>
              <Label htmlFor="workPermitNumber">Work Permit Number</Label>
              <Input
                id="workPermitNumber"
                value={profileData.workPermitNumber}
                onChange={(e) => handleInputChange('workPermitNumber', e.target.value)}
                placeholder="Enter work permit number"
                className="mt-1.5"
              />
            </div>
          </div>
        </div>

        <Separator />

        <div className="space-y-4">
          <h4 className="text-sm text-gray-700">Marital Status</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="maritalStatus">Status</Label>
              <Select
                value={profileData.maritalStatus}
                onValueChange={(value) => handleInputChange('maritalStatus', value)}
              >
                <SelectTrigger id="maritalStatus" className="mt-1.5">
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="single">Single</SelectItem>
                  <SelectItem value="married">Married</SelectItem>
                  <SelectItem value="divorced">Divorced</SelectItem>
                  <SelectItem value="widowed">Widowed</SelectItem>
                  <SelectItem value="life-partner">Life Partner</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {profileData.maritalStatus === 'married' && (
              <div>
                <Label htmlFor="maritalRegime">Marital Regime</Label>
                <Select
                  value={profileData.maritalRegime}
                  onValueChange={(value) => handleInputChange('maritalRegime', value)}
                >
                  <SelectTrigger id="maritalRegime" className="mt-1.5">
                    <SelectValue placeholder="Select marital regime" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="community-of-property">Community of Property</SelectItem>
                    <SelectItem value="antenuptial">Antenuptial</SelectItem>
                    <SelectItem value="antenuptial-with-accrual">Antenuptial With Accrual</SelectItem>
                    <SelectItem value="customary-marriage">Customary Marriage</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
