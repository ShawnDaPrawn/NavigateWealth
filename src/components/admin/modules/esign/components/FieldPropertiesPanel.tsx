/**
 * Field Properties Panel
 * Right sidebar for the Prepare Form Studio
 * Allows editing properties of the selected field
 */

import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../../../ui/card';
import { Input } from '../../../../ui/input';
import { Label } from '../../../../ui/label';
import { Checkbox } from '../../../../ui/checkbox';
import { Button } from '../../../../ui/button';
import { Textarea } from '../../../../ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../../ui/select';
import {
  Trash2,
  Settings,
  Type,
  AlertCircle,
  ShieldCheck,
  Sparkles,
  Lock,
  GitBranch,
  Calculator,
  Plus,
  X,
} from 'lucide-react';
import { Badge } from '../../../../ui/badge';
import type {
  EsignField,
  SignerFormData,
  TextFieldFormat,
  FieldValidationMetadata,
  PrefillToken,
  ConditionalRule,
  ConditionalOperator,
  ConditionalMetadata,
  CalculatedMetadata,
} from '../types';
import { SIGNER_COLORS } from '../constants';

// P3.6 — closed list of CRM tokens. Adding one requires backend changes
// in `esign-prefill.ts`; the Select renders only what the resolver knows.
const PREFILL_TOKEN_OPTIONS: Array<{ value: PrefillToken | ''; label: string; group: string }> = [
  { value: '', label: 'No pre-fill', group: '' },
  { value: 'client.name', label: 'Client name', group: 'Client (CRM)' },
  { value: 'client.email', label: 'Client email', group: 'Client (CRM)' },
  { value: 'client.phone', label: 'Client phone', group: 'Client (CRM)' },
  { value: 'client.id_number', label: 'Client SA ID number', group: 'Client (CRM)' },
  { value: 'client.address', label: 'Client address', group: 'Client (CRM)' },
  { value: 'envelope.advice_case_id', label: 'Advice case ID', group: 'Envelope context' },
  { value: 'envelope.product_id', label: 'Product ID', group: 'Envelope context' },
  { value: 'envelope.request_id', label: 'Request ID', group: 'Envelope context' },
];

interface FieldPropertiesPanelProps {
  field: EsignField | null;
  signers: SignerFormData[];
  /** P4.5 / P4.6 — All other fields on the envelope so conditional and
   *  calculated editors can offer source-field pickers and show formula
   *  identifiers. The currently-selected field is filtered out at the
   *  use-site below. */
  allFields?: EsignField[];
  onUpdate: (fieldId: string, updates: Partial<EsignField>) => void;
  onDelete: (fieldId: string) => void;
}

// P4.5 — Operators surfaced in the conditional editor, with copy that
// reads naturally next to the source-field name.
const CONDITIONAL_OPERATORS: Array<{ value: ConditionalOperator; label: string; needsValue: boolean }> = [
  { value: 'equals', label: 'is exactly', needsValue: true },
  { value: 'not_equals', label: 'is not', needsValue: true },
  { value: 'is_filled', label: 'is filled in', needsValue: false },
  { value: 'is_empty', label: 'is empty', needsValue: false },
  { value: 'is_checked', label: 'is checked', needsValue: false },
  { value: 'is_unchecked', label: 'is unchecked', needsValue: false },
];

function fieldDisplayName(f: EsignField, idx: number): string {
  const meta = (f.metadata ?? {}) as { label?: string; helpText?: string };
  if (meta.label && typeof meta.label === 'string') return meta.label;
  if (meta.helpText && typeof meta.helpText === 'string') {
    return meta.helpText.length > 32 ? `${meta.helpText.slice(0, 32)}…` : meta.helpText;
  }
  const typed = `${f.type[0].toUpperCase()}${f.type.slice(1)}`;
  return `${typed} field #${idx + 1} (page ${f.page + 1})`;
}

