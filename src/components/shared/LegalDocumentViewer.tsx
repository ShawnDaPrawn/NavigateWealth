import React, { useState, useCallback, useRef } from 'react';
import DOMPurify from 'dompurify';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { Button } from '../ui/button';
import { Separator } from '../ui/separator';
import { FileText, Eye, Loader2, Printer } from 'lucide-react';
import { toast } from 'sonner@2.0.3';
import { projectId, publicAnonKey } from '../../utils/supabase/info';
import { BASE_PDF_CSS } from '../admin/modules/resources/templates/BasePdfLayout';

// ============================================================================
// TYPES
// ============================================================================

interface LegalDocumentResponse {
  available: boolean;
  slug: string;
  document?: {
    id: string;
    title: string;
    description?: string;
    blocks: FormBlock[];
    version: string;
    updatedAt: string;
  };
}

type LegalDocument = LegalDocumentResponse['document'];

type FormBlock = {
  type: string;
  id?: string;
  data?: {
    number?: string;
    title?: string;
    content?: string;
    columns?: number;
    fields?: { label?: string; key?: string }[];
    signatories?: { label?: string; key?: string }[];
    hasColumnHeaders?: boolean;
    columnHeaders?: string[];
    hasRowHeaders?: boolean;
    rowHeaders?: string[];
    rows?: { id?: string; cells?: unknown[] }[];
    showDate?: boolean;
  };
};

// ============================================================================
// BLOCK RENDERER (read-only HTML for legal documents)
// ============================================================================

