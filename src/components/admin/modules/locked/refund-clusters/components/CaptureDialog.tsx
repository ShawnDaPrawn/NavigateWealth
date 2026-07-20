/**
 * CaptureDialog — AI capture of a received supplier invoice.
 *
 * Upload a PDF/photo → the AI extracts supplier, invoice number, date, total
 * and VAT into a pre-filled draft (matched against the Suppliers directory) →
 * the operator confirms/edits → the transaction is created with the document
 * attached as its tax_invoice evidence. Cancelling discards the upload.
 * Nothing reaches the ledger without explicit confirmation.
 */

import { useMemo, useState } from 'react';
import { ScanLine, Upload } from 'lucide-react';
import { toast } from 'sonner';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../../../ui/select';
import { ALLOWED_FILE_ACCEPT, CATEGORY_OPTIONS, MAX_FILE_BYTES } from '../constants';
import { matchSupplier } from '../capture';
import {
  useCaptureInvoice,
  useCreateTransactionFromCapture,
  useDiscardCapture,
} from '../hooks/useRefundClusters';
import { useSuppliers } from '../../suppliers/hooks/useSuppliers';
import { formatZar } from '../vat';
import type { CaptureResponse, RefundTransactionInput } from '../types';

const todayIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

interface CaptureDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clusterId: string;
  entityId: string;
  /** References already captured in the ledger, for a duplicate warning. */
  existingReferences: Set<string>;
}

