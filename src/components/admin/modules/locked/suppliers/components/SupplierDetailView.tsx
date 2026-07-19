/**
 * SupplierDetailView — Profile · Template · Invoices sub-tabs for one
 * supplier. The wizard gating mirrors the capture flow: the Template tab needs
 * a saved profile (always true here) and the Invoices tab needs an active
 * template.
 */

import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Pencil, Plus, Settings2, Trash2 } from 'lucide-react';
import { Badge } from '../../../../../ui/badge';
import { Button } from '../../../../../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../../../../ui/card';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../../../../ui/tabs';
import {
  useDeleteSupplier,
  useSupplierDetail,
  useSupplierInvoices,
  useUpdateSequence,
  useUpdateSupplier,
} from '../hooks/useSuppliers';
import type { SupplierInput, SupplierInvoiceSequence } from '../types';
import { LogoUploadCard } from './LogoUploadCard';
import { SupplierFormDialog } from './SupplierFormDialog';
import { TemplatePanel } from './TemplatePanel';
import { InvoiceFormDialog } from './InvoiceFormDialog';
import { InvoiceList } from './InvoiceList';

interface SupplierDetailViewProps {
  supplierId: string;
  onBack: () => void;
}

export function SupplierDetailView({ supplierId, onBack }: SupplierDetailViewProps) {
  const { data, isLoading } = useSupplierDetail(supplierId);
  const { data: invoices = [] } = useSupplierInvoices(supplierId);
  const updateSupplier = useUpdateSupplier();
  const deleteSupplier = useDeleteSupplier();
  const [editOpen, setEditOpen] = useState(false);
  const [invoiceOpen, setInvoiceOpen] = useState(false);
  const [sequenceOpen, setSequenceOpen] = useState(false);

  const activeTemplate = useMemo(
    () => data?.templates.find((t) => t.id === data.supplier.activeTemplateId) ?? null,
    [data],
  );

  if (isLoading || !data) {
    return <div className="py-12 text-center text-sm text-muted-foreground">Loading supplier…</div>;
  }

  const { supplier, templates, sequence } = data;

  const handleEditSubmit = (values: SupplierInput) => {
    updateSupplier.mutate({ supplierId, patch: values }, { onSuccess: () => setEditOpen(false) });
  };

  const handleDelete = () => {
    if (
      window.confirm(
        `Delete ${supplier.name}? This removes its templates, ${invoices.length} invoice(s), logo and example file. Ledger transactions are kept.`,
      )
    ) {
      deleteSupplier.mutate(supplierId, { onSuccess: onBack });
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Suppliers
        </Button>
        <h2 className="text-lg font-semibold">{supplier.name}</h2>
        {supplier.industry ? <Badge variant="secondary">{supplier.industry}</Badge> : null}
        {supplier.archived ? <Badge variant="outline">Archived</Badge> : null}
        <div className="flex items-center gap-2 ml-auto">
          <Button type="button" variant="outline" size="sm" onClick={() => setEditOpen(true)}>
            <Pencil className="h-4 w-4 mr-1" /> Edit
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleDelete}
            disabled={deleteSupplier.isPending}
          >
            <Trash2 className="h-4 w-4 mr-1" /> Delete
          </Button>
        </div>
      </div>

      <Tabs defaultValue="profile" className="space-y-4">
        <TabsList>
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="template">Invoice Standard</TabsTrigger>
          <TabsTrigger value="invoices" disabled={!supplier.activeTemplateId}>
            Invoices
          </TabsTrigger>
        </TabsList>

        <TabsContent value="profile">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Details</CardTitle>
              </CardHeader>
              <CardContent className="text-sm space-y-2">
                <DetailRow label="Registration No" value={supplier.registrationNumber} />
                <DetailRow label="VAT No" value={supplier.vatNumber} />
                <DetailRow label="Industry" value={supplier.industry} />
                <DetailRow
                  label="Default VAT Type"
                  value={
                    supplier.defaultVatTreatment === 'standard'
                      ? 'Standard (15%)'
                      : supplier.defaultVatTreatment === 'zero_rated'
                        ? 'Zero-rated (0%)'
                        : 'Exempt'
                  }
                />
                <DetailRow
                  label="Registered Address"
                  value={supplier.registeredAddress}
                  multiline
                />
                <DetailRow label="Billing Info" value={supplier.billingInfo} multiline />
                <DetailRow label="Contact Number" value={supplier.contactNumber} />
              </CardContent>
            </Card>
            <LogoUploadCard supplier={supplier} />
          </div>
        </TabsContent>

        <TabsContent value="template">
          <TemplatePanel supplier={supplier} templates={templates} />
        </TabsContent>

        <TabsContent value="invoices">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1">
                <p className="text-sm text-muted-foreground">
                  Next number: {sequence.prefix}
                  {String(sequence.nextNumber).padStart(sequence.padding, '0')}
                </p>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7"
                  onClick={() => setSequenceOpen(true)}
                  aria-label="Edit invoice numbering"
                >
                  <Settings2 className="h-4 w-4" />
                </Button>
              </div>
              <Button type="button" onClick={() => setInvoiceOpen(true)} disabled={!activeTemplate}>
                <Plus className="h-4 w-4 mr-1" /> New Invoice
              </Button>
            </div>
            <InvoiceList supplier={supplier} invoices={invoices} templates={templates} />
          </div>
        </TabsContent>
      </Tabs>

      <SupplierFormDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        supplier={supplier}
        onSubmit={handleEditSubmit}
        isSubmitting={updateSupplier.isPending}
      />
      <InvoiceFormDialog
        open={invoiceOpen}
        onOpenChange={setInvoiceOpen}
        supplier={supplier}
        activeTemplate={activeTemplate}
        sequence={sequence}
      />
      <SequenceDialog
        open={sequenceOpen}
        onOpenChange={setSequenceOpen}
        supplierId={supplierId}
        sequence={sequence}
      />
    </div>
  );
}

