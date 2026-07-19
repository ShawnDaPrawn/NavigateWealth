/**
 * Transactions ledger for a refund entity.
 *
 * Shows the current-period VAT summary (output vs input → net position) and a
 * table of income/expense transactions with their VAT portion, counterparty,
 * payment status, multi-file evidence (tax invoices, proof of payment, …) and
 * server-computed SARS-readiness flags. The current period is derived from
 * the cluster's VAT category (passed in as `vatPeriod`), and any period can
 * be exported as a SARS submission pack (ZIP).
 */

import { useEffect, useMemo, useState } from 'react';
import {
  Check,
  Download,
  ExternalLink,
  Pencil,
  Plus,
  ShieldAlert,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
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
  ATTACHMENT_KIND_OPTIONS,
  attachmentKindShort,
  CATEGORY_OPTIONS,
  DIRECTION_LABELS,
  MAX_FILE_BYTES,
  PAYMENT_STATUS_OPTIONS,
  VAT_TREATMENT_OPTIONS,
} from '../constants';
import { entityDisplayName } from '../formState';
import { evidenceCompleteness, FLAG_LABELS, type TransactionFlag } from '../validation';
import {
  useCreateTransaction,
  useDeleteAttachment,
  useDeleteTransaction,
  useDownloadSubmissionPack,
  useEntityLedger,
  useSetAttachmentVerified,
  useUpdateTransaction,
  useUploadAttachment,
  useViewAttachment,
} from '../hooks/useRefundClusters';
import { useSuppliers } from '../../suppliers/hooks/useSuppliers';
import { PeriodStatusCard } from './PeriodStatusCard';
import {
  formatPeriodRange,
  formatZar,
  netVatLabel,
  recentVatPeriods,
  summarizeTransactions,
  vatFromInclusive,
} from '../vat';
import type {
  AttachmentKind,
  PaymentStatus,
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
  /** Tax-year-end month (1-12) for categories D & E; February by default. */
  vatYearEndMonth?: number;
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
  /** '' none · 'supplier:{id}' linked supplier · 'manual' free text. */
  counterpartyKey: string;
  counterpartyName: string;
  counterpartyKind: 'customer' | 'other';
  category: string;
  reference: string;
  paymentStatus: PaymentStatus;
  paidDate: string;
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
  counterpartyKey: '',
  counterpartyName: '',
  counterpartyKind: 'other',
  category: '',
  reference: '',
  paymentStatus: 'unpaid',
  paidDate: '',
});

function formFromTxn(txn: RefundTransaction): TxnFormState {
  const cp = txn.counterparty;
  return {
    id: txn.id,
    date: txn.date,
    description: txn.description,
    direction: txn.direction,
    vatTreatment: txn.vatTreatment,
    amount: String(txn.amount),
    vatOverride: txn.vatOverridden ? String(txn.vatAmount) : '',
    counterpartyKey: cp ? (cp.kind === 'supplier' && cp.id ? `supplier:${cp.id}` : 'manual') : '',
    counterpartyName: cp && cp.kind !== 'supplier' ? cp.name : '',
    counterpartyKind: cp?.kind === 'customer' ? 'customer' : 'other',
    category: txn.category ?? '',
    reference: txn.reference ?? '',
    paymentStatus: txn.payment?.status ?? 'unpaid',
    paidDate: txn.payment?.paidDate ?? '',
  };
}