// Text-format presets for the validation editor. Each option maps to a
// `metadata.format` value that the SigningWorkflow already knows how to mask
// and validate (sa_id is wired up in Phase 1).
const TEXT_FORMAT_OPTIONS: Array<{ value: TextFieldFormat; label: string; description: string }> = [
  { value: 'free_text', label: 'Free text', description: 'Anything goes' },
  { value: 'sa_id', label: 'SA ID number', description: '13-digit SA ID with checksum' },
  // P2.5 2.4 — South African mobile and postal code presets. The SigningWorkflow
  // strips spaces / leading zero before validating (10-digit local form: 0XXXXXXXXX,
  // or +27XXXXXXXXX international form). Postal codes are 4 digits.
  { value: 'sa_mobile', label: 'SA mobile number', description: '10 digits (0XXXXXXXXX) or +27' },
  { value: 'sa_postal_code', label: 'SA postal code', description: '4 digits' },
  { value: 'number', label: 'Number', description: 'Digits only' },
  { value: 'email', label: 'Email address', description: 'name@example.com' },
  { value: 'phone', label: 'Phone number', description: 'International or local format' },
  { value: 'custom_regex', label: 'Custom pattern', description: 'Provide your own regex' },
];

/**
 * Try to compile the user-supplied regex so we can warn them in real time
 * if it's invalid. We never actually use this `RegExp` outside of the test —
 * the SigningWorkflow re-compiles at validation time.
 */
function isValidRegex(source: string | undefined): boolean {
  if (!source) return false;
  try {
    new RegExp(source);
    return true;
  } catch {
    return false;
  }
}

