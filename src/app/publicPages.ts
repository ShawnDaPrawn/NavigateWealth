/**
 * The public site's pages, each in the design this build serves.
 *
 * Every public page exists twice: the live design in src/components/pages/
 * and the Navigator redesign in src/site/pages/. The build's design switch
 * (VITE_SITE_DESIGN, see src/site/design.ts) picks which module each route
 * loads, so a build only ever downloads the design it serves. Reverting the
 * whole public site to the live design is setting the switch back to legacy.
 */
import React from 'react';
import { SITE_DESIGN } from '../site/design';

function byDesign(
  live: () => Promise<{ default: React.ComponentType }>,
  navigator: () => Promise<{ default: React.ComponentType }>,
) {
  return React.lazy(SITE_DESIGN === 'navigator' ? navigator : live);
}

export const LoginPage = byDesign(
  () => import('../components/pages/LoginPage'),
  () => import('../site/pages/NavigatorLoginPage').then((m) => ({ default: m.NavigatorLoginPage })),
);
export const SignupPage = byDesign(
  () => import('../components/pages/SignupPage'),
  () =>
    import('../site/pages/NavigatorSignupPage').then((m) => ({ default: m.NavigatorSignupPage })),
);
export const NotFoundPage = byDesign(
  () => import('../components/pages/NotFoundPage').then((m) => ({ default: m.NotFoundPage })),
  () =>
    import('../site/pages/NavigatorNotFoundPage').then((m) => ({
      default: m.NavigatorNotFoundPage,
    })),
);
export const VerificationSuccessPage = byDesign(
  () => import('../components/pages/VerificationSuccessPage'),
  () =>
    import('../site/pages/NavigatorVerificationSuccessPage').then((m) => ({
      default: m.NavigatorVerificationSuccessPage,
    })),
);
export const HomePage = byDesign(
  () => import('../components/pages/HomePage'),
  () => import('../site/pages/NavigatorHomePage').then((m) => ({ default: m.NavigatorHomePage })),
);
export const ServicesPage = byDesign(
  () => import('../components/pages/ServicesPage'),
  () =>
    import('../site/pages/NavigatorServicesPage').then((m) => ({
      default: m.NavigatorServicesPage,
    })),
);
export const AboutPage = byDesign(
  () => import('../components/pages/AboutPage'),
  () => import('../site/pages/NavigatorAboutPage').then((m) => ({ default: m.NavigatorAboutPage })),
);
export const TeamPage = byDesign(
  () => import('../components/pages/TeamPage'),
  () => import('../site/pages/NavigatorTeamPage').then((m) => ({ default: m.NavigatorTeamPage })),
);
export const ContactPage = byDesign(
  () => import('../components/pages/ContactPage'),
  () =>
    import('../site/pages/NavigatorContactPage').then((m) => ({ default: m.NavigatorContactPage })),
);
export const ScheduleConsultationPage = byDesign(
  () => import('../components/pages/ScheduleConsultationPage'),
  () =>
    import('../site/pages/NavigatorScheduleConsultationPage').then((m) => ({
      default: m.NavigatorScheduleConsultationPage,
    })),
);
export const ResourcesPage = byDesign(
  () => import('../components/pages/ResourcesPage'),
  () =>
    import('../site/pages/NavigatorResourcesPage').then((m) => ({
      default: m.NavigatorResourcesPage,
    })),
);
export const ArticleDetailPage = byDesign(
  () => import('../components/pages/ArticleDetailPage'),
  () =>
    import('../site/pages/NavigatorArticleDetailPage').then((m) => ({
      default: m.NavigatorArticleDetailPage,
    })),
);
export const LegalPage = byDesign(
  () => import('../components/pages/LegalPage'),
  () => import('../site/pages/NavigatorLegalPage').then((m) => ({ default: m.NavigatorLegalPage })),
);
export const LegalDocumentPage = byDesign(
  () => import('../components/pages/LegalDocumentPage'),
  () =>
    import('../site/pages/NavigatorLegalDocumentPage').then((m) => ({
      default: m.NavigatorLegalDocumentPage,
    })),
);
export const NewsletterDetailPage = byDesign(
  () => import('../components/pages/NewsletterDetailPage'),
  () =>
    import('../site/pages/NavigatorNewsletterDetailPage').then((m) => ({
      default: m.NavigatorNewsletterDetailPage,
    })),
);
export const ForgotPasswordPage = byDesign(
  () => import('../components/pages/ForgotPasswordPage'),
  () =>
    import('../site/pages/NavigatorForgotPasswordPage').then((m) => ({
      default: m.NavigatorForgotPasswordPage,
    })),
);
export const ResetPasswordPage = byDesign(
  () => import('../components/pages/ResetPasswordPage'),
  () =>
    import('../site/pages/NavigatorResetPasswordPage').then((m) => ({
      default: m.NavigatorResetPasswordPage,
    })),
);
export const VerifyEmailPage = byDesign(
  () => import('../components/pages/VerifyEmailPage'),
  () =>
    import('../site/pages/NavigatorVerifyEmailPage').then((m) => ({
      default: m.NavigatorVerifyEmailPage,
    })),
);
export const GetQuotePage = byDesign(
  () => import('../components/pages/GetQuotePage'),
  () =>
    import('../site/pages/NavigatorGetQuotePage').then((m) => ({
      default: m.NavigatorGetQuotePage,
    })),
);
export const QuoteServiceContactPage = byDesign(
  () => import('../components/pages/QuoteServiceContactPage'),
  () =>
    import('../site/pages/NavigatorQuoteServiceContactPage').then((m) => ({
      default: m.NavigatorQuoteServiceContactPage,
    })),
);
export const ProductQuotePage = byDesign(
  () => import('../components/pages/ProductQuotePage'),
  () =>
    import('../site/pages/NavigatorProductQuotePage').then((m) => ({
      default: m.NavigatorProductQuotePage,
    })),
);
export const ForIndividualsPage = byDesign(
  () => import('../components/pages/ForIndividualsPage'),
  () =>
    import('../site/pages/NavigatorForIndividualsPage').then((m) => ({
      default: m.NavigatorForIndividualsPage,
    })),
);
export const ForBusinessesPage = byDesign(
  () => import('../components/pages/ForBusinessesPage'),
  () =>
    import('../site/pages/NavigatorForBusinessesPage').then((m) => ({
      default: m.NavigatorForBusinessesPage,
    })),
);
export const ForAdvisersPage = byDesign(
  () => import('../components/pages/ForAdvisersPage'),
  () =>
    import('../site/pages/NavigatorForAdvisersPage').then((m) => ({
      default: m.NavigatorForAdvisersPage,
    })),
);
export const WhyUsPage = byDesign(
  () => import('../components/pages/WhyUsPage'),
  () => import('../site/pages/NavigatorWhyUsPage').then((m) => ({ default: m.NavigatorWhyUsPage })),
);
export const CareersPage = byDesign(
  () => import('../components/pages/CareersPage'),
  () =>
    import('../site/pages/NavigatorCareersPage').then((m) => ({ default: m.NavigatorCareersPage })),
);
export const PressPage = byDesign(
  () => import('../components/pages/PressPage'),
  () => import('../site/pages/NavigatorPressPage').then((m) => ({ default: m.NavigatorPressPage })),
);
export const SitemapPage = byDesign(
  () => import('../components/pages/SitemapPage'),
  () =>
    import('../site/pages/NavigatorSitemapPage').then((m) => ({ default: m.NavigatorSitemapPage })),
);
export const RequestCompletionPage = byDesign(
  () => import('../components/pages/RequestCompletionPage'),
  () =>
    import('../site/pages/NavigatorRequestCompletionPage').then((m) => ({
      default: m.NavigatorRequestCompletionPage,
    })),
);
export const NewsletterConfirmPage = byDesign(
  () => import('../components/pages/NewsletterConfirmPage'),
  () =>
    import('../site/pages/NavigatorNewsletterConfirmPage').then((m) => ({
      default: m.NavigatorNewsletterConfirmPage,
    })),
);
export const NewsletterClickThroughPage = byDesign(
  () => import('../components/pages/NewsletterClickThroughPage'),
  () =>
    import('../site/pages/NavigatorNewsletterClickThroughPage').then((m) => ({
      default: m.NavigatorNewsletterClickThroughPage,
    })),
);
export const NewsletterUnsubscribePage = byDesign(
  () => import('../components/pages/NewsletterUnsubscribePage'),
  () =>
    import('../site/pages/NavigatorNewsletterUnsubscribePage').then((m) => ({
      default: m.NavigatorNewsletterUnsubscribePage,
    })),
);
export const VerifyDocumentPage = byDesign(
  () => import('../components/pages/VerifyDocumentPage'),
  () =>
    import('../site/pages/NavigatorVerifyDocumentPage').then((m) => ({
      default: m.NavigatorVerifyDocumentPage,
    })),
);
export const LinktreePage = byDesign(
  () => import('../components/pages/LinktreePage'),
  () =>
    import('../site/pages/NavigatorLinktreePage').then((m) => ({
      default: m.NavigatorLinktreePage,
    })),
);
export const AskVascoPage = byDesign(
  () => import('../components/pages/AskVascoPage'),
  () =>
    import('../site/pages/NavigatorAskVascoPage').then((m) => ({
      default: m.NavigatorAskVascoPage,
    })),
);
