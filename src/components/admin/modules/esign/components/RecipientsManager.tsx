/**
 * Recipients Manager Component
 * Professional recipient management with system client search, color coding,
 * roles, and signing order. Designed for single-signer now with architecture
 * for future multi-signer sequential signing.
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '../../../../ui/button';
import { Input } from '../../../../ui/input';
import { Label } from '../../../../ui/label';
import { Card, CardContent } from '../../../../ui/card';
import { Badge } from '../../../../ui/badge';
import { Checkbox } from '../../../../ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../../ui/select';
import {
  UserPlus,
  Mail,
  Users,
  Lock,
  Shield,
  Trash2,
  Edit2,
  X,
  GripVertical,
  UserCheck,
  Info,
  ExternalLink,
  ScrollText,
  Send,
} from 'lucide-react';
import { fetchClientDirectory } from '../../../../../shared/api/clientDirectory';
import { SIGNER_ROLES, SIGNER_COLORS, CURRENT_MAX_SIGNERS } from '../constants';
import type { SignerFormData, SignerKind } from '../types';
import { useSearchInputAutofillGuard } from '@/shared/forms/useSearchInputAutofillGuard';

/**
 * Optional client context — when provided, the client is pre-populated as
 * the first signer on mount (but fully removable). Used by the Client
 * Management E-Sign tab so the wizard pre-fills the profile's client.
 */
export interface ClientContext {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
}

interface RecipientsManagerProps {
  signers: SignerFormData[];
  onChange: (signers: SignerFormData[]) => void;
  disabled?: boolean;
  /** When set, the client is auto-added as first signer on mount (removable). */
  clientContext?: ClientContext;
}

import { RecipientAddForm, type AddMode, type SystemClient } from './RecipientAddForm';

/**
 * The directory fields this picker reads. Passed to fetchClientDirectory so the
 * shared envelope is typed with exactly what is used here — the server may
 * return `profile` flat or nested, hence the loose record.
 */
interface DirectoryClient {
  id: string;
  email?: string;
  name?: string;
  user_metadata?: Record<string, unknown>;
  profile?: Record<string, unknown>;
  application_status?: string;
}