export function FieldPropertiesPanel({
  field,
  signers,
  allFields,
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

  // Pull validation metadata from the field. We cast through `unknown` because
  // `EsignField.metadata` is intentionally typed as a free-form record so the
  // backend can carry forward future keys without breaking client builds.
  const validation = ((field.metadata ?? {}) as Record<string, unknown>) as FieldValidationMetadata;
  const format: TextFieldFormat = (validation.format as TextFieldFormat | undefined) ?? 'free_text';
  const minLength = typeof validation.minLength === 'number' ? validation.minLength : undefined;
  const maxLength = typeof validation.maxLength === 'number' ? validation.maxLength : undefined;
  const pattern = typeof validation.pattern === 'string' ? validation.pattern : undefined;
  const helpText = typeof validation.helpText === 'string' ? validation.helpText : undefined;

  // Helper: merge a partial validation patch into `metadata` without losing any
  // unrelated keys the backend may have written.
  const patchValidation = (patch: Partial<FieldValidationMetadata>) => {
    const nextMeta: Record<string, unknown> = { ...(field.metadata ?? {}), ...patch };
    Object.keys(nextMeta).forEach((k) => {
      if (nextMeta[k] === '' || nextMeta[k] === undefined) delete nextMeta[k];
    });
    onUpdate(field.id, { metadata: nextMeta });
  };

  const customRegexValid = useMemo(
    () => format !== 'custom_regex' || isValidRegex(pattern),
    [format, pattern],
  );

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

        {/* Text-field validation editor (Phase 2)
            ─────────────────────────────────────────────────────────
            All text fields can be constrained by:
              • Format (preset OR custom regex)
              • Min / max length
              • Help text shown to the signer next to the input
            The rules persist on `metadata` and are enforced both
            in the studio (warnings) and in the SigningWorkflow. */}
        {field.type === 'text' && (
           <div className="space-y-4 pt-4 border-t border-gray-100">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-purple-600" />
                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Validation</h4>
              </div>

              <div className="space-y-2">
                <Label>Format</Label>
                <Select
                  value={format}
                  onValueChange={(val) => patchValidation({ format: val as TextFieldFormat })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TEXT_FORMAT_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        <span className="flex flex-col">
                          <span className="font-medium">{opt.label}</span>
                          <span className="text-xs text-gray-500">{opt.description}</span>
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {format === 'custom_regex' && (
                <div className="space-y-1">
                  <Label className="text-xs">Pattern (regex source, no delimiters)</Label>
                  <Input
                    placeholder={'^[A-Z]{3}-\\d{4}$'}
                    value={pattern ?? ''}
                    onChange={(e) => patchValidation({ pattern: e.target.value })}
                    className={customRegexValid ? '' : 'border-red-300 focus:ring-red-200'}
                  />
                  {!customRegexValid && (
                    <p className="text-xs text-red-600 flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" />
                      Invalid regular expression
                    </p>
                  )}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Min length</Label>
                  <Input
                    type="number"
                    min={0}
                    value={minLength ?? ''}
                    onChange={(e) => {
                      const v = e.target.value;
                      patchValidation({ minLength: v === '' ? undefined : Math.max(0, parseInt(v, 10)) });
                    }}
                    className="h-8"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Max length</Label>
                  <Input
                    type="number"
                    min={0}
                    value={maxLength ?? ''}
                    onChange={(e) => {
                      const v = e.target.value;
                      patchValidation({ maxLength: v === '' ? undefined : Math.max(0, parseInt(v, 10)) });
                    }}
                    className="h-8"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Help text (shown to signer)</Label>
                <Textarea
                  placeholder="e.g. Enter your full SA ID number"
                  value={helpText ?? ''}
                  onChange={(e) => patchValidation({ helpText: e.target.value })}
                  className="min-h-[60px] text-sm"
                />
              </div>

              <div className="space-y-1 pt-1">
                <Label className="text-xs">Default value (optional)</Label>
                <Input
                  placeholder="Pre-fill text..."
                  value={field.value || ''}
                  onChange={(e) => onUpdate(field.id, { value: e.target.value })}
                  className="h-8"
                  // Disabled when a prefill binding is active — the resolver
                  // overwrites this at send-time.
                  disabled={!!(((field.metadata ?? {}) as Record<string, unknown>).prefill)}
                />
              </div>

              {/* P3.6 — CRM Prefill binding */}
              {(() => {
                const meta = (field.metadata ?? {}) as { prefill?: { token?: PrefillToken; locked?: boolean } };
                const currentToken = meta.prefill?.token ?? '';
                const locked = !!meta.prefill?.locked;
                const setToken = (token: PrefillToken | '') => {
                  const nextMeta: Record<string, unknown> = { ...(field.metadata ?? {}) };
                  if (!token) {
                    delete nextMeta.prefill;
                  } else {
                    nextMeta.prefill = { token, locked };
                  }
                  onUpdate(field.id, { metadata: nextMeta });
                };
                const setLocked = (next: boolean) => {
                  if (!currentToken) return;
                  const nextMeta: Record<string, unknown> = {
                    ...(field.metadata ?? {}),
                    prefill: { token: currentToken, locked: next },
                  };
                  onUpdate(field.id, { metadata: nextMeta });
                };
                return (
                  <div className="space-y-2 pt-3 border-t border-gray-100">
                    <div className="flex items-center gap-2">
                      <Sparkles className="h-3.5 w-3.5 text-purple-600" />
                      <Label className="text-xs">Auto-fill from CRM</Label>
                    </div>
                    <Select value={currentToken || '__none__'} onValueChange={(v) => setToken(v === '__none__' ? '' : (v as PrefillToken))}>
                      <SelectTrigger className="h-8">
                        <SelectValue placeholder="No pre-fill" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">No pre-fill</SelectItem>
                        {PREFILL_TOKEN_OPTIONS.filter((o) => o.value !== '').map((opt) => (
                          <SelectItem key={opt.value} value={opt.value as string}>
                            <span className="flex flex-col">
                              <span className="font-medium">{opt.label}</span>
                              <span className="text-xs text-gray-500">{opt.group}</span>
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    {currentToken && (
                      <label className="flex items-center justify-between text-xs cursor-pointer pt-1">
                        <span className="flex items-center gap-1.5 text-gray-700">
                          <Lock className="h-3 w-3" />
                          Lock value (signer can't edit)
                        </span>
                        <Checkbox checked={locked} onCheckedChange={(v) => setLocked(v === true)} />
                      </label>
                    )}
                    {currentToken && (
                      <p className="text-xs text-gray-500">
                        Resolved at send-time from the assigned signer's client record.
                      </p>
                    )}
                  </div>
                );
              })()}
           </div>
        )}

        {/* P4.5 — Conditional logic editor.
            Visible for every field type; hides this field on the
            signer's screen until the configured rules pass. The signer
            cannot complete the envelope without filling required
            visible fields, so a hidden conditional field never blocks
            submission. */}
        {(() => {
          const otherFields = (allFields ?? []).filter(f => f.id !== field.id);
          const cond = ((field.metadata ?? {}) as { conditional?: ConditionalMetadata }).conditional;
          const rules: ConditionalRule[] = cond?.rules ?? [];
          const clearOnHide = !!cond?.clearOnHide;

          const writeConditional = (next: ConditionalMetadata | null) => {
            const meta: Record<string, unknown> = { ...(field.metadata ?? {}) };
            if (!next || next.rules.length === 0) {
              delete meta.conditional;
            } else {
              meta.conditional = next;
            }
            onUpdate(field.id, { metadata: meta });
          };

          const addRule = () => {
            const first = otherFields[0];
            if (!first) return;
            writeConditional({
              rules: [...rules, { sourceFieldId: first.id, operator: 'equals', value: '' }],
              clearOnHide,
            });
          };

          const updateRule = (idx: number, patch: Partial<ConditionalRule>) => {
            const next = rules.map((r, i) => (i === idx ? { ...r, ...patch } : r));
            writeConditional({ rules: next, clearOnHide });
          };

          const removeRule = (idx: number) => {
            const next = rules.filter((_, i) => i !== idx);
            writeConditional(next.length === 0 ? null : { rules: next, clearOnHide });
          };

          return (
            <div className="space-y-3 pt-4 border-t border-gray-100">
              <div className="flex items-center gap-2">
                <GitBranch className="h-4 w-4 text-purple-600" />
                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Conditional logic
                </h4>
              </div>
              {otherFields.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  Add another field on the document to make this one conditional.
                </p>
              ) : rules.length === 0 ? (
                <Button variant="outline" size="sm" className="w-full" onClick={addRule}>
                  <Plus className="h-3.5 w-3.5 mr-1.5" />
                  Show this field only when…
                </Button>
              ) : (
                <div className="space-y-2">
                  <p className="text-[11px] text-muted-foreground">
                    Show this field only when <span className="font-medium">all</span> of:
                  </p>
                  {rules.map((rule, idx) => {
                    const opMeta = CONDITIONAL_OPERATORS.find(o => o.value === rule.operator);
                    return (
                      <div
                        key={idx}
                        className="rounded-md border border-gray-200 bg-gray-50 p-2 space-y-2"
                      >
                        <div className="flex items-center gap-1.5">
                          <Select
                            value={rule.sourceFieldId}
                            onValueChange={(v) => updateRule(idx, { sourceFieldId: v })}
                          >
                            <SelectTrigger className="h-8 flex-1 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {otherFields.map((f, i) => (
                                <SelectItem key={f.id} value={f.id}>
                                  {fieldDisplayName(f, i)}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-gray-500 hover:text-red-600"
                            onClick={() => removeRule(idx)}
                            aria-label="Remove rule"
                          >
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Select
                            value={rule.operator}
                            onValueChange={(v) =>
                              updateRule(idx, { operator: v as ConditionalOperator })
                            }
                          >
                            <SelectTrigger className="h-8 flex-1 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {CONDITIONAL_OPERATORS.map(o => (
                                <SelectItem key={o.value} value={o.value}>
                                  {o.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          {opMeta?.needsValue && (
                            <Input
                              className="h-8 flex-1 text-xs"
                              placeholder="value"
                              value={rule.value ?? ''}
                              onChange={(e) => updateRule(idx, { value: e.target.value })}
                            />
                          )}
                        </div>
                      </div>
                    );
                  })}
                  <div className="flex items-center justify-between">
                    <Button variant="ghost" size="sm" onClick={addRule} className="h-7 text-xs">
                      <Plus className="h-3 w-3 mr-1" />
                      Add another rule
                    </Button>
                    <label className="flex items-center gap-1.5 text-[11px] text-gray-700 cursor-pointer">
                      <Checkbox
                        checked={clearOnHide}
                        onCheckedChange={(v) =>
                          writeConditional({ rules, clearOnHide: v === true })
                        }
                      />
                      Clear when hidden
                    </label>
                  </div>
                </div>
              )}
            </div>
          );
        })()}

        {/* P4.6 — Calculated value editor.
            Only meaningful for text fields. Display-only on the signer
            side: the value is computed from the formula and read-only,
            and never counts against required-field gating. Tokens use
            the form `{field:<id>}`. */}
        {field.type === 'text' && (() => {
          const otherFields = (allFields ?? []).filter(f => f.id !== field.id);
          const calc = ((field.metadata ?? {}) as { calculated?: CalculatedMetadata }).calculated;
          const writeCalculated = (next: CalculatedMetadata | null) => {
            const meta: Record<string, unknown> = { ...(field.metadata ?? {}) };
            if (!next || !next.formula.trim()) {
              delete meta.calculated;
            } else {
              meta.calculated = next;
            }
            onUpdate(field.id, { metadata: meta });
          };
          return (
            <div className="space-y-3 pt-4 border-t border-gray-100">
              <div className="flex items-center gap-2">
                <Calculator className="h-4 w-4 text-purple-600" />
                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Calculated value
                </h4>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Formula</Label>
                <Textarea
                  placeholder={'e.g. {field:abc} * 12 + 100'}
                  value={calc?.formula ?? ''}
                  onChange={(e) =>
                    writeCalculated({
                      formula: e.target.value,
                      precision: calc?.precision ?? 2,
                      prefix: calc?.prefix,
                    })
                  }
                  className="min-h-[56px] text-xs font-mono"
                />
                <p className="text-[11px] text-muted-foreground">
                  Reference other fields with <code className="font-mono">{'{field:<id>}'}</code>.
                  Operators: + − × ÷ and parentheses.
                </p>
              </div>
              {otherFields.length > 0 && (
                <div className="space-y-1">
                  <Label className="text-xs">Insert field token</Label>
                  <Select
                    value=""
                    onValueChange={(id) => {
                      if (!id) return;
                      const insertion = `{field:${id}}`;
                      writeCalculated({
                        formula: `${calc?.formula ?? ''}${insertion}`,
                        precision: calc?.precision ?? 2,
                        prefix: calc?.prefix,
                      });
                    }}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="Choose a field…" />
                    </SelectTrigger>
                    <SelectContent>
                      {otherFields.map((f, i) => (
                        <SelectItem key={f.id} value={f.id}>
                          {fieldDisplayName(f, i)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Precision</Label>
                  <Input
                    type="number"
                    min={0}
                    max={6}
                    value={calc?.precision ?? 2}
                    onChange={(e) =>
                      writeCalculated({
                        formula: calc?.formula ?? '',
                        precision: Math.max(0, Math.min(6, parseInt(e.target.value, 10) || 0)),
                        prefix: calc?.prefix,
                      })
                    }
                    className="h-8"
                    disabled={!calc?.formula}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Prefix (display)</Label>
                  <Input
                    placeholder={'R '}
                    value={calc?.prefix ?? ''}
                    onChange={(e) =>
                      writeCalculated({
                        formula: calc?.formula ?? '',
                        precision: calc?.precision ?? 2,
                        prefix: e.target.value || undefined,
                      })
                    }
                    className="h-8"
                    disabled={!calc?.formula}
                  />
                </div>
              </div>
              {calc?.formula && (
                <Badge variant="outline" className="text-[10px] gap-1">
                  <Calculator className="h-3 w-3" />
                  Read-only on signer side
                </Badge>
              )}
            </div>
          );
        })()}

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