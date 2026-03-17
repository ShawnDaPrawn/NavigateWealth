/**
 * Document Editor Component
 * Complete editing interface for e-signature documents
 * Integrates: PDFViewer + FieldPalette + SignerManager for field placement
 */

import React, { useState, useCallback } from 'react';
import { Button } from '../../../../ui/button';
import { Badge } from '../../../../ui/badge';
import { Card } from '../../../../ui/card';
import {
  ArrowLeft,
  Send,
  Save,
  Users,
  FileText,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';
import { PDFViewer } from './PDFViewer';
import { FieldPalette } from './FieldPalette';
import { SignerManager } from './SignerManager';
import type { EsignEnvelope, EsignField, SignerFormData } from '../types';
import type { Client } from '../../client-management/types';

interface DocumentEditorProps {
  envelope: EsignEnvelope;
  client: Client;
  onSave?: (updates: {
    signers: SignerFormData[];
    fields: EsignField[];
  }) => Promise<void>;
  onSend?: () => Promise<void>;
  onBack?: () => void;
  saving?: boolean;
  sending?: boolean;
}

export function DocumentEditor({
  envelope,
  client,
  onSave,
  onSend,
  onBack,
  saving = false,
  sending = false,
}: DocumentEditorProps) {
  const [signers, setSigners] = useState<SignerFormData[]>(
    envelope.signers?.map((s) => ({
      name: s.name,
      email: s.email,
      role: s.role || '',
      order: s.order,
      otpRequired: s.otpRequired || false,
      accessCode: s.accessCode || '',
    })) || []
  );

  const [fields, setFields] = useState<EsignField[]>(envelope.fields || []);
  const [selectedSignerId, setSelectedSignerId] = useState<string | undefined>(
    signers[0]?.email
  );
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [showValidationErrors, setShowValidationErrors] = useState(false);

  // ==================== VALIDATION ====================

  const validate = useCallback(() => {
    const errors: string[] = [];

    if (signers.length === 0) {
      errors.push('Add at least one signer');
    }

    if (fields.length === 0) {
      errors.push('Place at least one signature field');
    }

    // Check each signer has at least one signature field
    signers.forEach((signer) => {
      const signerFields = fields.filter((f) => f.signerId === signer.email);
      const hasSignature = signerFields.some((f) => f.type === 'signature');
      if (!hasSignature) {
        errors.push(`${signer.name} needs at least one signature field`);
      }
    });

    return errors;
  }, [signers, fields]);

  const validationErrors = validate();
  const isValid = validationErrors.length === 0;

  // ==================== FIELD MANAGEMENT ====================

  const handleFieldPlace = useCallback(
    (newField: Omit<EsignField, 'id'>) => {
      const fieldWithId: EsignField = {
        ...newField,
        id: `field-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      };

      setFields((prev) => [...prev, fieldWithId]);
      setHasUnsavedChanges(true);
    },
    []
  );

  const handleFieldUpdate = useCallback(
    (fieldId: string, updates: Partial<EsignField>) => {
      setFields((prev) =>
        prev.map((field) =>
          field.id === fieldId ? { ...field, ...updates } : field
        )
      );
      setHasUnsavedChanges(true);
    },
    []
  );

  const handleFieldDelete = useCallback((fieldId: string) => {
    setFields((prev) => prev.filter((field) => field.id !== fieldId));
    setHasUnsavedChanges(true);
  }, []);

  const handleFieldClick = useCallback((field: EsignField) => {
    // Select the signer for this field
    setSelectedSignerId(field.signerId);
  }, []);

  // ==================== SIGNER MANAGEMENT ====================

  const handleSignersChange = useCallback((updatedSigners: SignerFormData[]) => {
    setSigners(updatedSigners);
    setHasUnsavedChanges(true);

    // If we removed the currently selected signer, select another
    setSelectedSignerId((current) => {
      if (!current) return updatedSigners[0]?.email;
      const stillExists = updatedSigners.some((s) => s.email === current);
      return stillExists ? current : updatedSigners[0]?.email;
    });
  }, []);

  // ==================== SAVE & SEND ====================

  const handleSave = async () => {
    if (!onSave) return;

    setShowValidationErrors(false);

    try {
      await onSave({ signers, fields });
      setHasUnsavedChanges(false);
    } catch (error) {
      console.error('Failed to save:', error);
    }
  };

  const handleSend = async () => {
    if (!isValid) {
      setShowValidationErrors(true);
      return;
    }

    if (!onSend) return;

    try {
      // Auto-save before sending
      if (hasUnsavedChanges && onSave) {
        await onSave({ signers, fields });
        setHasUnsavedChanges(false);
      }

      await onSend();
    } catch (error) {
      console.error('Failed to send:', error);
    }
  };

  // ==================== RENDER ====================

  return (
    <div className="space-y-4">
      {/* Header */}
      <Card className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {onBack && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onBack}
                className="h-8"
              >
                <ArrowLeft className="h-4 w-4 mr-1" />
                Back
              </Button>
            )}
            <div>
              <h2 className="font-semibold text-lg">{envelope.title}</h2>
              <p className="text-sm text-muted-foreground">
                Prepare document for signing
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {hasUnsavedChanges && (
              <Badge variant="secondary" className="text-orange-600">
                Unsaved changes
              </Badge>
            )}

            <Button
              variant="outline"
              onClick={handleSave}
              disabled={saving || !hasUnsavedChanges}
            >
              {saving ? (
                <span>Saving...</span>
              ) : (
                <div className="contents">
                  <Save className="h-4 w-4 mr-1" />
                  Save
                </div>
              )}
            </Button>

            <Button
              onClick={handleSend}
              disabled={sending || !isValid}
              className="bg-purple-600 hover:bg-purple-700"
            >
              {sending ? (
                <span>Sending...</span>
              ) : (
                <div className="contents">
                  <Send className="h-4 w-4 mr-1" />
                  Send for Signature
                </div>
              )}
            </Button>
          </div>
        </div>
      </Card>

      {/* Validation Errors */}
      {showValidationErrors && validationErrors.length > 0 && (
        <Card className="p-4 bg-red-50 border-red-200">
          <div className="flex items-start gap-2">
            <AlertCircle className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <h3 className="font-semibold text-red-900 mb-1">
                Cannot send document
              </h3>
              <ul className="text-sm text-red-700 space-y-1">
                {validationErrors.map((error, idx) => (
                  <li key={idx}>• {error}</li>
                ))}
              </ul>
            </div>
          </div>
        </Card>
      )}

      {/* Readiness Checklist */}
      {!showValidationErrors && (
        <Card className="p-3">
          <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center gap-2">
              {signers.length > 0 ? (
                <CheckCircle2 className="h-4 w-4 text-green-600" />
              ) : (
                <AlertCircle className="h-4 w-4 text-orange-600" />
              )}
              <span>
                <strong>{signers.length}</strong> signer{signers.length !== 1 ? 's' : ''}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {fields.length > 0 ? (
                <CheckCircle2 className="h-4 w-4 text-green-600" />
              ) : (
                <AlertCircle className="h-4 w-4 text-orange-600" />
              )}
              <span>
                <strong>{fields.length}</strong> field{fields.length !== 1 ? 's' : ''}
              </span>
            </div>
            {isValid ? (
              <Badge variant="default" className="ml-auto bg-green-600">
                Ready to send
              </Badge>
            ) : (
              <Badge variant="secondary" className="ml-auto text-orange-600">
                Setup incomplete
              </Badge>
            )}
          </div>
        </Card>
      )}

      {/* Main Editor Layout */}
      <div className="grid grid-cols-12 gap-4">
        {/* Left Sidebar - Signers */}
        <div className="col-span-3 space-y-4">
          <Card className="p-4">
            <div className="flex items-center gap-2 mb-4">
              <Users className="h-4 w-4 text-purple-600" />
              <h3 className="font-semibold">Signers</h3>
              <Badge variant="secondary" className="ml-auto">
                {signers.length}
              </Badge>
            </div>

            {/* Signer Selection */}
            <div className="space-y-2 mb-4">
              {signers.map((signer, idx) => (
                <button
                  key={signer.email}
                  onClick={() => setSelectedSignerId(signer.email)}
                  className={`
                    w-full text-left p-2 rounded-lg border-2 transition-all
                    ${
                      selectedSignerId === signer.email
                        ? 'border-purple-500 bg-purple-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }
                  `}
                >
                  <div className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-full flex-shrink-0"
                      style={{
                        backgroundColor: [
                          '#6d28d9',
                          '#0891b2',
                          '#059669',
                          '#ea580c',
                          '#dc2626',
                        ][idx % 5],
                      }}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{signer.name}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {fields.filter((f) => f.signerId === signer.email).length} field
                        {fields.filter((f) => f.signerId === signer.email).length !== 1
                          ? 's'
                          : ''}
                      </p>
                    </div>
                  </div>
                </button>
              ))}
            </div>

            <SignerManager
              signers={signers}
              onChange={handleSignersChange}
              clientEmail={client.email}
              clientName={client.name}
            />
          </Card>
        </div>

        {/* Center - PDF Viewer */}
        <div className="col-span-6">
          <PDFViewer
            documentUrl={envelope.documentUrl}
            documentName={envelope.documentName || envelope.title}
            fields={fields}
            onFieldPlace={handleFieldPlace}
            onFieldClick={handleFieldClick}
            selectedSignerId={selectedSignerId}
            showFields={true}
          />
        </div>

        {/* Right Sidebar - Field Palette */}
        <div className="col-span-3">
          <Card className="p-4">
            <div className="flex items-center gap-2 mb-4">
              <FileText className="h-4 w-4 text-purple-600" />
              <h3 className="font-semibold">Fields</h3>
            </div>

            <FieldPalette
              signers={signers}
              fields={fields}
              onAddField={handleFieldPlace}
              onUpdateField={handleFieldUpdate}
              onDeleteField={handleFieldDelete}
              selectedSignerId={selectedSignerId}
            />
          </Card>
        </div>
      </div>
    </div>
  );
}