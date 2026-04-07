import React, { Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router';
import { MainLayout as AppLayout } from './components/layout/MainLayout';
import { Loader2 } from 'lucide-react';
import { ErrorBoundary } from './components/shared/ErrorBoundary';

// Shared loading fallback for lazy-loaded routes
function RouteFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50" role="status" aria-label="Loading page">
      <Loader2 className="h-8 w-8 animate-spin text-purple-600" aria-hidden="true" />
      <span className="sr-only">Loading, please wait…</span>
    </div>
  );
}

// ==================== CRITICAL-PATH (EAGER) IMPORTS ====================
// Only import what's needed for the initial page load and lightweight pages
import { LoginPage } from './components/pages/LoginPage';
import { SignupPage } from './components/pages/SignupPage';
import { NotFoundPage } from './components/pages/NotFoundPage';
import AuthCallbackPage from './components/pages/AuthCallbackPage';
import VerificationSuccessPage from './components/pages/VerificationSuccessPage';
import { ApplicationStatusGuard } from './components/portal/ApplicationStatusGuard';
import { FirstLoginTermsGate } from './components/portal/FirstLoginTermsGate';

// Route Guards (small, always needed)
import {
  ProtectedRoute,
  PublicRoute,
  FlexibleRoute,
  AdminRoute,
  DashboardRoute,
  OnboardingRoute,
  ApplicationRoute,
  PendingRoute,
  DeclinedRoute,
} from './components/auth/RouteGuards';

