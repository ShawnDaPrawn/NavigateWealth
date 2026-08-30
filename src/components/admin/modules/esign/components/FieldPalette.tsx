/**
 * Field Palette Component
 * Provides draggable field types for placing signature fields on PDF documents
 * Integrates with PDFViewer for drag-and-drop field placement
 */

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../../../ui/card';
import { Badge } from '../../../../ui/badge';
import { Button } from '../../../../ui/button';
import { ScrollArea } from '../../../../ui/scroll-area';
import {
  FileSignature,
  Type,
  Calendar,
  CalendarCheck,
  CheckSquare,
  CircleDot,
  List,
  GripVertical,
  Trash2,
  Eye,
  EyeOff,
  Info,
  ChevronDown,
  ChevronUp,
  User,
  Mail,
  Phone,
  Hash,
  Fingerprint,
  Building2,
  Briefcase,
  Paperclip,
  StickyNote,
  Sigma,
} from 'lucide-react';
import type { EsignField, FieldType, SignerFormData } from '../types';
import { SIGNER_COLORS } from '../constants';

interface FieldPaletteProps {
  signers: SignerFormData[];
  fields: EsignField[];
  onAddField: (field: Omit<EsignField, 'id'>) => void;
  onUpdateField: (fieldId: string, updates: Partial<EsignField>) => void;
  onDeleteField: (fieldId: string) => void;
  selectedSignerId?: string;
  disabled?: boolean;
}

interface FieldTemplate {
  /** Unique palette key — several templates share a `type` (presets). */
  key: string;
  type: FieldType;
  icon: React.ElementType;
  label: string;
  description: string;
  color: string;
  /**
   * Metadata stamped onto the created field: prefill binding
   * (`{ prefill: { token } }`), validation format, dropdown/radio options,
   * calculated-field config, and the human `label`.
   */
  metadata?: Record<string, unknown>;
  /** Initial `value` for the created field (e.g. a Note's text). */
  defaultValue?: string;
  /** `required` default for the created field (true when omitted). */
  required?: boolean;
}

interface FieldTemplateGroup {
  title: string;
  templates: FieldTemplate[];
}

/**
 * The palette, grouped the way DocuSign groups its field list: signing
 * marks, client-identity fields (pre-filled from the CRM where a token
 * exists), then generic inputs. Identity presets are `text` fields carrying
 * a `metadata.prefill` binding, so the value fills itself from the selected
 * client at send time — the sender never types the client's own details.
 */
