/**
 * Field Palette Component
 * Provides draggable field types for placing signature fields on PDF documents
 * Integrates with PDFViewer for drag-and-drop field placement
 */

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../../../ui/card';
import { Badge } from '../../../../ui/badge';
import { Button } from '../../../../ui/button';
import { Label } from '../../../../ui/label';
import { Input } from '../../../../ui/input';
import { Checkbox } from '../../../../ui/checkbox';
import { ScrollArea } from '../../../../ui/scroll-area';
import {
  FileSignature,
  Type,
  Calendar,
  CheckSquare,
  Hash,
  GripVertical,
  Trash2,
  Eye,
  EyeOff,
  Info,
  ChevronDown,
  ChevronUp,
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
  type: FieldType;
  icon: React.ElementType;
  label: string;
  description: string;
  color: string;
}

const FIELD_TEMPLATES: FieldTemplate[] = [
  {
    type: 'signature',
    icon: FileSignature,
    label: 'Signature',
    description: 'Full legal signature',
    color: '#6d28d9', // purple
  },
  {
    type: 'initials',
    icon: Type,
    label: 'Initials',
    description: 'Initial field',
    color: '#0891b2', // cyan
  },
  {
    type: 'text',
    icon: Type,
    label: 'Text',
    description: 'Text input field',
    color: '#059669', // emerald
  },
  {
    type: 'date',
    icon: Calendar,
    label: 'Date',
    description: 'Date picker',
    color: '#ea580c', // orange
  },
  {
    type: 'checkbox',
    icon: CheckSquare,
    label: 'Checkbox',
    description: 'Yes/No checkbox',
    color: '#dc2626', // red
  },
];

export function FieldPalette({
  signers,
  fields,
  onAddField,
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
      })
    );
  };

  // Toggle section expansion
  const toggleSection = (section: 'palette' | 'list') => {
    setExpandedSection(expandedSection === section ? null : section);
  };

  // Group fields by signer
  const fieldsBySigner = fields.reduce((acc, field) => {
    const signerId = field.signerId || 'unassigned';
    if (!acc[signerId]) acc[signerId] = [];
    acc[signerId].push(field);
    return acc;
  }, {} as Record<string, EsignField[]>);

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

            {/* Field Type Grid */}
            <div className="grid grid-cols-1 gap-2">
              {FIELD_TEMPLATES.map((template) => {
                const Icon = template.icon;
                return (
                  <div
                    key={template.type}
                    draggable={!disabled && !!selectedSignerId}
                    onDragStart={(e) => handleDragStart(e, template)}
                    onClick={() => setSelectedFieldType(template.type)}
                    className={`
                      p-3 border-2 rounded-lg cursor-move transition-all
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
                    <div className="flex items-center gap-3">
                      <div
                        className="p-2 rounded"
                        style={{ backgroundColor: `${template.color}20` }}
                      >
                        <Icon
                          className="h-4 w-4"
                          style={{ color: template.color }}
                        />
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-sm">{template.label}</p>
                        <p className="text-xs text-muted-foreground">
                          {template.description}
                        </p>
                      </div>
                      <GripVertical className="h-4 w-4 text-gray-400" />
                    </div>
                  </div>
                );
              })}
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
                <p className="text-sm text-muted-foreground">
                  No fields placed yet
                </p>
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
                        const template = FIELD_TEMPLATES.find(
                          (t) => t.type === field.type
                        );
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
                                {field.label || template?.label || field.type}
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
        <span>
          {fields.filter((f) => f.required).length} required
        </span>
      </div>
    </div>
  );
}