// ==================== LAZY-LOADED PAGES ====================
// All non-critical pages are lazy-loaded to reduce initial bundle parse time.
const HomePage = React.lazy(() => import('./components/pages/HomePage').then(m => ({ default: m.HomePage })));
const ServicesPage = React.lazy(() => import('./components/pages/ServicesPage').then(m => ({ default: m.ServicesPage })));
const AboutPage = React.lazy(() => import('./components/pages/AboutPage').then(m => ({ default: m.AboutPage })));
const TeamPage = React.lazy(() => import('./components/pages/TeamPage').then(m => ({ default: m.TeamPage })));
const ContactPage = React.lazy(() => import('./components/pages/ContactPage').then(m => ({ default: m.ContactPage })));
const ScheduleConsultationPage = React.lazy(() =>
  import('./components/pages/ScheduleConsultationPage').then(m => ({ default: m.ScheduleConsultationPage })),
);
const ResourcesPage = React.lazy(() => import('./components/pages/ResourcesPage').then(m => ({ default: m.ResourcesPage })));
const ArticleDetailPage = React.lazy(() => import('./components/pages/ArticleDetailPage').then(m => ({ default: m.ArticleDetailPage })));
const DesignSystemPage = React.lazy(() => import('./components/pages/DesignSystemPage').then(m => ({ default: m.DesignSystemPage })));
const LegalPage = React.lazy(() => import('./components/pages/LegalPage').then(m => ({ default: m.LegalPage })));
const ForgotPasswordPage = React.lazy(() => import('./components/pages/ForgotPasswordPage').then(m => ({ default: m.ForgotPasswordPage })));
const ResetPasswordPage = React.lazy(() => import('./components/pages/ResetPasswordPage').then(m => ({ default: m.ResetPasswordPage })));
const VerifyEmailPage = React.lazy(() => import('./components/pages/VerifyEmailPage').then(m => ({ default: m.VerifyEmailPage })));
const GetStartedPage = React.lazy(() => import('./components/pages/GetStartedPage').then(m => ({ default: m.GetStartedPage })));
const GetQuotePage = React.lazy(() => import('./components/pages/GetQuotePage').then(m => ({ default: m.GetQuotePage })));
const QuoteServiceContactPage = React.lazy(() =>
  import('./components/pages/QuoteServiceContactPage').then(m => ({ default: m.QuoteServiceContactPage })),
);
const ProductQuotePage = React.lazy(() => import('./components/pages/ProductQuotePage').then(m => ({ default: m.ProductQuotePage })));
const AccountTypeSelectionPage = React.lazy(() => import('./components/pages/AccountTypeSelectionPage').then(m => ({ default: m.AccountTypeSelectionPage })));
const ApplicationPage = React.lazy(() => import('./components/pages/ApplicationPage').then(m => ({ default: m.ApplicationPage })));
const PendingDashboardPage = React.lazy(() => import('./components/pages/PendingDashboardPage').then(m => ({ default: m.PendingDashboardPage })));
const DeclinedApplicationPage = React.lazy(() => import('./components/pages/DeclinedApplicationPage').then(m => ({ default: m.DeclinedApplicationPage })));
const HomeDashboardPage = React.lazy(() => import('./components/pages/HomeDashboardPage').then(m => ({ default: m.HomeDashboardPage })));
const ProductsServicesDashboardPage = React.lazy(() => import('./components/pages/ProductsServicesDashboardPage').then(m => ({ default: m.ProductsServicesDashboardPage })));
const RiskManagementDashboardPage = React.lazy(() => import('./components/pages/RiskManagementDashboardPage').then(m => ({ default: m.RiskManagementDashboardPage })));
const MedicalAidDashboardPage = React.lazy(() => import('./components/pages/MedicalAidDashboardPage').then(m => ({ default: m.MedicalAidDashboardPage })));
const RetirementPlanningDashboardPage = React.lazy(() => import('./components/pages/RetirementPlanningDashboardPage').then(m => ({ default: m.RetirementPlanningDashboardPage })));
const InvestmentManagementDashboardPage = React.lazy(() => import('./components/pages/InvestmentManagementDashboardPage').then(m => ({ default: m.InvestmentManagementDashboardPage })));
const EmployeeBenefitsDashboardPage = React.lazy(() => import('./components/pages/EmployeeBenefitsDashboardPage').then(m => ({ default: m.EmployeeBenefitsDashboardPage })));
const TaxPlanningDashboardPage = React.lazy(() => import('./components/pages/TaxPlanningDashboardPage').then(m => ({ default: m.TaxPlanningDashboardPage })));
const EstatePlanningDashboardPage = React.lazy(() => import('./components/pages/EstatePlanningDashboardPage').then(m => ({ default: m.EstatePlanningDashboardPage })));
const AIAdvisorPage = React.lazy(() => import('./components/pages/AIAdvisorPage').then(m => ({ default: m.AIAdvisorPage })));
const HistoryPage = React.lazy(() => import('./components/pages/HistoryPage').then(m => ({ default: m.HistoryPage })));
const ProductsServicesPage = React.lazy(() => import('./components/pages/ProductsServicesPage').then(m => ({ default: m.ProductsServicesPage })));
const CommunicationPage = React.lazy(() => import('./components/client/communication/CommunicationPage').then(m => ({ default: m.CommunicationPage })));
const TransactionsDocumentsPage = React.lazy(() => import('./components/pages/TransactionsDocumentsPage').then(m => ({ default: m.TransactionsDocumentsPage })));
const ProfilePage = React.lazy(() => import('./components/pages/ProfilePage').then(m => ({ default: m.ProfilePage })));
const SecuritySettingsPage = React.lazy(() => import('./components/pages/SecuritySettingsPage').then(m => ({ default: m.SecuritySettingsPage })));
import { RiskManagementPage } from './components/pages/RiskManagementPage';
const RetirementPlanningPage = React.lazy(() => import('./components/pages/RetirementPlanningPage').then(m => ({ default: m.RetirementPlanningPage })));
const InvestmentManagementPage = React.lazy(() => import('./components/pages/InvestmentManagementPage').then(m => ({ default: m.InvestmentManagementPage })));
const TaxPlanningPage = React.lazy(() => import('./components/pages/TaxPlanningPage').then(m => ({ default: m.TaxPlanningPage })));
const EstatePlanningPage = React.lazy(() => import('./components/pages/EstatePlanningPage').then(m => ({ default: m.EstatePlanningPage })));
const FinancialPlanningPage = React.lazy(() => import('./components/pages/FinancialPlanningPage').then(m => ({ default: m.FinancialPlanningPage })));
const MedicalAidPage = React.lazy(() => import('./components/pages/MedicalAidPage').then(m => ({ default: m.MedicalAidPage })));
const MyAdviserPage = React.lazy(() => import('./components/pages/MyAdviserPage').then(m => ({ default: m.MyAdviserPage })));
const ForIndividualsPage = React.lazy(() => import('./components/pages/ForIndividualsPage').then(m => ({ default: m.ForIndividualsPage })));
const ForBusinessesPage = React.lazy(() => import('./components/pages/ForBusinessesPage').then(m => ({ default: m.ForBusinessesPage })));
const ForAdvisersPage = React.lazy(() => import('./components/pages/ForAdvisersPage').then(m => ({ default: m.ForAdvisersPage })));
const WhyUsPage = React.lazy(() => import('./components/pages/WhyUsPage').then(m => ({ default: m.WhyUsPage })));
const CareersPage = React.lazy(() => import('./components/pages/CareersPage').then(m => ({ default: m.CareersPage })));
const PressPage = React.lazy(() => import('./components/pages/PressPage').then(m => ({ default: m.PressPage })));
const EmployeeBenefitsPage = React.lazy(() => import('./components/pages/EmployeeBenefitsPage').then(m => ({ default: m.EmployeeBenefitsPage })));
const AdminDashboardPage = React.lazy(() => import('./components/pages/AdminDashboardPage').then(m => ({ default: m.AdminDashboardPage })));
const SitemapPage = React.lazy(() => import('./components/pages/SitemapPage').then(m => ({ default: m.SitemapPage })));
const RequestCompletionPage = React.lazy(() => import('./components/pages/RequestCompletionPage').then(m => ({ default: m.RequestCompletionPage })));
const NewsletterConfirmPage = React.lazy(() => import('./components/pages/NewsletterConfirmPage').then(m => ({ default: m.NewsletterConfirmPage })));
const NewsletterUnsubscribePage = React.lazy(() => import('./components/pages/NewsletterUnsubscribePage').then(m => ({ default: m.NewsletterUnsubscribePage })));
const RobotsTxtPage = React.lazy(() => import('./components/pages/RobotsTxtPage').then(m => ({ default: m.RobotsTxtPage })));
const SitemapXmlPage = React.lazy(() => import('./components/pages/SitemapXmlPage').then(m => ({ default: m.SitemapXmlPage })));
const SignerLandingPage = React.lazy(() => import('./components/esign-signer').then(m => ({ default: m.SignerLandingPage })));
const VerifyDocumentPage = React.lazy(() => import('./components/pages/VerifyDocumentPage').then(m => ({ default: m.VerifyDocumentPage })));
const OGImageGeneratorPage = React.lazy(() => import('./components/pages/OGImageGeneratorPage').then(m => ({ default: m.OGImageGeneratorPage })));
const LinktreePage = React.lazy(() => import('./components/pages/LinktreePage').then(m => ({ default: m.LinktreePage })));
const LinkedInCallbackPage = React.lazy(() => import('./components/pages/LinkedInCallbackPage').then(m => ({ default: m.LinkedInCallbackPage })));
const AskVascoPage = React.lazy(() => import('./components/pages/AskVascoPage').then(m => ({ default: m.AskVascoPage })));

