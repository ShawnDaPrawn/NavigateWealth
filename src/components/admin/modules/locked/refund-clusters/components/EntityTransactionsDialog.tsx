/**
 * Transactions ledger for a refund entity.
 *
 * Shows the current-period VAT summary (output vs input → net position) and a
 * table of income/expense transactions with their VAT portion, plus add/edit,
 * delete and optional tax-invoice upload. The current period is derived from
 * the cluster's VAT category (passed in as `vatPeriod`).
 */

import { useEffect, useMemo, useState } from 'react';
import { ExternalLink, Pencil, Plus, Trash2, Upload, X } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '../../../../../ui/badge';
import { Button } from '../../../../../ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../../../../../ui/dialog';
import { Input } from '../../../../../ui/input';
import { Label } from '../../../../../ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../../../ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../../../../ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../../../../../ui/alert-dialog';
import {
  ALLOWED_FILE_ACCEPT,
  DIRECTION_LABELS,
  MAX_FILE_BYTES,
  VAT_TREATMENT_OPTIONS,
} from '../constants';
import { entityDisplayName } from '../formState';
import {
  useCreateTransaction,
  useDeleteTransaction,
  useDeleteTransactionInvoice,
  useEntityTransactions,
  useUpdateTransaction,
  useUploadTransactionInvoice,
  useViewTransactionInvoice,
} from '../hooks/useRefundClusters';
import {
  formatPeriodRange,
  formatZar,
  netVatLabel,
  recentVatPeriods,
  summarizeTransactions,
  vatFromInclusive,
} from '../vat';
import type {
  RefundEntity,
  RefundTransaction,
  RefundTransactionInput,
  TransactionDirection,
  VatPeriodCategory,
  VatTreatment,
} from '../types';

interface EntityTransactionsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entity: RefundEntity | null;
  vatPeriod: VatPeriodCategory | '';
}

interface TxnFormState {
  id: string | null;
  date: string;
  description: string;
  direction: TransactionDirection;
  vatTreatment: VatTreatment;
  amount: string;
  /** Empty string means "auto-calculate". */
  vatOverride: string;
}

const todayIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const emptyForm = (): TxnFormState => ({
  id: null,
  date: todayIso(),
  description: '',
  direction: 'expense',
  vatTreatment: 'standard',
  amount: '',
  vatOverride: '',
});

function formFromTxn(txn: RefundTransaction): TxnFormState {
  return {
    id: txn.id,
    date: txn.date,
    description: txn.description,
    direction: txn.direction,
    vatTreatment: txn.vatTreatment,
    amount: String(txn.amount),
    vatOverride: txn.vatOverridden ? String(txn.vatAmount) : '',
  };
}

