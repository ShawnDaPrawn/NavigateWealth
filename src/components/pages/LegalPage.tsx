import React, { useEffect, useState, useCallback, useRef } from 'react';
import { Link, useSearchParams, useLocation } from 'react-router';
import DOMPurify from 'dompurify';
import { SEO, createWebPageSchema } from '../seo/SEO';
import { getSEOData } from '../seo/seo-config';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Separator } from '../ui/separator';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { 
  FileText, 
  Shield, 
  Scale, 
  Archive,
  Mail,
  Phone,
  Eye,
  Loader2,
  Printer,
} from 'lucide-react';
import { toast } from 'sonner@2.0.3';
import { projectId, publicAnonKey } from '../../utils/supabase/info';
import { escapeHtmlText, navigateWealthPdfDocumentTitle } from '../../utils/pdfPrintTitle';
import { BASE_PDF_CSS } from '../admin/modules/resources/templates/BasePdfLayout';

// ============================================================================
// TYPES
// ============================================================================

/** Individual field in a field_grid block */
interface LegalBlockField {
  label?: string;
  key?: string;
  required?: boolean;
}

/** Signatory entry in a signature block */
interface LegalSignatory {
  label?: string;
}

/** Single cell in a table row */
interface LegalTableCell {
  value?: string;
}

/** Row in a table block */
interface LegalTableRow {
  id?: string;
  cells?: LegalTableCell[];
}

/** Block data payload — varies by block type */
interface LegalBlockData {
  number?: string;
  title?: string;
  content?: string;
  columns?: number;
  fields?: LegalBlockField[];
  signatories?: LegalSignatory[];
  showDate?: boolean;
  rows?: LegalTableRow[];
  hasColumnHeaders?: boolean;
  hasRowHeaders?: boolean;
  columnHeaders?: string[];
  rowHeaders?: string[];
}

/** Single content block in a legal document */
interface LegalBlock {
  id?: string;
  type: string;
  data?: LegalBlockData;
}

interface LegalDocument {
  name: string;
  id: string; // slug
}

interface LegalDocumentResponse {
  available: boolean;
  slug: string;
  document?: {
    id: string;
    title: string;
    description?: string;
    blocks: LegalBlock[];
    version: string;
    updatedAt: string;
  };
}

// ============================================================================
// SIMPLE BLOCK RENDERER (public-facing, no admin dependencies)
// Renders form builder blocks as read-only HTML for legal documents.
// ============================================================================