export function AppRoutes() {
  return (
    <Suspense fallback={<RouteFallback />}>
      <Routes>
        {/* Public website routes — always show public layout even if user is logged in elsewhere */}
        <Route path="/" element={<FlexibleRoute><AppLayout forcePublicLayout><HomePage /></AppLayout></FlexibleRoute>} />
        <Route path="/services" element={<FlexibleRoute><AppLayout forcePublicLayout><ServicesPage /></AppLayout></FlexibleRoute>} />
        <Route path="/about" element={<FlexibleRoute><AppLayout forcePublicLayout><AboutPage /></AppLayout></FlexibleRoute>} />
        <Route path="/team" element={<FlexibleRoute><AppLayout forcePublicLayout><TeamPage /></AppLayout></FlexibleRoute>} />
        <Route path="/contact" element={<FlexibleRoute><AppLayout forcePublicLayout><ContactPage /></AppLayout></FlexibleRoute>} />
        <Route
          path="/schedule-consultation"
          element={
            <FlexibleRoute>
              <AppLayout forcePublicLayout>
                <ScheduleConsultationPage />
              </AppLayout>
            </FlexibleRoute>
          }
        />
        <Route
          path="/contact/consultation"
          element={
            <FlexibleRoute>
              <AppLayout forcePublicLayout>
                <ScheduleConsultationPage />
              </AppLayout>
            </FlexibleRoute>
          }
        />
        <Route path="/resources" element={<FlexibleRoute><AppLayout forcePublicLayout><ResourcesPage /></AppLayout></FlexibleRoute>} />
        <Route path="/resources/article/:slug" element={<FlexibleRoute><AppLayout forcePublicLayout><ArticleDetailPage /></AppLayout></FlexibleRoute>} />
        <Route path="/design-system" element={<FlexibleRoute><AppLayout forcePublicLayout><DesignSystemPage /></AppLayout></FlexibleRoute>} />

        {/* Ask Vasco — Public AI Financial Navigator (uses public layout with nav) */}
        <Route path="/ask-vasco" element={<FlexibleRoute><AppLayout forcePublicLayout><AskVascoPage /></AppLayout></FlexibleRoute>} />

        {/* OG Image Generator — bare route, no layout, not indexed */}
        <Route path="/og-preview" element={<OGImageGeneratorPage />} />

        {/* Linktree — bare route, no layout, public-facing link-in-bio page */}
        <Route path="/links" element={<LinktreePage />} />

        {/* LinkedIn OAuth callback — bare route, no layout */}
        <Route path="/auth/linkedin/callback" element={<LinkedInCallbackPage />} />

        {/* Legal & Sitemap — always public layout */}
        <Route path="/legal" element={<FlexibleRoute><AppLayout forcePublicLayout><LegalPage /></AppLayout></FlexibleRoute>} />
        <Route path="/sitemap" element={<FlexibleRoute><AppLayout forcePublicLayout><SitemapPage /></AppLayout></FlexibleRoute>} />
        <Route path="/robots.txt" element={<RobotsTxtPage />} />
        <Route path="/sitemap/xml" element={<SitemapXmlPage />} />
        
        {/* Get Quote — always public layout (contact route must be registered before :service) */}
        <Route path="/get-quote" element={<FlexibleRoute><AppLayout forcePublicLayout><GetQuotePage /></AppLayout></FlexibleRoute>} />
        <Route path="/get-quote/:service/contact" element={<FlexibleRoute><AppLayout forcePublicLayout><QuoteServiceContactPage /></AppLayout></FlexibleRoute>} />
        <Route path="/get-quote/:service" element={<FlexibleRoute><AppLayout forcePublicLayout><ProductQuotePage /></AppLayout></FlexibleRoute>} />
        
        {/* Auth routes */}
        <Route path="/login" element={<FlexibleRoute><AppLayout showNavAndFooter={true} forcePublicLayout><LoginPage /></AppLayout></FlexibleRoute>} />
        <Route path="/signup" element={<PublicRoute><AppLayout showNavAndFooter={true}><SignupPage /></AppLayout></PublicRoute>} />
        <Route path="/forgot-password" element={<PublicRoute><AppLayout showNavAndFooter={true}><ForgotPasswordPage /></AppLayout></PublicRoute>} />
        <Route path="/reset-password" element={<FlexibleRoute><AppLayout showNavAndFooter={false}><ResetPasswordPage /></AppLayout></FlexibleRoute>} />
        <Route path="/verify-email" element={<PublicRoute><AppLayout showNavAndFooter={false}><VerifyEmailPage /></AppLayout></PublicRoute>} />
        <Route path="/auth/callback" element={<FlexibleRoute><AppLayout showNavAndFooter={false}><AuthCallbackPage /></AppLayout></FlexibleRoute>} />
        <Route path="/verification-success" element={<FlexibleRoute><AppLayout showNavAndFooter={false}><VerificationSuccessPage /></AppLayout></FlexibleRoute>} />
        
        {/* Onboarding & Application routes */}
        <Route path="/account-type" element={<OnboardingRoute><AppLayout><AccountTypeSelectionPage /></AppLayout></OnboardingRoute>} />
        <Route path="/get-started" element={<ProtectedRoute><AppLayout><GetStartedPage /></AppLayout></ProtectedRoute>} />
        <Route path="/application" element={<ApplicationRoute><AppLayout><ApplicationPage /></AppLayout></ApplicationRoute>} />
        <Route path="/application/personal-client" element={<ApplicationRoute><AppLayout><ApplicationPage /></AppLayout></ApplicationRoute>} />
        <Route path="/dashboard/pending" element={<PendingRoute><AppLayout><PendingDashboardPage /></AppLayout></PendingRoute>} />
        <Route path="/application/declined" element={<DeclinedRoute><AppLayout><DeclinedApplicationPage /></AppLayout></DeclinedRoute>} />
        <Route path="/onboarding/choose-account" element={<OnboardingRoute><AppLayout><AccountTypeSelectionPage /></AppLayout></OnboardingRoute>} />
        
        {/* Dashboard routes */}
        <Route path="/dashboard" element={<DashboardRoute><AppLayout><FirstLoginTermsGate><ApplicationStatusGuard requireApproved={true}><HomeDashboardPage /></ApplicationStatusGuard></FirstLoginTermsGate></AppLayout></DashboardRoute>} />
        <Route path="/products-services-dashboard" element={<DashboardRoute><AppLayout><ProductsServicesDashboardPage /></AppLayout></DashboardRoute>} />
        <Route path="/dashboard/risk-management" element={<DashboardRoute><AppLayout><RiskManagementDashboardPage /></AppLayout></DashboardRoute>} />
        <Route path="/dashboard/medical-aid" element={<DashboardRoute><AppLayout><MedicalAidDashboardPage /></AppLayout></DashboardRoute>} />
        <Route path="/dashboard/retirement-planning" element={<DashboardRoute><AppLayout><RetirementPlanningDashboardPage /></AppLayout></DashboardRoute>} />
        <Route path="/dashboard/investment-management" element={<DashboardRoute><AppLayout><InvestmentManagementDashboardPage /></AppLayout></DashboardRoute>} />
        <Route path="/dashboard/employee-benefits" element={<DashboardRoute><AppLayout><EmployeeBenefitsDashboardPage /></AppLayout></DashboardRoute>} />
        <Route path="/dashboard/tax-planning" element={<DashboardRoute><AppLayout><TaxPlanningDashboardPage /></AppLayout></DashboardRoute>} />
        <Route path="/dashboard/estate-planning" element={<DashboardRoute><AppLayout><EstatePlanningDashboardPage /></AppLayout></DashboardRoute>} />
        <Route path="/ai-advisor" element={<DashboardRoute><AppLayout><AIAdvisorPage /></AppLayout></DashboardRoute>} />
        <Route path="/history" element={<DashboardRoute><AppLayout><HistoryPage /></AppLayout></DashboardRoute>} />
        <Route path="/products-services" element={<DashboardRoute><AppLayout><ProductsServicesPage /></AppLayout></DashboardRoute>} />
        <Route path="/communication" element={<DashboardRoute><AppLayout><CommunicationPage /></AppLayout></DashboardRoute>} />
        <Route path="/transactions-documents" element={<DashboardRoute><AppLayout><TransactionsDocumentsPage /></AppLayout></DashboardRoute>} />
        <Route path="/profile" element={<DashboardRoute><AppLayout><ProfilePage /></AppLayout></DashboardRoute>} />
        <Route path="/security" element={<DashboardRoute><AppLayout><SecuritySettingsPage /></AppLayout></DashboardRoute>} />
        <Route path="/my-adviser" element={<DashboardRoute><AppLayout><MyAdviserPage /></AppLayout></DashboardRoute>} />
        
        {/* Service pages — always public layout */}
        <Route path="/risk-management" element={<FlexibleRoute><AppLayout forcePublicLayout><RiskManagementPage /></AppLayout></FlexibleRoute>} />
        <Route path="/retirement-planning" element={<FlexibleRoute><AppLayout forcePublicLayout><RetirementPlanningPage /></AppLayout></FlexibleRoute>} />
        <Route path="/investment-management" element={<FlexibleRoute><AppLayout forcePublicLayout><InvestmentManagementPage /></AppLayout></FlexibleRoute>} />
        <Route path="/employee-benefits" element={<FlexibleRoute><AppLayout forcePublicLayout><EmployeeBenefitsPage /></AppLayout></FlexibleRoute>} />
        <Route path="/tax-planning" element={<FlexibleRoute><AppLayout forcePublicLayout><TaxPlanningPage /></AppLayout></FlexibleRoute>} />
        <Route path="/financial-planning" element={<FlexibleRoute><AppLayout forcePublicLayout><FinancialPlanningPage /></AppLayout></FlexibleRoute>} />
        <Route path="/estate-planning" element={<FlexibleRoute><AppLayout forcePublicLayout><EstatePlanningPage /></AppLayout></FlexibleRoute>} />
        <Route path="/medical-aid" element={<FlexibleRoute><AppLayout forcePublicLayout><MedicalAidPage /></AppLayout></FlexibleRoute>} />
        
        {/* Solutions pages — always public layout */}
        <Route path="/solutions/individuals" element={<FlexibleRoute><AppLayout forcePublicLayout><ForIndividualsPage /></AppLayout></FlexibleRoute>} />
        <Route path="/solutions/businesses" element={<FlexibleRoute><AppLayout forcePublicLayout><ForBusinessesPage /></AppLayout></FlexibleRoute>} />
        <Route path="/solutions/advisers" element={<FlexibleRoute><AppLayout forcePublicLayout><ForAdvisersPage /></AppLayout></FlexibleRoute>} />
        
        {/* Company pages — always public layout */}
        <Route path="/why-us" element={<FlexibleRoute><AppLayout forcePublicLayout><WhyUsPage /></AppLayout></FlexibleRoute>} />
        <Route path="/careers" element={<FlexibleRoute><AppLayout forcePublicLayout><CareersPage /></AppLayout></FlexibleRoute>} />
        <Route path="/press" element={<FlexibleRoute><AppLayout forcePublicLayout><PressPage /></AppLayout></FlexibleRoute>} />
        
        {/* Legacy redirect */}
        <Route path="/preview_page.html" element={<Navigate to="/" replace />} />
        
        {/* Admin */}
        <Route path="/admin" element={<AdminRoute><AdminDashboardPage /></AdminRoute>} />
        
        
        {/* Public functional routes (standalone — no MainLayout, need explicit error boundaries) */}
        <Route path="/requests/:id" element={<FlexibleRoute><ErrorBoundary fallbackTitle="Request Error" fallbackMessage="Unable to load this request. The link may be invalid or expired."><RequestCompletionPage /></ErrorBoundary></FlexibleRoute>} />
        <Route path="/newsletter/confirm" element={<FlexibleRoute><ErrorBoundary fallbackTitle="Newsletter Confirmation Error"><NewsletterConfirmPage /></ErrorBoundary></FlexibleRoute>} />
        <Route path="/newsletter/unsubscribe" element={<FlexibleRoute><ErrorBoundary fallbackTitle="Newsletter Unsubscribe Error"><NewsletterUnsubscribePage /></ErrorBoundary></FlexibleRoute>} />
        <Route path="/sign" element={<FlexibleRoute><ErrorBoundary fallbackTitle="Document Signing Error" fallbackMessage="Unable to load the signing interface. Please try the link again or contact the sender."><SignerLandingPage /></ErrorBoundary></FlexibleRoute>} />
        <Route path="/verify-document" element={<FlexibleRoute><ErrorBoundary fallbackTitle="Document Verification Error" fallbackMessage="Unable to verify the document. The link may be invalid or expired."><VerifyDocumentPage /></ErrorBoundary></FlexibleRoute>} />
        <Route path="/verify" element={<FlexibleRoute><ErrorBoundary fallbackTitle="Document Verification Error" fallbackMessage="Unable to verify the document. The link may be invalid or expired."><VerifyDocumentPage /></ErrorBoundary></FlexibleRoute>} />
        
        {/* 404 — always public layout */}
        <Route path="*" element={<FlexibleRoute><AppLayout forcePublicLayout><NotFoundPage /></AppLayout></FlexibleRoute>} />
      </Routes>
    </Suspense>
  );
}
