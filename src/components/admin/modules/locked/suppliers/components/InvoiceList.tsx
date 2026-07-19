/**
 * InvoiceList — saved invoices for a supplier.
 *
 * View/download renders the invoice through InvoicePreview with the template
 * version it was created with, then exports via the shared
 * exportPdfFromPreview (html2canvas + jsPDF) pipeline. When the invoice is
 * linked to a ledger transaction, the generated PDF can be attached to that
 * transaction as its supporting tax invoice.
 */

import { useMemo, useRef, useState } from 'react';
import { Download, Eye, Paperclip, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '../../../../../ui/badge';
import { Button } from '../../../../../ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../../../../ui/dialog';
import { exportPdfFromPreview } from '../../../resources/PdfTemplateViewer';
import { RefundClustersAPI } from '../../refund-clusters/api';
import { formatZar } from '../../refund-clusters/vat';
import { useDeleteInvoice, useSupplierLogoUrl } from '../hooks/useSuppliers';
import type { Supplier, SupplierInvoice, SupplierTemplate } from '../types';
import { InvoicePreview, type InvoicePreviewData } from './InvoicePreview';

interface InvoiceListProps {
  supplier: Supplier;
  invoices: SupplierInvoice[];
  templates: SupplierTemplate[];
}

function toPreviewData(invoice: SupplierInvoice): InvoicePreviewData {
  const billedTo = invoice.billedTo;
  return {
    invoiceNumber: invoice.invoiceNumber,
    invoiceDate: invoice.invoiceDate,
    dueDate: invoice.dueDate,
    billedToName: billedTo.kind === 'cluster_entity' ? billedTo.snapshot.name : billedTo.name,
    billedToVatNumber:
      billedTo.kind === 'cluster_entity' ? billedTo.snapshot.vatNumber : billedTo.vatNumber,
    billedToAddress:
      billedTo.kind === 'cluster_entity' ? billedTo.snapshot.address : billedTo.address,
    lineItems: invoice.lineItems,
    notes: invoice.notes || undefined,
  };
}

export function InvoiceList({ supplier, invoices, templates }: InvoiceListProps) {
  const [viewing, setViewing] = useState<SupplierInvoice | null>(null);
  const [exporting, setExporting] = useState(false);
  const [attaching, setAttaching] = useState(false);
  const previewRef = useRef<HTMLDivElement>(null);
  const deleteInvoice = useDeleteInvoice();
  const { data: logoUrl } = useSupplierLogoUrl(supplier.id, Boolean(supplier.logo));

  const viewingTemplate = useMemo(
    () => (viewing ? (templates.find((t) => t.id === viewing.templateId) ?? templates[0]) : null),
    [viewing, templates],
  );

  const handleDownload = async () => {
    if (!previewRef.current || !viewing) return;
    setExporting(true);
    try {
      await exportPdfFromPreview({
        root: previewRef.current,
        title: viewing.invoiceNumber,
        pageSize: 'A4',
        orientation: 'portrait',
      });
    } catch (error) {
      toast.error('PDF export failed', {
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      setExporting(false);
    }
  };

  /** Generate the PDF blob and attach it to the linked ledger transaction. */
  const handleAttachToLedger = async () => {
    if (!viewing?.ledgerTransactionId || viewing.billedTo.kind !== 'cluster_entity') return;
    if (!previewRef.current) return;
    setAttaching(true);
    try {
      const { blob } = await renderPreviewToPdfBlob(previewRef.current);
      const file = new File([blob], `${viewing.invoiceNumber}.pdf`, { type: 'application/pdf' });
      await RefundClustersAPI.uploadTransactionInvoice(
        viewing.billedTo.clusterId,
        viewing.billedTo.entityId,
        viewing.ledgerTransactionId,
        file,
      );
      toast.success('PDF attached to the ledger transaction');
    } catch (error) {
      toast.error('Failed to attach PDF', {
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      setAttaching(false);
    }
  };

  if (invoices.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-8 text-center">
        No invoices yet — create the first one above.
      </p>
    );
  }

  return (
    <>
      <div className="rounded-lg border divide-y">
        {invoices.map((invoice) => (
          <div key={invoice.id} className="flex flex-wrap items-center gap-3 p-3">
            <div className="min-w-32">
              <div className="font-medium">{invoice.invoiceNumber}</div>
              <div className="text-xs text-muted-foreground">{invoice.invoiceDate}</div>
            </div>
            <div className="flex-1 min-w-40 text-sm">
              {invoice.billedTo.kind === 'cluster_entity'
                ? invoice.billedTo.snapshot.name
                : invoice.billedTo.name}
            </div>
            <div className="text-sm font-medium">{formatZar(invoice.totals.total)}</div>
            <Badge variant={invoice.status === 'issued' ? 'default' : 'secondary'}>
              {invoice.status}
            </Badge>
            {invoice.ledgerTransactionId ? <Badge variant="outline">In ledger</Badge> : null}
            <div className="flex items-center gap-1 ml-auto">
              <Button
                type="button"
                size="icon"
                variant="ghost"
                onClick={() => setViewing(invoice)}
                aria-label={`View invoice ${invoice.invoiceNumber}`}
              >
                <Eye className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                disabled={deleteInvoice.isPending}
                onClick={() => {
                  if (window.confirm(`Delete invoice ${invoice.invoiceNumber}?`)) {
                    deleteInvoice.mutate({ supplierId: supplier.id, invoiceId: invoice.id });
                  }
                }}
                aria-label={`Delete invoice ${invoice.invoiceNumber}`}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      <Dialog open={!!viewing} onOpenChange={(open) => !open && setViewing(null)}>
        <DialogContent className="sm:max-w-4xl max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Invoice {viewing?.invoiceNumber}</DialogTitle>
            <DialogDescription>
              Rendered with template v{viewingTemplate?.version ?? '?'} — download as PDF or attach
              it to the linked ledger transaction.
            </DialogDescription>
          </DialogHeader>
          <div ref={previewRef} className="border rounded-lg bg-muted/20 p-3 overflow-auto">
            {viewing && viewingTemplate ? (
              <InvoicePreview
                spec={viewingTemplate.spec}
                supplier={supplier}
                data={toPreviewData(viewing)}
                logoUrl={logoUrl}
                scale={0.75}
              />
            ) : null}
          </div>
          <DialogFooter>
            {viewing?.ledgerTransactionId ? (
              <Button
                type="button"
                variant="outline"
                onClick={handleAttachToLedger}
                disabled={attaching || exporting}
              >
                <Paperclip className="h-4 w-4 mr-2" />
                {attaching ? 'Attaching…' : 'Attach PDF to Ledger'}
              </Button>
            ) : null}
            <Button type="button" onClick={handleDownload} disabled={exporting || attaching}>
              <Download className="h-4 w-4 mr-2" />
              {exporting ? 'Exporting…' : 'Download PDF'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

/**
 * Renders the preview pages to a PDF Blob with the same html2canvas + jsPDF
 * settings as exportPdfFromPreview (which only supports direct download).
 */
async function renderPreviewToPdfBlob(root: HTMLElement): Promise<{ blob: Blob }> {
  const container = root.querySelector<HTMLElement>('[data-pdf-export-root="true"]');
  const pages = Array.from((container ?? root).querySelectorAll<HTMLElement>('.pdf-page'));
  if (pages.length === 0) throw new Error('No invoice pages found to render');

  const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([
    import('html2canvas'),
    import('jspdf'),
  ]);
  if (document.fonts?.ready) await document.fonts.ready;

  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });
  for (let index = 0; index < pages.length; index += 1) {
    const page = pages[index];
    // Clone into an off-screen host at scale 1 so the inline preview scale
    // doesn't shrink the capture.
    const host = document.createElement('div');
    host.setAttribute('aria-hidden', 'true');
    host.style.position = 'fixed';
    host.style.left = '-100000px';
    host.style.top = '0';
    host.style.background = '#ffffff';
    const clone = page.cloneNode(true) as HTMLElement;
    clone.style.transform = 'none';
    clone.style.margin = '0';
    clone.style.boxShadow = 'none';
    host.appendChild(clone);
    document.body.appendChild(host);
    let canvas: HTMLCanvasElement;
    try {
      canvas = await html2canvas(clone, {
        backgroundColor: '#ffffff',
        scale: 300 / 96,
        useCORS: true,
        logging: false,
      });
    } finally {
      document.body.removeChild(host);
    }
    if (index > 0) pdf.addPage('a4', 'portrait');
    pdf.addImage(canvas.toDataURL('image/png', 1), 'PNG', 0, 0, 210, 297, undefined, 'SLOW');
  }
  return { blob: pdf.output('blob') };
}
