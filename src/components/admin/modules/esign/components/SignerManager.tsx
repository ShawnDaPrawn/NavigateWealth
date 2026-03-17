/**
 * Signer Manager Component
 * Manages signers for e-signature envelopes - add, edit, reorder, and assign fields
 */

import React, { useState, useCallback } from 'react';
import { Button } from '../../../../ui/button';
import { Input } from '../../../../ui/input';
import { Label } from '../../../../ui/label';
import { Card, CardContent } from '../../../../ui/card';
import { Badge } from '../../../../ui/badge';
import { Checkbox } from '../../../../ui/checkbox';
import {
  UserPlus,
  Mail,
  User,
  Users,
  Tag,
  Hash,
  Lock,
  Shield,
  Trash2,
  Edit2,
  Check,
  X,
  GripVertical,
  AlertCircle,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import type { EsignSigner, SignerFormData, SignerStatus } from '../types';
import { getSignerStatusColor, getSignerStatusLabel } from '../types';

interface SignerManagerProps {
  signers: SignerFormData[];
  onChange: (signers: SignerFormData[]) => void;
  existingSigners?: EsignSigner[];
  clientEmail?: string;
  clientName?: string;
  disabled?: boolean;
  showFieldAssignment?: boolean;
}

interface SignerEditState {
  index: number;
  data: SignerFormData;
  errors: Record<string, string>;
}

export function SignerManager({
  signers,
  onChange,
  existingSigners,
  clientEmail,
  clientName,
  disabled = false,
  showFieldAssignment = false,
}: SignerManagerProps) {
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  const [newSigner, setNewSigner] = useState<SignerFormData>({
    name: '',
    email: '',
    role: 'Signer',
    order: signers.length + 1,
    otpRequired: true,
    accessCode: '',
  });
  const [newSignerErrors, setNewSignerErrors] = useState<Record<string, string>>({});
  const [showAddForm, setShowAddForm] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  // ==================== VALIDATION ====================

  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const validateSigner = (signer: SignerFormData): Record<string, string> => {
    const errors: Record<string, string> = {};

    if (!signer.name.trim()) {
      errors.name = 'Name is required';
    }

    if (!signer.email.trim()) {
      errors.email = 'Email is required';
    } else if (!validateEmail(signer.email)) {
      errors.email = 'Invalid email format';
    }

    // Check for duplicate emails
    const duplicateEmail = signers.some(
      (s, idx) => 
        s.email.toLowerCase() === signer.email.toLowerCase() && 
        idx !== editingIndex
    );
    if (duplicateEmail) {
      errors.email = 'Email already added';
    }

    if (signer.accessCode && signer.accessCode.length < 4) {
      errors.accessCode = 'Access code must be at least 4 characters';
    }

    return errors;
  };

  // ==================== ADD SIGNER ====================

  const handleAddSigner = () => {
    const errors = validateSigner(newSigner);
    setNewSignerErrors(errors);

    if (Object.keys(errors).length === 0) {
      const signerToAdd = {
        ...newSigner,
        order: signers.length + 1,
      };
      onChange([...signers, signerToAdd]);

      // Reset form
      setNewSigner({
        name: '',
        email: '',
        role: 'Signer',
        order: signers.length + 2,
        otpRequired: true,
        accessCode: '',
      });
      setNewSignerErrors({});
      setShowAddForm(false);
    }
  };

  const handleAddClientAsSigner = () => {
    if (!clientEmail || !clientName) return;

    const clientSigner: SignerFormData = {
      name: clientName,
      email: clientEmail,
      role: 'Client',
      order: signers.length + 1,
      otpRequired: true,
      accessCode: '',
    };

    onChange([...signers, clientSigner]);
  };

  // ==================== EDIT SIGNER ====================

  const startEditing = (index: number) => {
    setEditingIndex(index);
    setExpandedIndex(null);
  };

  const cancelEditing = () => {
    setEditingIndex(null);
  };

  const saveEditing = (index: number) => {
    const updatedSigners = [...signers];
    const errors = validateSigner(updatedSigners[index]);

    if (Object.keys(errors).length === 0) {
      onChange(updatedSigners);
      setEditingIndex(null);
    } else {
      // Show errors (you could add error state per signer)
      console.error('Validation errors:', errors);
    }
  };

  const updateSigner = (index: number, field: keyof SignerFormData, value: string | number | boolean) => {
    const updatedSigners = [...signers];
    updatedSigners[index] = {
      ...updatedSigners[index],
      [field]: value,
    };
    onChange(updatedSigners);
  };

  // ==================== DELETE SIGNER ====================

  const deleteSigner = (index: number) => {
    const updatedSigners = signers.filter((_, i) => i !== index);
    // Reorder remaining signers
    const reorderedSigners = updatedSigners.map((s, i) => ({
      ...s,
      order: i + 1,
    }));
    onChange(reorderedSigners);
    if (editingIndex === index) {
      setEditingIndex(null);
    }
    if (expandedIndex === index) {
      setExpandedIndex(null);
    }
  };

  // ==================== REORDER SIGNERS ====================

  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;

    const updatedSigners = [...signers];
    const draggedSigner = updatedSigners[draggedIndex];
    updatedSigners.splice(draggedIndex, 1);
    updatedSigners.splice(index, 0, draggedSigner);

    // Update order numbers
    const reorderedSigners = updatedSigners.map((s, i) => ({
      ...s,
      order: i + 1,
    }));

    onChange(reorderedSigners);
    setDraggedIndex(index);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
  };

  // ==================== EXPAND/COLLAPSE ====================

  const toggleExpanded = (index: number) => {
    setExpandedIndex(expandedIndex === index ? null : index);
  };

  // ==================== RENDER ====================

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-lg">Signers</h3>
          <p className="text-sm text-muted-foreground">
            Add people who need to sign this document
          </p>
        </div>
        <Badge variant="outline" className="text-sm">
          {signers.length} {signers.length === 1 ? 'Signer' : 'Signers'}
        </Badge>
      </div>

      {/* Quick Add Client Button */}
      {clientEmail && clientName && !signers.some(s => s.email === clientEmail) && (
        <Button
          type="button"
          variant="outline"
          onClick={handleAddClientAsSigner}
          disabled={disabled}
          className="w-full border-dashed"
        >
          <UserPlus className="h-4 w-4 mr-2" />
          Add {clientName} as Signer
        </Button>
      )}

      {/* Existing Signers List */}
      <div className="space-y-2">
        {signers.map((signer, index) => {
          const isEditing = editingIndex === index;
          const isExpanded = expandedIndex === index;
          const existingSigner = existingSigners?.find(
            (es) => es.email === signer.email
          );

          return (
            <Card
              key={index}
              className={`transition-all ${
                draggedIndex === index ? 'opacity-50' : ''
              } ${isEditing ? 'ring-2 ring-purple-500' : ''}`}
              draggable={!disabled && !isEditing}
              onDragStart={() => handleDragStart(index)}
              onDragOver={(e) => handleDragOver(e, index)}
              onDragEnd={handleDragEnd}
            >
              <CardContent className="p-4">
                {isEditing ? (
                  // EDITING MODE
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor={`signer-name-${index}`}>Name *</Label>
                        <Input
                          id={`signer-name-${index}`}
                          value={signer.name}
                          onChange={(e) =>
                            updateSigner(index, 'name', e.target.value)
                          }
                          placeholder="John Doe"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor={`signer-email-${index}`}>Email *</Label>
                        <Input
                          id={`signer-email-${index}`}
                          type="email"
                          value={signer.email}
                          onChange={(e) =>
                            updateSigner(index, 'email', e.target.value)
                          }
                          placeholder="john@example.com"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor={`signer-role-${index}`}>
                          Role (Optional)
                        </Label>
                        <Input
                          id={`signer-role-${index}`}
                          value={signer.role || ''}
                          onChange={(e) =>
                            updateSigner(index, 'role', e.target.value)
                          }
                          placeholder="Client, Witness, etc."
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor={`signer-accessCode-${index}`}>
                          Access Code (Optional)
                        </Label>
                        <Input
                          id={`signer-accessCode-${index}`}
                          type="text"
                          value={signer.accessCode || ''}
                          onChange={(e) =>
                            updateSigner(index, 'accessCode', e.target.value)
                          }
                          placeholder="Min 4 characters"
                        />
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Checkbox
                        id={`signer-otp-${index}`}
                        checked={signer.otpRequired}
                        onCheckedChange={(checked) =>
                          updateSigner(index, 'otpRequired', checked === true)
                        }
                      />
                      <Label
                        htmlFor={`signer-otp-${index}`}
                        className="text-sm cursor-pointer"
                      >
                        Require OTP verification before signing
                      </Label>
                    </div>

                    <div className="flex items-center gap-2 pt-2">
                      <Button
                        type="button"
                        onClick={() => saveEditing(index)}
                        size="sm"
                        className="bg-purple-600 hover:bg-purple-700"
                      >
                        <Check className="h-4 w-4 mr-2" />
                        Save
                      </Button>
                      <Button
                        type="button"
                        onClick={cancelEditing}
                        variant="outline"
                        size="sm"
                      >
                        <X className="h-4 w-4 mr-2" />
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  // VIEW MODE
                  <div className="space-y-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3 flex-1">
                        {!disabled && (
                          <div
                            className="cursor-grab active:cursor-grabbing pt-1"
                            title="Drag to reorder"
                          >
                            <GripVertical className="h-5 w-5 text-muted-foreground" />
                          </div>
                        )}
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{signer.name}</span>
                            {signer.role && (
                              <Badge variant="outline" className="text-xs">
                                {signer.role}
                              </Badge>
                            )}
                            <Badge variant="secondary" className="text-xs">
                              #{signer.order}
                            </Badge>
                            {existingSigner && (
                              <Badge
                                className={getSignerStatusColor(existingSigner.status)}
                              >
                                {getSignerStatusLabel(existingSigner.status)}
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
                            <span className="flex items-center gap-1">
                              <Mail className="h-3.5 w-3.5" />
                              {signer.email}
                            </span>
                            {signer.otpRequired && (
                              <span className="flex items-center gap-1 text-purple-600">
                                <Shield className="h-3.5 w-3.5" />
                                OTP Required
                              </span>
                            )}
                            {signer.accessCode && (
                              <span className="flex items-center gap-1">
                                <Lock className="h-3.5 w-3.5" />
                                Access Code Set
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {!disabled && (
                        <div className="flex items-center gap-1">
                          {showFieldAssignment && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => toggleExpanded(index)}
                            >
                              {isExpanded ? (
                                <ChevronUp className="h-4 w-4" />
                              ) : (
                                <ChevronDown className="h-4 w-4" />
                              )}
                            </Button>
                          )}
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => startEditing(index)}
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => deleteSigner(index)}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    </div>

                    {/* Expanded Field Assignment Area */}
                    {isExpanded && showFieldAssignment && (
                      <div className="pt-3 border-t">
                        <div className="bg-gray-50 rounded-lg p-4">
                          <div className="flex items-center justify-between mb-3">
                            <h4 className="text-sm font-medium">
                              Field Assignments
                            </h4>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                            >
                              Add Field
                            </Button>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            No fields assigned yet. Add signature, initial, or text fields for this signer.
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Add New Signer Form */}
      {showAddForm ? (
        <Card className="border-2 border-dashed border-purple-300">
          <CardContent className="p-4">
            <h4 className="font-medium mb-4">Add New Signer</h4>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="new-signer-name">Name *</Label>
                  <Input
                    id="new-signer-name"
                    value={newSigner.name}
                    onChange={(e) =>
                      setNewSigner({ ...newSigner, name: e.target.value })
                    }
                    placeholder="John Doe"
                    className={newSignerErrors.name ? 'border-red-300' : ''}
                  />
                  {newSignerErrors.name && (
                    <p className="text-sm text-red-600 flex items-center gap-1">
                      <AlertCircle className="h-3.5 w-3.5" />
                      {newSignerErrors.name}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="new-signer-email">Email *</Label>
                  <Input
                    id="new-signer-email"
                    type="email"
                    value={newSigner.email}
                    onChange={(e) =>
                      setNewSigner({ ...newSigner, email: e.target.value })
                    }
                    placeholder="john@example.com"
                    className={newSignerErrors.email ? 'border-red-300' : ''}
                  />
                  {newSignerErrors.email && (
                    <p className="text-sm text-red-600 flex items-center gap-1">
                      <AlertCircle className="h-3.5 w-3.5" />
                      {newSignerErrors.email}
                    </p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="new-signer-role">Role (Optional)</Label>
                  <Input
                    id="new-signer-role"
                    value={newSigner.role || ''}
                    onChange={(e) =>
                      setNewSigner({ ...newSigner, role: e.target.value })
                    }
                    placeholder="Client, Witness, etc."
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="new-signer-accessCode">
                    Access Code (Optional)
                  </Label>
                  <Input
                    id="new-signer-accessCode"
                    type="text"
                    value={newSigner.accessCode || ''}
                    onChange={(e) =>
                      setNewSigner({ ...newSigner, accessCode: e.target.value })
                    }
                    placeholder="Min 4 characters"
                    className={
                      newSignerErrors.accessCode ? 'border-red-300' : ''
                    }
                  />
                  {newSignerErrors.accessCode && (
                    <p className="text-sm text-red-600 flex items-center gap-1">
                      <AlertCircle className="h-3.5 w-3.5" />
                      {newSignerErrors.accessCode}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Checkbox
                  id="new-signer-otp"
                  checked={newSigner.otpRequired}
                  onCheckedChange={(checked) =>
                    setNewSigner({ ...newSigner, otpRequired: checked === true })
                  }
                />
                <Label
                  htmlFor="new-signer-otp"
                  className="text-sm cursor-pointer"
                >
                  Require OTP verification before signing
                </Label>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <Button
                  type="button"
                  onClick={handleAddSigner}
                  size="sm"
                  className="bg-purple-600 hover:bg-purple-700"
                >
                  <Check className="h-4 w-4 mr-2" />
                  Add Signer
                </Button>
                <Button
                  type="button"
                  onClick={() => {
                    setShowAddForm(false);
                    setNewSigner({
                      name: '',
                      email: '',
                      role: 'Signer',
                      order: signers.length + 1,
                      otpRequired: true,
                      accessCode: '',
                    });
                    setNewSignerErrors({});
                  }}
                  variant="outline"
                  size="sm"
                >
                  <X className="h-4 w-4 mr-2" />
                  Cancel
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Button
          type="button"
          variant="outline"
          onClick={() => setShowAddForm(true)}
          disabled={disabled}
          className="w-full border-dashed"
        >
          <UserPlus className="h-4 w-4 mr-2" />
          Add Signer
        </Button>
      )}

      {/* Empty State */}
      {signers.length === 0 && !showAddForm && (
        <div className="text-center py-8 text-muted-foreground">
          <Users className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p className="text-sm">No signers added yet</p>
          <p className="text-xs mt-1">Add at least one signer to continue</p>
        </div>
      )}

      {/* Signing Order Info */}
      {signers.length > 1 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
          <div className="flex items-start gap-2">
            <Hash className="h-4 w-4 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-blue-900">
              <p className="font-medium">Sequential Signing</p>
              <p className="text-blue-700 mt-1">
                Signers will receive the document in the order shown. Drag to reorder.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}