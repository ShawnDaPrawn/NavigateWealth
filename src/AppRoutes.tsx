import { Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router';
import { lazyWithRetry } from './utils/lazyWithRetry';
import { MainLayout as AppLayout } from './components/layout/MainLayout';
import { ErrorBoundary } from './components/shared/ErrorBoundary';
import { BrandPageLoader } from './components/ui/brand-loader';
import { isStandaloneDisplay } from './utils/pwa/displayMode';

// Shared loading fallback for lazy-loaded routes
function RouteFallback() {
  // In the installed PWA the entry screen is the login page. Rendering the
  // animated brand loader between the native app-icon splash and the login
  // screen produces a jarring third "flash". Instead, show a seamless screen
  // that matches the auth background so the login form simply appears in place —
  // splash → login, with no loader in between. (Normal browser tabs keep the
  // branded loader.)
  if (isStandaloneDisplay()) {
    return (
      <div
        className="min-h-[100dvh] bg-gradient-to-b from-purple-50 via-white to-white"
        aria-hidden="true"
      />
    );
  }

  return (
    <>
      <BrandPageLoader
        title="Plotting your course"
        message="Setting your bearing and carrying your session to the next screen."
      />
      <span className="sr-only">Loading, please wait…</span>
    </>
  );
}

// ==================== CRITICAL-PATH (EAGER) IMPORTS ====================
// Only import what's needed for the initial page load and lightweight pages
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
const LoginPage = lazyWithRetry(() => import('./components/pages/LoginPage'));
const SignupPage = lazyWithRetry(() => import('./components/pages/SignupPage'));
const NotFoundPage = lazyWithRetry(() =>
  import('./components/pages/NotFoundPage').then((m) => ({ default: m.NotFoundPage })),
);
const AuthCallbackPage = lazyWithRetry(() => import('./components/pages/AuthCallbackPage'));
const VerificationSuccessPage = lazyWithRetry(
  () => import('./components/pages/VerificationSuccessPage'),
);
const HomePage = lazyWithRetry(() => import('./components/pages/HomePage'));
const ServicesPage = lazyWithRetry(() => import('./components/pages/ServicesPage'));
const AboutPage = lazyWithRetry(() => import('./components/pages/AboutPage'));
const TeamPage = lazyWithRetry(() => import('./components/pages/TeamPage'));
const ContactPage = lazyWithRetry(() => import('./components/pages/ContactPage'));
const ScheduleConsultationPage = lazyWithRetry(
  () => import('./components/pages/ScheduleConsultationPage'),
);

const ResourcesPage = lazyWithRetry(() => import('./components/pages/ResourcesPage'));
const ArticleDetailPage = lazyWithRetry(() => import('./components/pages/ArticleDetailPage'));
const DesignSystemPage = lazyWithRetry(() => import('./components/pages/DesignSystemPage'));
const LegalPage = lazyWithRetry(() => import('./components/pages/LegalPage'));
const LegalDocumentPage = lazyWithRetry(() => import('./components/pages/LegalDocumentPage'));
const LegalPdfQaPage = lazyWithRetry(() => import('./components/pages/LegalPdfQaPage'));
const ForgotPasswordPage = lazyWithRetry(() => import('./components/pages/ForgotPasswordPage'));
const ResetPasswordPage = lazyWithRetry(() => import('./components/pages/ResetPasswordPage'));
const VerifyEmailPage = lazyWithRetry(() => import('./components/pages/VerifyEmailPage'));
const GetStartedPage = lazyWithRetry(() => import('./components/pages/GetStartedPage'));
const GetQuotePage = lazyWithRetry(() => import('./components/pages/GetQuotePage'));
const QuoteServiceContactPage = lazyWithRetry(
  () => import('./components/pages/QuoteServiceContactPage'),
);

const ProductQuotePage = lazyWithRetry(() => import('./components/pages/ProductQuotePage'));
const AccountTypeSelectionPage = lazyWithRetry(
  () => import('./components/pages/AccountTypeSelectionPage'),
);
const ApplicationPage = lazyWithRetry(() => import('./components/pages/ApplicationPage'));
const PendingDashboardPage = lazyWithRetry(() => import('./components/pages/PendingDashboardPage'));
const DeclinedApplicationPage = lazyWithRetry(
  () => import('./components/pages/DeclinedApplicationPage'),
);
const HomeDashboardPage = lazyWithRetry(() => import('./components/pages/HomeDashboardPage'));
const ProductsServicesDashboardPage = lazyWithRetry(
  () => import('./components/pages/ProductsServicesDashboardPage'),
);
const RiskManagementDashboardPage = lazyWithRetry(
  () => import('./components/pages/RiskManagementDashboardPage'),
);
const MedicalAidDashboardPage = lazyWithRetry(
  () => import('./components/pages/MedicalAidDashboardPage'),
);
const RetirementPlanningDashboardPage = lazyWithRetry(
  () => import('./components/pages/RetirementPlanningDashboardPage'),
);
const InvestmentManagementDashboardPage = lazyWithRetry(
  () => import('./components/pages/InvestmentManagementDashboardPage'),
);
const EmployeeBenefitsDashboardPage = lazyWithRetry(
  () => import('./components/pages/EmployeeBenefitsDashboardPage'),
);
const TaxPlanningDashboardPage = lazyWithRetry(
  () => import('./components/pages/TaxPlanningDashboardPage'),
);
const EstatePlanningDashboardPage = lazyWithRetry(
  () => import('./components/pages/EstatePlanningDashboardPage'),
);
const AIAdvisorPage = lazyWithRetry(() => import('./components/pages/AIAdvisorPage'));
const HistoryPage = lazyWithRetry(() => import('./components/pages/HistoryPage'));
const ProductsServicesPage = lazyWithRetry(() => import('./components/pages/ProductsServicesPage'));
const CommunicationPage = lazyWithRetry(
  () => import('./components/client/communication/CommunicationPage'),
);
const ClientEsignHistoryPage = lazyWithRetry(
  () => import('./components/client/e-sign/ClientEsignHistoryPage'),
);
const TransactionsDocumentsPage = lazyWithRetry(
  () => import('./components/pages/TransactionsDocumentsPage'),
);
const ProfilePage = lazyWithRetry(() => import('./components/pages/ProfilePage'));
const SecuritySettingsPage = lazyWithRetry(() => import('./components/pages/SecuritySettingsPage'));
const RiskManagementPage = lazyWithRetry(() =>
  import('./components/pages/RiskManagementPage').then((m) => ({ default: m.RiskManagementPage })),
);
const RetirementPlanningPage = lazyWithRetry(
  () => import('./components/pages/RetirementPlanningPage'),
);
const InvestmentManagementPage = lazyWithRetry(
  () => import('./components/pages/InvestmentManagementPage'),
);
const TaxPlanningPage = lazyWithRetry(() => import('./components/pages/TaxPlanningPage'));
const EstatePlanningPage = lazyWithRetry(() => import('./components/pages/EstatePlanningPage'));
const FinancialPlanningPage = lazyWithRetry(
  () => import('./components/pages/FinancialPlanningPage'),
);
const MedicalAidPage = lazyWithRetry(() => import('./components/pages/MedicalAidPage'));
const MyAdviserPage = lazyWithRetry(() => import('./components/pages/MyAdviserPage'));
const ForIndividualsPage = lazyWithRetry(() => import('./components/pages/ForIndividualsPage'));
const ForBusinessesPage = lazyWithRetry(() => import('./components/pages/ForBusinessesPage'));
const ForAdvisersPage = lazyWithRetry(() => import('./components/pages/ForAdvisersPage'));
const WhyUsPage = lazyWithRetry(() => import('./components/pages/WhyUsPage'));
const CareersPage = lazyWithRetry(() => import('./components/pages/CareersPage'));
const PressPage = lazyWithRetry(() => import('./components/pages/PressPage'));
const EmployeeBenefitsPage = lazyWithRetry(() => import('./components/pages/EmployeeBenefitsPage'));
const SitemapPage = lazyWithRetry(() => import('./components/pages/SitemapPage'));
const RequestCompletionPage = lazyWithRetry(
  () => import('./components/pages/RequestCompletionPage'),
);
const NewsletterConfirmPage = lazyWithRetry(
  () => import('./components/pages/NewsletterConfirmPage'),
);
const NewsletterUnsubscribePage = lazyWithRetry(
  () => import('./components/pages/NewsletterUnsubscribePage'),
);
const RobotsTxtPage = lazyWithRetry(() => import('./components/pages/RobotsTxtPage'));
const SignerLandingPage = lazyWithRetry(
  () => import('./components/esign-signer/SignerLandingPage'),
);
const ManageAppointmentPage = lazyWithRetry(
  () => import('./components/appointment-manage/ManageAppointmentPage'),
);
const VerifyDocumentPage = lazyWithRetry(() => import('./components/pages/VerifyDocumentPage'));
const OGImageGeneratorPage = lazyWithRetry(() => import('./components/pages/OGImageGeneratorPage'));
const LinktreePage = lazyWithRetry(() => import('./components/pages/LinktreePage'));
const LinkedInCallbackPage = lazyWithRetry(() => import('./components/pages/LinkedInCallbackPage'));
const AskVascoPage = lazyWithRetry(() => import('./components/pages/AskVascoPage'));
const AdminDashboardPage = lazyWithRetry(() =>
  import('./components/pages/AdminDashboardPage').then((m) => ({ default: m.AdminDashboardPage })),
);

export function AppRoutes() {
  return (
    <Suspense fallback={<RouteFallback />}>
      <Routes>
        {/* Public website routes — always show public layout even if user is logged in elsewhere */}
        <Route
          path="/"
          element={
            <FlexibleRoute>
              <AppLayout forcePublicLayout>
                <HomePage />
              </AppLayout>
            </FlexibleRoute>
          }
        />
        <Route
          path="/services"
          element={
            <FlexibleRoute>
              <AppLayout forcePublicLayout>
                <ServicesPage />
              </AppLayout>
            </FlexibleRoute>
          }
        />
        <Route
          path="/about"
          element={
            <FlexibleRoute>
              <AppLayout forcePublicLayout>
                <AboutPage />
              </AppLayout>
            </FlexibleRoute>
          }
        />
        <Route
          path="/team"
          element={
            <FlexibleRoute>
              <AppLayout forcePublicLayout>
                <TeamPage />
              </AppLayout>
            </FlexibleRoute>
          }
        />
        <Route
          path="/contact"
          element={
            <FlexibleRoute>
              <AppLayout forcePublicLayout>
                <ContactPage />
              </AppLayout>
            </FlexibleRoute>
          }
        />
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
        <Route
          path="/resources"
          element={
            <FlexibleRoute>
              <AppLayout forcePublicLayout>
                <ResourcesPage />
              </AppLayout>
            </FlexibleRoute>
          }
        />
        <Route
          path="/resources/article/:slug"
          element={
            <FlexibleRoute>
              <AppLayout forcePublicLayout>
                <ArticleDetailPage />
              </AppLayout>
            </FlexibleRoute>
          }
        />
        <Route
          path="/design-system"
          element={
            <FlexibleRoute>
              <AppLayout forcePublicLayout>
                <DesignSystemPage />
              </AppLayout>
            </FlexibleRoute>
          }
        />

        {/* Ask Vasco — Public AI Financial Navigator (uses public layout with nav) */}
        <Route
          path="/ask-vasco"
          element={
            <FlexibleRoute>
              <AppLayout forcePublicLayout>
                <AskVascoPage />
              </AppLayout>
            </FlexibleRoute>
          }
        />

        {/* OG Image Generator — bare route, no layout, not indexed */}
        <Route path="/og-preview" element={<OGImageGeneratorPage />} />

        {/* Linktree — bare route, no layout, public-facing link-in-bio page */}
        <Route path="/links" element={<LinktreePage />} />

        {/* LinkedIn OAuth callback — bare route, no layout */}
        <Route path="/auth/linkedin/callback" element={<LinkedInCallbackPage />} />

        {/* Legal & Sitemap — always public layout */}
        <Route
          path="/legal"
          element={
            <FlexibleRoute>
              <AppLayout forcePublicLayout>
                <LegalPage />
              </AppLayout>
            </FlexibleRoute>
          }
        />
        <Route
          path="/legal/:slug"
          element={
            <FlexibleRoute>
              <AppLayout forcePublicLayout>
                <LegalDocumentPage />
              </AppLayout>
            </FlexibleRoute>
          }
        />
        <Route
          path="/sitemap"
          element={
            <FlexibleRoute>
              <AppLayout forcePublicLayout>
                <SitemapPage />
              </AppLayout>
            </FlexibleRoute>
          }
        />
        <Route path="/robots.txt" element={<RobotsTxtPage />} />

        {/* Get Quote — always public layout (contact route must be registered before :service) */}
        <Route
          path="/get-quote"
          element={
            <FlexibleRoute>
              <AppLayout forcePublicLayout>
                <GetQuotePage />
              </AppLayout>
            </FlexibleRoute>
          }
        />
        <Route
          path="/get-quote/:service/contact"
          element={
            <FlexibleRoute>
              <AppLayout forcePublicLayout>
                <QuoteServiceContactPage />
              </AppLayout>
            </FlexibleRoute>
          }
        />
        <Route
          path="/get-quote/:service"
          element={
            <FlexibleRoute>
              <AppLayout forcePublicLayout>
                <ProductQuotePage />
              </AppLayout>
            </FlexibleRoute>
          }
        />

        {/* Auth routes */}
        <Route
          path="/login"
          element={
            <FlexibleRoute>
              <AppLayout showNavAndFooter={true} forcePublicLayout>
                <LoginPage />
              </AppLayout>
            </FlexibleRoute>
          }
        />
        <Route
          path="/signup"
          element={
            <PublicRoute>
              <AppLayout showNavAndFooter={true}>
                <SignupPage />
              </AppLayout>
            </PublicRoute>
          }
        />
        <Route
          path="/forgot-password"
          element={
            <PublicRoute>
              <AppLayout showNavAndFooter={true}>
                <ForgotPasswordPage />
              </AppLayout>
            </PublicRoute>
          }
        />
        <Route
          path="/reset-password"
          element={
            <FlexibleRoute>
              <AppLayout showNavAndFooter={false}>
                <ResetPasswordPage />
              </AppLayout>
            </FlexibleRoute>
          }
        />
        <Route
          path="/verify-email"
          element={
            <PublicRoute>
              <AppLayout showNavAndFooter={false}>
                <VerifyEmailPage />
              </AppLayout>
            </PublicRoute>
          }
        />
        <Route
          path="/auth/callback"
          element={
            <FlexibleRoute>
              <AppLayout showNavAndFooter={false}>
                <AuthCallbackPage />
              </AppLayout>
            </FlexibleRoute>
          }
        />
        <Route
          path="/verification-success"
          element={
            <FlexibleRoute>
              <AppLayout showNavAndFooter={false}>
                <VerificationSuccessPage />
              </AppLayout>
            </FlexibleRoute>
          }
        />

        {/* Onboarding & Application routes */}
        <Route
          path="/account-type"
          element={
            <OnboardingRoute>
              <AppLayout>
                <AccountTypeSelectionPage />
              </AppLayout>
            </OnboardingRoute>
          }
        />
        <Route
          path="/get-started"
          element={
            <ProtectedRoute>
              <AppLayout>
                <GetStartedPage />
              </AppLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/application"
          element={
            <ApplicationRoute>
              <AppLayout>
                <ApplicationPage />
              </AppLayout>
            </ApplicationRoute>
          }
        />
        <Route
          path="/application/personal-client"
          element={
            <ApplicationRoute>
              <AppLayout>
                <ApplicationPage />
              </AppLayout>
            </ApplicationRoute>
          }
        />
        <Route
          path="/dashboard/pending"
          element={
            <PendingRoute>
              <AppLayout>
                <PendingDashboardPage />
              </AppLayout>
            </PendingRoute>
          }
        />
        <Route
          path="/application/declined"
          element={
            <DeclinedRoute>
              <AppLayout>
                <DeclinedApplicationPage />
              </AppLayout>
            </DeclinedRoute>
          }
        />
        <Route
          path="/onboarding/choose-account"
          element={
            <OnboardingRoute>
              <AppLayout>
                <AccountTypeSelectionPage />
              </AppLayout>
            </OnboardingRoute>
          }
        />

        {/* Dashboard routes */}
        <Route
          path="/dashboard"
          element={
            <DashboardRoute>
              <AppLayout>
                <FirstLoginTermsGate>
                  <ApplicationStatusGuard requireApproved={true}>
                    <HomeDashboardPage />
                  </ApplicationStatusGuard>
                </FirstLoginTermsGate>
              </AppLayout>
            </DashboardRoute>
          }
        />
        <Route
          path="/products-services-dashboard"
          element={
            <DashboardRoute>
              <AppLayout>
                <ProductsServicesDashboardPage />
              </AppLayout>
            </DashboardRoute>
          }
        />
        <Route
          path="/dashboard/risk-management"
          element={
            <DashboardRoute>
              <AppLayout>
                <RiskManagementDashboardPage />
              </AppLayout>
            </DashboardRoute>
          }
        />
        <Route
          path="/dashboard/medical-aid"
          element={
            <DashboardRoute>
              <AppLayout>
                <MedicalAidDashboardPage />
              </AppLayout>
            </DashboardRoute>
          }
        />
        <Route
          path="/dashboard/retirement-planning"
          element={
            <DashboardRoute>
              <AppLayout>
                <RetirementPlanningDashboardPage />
              </AppLayout>
            </DashboardRoute>
          }
        />
        <Route
          path="/dashboard/investment-management"
          element={
            <DashboardRoute>
              <AppLayout>
                <InvestmentManagementDashboardPage />
              </AppLayout>
            </DashboardRoute>
          }
        />
        <Route
          path="/dashboard/employee-benefits"
          element={
            <DashboardRoute>
              <AppLayout>
                <EmployeeBenefitsDashboardPage />
              </AppLayout>
            </DashboardRoute>
          }
        />
        <Route
          path="/dashboard/tax-planning"
          element={
            <DashboardRoute>
              <AppLayout>
                <TaxPlanningDashboardPage />
              </AppLayout>
            </DashboardRoute>
          }
        />
        <Route
          path="/dashboard/estate-planning"
          element={
            <DashboardRoute>
              <AppLayout>
                <EstatePlanningDashboardPage />
              </AppLayout>
            </DashboardRoute>
          }
        />
        <Route
          path="/ai-advisor"
          element={
            <DashboardRoute>
              <AppLayout>
                <AIAdvisorPage />
              </AppLayout>
            </DashboardRoute>
          }
        />
        <Route
          path="/history"
          element={
            <DashboardRoute>
              <AppLayout>
                <HistoryPage />
              </AppLayout>
            </DashboardRoute>
          }
        />
        <Route
          path="/products-services"
          element={
            <DashboardRoute>
              <AppLayout>
                <ProductsServicesPage />
              </AppLayout>
            </DashboardRoute>
          }
        />
        <Route
          path="/communication"
          element={
            <DashboardRoute>
              <AppLayout>
                <CommunicationPage />
              </AppLayout>
            </DashboardRoute>
          }
        />
        <Route
          path="/e-signatures"
          element={
            <DashboardRoute>
              <AppLayout>
                <ClientEsignHistoryPage />
              </AppLayout>
            </DashboardRoute>
          }
        />
        <Route
          path="/transactions-documents"
          element={
            <DashboardRoute>
              <AppLayout>
                <TransactionsDocumentsPage />
              </AppLayout>
            </DashboardRoute>
          }
        />
        <Route
          path="/profile"
          element={
            <DashboardRoute>
              <AppLayout>
                <ProfilePage />
              </AppLayout>
            </DashboardRoute>
          }
        />
        <Route
          path="/security"
          element={
            <DashboardRoute>
              <AppLayout>
                <SecuritySettingsPage />
              </AppLayout>
            </DashboardRoute>
          }
        />
        <Route
          path="/my-adviser"
          element={
            <DashboardRoute>
              <AppLayout>
                <MyAdviserPage />
              </AppLayout>
            </DashboardRoute>
          }
        />

        {/* Service pages — always public layout */}
        <Route
          path="/risk-management"
          element={
            <FlexibleRoute>
              <AppLayout forcePublicLayout>
                <RiskManagementPage />
              </AppLayout>
            </FlexibleRoute>
          }
        />
        <Route
          path="/retirement-planning"
          element={
            <FlexibleRoute>
              <AppLayout forcePublicLayout>
                <RetirementPlanningPage />
              </AppLayout>
            </FlexibleRoute>
          }
        />
        <Route
          path="/investment-management"
          element={
            <FlexibleRoute>
              <AppLayout forcePublicLayout>
                <InvestmentManagementPage />
              </AppLayout>
            </FlexibleRoute>
          }
        />
        <Route
          path="/employee-benefits"
          element={
            <FlexibleRoute>
              <AppLayout forcePublicLayout>
                <EmployeeBenefitsPage />
              </AppLayout>
            </FlexibleRoute>
          }
        />
        <Route
          path="/tax-planning"
          element={
            <FlexibleRoute>
              <AppLayout forcePublicLayout>
                <TaxPlanningPage />
              </AppLayout>
            </FlexibleRoute>
          }
        />
        <Route
          path="/financial-planning"
          element={
            <FlexibleRoute>
              <AppLayout forcePublicLayout>
                <FinancialPlanningPage />
              </AppLayout>
            </FlexibleRoute>
          }
        />
        <Route
          path="/estate-planning"
          element={
            <FlexibleRoute>
              <AppLayout forcePublicLayout>
                <EstatePlanningPage />
              </AppLayout>
            </FlexibleRoute>
          }
        />
        <Route
          path="/medical-aid"
          element={
            <FlexibleRoute>
              <AppLayout forcePublicLayout>
                <MedicalAidPage />
              </AppLayout>
            </FlexibleRoute>
          }
        />

        {/* Solutions pages — always public layout */}
        <Route
          path="/solutions/individuals"
          element={
            <FlexibleRoute>
              <AppLayout forcePublicLayout>
                <ForIndividualsPage />
              </AppLayout>
            </FlexibleRoute>
          }
        />
        <Route
          path="/solutions/businesses"
          element={
            <FlexibleRoute>
              <AppLayout forcePublicLayout>
                <ForBusinessesPage />
              </AppLayout>
            </FlexibleRoute>
          }
        />
        <Route
          path="/solutions/advisers"
          element={
            <FlexibleRoute>
              <AppLayout forcePublicLayout>
                <ForAdvisersPage />
              </AppLayout>
            </FlexibleRoute>
          }
        />

        {/* Company pages — always public layout */}
        <Route
          path="/why-us"
          element={
            <FlexibleRoute>
              <AppLayout forcePublicLayout>
                <WhyUsPage />
              </AppLayout>
            </FlexibleRoute>
          }
        />
        <Route
          path="/careers"
          element={
            <FlexibleRoute>
              <AppLayout forcePublicLayout>
                <CareersPage />
              </AppLayout>
            </FlexibleRoute>
          }
        />
        <Route
          path="/press"
          element={
            <FlexibleRoute>
              <AppLayout forcePublicLayout>
                <PressPage />
              </AppLayout>
            </FlexibleRoute>
          }
        />

        {/* Legacy redirect */}
        <Route path="/preview_page.html" element={<Navigate to="/" replace />} />

        {/* Admin */}
        <Route
          path="/admin"
          element={
            <AdminRoute>
              <AdminDashboardPage />
            </AdminRoute>
          }
        />
        <Route
          path="/admin/issues"
          element={
            <AdminRoute>
              <Navigate to="/admin?module=issues" replace />
            </AdminRoute>
          }
        />
        <Route
          path="/admin/legal-pdf-qa"
          element={
            <AdminRoute>
              <LegalPdfQaPage />
            </AdminRoute>
          }
        />

        {/* Public functional routes (standalone — no MainLayout, need explicit error boundaries) */}
        <Route
          path="/requests/:id"
          element={
            <FlexibleRoute>
              <ErrorBoundary
                fallbackTitle="Request Error"
                fallbackMessage="Unable to load this request. The link may be invalid or expired."
              >
                <RequestCompletionPage />
              </ErrorBoundary>
            </FlexibleRoute>
          }
        />
        <Route
          path="/newsletter/confirm"
          element={
            <FlexibleRoute>
              <ErrorBoundary fallbackTitle="Newsletter Confirmation Error">
                <NewsletterConfirmPage />
              </ErrorBoundary>
            </FlexibleRoute>
          }
        />
        <Route
          path="/newsletter/unsubscribe"
          element={
            <FlexibleRoute>
              <ErrorBoundary fallbackTitle="Newsletter Unsubscribe Error">
                <NewsletterUnsubscribePage />
              </ErrorBoundary>
            </FlexibleRoute>
          }
        />
        <Route
          path="/sign"
          element={
            <FlexibleRoute>
              <ErrorBoundary
                fallbackTitle="Document Signing Error"
                fallbackMessage="Unable to load the signing interface. Please try the link again or contact the sender."
              >
                <SignerLandingPage />
              </ErrorBoundary>
            </FlexibleRoute>
          }
        />
        <Route
          path="/appointment"
          element={
            <FlexibleRoute>
              <ErrorBoundary
                fallbackTitle="Appointment Error"
                fallbackMessage="Unable to load the appointment. Please try the link from your email again or contact us."
              >
                <ManageAppointmentPage />
              </ErrorBoundary>
            </FlexibleRoute>
          }
        />
        <Route
          path="/verify-document"
          element={
            <FlexibleRoute>
              <ErrorBoundary
                fallbackTitle="Document Verification Error"
                fallbackMessage="Unable to verify the document. The link may be invalid or expired."
              >
                <VerifyDocumentPage />
              </ErrorBoundary>
            </FlexibleRoute>
          }
        />
        <Route
          path="/verify"
          element={
            <FlexibleRoute>
              <ErrorBoundary
                fallbackTitle="Document Verification Error"
                fallbackMessage="Unable to verify the document. The link may be invalid or expired."
              >
                <VerifyDocumentPage />
              </ErrorBoundary>
            </FlexibleRoute>
          }
        />

        {/* 404 — always public layout */}
        <Route
          path="*"
          element={
            <FlexibleRoute>
              <AppLayout forcePublicLayout>
                <NotFoundPage />
              </AppLayout>
            </FlexibleRoute>
          }
        />
      </Routes>
    </Suspense>
  );
}
