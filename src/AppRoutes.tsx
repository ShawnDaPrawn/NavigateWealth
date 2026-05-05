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
import { AdminDashboardPage } from './components/pages/AdminDashboardPage';

// ==================== LAZY-LOADED PAGES ====================
// All non-critical pages are lazy-loaded to reduce initial bundle parse time.
const HomePage = React.lazy(() => import('./components/pages/HomePage'));
const ServicesPage = React.lazy(() => import('./components/pages/ServicesPage'));
const AboutPage = React.lazy(() => import('./components/pages/AboutPage'));
const TeamPage = React.lazy(() => import('./components/pages/TeamPage'));
const ContactPage = React.lazy(() => import('./components/pages/ContactPage'));
const ScheduleConsultationPage = React.lazy(() => import('./components/pages/ScheduleConsultationPage'));

const ResourcesPage = React.lazy(() => import('./components/pages/ResourcesPage'));
const ArticleDetailPage = React.lazy(() => import('./components/pages/ArticleDetailPage'));
const DesignSystemPage = React.lazy(() => import('./components/pages/DesignSystemPage'));
const LegalPage = React.lazy(() => import('./components/pages/LegalPage'));
const LegalDocumentPage = React.lazy(() => import('./components/pages/LegalDocumentPage'));
const LegalPdfQaPage = React.lazy(() => import('./components/pages/LegalPdfQaPage'));
const ForgotPasswordPage = React.lazy(() => import('./components/pages/ForgotPasswordPage'));
const ResetPasswordPage = React.lazy(() => import('./components/pages/ResetPasswordPage'));
const VerifyEmailPage = React.lazy(() => import('./components/pages/VerifyEmailPage'));
const GetStartedPage = React.lazy(() => import('./components/pages/GetStartedPage'));
const GetQuotePage = React.lazy(() => import('./components/pages/GetQuotePage'));
const QuoteServiceContactPage = React.lazy(() => import('./components/pages/QuoteServiceContactPage'));

const ProductQuotePage = React.lazy(() => import('./components/pages/ProductQuotePage'));
const AccountTypeSelectionPage = React.lazy(() => import('./components/pages/AccountTypeSelectionPage'));
const ApplicationPage = React.lazy(() => import('./components/pages/ApplicationPage'));
const PendingDashboardPage = React.lazy(() => import('./components/pages/PendingDashboardPage'));
const DeclinedApplicationPage = React.lazy(() => import('./components/pages/DeclinedApplicationPage'));
const HomeDashboardPage = React.lazy(() => import('./components/pages/HomeDashboardPage'));
const ProductsServicesDashboardPage = React.lazy(() => import('./components/pages/ProductsServicesDashboardPage'));
const RiskManagementDashboardPage = React.lazy(() => import('./components/pages/RiskManagementDashboardPage'));
const MedicalAidDashboardPage = React.lazy(() => import('./components/pages/MedicalAidDashboardPage'));
const RetirementPlanningDashboardPage = React.lazy(() => import('./components/pages/RetirementPlanningDashboardPage'));
const InvestmentManagementDashboardPage = React.lazy(() => import('./components/pages/InvestmentManagementDashboardPage'));
const EmployeeBenefitsDashboardPage = React.lazy(() => import('./components/pages/EmployeeBenefitsDashboardPage'));
const TaxPlanningDashboardPage = React.lazy(() => import('./components/pages/TaxPlanningDashboardPage'));
const EstatePlanningDashboardPage = React.lazy(() => import('./components/pages/EstatePlanningDashboardPage'));
const AIAdvisorPage = React.lazy(() => import('./components/pages/AIAdvisorPage'));
const HistoryPage = React.lazy(() => import('./components/pages/HistoryPage'));
const ProductsServicesPage = React.lazy(() => import('./components/pages/ProductsServicesPage'));
const CommunicationPage = React.lazy(() => import('./components/client/communication/CommunicationPage'));
const ClientEsignHistoryPage = React.lazy(() => import('./components/client/e-sign/ClientEsignHistoryPage'));
const TransactionsDocumentsPage = React.lazy(() => import('./components/pages/TransactionsDocumentsPage'));
const ProfilePage = React.lazy(() => import('./components/pages/ProfilePage'));
const SecuritySettingsPage = React.lazy(() => import('./components/pages/SecuritySettingsPage'));
import { RiskManagementPage } from './components/pages/RiskManagementPage';
const RetirementPlanningPage = React.lazy(() => import('./components/pages/RetirementPlanningPage'));
const InvestmentManagementPage = React.lazy(() => import('./components/pages/InvestmentManagementPage'));
const TaxPlanningPage = React.lazy(() => import('./components/pages/TaxPlanningPage'));
const EstatePlanningPage = React.lazy(() => import('./components/pages/EstatePlanningPage'));
const FinancialPlanningPage = React.lazy(() => import('./components/pages/FinancialPlanningPage'));
const MedicalAidPage = React.lazy(() => import('./components/pages/MedicalAidPage'));
const MyAdviserPage = React.lazy(() => import('./components/pages/MyAdviserPage'));
const ForIndividualsPage = React.lazy(() => import('./components/pages/ForIndividualsPage'));
const ForBusinessesPage = React.lazy(() => import('./components/pages/ForBusinessesPage'));
const ForAdvisersPage = React.lazy(() => import('./components/pages/ForAdvisersPage'));
const WhyUsPage = React.lazy(() => import('./components/pages/WhyUsPage'));
const CareersPage = React.lazy(() => import('./components/pages/CareersPage'));
const PressPage = React.lazy(() => import('./components/pages/PressPage'));
const EmployeeBenefitsPage = React.lazy(() => import('./components/pages/EmployeeBenefitsPage'));
const SitemapPage = React.lazy(() => import('./components/pages/SitemapPage'));
const RequestCompletionPage = React.lazy(() => import('./components/pages/RequestCompletionPage'));
const NewsletterConfirmPage = React.lazy(() => import('./components/pages/NewsletterConfirmPage'));
const NewsletterUnsubscribePage = React.lazy(() => import('./components/pages/NewsletterUnsubscribePage'));
const RobotsTxtPage = React.lazy(() => import('./components/pages/RobotsTxtPage'));
const SignerLandingPage = React.lazy(() => import('./components/esign-signer/SignerLandingPage'));
const VerifyDocumentPage = React.lazy(() => import('./components/pages/VerifyDocumentPage'));
const OGImageGeneratorPage = React.lazy(() => import('./components/pages/OGImageGeneratorPage'));
const LinktreePage = React.lazy(() => import('./components/pages/LinktreePage'));
const LinkedInCallbackPage = React.lazy(() => import('./components/pages/LinkedInCallbackPage'));
const AskVascoPage = React.lazy(() => import('./components/pages/AskVascoPage'));

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
        <Route path="/legal/:slug" element={<FlexibleRoute><AppLayout forcePublicLayout><LegalDocumentPage /></AppLayout></FlexibleRoute>} />
        <Route path="/sitemap" element={<FlexibleRoute><AppLayout forcePublicLayout><SitemapPage /></AppLayout></FlexibleRoute>} />
        <Route path="/robots.txt" element={<RobotsTxtPage />} />
        
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
        <Route path="/e-signatures" element={<DashboardRoute><AppLayout><ClientEsignHistoryPage /></AppLayout></DashboardRoute>} />
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
        <Route path="/admin/issues" element={<AdminRoute><Navigate to="/admin?module=issues" replace /></AdminRoute>} />
        <Route path="/admin/legal-pdf-qa" element={<AdminRoute><LegalPdfQaPage /></AdminRoute>} />
        
        
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
