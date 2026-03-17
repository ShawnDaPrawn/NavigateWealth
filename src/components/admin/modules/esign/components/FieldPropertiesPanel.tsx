/**
 * Field Properties Panel
 * Right sidebar for the Prepare Form Studio
 * Allows editing properties of the selected field
 */

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../../../ui/card';
import { Input } from '../../../../ui/input';
import { Label } from '../../../../ui/label';
import { Checkbox } from '../../../../ui/checkbox';
import { Button } from '../../../../ui/button';
import { 
  Trash2, 
  Settings, 
  AlignLeft, 
  AlignCenter, 
  AlignRight,
  Type
} from 'lucide-react';
import { Badge } from '../../../../ui/badge';
import type { EsignField, SignerFormData } from '../types';
import { SIGNER_COLORS } from '../constants';

interface FieldPropertiesPanelProps {
  field: EsignField | null;
  signers: SignerFormData[];
  onUpdate: (fieldId: string, updates: Partial<EsignField>) => void;
  onDelete: (fieldId: string) => void;
}

export function FieldPropertiesPanel({
  field,
  signers,
  onUpdate,
  onDelete
}: FieldPropertiesPanelProps) {
  if (!field) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-center p-6 text-muted-foreground bg-gray-50/50">
        <Settings className="h-12 w-12 mb-4 opacity-20" />
        <p className="font-medium">No Field Selected</p>
        <p className="text-sm mt-1">Click on a field on the document to edit its properties.</p>
      </div>
    );
  }

  const assignedSigner = signers.find(s => s.email === field.signer_id);
  const signerIndex = signers.findIndex(s => s.email === field.signer_id);
  const signerColor = signerIndex >= 0 ? SIGNER_COLORS[signerIndex % SIGNER_COLORS.length].hex : '#6d28d9';

  return (
    <div className="h-full flex flex-col bg-white border-l border-gray-200">
      <div className="p-4 border-b border-gray-200 flex items-center justify-between bg-gray-50">
        <div className="flex items-center gap-2">
           <Type className="h-4 w-4 text-purple-600" />
           <span className="font-semibold text-sm capitalize">{field.type} Field</span>
        </div>
        <Button 
          variant="ghost" 
          size="icon" 
          className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50"
          onClick={() => onDelete(field.id)}
          aria-label="Delete field"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex-1 overflow-auto p-4 space-y-6">
        
        {/* Assigned To */}
        <div className="space-y-2">
          <Label>Assigned To</Label>
          <div className="relative">
            <select 
              className="w-full p-2 border rounded-md text-sm bg-white focus:ring-2 focus:ring-purple-500 outline-none appearance-none"
              value={field.signer_id}
              onChange={(e) => onUpdate(field.id, { signer_id: e.target.value })}
            >
              {signers.map(signer => (
                <option key={signer.email} value={signer.email}>
                  {signer.name} ({signer.role || 'Signer'})
                </option>
              ))}
            </select>
            <div className="absolute right-2 top-2.5 pointer-events-none">
              <div className="w-2 h-2 border-r border-b border-gray-500 transform rotate-45 mb-1" />
            </div>
          </div>
          {assignedSigner && (
             <div className="flex items-center gap-2 mt-1">
               <div className="w-2 h-2 rounded-full" style={{ backgroundColor: signerColor }} />
               <span className="text-xs text-muted-foreground">{assignedSigner.email}</span>
             </div>
          )}
        </div>

        {/* Common Properties */}
        <div className="space-y-4 pt-4 border-t border-gray-100">
           <div className="flex items-center justify-between">
              <Label htmlFor="required-toggle" className="cursor-pointer">Required Field</Label>
              <Checkbox 
                id="required-toggle" 
                checked={field.required}
                onCheckedChange={(checked) => onUpdate(field.id, { required: checked === true })}
              />
           </div>
        </div>

        {/* Text Specific Properties */}
        {field.type === 'text' && (
           <div className="space-y-4 pt-4 border-t border-gray-100">
              <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Validation</h4>
              <div className="space-y-2">
                 <Label>Placeholder Text</Label>
                 <Input 
                   placeholder="Enter value..."
                   value={field.value || ''}
                   onChange={(e) => onUpdate(field.id, { value: e.target.value })}
                 />
              </div>
           </div>
        )}

        {/* Position & Size (Advanced) */}
        <div className="space-y-4 pt-4 border-t border-gray-100">
           <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Layout</h4>
           <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                 <Label className="text-xs text-muted-foreground">X Position (%)</Label>
                 <Input 
                   type="number" 
                   value={Math.round(field.x)} 
                   onChange={(e) => onUpdate(field.id, { x: parseFloat(e.target.value) })}
                   className="h-8"
                 />
              </div>
              <div className="space-y-1">
                 <Label className="text-xs text-muted-foreground">Y Position (%)</Label>
                 <Input 
                   type="number" 
                   value={Math.round(field.y)} 
                   onChange={(e) => onUpdate(field.id, { y: parseFloat(e.target.value) })}
                   className="h-8"
                 />
              </div>
           </div>
        </div>

      </div>
    </div>
  );
}