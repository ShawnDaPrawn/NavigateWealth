import React, { ReactNode } from 'react';

export const BASE_PDF_CSS = `
    :root {
      --a4-w: 210mm;
      --a4-h: 297mm;

      /* PDF margins (controlled by renderer script; keep here for preview) */
      --margin-top: 5mm;
      --margin-bottom: 5mm;
      --margin-left: 10mm;
      --margin-right: 10mm;

      /* Footer sizing */
      --footer-height: 18mm;
      /* Bottom margin reserved for footer: 5mm + 18mm = 23mm */
      --margin-bottom-with-footer: 23mm;

      --nw-purple: #6d28d9;

      --text: #111827;
      --muted: #6b7280;
      --border: #e5e7eb;
      --soft: #f9fafb;
    }

    @page {
      size: A4;
      margin: 0; /* We handle margins manually in the content to support headers/footers properly */
    }

    * { box-sizing: border-box; }

    /* ===== GLOBAL STYLE RESET FOR PDF CONTEXT =====
       globals.css overrides h1 (3rem), h2 (2rem), h3 (1.25rem !important),
       h4 (1.25rem), p (1.125rem) via base typography rules.
       These cascade INTO the PDF preview/builder, breaking the compact 9.5px
       sizing the PDF expects. We reset only these elements — NOT div/span/label
       which don't have conflicting global styles.
       WORKAROUND: globals.css h3 uses !important in @layer utilities,
       so we counter with !important here. */

    /* h1/h2/h4/p: globals uses :where() (0 specificity), so .pdf-preview-container
       specificity (0,1,1) is enough to override without !important */
    .pdf-preview-container h1,
    .pdf-preview-container h2,
    .pdf-preview-container h4,
    .pdf-preview-container p {
      font-size: inherit;
      font-weight: inherit;
      line-height: inherit;
      margin: 0;
    }

    /* h3: globals uses !important, so we must counter with !important */
    .pdf-preview-container h3 {
      font-size: inherit !important;
      font-weight: inherit !important;
      line-height: inherit !important;
      margin: 0 !important;
    }

    /* Re-apply specific PDF typography for structural elements */
    .pdf-preview-container .doc-title {
      font-size: 18px !important;
      font-weight: 800 !important;
      letter-spacing: -0.2px;
    }

    .pdf-preview-container .logo {
      font-size: 20px !important;
      font-weight: 800 !important;
      line-height: 1 !important;
    }

    .pdf-preview-container .section-head h2 {
      font-size: 11px !important;
      font-weight: 800 !important;
      line-height: 1.2 !important;
      text-transform: uppercase;
    }

    .pdf-preview-container .section-head .num {
      font-size: 11px !important;
      font-weight: 800 !important;
      line-height: 1.2 !important;
    }

    /* Rich text sub-headings inside text blocks */
    .pdf-preview-container h3 {
      font-size: 10.5px !important;
      font-weight: 700 !important;
    }

    .pdf-preview-container h4 {
      font-size: 10px;
      font-weight: 600;
    }

    /* Paragraphs in PDF context: compact sizing matching final output */
    .pdf-preview-container p {
      font-size: inherit;
      line-height: 1.5;
    }

    /* Masthead & meta typography — explicit sizes to prevent inheritance issues */
    .pdf-preview-container .masthead-left {
      font-size: 9.2px;
      font-weight: 700;
    }

    .pdf-preview-container .masthead-right {
      font-size: 9.2px;
    }

    .pdf-preview-container .brand-subline {
      font-size: 10.5px;
    }

    .pdf-preview-container .meta-k {
      font-size: 9.2px;
      font-weight: 600;
    }

    .pdf-preview-container .meta-v {
      font-size: 9.2px;
    }

    .pdf-preview-container .pdf-footer {
      font-size: 8px;
      line-height: 1.35;
    }

    .pdf-preview-container .footer-page {
      font-weight: 700;
    }

    html, body {
      margin: 0;
      padding: 0;
      font-family: "Inter", "Segoe UI", Arial, sans-serif;
      color: var(--text);
      background: #ffffff;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    /* ===== SCREEN PREVIEW WRAPPER ===== */
    .pdf-viewport {
      background: #f3f4f6;
      padding: 24px 0;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 24px; /* Gap between pages in preview */
    }

    .pdf-page {
      width: var(--a4-w);
      height: var(--a4-h); /* Fixed height for A4 */
      background: #ffffff;
      border: 1px solid rgba(229,231,235,0.9);
      box-shadow: 0 10px 30px rgba(15,23,42,0.10);
      overflow: hidden;
      position: relative; 
      page-break-after: always; /* Ensure new page in print */
      break-after: page; /* Modern CSS standard */
    }

    .pdf-page:last-child {
      page-break-after: auto;
      break-after: auto;
    }

    /* Content Area with Margins */
    .pdf-content {
      padding: var(--margin-top) var(--margin-right) var(--margin-bottom-with-footer) var(--margin-left);
      height: 100%;
      position: relative;
    }
    
    .pdf-content.pt-subsequent-page {
      padding-top: 12.5mm !important;
    }

    /* ======================================================
       FOOTER
    ====================================================== */
    .pdf-footer {
      position: absolute;
      bottom: var(--margin-bottom);
      left: var(--margin-left);
      right: var(--margin-right);
      height: var(--footer-height);
      border-top: 1px solid var(--border);
      padding-top: 3.5mm;
      font-size: 8px; /* Smaller footer text */
      line-height: 1.35;
      color: var(--muted);
      background: #ffffff;
    }

    .footer-row {
      display: flex;
      gap: 5mm;
      align-items: flex-start;
    }

    .footer-page {
      width: 20mm;
      font-weight: 700;
      white-space: nowrap;
    }

    .footer-text { flex: 1; }

    /* ======================================================
       TOP MASTHEAD (15mm)
    ====================================================== */
    .top-masthead {
      height: 15mm;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10mm;
      border-bottom: 1px solid var(--border);
      margin-bottom: 5mm;
    }

    .masthead-left {
      font-size: 9.2px;
      font-weight: 700;
      letter-spacing: 0.2px;
      color: #374151;
      white-space: nowrap;
      text-transform: uppercase;
    }

    .masthead-right {
      font-size: 9.2px;
      color: var(--muted);
      text-align: right;
      line-height: 1.25;
    }

    .masthead-right strong {
      color: #374151;
      font-weight: 700;
    }

    /* ===== MAIN HEADER (Page 1 Only) ===== */
    .page-header-full {
      margin-bottom: 6mm;
    }

    .header-row {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 10mm;
    }

    .brand-block {
      display: flex;
      flex-direction: column;
      gap: 2mm;
      min-width: 65mm;
    }

    .logo {
      font-size: 20px;
      font-weight: 800;
      letter-spacing: -0.35px;
      white-space: nowrap;
      line-height: 1;
    }

    .logo .wealth { color: var(--nw-purple); }

    .brand-subline {
      font-size: 10.5px;
      color: var(--muted);
      line-height: 1.25;
    }

    .doc-block {
      flex: 1;
      text-align: right;
    }

    .doc-title {
      font-size: 18px;
      font-weight: 800;
      margin: 0;
      letter-spacing: -0.2px;
    }

    .meta-grid {
      display: inline-grid;
      grid-template-columns: auto auto;
      gap: 0.8mm 6mm;
      justify-content: end;
      align-items: baseline;
      margin-top: 2mm;
      padding-top: 2mm;
      border-top: 1px solid var(--border);
    }

    .meta-k {
      font-size: 9.2px;
      font-weight: 600;
      color: #4b5563;
      letter-spacing: 0.1px;
    }

    .meta-v {
      font-size: 9.2px;
      color: var(--muted);
      white-space: nowrap;
    }

    /* ===== SECTION TITLE STANDARD ===== */
    .section {
      margin-top: 6mm;
    }
    .section:first-child { margin-top: 0; }

    .section-head {
      display: flex;
      align-items: baseline;
      gap: 6px;
      border-bottom: 1px solid var(--border);
      padding-bottom: 1mm;
      margin-bottom: 1.5mm;
    }

    .section-head .num,
    .section-head h2 {
      font-size: 11px; /* Decreased from 12.5px */
      font-weight: 800;
      line-height: 1.2;
      margin: 0;
      text-transform: uppercase;
    }

    .section-head .num { color: var(--nw-purple); }

    .callout {
      background: var(--soft);
      border: 1px solid var(--border);
      border-radius: 6px;
      padding: 6px 8px;
      font-size: 9.5px;
      line-height: 1.5;
    }

    /* ===== TABLES / FIELDS ===== */
    .pdf-preview-container table {
      width: 100%;
      border-collapse: collapse;
      font-size: 9.5px; /* Decreased from 11px */
    }

    .pdf-preview-container th, 
    .pdf-preview-container td {
      border: 1px solid var(--border);
      padding: 5px 6px;
      vertical-align: top;
    }

    .pdf-preview-container th {
      background: var(--soft);
      width: 30%;
      font-weight: 700;
      color: #374151;
      text-align: left;
    }

    .field { min-height: 6mm; }
    .signature-box { height: 14mm; }

    .checkbox {
      width: 3mm;
      height: 3mm;
      border: 1px solid #9ca3af;
      border-radius: 1px;
      display: inline-block;
      margin-right: 6px;
      transform: translateY(0.5px);
    }

    /* ===== GRID LAYOUTS ===== */
    .grid {
      display: grid;
    }
    
    .grid-cols-2 {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
    
    .grid-cols-3 {
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }
    
    .grid-cols-4 {
      grid-template-columns: repeat(4, minmax(0, 1fr));
    }
    
    .gap-1 {
      gap: 0.25rem;
    }
    
    .gap-2 {
      gap: 0.5rem;
    }
    
    .gap-4 {
      gap: 1rem;
    }
    
    .gap-8 {
      gap: 2rem;
    }
    
    /* ===== FLEX LAYOUTS ===== */
    .flex {
      display: flex;
    }
    
    .flex-col {
      flex-direction: column;
    }
    
    .flex-1 {
      flex: 1 1 0%;
    }
    
    .items-end {
      align-items: flex-end;
    }
    
    .items-center {
      align-items: center;
    }
    
    /* ===== SPACING ===== */
    .mt-1 { margin-top: 0.25rem; }
    .mt-4 { margin-top: 1rem; }
    .mt-6 { margin-top: 1.5rem; }
    
    .mb-1 { margin-bottom: 0.25rem; }
    .mb-2 { margin-bottom: 0.5rem; }
    .mb-4 { margin-bottom: 1rem; }
    
    .mr-2 { margin-right: 0.5rem; }
    
    .m-0 { margin: 0; }
    
    .p-1 { padding: 0.25rem; }
    .p-2 { padding: 0.5rem; }
    .p-4 { padding: 1rem; }
    
    .pb-1 { padding-bottom: 0.25rem; }
    .pb-2 { padding-bottom: 0.5rem; }
    
    /* ===== BORDERS ===== */
    .border {
      border-width: 1px;
      border-style: solid;
    }
    
    .border-b {
      border-bottom-width: 1px;
      border-bottom-style: solid;
    }
    
    .border-gray-200 { border-color: #e5e7eb; }
    .border-gray-300 { border-color: #d1d5db; }
    .border-black { border-color: #000; }
    
    .rounded-sm { border-radius: 0.125rem; }
    .rounded { border-radius: 0.25rem; }
    .rounded-lg { border-radius: 0.5rem; }
    
    /* ===== BACKGROUNDS ===== */
    .bg-white {
      background-color: #fff;
    }
    
    .bg-gray-50 {
      background-color: #f9fafb;
    }
    
    .bg-gray-100 {
      background-color: #f3f4f6;
    }
    
    /* Custom background colors */
    .bg-\\[\\#eef2ff\\] {
      background-color: #eef2ff;
    }
    
    .bg-amber-50 {
      background-color: #fffbeb;
    }
    
    .border-\\[\\#e0e7ff\\] {
      border-color: #e0e7ff;
    }
    
    .border-amber-200 {
      border-color: #fde68a;
    }
    
    .text-amber-700 {
      color: #b45309;
    }
    
    .text-amber-800 {
      color: #92400e;
    }
    
    .text-amber-900 {
      color: #78350f;
    }
    
    /* ===== TEXT ===== */
    .text-justify {
      text-align: justify;
    }
    
    .text-left {
      text-align: left;
    }

    .text-\\[8px\\] { font-size: 8px; }
    .text-\\[8\\.5px\\] { font-size: 8.5px; }
    .text-\\[9px\\] {
      font-size: 9px;
    }
    
    .text-\\[9\\.5px\\] {
      font-size: 9.5px;
    }

    .text-\\[10px\\] { font-size: 10px; }
    
    .text-gray-600 {
      color: #4b5563;
    }
    
    .text-gray-700 {
      color: #374151;
    }
    
    .text-gray-800 {
      color: #1f2937;
    }
    
    .text-blue-900 {
      color: #1e3a8a;
    }
    
    .text-purple-700 {
      color: #7c3aed;
    }
    
    .font-bold {
      font-weight: 700;
    }
    
    .font-medium {
      font-weight: 500;
    }
    
    .uppercase {
      text-transform: uppercase;
    }

    .tracking-wide { letter-spacing: 0.025em; }
    .tracking-wider { letter-spacing: 0.05em; }
    
    .whitespace-nowrap {
      white-space: nowrap;
    }
    
    .leading-relaxed {
      line-height: 1.625;
    }
    
    /* ===== SIZING ===== */
    .w-full {
      width: 100%;
    }
    
    .w-24 {
      width: 6rem;
    }
    
    .h-6 {
      height: 1.5rem;
    }
    
    .min-h-8 {
      min-height: 2rem;
    }
    
    /* ===== TABLE ===== */
    .table-fixed {
      table-layout: fixed;
    }
    
    .align-top {
      vertical-align: top;
    }
    
    .break-words {
      overflow-wrap: break-word;
    }
    
    /* ===== SIGNATURE LINES ===== */
    /* Ensure signature lines are always visible in both screen and print */
    .signature-line {
      border-bottom: 1px solid #000 !important;
      min-height: 1.5rem;
      display: block;
    }

    /* ===== VARIABLE TAGS ===== */
    /* Styled placeholders for data-bound variables e.g. {{client_name}} */
    .variable-tag {
      background-color: #f3e8ff;
      color: #7c3aed;
      padding: 0 3px;
      border-radius: 2px;
      font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, monospace;
      font-size: 0.85em;
      white-space: nowrap;
    }

    /* Print Overrides */
    @media print {
      html, body {
        width: 210mm;
        height: 297mm;
      }
      
      /* Hide all toasts and notifications during print */
      [data-sonner-toaster],
      .sonner,
      [role="status"],
      [role="alert"]:not(.pdf-content [role="alert"]) {
        display: none !important;
      }
      
      .pdf-viewport { 
        padding: 0; 
        background: transparent; 
        display: block;
        min-height: 0;
      }
      
      .pdf-page { 
        box-shadow: none; 
        border: none; 
        width: 210mm;
        height: 297mm;
        page-break-after: always;
        margin: 0;
        padding: 0;
        overflow: visible;
      }
      
      .pdf-page:last-child {
        page-break-after: auto;
      }
      
      /* Ensure all content is visible in print */
      .pdf-content {
        padding: var(--margin-top) var(--margin-right) var(--margin-bottom-with-footer) var(--margin-left);
        height: 297mm;
        position: relative;
      }
      
      .pdf-content.pt-subsequent-page {
        padding-top: 17.5mm !important;
      }
      
      /* Preserve masthead */
      .top-masthead {
        display: flex;
        height: 15mm;
        border-bottom: 1px solid var(--border);
      }
      
      /* Preserve header on first page */
      .page-header-full {
        display: block;
        margin-bottom: 6mm;
      }
      
      .header-row {
        display: flex;
      }
      
      /* Preserve footer */
      .pdf-footer {
        position: absolute;
        bottom: var(--margin-bottom);
        left: var(--margin-left);
        right: var(--margin-right);
        display: block;
      }
      
      .footer-row {
        display: flex;
      }
      
      /* Ensure section structure is preserved */
      .section {
        display: block;
        page-break-inside: avoid;
      }
      
      .section-head {
        display: flex;
        border-bottom: 1px solid var(--border);
      }
      
      /* Preserve tables */
      table {
        width: 100%;
        border-collapse: collapse;
        page-break-inside: auto;
      }
      
      tr {
        page-break-inside: avoid;
        page-break-after: auto;
      }
      
      thead {
        display: table-header-group;
      }
      
      /* Preserve grid layouts */
      .grid {
        display: grid !important;
      }
      
      /* Preserve flex layouts */
      .flex {
        display: flex !important;
      }
      
      /* Ensure signature boxes are visible */
      .signature-box {
        height: 14mm;
        border: 1px solid #d1d5db;
      }
    }
`;

