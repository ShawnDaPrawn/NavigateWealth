/**
 * SupplierDetailView — Profile · Template · Invoices sub-tabs for one
 * supplier. The wizard gating mirrors the capture flow: the Template tab needs
 * a saved profile (always true here) and the Invoices tab needs an active
 * template.
 */

import { useMemo, useState } from 'react';
import { ArrowLeft, Pencil, Plus, Trash2 } from 'lucide-react';
import { Badge } from '../../../../../ui/badge';
import { Button } from '../../../../../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../../../../ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../../../../ui/tabs';
import {
  useDeleteSupplier,
  useSupplierDetail,
  useSupplierInvoices,
  useUpdateSupplier,
} from '../hooks/useSuppliers';
import type { SupplierInput } from '../types';
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
              <p className="text-sm text-muted-foreground">
                Next number: {sequence.prefix}
                {String(sequence.nextNumber).padStart(sequence.padding, '0')}
              </p>
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
    </div>
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