export function CaptureDialog({
  open,
  onOpenChange,
  clusterId,
  entityId,
  existingReferences,
}: CaptureDialogProps) {
  const capture = useCaptureInvoice();
  const createFromCapture = useCreateTransactionFromCapture();
  const discard = useDiscardCapture();
  const { data: suppliers = [] } = useSuppliers();

  const [result, setResult] = useState<CaptureResponse | null>(null);
  const [supplierId, setSupplierId] = useState('');
  const [date, setDate] = useState(todayIso());
  const [reference, setReference] = useState('');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [vatAmount, setVatAmount] = useState('');
  const [category, setCategory] = useState('');

  const reset = () => {
    setResult(null);
    setSupplierId('');
    setDate(todayIso());
    setReference('');
    setDescription('');
    setAmount('');
    setVatAmount('');
    setCategory('');
  };

  const close = (openState: boolean) => {
    if (!openState && result) {
      // Draft abandoned — clean up the uploaded file.
      discard.mutate({ clusterId, entityId, storagePath: result.upload.storagePath });
    }
    if (!openState) reset();
    onOpenChange(openState);
  };

  const handleFile = (file: File | undefined) => {
    if (!file) return;
    if (file.size > MAX_FILE_BYTES) {
      toast.error('File too large', { description: 'The maximum file size is 10MB.' });
      return;
    }
    capture.mutate(
      { clusterId, entityId, file },
      {
        onSuccess: (data) => {
          setResult(data);
          const matched = matchSupplier(data.extraction, suppliers);
          setSupplierId(matched?.id ?? '');
          setDate(data.extraction.invoiceDate || todayIso());
          setReference(data.extraction.invoiceNumber);
          setDescription(
            data.extraction.description ||
              (data.extraction.supplierName ? `Invoice — ${data.extraction.supplierName}` : ''),
          );
          setAmount(data.extraction.total ? String(data.extraction.total) : '');
          setVatAmount(data.extraction.vatAmount ? String(data.extraction.vatAmount) : '');
        },
      },
    );
  };

  const matchedSupplier = suppliers.find((s) => s.id === supplierId) ?? null;
  const duplicateWarning = useMemo(() => {
    const ref = reference.trim().toLowerCase();
    return ref !== '' && existingReferences.has(ref);
  }, [reference, existingReferences]);

  const amountNum = Number(amount) || 0;
  const canSave = Boolean(result && amountNum > 0 && date);

  const handleSave = () => {
    if (!result || !canSave) return;
    const vatNum = Number(vatAmount) || 0;
    const txn: RefundTransactionInput = {
      date,
      description: description.trim(),
      direction: 'expense',
      vatTreatment: vatNum > 0 ? 'standard' : 'zero_rated',
      amount: amountNum,
      vatAmount: vatNum,
      counterparty: matchedSupplier
        ? { kind: 'supplier', id: matchedSupplier.id, name: matchedSupplier.name }
        : result.extraction.supplierName
          ? { kind: 'other', name: result.extraction.supplierName }
          : null,
      category: category || null,
      reference: reference.trim() || null,
      payment: { status: 'unpaid' },
    };
    createFromCapture.mutate(
      { clusterId, entityId, txn, upload: result.upload },
      {
        onSuccess: () => {
          reset();
          onOpenChange(false);
        },
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Capture Invoice from Document</DialogTitle>
          <DialogDescription>
            Upload a received supplier invoice (PDF or photo). The AI pre-fills the entry; nothing
            is saved until you confirm. The document is attached as the tax-invoice evidence.
          </DialogDescription>
        </DialogHeader>

        {!result ? (
          <div className="border-2 border-dashed rounded-lg p-8 text-center space-y-3">
            <ScanLine className="h-8 w-8 mx-auto text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              {capture.isPending
                ? 'Reading the document — this can take up to a minute…'
                : 'PDF, JPEG or PNG up to 10MB. The file is sent to the AI provider for reading.'}
            </p>
            <label className="inline-flex">
              <input
                type="file"
                accept={ALLOWED_FILE_ACCEPT}
                className="hidden"
                onChange={(e) => {
                  handleFile(e.target.files?.[0]);
                  e.target.value = '';
                }}
                aria-label="Upload invoice document"
              />
              <Button type="button" disabled={capture.isPending} asChild>
                <span className="cursor-pointer">
                  <Upload className="h-4 w-4 mr-2" />
                  {capture.isPending ? 'Reading…' : 'Choose Document'}
                </span>
              </Button>
            </label>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span>
                Read confidence: {Math.round(result.extraction.confidence * 100)}% ·{' '}
                {result.upload.fileName}
              </span>
            </div>
            {result.extraction.notes ? (
              <p className="text-xs text-amber-700 border-l-2 border-amber-400 pl-2">
                {result.extraction.notes}
              </p>
            ) : null}
            {duplicateWarning ? (
              <p className="text-xs text-red-700 border-l-2 border-red-400 pl-2">
                A transaction with this reference already exists in the ledger — this may be a
                duplicate claim.
              </p>
            ) : null}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="cap-supplier">Supplier</Label>
                <Select
                  value={supplierId || 'none'}
                  onValueChange={(v) => setSupplierId(v === 'none' ? '' : v)}
                >
                  <SelectTrigger id="cap-supplier">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">
                      {result.extraction.supplierName
                        ? `Unlinked — "${result.extraction.supplierName}"`
                        : 'No supplier link'}
                    </SelectItem>
                    {suppliers.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {result.extraction.supplierVatNumber &&
                matchedSupplier &&
                matchedSupplier.vatNumber.replace(/[^\d]/g, '') !==
                  result.extraction.supplierVatNumber ? (
                  <p className="text-xs text-amber-700">
                    Document VAT no {result.extraction.supplierVatNumber} differs from the linked
                    supplier&apos;s ({matchedSupplier.vatNumber}).
                  </p>
                ) : null}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cap-date">Invoice date</Label>
                <Input
                  id="cap-date"
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cap-ref">Reference (their invoice no.)</Label>
                <Input
                  id="cap-ref"
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="cap-desc">Description</Label>
                <Input
                  id="cap-desc"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cap-amount">Total (incl. VAT)</Label>
                <Input
                  id="cap-amount"
                  type="number"
                  step="0.01"
                  min="0"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cap-vat">VAT amount</Label>
                <Input
                  id="cap-vat"
                  type="number"
                  step="0.01"
                  min="0"
                  value={vatAmount}
                  onChange={(e) => setVatAmount(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  {Number(vatAmount) > 0
                    ? `Standard-rated input · ${formatZar(Number(vatAmount) || 0)} claimable`
                    : 'No VAT — recorded as zero-rated'}
                </p>
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="cap-category">Category</Label>
                <Select value={category || undefined} onValueChange={setCategory}>
                  <SelectTrigger id="cap-category">
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
            </div>
          </div>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => close(false)}>
            Cancel
          </Button>
          {result ? (
            <Button
              type="button"
              onClick={handleSave}
              disabled={!canSave || createFromCapture.isPending}
            >
              {createFromCapture.isPending ? 'Saving…' : 'Create Transaction'}
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
