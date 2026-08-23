/**
 * The add-recipient form of the RecipientsManager: system-client search,
 * manual entry, recipient kind, shared role/OTP/access-code config, and the
 * SMS channel. JSX and the KIND_OPTIONS literal moved verbatim from
 * RecipientsManager.tsx; every captured name became a prop.
 */
import React from 'react';
import { Badge } from '../../../../ui/badge';
import { Button } from '../../../../ui/button';
import { Card, CardContent } from '../../../../ui/card';
import { Checkbox } from '../../../../ui/checkbox';
import { Input } from '../../../../ui/input';
import { Label } from '../../../../ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../../ui/select';
import {
  AlertCircle,
  Building2,
  Check,
  Info,
  Lock,
  PenSquare,
  ScrollText,
  Search,
  Send,
  UserCheck,
  UserPlus,
  X,
} from 'lucide-react';
import { SIGNER_ROLES } from '../constants';
import type { SignerKind } from '../types';
import { useSearchInputAutofillGuard } from '@/shared/forms/useSearchInputAutofillGuard';

export type AddMode = 'system' | 'manual';

export interface SystemClient {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  status: string;
  nationalId?: string;
}

const KIND_OPTIONS: Array<{
  value: SignerKind;
  label: string;
  sublabel: string;
  icon: typeof PenSquare;
  accent: string;
}> = [
  {
    value: 'signer',
    label: 'Needs to sign',
    sublabel: 'Standard signer — must complete fields',
    icon: PenSquare,
    accent: 'border-purple-500 bg-purple-50 text-purple-700',
  },
  {
    value: 'witness',
    label: 'Witness',
    sublabel: 'Co-signs to attest the agreement',
    icon: ScrollText,
    accent: 'border-amber-500 bg-amber-50 text-amber-700',
  },
  {
    value: 'cc',
    label: 'Receives a copy',
    sublabel: 'Notified only — does not sign',
    icon: Send,
    accent: 'border-cyan-500 bg-cyan-50 text-cyan-700',
  },
];

interface RecipientAddFormProps {
  addMode: AddMode;
  setAddMode: React.Dispatch<React.SetStateAction<AddMode>>;
  resetAddForm: () => void;
  handleAdd: () => void;
  errors: Record<string, string>;
  setErrors: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  loadingClients: boolean;
  filteredClients: SystemClient[];
  searchQuery: string;
  setSearchQuery: React.Dispatch<React.SetStateAction<string>>;
  searchRef: React.RefObject<HTMLDivElement>;
  searchInputGuard: ReturnType<typeof useSearchInputAutofillGuard>;
  showDropdown: boolean;
  setShowDropdown: React.Dispatch<React.SetStateAction<boolean>>;
  selectedClient: SystemClient | null;
  setSelectedClient: React.Dispatch<React.SetStateAction<SystemClient | null>>;
  manualName: string;
  setManualName: React.Dispatch<React.SetStateAction<string>>;
  manualEmail: string;
  setManualEmail: React.Dispatch<React.SetStateAction<string>>;
  manualPhone: string;
  setManualPhone: React.Dispatch<React.SetStateAction<string>>;
  signerKind: SignerKind;
  setSignerKind: React.Dispatch<React.SetStateAction<SignerKind>>;
  signerRole: string;
  setSignerRole: React.Dispatch<React.SetStateAction<string>>;
  otpRequired: boolean;
  setOtpRequired: React.Dispatch<React.SetStateAction<boolean>>;
  accessCode: string;
  setAccessCode: React.Dispatch<React.SetStateAction<string>>;
  smsOptIn: boolean;
  setSmsOptIn: React.Dispatch<React.SetStateAction<boolean>>;
}

