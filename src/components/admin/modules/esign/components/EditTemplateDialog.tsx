/**
 * Edit Template Dialog
 * Allows editing template metadata (name, description, category, signing mode,
 * default message, default expiry). Recipients and fields are shown read-only.
 */

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../../../ui/dialog';
import { Button } from '../../../../ui/button';
import { Input } from '../../../../ui/input';
import { Label } from '../../../../ui/label';
import { Textarea } from '../../../../ui/textarea';
import { Badge } from '../../../../ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../../ui/select';
import {
  ListOrdered,
  Shuffle,
  CheckCircle2,
  Loader2,
  Users,
  FileText,
} from 'lucide-react';
import { toast } from 'sonner@2.0.3';
import { esignApi } from '../api';
import type { EsignTemplateRecord } from '../types';
import { TEMPLATE_CATEGORIES } from '../types';
import type { SigningMode } from '../types';

interface EditTemplateDialogProps {
  template: EsignTemplateRecord;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (updated: EsignTemplateRecord) => void;
}

export function EditTemplateDialog({ template, open, onOpenChange, onSave }: EditTemplateDialogProps) {
  const [name, setName] = useState(template.name);
  const [description, setDescription] = useState(template.description || '');
  const [category, setCategory] = useState(template.category || '');
  const [signingMode, setSigningMode] = useState<SigningMode>(template.signingMode || 'sequential');
  const [defaultMessage, setDefaultMessage] = useState(template.defaultMessage || '');
  const [defaultExpiryDays, setDefaultExpiryDays] = useState(template.defaultExpiryDays || 30);
  const [saving, setSaving] = useState(false);

  // Reset form when template changes
  useEffect(() => {
    setName(template.name);
    setDescription(template.description || '');
    setCategory(template.category || '');
    setSigningMode(template.signingMode || 'sequential');
    setDefaultMessage(template.defaultMessage || '');
    setDefaultExpiryDays(template.defaultExpiryDays || 30);
  }, [template]);

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error('Template name is required');
      return;
    }

    setSaving(true);
    try {
      const result = await esignApi.updateTemplate(template.id, {
        name: name.trim(),
        description: description.trim() || undefined,
        category: category || undefined,
        signingMode,
        defaultMessage: defaultMessage.trim() || undefined,
        defaultExpiryDays,
      });
      toast.success('Template updated');
      onSave(result.template);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to update template');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Template</DialogTitle>
          <DialogDescription>
            Update template details and default settings.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Name */}
          <div className="space-y-1.5">
            <Label htmlFor="tpl-name">Template Name *</Label>
            <Input
              id="tpl-name"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g., Standard Client Agreement"
            />
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label htmlFor="tpl-desc">Description</Label>
            <Textarea
              id="tpl-desc"
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Brief description of when this template should be used..."
              rows={2}
              maxLength={300}
            />
          </div>

          {/* Category */}
          <div className="space-y-1.5">
            <Label>Category</Label>
            <Select value={category || '__none'} onValueChange={val => setCategory(val === '__none' ? '' : val)}>
              <SelectTrigger>
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none">No Category</SelectItem>
                {TEMPLATE_CATEGORIES.map(cat => (
                  <SelectItem key={cat} value={cat}>
                    {cat}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Signing Mode */}
          <div className="space-y-1.5">
            <Label>Default Signing Order</Label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setSigningMode('sequential')}
                className={`relative p-3 rounded-lg border-2 text-left transition-all cursor-pointer ${
                  signingMode === 'sequential'
                    ? 'border-purple-400 bg-purple-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <ListOrdered
                    className={`h-4 w-4 ${signingMode === 'sequential' ? 'text-purple-600' : 'text-gray-400'}`}
                  />
                  <span
                    className={`text-sm font-medium ${
                      signingMode === 'sequential' ? 'text-purple-700' : 'text-gray-700'
                    }`}
                  >
                    Sequential
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground leading-tight">
                  One at a time, in order.
                </p>
                {signingMode === 'sequential' && (
                  <div className="absolute top-2 right-2">
                    <CheckCircle2 className="h-4 w-4 text-purple-600" />
                  </div>
                )}
              </button>
              <button
                type="button"
                onClick={() => setSigningMode('parallel')}
                className={`relative p-3 rounded-lg border-2 text-left transition-all cursor-pointer ${
                  signingMode === 'parallel'
                    ? 'border-blue-400 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <Shuffle
                    className={`h-4 w-4 ${signingMode === 'parallel' ? 'text-blue-600' : 'text-gray-400'}`}
                  />
                  <span
                    className={`text-sm font-medium ${
                      signingMode === 'parallel' ? 'text-blue-700' : 'text-gray-700'
                    }`}
                  >
                    Parallel
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground leading-tight">
                  All signers at once.
                </p>
                {signingMode === 'parallel' && (
                  <div className="absolute top-2 right-2">
                    <CheckCircle2 className="h-4 w-4 text-blue-600" />
                  </div>
                )}
              </button>
            </div>
          </div>

          {/* Default Message */}
          <div className="space-y-1.5">
            <Label htmlFor="tpl-msg">Default Message to Signers</Label>
            <Textarea
              id="tpl-msg"
              value={defaultMessage}
              onChange={e => setDefaultMessage(e.target.value)}
              placeholder="Message included in the signing invitation..."
              rows={2}
              maxLength={500}
            />
          </div>

          {/* Default Expiry */}
          <div className="space-y-1.5">
            <Label htmlFor="tpl-expiry">Default Expiry (Days)</Label>
            <Input
              id="tpl-expiry"
              type="number"
              min={1}
              max={365}
              value={defaultExpiryDays}
              onChange={e => setDefaultExpiryDays(parseInt(e.target.value) || 30)}
            />
          </div>

          {/* Read-only summary */}
          <div className="bg-gray-50 rounded-lg p-3 border space-y-1.5">
            <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
              Template Contents (read-only)
            </p>
            <div className="flex items-center gap-3 text-xs text-gray-600">
              <span className="flex items-center gap-1">
                <Users className="h-3.5 w-3.5" />
                {template.recipients.length} recipient{template.recipients.length !== 1 ? 's' : ''}
              </span>
              <span className="flex items-center gap-1">
                <FileText className="h-3.5 w-3.5" />
                {template.fields.length} field{template.fields.length !== 1 ? 's' : ''}
              </span>
            </div>
            {template.recipients.length > 0 && (
              <div className="space-y-1 mt-2">
                {template.recipients.map((r, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs">
                    <Badge variant="secondary" className="h-5 w-5 p-0 flex items-center justify-center text-[10px]">
                      {r.order}
                    </Badge>
                    <span className="font-medium">{r.name || 'Unnamed'}</span>
                    <span className="text-muted-foreground">{r.email}</span>
                    {r.role && (
                      <Badge variant="outline" className="text-[10px] h-4 px-1">
                        {r.role}
                      </Badge>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving || !name.trim()}
            className="bg-purple-600 hover:bg-purple-700"
          >
            {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : null}
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}