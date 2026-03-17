import React from 'react';
import { Separator } from '../ui/separator';
import { Shield, FileText, Info, ExternalLink } from 'lucide-react';
import { Logo } from './Logo';

export function DashboardFooter() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="border-t border-gray-700 bg-[rgba(0,0,0,1)] mt-auto">
      <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 xl:px-12 py-6">
        {/* Regulatory Information */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-4">
          <div className="flex items-center">
            <Logo variant="light" className="h-10" />
          </div>
          
          <div className="flex flex-col sm:flex-row gap-4 text-sm text-white">
            <div className="flex items-center space-x-2">
              <Shield className="h-4 w-4 text-white" />
              <span className="text-white">FSCA Registration: FSP 54606</span>
            </div>
            <div className="flex items-center space-x-2">
              <FileText className="h-4 w-4 text-white" />
              <a 
                href="/legal?section=regulatory-disclosures" 
                target="_blank"
                rel="noopener noreferrer"
                className="text-white hover:text-purple-400 transition-colors flex items-center gap-1"
              >
                Regulatory Disclosures
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
            <div className="flex items-center space-x-2">
              <Info className="h-4 w-4 text-white" />
              <a 
                href="/legal?section=legal-notices" 
                target="_blank"
                rel="noopener noreferrer"
                className="text-white hover:text-purple-400 transition-colors flex items-center gap-1"
              >
                Terms & Conditions
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </div>
        </div>

        <Separator className="my-4 bg-gray-700" />

        {/* Legal Links and Copyright */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="flex flex-wrap gap-4 text-sm">
            <a 
              href="/legal?section=privacy-data-protection" 
              target="_blank"
              rel="noopener noreferrer"
              className="text-white hover:text-purple-400 transition-colors flex items-center gap-1"
            >
              Privacy Policy
              <ExternalLink className="h-3 w-3" />
            </a>
            <a 
              href="/legal?section=other" 
              target="_blank"
              rel="noopener noreferrer"
              className="text-white hover:text-purple-400 transition-colors flex items-center gap-1"
            >
              Cookie Policy
              <ExternalLink className="h-3 w-3" />
            </a>
            <a 
              href="/legal?section=regulatory-disclosures" 
              target="_blank"
              rel="noopener noreferrer"
              className="text-white hover:text-purple-400 transition-colors flex items-center gap-1"
            >
              Complaints Procedure
              <ExternalLink className="h-3 w-3" />
            </a>
            <a 
              href="/legal?section=regulatory-disclosures" 
              target="_blank"
              rel="noopener noreferrer"
              className="text-white hover:text-purple-400 transition-colors flex items-center gap-1"
            >
              FAIS Conflict of Interest Policy
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
          
          <div className="text-sm text-white">
            © {currentYear} Navigate Wealth. All rights reserved.
          </div>
        </div>

        {/* Regulatory Disclaimer */}
        <div className="mt-4 pt-4 border-t border-gray-700">
          <p className="text-xs text-white leading-relaxed">
            <strong className="text-white">Regulatory Information:</strong> Wealthfront (Pty) Ltd, trading as "Navigate Wealth" is an authorized Financial Services Provider (FSP 54606) 
            regulated by the Financial Sector Conduct Authority (FSCA). All investment products are subject to investment risk, 
            including possible loss of principal amount invested. Past performance is not indicative of future performance. 
            Please refer to our full risk disclosure and terms of service for complete details.
          </p>
        </div>
      </div>
    </footer>
  );
}
