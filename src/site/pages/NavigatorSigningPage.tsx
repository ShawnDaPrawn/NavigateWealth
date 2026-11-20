/**
 * NavigatorSigningPage — the redesigned page a signer opens from their email
 * (/sign?token=…), the "Sign document" (ESign) board of the Website Redesign
 * canvas.
 *
 * It runs the live signer flow itself (useSignerLandingFlow): the token is
 * read once and cleared from the address bar, validated with the same call,
 * and the same rules pick the step — the emailed code or access code, the
 * identity check, waiting for an earlier signer, signing, done, declined, or
 * the link unavailable. Each step reuses the live step's own logic, so the
 * calls, payloads, PDF rendering, signature images, consent text and messages
 * are the live page's; only the drawing is the board's.
 *
 * The route is standalone (no site header or footer), as the board draws it,
 * so the page carries its own `.nw-site` scope. Like the live page it sets no
 * SEO tags.
 *
 * Not on the board, drawn in its language with the live words: "Session
 * Error" (no session after validation), a document that is still loading or
 * failed to load, a locked document (not this signer's turn), the
 * pick-an-option dialog and a saved signature.
 */
import { useNavigate } from 'react-router';
import { useSignerLandingFlow } from '../../components/esign-signer/hooks/useSignerLandingFlow';
import { useSignerBranding } from '../../components/esign-signer/hooks/useSignerBranding';
import { normaliseLang, t } from '../../components/esign-signer/i18n';
import { COMPANY } from '../../config/companyFacts';
import {
  ESignCardPage,
  ESignExpired,
  ESignLoading,
  ESignRejected,
  ESignWaiting,
} from '../sections/ESignCard';
import { ESignComplete } from '../sections/ESignComplete';
import { ESignKbaCard, ESignOtpCard } from '../sections/ESignVerify';
import { ESignWorkspace } from '../sections/ESignWorkspace';
import '../styles/navigator.css';
import '../styles/esign.css';

export function NavigatorSigningPage() {
  const navigate = useNavigate();
  const {
    token,
    currentStep,
    errorMessage,
    sessionData,
    verifyOtp,
    verifyKba,
    submitSignature,
    resendOtp,
    handleChallengeVerified,
    handleSigningComplete,
    handleReject,
  } = useSignerLandingFlow();

  // P8.6 / P8.7 — firm branding and the signer's language, as live. A firm
  // that has set its own accent colours the loading band (the live page's one
  // use of it); otherwise the board's ink.
  const branding = useSignerBranding(sessionData?.branding ?? null);
  const lang = normaliseLang(sessionData?.signer_language);
  const accentStyle = sessionData?.branding?.accent_hex ? branding.stripStyle : undefined;
  const supportEmail = branding.supportEmail ?? COMPANY.email;
  const goHome = () => navigate('/');
  const card = { lang, supportEmail };

  switch (currentStep) {
    case 'loading':
      return (
        <ESignCardPage
          {...card}
          label={t('loading.title', lang)}
          band="ink"
          bandStyle={accentStyle}
        >
          <ESignLoading lang={lang} />
        </ESignCardPage>
      );

    case 'expired':
      return (
        <ESignCardPage {...card} label={t('expired.title', lang)} band="danger">
          <ESignExpired lang={lang} message={errorMessage} onHome={goHome} />
        </ESignCardPage>
      );

    case 'rejected':
      return (
        <ESignCardPage {...card} label={t('rejected.title', lang)} band="muted">
          <ESignRejected
            lang={lang}
            title={sessionData?.envelope_title || 'this document'}
            onHome={goHome}
          />
        </ESignCardPage>
      );

    case 'otp':
      return (
        <ESignCardPage {...card} label="Identity verification" band="ink">
          <ESignOtpCard
            token={token!}
            sessionData={sessionData}
            onVerified={handleChallengeVerified}
            verifyOtp={verifyOtp}
            resendOtp={resendOtp}
          />
        </ESignCardPage>
      );

    case 'kba':
      return (
        <ESignCardPage {...card} label="Identity check" band="ink">
          <ESignKbaCard
            token={token!}
            sessionData={sessionData}
            onVerified={handleChallengeVerified}
            verifyKba={verifyKba}
          />
        </ESignCardPage>
      );

    case 'signing':
      return (
        <ESignWorkspace
          token={token!}
          sessionData={sessionData}
          lang={lang}
          onComplete={handleSigningComplete}
          onReject={handleReject}
          submitSignature={submitSignature}
        />
      );

    case 'waiting':
      return (
        <ESignCardPage {...card} label={t('waiting.title', lang)} band="warn">
          <ESignWaiting
            lang={lang}
            signers={sessionData?.all_signers || []}
            email={sessionData?.signer_email}
            onHome={goHome}
          />
        </ESignCardPage>
      );

    case 'complete':
      return <ESignComplete sessionData={sessionData} token={token!} onClose={goHome} />;

    default:
      return null;
  }
}

export default NavigatorSigningPage;
