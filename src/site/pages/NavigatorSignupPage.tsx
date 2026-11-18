/**
 * NavigatorSignupPage — /signup in the Navigator design.
 *
 * Presentation only. Validation, the password rules (validatePassword, the
 * client mirror of the server validator), the request to /auth-signup/signup
 * and every outcome — including the non-enumerating answer for an address
 * that already has an account — are useSignupForm, the hook the live
 * SignupPage runs, so both designs send the same payload to the same endpoint.
 *
 * The Terms of Service and Privacy Policy are real links to their pages; a
 * plain click opens them in the same in-page viewer the live page uses, so
 * nothing typed into the form is lost, while a new-tab click still works.
 */
import { useState, type FormEvent, type MouseEvent } from 'react';
import { Link } from 'react-router';
import { ArrowRight } from 'lucide-react';
import { CountryCodeCombobox } from '../../components/pages/auth/CountryCodeCombobox';
import { SIGNUP_BRAND_FEATURES } from '../../components/pages/auth/authConstants';
import { useSignupForm, type SignupForm } from '../../components/pages/auth/useSignupForm';
import {
  LegalDocumentDialog,
  useLegalDocumentViewer,
} from '../../components/shared/LegalDocumentViewer';
import { useIsStandalone } from '../../hooks/useIsStandalone';
import { AccountAlert } from '../account/AccountAlert';
import { AccountBrandPanel, BrandFeatureList } from '../account/AccountBrandPanel';
import { AccountField, PasswordInput } from '../account/AccountField';
import {
  AccountAppShell,
  AccountModeSwitch,
  AccountSplit,
  AccountTrustLine,
} from '../account/AccountLayout';
import { PasswordMatchNote, PasswordStrengthPanel } from '../account/PasswordStrength';
import { describedBy, fieldErrorId, isPlainClick, useFocusOnInvalid } from '../account/accountUi';
import '../styles/navigator.css';
import '../styles/sections.css';
import '../styles/account.css';

const PAGE_CLASS = 'nwx-signup';
const IDS = {
  firstName: 'nwac-su-first',
  surname: 'nwac-su-surname',
  email: 'nwac-su-email',
  cellphone: 'nwac-su-cell',
  password: 'nwac-su-password',
  confirmPassword: 'nwac-su-confirm',
  requirements: 'nwac-su-requirements',
  error: 'nwac-su-error',
} as const;

type LegalViewer = ReturnType<typeof useLegalDocumentViewer>;

const LEGAL_LINKS = {
  'terms-of-use': 'Terms of Service',
  'privacy-notice': 'Privacy Policy',
} as const;

function LegalLink({ slug, viewer }: { slug: keyof typeof LEGAL_LINKS; viewer: LegalViewer }) {
  const loading = viewer.loadingSlug === slug;
  const onClick = (e: MouseEvent<HTMLAnchorElement>) => {
    if (!isPlainClick(e)) return; // new tab / window: let the browser follow the link
    e.preventDefault();
    if (!loading) void viewer.openDocument(slug);
  };
  return (
    <Link
      to={`/legal/${slug}`}
      className="nwac-link"
      onClick={onClick}
      aria-busy={loading || undefined}
    >
      {loading ? 'Loading...' : LEGAL_LINKS[slug]}
    </Link>
  );
}