const FIELD_TEMPLATE_GROUPS: FieldTemplateGroup[] = [
  {
    title: 'Signing',
    templates: [
      {
        key: 'signature',
        type: 'signature',
        icon: FileSignature,
        label: 'Signature',
        description: 'Full legal signature',
        color: '#6d28d9', // purple
      },
      {
        key: 'initials',
        type: 'initials',
        icon: Type,
        label: 'Initials',
        description: 'Initial field',
        color: '#0891b2', // cyan
      },
      {
        key: 'auto_date',
        type: 'auto_date',
        icon: CalendarCheck,
        label: 'Date signed',
        description: 'Stamped automatically when signing',
        color: '#ea580c', // orange
      },
      {
        key: 'date',
        type: 'date',
        icon: Calendar,
        label: 'Date',
        description: 'Signer picks a date',
        color: '#ea580c', // orange
      },
    ],
  },
  {
    title: 'Client details (auto-filled)',
    templates: [
      {
        key: 'full_name',
        type: 'text',
        icon: User,
        label: 'Full name',
        description: 'Pre-filled from the client record',
        color: '#2563eb', // blue
        metadata: { label: 'Full name', prefill: { token: 'client.name', locked: false } },
      },
      {
        key: 'first_name',
        type: 'text',
        icon: User,
        label: 'First name',
        description: 'Pre-filled from the client record',
        color: '#2563eb',
        metadata: {
          label: 'First name',
          prefill: { token: 'key:profile_first_name', locked: false },
        },
      },
      {
        key: 'last_name',
        type: 'text',
        icon: User,
        label: 'Last name',
        description: 'Pre-filled from the client record',
        color: '#2563eb',
        metadata: {
          label: 'Last name',
          prefill: { token: 'key:profile_last_name', locked: false },
        },
      },
      {
        key: 'email',
        type: 'text',
        icon: Mail,
        label: 'Email',
        description: 'Pre-filled; validated as an email address',
        color: '#2563eb',
        metadata: {
          label: 'Email',
          prefill: { token: 'client.email', locked: false },
          format: 'email',
        },
      },
      {
        key: 'phone',
        type: 'text',
        icon: Phone,
        label: 'Phone',
        description: 'Pre-filled; validated as a phone number',
        color: '#2563eb',
        metadata: {
          label: 'Phone',
          prefill: { token: 'client.phone', locked: false },
          format: 'phone',
        },
      },
      {
        key: 'id_number',
        type: 'text',
        icon: Fingerprint,
        label: 'ID number',
        description: 'Pre-filled; SA-ID checksum validated',
        color: '#2563eb',
        metadata: {
          label: 'ID number',
          prefill: { token: 'client.id_number', locked: false },
          format: 'sa_id',
        },
      },
      {
        key: 'company',
        type: 'text',
        icon: Building2,
        label: 'Company',
        description: 'Company / organisation',
        color: '#2563eb',
        metadata: { label: 'Company' },
      },
      {
        key: 'job_title',
        type: 'text',
        icon: Briefcase,
        label: 'Job title',
        description: 'Signer’s role or designation',
        color: '#2563eb',
        metadata: { label: 'Job title' },
      },
    ],
  },
  {
    title: 'Inputs',
    templates: [
      {
        key: 'text',
        type: 'text',
        icon: Type,
        label: 'Text',
        description: 'Free-text input',
        color: '#059669', // emerald
      },
      {
        key: 'number',
        type: 'text',
        icon: Hash,
        label: 'Number',
        description: 'Digits only',
        color: '#059669',
        metadata: { label: 'Number', format: 'number' },
      },
      {
        key: 'checkbox',
        type: 'checkbox',
        icon: CheckSquare,
        label: 'Checkbox',
        description: 'Yes/No checkbox',
        color: '#dc2626', // red
      },
      {
        key: 'radio',
        type: 'radio',
        icon: CircleDot,
        label: 'Radio buttons',
        description: 'Choose one option',
        color: '#dc2626',
        metadata: { label: 'Radio', options: ['Option 1', 'Option 2'] },
      },
      {
        key: 'dropdown',
        type: 'dropdown',
        icon: List,
        label: 'Dropdown',
        description: 'Choose from a list',
        color: '#dc2626',
        metadata: { label: 'Dropdown', options: ['Option 1', 'Option 2'] },
      },
      {
        key: 'attachment',
        type: 'attachment',
        icon: Paperclip,
        label: 'Attachment',
        description: 'Signer uploads a file',
        color: '#7c3aed', // violet
      },
      {
        key: 'note',
        type: 'note',
        icon: StickyNote,
        label: 'Note',
        description: 'Read-only instructions for the signer',
        color: '#a16207', // amber-700
        metadata: { label: 'Note' },
        defaultValue: 'Note for the signer — edit this text in Properties.',
        required: false,
      },
      {
        key: 'formula',
        type: 'text',
        icon: Sigma,
        label: 'Formula',
        description: 'Calculated from other fields',
        color: '#059669',
        metadata: { label: 'Formula', calculated: { formula: '', precision: 2 } },
        required: false,
      },
    ],
  },
];

/** Flat list — used for icon lookups in the placed-fields list. */
const FIELD_TEMPLATES: FieldTemplate[] = FIELD_TEMPLATE_GROUPS.flatMap((g) => g.templates);

