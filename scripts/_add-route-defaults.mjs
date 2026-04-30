/**
 * One-off helper: append `export default <Name>;` where missing so
 * React.lazy(() => import('...')) has a stable default export.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

const pairs = [
  ['src/components/pages/ServicesPage.tsx', 'ServicesPage'],
  ['src/components/pages/AboutPage.tsx', 'AboutPage'],
  ['src/components/pages/TeamPage.tsx', 'TeamPage'],
  ['src/components/pages/ContactPage.tsx', 'ContactPage'],
  ['src/components/pages/ScheduleConsultationPage.tsx', 'ScheduleConsultationPage'],
  ['src/components/pages/ResourcesPage.tsx', 'ResourcesPage'],
  ['src/components/pages/ArticleDetailPage.tsx', 'ArticleDetailPage'],
  ['src/components/pages/LegalPage.tsx', 'LegalPage'],
  ['src/components/pages/LegalDocumentPage.tsx', 'LegalDocumentPage'],
  ['src/components/pages/ForgotPasswordPage.tsx', 'ForgotPasswordPage'],
  ['src/components/pages/ResetPasswordPage.tsx', 'ResetPasswordPage'],
  ['src/components/pages/VerifyEmailPage.tsx', 'VerifyEmailPage'],
  ['src/components/pages/GetStartedPage.tsx', 'GetStartedPage'],
  ['src/components/pages/GetQuotePage.tsx', 'GetQuotePage'],
  ['src/components/pages/QuoteServiceContactPage.tsx', 'QuoteServiceContactPage'],
  ['src/components/pages/ProductQuotePage.tsx', 'ProductQuotePage'],
  ['src/components/pages/AccountTypeSelectionPage.tsx', 'AccountTypeSelectionPage'],
  ['src/components/pages/ApplicationPage.tsx', 'ApplicationPage'],
  ['src/components/pages/PendingDashboardPage.tsx', 'PendingDashboardPage'],
  ['src/components/pages/DeclinedApplicationPage.tsx', 'DeclinedApplicationPage'],
  ['src/components/pages/HomeDashboardPage.tsx', 'HomeDashboardPage'],
  ['src/components/pages/ProductsServicesDashboardPage.tsx', 'ProductsServicesDashboardPage'],
  ['src/components/pages/RiskManagementDashboardPage.tsx', 'RiskManagementDashboardPage'],
  ['src/components/pages/MedicalAidDashboardPage.tsx', 'MedicalAidDashboardPage'],
  ['src/components/pages/RetirementPlanningDashboardPage.tsx', 'RetirementPlanningDashboardPage'],
  ['src/components/pages/InvestmentManagementDashboardPage.tsx', 'InvestmentManagementDashboardPage'],
  ['src/components/pages/EmployeeBenefitsDashboardPage.tsx', 'EmployeeBenefitsDashboardPage'],
  ['src/components/pages/TaxPlanningDashboardPage.tsx', 'TaxPlanningDashboardPage'],
  ['src/components/pages/EstatePlanningDashboardPage.tsx', 'EstatePlanningDashboardPage'],
  ['src/components/pages/AIAdvisorPage.tsx', 'AIAdvisorPage'],
  ['src/components/pages/HistoryPage.tsx', 'HistoryPage'],
  ['src/components/pages/ProductsServicesPage.tsx', 'ProductsServicesPage'],
  ['src/components/client/communication/CommunicationPage.tsx', 'CommunicationPage'],
  ['src/components/client/e-sign/ClientEsignHistoryPage.tsx', 'ClientEsignHistoryPage'],
  ['src/components/pages/TransactionsDocumentsPage.tsx', 'TransactionsDocumentsPage'],
  ['src/components/pages/ProfilePage.tsx', 'ProfilePage'],
  ['src/components/pages/SecuritySettingsPage.tsx', 'SecuritySettingsPage'],
  ['src/components/pages/RetirementPlanningPage.tsx', 'RetirementPlanningPage'],
  ['src/components/pages/InvestmentManagementPage.tsx', 'InvestmentManagementPage'],
  ['src/components/pages/TaxPlanningPage.tsx', 'TaxPlanningPage'],
  ['src/components/pages/EstatePlanningPage.tsx', 'EstatePlanningPage'],
  ['src/components/pages/FinancialPlanningPage.tsx', 'FinancialPlanningPage'],
  ['src/components/pages/MedicalAidPage.tsx', 'MedicalAidPage'],
  ['src/components/pages/MyAdviserPage.tsx', 'MyAdviserPage'],
  ['src/components/pages/ForIndividualsPage.tsx', 'ForIndividualsPage'],
  ['src/components/pages/ForBusinessesPage.tsx', 'ForBusinessesPage'],
  ['src/components/pages/ForAdvisersPage.tsx', 'ForAdvisersPage'],
  ['src/components/pages/WhyUsPage.tsx', 'WhyUsPage'],
  ['src/components/pages/CareersPage.tsx', 'CareersPage'],
  ['src/components/pages/PressPage.tsx', 'PressPage'],
  ['src/components/pages/EmployeeBenefitsPage.tsx', 'EmployeeBenefitsPage'],
  ['src/components/pages/AdminDashboardPage.tsx', 'AdminDashboardPage'],
  ['src/components/pages/SitemapPage.tsx', 'SitemapPage'],
  ['src/components/pages/RequestCompletionPage.tsx', 'RequestCompletionPage'],
  ['src/components/pages/NewsletterConfirmPage.tsx', 'NewsletterConfirmPage'],
  ['src/components/pages/NewsletterUnsubscribePage.tsx', 'NewsletterUnsubscribePage'],
  ['src/components/pages/RobotsTxtPage.tsx', 'RobotsTxtPage'],
  ['src/components/esign-signer/SignerLandingPage.tsx', 'SignerLandingPage'],
  ['src/components/pages/OGImageGeneratorPage.tsx', 'OGImageGeneratorPage'],
  ['src/components/pages/LinktreePage.tsx', 'LinktreePage'],
  ['src/components/pages/LinkedInCallbackPage.tsx', 'LinkedInCallbackPage'],
];

for (const [rel, name] of pairs) {
  const full = path.join(root, rel);
  let code = fs.readFileSync(full, 'utf8');
  if (/\bexport\s+default\b/.test(code)) {
    console.log('skip:', rel);
    continue;
  }
  const trimmed = code.replace(/\s*$/, '');
  fs.writeFileSync(full, `${trimmed}\n\nexport default ${name};\n`);
  console.log('added:', rel);
}
