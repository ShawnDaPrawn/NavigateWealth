/**
 * FieldsEditor — The form schema — sections and their fields.
 *
 * Extracted verbatim from RoAModuleContractManager.tsx (2,125 lines). Behaviour
 * unchanged; only the imports are new.
 */
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '../../../../../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../../../../ui/card';
import { Input } from '../../../../../ui/input';
import { Label } from '../../../../../ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../../../ui/select';
import { Separator } from '../../../../../ui/separator';
import type { RoAContractFieldType, RoAContractSourceType, RoAModuleContract } from '../../types';
import { toId } from '../roaContractHelpers';
import type { ContractField, ContractSection } from '../roaContractHelpers';

export function FieldsEditor({
  draft,
  updateDraft,
  schemaFormat,
}: {
  draft: RoAModuleContract;
  updateDraft: (updater: (current: RoAModuleContract) => RoAModuleContract) => void;
  schemaFormat?: {
    allowedFieldTypes: RoAContractFieldType[];
    allowedSourceTypes: RoAContractSourceType[];
  };
}) {
  const addSection = () =>
    updateDraft((current) => ({
      ...current,
      formSchema: {
        sections: [
          ...current.formSchema.sections,
          {
            id: `section_${current.formSchema.sections.length + 1}`,
            title: 'New Section',
            fields: [],
          },
        ],
      },
    }));

  const addField = (sectionIndex: number) =>
    updateDraft((current) => {
      const sections = [...current.formSchema.sections];
      sections[sectionIndex] = {
        ...sections[sectionIndex],
        fields: [
          ...sections[sectionIndex].fields,
          {
            key: `field_${sections[sectionIndex].fields.length + 1}`,
            label: 'New Field',
            type: 'text',
            source: 'moduleInput',
          },
        ],
      };
      return { ...current, formSchema: { sections } };
    });

  const updateSection = (sectionIndex: number, patch: Partial<ContractSection>) =>
    updateDraft((current) => {
      const sections = [...current.formSchema.sections];
      sections[sectionIndex] = { ...sections[sectionIndex], ...patch };
      return { ...current, formSchema: { sections } };
    });

  const updateField = (sectionIndex: number, fieldIndex: number, patch: Partial<ContractField>) =>
    updateDraft((current) => {
      const sections = [...current.formSchema.sections];
      const fields = [...sections[sectionIndex].fields];
      fields[fieldIndex] = { ...fields[fieldIndex], ...patch };
      sections[sectionIndex] = { ...sections[sectionIndex], fields };
      const requiredFields = sections.flatMap((section) =>
        section.fields.filter((field) => field.required).map((field) => field.key),
      );
      return {
        ...current,
        formSchema: { sections },
        validation: { ...current.validation, requiredFields },
      };
    });

  const removeField = (sectionIndex: number, fieldIndex: number) =>
    updateDraft((current) => {
      const sections = [...current.formSchema.sections];
      const fields = sections[sectionIndex].fields.filter((_, index) => index !== fieldIndex);
      sections[sectionIndex] = { ...sections[sectionIndex], fields };
      return { ...current, formSchema: { sections } };
    });

  return (
    <div className="space-y-4">
      {draft.formSchema.sections.map((section, sectionIndex) => (
        <Card key={`${section.id}-${sectionIndex}`}>
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <CardTitle className="text-base">{section.title}</CardTitle>
              <Button variant="outline" size="sm" onClick={() => addField(sectionIndex)}>
                <Plus className="h-4 w-4 mr-2" />
                Field
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 md:grid-cols-2">
              <Input
                value={section.id}
                onChange={(event) => updateSection(sectionIndex, { id: toId(event.target.value) })}
              />
              <Input
                value={section.title}
                onChange={(event) => updateSection(sectionIndex, { title: event.target.value })}
              />
            </div>
            <Separator />
            {section.fields.map((field, fieldIndex) => (
              <div key={`${field.key}-${fieldIndex}`} className="rounded-md border p-3">
                <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
                  <div className="space-y-2">
                    <Label>Key</Label>
                    <Input
                      value={field.key}
                      onChange={(event) =>
                        updateField(sectionIndex, fieldIndex, { key: toId(event.target.value) })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Label</Label>
                    <Input
                      value={field.label}
                      onChange={(event) =>
                        updateField(sectionIndex, fieldIndex, { label: event.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Type</Label>
                    <Select
                      value={field.type}
                      onValueChange={(value) =>
                        updateField(sectionIndex, fieldIndex, {
                          type: value as RoAContractFieldType,
                        })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {(schemaFormat?.allowedFieldTypes || ['text']).map((type) => (
                          <SelectItem key={type} value={type}>
                            {type}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Source</Label>
                    <Select
                      value={field.source}
                      onValueChange={(value) =>
                        updateField(sectionIndex, fieldIndex, {
                          source: value as RoAContractSourceType,
                        })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {(schemaFormat?.allowedSourceTypes || ['moduleInput']).map((type) => (
                          <SelectItem key={type} value={type}>
                            {type}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="mt-3 grid gap-3 md:grid-cols-[1fr_1fr_auto_auto]">
                  <Input
                    placeholder="Options, comma separated"
                    value={field.options?.join(', ') || ''}
                    onChange={(event) =>
                      updateField(sectionIndex, fieldIndex, {
                        options: event.target.value
                          .split(',')
                          .map((value) => value.trim())
                          .filter(Boolean),
                      })
                    }
                  />
                  <Input
                    placeholder="Placeholder"
                    value={field.placeholder || ''}
                    onChange={(event) =>
                      updateField(sectionIndex, fieldIndex, { placeholder: event.target.value })
                    }
                  />
                  <Button
                    type="button"
                    variant={field.required ? 'default' : 'outline'}
                    onClick={() =>
                      updateField(sectionIndex, fieldIndex, { required: !field.required })
                    }
                  >
                    Required
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removeField(sectionIndex, fieldIndex)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      ))}
      <Button variant="outline" onClick={addSection}>
        <Plus className="h-4 w-4 mr-2" />
        Add Section
      </Button>
    </div>
  );
}