export function EntityTransactionsDialog({
  open,
  onOpenChange,
  entity,
  vatPeriod,
}: EntityTransactionsDialogProps) {
  const clusterId = entity?.clusterId ?? '';
  const entityId = entity?.id ?? null;

  const { data: transactions = [], isLoading } = useEntityTransactions(
    clusterId,
    open ? entityId : null,
  );
  const createTxn = useCreateTransaction();
  const updateTxn = useUpdateTransaction();
  const deleteTxn = useDeleteTransaction();
  const uploadInvoice = useUploadTransactionInvoice();
  const deleteInvoice = useDeleteTransactionInvoice();
  const viewInvoice = useViewTransactionInvoice();

  const [form, setForm] = useState<TxnFormState>(emptyForm);
  const [formOpen, setFormOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<RefundTransaction | null>(null);
  const [periodOffset, setPeriodOffset] = useState(0);

  useEffect(() => {
    if (!open) {
      setForm(emptyForm());
      setFormOpen(false);
      setDeleteTarget(null);
      setPeriodOffset(0);
    }
  }, [open, entity?.id]);

  // The current period plus several prior submission periods (empty when no
  // cluster category is set, in which case all transactions are shown).
  const periods = useMemo(() => recentVatPeriods(vatPeriod, 6), [vatPeriod]);
  const period = periods[periodOffset] ?? periods[0] ?? null;
  const visibleTransactions = useMemo(() => {
    if (!period) return transactions;
    return transactions.filter((t) => t.date >= period.start && t.date <= period.end);
  }, [transactions, period]);
  const summary = useMemo(
    () => summarizeTransactions(transactions, period),
    [transactions, period],
  );

  if (!entity) return null;

  const patch = (changes: Partial<TxnFormState>) => setForm((prev) => ({ ...prev, ...changes }));

  const amountNum = Number(form.amount) || 0;
  const liveVat =
    form.vatOverride.trim() !== ''
      ? Number(form.vatOverride) || 0
      : vatFromInclusive(amountNum, form.vatTreatment);

  const openCreate = () => {
    setForm(emptyForm());
    setFormOpen(true);
  };
  const openEdit = (txn: RefundTransaction) => {
    setForm(formFromTxn(txn));
    setFormOpen(true);
  };

  const submitForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (amountNum <= 0) {
      toast.error('Amount must be greater than zero');
      return;
    }
    const payload: RefundTransactionInput = {
      date: form.date || todayIso(),
      description: form.description.trim(),
      direction: form.direction,
      vatTreatment: form.vatTreatment,
      amount: amountNum,
      vatAmount: form.vatOverride.trim() !== '' ? Number(form.vatOverride) || 0 : undefined,
    };
    if (form.id) {
      updateTxn.mutate(
        { clusterId, entityId: entity.id, txnId: form.id, txn: payload },
        { onSuccess: () => setFormOpen(false) },
      );
    } else {
      createTxn.mutate(
        { clusterId, entityId: entity.id, txn: payload },
        { onSuccess: () => setFormOpen(false) },
      );
    }
  };

  const handleViewInvoice = (txnId: string) => {
    const win = window.open('about:blank', '_blank');
    viewInvoice.mutate(
      { clusterId, entityId: entity.id, txnId },
      {
        onSuccess: (url) => {
          if (win) win.location.href = url;
          else window.open(url, '_blank', 'noopener,noreferrer');
        },
        onError: () => win?.close(),
      },
    );
  };

  const handleUploadInvoice = (txnId: string, file: File | undefined) => {
    if (!file) return;
    if (file.size > MAX_FILE_BYTES) {
      toast.error('File too large', { description: 'The maximum file size is 10MB.' });
      return;
    }
    uploadInvoice.mutate({ clusterId, entityId: entity.id, txnId, file });
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-4xl max-h-[88vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Transactions — {entityDisplayName(entity)}</DialogTitle>
            <DialogDescription>
              {period
                ? `VAT period: ${formatPeriodRange(period)} (category from the cluster).`
                : 'Set the cluster VAT category to scope a period — showing all transactions.'}
            </DialogDescription>
          </DialogHeader>

          <VatSummaryPanel summary={summary} />

          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold">Transactions</h3>
              {periods.length > 0 && (
                <Select
                  value={String(periodOffset)}
                  onValueChange={(v) => setPeriodOffset(Number(v))}
                >
                  <SelectTrigger className="w-auto min-w-[200px]" aria-label="VAT period">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {periods.map((p, i) => (
                      <SelectItem key={p.start} value={String(i)}>
                        {i === 0 ? 'Current' : i === 1 ? 'Previous' : `${i} periods ago`} ·{' '}
                        {p.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
            <Button size="sm" onClick={openCreate}>
              <Plus className="h-4 w-4 mr-1" /> Add Transaction
            </Button>
          </div>

          {formOpen && (
            <form
              onSubmit={submitForm}
              className="border rounded-lg p-4 space-y-4 bg-muted/30"
              aria-label={form.id ? 'Edit transaction' : 'Add transaction'}
            >
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-medium">
                  {form.id ? 'Edit transaction' : 'New transaction'}
                </h4>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label="Close form"
                  onClick={() => setFormOpen(false)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="txn-date">Date</Label>
                  <Input
                    id="txn-date"
                    type="date"
                    value={form.date}
                    onChange={(e) => patch({ date: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="txn-direction">Type</Label>
                  <Select
                    value={form.direction}
                    onValueChange={(v) => patch({ direction: v as TransactionDirection })}
                  >
                    <SelectTrigger id="txn-direction">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="income">Income (output VAT)</SelectItem>
                      <SelectItem value="expense">Expense (input VAT)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="txn-description">Description</Label>
                  <Input
                    id="txn-description"
                    value={form.description}
                    onChange={(e) => patch({ description: e.target.value })}
                    placeholder="e.g. Supplier invoice #1234"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="txn-amount">Amount (incl. VAT)</Label>
                  <Input
                    id="txn-amount"
                    type="number"
                    step="0.01"
                    min="0"
                    value={form.amount}
                    onChange={(e) => patch({ amount: e.target.value })}
                    placeholder="0.00"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="txn-treatment">VAT Treatment</Label>
                  <Select
                    value={form.vatTreatment}
                    onValueChange={(v) => patch({ vatTreatment: v as VatTreatment })}
                  >
                    <SelectTrigger id="txn-treatment">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {VAT_TREATMENT_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="txn-vat-override">VAT Amount (override)</Label>
                  <Input
                    id="txn-vat-override"
                    type="number"
                    step="0.01"
                    min="0"
                    value={form.vatOverride}
                    onChange={(e) => patch({ vatOverride: e.target.value })}
                    placeholder={`Auto: ${formatZar(vatFromInclusive(amountNum, form.vatTreatment))}`}
                  />
                </div>
                <div className="space-y-1.5 flex flex-col justify-end">
                  <span className="text-xs text-muted-foreground">VAT on this transaction</span>
                  <span className="font-medium">{formatZar(liveVat)}</span>
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setFormOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={createTxn.isPending || updateTxn.isPending}>
                  {createTxn.isPending || updateTxn.isPending
                    ? 'Saving…'
                    : form.id
                      ? 'Save Changes'
                      : 'Add Transaction'}
                </Button>
              </div>
            </form>
          )}

          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading transactions…</p>
          ) : transactions.length === 0 ? (
            <div className="border border-dashed rounded-lg p-8 text-center text-sm text-muted-foreground">
              No transactions yet. Click &quot;Add Transaction&quot; to record income or expenses.
            </div>
          ) : visibleTransactions.length === 0 ? (
            <div className="border border-dashed rounded-lg p-8 text-center text-sm text-muted-foreground">
              No transactions in this period. Choose another period above, or add one.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead className="text-right">VAT</TableHead>
                    <TableHead>Invoice</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visibleTransactions.map((txn) => (
                    <TableRow key={txn.id}>
                      <TableCell className="whitespace-nowrap">{txn.date}</TableCell>
                      <TableCell className="max-w-[200px] truncate">
                        {txn.description || '—'}
                      </TableCell>
                      <TableCell>
                        <Badge variant={txn.direction === 'income' ? 'secondary' : 'outline'}>
                          {DIRECTION_LABELS[txn.direction]}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right whitespace-nowrap">
                        {formatZar(txn.amount)}
                      </TableCell>
                      <TableCell className="text-right whitespace-nowrap">
                        {formatZar(txn.vatAmount)}
                      </TableCell>
                      <TableCell>
                        <InvoiceCell
                          txn={txn}
                          uploading={uploadInvoice.isPending}
                          onView={() => handleViewInvoice(txn.id)}
                          onUpload={(file) => handleUploadInvoice(txn.id, file)}
                          onDelete={() =>
                            deleteInvoice.mutate({ clusterId, entityId: entity.id, txnId: txn.id })
                          }
                        />
                      </TableCell>
                      <TableCell className="text-right whitespace-nowrap">
                        <Button
                          size="icon"
                          variant="ghost"
                          aria-label="Edit transaction"
                          onClick={() => openEdit(txn)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          aria-label="Delete transaction"
                          onClick={() => setDeleteTarget(txn)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete transaction?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget &&
                `This ${DIRECTION_LABELS[
                  deleteTarget.direction
                ].toLowerCase()} of ${formatZar(deleteTarget.amount)} and its invoice will be permanently deleted. This action is audit-logged.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteTarget) {
                  deleteTxn.mutate({ clusterId, entityId: entity.id, txnId: deleteTarget.id });
                }
                setDeleteTarget(null);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function VatSummaryPanel({ summary }: { summary: ReturnType<typeof summarizeTransactions> }) {
  const netClass =
    summary.status === 'refundable'
      ? 'text-green-700'
      : summary.status === 'payable'
        ? 'text-amber-700'
        : 'text-foreground';
  return (
    <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
      <SummaryCard label="Total Income" value={formatZar(summary.totalIncome)} />
      <SummaryCard
        label="Total Expenses"
        value={formatZar(summary.totalExpense)}
        hint={`incl. ${formatZar(summary.inputVat)} VAT`}
      />
      <SummaryCard label="Output VAT" value={formatZar(summary.outputVat)} hint="on income" />
      <SummaryCard label="Input VAT" value={formatZar(summary.inputVat)} hint="on expenses" />
      <div className="rounded-lg border p-3 bg-muted/30">
        <p className="text-xs text-muted-foreground">Net VAT (this period)</p>
        <p className={`text-lg font-semibold ${netClass}`}>{formatZar(summary.netVat)}</p>
        <p className={`text-xs font-medium ${netClass}`}>{netVatLabel(summary.status)}</p>
      </div>
    </div>
  );
}

function SummaryCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-lg border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-base font-semibold">{value}</p>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function InvoiceCell({
  txn,
  uploading,
  onView,
  onUpload,
  onDelete,
}: {
  txn: RefundTransaction;
  uploading: boolean;
  onView: () => void;
  onUpload: (file: File | undefined) => void;
  onDelete: () => void;
}) {
  if (txn.invoice) {
    return (
      <div className="flex items-center gap-1">
        <Button size="icon" variant="ghost" aria-label="View invoice" onClick={onView}>
          <ExternalLink className="h-4 w-4" />
        </Button>
        <Button size="icon" variant="ghost" aria-label="Delete invoice" onClick={onDelete}>
          <Trash2 className="h-4 w-4 text-destructive" />
        </Button>
      </div>
    );
  }
  return (
    <label className="inline-flex">
      <input
        type="file"
        accept={ALLOWED_FILE_ACCEPT}
        className="hidden"
        onChange={(e) => {
          onUpload(e.target.files?.[0]);
          e.target.value = '';
        }}
        aria-label="Upload invoice"
      />
      <Button type="button" size="sm" variant="outline" disabled={uploading} asChild>
        <span className="cursor-pointer">
          <Upload className="h-4 w-4 mr-1" /> Invoice
        </span>
      </Button>
    </label>
  );
}
