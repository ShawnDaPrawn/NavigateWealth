// PDF Generation utility for Navigate Wealth Portfolio Reports

import { withNavigateWealthPrintTitle } from './pdfPrintTitle';

export interface ClientPortfolioData {
  // Personal Info
  clientName: string;
  clientId: string;
  age: number;
  email: string;
  phone: string;
  
  // Adviser Info
  adviserName: string;
  adviserEmail: string;
  adviserPhone: string;
  adviserFSP: string;
  
  // Portfolio Data
  portfolioValue: number;
  monthlyPremiums: number;
  cashbackValue: number;
  cashbackProjected: number;
  
  // Product Holdings
  products: {
    life: Array<{ 
      provider: string; 
      product: string; 
      policyNumber: string; 
      value: number; 
      premium: number; 
      status: string 
    }>;
    retirement: Array<{ 
      provider: string; 
      product: string; 
      policyNumber: string; 
      value: number; 
      premium: number; 
      status: string 
    }>;
    investment: Array<{ 
      provider: string; 
      product: string; 
      policyNumber: string; 
      value: number; 
      premium: number; 
      status: string 
    }>;
    medicalAid: Array<{ 
      provider: string; 
      product: string; 
      policyNumber: string; 
      value: number; 
      premium: number; 
      status: string 
    }>;
    shortTerm: Array<{ 
      provider: string; 
      product: string; 
      policyNumber: string; 
      value: number; 
      premium: number; 
      status: string 
    }>;
  };
  
  // AI Insights
  aiInsights: {
    strengths: string[];
    opportunities: string[];
    recommendations: string[];
  };
  
  // Report metadata
  reportDate: string;
  nextReviewDate: string;
}

export async function generateAndDownloadPDF(clientData: ClientPortfolioData) {
  // Create a hidden container for the PDF report
  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.left = '-9999px';
  container.style.top = '-9999px';
  document.body.appendChild(container);
  
  // Dynamically import React and ReactDOM
  const React = (await import('react')).default;
  const ReactDOM = (await import('react-dom/client')).default;
  const { PDFPortfolioReport } = await import('../components/modules/portfolio/PDFPortfolioReport');
  
  // Render the PDF component
  const root = ReactDOM.createRoot(container);
  root.render(React.createElement(PDFPortfolioReport, { clientData }));
  
  // Wait for render
  await new Promise(resolve => setTimeout(resolve, 500));

  const name = (clientData.clientName || '').trim();
  const reportDate = clientData.reportDate?.trim();
  let titleSuffix: string;
  if (name && reportDate) {
    titleSuffix = `Portfolio Report - ${name} (${reportDate})`;
  } else if (name) {
    titleSuffix = `Portfolio Report - ${name}`;
  } else if (reportDate) {
    titleSuffix = `Portfolio Report (${reportDate})`;
  } else {
    titleSuffix = 'Portfolio Report';
  }

  withNavigateWealthPrintTitle(titleSuffix, () => window.print(), 1200);

  setTimeout(() => {
    root.unmount();
    document.body.removeChild(container);
  }, 1500);
}