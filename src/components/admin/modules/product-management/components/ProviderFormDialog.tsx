import React, { useState, useEffect, useRef } from 'react';
import { Pencil, Upload, X } from 'lucide-react';
import { Button } from '../../../../ui/button';
import { Input } from '../../../../ui/input';
import { Textarea } from '../../../../ui/textarea';
import { Label } from '../../../../ui/label';
import { Checkbox } from '../../../../ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../../../ui/dialog';
import { ImageWithFallback } from '../../../../figma/ImageWithFallback';
import { PRODUCT_CATEGORIES, ProductCategoryId, SaveProviderRequest } from '../types';

interface ProviderFormDialogProps {
  isOpen: boolean;
  onClose: () => void;
  initialData?: {
    name: string;
    description: string;
    categoryIds: ProductCategoryId[];
    logo: string;
  };
  onSave: (data: SaveProviderRequest) => Promise<void>;
  isSaving: boolean;
  title?: string;
}

export function ProviderFormDialog({ 
  isOpen, 
  onClose, 
  initialData, 
  onSave, 
  isSaving,
  title
}: ProviderFormDialogProps) {
  const [formData, setFormData] = useState<SaveProviderRequest>({
    name: '',
    description: '',
    categoryIds: [],
    logo: '',
    active: true,
    website: '',
    contactEmail: '',
    contactPhone: ''
  });

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        setFormData({
            name: initialData.name,
            description: initialData.description,
            categoryIds: initialData.categoryIds as string[],
            logo: initialData.logo,
            active: true, // Default or pass in
            website: '',
            contactEmail: '',
            contactPhone: ''
        });
      } else {
        setFormData({
            name: '',
            description: '',
            categoryIds: [],
            logo: '',
            active: true,
            website: '',
            contactEmail: '',
            contactPhone: ''
        });
      }
    }
  }, [isOpen, initialData]);

  const toggleCategory = (categoryId: string) => {
    setFormData(prev => {
      const isSelected = prev.categoryIds.includes(categoryId);
      if (isSelected) {
        return {
          ...prev,
          categoryIds: prev.categoryIds.filter(id => id !== categoryId)
        };
      } else {
        return {
          ...prev,
          categoryIds: [...prev.categoryIds, categoryId]
        };
      }
    });
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData(prev => ({ ...prev, logo: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  const handleSubmit = async () => {
      if (!formData.name.trim()) return;
      await onSave(formData);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>{title || (initialData ? 'Edit Provider' : 'Add New Provider')}</DialogTitle>
          <DialogDescription>
            Enter the details of the financial product provider and select the categories they offer.
          </DialogDescription>
        </DialogHeader>
        
        <div className="grid gap-6 py-4">
          <div className="flex items-start gap-6">
            <div className="flex-shrink-0">
              <Label className="mb-2 block">Provider Logo</Label>
              <div 
                onClick={triggerFileInput}
                className="group relative w-32 h-16 rounded-lg border-2 border-dashed border-gray-200 flex items-center justify-center bg-gray-50 overflow-hidden cursor-pointer hover:border-purple-500 hover:bg-purple-50 transition-colors"
              >
                {formData.logo ? (
                  <div className="contents">
                    <ImageWithFallback
                      src={formData.logo}
                      alt="Logo preview"
                      className="w-full h-full object-contain p-1"
                    />
                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <Pencil className="h-5 w-5 text-white" />
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-1 text-gray-400 group-hover:text-purple-500">
                    <Upload className="h-5 w-5" />
                    <span className="text-[10px] font-medium">Upload</span>
                  </div>
                )}
                <input 
                  type="file" 
                  ref={fileInputRef}
                  className="hidden" 
                  accept="image/*"
                  onChange={handleFileChange}
                />
              </div>
              {formData.logo && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setFormData(prev => ({ ...prev, logo: '' }));
                  }}
                  className="mt-1 text-[10px] text-red-500 flex items-center gap-1 hover:underline"
                >
                  <X className="h-3 w-3" /> Remove
                </button>
              )}
              {!formData.logo && (
                <p className="text-[10px] text-gray-500 mt-2 w-32 text-center">
                  Recommended: 
                  <br />
                  200px x 100px
                </p>
              )}
            </div>

            <div className="flex-1 space-y-4">
              <div className="grid gap-2">
                <Label htmlFor="name">Provider Name</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. Discovery"
                />
              </div>
              
              <div className="grid gap-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description || ''}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Brief description of the provider..."
                  rows={3}
                />
              </div>
            </div>
          </div>

          <div className="grid gap-2">
            <Label>Product Categories</Label>
            <div className="grid grid-cols-2 gap-4 border rounded-lg p-4 bg-gray-50">
              {PRODUCT_CATEGORIES.map((category) => (
                <div key={category.id} className="flex items-center space-x-2">
                  <Checkbox 
                    id={`cat-${category.id}`} 
                    checked={formData.categoryIds.includes(category.id)}
                    onCheckedChange={() => toggleCategory(category.id)}
                  />
                  <Label 
                    htmlFor={`cat-${category.id}`}
                    className="text-sm font-normal cursor-pointer"
                  >
                    {category.name}
                  </Label>
                </div>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit} className="bg-purple-600 hover:bg-purple-700" disabled={isSaving}>
            {isSaving ? 'Saving...' : (initialData ? 'Save Changes' : 'Add Provider')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}