export function FieldPalette({
  signers,
  fields,
  onUpdateField,
  onDeleteField,
  selectedSignerId,
  disabled = false,
}: FieldPaletteProps) {
  const [expandedSection, setExpandedSection] = useState<'palette' | 'list' | null>('palette');
  const [selectedFieldType, setSelectedFieldType] = useState<FieldType | null>(null);

  // Get signer color for field
  const getSignerColor = (signerId: string): string => {
    const signerIndex = signers.findIndex((s) => s.email === signerId);
    if (signerIndex >= 0) return SIGNER_COLORS[signerIndex % SIGNER_COLORS.length].hex;
    return '#6d28d9';
  };

  // Get signer name
  const getSignerName = (signerId: string): string => {
    const signer = signers.find((s) => s.email === signerId);
    return signer?.name || 'Unknown';
  };

  // Handle drag start
  const handleDragStart = (e: React.DragEvent, template: FieldTemplate) => {
    if (disabled || !selectedSignerId) return;

    e.dataTransfer.effectAllowed = 'copy';
    e.dataTransfer.setData(
      'application/json',
      JSON.stringify({
        fieldType: template.type,
        signerId: selectedSignerId,
        // Preset payload — prefill binding, format, options, label, note
        // text — carried through PDFViewer.handleDrop onto the new field.
        metadata: template.metadata,
        defaultValue: template.defaultValue,
        required: template.required,
      }),
    );
  };

  // Toggle section expansion
  const toggleSection = (section: 'palette' | 'list') => {
    setExpandedSection(expandedSection === section ? null : section);
  };

  // Group fields by signer
  const fieldsBySigner = fields.reduce(
    (acc, field) => {
      const signerId = field.signer_id || 'unassigned';
      if (!acc[signerId]) acc[signerId] = [];
      acc[signerId].push(field);
      return acc;
    },
    {} as Record<string, EsignField[]>,
  );

  return (
    <div className="space-y-4">
      {/* Field Palette Section */}
      <Card>
        <CardHeader
          className="cursor-pointer hover:bg-gray-50 transition-colors pb-3"
          onClick={() => toggleSection('palette')}
        >
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <GripVertical className="h-4 w-4 text-gray-400" />
              Field Palette
            </CardTitle>
            {expandedSection === 'palette' ? (
              <ChevronUp className="h-4 w-4 text-gray-500" />
            ) : (
              <ChevronDown className="h-4 w-4 text-gray-500" />
            )}
          </div>
        </CardHeader>

        {expandedSection === 'palette' && (
          <CardContent className="space-y-4">
            {/* Signer Selection Notice */}
            {!selectedSignerId && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 flex items-start gap-2">
                <Info className="h-4 w-4 text-yellow-600 mt-0.5 flex-shrink-0" />
                <div className="text-sm">
                  <p className="font-medium text-yellow-900">Select a signer first</p>
                  <p className="text-yellow-700">
                    Choose a signer from the list to assign fields to them.
                  </p>
                </div>
              </div>
            )}

            {/* Selected Signer Badge */}
            {selectedSignerId && (
              <div className="flex items-center justify-between p-2 bg-purple-50 rounded-lg border border-purple-200 overflow-hidden">
                <div className="flex items-center gap-2 min-w-0 overflow-hidden">
                  <div
                    className="w-3 h-3 rounded-full shrink-0"
                    style={{ backgroundColor: getSignerColor(selectedSignerId) }}
                  />
                  <span className="text-sm font-medium truncate">
                    Adding fields for: {getSignerName(selectedSignerId)}
                  </span>
                </div>
              </div>
            )}

            {/* Field Type Grid — grouped like DocuSign's field list */}
            <div className="space-y-3">
              {FIELD_TEMPLATE_GROUPS.map((group) => (
                <div key={group.title} className="space-y-1.5">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 px-0.5">
                    {group.title}
                  </p>
                  <div className="grid grid-cols-1 gap-1.5">
                    {group.templates.map((template) => {
                      const Icon = template.icon;
                      return (
                        <div
                          key={template.key}
                          draggable={!disabled && !!selectedSignerId}
                          onDragStart={(e) => handleDragStart(e, template)}
                          onClick={() => setSelectedFieldType(template.type)}
                          className={`
                            p-2 border-2 rounded-lg cursor-move transition-all
                            ${
                              disabled || !selectedSignerId
                                ? 'opacity-50 cursor-not-allowed'
                                : 'hover:border-purple-500 hover:bg-purple-50'
                            }
                            ${
                              selectedFieldType === template.type
                                ? 'border-purple-500 bg-purple-50'
                                : 'border-gray-200'
                            }
                          `}
                        >
                          <div className="flex items-center gap-2.5">
                            <div
                              className="p-1.5 rounded"
                              style={{ backgroundColor: `${template.color}20` }}
                            >
                              <Icon className="h-4 w-4" style={{ color: template.color }} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-sm truncate">{template.label}</p>
                              <p className="text-xs text-muted-foreground truncate">
                                {template.description}
                              </p>
                            </div>
                            <GripVertical className="h-4 w-4 text-gray-400 shrink-0" />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            {/* Instructions */}
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
              <p className="text-xs text-gray-600">
                <strong>Drag & Drop:</strong> Drag field types onto the document to place them.
                Fields will be assigned to the currently selected signer.
              </p>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Placed Fields List Section */}
      <Card>
        <CardHeader
          className="cursor-pointer hover:bg-gray-50 transition-colors pb-3"
          onClick={() => toggleSection('list')}
        >
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              Placed Fields
              <Badge variant="secondary" className="ml-1">
                {fields.length}
              </Badge>
            </CardTitle>
            {expandedSection === 'list' ? (
              <ChevronUp className="h-4 w-4 text-gray-500" />
            ) : (
              <ChevronDown className="h-4 w-4 text-gray-500" />
            )}
          </div>
        </CardHeader>

        {expandedSection === 'list' && (
          <CardContent>
            {fields.length === 0 ? (
              <div className="text-center py-8">
                <FileSignature className="h-12 w-12 text-gray-300 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">No fields placed yet</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Drag fields from the palette onto the document
                </p>
              </div>
            ) : (
              <ScrollArea className="h-[300px]">
                <div className="space-y-3">
                  {Object.entries(fieldsBySigner).map(([signerId, signerFields]) => (
                    <div key={signerId} className="space-y-2">
                      {/* Signer Header */}
                      <div className="flex items-center gap-2 px-2 py-1 bg-gray-50 rounded">
                        <div
                          className="w-2 h-2 rounded-full"
                          style={{ backgroundColor: getSignerColor(signerId) }}
                        />
                        <span className="text-xs font-medium text-gray-700">
                          {getSignerName(signerId)}
                        </span>
                        <Badge variant="outline" className="ml-auto text-xs">
                          {signerFields.length}
                        </Badge>
                      </div>

                      {/* Fields for this signer */}
                      {signerFields.map((field) => {
                        const template = FIELD_TEMPLATES.find((t) => t.type === field.type);
                        const Icon = template?.icon || FileSignature;

                        return (
                          <div
                            key={field.id}
                            className="flex items-center gap-2 p-2 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                          >
                            <Icon
                              className="h-4 w-4 flex-shrink-0"
                              style={{ color: template?.color }}
                            />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">
                                {(field as { label?: string }).label ||
                                  (field.metadata as { label?: string } | undefined)?.label ||
                                  template?.label ||
                                  field.type}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                Page {field.page} • {field.required ? 'Required' : 'Optional'}
                              </p>
                            </div>
                            <div className="flex items-center gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 p-0"
                                onClick={() =>
                                  onUpdateField(field.id, {
                                    required: !field.required,
                                  })
                                }
                                disabled={disabled}
                              >
                                {field.required ? (
                                  <Eye className="h-3 w-3" />
                                ) : (
                                  <EyeOff className="h-3 w-3" />
                                )}
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                                onClick={() => onDeleteField(field.id)}
                                disabled={disabled}
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        )}
      </Card>

      {/* Field Count Summary */}
      <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
        <span>
          {fields.length} total field{fields.length !== 1 ? 's' : ''}
        </span>
        <span>{fields.filter((f) => f.required).length} required</span>
      </div>
    </div>
  );
}