export function RecipientAddForm({
  addMode,
  setAddMode,
  resetAddForm,
  handleAdd,
  errors,
  setErrors,
  loadingClients,
  filteredClients,
  searchQuery,
  setSearchQuery,
  searchRef,
  searchInputGuard,
  showDropdown,
  setShowDropdown,
  selectedClient,
  setSelectedClient,
  manualName,
  setManualName,
  manualEmail,
  setManualEmail,
  manualPhone,
  setManualPhone,
  signerKind,
  setSignerKind,
  signerRole,
  setSignerRole,
  otpRequired,
  setOtpRequired,
  accessCode,
  setAccessCode,
  smsOptIn,
  setSmsOptIn,
}: RecipientAddFormProps) {
  return (
    <Card className="border-2 border-dashed border-purple-300 bg-purple-50/30">
      <CardContent className="p-5 space-y-5">
        {/* Header with close */}
        <div className="flex justify-between items-center">
          <h4 className="font-semibold text-gray-900">Add Recipient</h4>
          <Button variant="ghost" size="sm" onClick={resetAddForm}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Mode Tabs */}
        <div className="flex gap-2 p-1 bg-gray-100 rounded-lg">
          <button
            type="button"
            onClick={() => {
              setAddMode('system');
              setErrors({});
            }}
            className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-md text-sm font-medium transition-colors ${
              addMode === 'system'
                ? 'bg-white text-purple-700 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <Building2 className="h-4 w-4" />
            Select from System
          </button>
          <button
            type="button"
            onClick={() => {
              setAddMode('manual');
              setErrors({});
              setSelectedClient(null);
            }}
            className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-md text-sm font-medium transition-colors ${
              addMode === 'manual'
                ? 'bg-white text-purple-700 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <UserPlus className="h-4 w-4" />
            Enter Manually
          </button>
        </div>

        {/* System Client Search */}
        {addMode === 'system' && (
          <div className="space-y-3">
            <Label className="text-sm font-medium text-gray-700">Search Clients</Label>
            <div ref={searchRef} className="relative">
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                <Input
                  {...searchInputGuard}
                  placeholder="Search by name or email..."
                  className="pl-9"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setShowDropdown(true);
                    setSelectedClient(null);
                  }}
                  onFocus={(e) => {
                    searchInputGuard.onFocus?.(e);
                    setShowDropdown(true);
                  }}
                />
              </div>

              {/* Dropdown */}
              {showDropdown && (
                <div className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                  {loadingClients ? (
                    <div className="p-4 text-center text-sm text-gray-500">Loading clients...</div>
                  ) : filteredClients.length === 0 ? (
                    <div className="p-4 text-center text-sm text-gray-500">
                      {searchQuery
                        ? 'No matching active or pending clients found'
                        : 'No eligible clients available'}
                    </div>
                  ) : (
                    filteredClients.slice(0, 20).map((client) => (
                      <button
                        key={client.id}
                        type="button"
                        className="w-full text-left px-4 py-3 hover:bg-purple-50 transition-colors border-b border-gray-50 last:border-0"
                        onClick={() => {
                          setSelectedClient(client);
                          setSearchQuery(`${client.firstName} ${client.lastName}`);
                          setShowDropdown(false);
                          setErrors({});
                          // Auto-populate access code with client's national ID if available
                          if (client.nationalId) {
                            setAccessCode(client.nationalId);
                          }
                        }}
                      >
                        <div className="flex items-center gap-3">
                          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-purple-100 text-purple-700 text-xs font-semibold shrink-0">
                            {client.firstName?.[0]}
                            {client.lastName?.[0]}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">
                              {client.firstName} {client.lastName}
                            </p>
                            <p className="text-xs text-gray-500 truncate">{client.email}</p>
                          </div>
                          <Badge variant="outline" className="text-xs shrink-0 capitalize">
                            {client.status}
                          </Badge>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>

            {/* Selected Client Preview */}
            {selectedClient && (
              <div className="flex items-center gap-3 p-3 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-center justify-center w-10 h-10 rounded-full bg-green-100 text-green-700 font-semibold text-sm shrink-0">
                  {selectedClient.firstName?.[0]}
                  {selectedClient.lastName?.[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-green-900">
                    {selectedClient.firstName} {selectedClient.lastName}
                  </p>
                  <p className="text-xs text-green-700">{selectedClient.email}</p>
                </div>
                <UserCheck className="h-5 w-5 text-green-600 shrink-0" />
              </div>
            )}

            {errors.client && (
              <p className="text-xs text-red-500 flex items-center gap-1">
                <AlertCircle className="h-3.5 w-3.5" />
                {errors.client}
              </p>
            )}

            {/* Info callout for system clients */}
            <div className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <Info className="h-4 w-4 text-blue-600 mt-0.5 shrink-0" />
              <p className="text-xs text-blue-800">
                When a system client is selected, this envelope will automatically appear on their
                client profile page for tracking and management.
              </p>
            </div>
          </div>
        )}

        {/* Manual Entry */}
        {addMode === 'manual' && (
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label>Full Name *</Label>
              <Input
                placeholder="e.g. John Smith"
                value={manualName}
                onChange={(e) => setManualName(e.target.value)}
                className={errors.name ? 'border-red-300' : ''}
              />
              {errors.name && <p className="text-xs text-red-500">{errors.name}</p>}
            </div>
            <div className="space-y-1">
              <Label>Email Address *</Label>
              <Input
                type="email"
                placeholder="john@example.com"
                value={manualEmail}
                onChange={(e) => setManualEmail(e.target.value)}
                className={errors.email ? 'border-red-300' : ''}
              />
              {errors.email && <p className="text-xs text-red-500">{errors.email}</p>}
            </div>
          </div>
        )}

        {/* Recipient kind — Signer / Witness / CC. Drives the entire
                  downstream UX: CCs skip OTP, can't have fields placed on
                  them, and are shown as "copy only" in the audit trail. */}
        <div className="space-y-2 pt-2 border-t border-gray-200">
          <Label>What does this recipient need to do?</Label>
          <div className="grid grid-cols-3 gap-2">
            {KIND_OPTIONS.map((opt) => {
              const Icon = opt.icon;
              const isActive = signerKind === opt.value;
              return (
                <button
                  type="button"
                  key={opt.value}
                  onClick={() => {
                    setSignerKind(opt.value);
                    if (opt.value === 'cc') {
                      setOtpRequired(false);
                      setAccessCode('');
                    }
                  }}
                  className={`text-left rounded-lg border-2 p-3 transition-colors ${
                    isActive ? opt.accent : 'border-gray-200 bg-white hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Icon className="h-4 w-4" />
                    <span className="text-sm font-semibold">{opt.label}</span>
                  </div>
                  <span className="text-xs text-gray-500 block leading-snug">{opt.sublabel}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Shared Config: Role, OTP, Access Code */}
        <div className="space-y-4 pt-2 border-t border-gray-200">
          <div className="space-y-1">
            <Label>Signing Role *</Label>
            <Select value={signerRole} onValueChange={setSignerRole}>
              <SelectTrigger className={errors.role ? 'border-red-300' : ''}>
                <SelectValue placeholder="Select role..." />
              </SelectTrigger>
              <SelectContent>
                {SIGNER_ROLES.map((role) => (
                  <SelectItem key={role.value} value={role.value}>
                    {role.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.role && <p className="text-xs text-red-500">{errors.role}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label>Access Code (Optional)</Label>
              <div className="relative">
                <Lock className="absolute left-2 top-2.5 h-4 w-4 text-gray-400" />
                <Input
                  className="pl-8"
                  placeholder="e.g. 1234"
                  value={accessCode}
                  onChange={(e) => setAccessCode(e.target.value)}
                  disabled={signerKind === 'cc'}
                />
              </div>
              <p className="text-xs text-gray-400">
                {signerKind === 'cc'
                  ? 'Not applicable for CC recipients'
                  : 'Additional security code the signer must enter'}
              </p>
            </div>
            <div className="flex items-center space-x-2 pt-6">
              <Checkbox
                id="new-otp"
                checked={otpRequired}
                onCheckedChange={(c) => setOtpRequired(c === true)}
                disabled={signerKind === 'cc'}
              />
              <Label htmlFor="new-otp" className="text-sm cursor-pointer">
                Require OTP Verification
              </Label>
            </div>
          </div>

          {/* P5.1 — Optional SMS channel. Phone is optional; when
                    present the sender can tick SMS opt-in so OTP + invite
                    are mirrored to SMS alongside email. */}
          {signerKind !== 'cc' && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Mobile Number (Optional)</Label>
                <Input
                  type="tel"
                  placeholder="e.g. 082 123 4567"
                  value={manualPhone}
                  onChange={(e) => {
                    setManualPhone(e.target.value);
                    if (!e.target.value.trim()) setSmsOptIn(false);
                  }}
                />
                <p className="text-xs text-gray-400">
                  Enables SMS channel for OTP / invites when consent is given.
                </p>
              </div>
              <div className="flex items-center space-x-2 pt-6">
                <Checkbox
                  id="new-sms-optin"
                  checked={smsOptIn}
                  onCheckedChange={(c) => setSmsOptIn(c === true)}
                  disabled={!manualPhone.trim()}
                />
                <Label
                  htmlFor="new-sms-optin"
                  className={`text-sm cursor-pointer ${!manualPhone.trim() ? 'text-gray-400' : ''}`}
                >
                  Signer consents to SMS
                </Label>
              </div>
            </div>
          )}
        </div>

        {/* Limit warning */}
        {errors.limit && (
          <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
            <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
            <p className="text-xs text-amber-800">{errors.limit}</p>
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={resetAddForm}>
            Cancel
          </Button>
          <Button onClick={handleAdd} className="bg-purple-600 hover:bg-purple-700 text-white">
            <Check className="h-4 w-4 mr-2" />
            Add Recipient
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
