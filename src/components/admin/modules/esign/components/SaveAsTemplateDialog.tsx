/**
 * Save As Template Dialog
 * Allows saving an existing envelope's configuration as a reusable template.
 * Shown from the EnvelopeInspector's action menu.
 */

import React, { useState } from 'react';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../../ui/select';
import {
  Bookmark,
  Loader2,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';
import { toast } from 'sonner@2.0.3';
import { esignApi } from '../api';
import { TEMPLATE_CATEGORIES } from '../types';

interface SaveAsTemplateDialogProps {
  envelopeId: string;
  envelopeTitle: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved?: () => void;
}

export function SaveAsTemplateDialog({
  envelopeId,
  envelopeTitle,
  open,
  onOpenChange,
  onSaved,
}: SaveAsTemplateDialogProps) {
  const [name, setName] = useState(envelopeTitle ? `${envelopeTitle} Template` : '');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    if (!name.trim()) {
      setError('Template name is required');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      await esignApi.createTemplate({
        name: name.trim(),
        description: description.trim() || undefined,
        category: category || undefined,
        fromEnvelopeId: envelopeId,
      });

      setSaved(true);
      toast.success(`Template "${name.trim()}" saved`);
      onSaved?.();

      // Auto-close after brief confirmation
      setTimeout(() => {
        onOpenChange(false);
        // Reset for next use
        setSaved(false);
        setName('');
        setDescription('');
        setCategory('');
      }, 1500);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to save template');
    } finally {
      setSaving(false);
    }
  };

  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      // Reset state
      setSaved(false);
      setError(null);
    }
    onOpenChange(isOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-purple-100 flex items-center justify-center">
              <Bookmark className="h-4 w-4 text-purple-600" />
            </div>
            <div>
              <DialogTitle>Save as Template</DialogTitle>
              <DialogDescription className="text-xs">
                Save this envelope's configuration for reuse.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {saved ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <CheckCircle2 className="h-12 w-12 text-green-500 mb-3" />
            <h3 className="font-semibold text-gray-900">Template Saved</h3>
            <p className="text-sm text-muted-foreground mt-1">
              You can find it in the Templates tab.
            </p>
          </div>
        ) : (
          <div className="contents">
            <div className="space-y-4 py-2">
              {/* Name */}
              <div className="space-y-1.5">
                <Label htmlFor="save-tpl-name">Template Name *</Label>
                <Input
                  id="save-tpl-name"
                  value={name}
                  onChange={e => {
                    setName(e.target.value);
                    setError(null);
                  }}
                  placeholder="e.g., Standard Client Agreement"
                  autoFocus
                />
              </div>

              {/* Description */}
              <div className="space-y-1.5">
                <Label htmlFor="save-tpl-desc">Description (Optional)</Label>
                <Textarea
                  id="save-tpl-desc"
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="Brief description of when to use this template..."
                  rows={2}
                  maxLength={300}
                />
              </div>

              {/* Category */}
              <div className="space-y-1.5">
                <Label>Category (Optional)</Label>
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

              {/* Info */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-xs text-blue-800">
                  The template will capture this envelope's recipients, signing order, source document,
                  placed fields, message, and expiry settings so you can reuse it later without uploading
                  and configuring the PDF again.
                </p>
              </div>

              {error && (
                <div className="flex items-center gap-2 text-sm text-red-600">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  {error}
                </div>
              )}
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
                {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Bookmark className="h-4 w-4 mr-1" />}
                Save Template
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