function SignupFields({
  form,
  isStandalone,
  legalViewer,
}: {
  form: SignupForm;
  isStandalone: boolean;
  legalViewer: LegalViewer;
}) {
  const [attempt, setAttempt] = useState(0);
  useFocusOnInvalid(attempt, form.errorField ? IDS[form.errorField] : null);

  const onSubmit = (e: FormEvent) => {
    setAttempt((n) => n + 1);
    void form.handleSubmit(e);
  };

  const errorFor = (field: keyof typeof IDS) => (form.errorField === field ? form.error : null);
  const invalid = (field: keyof typeof IDS) => (form.errorField === field ? true : undefined);
  const errorRef = (field: keyof typeof IDS) =>
    form.errorField === field ? fieldErrorId(IDS[field]) : undefined;
  const formError = form.error && !form.errorField ? form.error : '';

  return (
    <div className="nwac-form nwac-form--wide">
      {isStandalone ? <AccountModeSwitch active="signup" /> : null}

      <div className="nwac-head">
        <h1 className="nwac-title">Create your Navigate Wealth account</h1>
        <p className="nwac-sub">Enter your details to start your wealth journey.</p>
      </div>

      {form.showLocalhostWarning ? (
        <AccountAlert tone="warn">
          <strong>Development Mode Detected</strong>
          <br />
          You&apos;re testing on localhost. Verification emails may redirect to localhost.
          <br />
          <strong>For production:</strong> Ensure Supabase Site URL is set to your production
          domain.
        </AccountAlert>
      ) : null}

      {form.success ? <AccountAlert tone="success">{form.success}</AccountAlert> : null}

      {formError ? (
        <AccountAlert
          tone="error"
          id={IDS.error}
          onDismiss={form.dismissError}
          dismissLabel="Close error message"
        >
          {formError}
        </AccountAlert>
      ) : null}

      <form
        className="nwac-fields"
        onSubmit={onSubmit}
        noValidate
        aria-label="Create your account"
        aria-describedby={formError ? IDS.error : undefined}
      >
        <fieldset className="nwac-fieldset">
          <legend className="nwac-legend">Personal Details</legend>

          <div className="nwac-pair">
            <AccountField htmlFor={IDS.firstName} label="First Name" error={errorFor('firstName')}>
              <input
                id={IDS.firstName}
                name="firstName"
                type="text"
                className="nwac-input"
                autoComplete="given-name"
                required
                value={form.firstName}
                onChange={(e) => form.setFirstName(e.target.value)}
                placeholder="John"
                disabled={form.isLoading}
                aria-invalid={invalid('firstName')}
                aria-describedby={errorRef('firstName')}
              />
            </AccountField>

            <AccountField htmlFor={IDS.surname} label="Surname" error={errorFor('surname')}>
              <input
                id={IDS.surname}
                name="surname"
                type="text"
                className="nwac-input"
                autoComplete="family-name"
                required
                value={form.surname}
                onChange={(e) => form.setSurname(e.target.value)}
                placeholder="Doe"
                disabled={form.isLoading}
                aria-invalid={invalid('surname')}
                aria-describedby={errorRef('surname')}
              />
            </AccountField>
          </div>

          <AccountField htmlFor={IDS.email} label="Email Address" error={errorFor('email')}>
            <input
              id={IDS.email}
              name="email"
              type="email"
              className="nwac-input"
              autoComplete="email"
              inputMode="email"
              autoCapitalize="none"
              spellCheck={false}
              required
              value={form.email}
              onChange={(e) => form.setEmail(e.target.value)}
              placeholder="you@example.com"
              disabled={form.isLoading}
              aria-invalid={invalid('email')}
              aria-describedby={errorRef('email')}
            />
          </AccountField>

          <AccountField
            htmlFor={IDS.cellphone}
            label="Cellphone Number"
            error={errorFor('cellphone')}
          >
            <div className="nwac-tel">
              <div className="nwac-cc">
                <CountryCodeCombobox
                  value={form.countryCode}
                  onValueChange={form.setCountryCode}
                  disabled={form.isLoading}
                />
              </div>
              <input
                id={IDS.cellphone}
                name="cellphone"
                type="tel"
                className="nwac-input"
                autoComplete="tel-national"
                inputMode="tel"
                required
                value={form.cellphone}
                onChange={(e) => form.setCellphone(e.target.value)}
                placeholder="82 123 4567"
                disabled={form.isLoading}
                aria-invalid={invalid('cellphone')}
                aria-describedby={errorRef('cellphone')}
              />
            </div>
          </AccountField>
        </fieldset>

        <fieldset className="nwac-fieldset">
          <legend className="nwac-legend">Create Password</legend>

          <AccountField
            htmlFor={IDS.password}
            label="Password"
            error={errorFor('password')}
            after={
              form.showPasswordHints ? (
                <PasswordStrengthPanel
                  strength={form.passwordStrength}
                  showMeter
                  variant="signup"
                  requirementsId={IDS.requirements}
                />
              ) : null
            }
          >
            <PasswordInput
              id={IDS.password}
              name="password"
              autoComplete="new-password"
              required
              value={form.password}
              onChange={(e) => form.setPassword(e.target.value)}
              onFocus={() => form.setPasswordFocused(true)}
              onBlur={() => form.setPasswordFocused(false)}
              placeholder="Create a strong password"
              disabled={form.isLoading}
              shown={form.showPassword}
              onToggle={form.toggleShowPassword}
              aria-invalid={invalid('password')}
              aria-describedby={describedBy(
                errorRef('password'),
                form.showPasswordHints && IDS.requirements,
              )}
            />
          </AccountField>

          <AccountField
            htmlFor={IDS.confirmPassword}
            label="Confirm Password"
            error={errorFor('confirmPassword')}
            after={
              <PasswordMatchNote
                visible={form.confirmPassword.length > 0}
                matches={form.passwordsMatch}
              />
            }
          >
            <PasswordInput
              id={IDS.confirmPassword}
              name="confirmPassword"
              autoComplete="new-password"
              required
              value={form.confirmPassword}
              onChange={(e) => form.setConfirmPassword(e.target.value)}
              placeholder="Re-enter your password"
              disabled={form.isLoading}
              shown={form.showConfirmPassword}
              onToggle={form.toggleShowConfirmPassword}
              toggleLabels={['Show password confirmation', 'Hide password confirmation']}
              aria-invalid={invalid('confirmPassword')}
              aria-describedby={errorRef('confirmPassword')}
            />
          </AccountField>
        </fieldset>

        <p className="nwac-terms">
          By creating an account, you agree to Navigate Wealth&apos;s{' '}
          <LegalLink slug="terms-of-use" viewer={legalViewer} /> and{' '}
          <LegalLink slug="privacy-notice" viewer={legalViewer} />. Your data is protected under
          POPIA.
        </p>

        <button
          type="submit"
          className="nw-btn nwac-submit"
          disabled={!form.canSubmit}
          aria-busy={form.isLoading || undefined}
        >
          {form.isLoading ? (
            <>
              <span className="nwac-spin" aria-hidden="true" />
              Creating account...
            </>
          ) : (
            <>
              Create account
              <ArrowRight size={16} strokeWidth={1.75} aria-hidden="true" />
            </>
          )}
        </button>
      </form>

      {isStandalone ? null : (
        <p className="nwac-alt">
          Already have an account?{' '}
          <Link to="/login" className="nwac-link">
            Sign in
          </Link>
        </p>
      )}

      <AccountTrustLine always={isStandalone} />
    </div>
  );
}

export function NavigatorSignupPage() {
  const isStandalone = useIsStandalone();
  const form = useSignupForm();
  const legalViewer = useLegalDocumentViewer();

  const fields = <SignupFields form={form} isStandalone={isStandalone} legalViewer={legalViewer} />;
  const legalDialog = (
    <LegalDocumentDialog
      open={legalViewer.viewerOpen}
      onOpenChange={legalViewer.setViewerOpen}
      document={legalViewer.viewerDocument}
    />
  );

  if (isStandalone) {
    return (
      <>
        <AccountAppShell pageClass={PAGE_CLASS}>{fields}</AccountAppShell>
        {legalDialog}
      </>
    );
  }

  return (
    <>
      <AccountSplit
        pageClass={PAGE_CLASS}
        tall
        brand={
          <AccountBrandPanel
            heading="Start your wealth journey today."
            lead="Create your account to begin your personalised financial plan with Navigate Wealth."
          >
            <BrandFeatureList items={SIGNUP_BRAND_FEATURES} />
          </AccountBrandPanel>
        }
      >
        {fields}
      </AccountSplit>
      {legalDialog}
    </>
  );
}
