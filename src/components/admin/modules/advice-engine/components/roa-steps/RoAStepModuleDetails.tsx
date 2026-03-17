import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../../../../ui/card';
import { Button } from '../../../../../ui/button';
import { Badge } from '../../../../../ui/badge';
import { Input } from '../../../../../ui/input';
import { Textarea } from '../../../../../ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../../../ui/select';
import { Label } from '../../../../../ui/label';
import { Checkbox } from '../../../../../ui/checkbox';
import { Progress } from '../../../../../ui/progress';
import { RoADraft, RoAField } from '../DraftRoAInterface';
import { getModuleSchema } from '../../roaModuleSchemas';
import { ChevronLeft, ChevronRight, CheckCircle, AlertCircle, FileText, Save } from 'lucide-react';

interface RoAStepModuleDetailsProps {
  draft: RoADraft | null;
  onUpdate: (updates: Partial<RoADraft>) => void;
}

export function RoAStepModuleDetails({ draft, onUpdate }: RoAStepModuleDetailsProps) {
  const [currentModuleIndex, setCurrentModuleIndex] = useState(0);
  const [isSaving, setIsSaving] = useState(false);

  if (!draft || !draft.selectedModules.length) {
    return (
      <div className="text-center py-12">
        <FileText className="h-12 w-12 text-muted-foreground opacity-50 mx-auto mb-4" />
        <p className="text-muted-foreground">No modules selected. Please go back and select modules first.</p>
      </div>
    );
  }

  const currentModuleId = draft.selectedModules[currentModuleIndex];
  const currentModule = getModuleSchema(currentModuleId);
  const currentModuleData = draft.moduleData[currentModuleId] || {};

  if (!currentModule) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
        <p className="text-red-600">Module configuration not found</p>
      </div>
    );
  }

  const handleFieldChange = async (fieldKey: string, value: string | string[] | boolean | number) => {
    const updatedModuleData = {
      ...draft.moduleData,
      [currentModuleId]: {
        ...currentModuleData,
        [fieldKey]: value
      }
    };

    onUpdate({ moduleData: updatedModuleData });

    // Auto-save simulation
    setIsSaving(true);
    setTimeout(() => setIsSaving(false), 1000);
  };

  const handlePreviousModule = () => {
    if (currentModuleIndex > 0) {
      setCurrentModuleIndex(currentModuleIndex - 1);
    }
  };

  const handleNextModule = () => {
    if (currentModuleIndex < draft.selectedModules.length - 1) {
      setCurrentModuleIndex(currentModuleIndex + 1);
    }
  };

  const getFieldProgress = () => {
    const requiredFields = currentModule.fields.filter(f => f.required);
    const completedFields = requiredFields.filter(f => 
      currentModuleData[f.key] && currentModuleData[f.key].toString().trim() !== ''
    );
    return {
      completed: completedFields.length,
      total: requiredFields.length,
      percentage: requiredFields.length > 0 ? (completedFields.length / requiredFields.length) * 100 : 0
    };
  };

  const renderField = (field: RoAField) => {
    const value = currentModuleData[field.key] || field.default || '';
    const isRequired = field.required;

    switch (field.type) {
      case 'text':
        return (
          <Input
            value={value}
            onChange={(e) => handleFieldChange(field.key, e.target.value)}
            placeholder={field.placeholder}
            className={isRequired && !value ? 'border-orange-300' : ''}
          />
        );

      case 'textarea':
        return (
          <Textarea
            value={value}
            onChange={(e) => handleFieldChange(field.key, e.target.value)}
            placeholder={field.placeholder}
            className={`min-h-[100px] ${isRequired && !value ? 'border-orange-300' : ''}`}
          />
        );

      case 'number':
        return (
          <Input
            type="number"
            value={value}
            onChange={(e) => handleFieldChange(field.key, e.target.value)}
            placeholder={field.placeholder}
            className={isRequired && !value ? 'border-orange-300' : ''}
          />
        );

      case 'select':
        return (
          <Select 
            value={value} 
            onValueChange={(newValue) => handleFieldChange(field.key, newValue)}
          >
            <SelectTrigger className={isRequired && !value ? 'border-orange-300' : ''}>
              <SelectValue placeholder="Select an option" />
            </SelectTrigger>
            <SelectContent>
              {field.options?.map((option) => (
                <SelectItem key={option} value={option}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );

      case 'chips':
        const chipsValue = Array.isArray(value) ? value : (value ? value.split(',').map((s: string) => s.trim()) : []);
        return (
          <div className="space-y-2">
            <Input
              placeholder="Type and press Enter to add items"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  const input = e.target as HTMLInputElement;
                  const newItem = input.value.trim();
                  if (newItem && !chipsValue.includes(newItem)) {
                    const updatedChips = [...chipsValue, newItem];
                    handleFieldChange(field.key, updatedChips);
                    input.value = '';
                  }
                }
              }}
              className={isRequired && chipsValue.length === 0 ? 'border-orange-300' : ''}
            />
            {chipsValue.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {chipsValue.map((item: string, index: number) => (
                  <Badge 
                    key={index} 
                    variant="secondary" 
                    className="cursor-pointer hover:bg-red-100"
                    onClick={() => {
                      const updatedChips = chipsValue.filter((_: string, i: number) => i !== index);
                      handleFieldChange(field.key, updatedChips);
                    }}
                  >
                    {item} ×
                  </Badge>
                ))}
              </div>
            )}
          </div>
        );

      case 'checkbox':
        return (
          <div className="flex items-center space-x-2">
            <Checkbox
              checked={!!value}
              onCheckedChange={(checked) => handleFieldChange(field.key, checked)}
            />
            <span className="text-sm">{field.label}</span>
          </div>
        );

      default:
        return <Input value={value} onChange={(e) => handleFieldChange(field.key, e.target.value)} />;
    }
  };

  const progress = getFieldProgress();
  const isModuleComplete = progress.percentage === 100;

  return (
    <div className="space-y-6">
      {/* Module Navigation Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                {currentModule.title}
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Module {currentModuleIndex + 1} of {draft.selectedModules.length}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {isSaving && (
                <Badge variant="outline" className="text-blue-600 border-blue-200">
                  <Save className="h-3 w-3 mr-1" />
                  Saving...
                </Badge>
              )}
              {isModuleComplete && (
                <Badge variant="default" className="bg-green-100 text-green-700 border-green-200">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  Complete
                </Badge>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Progress */}
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Progress</span>
                <span>{Math.round(progress.percentage)}% complete ({progress.completed}/{progress.total} required fields)</span>
              </div>
              <Progress value={progress.percentage} className="w-full" />
            </div>

            {/* Module Navigation */}
            <div className="flex items-center justify-between">
              <Button
                variant="outline"
                size="sm"
                onClick={handlePreviousModule}
                disabled={currentModuleIndex === 0}
              >
                <ChevronLeft className="h-4 w-4 mr-2" />
                Previous Module
              </Button>

              <div className="flex gap-2">
                {draft.selectedModules.map((moduleId, index) => {
                  const module = getModuleSchema(moduleId);
                  const moduleData = draft.moduleData[moduleId] || {};
                  const moduleFields = module?.fields.filter(f => f.required) || [];
                  const completedFields = moduleFields.filter(f => 
                    moduleData[f.key] && moduleData[f.key].toString().trim() !== ''
                  ).length;
                  const isComplete = completedFields === moduleFields.length && moduleFields.length > 0;
                  
                  return (
                    <Button
                      key={moduleId}
                      variant={index === currentModuleIndex ? "default" : "outline"}
                      size="sm"
                      className="relative"
                      onClick={() => setCurrentModuleIndex(index)}
                    >
                      {index + 1}
                      {isComplete && (
                        <CheckCircle className="h-3 w-3 absolute -top-1 -right-1 text-green-600" />
                      )}
                    </Button>
                  );
                })}
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={handleNextModule}
                disabled={currentModuleIndex === draft.selectedModules.length - 1}
              >
                Next Module
                <ChevronRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Module Form */}
      <Card>
        <CardHeader>
          <CardTitle>Module Details</CardTitle>
          <p className="text-sm text-muted-foreground">
            {currentModule.description}
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Form Fields */}
          <div className="space-y-4">
            {currentModule.fields.map((field) => (
              <div key={field.key} className="space-y-2">
                <Label htmlFor={field.key} className="flex items-center gap-2">
                  {field.label}
                  {field.required && <span className="text-red-500">*</span>}
                </Label>
                {renderField(field)}
                {field.required && !currentModuleData[field.key] && (
                  <p className="text-xs text-orange-600">This field is required</p>
                )}
              </div>
            ))}
          </div>

          {/* Disclosures */}
          {currentModule.disclosures.length > 0 && (
            <div className="space-y-3">
              <h4 className="font-medium">Regulatory Disclosures</h4>
              <div className="bg-muted/30 p-4 rounded-lg space-y-2">
                {currentModule.disclosures.map((disclosure, index) => (
                  <p key={index} className="text-sm text-muted-foreground">
                    • {disclosure}
                  </p>
                ))}
              </div>
            </div>
          )}

          {/* Completion Status */}
          {progress.completed < progress.total && (
            <div className="bg-orange-50 border border-orange-200 p-3 rounded-lg">
              <p className="text-sm text-orange-700">
                Complete all required fields to proceed. Missing {progress.total - progress.completed} required field{progress.total - progress.completed !== 1 ? 's' : ''}.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}