/**
 * InvoiceFormDialog — create a functional invoice in the supplier's template.
 *
 * Dates, an auto-sequenced invoice number (overridable), a billed-to selector
 * over the refund-cluster entities (or free-form), dynamic line items with
 * VAT-exclusive prices, live totals and a live preview in the active template.
 * When billed to a cluster entity, saving can also record the matching
 * input-VAT expense in that entity's refund-clusters ledger.
 */

import { useEffect, useMemo, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
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
import { VAT_TREATMENT_OPTIONS } from '../constants';
import { formatZar } from '../../refund-clusters/vat';
import { computeInvoiceTotals, emptyLineItem } from '../invoiceMath';
import { useBilledToOptions, useCreateInvoice, useSupplierLogoUrl } from '../hooks/useSuppliers';
import type {
  InvoiceLineItem,
  Supplier,
  SupplierInvoiceSequence,
  SupplierTemplate,
  VatTreatment,
} from '../types';
import { InvoicePreview, type InvoicePreviewData } from './InvoicePreview';

interface InvoiceFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  supplier: Supplier;
  activeTemplate: SupplierTemplate | null;
  sequence: SupplierInvoiceSequence;
}

/** Local calendar date as yyyy-mm-dd (toISOString would shift to UTC's day). */
const todayIso = () => {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
};

function nextNumberPreview(sequence: SupplierInvoiceSequence): string {
  return `${sequence.prefix}${String(sequence.nextNumber).padStart(sequence.padding, '0')}`;
}