/** Edit the invoice-number sequence (prefix, next number, zero padding). */
function SequenceDialog({
  open,
  onOpenChange,
  supplierId,
  sequence,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  supplierId: string;
  sequence: SupplierInvoiceSequence;
}) {
  const updateSequence = useUpdateSequence();
  const [prefix, setPrefix] = useState(sequence.prefix);
  const [nextNumber, setNextNumber] = useState(sequence.nextNumber);
  const [padding, setPadding] = useState(sequence.padding);

  useEffect(() => {
    if (open) {
      setPrefix(sequence.prefix);
      setNextNumber(sequence.nextNumber);
      setPadding(sequence.padding);
    }
  }, [open, sequence]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateSequence.mutate(
      { supplierId, sequence: { prefix, nextNumber, padding } },
      { onSuccess: () => onOpenChange(false) },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Invoice Numbering</DialogTitle>
          <DialogDescription>
            Next auto-assigned number: {prefix}
            {String(Math.max(1, Math.floor(nextNumber) || 1)).padStart(padding, '0')}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="seq-prefix">Prefix</Label>
            <Input id="seq-prefix" value={prefix} onChange={(e) => setPrefix(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="seq-next">Next Number</Label>
              <Input
                id="seq-next"
                type="number"
                min={1}
                value={nextNumber}
                onChange={(e) => setNextNumber(Number(e.target.value))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="seq-padding">Digits</Label>
              <Input
                id="seq-padding"
                type="number"
                min={1}
                max={10}
                value={padding}
                onChange={(e) => setPadding(Number(e.target.value))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={updateSequence.isPending}>
              {updateSequence.isPending ? 'Saving…' : 'Save'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function DetailRow({
  label,
  value,
  multiline,
}: {
  label: string;
  value: string;
  multiline?: boolean;
}) {
  return (
    <div className="flex gap-3">
      <span className="w-40 shrink-0 text-muted-foreground">{label}</span>
      <span className={multiline ? 'whitespace-pre-line' : ''}>{value || '—'}</span>
    </div>
  );
}
