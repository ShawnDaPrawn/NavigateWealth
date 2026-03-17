import React, { useState } from 'react';
import { 
  Plus, 
  Trash2, 
  GripVertical, 
  Settings, 
  Link as LinkIcon, 
  ChevronDown, 
  ChevronUp,
  MoreHorizontal
} from 'lucide-react';
import {
  RequestTemplate,
  RequestFieldSection,
  RequestField,
  FieldType,
  FieldVisibility,
} from '../../../types';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../../../../../ui/table";
import { Input } from "../../../../../../ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../../../../../ui/select";
import { Switch } from "../../../../../../ui/switch";
import { Button } from "../../../../../../ui/button";
import { Badge } from "../../../../../../ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "../../../../../../ui/popover";
import { Label } from "../../../../../../ui/label";
import { Textarea } from "../../../../../../ui/textarea";

interface Step2RequestDetailsProps {
  templateData: Partial<RequestTemplate>;
  updateTemplateData: (updates: Partial<RequestTemplate>) => void;
}

export function Step2RequestDetails({
  templateData,
  updateTemplateData,
}: Step2RequestDetailsProps) {
  const [expandedSections, setExpandedSections] = useState<string[]>([]);
  
  // Ensure we have at least an empty array
  const schema = templateData.requestDetailsSchema || [];

  // Initialize with the first section expanded if none are expanded and sections exist
  React.useEffect(() => {
    if (schema.length > 0 && expandedSections.length === 0) {
      setExpandedSections([schema[0].id]);
    }
  }, [schema.length]);

  const addSection = () => {
    const newSection: RequestFieldSection = {
      id: `section_${Date.now()}`,
      name: 'New Section',
      description: '',
      fields: [],
      order: schema.length,
    };

    updateTemplateData({
      requestDetailsSchema: [...schema, newSection],
    });
    setExpandedSections([...expandedSections, newSection.id]);
  };

  const updateSection = (sectionId: string, updates: Partial<RequestFieldSection>) => {
    updateTemplateData({
      requestDetailsSchema: schema.map((section) =>
        section.id === sectionId ? { ...section, ...updates } : section
      ),
    });
  };

  const deleteSection = (sectionId: string) => {
    if (!confirm('Are you sure you want to delete this section and all its fields?')) return;

    updateTemplateData({
      requestDetailsSchema: schema.filter((section) => section.id !== sectionId),
    });
  };

  const addField = (sectionId: string) => {
    const newField: RequestField = {
      id: `field_${Date.now()}`,
      label: 'New Field',
      key: `field_${Date.now()}`,
      type: FieldType.TEXT,
      required: false,
      visibility: FieldVisibility.ADMIN_ONLY,
      order: 0,
    };

    updateTemplateData({
      requestDetailsSchema: schema.map((section) => {
        if (section.id === sectionId) {
          return { ...section, fields: [...section.fields, newField] };
        }
        return section;
      }),
    });
  };

  const updateField = (sectionId: string, fieldId: string, updates: Partial<RequestField>) => {
    updateTemplateData({
      requestDetailsSchema: schema.map((section) => {
        if (section.id === sectionId) {
          return {
            ...section,
            fields: section.fields.map((field) =>
              field.id === fieldId ? { ...field, ...updates } : field
            ),
          };
        }
        return section;
      }),
    });
  };

  const deleteField = (sectionId: string, fieldId: string) => {
    updateTemplateData({
      requestDetailsSchema: schema.map((section) =>
        section.id === sectionId
          ? { ...section, fields: section.fields.filter((f) => f.id !== fieldId) }
          : section
      ),
    });
  };

  const toggleSection = (sectionId: string) => {
    setExpandedSections((prev) =>
      prev.includes(sectionId) ? prev.filter((id) => id !== sectionId) : [...prev, sectionId]
    );
  };

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-6">
        <h3 className="text-lg text-slate-900 mb-2">Request Details Schema</h3>
        <p className="text-sm text-slate-600">
          Define the data fields that will be collected when creating a request from this template.
        </p>
      </div>

      <div className="space-y-6">
        {schema.map((section) => {
          const isExpanded = expandedSections.includes(section.id);

          return (
            <div key={section.id} className="border border-slate-200 rounded-xl bg-white shadow-sm overflow-hidden">
              {/* Section Header */}
              <div className="flex items-center gap-4 p-4 bg-slate-50 border-b border-slate-200">
                <GripVertical className="w-5 h-5 text-slate-400 cursor-move" />
                <div className="flex-1 grid gap-1">
                  <Input
                    value={section.name}
                    onChange={(e) => updateSection(section.id, { name: e.target.value })}
                    className="font-medium bg-transparent border-transparent hover:border-slate-300 focus:bg-white h-8 px-2 -ml-2 text-base w-full md:w-1/2"
                    placeholder="Section Name"
                  />
                  <Input
                    value={section.description || ''}
                    onChange={(e) => updateSection(section.id, { description: e.target.value })}
                    className="text-xs text-slate-500 bg-transparent border-transparent hover:border-slate-300 focus:bg-white h-6 px-2 -ml-2 w-full md:w-2/3"
                    placeholder="Add a description for this section..."
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => toggleSection(section.id)}
                    className="h-8 w-8 p-0"
                  >
                    {isExpanded ? (
                      <ChevronUp className="w-4 h-4 text-slate-500" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-slate-500" />
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => deleteSection(section.id)}
                    className="h-8 w-8 p-0 hover:bg-red-50 hover:text-red-600"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              {/* Section Content */}
              {isExpanded && (
                <div className="p-4">
                  <div className="rounded-md border border-slate-200">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-slate-50/50">
                          <TableHead className="w-[40px]"></TableHead>
                          <TableHead className="min-w-[200px]">FIELD NAME</TableHead>
                          <TableHead className="w-[150px]">DATA TYPE</TableHead>
                          <TableHead className="w-[100px] text-center">REQUIRED</TableHead>
                          <TableHead className="min-w-[200px]">OPTIONS (DROPDOWN)</TableHead>
                          <TableHead className="w-[200px]">KEY MAPPING</TableHead>
                          <TableHead className="w-[100px] text-right">ACTION</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {section.fields.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={7} className="h-24 text-center text-slate-500">
                              No fields added yet. Click "Add Field" below to start.
                            </TableCell>
                          </TableRow>
                        ) : (
                          section.fields.map((field) => (
                            <TableRow key={field.id} className="group">
                              <TableCell>
                                <GripVertical className="w-4 h-4 text-slate-300 group-hover:text-slate-500 cursor-move" />
                              </TableCell>
                              <TableCell>
                                <Input
                                  value={field.label}
                                  onChange={(e) => updateField(section.id, field.id, { label: e.target.value })}
                                  className="h-9 border-slate-200"
                                  placeholder="Field Name"
                                />
                              </TableCell>
                              <TableCell>
                                <Select
                                  value={field.type}
                                  onValueChange={(value) => updateField(section.id, field.id, { type: value as FieldType })}
                                >
                                  <SelectTrigger className="h-9 border-slate-200">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {Object.values(FieldType).map((type) => (
                                      <SelectItem key={type} value={type}>
                                        {type}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </TableCell>
                              <TableCell className="text-center">
                                <div className="flex justify-center">
                                  <Switch
                                    checked={field.required}
                                    onCheckedChange={(checked) => updateField(section.id, field.id, { required: checked })}
                                  />
                                </div>
                              </TableCell>
                              <TableCell>
                                {(field.type === FieldType.DROPDOWN || field.type === FieldType.MULTI_SELECT) ? (
                                  <Popover>
                                    <PopoverTrigger asChild>
                                      <Button variant="outline" size="sm" className="w-full justify-start text-slate-500 h-9 font-normal border-slate-200">
                                        <Settings className="w-3 h-3 mr-2" />
                                        {(field.options && field.options.length > 0) 
                                          ? `${field.options.length} option(s)` 
                                          : "Configure options"}
                                      </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-80 p-4">
                                      <div className="space-y-2">
                                        <Label className="text-xs font-semibold uppercase text-slate-500">
                                          Options (One per line)
                                        </Label>
                                        <Textarea
                                          value={(field.options || []).join('\n')}
                                          onChange={(e) => updateField(section.id, field.id, { options: e.target.value.split('\n') })}
                                          placeholder="Option 1&#10;Option 2&#10;Option 3"
                                          className="min-h-[150px]"
                                        />
                                      </div>
                                    </PopoverContent>
                                  </Popover>
                                ) : (
                                  <span className="text-xs text-slate-400 italic pl-2">Not applicable</span>
                                )}
                              </TableCell>
                              <TableCell>
                                <div className="relative">
                                  <LinkIcon className="absolute left-2.5 top-2.5 w-3 h-3 text-slate-400" />
                                  <Input
                                    value={field.key}
                                    onChange={(e) => updateField(section.id, field.id, { key: e.target.value })}
                                    className="h-9 pl-8 border-slate-200 text-xs font-mono text-slate-600"
                                    placeholder="system_key"
                                  />
                                </div>
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="flex items-center justify-end gap-1">
                                  <Popover>
                                    <PopoverTrigger asChild>
                                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-slate-500 hover:text-indigo-600">
                                        <Settings className="w-4 h-4" />
                                      </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-80">
                                      <div className="space-y-4">
                                        <h4 className="font-medium text-sm border-b pb-2">Advanced Settings</h4>
                                        <div className="space-y-2">
                                          <Label className="text-xs">Placeholder Text</Label>
                                          <Input 
                                            value={field.placeholder || ''} 
                                            onChange={(e) => updateField(section.id, field.id, { placeholder: e.target.value })}
                                            className="h-8"
                                            placeholder="Placeholder..."
                                          />
                                        </div>
                                        <div className="space-y-2">
                                          <Label className="text-xs">Help Text</Label>
                                          <Textarea 
                                            value={field.helpText || ''} 
                                            onChange={(e) => updateField(section.id, field.id, { helpText: e.target.value })}
                                            className="h-16 resize-none"
                                            placeholder="Help text..."
                                          />
                                        </div>
                                        <div className="space-y-2">
                                          <Label className="text-xs">Visibility</Label>
                                          <Select
                                            value={field.visibility}
                                            onValueChange={(value) => updateField(section.id, field.id, { visibility: value as FieldVisibility })}
                                          >
                                            <SelectTrigger className="h-8">
                                              <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                              {Object.values(FieldVisibility).map((v) => (
                                                <SelectItem key={v} value={v}>{v}</SelectItem>
                                              ))}
                                            </SelectContent>
                                          </Select>
                                        </div>
                                      </div>
                                    </PopoverContent>
                                  </Popover>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => deleteField(section.id, field.id)}
                                    className="h-8 w-8 p-0 text-slate-400 hover:text-red-600 hover:bg-red-50"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>

                  <Button
                    variant="outline"
                    onClick={() => addField(section.id)}
                    className="mt-4 w-full border-dashed border-slate-300 text-slate-600 hover:bg-slate-50 hover:text-indigo-600 hover:border-indigo-300"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Add Field
                  </Button>
                </div>
              )}
            </div>
          );
        })}

        <Button
          variant="outline"
          onClick={addSection}
          className="w-full py-6 border-dashed border-slate-300 text-slate-500 hover:border-slate-400 hover:text-slate-700"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add New Section
        </Button>
      </div>
    </div>
  );
}