export function InvoiceFormDialog({
  open,
  onOpenChange,
  supplier,
  activeTemplate,
  sequence,
}: InvoiceFormDialogProps) {
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [invoiceDate, setInvoiceDate] = useState(todayIso());
  const [dueDate, setDueDate] = useState(todayIso());
  const [billedToKind, setBilledToKind] = useState<'cluster_entity' | 'freeform'>('cluster_entity');
  const [entityKey, setEntityKey] = useState('');
  const [freeformName, setFreeformName] = useState('');
  const [freeformVat, setFreeformVat] = useState('');
  const [freeformAddress, setFreeformAddress] = useState('');
  const [lineItems, setLineItems] = useState<InvoiceLineItem[]>([]);
  const [notes, setNotes] = useState('');
  const [recordInLedger, setRecordInLedger] = useState(true);
  // One id per dialog session: the server treats repeated submissions (client
  // retries, double-clicks) carrying the same id as the same invoice.
  const [clientRequestId, setClientRequestId] = useState('');

  const create = useCreateInvoice();
  const { data: options = [] } = useBilledToOptions(open);
  const { data: logoUrl } = useSupplierLogoUrl(supplier.id, Boolean(supplier.logo));

  useEffect(() => {
    if (open) {
      setInvoiceNumber('');
      setInvoiceDate(todayIso());
      setDueDate(todayIso());
      setBilledToKind('cluster_entity');
      setEntityKey('');
      setFreeformName('');
      setFreeformVat('');
      setFreeformAddress('');
      setLineItems([emptyLineItem(supplier.defaultVatTreatment)]);
      setNotes('');
      setRecordInLedger(true);
      setClientRequestId(crypto.randomUUID());
    }
  }, [open, supplier.defaultVatTreatment]);

  const selectedOption = useMemo(
    () => options.find((o) => `${o.clusterId}:${o.entityId}` === entityKey) ?? null,
    [options, entityKey],
  );

  const totals = useMemo(() => computeInvoiceTotals(lineItems), [lineItems]);

  const previewData: InvoicePreviewData = {
    invoiceNumber: invoiceNumber.trim() || nextNumberPreview(sequence),
    invoiceDate,
    dueDate,
    billedToName:
      billedToKind === 'cluster_entity' ? (selectedOption?.name ?? '—') : freeformName || '—',
    billedToVatNumber: billedToKind === 'freeform' ? freeformVat || undefined : undefined,
    billedToAddress:
      billedToKind === 'cluster_entity' ? selectedOption?.address : freeformAddress || undefined,
    lineItems,
    notes: notes || undefined,
  };

  const hasValidLines =
    lineItems.length > 0 && lineItems.every((l) => l.description.trim() && l.quantity > 0);
  const hasBilledTo =
    billedToKind === 'cluster_entity' ? Boolean(selectedOption) : Boolean(freeformName.trim());
  const canSubmit = hasValidLines && hasBilledTo && Boolean(activeTemplate);

  const updateLine = (index: number, patch: Partial<InvoiceLineItem>) => {
    setLineItems((prev) => prev.map((line, i) => (i === index ? { ...line, ...patch } : line)));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit || create.isPending) return;
    create.mutate(
      {
        supplierId: supplier.id,
        invoice: {
          invoiceNumber: invoiceNumber.trim() || undefined,
          invoiceDate,
          dueDate,
          billedTo:
            billedToKind === 'cluster_entity'
              ? {
                  kind: 'cluster_entity',
                  clusterId: selectedOption!.clusterId,
                  entityId: selectedOption!.entityId,
                }
              : {
                  kind: 'freeform',
                  name: freeformName.trim(),
                  vatNumber: freeformVat.trim() || undefined,
                  address: freeformAddress.trim() || undefined,
                },
          lineItems: lineItems.map((line) => ({
            ...line,
            description: line.description.trim(),
          })),
          notes: notes.trim() || undefined,
          status: 'issued',
          recordInLedger: billedToKind === 'cluster_entity' ? recordInLedger : false,
          clientRequestId,
        },
      },
      { onSuccess: () => onOpenChange(false) },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-6xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New Invoice — {supplier.name}</DialogTitle>
          <DialogDescription>
            Rendered in the supplier's active invoice template
            {activeTemplate ? ` (v${activeTemplate.version})` : ''}.
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={handleSubmit}
          className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] gap-6"
        >
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label htmlFor="invoice-number" className="text-xs">
                  Invoice Number
                </Label>
                <Input
                  id="invoice-number"
                  value={invoiceNumber}
                  onChange={(e) => setInvoiceNumber(e.target.value)}
                  placeholder={nextNumberPreview(sequence)}
                  className="h-9"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="invoice-date" className="text-xs">
                  Invoice Date
                </Label>
                <Input
                  id="invoice-date"
                  type="date"
                  value={invoiceDate}
                  onChange={(e) => setInvoiceDate(e.target.value)}
                  className="h-9"
                  required
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="invoice-due" className="text-xs">
                  Due Date
                </Label>
                <Input
                  id="invoice-due"
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="h-9"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs">Billed To</Label>
              <Select
                value={billedToKind}
                onValueChange={(value) => setBilledToKind(value as 'cluster_entity' | 'freeform')}
              >
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cluster_entity">One of my entities</SelectItem>
                  <SelectItem value="freeform">Other (enter manually)</SelectItem>
                </SelectContent>
              </Select>
              {billedToKind === 'cluster_entity' ? (
                <>
                  <Select value={entityKey || undefined} onValueChange={setEntityKey}>
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="Select the entity being billed" />
                    </SelectTrigger>
                    <SelectContent>
                      {options.map((option) => (
                        <SelectItem
                          key={`${option.clusterId}:${option.entityId}`}
                          value={`${option.clusterId}:${option.entityId}`}
                        >
                          {option.name} — {option.clusterName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <label className="flex items-center gap-2 text-sm pt-1">
                    <Checkbox
                      checked={recordInLedger}
                      onCheckedChange={(value) => setRecordInLedger(value === true)}
                    />
                    Record as input-VAT expense in this entity's ledger
                  </label>
                </>
              ) : (
                <div className="space-y-2">
                  <Input
                    value={freeformName}
                    onChange={(e) => setFreeformName(e.target.value)}
                    placeholder="Customer name"
                    className="h-9"
                  />
                  <Input
                    value={freeformVat}
                    onChange={(e) => setFreeformVat(e.target.value)}
                    placeholder="VAT number (optional)"
                    className="h-9"
                  />
                  <Textarea
                    value={freeformAddress}
                    onChange={(e) => setFreeformAddress(e.target.value)}
                    placeholder="Address (optional)"
                    rows={2}
                    className="bg-white border-border shadow-sm"
                  />
                </div>
              )}
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Line Items (prices excl. VAT)</Label>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    setLineItems((prev) => [...prev, emptyLineItem(supplier.defaultVatTreatment)])
                  }
                >
                  <Plus className="h-4 w-4 mr-1" /> Add Line
                </Button>
              </div>
              <div className="space-y-2">
                {lineItems.map((line, index) => (
                  <div
                    key={index}
                    className="grid grid-cols-[minmax(0,1fr)_64px_96px_130px_32px] gap-2 items-center"
                  >
                    <Input
                      value={line.description}
                      onChange={(e) => updateLine(index, { description: e.target.value })}
                      placeholder="Description of services rendered"
                      className="h-9"
                    />
                    <Input
                      type="number"
                      min={0}
                      step="any"
                      value={line.quantity}
                      onChange={(e) => updateLine(index, { quantity: Number(e.target.value) })}
                      className="h-9"
                      aria-label="Quantity"
                    />
                    <Input
                      type="number"
                      min={0}
                      step="0.01"
                      value={line.unitPrice}
                      onChange={(e) => updateLine(index, { unitPrice: Number(e.target.value) })}
                      className="h-9"
                      aria-label="Unit price (excl. VAT)"
                    />
                    <Select
                      value={line.vatTreatment}
                      onValueChange={(value) =>
                        updateLine(index, { vatTreatment: value as VatTreatment })
                      }
                    >
                      <SelectTrigger className="h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {VAT_TREATMENT_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      disabled={lineItems.length === 1}
                      onClick={() => setLineItems((prev) => prev.filter((_, i) => i !== index))}
                      aria-label="Remove line"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
              <div className="text-sm text-right space-y-0.5 pt-1">
                <div>Subtotal: {formatZar(totals.subtotal)}</div>
                <div>VAT: {formatZar(totals.vatAmount)}</div>
                <div className="font-semibold">Total: {formatZar(totals.total)}</div>
              </div>
            </div>

            <div className="space-y-1">
              <Label htmlFor="invoice-notes" className="text-xs">
                Notes (optional)
              </Label>
              <Textarea
                id="invoice-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                className="bg-white border-border shadow-sm"
              />
            </div>
          </div>

          <div className="border rounded-lg bg-muted/20 p-3 overflow-auto max-h-[70vh]">
            {activeTemplate ? (
              <InvoicePreview
                spec={activeTemplate.spec}
                supplier={supplier}
                data={previewData}
                logoUrl={logoUrl}
                scale={0.6}
              />
            ) : (
              <p className="text-sm text-muted-foreground py-10 text-center">
                Activate a template before creating invoices.
              </p>
            )}
          </div>

          <DialogFooter className="lg:col-span-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!canSubmit || create.isPending}>
              {create.isPending ? 'Creating…' : 'Create Invoice'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