interface PdfPageProps {
  children: ReactNode;
  pageNum: number;
  totalPages: number;
  docTitle: string;
  issueDate: string;
  isFirstPage?: boolean;
  mastheadLabel?: string;
}

const PdfPage = ({ 
  children, 
  pageNum, 
  totalPages, 
  docTitle, 
  issueDate,
  isFirstPage = false,
  mastheadLabel
}: PdfPageProps) => {
  return (
    <div className="pdf-page">
      <div 
        className={`pdf-content ${!isFirstPage ? 'pt-subsequent-page' : ''}`}
      >
        {/* MASTHEAD (Only on Page 1) */}
        {isFirstPage && (
          <div className="top-masthead">
            <div className="masthead-left">{(mastheadLabel || docTitle || 'DOCUMENT').toUpperCase()}</div>
            <div className="masthead-right">
              <strong>Wealthfront (Pty) Ltd</strong> t/a Navigate Wealth &nbsp;|&nbsp; <strong>FSP 54606</strong><br/>
              Email: info@navigatewealth.co
            </div>
          </div>
        )}

        {/* HEADER (Full on Page 1, Minimal/None on others?) 
            User didn't specify, but typically Page 1 has the big title. 
            We'll show the simplified title on subsequent pages or just content.
        */}
        {isFirstPage && (
          <div className="contents">
            <header className="page-header-full">
              <div className="header-row">
                <div className="brand-block">
                  <div className="logo">Navigate <span className="wealth">Wealth</span></div>
                  <div className="brand-subline">Independent Financial Advisory Services</div>
                </div>

                <div className="doc-block">
                  <h1 className="doc-title">{docTitle}</h1>
                  <div className="meta-grid">
                    <div className="meta-k">Issue date</div>
                    <div className="meta-v">{issueDate}</div>
                  </div>
                </div>
              </div>
            </header>
            <hr className="section-divider" style={{ borderTop: '2px solid #6b7280', margin: '4mm 0 6mm 0' }} />
          </div>
        )}

        <main>
          {children}
        </main>

        {/* FOOTER */}
        <footer className="pdf-footer">
          <div className="footer-row">
            <div className="footer-page">Page {pageNum} of {totalPages}</div>
            <div className="footer-text">
              Wealthfront (Pty) Ltd, trading as Navigate Wealth, is an Authorised Financial Services Provider – FSP 54606.
              Registration Number: 2024/071953/07. Located at Route 21 Corporate Park, 25 Sovereign Drive, Milestone Place A, Centurion, 0178.
              For inquiries, please contact us at Tel: (012) 667 2505.
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
};

export const BasePdfLayout = ({ 
  children,
  pages,
  docTitle = "Document Title",
  issueDate,
  formCode,
  version
}: { 
  children?: ReactNode,
  pages?: ReactNode[],
  docTitle?: string,
  issueDate?: string,
  formCode?: string,
  version?: string
}) => {
  // Default to current date in dd/mm/yyyy format
  const displayDate = issueDate || new Date().toLocaleDateString('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });

  return (
    <div className="contents">
      <style dangerouslySetInnerHTML={{ __html: BASE_PDF_CSS }} />
      <div className="pdf-preview-container">
        <div className="pdf-viewport">
          
          {/* If 'pages' prop is provided, render multiple pages */}
          {pages && pages.length > 0 ? (
            pages.map((pageContent, index) => (
              <PdfPage 
                key={index}
                pageNum={index + 1}
                totalPages={pages.length}
                docTitle={docTitle}
                issueDate={displayDate}
                isFirstPage={index === 0}
              >
                {pageContent}
              </PdfPage>
            ))
          ) : (
            /* Backward compatibility: Render children as a single page */
            <PdfPage 
              pageNum={1}
              totalPages={1}
              docTitle={docTitle}
              issueDate={displayDate}
              isFirstPage={true}
            >
              {children}
            </PdfPage>
          )}

        </div>
      </div>
    </div>
  );
};