/**
 * SuppliersPanel — Locked → Suppliers tab root.
 *
 * Global directory of the VAT-registered providers/contractors that invoice
 * the refund-cluster entities. Card grid → drill into a supplier's
 * Profile / Invoice Standard / Invoices detail view.
 */

import { useState } from 'react';
import { Building2, FileCheck2, Plus } from 'lucide-react';
import { Badge } from '../../../../ui/badge';
import { Button } from '../../../../ui/button';
import { Card, CardContent } from '../../../../ui/card';
import { useCreateSupplier, useSuppliers } from './hooks/useSuppliers';
import type { SupplierInput } from './types';
import { SupplierFormDialog } from './components/SupplierFormDialog';
import { SupplierDetailView } from './components/SupplierDetailView';

export function SuppliersPanel() {
  const { data: suppliers = [], isLoading } = useSuppliers();
  const createSupplier = useCreateSupplier();
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  if (selectedId) {
    return <SupplierDetailView supplierId={selectedId} onBack={() => setSelectedId(null)} />;
  }

  const handleCreate = (values: SupplierInput) => {
    createSupplier.mutate(values, {
      onSuccess: (supplier) => {
        setCreateOpen(false);
        // Land on the new supplier so the logo/template capture continues.
        setSelectedId(supplier.id);
      },
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Suppliers</h2>
          <p className="text-sm text-muted-foreground">
            VAT-registered providers, suppliers and contractors that invoice your entities — the
            sources of input-tax deductions.
          </p>
        </div>
        <Button type="button" onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4 mr-1" /> Add Supplier
        </Button>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground py-8 text-center">Loading suppliers…</p>
      ) : suppliers.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center space-y-2">
            <Building2 className="h-8 w-8 mx-auto text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              No suppliers yet. Add one, upload its logo and an example invoice, and the AI will
              build its invoice standard.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {suppliers.map((supplier) => (
            <Card
              key={supplier.id}
              className="cursor-pointer hover:border-primary/50 transition-colors"
              onClick={() => setSelectedId(supplier.id)}
            >
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-medium truncate">{supplier.name}</div>
                    <div className="text-xs text-muted-foreground">
                      VAT {supplier.vatNumber || '—'}
                    </div>
                  </div>
                  {supplier.hasActiveTemplate ? (
                    <Badge variant="default" className="shrink-0">
                      <FileCheck2 className="h-3 w-3 mr-1" /> Template set
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="shrink-0">
                      No template
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  {supplier.industry ? <span>{supplier.industry}</span> : null}
                  <span className="ml-auto">
                    {supplier.invoiceCount ?? 0} invoice
                    {(supplier.invoiceCount ?? 0) === 1 ? '' : 's'}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <SupplierFormDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onSubmit={handleCreate}
        isSubmitting={createSupplier.isPending}
      />
    </div>
  );
}
