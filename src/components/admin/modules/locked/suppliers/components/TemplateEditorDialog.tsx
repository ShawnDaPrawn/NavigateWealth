/**
 * TemplateEditorDialog — manual escape hatch for the invoice standard.
 *
 * Form controls over every template-spec field with a live preview; saving
 * persists a NEW version with source 'manual' (the AI original is kept).
 */

import { useEffect, useMemo, useState } from 'react';
import { Button } from '../../../../../ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../../../../ui/dialog';
import { Input } from '../../../../../ui/input';
import { Label } from '../../../../../ui/label';
import { Textarea } from '../../../../../ui/textarea';
import { Checkbox } from '../../../../../ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../../../ui/select';
import {
  DEFAULT_TEMPLATE_SPEC,
  normalizeTemplateSpec,
  type InvoiceTemplateSpec,
} from '../templateSpec';
import { useSaveTemplateSpec } from '../hooks/useSuppliers';
import { SuppliersAPI } from '../api';
import { useQueryClient } from '@tanstack/react-query';
import { supplierKeys } from '../queryKeys';
import { toast } from 'sonner';
import type { Supplier, SupplierTemplate } from '../types';
import { sampleInvoiceData } from '../invoiceMath';
import { InvoicePreview } from './InvoicePreview';

interface TemplateEditorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  supplier: Supplier;
  /** Version the edits start from; null starts from the default layout. */
  baseTemplate: SupplierTemplate | null;
  logoUrl?: string | null;
}

const ENUM_OPTIONS = {
  margins: ['compact', 'normal', 'wide'],
  fontFamily: ['sans', 'serif', 'mono'],
  logoPosition: ['top-left', 'top-center', 'top-right'],
  blockPosition: ['left', 'right'],
  accentBar: ['none', 'top', 'left', 'under-title'],
  tableStyle: ['lined', 'striped', 'boxed', 'minimal'],
  headerStyle: ['filled', 'underline', 'plain'],
  totalsPosition: ['right', 'full-width'],
  currency: ['R1 234,56', 'R 1,234.56', 'ZAR 1 234.56'],
  dateFormat: ['yyyy/MM/dd', 'dd MMM yyyy', 'dd/MM/yyyy', 'yyyy-MM-dd'],
} as const;