export function EntityTransactionsDialog({
  open,
  onOpenChange,
  entity,
  vatPeriod,
  vatYearEndMonth,
}: EntityTransactionsDialogProps) {
  const clusterId = entity?.clusterId ?? '';
  const entityId = entity?.id ?? null;

  const { data: ledger, isLoading } = useEntityLedger(clusterId, open ? entityId : null);
  const transactions = useMemo(() => ledger?.transactions ?? [], [ledger]);
  const flags = useMemo(() => ledger?.flags ?? {}, [ledger]);
  const { data: suppliers = [] } = useSuppliers();
  const createTxn = useCreateTransaction();
  const updateTxn = useUpdateTransaction();
  const deleteTxn = useDeleteTransaction();
  const downloadPack = useDownloadSubmissionPack();

  const [form, setForm] = useState<TxnFormState>(emptyForm);
  const [formOpen, setFormOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<RefundTransaction | null>(null);
  const [periodOffset, setPeriodOffset] = useState(0);
  const [packConfirmOpen, setPackConfirmOpen] = useState(false);

  useEffect(() => {
    if (!open) {
      setForm(emptyForm());
      setFormOpen(false);
      setDeleteTarget(null);
      setPeriodOffset(0);
      setPackConfirmOpen(false);
    }
  }, [open, entity?.id]);

  // The current period plus several prior submission periods (empty when no
  // cluster category is set, in which case all transactions are shown).
  const periods = useMemo(
    () => recentVatPeriods(vatPeriod, 6, undefined, vatYearEndMonth),
    [vatPeriod, vatYearEndMonth],
  );
  const period = periods[periodOffset] ?? periods[0] ?? null;
  const visibleTransactions = useMemo(() => {
    if (!period) return transactions;
    return transactions.filter((t) => t.date >= period.start && t.date <= period.end);
  }, [transactions, period]);
  const summary = useMemo(
    () => summarizeTransactions(transactions, period),
    [transactions, period],
  );
  const periodFlags = useMemo(() => {
    const scoped: Record<string, TransactionFlag[]> = {};
    for (const t of visibleTransactions) {
      scoped[t.id] = (flags[t.id] ?? []) as TransactionFlag[];
    }
    return scoped;
  }, [visibleTransactions, flags]);
  const flaggedCount = useMemo(
    () => visibleTransactions.filter((t) => (periodFlags[t.id] ?? []).length > 0).length,
    [visibleTransactions, periodFlags],
  );
  const completeness = useMemo(() => evidenceCompleteness(periodFlags), [periodFlags]);

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
    let counterparty: RefundTransactionInput['counterparty'] = null;
    if (form.counterpartyKey.startsWith('supplier:')) {
      const supplierId = form.counterpartyKey.slice('supplier:'.length);
      const supplier = suppliers.find((s) => s.id === supplierId);
      if (supplier) counterparty = { kind: 'supplier', id: supplier.id, name: supplier.name };
    } else if (form.counterpartyKey === 'manual' && form.counterpartyName.trim()) {
      counterparty = { kind: form.counterpartyKind, name: form.counterpartyName.trim() };
    }
    const payload: RefundTransactionInput = {
      date: form.date || todayIso(),
      description: form.description.trim(),
      direction: form.direction,
      vatTreatment: form.vatTreatment,
      amount: amountNum,
      vatAmount: form.vatOverride.trim() !== '' ? Number(form.vatOverride) || 0 : undefined,
      counterparty,
      category: form.category || null,
      reference: form.reference.trim() || null,
      payment: {
        status: form.paymentStatus,
        paidDate: form.paymentStatus === 'unpaid' ? undefined : form.paidDate || undefined,
      },
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

  const handleDownloadPack = () => {
    if (!period) return;
    setPackConfirmOpen(false);
    downloadPack.mutate({
      clusterId,
      entityId: entity.id,
      periodStart: period.start,
      periodEnd: period.end,
      periodLabel: `${period.label} (Category ${vatPeriod || '—'})`,
    });
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-5xl max-h-[88vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Transactions — {entityDisplayName(entity)}</DialogTitle>
            <DialogDescription>
              {period
                ? `VAT period: ${formatPeriodRange(period)} (category from the cluster).`
                : 'Set the cluster VAT category to scope a period — showing all transactions.'}
            </DialogDescription>
          </DialogHeader>

          <VatSummaryPanel summary={summary} />

          {period && (
            <PeriodStatusCard
              clusterId={clusterId}
              entityId={entity.id}
              period={period}
              transactions={visibleTransactions}
            />
          )}

          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
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
              {visibleTransactions.length > 0 && (
                <Badge variant={flaggedCount === 0 ? 'secondary' : 'destructive'}>
                  {flaggedCount === 0
                    ? 'Evidence complete'
                    : `${Math.round(completeness * 100)}% evidenced · ${flaggedCount} flagged`}
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2">
              {period && (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={downloadPack.isPending || visibleTransactions.length === 0}
                  onClick={() =>
                    flaggedCount > 0 ? setPackConfirmOpen(true) : handleDownloadPack()
                  }
                >
                  <Download className="h-4 w-4 mr-1" />
                  {downloadPack.isPending ? 'Generating…' : 'Submission Pack'}
                </Button>
              )}
              <Button size="sm" onClick={openCreate}>
                <Plus className="h-4 w-4 mr-1" /> Add Transaction
              </Button>
            </div>
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
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
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
                <div className="space-y-1.5">
                  <Label htmlFor="txn-category">Category</Label>
                  <Select
                    value={form.category || undefined}
                    onValueChange={(v) => patch({ category: v })}
                  >
                    <SelectTrigger id="txn-category">
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORY_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="txn-counterparty">Counterparty</Label>
                  <Select
                    value={form.counterpartyKey || 'none'}
                    onValueChange={(v) => patch({ counterpartyKey: v === 'none' ? '' : v })}
                  >
                    <SelectTrigger id="txn-counterparty">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {suppliers.map((s) => (
                        <SelectItem key={s.id} value={`supplier:${s.id}`}>
                          {s.name} (supplier)
                        </SelectItem>
                      ))}
                      <SelectItem value="manual">Other (enter manually)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {form.counterpartyKey === 'manual' && (
                  <>
                    <div className="space-y-1.5">
                      <Label htmlFor="txn-cp-name">Counterparty name</Label>
                      <Input
                        id="txn-cp-name"
                        value={form.counterpartyName}
                        onChange={(e) => patch({ counterpartyName: e.target.value })}
                        placeholder="Name"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="txn-cp-kind">Counterparty type</Label>
                      <Select
                        value={form.counterpartyKind}
                        onValueChange={(v) =>
                          patch({ counterpartyKind: v as 'customer' | 'other' })
                        }
                      >
                        <SelectTrigger id="txn-cp-kind">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="customer">Customer</SelectItem>
                          <SelectItem value="other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </>
                )}
                <div className="space-y-1.5">
                  <Label htmlFor="txn-reference">Reference (their invoice no.)</Label>
                  <Input
                    id="txn-reference"
                    value={form.reference}
                    onChange={(e) => patch({ reference: e.target.value })}
                    placeholder="e.g. INV-1234"
                  />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="txn-description">Description</Label>
                  <Input
                    id="txn-description"
                    value={form.description}
                    onChange={(e) => patch({ description: e.target.value })}
                    placeholder="e.g. Site works — July"
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
                <div className="space-y-1.5">
                  <Label htmlFor="txn-payment">Payment status</Label>
                  <Select
                    value={form.paymentStatus}
                    onValueChange={(v) => patch({ paymentStatus: v as PaymentStatus })}
                  >
                    <SelectTrigger id="txn-payment">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PAYMENT_STATUS_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {form.paymentStatus !== 'unpaid' && (
                  <div className="space-y-1.5">
                    <Label htmlFor="txn-paid-date">Paid date</Label>
                    <Input
                      id="txn-paid-date"
                      type="date"
                      value={form.paidDate}
                      onChange={(e) => patch({ paidDate: e.target.value })}
                    />
                  </div>
                )}
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
                    <TableHead>Counterparty</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead className="text-right">VAT</TableHead>
                    <TableHead>Evidence</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visibleTransactions.map((txn) => (
                    <TableRow key={txn.id}>
                      <TableCell className="whitespace-nowrap align-top">{txn.date}</TableCell>
                      <TableCell className="max-w-[140px] truncate align-top">
                        {txn.counterparty?.name ?? '—'}
                        {txn.reference ? (
                          <span className="block text-xs text-muted-foreground truncate">
                            {txn.reference}
                          </span>
                        ) : null}
                      </TableCell>
                      <TableCell className="max-w-[160px] truncate align-top">
                        {txn.description || '—'}
                      </TableCell>
                      <TableCell className="align-top">
                        <Badge variant={txn.direction === 'income' ? 'secondary' : 'outline'}>
                          {DIRECTION_LABELS[txn.direction]}
                        </Badge>
                        {txn.payment?.status === 'paid' ? (
                          <span className="block text-xs text-green-700 mt-0.5">Paid</span>
                        ) : txn.payment?.status === 'partial' ? (
                          <span className="block text-xs text-amber-700 mt-0.5">Partial</span>
                        ) : null}
                      </TableCell>
                      <TableCell className="text-right whitespace-nowrap align-top">
                        {formatZar(txn.amount)}
                      </TableCell>
                      <TableCell className="text-right whitespace-nowrap align-top">
                        {formatZar(txn.vatAmount)}
                      </TableCell>
                      <TableCell className="align-top">
                        <EvidenceCell
                          clusterId={clusterId}
                          entityId={entity.id}
                          txn={txn}
                          flags={(flags[txn.id] ?? []) as TransactionFlag[]}
                        />
                      </TableCell>
                      <TableCell className="text-right whitespace-nowrap align-top">
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
                ].toLowerCase()} of ${formatZar(deleteTarget.amount)} and its evidence files will be permanently deleted. This action is audit-logged.`}
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

      <AlertDialog open={packConfirmOpen} onOpenChange={setPackConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              <ShieldAlert className="h-5 w-5 inline mr-1 text-amber-600" />
              {flaggedCount} transaction{flaggedCount === 1 ? '' : 's'} missing evidence
            </AlertDialogTitle>
            <AlertDialogDescription>
              The pack will include a Missing Evidence checklist listing each gap. SARS routinely
              disallows input claims without valid tax invoices — fixing the gaps before submitting
              is strongly recommended. Generate anyway?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Fix first</AlertDialogCancel>
            <AlertDialogAction onClick={handleDownloadPack}>Generate anyway</AlertDialogAction>
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

/**
 * Evidence chips per transaction: view/verify/delete each attachment, add new
 * ones by kind, and surface the SARS-readiness flags.
 */
function EvidenceCell({
  clusterId,
  entityId,
  txn,
  flags,
}: {
  clusterId: string;
  entityId: string;
  txn: RefundTransaction;
  flags: TransactionFlag[];
}) {
  const upload = useUploadAttachment();
  const remove = useDeleteAttachment();
  const view = useViewAttachment();
  const verify = useSetAttachmentVerified();
  const [addKind, setAddKind] = useState<AttachmentKind>('tax_invoice');
  const attachments = txn.attachments ?? [];

  const handleView = (attId: string) => {
    const win = window.open('about:blank', '_blank');
    view.mutate(
      { clusterId, entityId, txnId: txn.id, attId },
      {
        onSuccess: (url) => {
          if (win) win.location.href = url;
          else window.open(url, '_blank', 'noopener,noreferrer');
        },
        onError: () => win?.close(),
      },
    );
  };

  const handleUpload = (file: File | undefined) => {
    if (!file) return;
    if (file.size > MAX_FILE_BYTES) {
      toast.error('File too large', { description: 'The maximum file size is 10MB.' });
      return;
    }
    upload.mutate({ clusterId, entityId, txnId: txn.id, kind: addKind, file });
  };

  const needsFullVerification = txn.direction === 'expense' && txn.amount > 5000;

  return (
    <div className="space-y-1 min-w-[170px]">
      <div className="flex flex-wrap gap-1">
        {attachments.map((att) => (
          <span
            key={att.id}
            className="inline-flex items-center gap-0.5 rounded border px-1 py-0.5 text-xs bg-background"
            title={`${att.fileName}${att.verifiedFull ? ' (full invoice verified)' : ''}`}
          >
            <button
              type="button"
              className="inline-flex items-center gap-0.5 hover:underline"
              onClick={() => handleView(att.id)}
              aria-label={`View ${att.kind} ${att.fileName}`}
            >
              {attachmentKindShort(att.kind)}
              <ExternalLink className="h-3 w-3" />
            </button>
            {att.kind === 'tax_invoice' && needsFullVerification ? (
              <button
                type="button"
                className={att.verifiedFull ? 'text-green-700' : 'text-muted-foreground'}
                title={
                  att.verifiedFull
                    ? 'Full tax invoice verified'
                    : 'Mark as verified FULL tax invoice (required over R5,000)'
                }
                aria-label="Toggle full tax invoice verification"
                onClick={() =>
                  verify.mutate({
                    clusterId,
                    entityId,
                    txnId: txn.id,
                    attId: att.id,
                    verifiedFull: !att.verifiedFull,
                  })
                }
              >
                <Check className="h-3 w-3" />
              </button>
            ) : null}
            <button
              type="button"
              className="text-destructive"
              aria-label={`Delete ${att.kind}`}
              onClick={() => remove.mutate({ clusterId, entityId, txnId: txn.id, attId: att.id })}
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
      </div>
      <div className="flex items-center gap-1">
        <Select value={addKind} onValueChange={(v) => setAddKind(v as AttachmentKind)}>
          <SelectTrigger className="h-7 w-[92px] text-xs" aria-label="Evidence kind">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ATTACHMENT_KIND_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <label className="inline-flex">
          <input
            type="file"
            accept={ALLOWED_FILE_ACCEPT}
            className="hidden"
            onChange={(e) => {
              handleUpload(e.target.files?.[0]);
              e.target.value = '';
            }}
            aria-label="Upload evidence"
          />
          <Button type="button" size="sm" variant="outline" disabled={upload.isPending} asChild>
            <span className="cursor-pointer h-7 px-2">
              <Upload className="h-3 w-3" />
            </span>
          </Button>
        </label>
      </div>
      {flags.length > 0 && (
        <div className="space-y-0.5">
          {flags.map((flag) => (
            <p
              key={flag}
              className="text-xs text-amber-700 leading-tight"
              title={FLAG_LABELS[flag]}
            >
              ⚠ {FLAG_LABELS[flag] ?? flag}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
