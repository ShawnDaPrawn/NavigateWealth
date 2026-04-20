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
  Check,
  X,
  GripVertical,
  AlertCircle,
  Search,
  UserCheck,
  Building2,
  Info,
  ExternalLink,
  PenSquare,
  ScrollText,
  Send,
} from 'lucide-react';
import { clientApi } from '../../client-management/api';
import { SIGNER_ROLES, SIGNER_COLORS, CURRENT_MAX_SIGNERS } from '../constants';
import type { SignerFormData, SignerKind } from '../types';

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

type AddMode = 'system' | 'manual';

interface SystemClient {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  status: string;
  nationalId?: string;
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
      const response = await clientApi.getClients();
      const users = response?.users || response?.clients || [];
      // Filter to active and pending clients only, then map to simplified shape
      const eligible = users
        .map((u: { id: string; email?: string; name?: string; user_metadata?: Record<string, unknown>; profile?: Record<string, unknown>; application_status?: string }) => {
          // Server may return profile as flat ProfileData or nested ClientProfile
          const pi = (u.profile?.personalInformation as Record<string, unknown> | undefined) || u.profile;
          return {
            id: u.id,
            firstName: u.user_metadata?.firstName || pi?.firstName || u.name?.split(' ')[0] || '',
            lastName: u.user_metadata?.surname || pi?.lastName || u.name?.split(' ').slice(1).join(' ') || '',
            email: u.email || '',
            status: u.application_status || 'active',
            nationalId: u.user_metadata?.nationalId || pi?.idNumber || pi?.passportNumber || undefined,
          };
        })
        .filter((client: SystemClient) => {
          const status = client.status.toLowerCase();
          // Include active, pending, approved, onboarded clients
          return ['active', 'pending', 'approved', 'onboarded', 'unknown'].includes(status)
            || !status;
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
    if (
      clientContext &&
      clientContext.email &&
      signers.length === 0
    ) {
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

  const filteredClients = systemClients.filter((client) => {
    const query = searchQuery.toLowerCase();
    if (!query) return true;
    const fullName = `${client.firstName} ${client.lastName}`.toLowerCase();
    return (
      fullName.includes(query) ||
      client.email.toLowerCase().includes(query) ||
      client.id.toLowerCase().includes(query)
    );
  }).filter((client) => {
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
    const effectiveAccessCode = signerKind === 'cc' ? undefined : (accessCode || undefined);

    const phoneTrimmed = manualPhone.trim();
    const effectiveSmsOptIn = signerKind !== 'cc' && smsOptIn && !!phoneTrimmed;

    const newSigner: SignerFormData = addMode === 'system'
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
          <p className="text-sm text-gray-500">
            Select who needs to sign this document
          </p>
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
                    <Badge variant="outline" className="text-xs font-normal bg-green-50 border-green-200 text-green-700">
                      <UserCheck className="h-3 w-3 mr-1" />
                      System Client
                    </Badge>
                  )}
                  <Badge variant="outline" className="text-xs font-normal">
                    {signer.role || 'Signer'}
                  </Badge>
                  {signer.kind === 'cc' && (
                    <Badge variant="outline" className="text-xs font-normal bg-cyan-50 border-cyan-200 text-cyan-700">
                      <Send className="h-3 w-3 mr-1" />
                      Receives copy
                    </Badge>
                  )}
                  {signer.kind === 'witness' && (
                    <Badge variant="outline" className="text-xs font-normal bg-amber-50 border-amber-200 text-amber-700">
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
                  onClick={() => { setAddMode('system'); setErrors({}); }}
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
                  onClick={() => { setAddMode('manual'); setErrors({}); setSelectedClient(null); }}
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
                        placeholder="Search by name or email..."
                        className="pl-9"
                        value={searchQuery}
                        onChange={(e) => {
                          setSearchQuery(e.target.value);
                          setShowDropdown(true);
                          setSelectedClient(null);
                        }}
                        onFocus={() => setShowDropdown(true)}
                      />
                    </div>

                    {/* Dropdown */}
                    {showDropdown && (
                      <div className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                        {loadingClients ? (
                          <div className="p-4 text-center text-sm text-gray-500">
                            Loading clients...
                          </div>
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
                                  {client.firstName?.[0]}{client.lastName?.[0]}
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
                        {selectedClient.firstName?.[0]}{selectedClient.lastName?.[0]}
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
                      When a system client is selected, this envelope will automatically appear
                      on their client profile page for tracking and management.
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
                    {errors.name && (
                      <p className="text-xs text-red-500">{errors.name}</p>
                    )}
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
                    {errors.email && (
                      <p className="text-xs text-red-500">{errors.email}</p>
                    )}
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
                  {errors.role && (
                    <p className="text-xs text-red-500">{errors.role}</p>
                  )}
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
                <Button
                  onClick={handleAdd}
                  className="bg-purple-600 hover:bg-purple-700 text-white"
                >
                  <Check className="h-4 w-4 mr-2" />
                  Add Recipient
                </Button>
              </div>
            </CardContent>
          </Card>
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
                {signers.length > 1 && ' Each signer will be notified once the previous signer completes.'}
              </p>
            </div>
          </div>

          {/* Future multi-signer note */}
          {CURRENT_MAX_SIGNERS === 1 && signers.length >= 1 && (
            <div className="flex items-start gap-2 pt-2 border-t border-gray-200">
              <ExternalLink className="h-4 w-4 text-purple-500 mt-0.5 shrink-0" />
              <p className="text-xs text-gray-500">
                <span className="font-medium text-purple-600">Coming soon:</span>{' '}
                Multi-signer sequential signing with role-based ordering
                (e.g., First Life Assured signs, then Premium Payer receives the document).
                Fields placed in the editor will be assignable per signer.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}