/**
 * Contact details and footer links shared by the Navigator header and footer.
 * Addresses here are the live site's own routes — the redesign keeps every
 * URL, including the ?section= deep links into Resources and Legal.
 */
export const PHONE_HREF = 'tel:+27126672505';
export const PHONE_DISPLAY = '012 667 2505';
export const WHATSAPP_HREF = 'https://wa.me/message/BOLRR5DSCWNAG1';
export const BUSINESS_HOURS = 'Mon – Fri, 08:30 – 16:30';

export interface FooterLink {
  label: string;
  path: string;
}

export const FOOTER_LINKS: Record<'company' | 'services' | 'resources' | 'legal', FooterLink[]> = {
  company: [
    { label: 'About Us', path: '/about' },
    { label: 'Why Us?', path: '/why-us' },
    { label: 'Careers', path: '/careers' },
    { label: 'Press', path: '/press' },
  ],
  services: [
    { label: 'Risk Management', path: '/risk-management' },
    { label: 'Medical Aid', path: '/medical-aid' },
    { label: 'Retirement Planning', path: '/retirement-planning' },
    { label: 'Investment Management', path: '/investment-management' },
    { label: 'Employee Benefits', path: '/employee-benefits' },
    { label: 'Tax Planning', path: '/tax-planning' },
    { label: 'Estate Planning', path: '/estate-planning' },
    { label: 'Financial Planning', path: '/financial-planning' },
  ],
  resources: [
    { label: 'Insights', path: '/resources' },
    { label: 'Sitemap', path: '/sitemap' },
    { label: 'Market Updates', path: '/resources?section=market-updates' },
    { label: 'Newsletters', path: '/resources?section=newsletters' },
  ],
  legal: [
    { label: 'Privacy and Data', path: '/legal?section=privacy-data-protection' },
    { label: 'Legal Notices', path: '/legal?section=legal-notices' },
    { label: 'Regulatory', path: '/legal?section=regulatory-disclosures' },
    { label: 'Other', path: '/legal?section=other' },
  ],
};