function LegalBlockRenderer({ blocks, title }: { blocks: FormBlock[]; title: string }) {
  return (
    <div className="max-w-4xl mx-auto p-8 bg-white text-gray-900 print:p-4">
      {/* Document header */}
      <div className="text-center mb-8 border-b border-gray-200 pb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">{title}</h1>
        <p className="text-sm text-gray-500">Navigate Wealth</p>
      </div>

      {/* Render each block */}
      {blocks.map((block: FormBlock, idx: number) => {
        switch (block.type) {
          case 'section_header':
            return (
              <div key={block.id || idx} className="mt-6 mb-3">
                <h2 className="text-lg font-bold text-gray-900 uppercase tracking-wide">
                  {block.data?.number ? `${block.data.number} ` : ''}
                  {block.data?.title || ''}
                </h2>
                <Separator className="mt-1" />
              </div>
            );

          case 'text':
            return (
              <div
                key={block.id || idx}
                className="mb-4 text-sm leading-relaxed text-gray-700 prose prose-sm max-w-none"
                dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(block.data?.content || '') }}
              />
            );

          case 'field_grid':
            return (
              <div
                key={block.id || idx}
                className="mb-4 grid gap-3"
                style={{ gridTemplateColumns: `repeat(${block.data?.columns || 2}, 1fr)` }}
              >
                {(block.data?.fields || []).map((field: { label?: string; key?: string }, fi: number) => (
                  <div key={fi} className="border border-gray-200 rounded p-2">
                    <span className="text-xs font-medium text-gray-500 block mb-1">
                      {field.label || `Field ${fi + 1}`}
                    </span>
                    <div className="h-6 border-b border-gray-300" />
                  </div>
                ))}
              </div>
            );

          case 'signature':
            return (
              <div key={block.id || idx} className="mb-4 mt-6 grid grid-cols-2 gap-8">
                {(block.data?.signatories || []).map((sig: { label?: string; key?: string }, si: number) => (
                  <div key={si} className="space-y-2">
                    <div className="h-16 border-b-2 border-gray-400" />
                    <p className="text-xs font-medium text-gray-600">{sig.label || 'Signature'}</p>
                    {block.data?.showDate && (
                      <div className="flex items-center gap-2 mt-2">
                        <span className="text-xs text-gray-500">Date:</span>
                        <div className="flex-1 border-b border-gray-300 h-4" />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            );

          case 'table':
            return (
              <div key={block.id || idx} className="mb-4 overflow-x-auto">
                <table className="w-full border-collapse border border-gray-300 text-sm">
                  {block.data?.hasColumnHeaders && (
                    <thead>
                      <tr className="bg-gray-100">
                        {block.data?.hasRowHeaders && <th className="border border-gray-300 p-2" />}
                        {(block.data?.columnHeaders || []).map((h: string, hi: number) => (
                          <th key={hi} className="border border-gray-300 p-2 text-left font-semibold text-gray-700">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                  )}
                  <tbody>
                    {(block.data?.rows || []).map((row: { id?: string; cells?: unknown[] }, ri: number) => (
                      <tr key={row.id || ri}>
                        {block.data?.hasRowHeaders && (
                          <td className="border border-gray-300 p-2 font-semibold text-gray-700 bg-gray-50">
                            {(block.data?.rowHeaders || [])[ri] || ''}
                          </td>
                        )}
                        {(row.cells || []).map((cell: { type?: string; value?: string }, ci: number) => (
                          <td key={ci} className="border border-gray-300 p-2 text-gray-600">
                            {cell.value || ''}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );

          case 'page_break':
            return (
              <div key={block.id || idx} className="my-6 border-t-2 border-dashed border-gray-300 print:break-before-page" />
            );

          default:
            return null;
        }
      })}

      {/* Footer */}
      <div className="mt-12 pt-4 border-t border-gray-200 text-center">
        <p className="text-xs text-gray-400">
          Navigate Wealth &bull; FSP No. 51816 &bull; Reg. No. 2021/218961/07
        </p>
      </div>
    </div>
  );
}

// ============================================================================
// PRINT HELPER
// ============================================================================

function printDocument(doc: NonNullable<LegalDocument>) {
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    toast.error('Pop-up blocked. Please allow pop-ups for this site.');
    return;
  }

  const displayDate = new Date().toLocaleDateString('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });

  const blocksHtml = (doc.blocks || []).map((block: FormBlock) => {
    switch (block.type) {
      case 'section_header':
        return `
          <div class="section">
            <div class="section-head">
              ${block.data?.number ? `<span class="num">${block.data.number}</span>` : ''}
              <h2>${block.data?.title || ''}</h2>
            </div>
          </div>`;

      case 'text':
        return `<div style="font-size:9.5px;line-height:1.6;margin-bottom:3mm;">${block.data?.content || ''}</div>`;

      case 'field_grid': {
        const cols = block.data?.columns || 2;
        const fieldArr = block.data?.fields || [];
        let rows = '';
        for (let i = 0; i < fieldArr.length; i += cols) {
          const rowCells = fieldArr.slice(i, i + cols).map((f: { label?: string }) => `
            <td style="border:1px solid var(--border);padding:5px 6px;vertical-align:top;width:${100 / cols}%;">
              <div style="font-size:8px;font-weight:700;color:#4b5563;margin-bottom:2px;">${f.label || ''}</div>
              <div class="field"></div>
            </td>`).join('');
          rows += `<tr>${rowCells}</tr>`;
        }
        return `<table style="width:100%;border-collapse:collapse;margin-bottom:3mm;">${rows}</table>`;
      }

      case 'signature': {
        const sigs = (block.data?.signatories || []).map((s: { label?: string }) => `
          <div style="flex:1;">
            <div class="signature-box" style="border:1px solid var(--border);border-radius:4px;margin-bottom:2mm;"></div>
            <div style="font-size:8.5px;font-weight:600;color:#4b5563;">${s.label || 'Signature'}</div>
            ${block.data?.showDate ? '<div style="margin-top:2mm;border-bottom:1px solid var(--border);font-size:8px;color:var(--muted);">Date: ____________________</div>' : ''}
          </div>`).join('');
        return `<div style="display:flex;gap:10mm;margin-top:6mm;margin-bottom:4mm;">${sigs}</div>`;
      }

      case 'table': {
        let thead = '';
        if (block.data?.hasColumnHeaders) {
          const ths = (block.data?.columnHeaders || []).map((h: string) =>
            `<th style="border:1px solid var(--border);padding:5px 6px;background:var(--soft);font-weight:700;color:#374151;text-align:left;font-size:9px;">${h}</th>`
          ).join('');
          thead = `<thead><tr>${block.data?.hasRowHeaders ? '<th style="border:1px solid var(--border);padding:5px 6px;background:var(--soft);"></th>' : ''}${ths}</tr></thead>`;
        }
        const tbody = (block.data?.rows || []).map((row: { cells?: unknown[] }, ri: number) => {
          const rh = block.data?.hasRowHeaders
            ? `<td style="border:1px solid var(--border);padding:5px 6px;background:var(--soft);font-weight:700;color:#374151;font-size:9px;">${(block.data?.rowHeaders || [])[ri] || ''}</td>`
            : '';
          const cells = (row.cells || []).map((c: { type?: string; value?: string }) =>
            `<td style="border:1px solid var(--border);padding:5px 6px;font-size:9px;">${c.value || ''}</td>`
          ).join('');
          return `<tr>${rh}${cells}</tr>`;
        }).join('');
        return `<table style="width:100%;border-collapse:collapse;margin-bottom:3mm;">${thead}<tbody>${tbody}</tbody></table>`;
      }

      case 'page_break':
        return '<div style="page-break-after:always;"></div>';

      default:
        return '';
    }
  }).join('\n');

  printWindow.document.write(`<!DOCTYPE html>
<html>
<head>
  <title>${doc.title} - Navigate Wealth</title>
  <style>${BASE_PDF_CSS}</style>
</head>
<body>
  <div class="pdf-preview-container">
    <div class="pdf-viewport">
      <div class="pdf-page">
        <div class="pdf-content">
          <div class="top-masthead">
            <div class="masthead-left">LEGAL DOCUMENT</div>
            <div class="masthead-right">
              <strong>Wealthfront (Pty) Ltd</strong> t/a Navigate Wealth &nbsp;|&nbsp; <strong>FSP 54606</strong><br/>
              Email: info@navigatewealth.co
            </div>
          </div>
          <header class="page-header-full">
            <div class="header-row">
              <div class="brand-block">
                <div class="logo">Navigate <span class="wealth">Wealth</span></div>
                <div class="brand-subline">Independent Financial Advisory Services</div>
              </div>
              <div class="doc-block">
                <h1 class="doc-title">${doc.title}</h1>
                <div class="meta-grid">
                  <div class="meta-k">Issue date</div>
                  <div class="meta-v">${displayDate}</div>
                  <div class="meta-k">Version</div>
                  <div class="meta-v">${doc.version || '1.0'}</div>
                </div>
              </div>
            </div>
          </header>
          <hr class="section-divider" style="border-top:2px solid #6b7280;margin:4mm 0 6mm 0;" />
          <main>
            ${blocksHtml}
          </main>
          <footer class="pdf-footer">
            <div class="footer-row">
              <div class="footer-page">Page 1 of 1</div>
              <div class="footer-text">
                Wealthfront (Pty) Ltd, trading as Navigate Wealth, is an Authorised Financial Services Provider - FSP 54606.
                Registration Number: 2024/071953/07. Located at Route 21 Corporate Park, 25 Sovereign Drive, Milestone Place A, Centurion, 0178.
                For inquiries, please contact us at Tel: (012) 667 2505.
              </div>
            </div>
          </footer>
        </div>
      </div>
    </div>
  </div>
</body>
</html>`);
  printWindow.document.close();

  setTimeout(() => {
    printWindow.print();
  }, 300);
}

// ============================================================================
// PUBLIC HOOK — useLegalDocumentViewer
// ============================================================================

const BASE_URL = `https://${projectId}.supabase.co/functions/v1/make-server-91ed8379`;

/**
 * Hook that provides legal document viewer state and handlers.
 * Returns the Dialog component to render plus a trigger function.
 */
export function useLegalDocumentViewer() {
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerLoading, setViewerLoading] = useState(false);
  const [viewerDocument, setViewerDocument] = useState<LegalDocument | null>(null);
  const [loadingSlug, setLoadingSlug] = useState<string | null>(null);

  const handleViewDocument = useCallback(async (slug: string) => {
    setLoadingSlug(slug);
    setViewerLoading(true);

    try {
      const res = await fetch(`${BASE_URL}/resources/legal/${slug}`, {
        headers: { Authorization: `Bearer ${publicAnonKey}` },
      });

      if (!res.ok) {
        throw new Error(`Failed to fetch document (${res.status})`);
      }

      const data: LegalDocumentResponse = await res.json();

      if (!data.available || !data.document) {
        toast.info('This document is not yet available. Please check back later.', {
          description: 'The compliance team is working on making this document available.',
        });
        return;
      }

      setViewerDocument(data.document);
      setViewerOpen(true);
    } catch (error) {
      console.error('Error fetching legal document:', error);
      toast.error('Unable to load document. Please try again later.');
    } finally {
      setViewerLoading(false);
      setLoadingSlug(null);
    }
  }, []);

  const handlePrint = useCallback(() => {
    if (!viewerDocument) return;
    printDocument(viewerDocument);
  }, [viewerDocument]);

  return {
    openDocument: handleViewDocument,
    loadingSlug,
    viewerOpen,
    setViewerOpen,
    viewerDocument,
    viewerLoading,
    handlePrint,
  };
}

// ============================================================================
// PUBLIC COMPONENT — LegalDocumentDialog
// ============================================================================

interface LegalDocumentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  document: LegalDocument | null;
  onPrint: () => void;
}

export function LegalDocumentDialog({
  open,
  onOpenChange,
  document,
  onPrint,
}: LegalDocumentDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] p-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-3 border-b bg-white sticky top-0 z-10">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-lg font-semibold text-gray-900 pr-8">
              {document?.title || 'Legal Document'}
            </DialogTitle>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={onPrint}
                className="gap-2 text-purple-600 border-purple-200 hover:bg-purple-50"
              >
                <Printer className="h-4 w-4" />
                Print / Save as PDF
              </Button>
            </div>
          </div>
          {document?.version && (
            <p className="text-xs text-gray-500 mt-1">
              Version {document.version}
            </p>
          )}
        </DialogHeader>
        <div className="overflow-y-auto max-h-[calc(90vh-100px)]">
          {document?.blocks && document.blocks.length > 0 ? (
            <LegalBlockRenderer
              blocks={document.blocks}
              title={document.title}
            />
          ) : (
            <div className="p-12 text-center text-gray-500">
              <FileText className="h-12 w-12 mx-auto mb-4 opacity-40" />
              <p className="font-medium">Document content not yet available</p>
              <p className="text-sm mt-1">The compliance team is preparing this document.</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}