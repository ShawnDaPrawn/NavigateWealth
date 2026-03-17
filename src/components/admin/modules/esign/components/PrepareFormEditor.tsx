/**
 * Prepare Form Editor - Standalone Document Preparation
 * Allows admins to drag/drop fields onto PDF before sending to signers
 * This is the CRITICAL step between upload and sending
 */

import React, { useState, useCallback, useEffect, useRef } from 'react';
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
  Loader2,
  Plus,
} from 'lucide-react';
import { PDFViewer } from './PDFViewer';
import { FieldPalette } from './FieldPalette';
import type { EsignEnvelope, EsignField, SignerFormData, FieldType } from '../types';
import { projectId, publicAnonKey } from '../../../../../utils/supabase/info';

interface PrepareFormEditorProps {
  envelope: EsignEnvelope;
  signers: SignerFormData[];
  onBack?: () => void;
  onSaveFields?: (fields: EsignField[]) => Promise<void>;
  onSendForSignature?: () => Promise<void>;
  saving?: boolean;
  sending?: boolean;
  documentUrl?: string;
}

export function PrepareFormEditor({
  envelope,
  signers: initialSigners,
  onBack,
  onSaveFields,
  onSendForSignature,
  saving = false,
  sending = false,
  documentUrl,
}: PrepareFormEditorProps) {
  const [signers] = useState<SignerFormData[]>(initialSigners);
  const [fields, setFields] = useState<EsignField[]>(envelope.fields || []);
  const [selectedSignerId, setSelectedSignerId] = useState<string | undefined>(
    signers[0]?.email
  );
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [showValidationErrors, setShowValidationErrors] = useState(false);
  const [autoSaving, setAutoSaving] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);

  // Debounce timer ref for auto-save
  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastSavedFieldsRef = useRef<string>(JSON.stringify(envelope.fields || []));

  // ==================== AUTO-SAVE FUNCTIONALITY ====================

  /**
   * Debounced auto-save: saves fields to backend after 2 seconds of inactivity
   */
  useEffect(() => {
    // Skip if no changes or already saving
    if (!hasUnsavedChanges || saving || sending) return;

    // Check if fields actually changed (compare stringified versions)
    const currentFieldsStr = JSON.stringify(fields);
    if (currentFieldsStr === lastSavedFieldsRef.current) return;

    // Clear existing timer
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }

    // Set new timer for auto-save
    autoSaveTimerRef.current = setTimeout(() => {
      handleAutoSave();
    }, 2000); // 2 second debounce

    // Cleanup on unmount
    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, [fields, hasUnsavedChanges, saving, sending]);

  const handleAutoSave = async () => {
    try {
      setAutoSaving(true);
      
      // Save to backend via API
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-91ed8379/esign/envelopes/${envelope.id}/fields`,
        {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ fields }),
        }
      );

      if (!response.ok) {
        throw new Error('Failed to auto-save fields');
      }

      // Update last saved reference
      lastSavedFieldsRef.current = JSON.stringify(fields);
      setHasUnsavedChanges(false);
      
      console.log('✅ Auto-saved field positions');
    } catch (error) {
      console.error('❌ Auto-save failed:', error);
      // Don't show error to user for auto-save failures
    } finally {
      setAutoSaving(false);
    }
  };

  // ==================== VALIDATION ====================

  const validate = useCallback(() => {
    const errors: string[] = [];

    if (signers.length === 0) {
      errors.push('Add at least one signer');
    }

    if (fields.length === 0) {
      errors.push('Place at least one signature field on the document');
    }

    // Check each signer has at least one signature field
    signers.forEach((signer) => {
      const signerFields = fields.filter((f) => f.signer_id === signer.email);
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
    (newField: Partial<EsignField>) => {
      const fieldWithDefaults: EsignField = {
        id: `field-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        envelope_id: envelope.id,
        type: newField.type || 'signature',
        page: newField.page || 1,
        x: newField.x || 100,
        y: newField.y || 100,
        width: newField.width || 200,
        height: newField.height || 60,
        required: newField.required !== undefined ? newField.required : true,
        signer_id: newField.signer_id || selectedSignerId || signers[0]?.email,
        value: newField.value || null,
        metadata: newField.metadata || {},
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      setFields((prev) => [...prev, fieldWithDefaults]);
      setHasUnsavedChanges(true);
    },
    [envelope.id, selectedSignerId, signers]
  );

  const handleFieldUpdate = useCallback(
    (fieldId: string, updates: Partial<EsignField>) => {
      setFields((prev) =>
        prev.map((field) =>
          field.id === fieldId 
            ? { ...field, ...updates, updated_at: new Date().toISOString() } 
            : field
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
    setSelectedSignerId(field.signer_id || undefined);
  }, []);

  // ==================== SAVE & SEND ====================

  const handleSave = async () => {
    if (!onSaveFields) return;

    setShowValidationErrors(false);

    try {
      await onSaveFields(fields);
      lastSavedFieldsRef.current = JSON.stringify(fields);
      setHasUnsavedChanges(false);
    } catch (error) {
      console.error('Failed to save fields:', error);
    }
  };

  const handleSend = async () => {
    if (!isValid) {
      setShowValidationErrors(true);
      return;
    }

    if (!onSendForSignature) return;

    try {
      // Auto-save before sending
      if (hasUnsavedChanges && onSaveFields) {
        await onSaveFields(fields);
        lastSavedFieldsRef.current = JSON.stringify(fields);
        setHasUnsavedChanges(false);
      }

      await onSendForSignature();
    } catch (error) {
      console.error('Failed to send:', error);
    }
  };

  // ==================== RENDER ====================

  if (isFullScreen) {
    return (
      <div className="fixed inset-0 z-50 bg-gray-50 flex flex-col">
        {/* Full Screen Header */}
        <div className="bg-white border-b border-gray-200 p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
             <Button variant="ghost" size="sm" onClick={() => setIsFullScreen(false)}>
               <ArrowLeft className="h-4 w-4 mr-1" />
               Exit Full Screen
             </Button>
             <h2 className="font-semibold text-lg">{envelope.title}</h2>
          </div>
          
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={handleSave}
              disabled={saving || !hasUnsavedChanges || autoSaving}
              size="sm"
            >
              {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
              Save
            </Button>
            <Button
              onClick={handleSend}
              disabled={sending || !isValid}
              className="bg-purple-600 hover:bg-purple-700"
              size="sm"
            >
              <Send className="h-4 w-4 mr-1" />
              Send
            </Button>
          </div>
        </div>

        {/* Full Screen Content */}
        <div className="flex-1 overflow-hidden">
          <div className="grid grid-cols-12 gap-0 h-full">
            {/* Left Sidebar */}
            <div className="col-span-2 border-r border-gray-200 bg-white p-4 overflow-auto h-full">
              <div className="flex items-center gap-2 mb-4">
                <Users className="h-4 w-4 text-purple-600" />
                <h3 className="font-semibold">Signers</h3>
              </div>
              <div className="space-y-2">
                {signers.map((signer, idx) => (
                  <button
                    key={signer.email}
                    onClick={() => setSelectedSignerId(signer.email)}
                    className={`
                      w-full text-left p-2 rounded-lg border text-sm transition-all
                      ${selectedSignerId === signer.email ? 'border-purple-500 bg-purple-50' : 'border-gray-200 hover:border-gray-300'}
                    `}
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: ['#6d28d9', '#0891b2', '#059669', '#ea580c', '#dc2626'][idx % 5] }} />
                      <span className="truncate font-medium">{signer.name}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Center - PDF Viewer */}
            <div className="col-span-8 bg-gray-100 p-4 overflow-hidden h-full">
              <PDFViewer
                documentUrl={documentUrl || envelope.document?.url || envelope.documentUrl || ''}
                documentName={envelope.document?.filename || envelope.title}
                fields={fields}
                onFieldPlace={handleFieldPlace}
                onFieldUpdate={handleFieldUpdate}
                onFieldDelete={handleFieldDelete}
                onFieldClick={handleFieldClick}
                selectedSignerId={selectedSignerId}
                showFields={true}
                isFullScreen={true}
                onToggleFullScreen={() => setIsFullScreen(false)}
              />
            </div>

            {/* Right Sidebar */}
            <div className="col-span-2 border-l border-gray-200 bg-white p-4 overflow-auto h-full">
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
            </div>
          </div>
        </div>
      </div>
    );
  }

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
                Drag and drop fields onto the document where signers should fill in information
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {autoSaving && (
              <Badge variant="secondary" className="text-blue-600">
                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                Auto-saving...
              </Badge>
            )}
            
            {hasUnsavedChanges && !autoSaving && (
              <Badge variant="secondary" className="text-orange-600">
                Unsaved changes
              </Badge>
            )}

            {!hasUnsavedChanges && !autoSaving && (
              <Badge variant="secondary" className="text-green-600">
                <CheckCircle2 className="h-3 w-3 mr-1" />
                Saved
              </Badge>
            )}

            <Button
              variant="outline"
              onClick={handleSave}
              disabled={saving || !hasUnsavedChanges || autoSaving}
            >
              {saving ? (
                <div className="contents">
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  Saving...
                </div>
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
                <div className="contents">
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  Sending...
                </div>
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
            <div className="space-y-2">
              {signers.map((signer, idx) => (
                <button
                  key={signer.email}
                  onClick={() => setSelectedSignerId(signer.email)}
                  className={`
                    w-full text-left p-3 rounded-lg border-2 transition-all
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
                        {signer.email}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {fields.filter((f) => f.signer_id === signer.email).length} field
                        {fields.filter((f) => f.signer_id === signer.email).length !== 1
                          ? 's'
                          : ''}
                      </p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </Card>

          {/* Instructions */}
          <Card className="p-4 bg-blue-50 border-blue-200">
            <h4 className="font-semibold text-blue-900 text-sm mb-2">How to Prepare</h4>
            <ol className="text-xs text-blue-700 space-y-1">
              <li>1. Select a signer from the list above</li>
              <li>2. Drag fields from the palette onto the PDF</li>
              <li>3. Position fields where the signer should fill in</li>
              <li>4. Repeat for all signers</li>
              <li>5. Click "Send for Signature" when ready</li>
            </ol>
          </Card>
        </div>

        {/* Center - PDF Viewer */}
        <div className="col-span-6">
          <PDFViewer
            documentUrl={documentUrl || envelope.document?.url || envelope.documentUrl || ''}
            documentName={envelope.document?.filename || envelope.title}
            fields={fields}
            onFieldPlace={handleFieldPlace}
            onFieldUpdate={handleFieldUpdate}
            onFieldDelete={handleFieldDelete}
            onFieldClick={handleFieldClick}
            selectedSignerId={selectedSignerId}
            showFields={true}
            isFullScreen={false}
            onToggleFullScreen={() => setIsFullScreen(true)}
          />
        </div>

        {/* Right Sidebar - Field Palette */}
        <div className="col-span-3">
          <Card className="p-4">
            <div className="flex items-center gap-2 mb-4">
              <FileText className="h-4 w-4 text-purple-600" />
              <h3 className="font-semibold">Field Palette</h3>
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