export function TemplateEditorDialog({
  open,
  onOpenChange,
  supplier,
  baseTemplate,
  logoUrl,
}: TemplateEditorDialogProps) {
  const [spec, setSpec] = useState<InvoiceTemplateSpec>(DEFAULT_TEMPLATE_SPEC);
  const save = useSaveTemplateSpec();
  const qc = useQueryClient();
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (open) {
      setSpec(normalizeTemplateSpec(baseTemplate?.spec ?? DEFAULT_TEMPLATE_SPEC));
    }
  }, [open, baseTemplate]);

  const sampleData = useMemo(() => sampleInvoiceData(supplier), [supplier]);

  /** Immutable deep-set helper for the two-level spec sections. */
  const patch = <S extends keyof InvoiceTemplateSpec>(
    section: S,
    values: Partial<InvoiceTemplateSpec[S]>,
  ) => setSpec((prev) => ({ ...prev, [section]: { ...prev[section], ...values } }));

  const handleSave = async () => {
    const normalized = normalizeTemplateSpec(spec);
    if (baseTemplate) {
      save.mutate(
        { supplierId: supplier.id, baseTemplateId: baseTemplate.id, spec: normalized },
        { onSuccess: () => onOpenChange(false) },
      );
      return;
    }
    // No versions exist yet — bootstrap the first (manual) template.
    setCreating(true);
    try {
      const template = await SuppliersAPI.createManualTemplate(supplier.id, normalized);
      qc.invalidateQueries({ queryKey: supplierKeys.detail(supplier.id) });
      qc.invalidateQueries({ queryKey: supplierKeys.lists() });
      toast.success(`Template v${template.version} created`);
      onOpenChange(false);
    } catch (error) {
      toast.error('Failed to create template', {
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      setCreating(false);
    }
  };

  const isSaving = save.isPending || creating;

  const enumSelect = (
    label: string,
    value: string,
    options: readonly string[],
    onChange: (value: string) => void,
  ) => (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="h-8">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option} value={option}>
              {option}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );

  const colorInput = (label: string, key: keyof InvoiceTemplateSpec['palette']) => (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={spec.palette[key]}
          onChange={(e) =>
            patch('palette', { [key]: e.target.value } as Partial<InvoiceTemplateSpec['palette']>)
          }
          className="h-8 w-10 rounded border cursor-pointer"
          aria-label={label}
        />
        <Input
          value={spec.palette[key]}
          onChange={(e) =>
            patch('palette', { [key]: e.target.value } as Partial<InvoiceTemplateSpec['palette']>)
          }
          className="h-8 font-mono text-xs"
        />
      </div>
    </div>
  );

  const boolCheckbox = (label: string, checked: boolean, onChange: (value: boolean) => void) => (
    <label className="flex items-center gap-2 text-sm">
      <Checkbox checked={checked} onCheckedChange={(value) => onChange(value === true)} />
      {label}
    </label>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-6xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {baseTemplate ? `Adjust Template (from v${baseTemplate.version})` : 'Create Template'}
          </DialogTitle>
          <DialogDescription>
            Changes save as a new version — the original stays available.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] gap-6">
          {/* Controls */}
          <div className="space-y-5">
            <section className="space-y-2">
              <h3 className="text-sm font-semibold">Colours</h3>
              <div className="grid grid-cols-2 gap-3">
                {colorInput('Primary', 'primary')}
                {colorInput('Accent', 'accent')}
                {colorInput('Header text', 'headerText')}
                {colorInput('Body text', 'bodyText')}
                {colorInput('Table header bg', 'tableHeaderBg')}
                {colorInput('Table header text', 'tableHeaderText')}
              </div>
            </section>

            <section className="space-y-2">
              <h3 className="text-sm font-semibold">Layout & Typography</h3>
              <div className="grid grid-cols-2 gap-3">
                {enumSelect('Margins', spec.page.margins, ENUM_OPTIONS.margins, (v) =>
                  patch('page', { margins: v as InvoiceTemplateSpec['page']['margins'] }),
                )}
                {enumSelect('Font', spec.typography.fontFamily, ENUM_OPTIONS.fontFamily, (v) =>
                  patch('typography', {
                    fontFamily: v as InvoiceTemplateSpec['typography']['fontFamily'],
                  }),
                )}
                <div className="space-y-1">
                  <Label className="text-xs">Base size (pt)</Label>
                  <Input
                    type="number"
                    min={7}
                    max={14}
                    value={spec.typography.baseSizePt}
                    onChange={(e) =>
                      patch('typography', { baseSizePt: Number(e.target.value) || 10 })
                    }
                    className="h-8"
                  />
                </div>
                {enumSelect('Accent bar', spec.header.accentBar, ENUM_OPTIONS.accentBar, (v) =>
                  patch('header', { accentBar: v as InvoiceTemplateSpec['header']['accentBar'] }),
                )}
              </div>
            </section>

            <section className="space-y-2">
              <h3 className="text-sm font-semibold">Logo & Header</h3>
              <div className="grid grid-cols-2 gap-3">
                {enumSelect('Logo position', spec.logo.position, ENUM_OPTIONS.logoPosition, (v) =>
                  patch('logo', { position: v as InvoiceTemplateSpec['logo']['position'] }),
                )}
                <div className="space-y-1">
                  <Label className="text-xs">Logo height (px)</Label>
                  <Input
                    type="number"
                    min={24}
                    max={160}
                    value={spec.logo.heightPx}
                    onChange={(e) => patch('logo', { heightPx: Number(e.target.value) || 64 })}
                    className="h-8"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Document title</Label>
                  <Input
                    value={spec.header.title}
                    onChange={(e) => patch('header', { title: e.target.value })}
                    className="h-8"
                  />
                </div>
                {enumSelect(
                  'Title position',
                  spec.header.titlePosition,
                  ENUM_OPTIONS.blockPosition,
                  (v) =>
                    patch('header', {
                      titlePosition: v as InvoiceTemplateSpec['header']['titlePosition'],
                    }),
                )}
              </div>
              <div className="flex flex-wrap gap-4 pt-1">
                {boolCheckbox('Show logo', spec.logo.show, (v) => patch('logo', { show: v }))}
                {boolCheckbox('Uppercase title', spec.typography.titleUppercase, (v) =>
                  patch('typography', { titleUppercase: v }),
                )}
                {boolCheckbox('Supplier address', spec.header.showSupplierAddress, (v) =>
                  patch('header', { showSupplierAddress: v }),
                )}
                {boolCheckbox('VAT number', spec.header.showVatNumber, (v) =>
                  patch('header', { showVatNumber: v }),
                )}
                {boolCheckbox('Reg number', spec.header.showRegNumber, (v) =>
                  patch('header', { showRegNumber: v }),
                )}
              </div>
            </section>

            <section className="space-y-2">
              <h3 className="text-sm font-semibold">Bill To & Table</h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Bill-to heading</Label>
                  <Input
                    value={spec.billedTo.heading}
                    onChange={(e) => patch('billedTo', { heading: e.target.value })}
                    className="h-8"
                  />
                </div>
                {enumSelect(
                  'Meta box position',
                  spec.metaBox.position,
                  ENUM_OPTIONS.blockPosition,
                  (v) =>
                    patch('metaBox', { position: v as InvoiceTemplateSpec['metaBox']['position'] }),
                )}
                {enumSelect('Table style', spec.lineTable.style, ENUM_OPTIONS.tableStyle, (v) =>
                  patch('lineTable', { style: v as InvoiceTemplateSpec['lineTable']['style'] }),
                )}
                {enumSelect(
                  'Table header',
                  spec.lineTable.headerStyle,
                  ENUM_OPTIONS.headerStyle,
                  (v) =>
                    patch('lineTable', {
                      headerStyle: v as InvoiceTemplateSpec['lineTable']['headerStyle'],
                    }),
                )}
              </div>
            </section>

            <section className="space-y-2">
              <h3 className="text-sm font-semibold">Totals & Formats</h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Subtotal label</Label>
                  <Input
                    value={spec.totals.subtotalLabel}
                    onChange={(e) => patch('totals', { subtotalLabel: e.target.value })}
                    className="h-8"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">VAT label</Label>
                  <Input
                    value={spec.totals.vatLabel}
                    onChange={(e) => patch('totals', { vatLabel: e.target.value })}
                    className="h-8"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Total label</Label>
                  <Input
                    value={spec.totals.totalLabel}
                    onChange={(e) => patch('totals', { totalLabel: e.target.value })}
                    className="h-8"
                  />
                </div>
                {enumSelect(
                  'Totals position',
                  spec.totals.position,
                  ENUM_OPTIONS.totalsPosition,
                  (v) =>
                    patch('totals', { position: v as InvoiceTemplateSpec['totals']['position'] }),
                )}
                {enumSelect('Currency format', spec.formats.currency, ENUM_OPTIONS.currency, (v) =>
                  patch('formats', { currency: v as InvoiceTemplateSpec['formats']['currency'] }),
                )}
                {enumSelect('Date format', spec.formats.dateFormat, ENUM_OPTIONS.dateFormat, (v) =>
                  patch('formats', {
                    dateFormat: v as InvoiceTemplateSpec['formats']['dateFormat'],
                  }),
                )}
              </div>
            </section>

            <section className="space-y-2">
              <h3 className="text-sm font-semibold">Footer</h3>
              <div className="space-y-2">
                <div className="space-y-1">
                  <Label className="text-xs">Banking details</Label>
                  <Textarea
                    value={spec.footer.bankingDetails}
                    onChange={(e) => patch('footer', { bankingDetails: e.target.value })}
                    rows={2}
                    className="bg-white border-border shadow-sm"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Terms</Label>
                  <Textarea
                    value={spec.footer.terms}
                    onChange={(e) => patch('footer', { terms: e.target.value })}
                    rows={2}
                    className="bg-white border-border shadow-sm"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Closing line</Label>
                  <Input
                    value={spec.footer.thankYouLine}
                    onChange={(e) => patch('footer', { thankYouLine: e.target.value })}
                    className="h-8"
                  />
                </div>
              </div>
            </section>
          </div>

          {/* Live preview */}
          <div className="border rounded-lg bg-muted/20 p-3 overflow-auto max-h-[70vh]">
            <InvoicePreview
              spec={normalizeTemplateSpec(spec)}
              supplier={supplier}
              data={sampleData}
              logoUrl={logoUrl}
              scale={0.6}
            />
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" onClick={handleSave} disabled={isSaving}>
            {isSaving ? 'Saving…' : 'Save as New Version'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
