/**
 * Prepare Form Studio
 * The professional 3-column editor for placing fields on documents.
 * Replaces the older PrepareFormEditor.
 */

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Button } from '../../../../ui/button';
import { Badge } from '../../../../ui/badge';
import {
  ArrowLeft,
  Save,
  Send,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Undo,
  Redo,
  ChevronDown
} from 'lucide-react';
import { PDFViewer } from './PDFViewer';
import { FieldPalette } from './FieldPalette';
import { FieldPropertiesPanel } from './FieldPropertiesPanel';
import type { EsignEnvelope, EsignField, SignerFormData } from '../types';
import { SIGNER_COLORS } from '../constants';
import { toast } from 'sonner@2.0.3';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../../../../ui/dropdown-menu';

interface PrepareFormStudioProps {
  envelope: EsignEnvelope;
  signers: SignerFormData[];
  onBack?: () => void;
  onSaveFields?: (fields: EsignField[]) => Promise<void>;
  onSendForSignature?: (fields?: EsignField[]) => Promise<void>;
  saving?: boolean;
  sending?: boolean;
  documentUrl?: string;
}

export function PrepareFormStudio({
  envelope,
  signers,
  onBack,
  onSaveFields,
  onSendForSignature,
  saving = false,
  sending = false,
  documentUrl,
}: PrepareFormStudioProps) {
  // State
  const [fields, setFields] = useState<EsignField[]>(envelope.fields || []);
  const [selectedFieldId, setSelectedFieldId] = useState<string | undefined>(undefined);
  const [selectedSignerId, setSelectedSignerId] = useState<string | undefined>(signers[0]?.email);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  
  // History for Undo/Redo
  const [history, setHistory] = useState<EsignField[][]>([envelope.fields || []]);
  const [historyIndex, setHistoryIndex] = useState(0);

  // Auto-save ref
  const lastSavedFieldsRef = useRef<string>(JSON.stringify(envelope.fields || []));

  // Build signer color map for consistent color assignment
  const signerColorMap = signers.reduce((map, signer, index) => {
    map[signer.email] = SIGNER_COLORS[index % SIGNER_COLORS.length].hex;
    return map;
  }, {} as Record<string, string>);

  // ==================== HISTORY MANAGEMENT ====================

  const pushToHistory = (newFields: EsignField[]) => {
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(newFields);
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
    setFields(newFields);
    setHasUnsavedChanges(true);
  };

  const undo = () => {
    if (historyIndex > 0) {
      setHistoryIndex(historyIndex - 1);
      setFields(history[historyIndex - 1]);
      setHasUnsavedChanges(true);
    }
  };

  const redo = () => {
    if (historyIndex < history.length - 1) {
      setHistoryIndex(historyIndex + 1);
      setFields(history[historyIndex + 1]);
      setHasUnsavedChanges(true);
    }
  };

  // ==================== FIELD OPERATIONS ====================

  const handleFieldPlace = useCallback((newField: Partial<EsignField>) => {
    const field: EsignField = {
      id: `field-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      envelope_id: envelope.id,
      type: newField.type || 'signature',
      page: newField.page || 1,
      x: newField.x || 50,
      y: newField.y || 50,
      width: newField.width || 150,
      height: newField.height || 50,
      required: true,
      signer_id: newField.signer_id || selectedSignerId || signers[0]?.email,
      value: null,
      metadata: {},
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    pushToHistory([...fields, field]);
    setSelectedFieldId(field.id);
  }, [envelope.id, selectedSignerId, signers, fields, history, historyIndex]);

  const handleFieldUpdate = useCallback((fieldId: string, updates: Partial<EsignField>) => {
    const updatedFields = fields.map(f => f.id === fieldId ? { ...f, ...updates } : f);
    // Don't push to history for every micro-drag event? 
    // Ideally we debounce history pushes or only push on mouse up.
    // For now, we update state directly for smooth drag, but history might get spammy.
    // Optimization: Just update state here, push to history on "drag end" (not implemented in this simplified version)
    // We'll update state directly and set unsaved changes.
    setFields(updatedFields);
    setHasUnsavedChanges(true);
  }, [fields]);

  const handleFieldDelete = useCallback((fieldId: string) => {
    const newFields = fields.filter(f => f.id !== fieldId);
    pushToHistory(newFields);
    if (selectedFieldId === fieldId) setSelectedFieldId(undefined);
  }, [fields, selectedFieldId]);

  // ==================== ACTIONS ====================

  const handleSave = async () => {
    if (onSaveFields) {
      await onSaveFields(fields);
      setHasUnsavedChanges(false);
      lastSavedFieldsRef.current = JSON.stringify(fields);
    }
  };

  const handleSend = async () => {
    // Validate
    if (fields.length === 0) {
      toast.error('Please place at least one field');
      return;
    }
    // Check if every signer has a field? optional constraint
    
    if (onSaveFields && hasUnsavedChanges) {
      await onSaveFields(fields);
    }
    
    if (onSendForSignature) {
      await onSendForSignature(fields);
    }
  };

  // Auto-save effect
  useEffect(() => {
    const timer = setTimeout(() => {
      if (hasUnsavedChanges && !saving && !sending && onSaveFields) {
        // Optional: Auto-save logic here
        // handleSave(); 
      }
    }, 5000);
    return () => clearTimeout(timer);
  }, [fields, hasUnsavedChanges, saving, sending]);


  // ==================== RENDER ====================

  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* Top Toolbar */}
      <div className="h-14 bg-white border-b flex items-center justify-between px-4 shadow-sm z-10 shrink-0">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={onBack}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div className="h-6 w-px bg-gray-200" />
          <h2 className="font-semibold text-gray-900">{envelope.title}</h2>
          <Badge variant="outline" className="ml-2 font-normal">
            {signers.length} Recipient{signers.length !== 1 ? 's' : ''}
          </Badge>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={undo} disabled={historyIndex === 0} aria-label="Undo">
            <Undo className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={redo} disabled={historyIndex === history.length - 1} aria-label="Redo">
            <Redo className="h-4 w-4" />
          </Button>
          
          <div className="h-6 w-px bg-gray-200 mx-2" />
          
          <Button 
            variant="outline" 
            onClick={handleSave}
            disabled={!hasUnsavedChanges || saving}
            className="w-24"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save'}
          </Button>
          
          <Button 
            onClick={handleSend}
            disabled={sending}
            className="bg-purple-600 hover:bg-purple-700 w-32"
          >
            {sending ? (
              <div className="contents">
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Sending...
              </div>
            ) : (
              <div className="contents">
                Send
                <Send className="h-4 w-4 ml-2" />
              </div>
            )}
          </Button>
        </div>
      </div>

      {/* Main Studio Area */}
      <div className="flex-1 flex overflow-hidden min-h-0">
        
        {/* Left Sidebar: Toolbox */}
        <div className="w-64 bg-white border-r flex flex-col z-10 overflow-hidden">
          <div className="p-4 border-b">
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 block">
              Placing Fields For
            </label>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="w-full justify-between">
                  <div className="flex items-center gap-2 min-w-0 overflow-hidden">
                    <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: signerColorMap[selectedSignerId || ''] || '#6d28d9' }} />
                    <span className="truncate text-sm">{signers.find(s => s.email === selectedSignerId)?.name || 'Select signer'}</span>
                  </div>
                  <ChevronDown className="h-4 w-4 opacity-50 shrink-0 ml-2" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56" align="start">
                {signers.map((signer, idx) => {
                  const color = SIGNER_COLORS[idx % SIGNER_COLORS.length];
                  return (
                    <DropdownMenuItem 
                      key={signer.email}
                      onClick={() => setSelectedSignerId(signer.email)}
                      className="flex items-center gap-2"
                    >
                      <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: color.hex }} />
                      <span className="flex-1 truncate">{signer.name}</span>
                      <span className="text-xs text-gray-400">{signer.role || 'Signer'}</span>
                    </DropdownMenuItem>
                  );
                })}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4">
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

        {/* Center: Canvas — independent scroll area for the document */}
        <div className="flex-1 bg-gray-100/50 relative min-h-0 min-w-0 overflow-hidden">
          <div className="absolute inset-0">
            <PDFViewer
              documentUrl={documentUrl || envelope.document?.url || envelope.documentUrl}
              documentName={envelope.title}
              fields={fields}
              signers={signers}
              onFieldPlace={handleFieldPlace}
              onFieldUpdate={handleFieldUpdate}
              onFieldDelete={handleFieldDelete}
              onFieldClick={(f) => setSelectedFieldId(f?.id)}
              selectedSignerId={selectedSignerId}
              selectedFieldId={selectedFieldId}
              showFields={true}
            />
          </div>
        </div>

        {/* Right Sidebar: Properties */}
        <div className="w-72 bg-white border-l z-10 overflow-y-auto">
           <FieldPropertiesPanel
             field={fields.find(f => f.id === selectedFieldId) || null}
             signers={signers}
             onUpdate={handleFieldUpdate}
             onDelete={handleFieldDelete}
           />
        </div>

      </div>
    </div>
  );
}