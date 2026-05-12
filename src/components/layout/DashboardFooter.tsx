import React from 'react';
import { ExternalLink, FileText, Info, Shield } from 'lucide-react';
import { LegalDocumentDialog, useLegalDocumentViewer } from '../shared/LegalDocumentViewer';
import { Separator } from '../ui/separator';
import { Logo } from './Logo';

type LegalFooterLink = {
  label: string;
  slug: string;
};

const TOP_LINKS: LegalFooterLink[] = [
  { label: 'Regulatory Disclosures', slug: 'fais-disclosure' },
  { label: 'Terms & Conditions', slug: 'legal-conditions' },
];

const BOTTOM_LINKS: LegalFooterLink[] = [
  { label: 'Privacy Policy', slug: 'privacy-notice' },
  { label: 'Cookie Policy', slug: 'cookie-policy' },
  { label: 'Complaints Procedure', slug: 'complaints-procedure' },
  { label: 'FAIS Conflict of Interest Policy', slug: 'conflict-of-interest' },
];

export function DashboardFooter() {
  const currentYear = new Date().getFullYear();
  const legalViewer = useLegalDocumentViewer();

  const renderLegalLink = ({ label, slug }: LegalFooterLink) => {
    const isLoading = legalViewer.loadingSlug === slug;

    return (
      <button
        key={slug}
        type="button"
        onClick={() => legalViewer.openDocument(slug)}
        disabled={isLoading}
        className="inline-flex items-center gap-1 text-white transition-colors hover:text-purple-400 disabled:cursor-wait disabled:opacity-80"
      >
        {isLoading ? 'Loading...' : label}
        <ExternalLink className="h-3 w-3" />
      </button>
    );
  };

  return (
    <>
      <footer className="mt-auto border-t border-gray-700 bg-[rgba(0,0,0,1)]">
        <div className="mx-auto max-w-screen-2xl px-4 py-6 sm:px-6 lg:px-8 xl:px-12">
          <div className="mb-4 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center">
              <Logo variant="light" className="h-10" />
            </div>

            <div className="flex flex-col gap-4 text-sm text-white sm:flex-row">
              <div className="flex items-center space-x-2">
                <Shield className="h-4 w-4 text-white" />
                <span className="text-white">FSCA Registration: FSP 54606</span>
              </div>
              <div className="flex items-center space-x-2">
                <FileText className="h-4 w-4 text-white" />
                {renderLegalLink(TOP_LINKS[0])}
              </div>
              <div className="flex items-center space-x-2">
                <Info className="h-4 w-4 text-white" />
                {renderLegalLink(TOP_LINKS[1])}
              </div>
            </div>
          </div>

          <Separator className="my-4 bg-gray-700" />

          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap gap-4 text-sm">
              {BOTTOM_LINKS.map(renderLegalLink)}
            </div>

            <div className="text-sm text-white">
              &copy; {currentYear} Navigate Wealth. All rights reserved.
            </div>
          </div>

          <div className="mt-4 border-t border-gray-700 pt-4">
            <p className="text-xs leading-relaxed text-white">
              <strong className="text-white">Regulatory Information:</strong> Wealthfront (Pty) Ltd, trading as "Navigate Wealth" is an authorized Financial Services Provider (FSP 54606)
              regulated by the Financial Sector Conduct Authority (FSCA). All investment products are subject to investment risk,
              including possible loss of principal amount invested. Past performance is not indicative of future performance.
              Please refer to our full risk disclosure and terms of service for complete details.
            </p>
          </div>
        </div>
      </footer>

      <LegalDocumentDialog
        open={legalViewer.viewerOpen}
        onOpenChange={legalViewer.setViewerOpen}
        document={legalViewer.viewerDocument}
        onPrint={legalViewer.handlePrint}
      />
    </>
  );
}