export function RecipientsManager({
  signers,
  onChange,
  disabled = false,
  clientContext,
}: RecipientsManagerProps) {
  // UI state
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [addMode, setAddMode] = useState<AddMode>('system');
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  // System client search state
  const [systemClients, setSystemClients] = useState<SystemClient[]>([]);
  const [loadingClients, setLoadingClients] = useState(false);
  const [clientsLoaded, setClientsLoaded] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedClient, setSelectedClient] = useState<SystemClient | null>(null);
  const searchRef = useRef<HTMLDivElement>(null);
  const searchInputGuard = useSearchInputAutofillGuard({
    id: 'esign-recipients-system-client-search',
    role: 'combobox',
    ariaAutocomplete: 'list',
    ariaExpanded: showDropdown,
  });

  // Manual entry state
  const [manualName, setManualName] = useState('');
  const [manualEmail, setManualEmail] = useState('');

  // Shared signer config
  const [signerRole, setSignerRole] = useState('signer');
  const [signerKind, setSignerKind] = useState<SignerKind>('signer');
  const [otpRequired, setOtpRequired] = useState(true);
  const [accessCode, setAccessCode] = useState('');
  // P5.1 — SMS channel opt-in for the new signer. UI is disabled
  // until a phone number is entered so senders can't opt-in blind.
  const [manualPhone, setManualPhone] = useState('');
  const [smsOptIn, setSmsOptIn] = useState(false);

  // Errors
  const [errors, setErrors] = useState<Record<string, string>>({});

  // ==================== LOAD SYSTEM CLIENTS ====================

  const loadClients = useCallback(async () => {
    if (clientsLoaded) return;
    setLoadingClients(true);
    try {
      const response = await fetchClientDirectory<DirectoryClient>();
      const users = response?.users || response?.clients || [];
      // Filter to active and pending clients only, then map to simplified shape
      const eligible = users
        .map((u) => {
          // Server may return profile as flat ProfileData or nested ClientProfile
          const pi =
            (u.profile?.personalInformation as Record<string, unknown> | undefined) || u.profile;
          return {
            id: u.id,
            firstName: String(
              u.user_metadata?.firstName || pi?.firstName || u.name?.split(' ')[0] || '',
            ),
            lastName: String(
              u.user_metadata?.surname ||
                pi?.lastName ||
                u.name?.split(' ').slice(1).join(' ') ||
                '',
            ),
            email: u.email || '',
            status: u.application_status || 'active',
            nationalId: (u.user_metadata?.nationalId ||
              pi?.idNumber ||
              pi?.passportNumber ||
              undefined) as string | undefined,
          };
        })
        .filter((client: SystemClient) => {
          const status = client.status.toLowerCase();
          // Include active, pending, approved, onboarded clients
          return (
            ['active', 'pending', 'approved', 'onboarded', 'unknown'].includes(status) || !status
          );
        })
        .filter((client: SystemClient) => client.email); // Must have an email
      setSystemClients(eligible);
      setClientsLoaded(true);
    } catch (error) {
      console.error('Failed to load system clients:', error);
    } finally {
      setLoadingClients(false);
    }
  }, [clientsLoaded]);

  // Load clients when add form opens in system mode
  useEffect(() => {
    if (showAddForm && addMode === 'system' && !clientsLoaded) {
      loadClients();
    }
  }, [showAddForm, addMode, clientsLoaded, loadClients]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Auto-populate client as first signer when clientContext is provided
  // and no signers have been added yet (runs once on mount).
  useEffect(() => {
    if (clientContext && clientContext.email && signers.length === 0) {
      const clientSigner: SignerFormData = {
        name: `${clientContext.firstName} ${clientContext.lastName}`.trim(),
        email: clientContext.email,
        role: 'Client',
        order: 1,
        otpRequired: true,
        clientId: clientContext.id,
        isSystemClient: true,
      };
      onChange([clientSigner]);
    }
    // Only run on mount — intentionally excluding onChange/signers from deps
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ==================== FILTERED CLIENTS ====================

  const filteredClients = systemClients
    .filter((client) => {
      const query = searchQuery.toLowerCase();
      if (!query) return true;
      const fullName = `${client.firstName} ${client.lastName}`.toLowerCase();
      return (
        fullName.includes(query) ||
        client.email.toLowerCase().includes(query) ||
        client.id.toLowerCase().includes(query)
      );
    })
    .filter((client) => {
      // Exclude already-added signers
      return !signers.some((s) => s.clientId === client.id || s.email === client.email);
    });

  // ==================== VALIDATION ====================

  const validateNewSigner = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (addMode === 'system') {
      if (!selectedClient) {
        newErrors.client = 'Please select a client from the system';
      }
    } else {
      if (!manualName.trim()) newErrors.name = 'Name is required';
      if (!manualEmail.trim()) {
        newErrors.email = 'Email is required';
      } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(manualEmail)) {
        newErrors.email = 'Invalid email address';
      }
    }

    if (!signerRole) {
      newErrors.role = 'Please select a signing role';
    }

    // Check duplicates
    const emailToCheck = addMode === 'system' ? selectedClient?.email : manualEmail;
    if (emailToCheck && signers.some((s) => s.email.toLowerCase() === emailToCheck.toLowerCase())) {
      newErrors.email = 'This recipient has already been added';
      if (addMode === 'system') newErrors.client = 'This client has already been added';
    }

    // Check current limit
    if (signers.length >= CURRENT_MAX_SIGNERS) {
      newErrors.limit = `Maximum ${CURRENT_MAX_SIGNERS} recipients per envelope.`;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // ==================== ADD / EDIT / DELETE ====================

  const handleAdd = () => {
    if (!validateNewSigner()) return;

    const roleLabel = SIGNER_ROLES.find((r) => r.value === signerRole)?.label || signerRole;

    // CC recipients receive a copy only and are never required to sign, so we
    // hard-default OTP / access-code off for them. The Studio also suppresses
    // field placement when `kind === 'cc'`.
    const effectiveOtp = signerKind === 'cc' ? false : otpRequired;
    const effectiveAccessCode = signerKind === 'cc' ? undefined : accessCode || undefined;

    const phoneTrimmed = manualPhone.trim();
    const effectiveSmsOptIn = signerKind !== 'cc' && smsOptIn && !!phoneTrimmed;

    const newSigner: SignerFormData =
      addMode === 'system'
        ? {
            name: `${selectedClient!.firstName} ${selectedClient!.lastName}`.trim(),
            email: selectedClient!.email,
            phone: phoneTrimmed || undefined,
            role: roleLabel,
            order: signers.length + 1,
            otpRequired: effectiveOtp,
            accessCode: effectiveAccessCode,
            clientId: selectedClient!.id,
            isSystemClient: true,
            kind: signerKind,
            smsOptIn: effectiveSmsOptIn,
          }
        : {
            name: manualName.trim(),
            email: manualEmail.trim(),
            phone: phoneTrimmed || undefined,
            role: roleLabel,
            order: signers.length + 1,
            otpRequired: effectiveOtp,
            accessCode: effectiveAccessCode,
            isSystemClient: false,
            kind: signerKind,
            smsOptIn: effectiveSmsOptIn,
          };

    onChange([...signers, newSigner]);
    resetAddForm();
  };

  const handleUpdate = (index: number, updates: Partial<SignerFormData>) => {
    const updated = [...signers];
    updated[index] = { ...updated[index], ...updates };
    onChange(updated);
  };

  const handleDelete = (index: number) => {
    const updated = signers.filter((_, i) => i !== index);
    onChange(updated.map((s, i) => ({ ...s, order: i + 1 })));
    if (editingIndex === index) setEditingIndex(null);
  };

  const resetAddForm = () => {
    setShowAddForm(false);
    setSelectedClient(null);
    setSearchQuery('');
    setManualName('');
    setManualEmail('');
    setManualPhone('');
    setSmsOptIn(false);
    setSignerRole('signer');
    setSignerKind('signer');
    setOtpRequired(true);
    setAccessCode('');
    setErrors({});
    setShowDropdown(false);
  };

  // Visual presets for the recipient kind selector. Keeps the UI explicit
  // about what each type means so admins don't accidentally CC a required
  // signer (or vice-versa).
  // ==================== DRAG & DROP ====================

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;

    const items = [...signers];
    const draggedItem = items[draggedIndex];
    items.splice(draggedIndex, 1);
    items.splice(index, 0, draggedItem);

    onChange(items.map((s, i) => ({ ...s, order: i + 1 })));
    setDraggedIndex(index);
  };

  // ==================== RENDER ====================

  const canAddMore = signers.length < CURRENT_MAX_SIGNERS;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Recipients</h3>
          <p className="text-sm text-gray-500">Select who needs to sign this document</p>
        </div>
        {canAddMore && !showAddForm && (
          <Button
            onClick={() => setShowAddForm(true)}
            disabled={disabled}
            className="bg-purple-600 hover:bg-purple-700 text-white"
          >
            <UserPlus className="h-4 w-4 mr-2" />
            Add Recipient
          </Button>
        )}
      </div>

      <div className="space-y-3">
        {/* Recipient List */}
        {signers.map((signer, index) => {
          const isEditing = editingIndex === index;
          const colorSet = SIGNER_COLORS[index % SIGNER_COLORS.length];

          if (isEditing) {
            return (
              <Card key={`signer-${index}`} className="border-2 border-purple-500 shadow-md">
                <CardContent className="p-4 space-y-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-semibold text-purple-700">
                      Editing Recipient {index + 1}
                    </span>
                    <Button variant="ghost" size="sm" onClick={() => setEditingIndex(null)}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>

                  {/* Name & Email (read-only if system client) */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <Label>Name</Label>
                      <Input
                        value={signer.name}
                        onChange={(e) => handleUpdate(index, { name: e.target.value })}
                        disabled={signer.isSystemClient}
                        className={signer.isSystemClient ? 'bg-gray-50' : ''}
                      />
                      {signer.isSystemClient && (
                        <p className="text-xs text-gray-400">System client (read-only)</p>
                      )}
                    </div>
                    <div className="space-y-1">
                      <Label>Email</Label>
                      <Input
                        value={signer.email}
                        onChange={(e) => handleUpdate(index, { email: e.target.value })}
                        disabled={signer.isSystemClient}
                        className={signer.isSystemClient ? 'bg-gray-50' : ''}
                      />
                    </div>
                  </div>

                  {/* Role */}
                  <div className="space-y-1">
                    <Label>Signing Role</Label>
                    <Select
                      value={SIGNER_ROLES.find((r) => r.label === signer.role)?.value || 'signer'}
                      onValueChange={(val) => {
                        const label = SIGNER_ROLES.find((r) => r.value === val)?.label || val;
                        handleUpdate(index, { role: label });
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {SIGNER_ROLES.map((role) => (
                          <SelectItem key={role.value} value={role.value}>
                            {role.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Security */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <Label>Access Code (Optional)</Label>
                      <div className="relative">
                        <Lock className="absolute left-2 top-2.5 h-4 w-4 text-gray-400" />
                        <Input
                          className="pl-8"
                          placeholder="Security code"
                          value={signer.accessCode || ''}
                          onChange={(e) => handleUpdate(index, { accessCode: e.target.value })}
                        />
                      </div>
                    </div>
                    <div className="flex items-center space-x-2 pt-6">
                      <Checkbox
                        id={`otp-edit-${index}`}
                        checked={signer.otpRequired}
                        onCheckedChange={(c) => handleUpdate(index, { otpRequired: c === true })}
                      />
                      <Label htmlFor={`otp-edit-${index}`}>Require OTP Verification</Label>
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 mt-4">
                    <Button
                      onClick={() => setEditingIndex(null)}
                      className="bg-purple-600 hover:bg-purple-700 text-white"
                    >
                      Save Changes
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          }

          return (
            <div
              key={`signer-${index}`}
              draggable={!disabled && signers.length > 1}
              onDragStart={(e) => handleDragStart(e, index)}
              onDragOver={(e) => handleDragOver(e, index)}
              className="group relative flex items-center gap-3 bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
            >
              {/* Drag Handle */}
              {signers.length > 1 && (
                <div className="cursor-grab text-gray-400 hover:text-gray-600">
                  <GripVertical className="h-5 w-5" />
                </div>
              )}

              {/* Order Badge */}
              <div
                className="flex items-center justify-center w-9 h-9 rounded-full text-white font-bold text-sm shrink-0"
                style={{ backgroundColor: colorSet.hex }}
              >
                {index + 1}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h4 className="font-medium text-gray-900">{signer.name}</h4>
                  {signer.isSystemClient && (
                    <Badge
                      variant="outline"
                      className="text-xs font-normal bg-green-50 border-green-200 text-green-700"
                    >
                      <UserCheck className="h-3 w-3 mr-1" />
                      System Client
                    </Badge>
                  )}
                  <Badge variant="outline" className="text-xs font-normal">
                    {signer.role || 'Signer'}
                  </Badge>
                  {signer.kind === 'cc' && (
                    <Badge
                      variant="outline"
                      className="text-xs font-normal bg-cyan-50 border-cyan-200 text-cyan-700"
                    >
                      <Send className="h-3 w-3 mr-1" />
                      Receives copy
                    </Badge>
                  )}
                  {signer.kind === 'witness' && (
                    <Badge
                      variant="outline"
                      className="text-xs font-normal bg-amber-50 border-amber-200 text-amber-700"
                    >
                      <ScrollText className="h-3 w-3 mr-1" />
                      Witness
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-4 text-sm text-gray-500 mt-1">
                  <span className="flex items-center gap-1 truncate">
                    <Mail className="h-3 w-3" />
                    {signer.email}
                  </span>
                  {(signer.accessCode || signer.otpRequired) && (
                    <span className="flex items-center gap-1 text-orange-600 bg-orange-50 px-1.5 py-0.5 rounded text-xs">
                      <Shield className="h-3 w-3" />
                      Secured
                    </span>
                  )}
                </div>
              </div>

              {/* Actions */}
              {!disabled && (
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button variant="ghost" size="sm" onClick={() => setEditingIndex(index)}>
                    <Edit2 className="h-4 w-4 text-gray-500" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => handleDelete(index)}>
                    <Trash2 className="h-4 w-4 text-red-500" />
                  </Button>
                </div>
              )}
            </div>
          );
        })}

        {/* Add Form */}
        {showAddForm && (
          <RecipientAddForm
            addMode={addMode}
            setAddMode={setAddMode}
            resetAddForm={resetAddForm}
            handleAdd={handleAdd}
            errors={errors}
            setErrors={setErrors}
            loadingClients={loadingClients}
            filteredClients={filteredClients}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            searchRef={searchRef}
            searchInputGuard={searchInputGuard}
            showDropdown={showDropdown}
            setShowDropdown={setShowDropdown}
            selectedClient={selectedClient}
            setSelectedClient={setSelectedClient}
            manualName={manualName}
            setManualName={setManualName}
            manualEmail={manualEmail}
            setManualEmail={setManualEmail}
            manualPhone={manualPhone}
            setManualPhone={setManualPhone}
            signerKind={signerKind}
            setSignerKind={setSignerKind}
            signerRole={signerRole}
            setSignerRole={setSignerRole}
            otpRequired={otpRequired}
            setOtpRequired={setOtpRequired}
            accessCode={accessCode}
            setAccessCode={setAccessCode}
            smsOptIn={smsOptIn}
            setSmsOptIn={setSmsOptIn}
          />
        )}

        {/* Empty State */}
        {signers.length === 0 && !showAddForm && (
          <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-200">
            <Users className="h-10 w-10 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 font-medium">No recipients added yet</p>
            <p className="text-xs text-gray-400 mt-1">
              Add a client from the system or enter details manually
            </p>
            <Button
              variant="link"
              onClick={() => setShowAddForm(true)}
              className="text-purple-600 mt-2"
            >
              Add your first recipient
            </Button>
          </div>
        )}
      </div>

      {/* Signing Order Info */}
      {signers.length > 0 && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-3">
          <div className="flex items-start gap-2">
            <Info className="h-4 w-4 text-gray-500 mt-0.5 shrink-0" />
            <div className="text-sm text-gray-600">
              <p className="font-medium text-gray-700">Signing Order</p>
              <p className="mt-1">
                Recipients will receive the document in the numbered order shown above.
                {signers.length > 1 &&
                  ' Each signer will be notified once the previous signer completes.'}
              </p>
            </div>
          </div>

          {/* Future multi-signer note */}
          {(CURRENT_MAX_SIGNERS as number) === 1 && signers.length >= 1 && (
            <div className="flex items-start gap-2 pt-2 border-t border-gray-200">
              <ExternalLink className="h-4 w-4 text-purple-500 mt-0.5 shrink-0" />
              <p className="text-xs text-gray-500">
                <span className="font-medium text-purple-600">Coming soon:</span> Multi-signer
                sequential signing with role-based ordering (e.g., First Life Assured signs, then
                Premium Payer receives the document). Fields placed in the editor will be assignable
                per signer.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