function LegalBlockRenderer({ blocks, title }: { blocks: LegalBlock[]; title: string }) {
  return (
    <div className="max-w-4xl mx-auto p-8 bg-white text-gray-900 print:p-4">
      {/* Document header */}
      <div className="text-center mb-8 border-b border-gray-200 pb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">{title}</h1>
        <p className="text-sm text-gray-500">Navigate Wealth</p>
      </div>

      {/* Render each block */}
      {blocks.map((block: LegalBlock, idx: number) => {
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
                {(block.data?.fields || []).map((field: LegalBlockField, fi: number) => (
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
                {(block.data?.signatories || []).map((sig: LegalSignatory, si: number) => (
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
                    {(block.data?.rows || []).map((row: LegalTableRow, ri: number) => (
                      <tr key={row.id || ri}>
                        {block.data?.hasRowHeaders && (
                          <td className="border border-gray-300 p-2 font-semibold text-gray-700 bg-gray-50">
                            {(block.data?.rowHeaders || [])[ri] || ''}
                          </td>
                        )}
                        {(row.cells || []).map((cell: LegalTableCell, ci: number) => (
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
          Wealthfront (Pty) Ltd t/a &ldquo;Navigate Wealth&rdquo; &bull; FSP No. 51816 &bull; Reg. No. 2021/218961/07
        </p>
      </div>
    </div>
  );
}

// ============================================================================
// LEGAL PAGE
// ============================================================================

const BASE_URL = `https://${projectId}.supabase.co/functions/v1/make-server-91ed8379`;

export function LegalPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();
  const [activeTab, setActiveTab] = useState('legal-notices');

  // Document viewer state
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerLoading, setViewerLoading] = useState(false);
  const [viewerDocument, setViewerDocument] = useState<LegalDocumentResponse['document'] | null>(null);
  const [loadingSlug, setLoadingSlug] = useState<string | null>(null);
  const printRef = useRef<HTMLDivElement>(null);

  // Valid tab values
  const validTabs = ['legal-notices', 'privacy-data-protection', 'regulatory-disclosures', 'other'];

  // Handle URL parameters for direct navigation
  useEffect(() => {
    const section = searchParams.get('section');
    if (section && validTabs.includes(section)) {
      setActiveTab(section);
    } else if (section) {
      setSearchParams({ section: 'legal-notices' });
      setActiveTab('legal-notices');
    } else {
      setActiveTab('legal-notices');
    }
  }, [searchParams, setSearchParams]);

  // Scroll to top when tab changes via URL
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [location.search]);

  const handleTabChange = (value: string) => {
    setActiveTab(value);
    setSearchParams({ section: value }, { replace: true });
  };

  /**
   * Fetch legal document content from the public API and open the viewer.
   */
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

  /**
   * Print/save as PDF the currently viewed document.
   * Uses the BasePdfLayout CSS and A4 page structure for professional output.
   */
  const handlePrint = useCallback(() => {
    if (!viewerDocument) return;

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

    // Render blocks as raw HTML for the print page
    const blocksHtml = (viewerDocument.blocks || []).map((block: LegalBlock) => {
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
          const fields = (block.data?.fields || []).map((f: LegalBlockField) => `
            <td style="border:1px solid var(--border);padding:5px 6px;vertical-align:top;">
              <div style="font-size:8px;font-weight:700;color:#4b5563;margin-bottom:2px;">${f.label || ''}</div>
              <div class="field"></div>
            </td>`).join('');
          // Wrap fields into rows of `cols` columns
          const fieldArr = block.data?.fields || [];
          let rows = '';
          for (let i = 0; i < fieldArr.length; i += cols) {
            const rowCells = fieldArr.slice(i, i + cols).map((f: LegalBlockField) => `
              <td style="border:1px solid var(--border);padding:5px 6px;vertical-align:top;width:${100/cols}%;">
                <div style="font-size:8px;font-weight:700;color:#4b5563;margin-bottom:2px;">${f.label || ''}</div>
                <div class="field"></div>
              </td>`).join('');
            rows += `<tr>${rowCells}</tr>`;
          }
          return `<table style="width:100%;border-collapse:collapse;margin-bottom:3mm;">${rows}</table>`;
        }

        case 'signature': {
          const sigs = (block.data?.signatories || []).map((s: LegalSignatory) => `
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
          const tbody = (block.data?.rows || []).map((row: LegalTableRow, ri: number) => {
            const rh = block.data?.hasRowHeaders
              ? `<td style="border:1px solid var(--border);padding:5px 6px;background:var(--soft);font-weight:700;color:#374151;font-size:9px;">${(block.data?.rowHeaders || [])[ri] || ''}</td>`
              : '';
            const cells = (row.cells || []).map((c: LegalTableCell) =>
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
  <title>${escapeHtmlText(navigateWealthPdfDocumentTitle(viewerDocument.title))}</title>
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
                <h1 class="doc-title">${viewerDocument.title}</h1>
                <div class="meta-grid">
                  <div class="meta-k">Issue date</div>
                  <div class="meta-v">${displayDate}</div>
                  <div class="meta-k">Version</div>
                  <div class="meta-v">${viewerDocument.version || '1.0'}</div>
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
                Wealthfront (Pty) Ltd, trading as Navigate Wealth, is an Authorised Financial Services Provider – FSP 54606.
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
  }, [viewerDocument]);

  // Document list component
  const DocumentList = ({ documents }: { documents: LegalDocument[] }) => (
    <div className="divide-y divide-gray-100">
      {documents.map((doc) => {
        return (
          <div 
            key={doc.id}
            className="flex items-center justify-between py-4 first:pt-0 last:pb-0 group hover:bg-gray-50/50 -mx-6 px-6 rounded-lg transition-colors"
          >
            <span className="text-gray-900 font-medium">{doc.name}</span>
            <div className="flex items-center gap-2 ml-4 shrink-0">
              <Button
                asChild
                variant="outline"
                size="sm"
                className="text-gray-600 hover:text-purple-600 hover:border-purple-200 hover:bg-purple-50"
              >
                <Link to={`/legal/${doc.id}`}>
                  <Eye className="h-4 w-4 mr-2" />
                  Read
                </Link>
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <SEO {...getSEOData('legal')} structuredData={createWebPageSchema(getSEOData('legal').title, getSEOData('legal').description, getSEOData('legal').canonicalUrl)} />
      <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Page Header */}
        <div className="text-center mb-12">
          <Badge className="bg-purple-100 text-purple-600 mb-6">
            Legal Information
          </Badge>
          <h1 className="text-black mb-6 font-bold text-[32px]">
            Legal & Compliance
          </h1>
          <p className="text-gray-600 max-w-3xl mx-auto text-lg">
            We are committed to transparency and regulatory compliance. Review our legal documents, privacy policies, and regulatory disclosures to understand 
            how we protect your interests and comply with financial services regulations.
          </p>
        </div>

        {/* Tabbed Content */}
        <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
          <TabsList className="grid w-full grid-cols-4 mb-8 bg-white border border-gray-200">
            <TabsTrigger 
              value="legal-notices" 
              className="flex items-center space-x-2 data-[state=active]:bg-purple-600 data-[state=active]:text-white"
            >
              <Scale className="h-4 w-4" />
              <span className="hidden sm:inline">Legal Notices</span>
              <span className="sm:hidden">Legal</span>
            </TabsTrigger>
            <TabsTrigger 
              value="privacy-data-protection"
              className="flex items-center space-x-2 data-[state=active]:bg-purple-600 data-[state=active]:text-white"
            >
              <Shield className="h-4 w-4" />
              <span className="hidden sm:inline">Privacy & Data</span>
              <span className="sm:hidden">Privacy</span>
            </TabsTrigger>
            <TabsTrigger 
              value="regulatory-disclosures"
              className="flex items-center space-x-2 data-[state=active]:bg-purple-600 data-[state=active]:text-white"
            >
              <FileText className="h-4 w-4" />
              <span className="hidden sm:inline">Regulatory</span>
              <span className="sm:hidden">Reg</span>
            </TabsTrigger>
            <TabsTrigger 
              value="other"
              className="flex items-center space-x-2 data-[state=active]:bg-purple-600 data-[state=active]:text-white"
            >
              <Archive className="h-4 w-4" />
              <span>Other</span>
            </TabsTrigger>
          </TabsList>

          {/* Legal Notices Tab */}
          <TabsContent value="legal-notices" className="space-y-6">
            <Card className="bg-white border-gray-200">
              <CardHeader>
                <div className="flex items-center space-x-3">
                  <Scale className="h-6 w-6 text-purple-600" />
                  <div>
                    <CardTitle className="text-black">Legal Notices</CardTitle>
                    <CardDescription>Terms of service and legal agreements</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <DocumentList documents={[
                  { name: 'Legal Conditions & Disclosures', id: 'legal-conditions' },
                  { name: 'Terms of Use', id: 'terms-of-use' },
                  { name: 'Website Disclaimer', id: 'website-disclaimer' },
                  { name: 'Whistleblowing Policy', id: 'whistleblowing-policy' }
                ]} />
              </CardContent>
            </Card>
          </TabsContent>

          {/* Privacy & Data Protection Tab */}
          <TabsContent value="privacy-data-protection" className="space-y-6">
            <Card className="bg-white border-gray-200">
              <CardHeader>
                <div className="flex items-center space-x-3">
                  <Shield className="h-6 w-6 text-purple-600" />
                  <div>
                    <CardTitle className="text-black">Privacy & Data Protection</CardTitle>
                    <CardDescription>How we collect, use, and protect your personal information</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <DocumentList documents={[
                  { name: 'Privacy Notice', id: 'privacy-notice' },
                  { name: 'POPIA and PAIA Manual', id: 'popia-paia-manual' },
                  { name: 'Data Protection Policy', id: 'data-protection-policy' },
                  { name: 'Cookie Policy', id: 'cookie-policy' },
                  { name: 'Data Processing Agreement', id: 'data-processing-agreement' }
                ]} />
                
                <div className="bg-purple-50 p-4 rounded-lg mt-6">
                  <h4 className="text-black mb-2">Contact Our Data Protection Officer</h4>
                  <div className="space-y-2 text-sm text-gray-600">
                    <div className="flex items-center">
                      <Mail className="h-4 w-4 mr-2" />
                      <span>info@navigatewealth.co</span>
                    </div>
                    <div className="flex items-center">
                      <Phone className="h-4 w-4 mr-2" />
                      <span>+27 (0) 12 667 2505</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Regulatory Disclosures Tab */}
          <TabsContent value="regulatory-disclosures" className="space-y-6">
            <Card className="bg-white border-gray-200">
              <CardHeader>
                <div className="flex items-center space-x-3">
                  <FileText className="h-6 w-6 text-purple-600" />
                  <div>
                    <CardTitle className="text-black">Regulatory Disclosures</CardTitle>
                    <CardDescription>Compliance information and regulatory requirements</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <DocumentList documents={[
                  { name: 'Conflict of Interest', id: 'conflict-of-interest' },
                  { name: 'FAIS Disclosure', id: 'fais-disclosure' },
                  { name: 'FSP License Information', id: 'fsp-license' },
                  { name: 'Risk Disclosures', id: 'risk-disclosures' },
                  { name: 'Complaints Procedure', id: 'complaints-procedure' },
                  { name: 'Regulatory Compliance Report', id: 'compliance-report' }
                ]} />
                
                <div className="bg-blue-50 p-4 rounded-lg mt-6">
                  <h4 className="text-black mb-2">Compliance Officer</h4>
                  <div className="space-y-2 text-sm text-gray-600">
                    <div className="flex items-center">
                      <Mail className="h-4 w-4 mr-2" />
                      <span>info@navigatewealth.co.za</span>
                    </div>
                    <div className="flex items-center">
                      <Phone className="h-4 w-4 mr-2" />
                      <span>+27 (0) 12 667 2505</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Other Tab */}
          <TabsContent value="other" className="space-y-6">
            <Card className="bg-white border-gray-200">
              <CardHeader>
                <div className="flex items-center space-x-3">
                  <Archive className="h-6 w-6 text-purple-600" />
                  <div>
                    <CardTitle className="text-black">Other Legal Information</CardTitle>
                    <CardDescription>Additional policies and legal notices</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <DocumentList documents={[
                  { name: 'PAIA Manual', id: 'paia-manual' },
                  { name: 'Disclaimers', id: 'disclaimers' },
                  { name: 'CIS Disclaimer', id: 'cis-disclaimer' },
                  { name: 'Third Party Services Policy', id: 'third-party-services' },
                  { name: 'Intellectual Property Notice', id: 'intellectual-property' },
                  { name: 'Anti-Money Laundering Policy', id: 'aml-policy' }
                ]} />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Contact Information */}
        <Card className="mt-8 bg-white border-gray-200">
          <CardContent className="pt-6">
            <div className="text-center">
              <h3 className="text-black mb-4">Need Legal Assistance?</h3>
              <p className="text-gray-600 mb-6">
                If you have questions about any of our legal documents or need clarification 
                on our policies, please don't hesitate to contact our legal team.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
                <div className="flex items-center text-gray-600">
                  <Mail className="h-4 w-4 mr-2" />
                  <span>info@navigatewealth.co</span>
                </div>
                <div className="flex items-center text-gray-600">
                  <Phone className="h-4 w-4 mr-2" />
                  <span>+27 (0) 12 667 2505</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Document Viewer Dialog */}
      <Dialog open={viewerOpen} onOpenChange={setViewerOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] p-0 overflow-hidden">
          <DialogHeader className="px-6 pt-6 pb-3 border-b bg-white sticky top-0 z-10">
            <div className="flex items-center justify-between">
              <DialogTitle className="text-lg font-semibold text-gray-900 pr-8">
                {viewerDocument?.title || 'Legal Document'}
              </DialogTitle>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handlePrint}
                  className="gap-2 text-purple-600 border-purple-200 hover:bg-purple-50"
                >
                  <Printer className="h-4 w-4" />
                  Print / Save as PDF
                </Button>
              </div>
            </div>
            {viewerDocument?.version && (
              <p className="text-xs text-gray-500 mt-1">
                Version {viewerDocument.version}
              </p>
            )}
          </DialogHeader>
          <div className="overflow-y-auto max-h-[calc(90vh-100px)]">
            <div ref={printRef}>
              {viewerDocument?.blocks && viewerDocument.blocks.length > 0 ? (
                <LegalBlockRenderer
                  blocks={viewerDocument.blocks}
                  title={viewerDocument.title}
                />
              ) : (
                <div className="p-12 text-center text-gray-500">
                  <FileText className="h-12 w-12 mx-auto mb-4 opacity-40" />
                  <p className="font-medium">Document content not yet available</p>
                  <p className="text-sm mt-1">The compliance team is preparing this document.</p>
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
