/**
 * NavigatorForgotPasswordPage — the redesigned /forgot-password page.
 *
 * The layout is the "ForgotPassword" board of the Website Redesign canvas: a
 * navy panel on the safeguards beside the form, inside the site's header and
 * footer (the route renders inside MainLayout with its chrome, as the board
 * draws it). Everything the page does is the live page's (ForgotPasswordPage.tsx):
 * the same two checks with the same messages, the same single call,
 * `sendPasswordResetEmail(email)` with the address exactly as typed, the same
 * error wording through getUserErrorMessage, and the same "Check Your Email"
 * confirmation for any address the server accepts, so the page never says
 * whether an account exists. The live page emits no SEO tags (robots.txt and
 * the X-Robots-Tag header keep the route out of search), and neither does this.
 */
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { sendPasswordResetEmail } from '../../utils/auth/authService';
import { getUserErrorMessage } from '../../utils/errorUtils';
import { COMPANY } from '../../config/companyFacts';
import { ForgotPasswordBrand } from '../sections/ForgotPasswordBrand';
import { ForgotPasswordRequest } from '../sections/ForgotPasswordRequest';
import { ForgotPasswordSent } from '../sections/ForgotPasswordSent';
import '../styles/navigator.css';
import '../styles/sections.css';
import '../styles/forgot-password.css';

const FOOTNOTE = `Proudly South African · FSP No. ${COMPANY.fspNumber}`;

/** The live page's two client-side messages, word for word. */
const EMPTY_EMAIL = 'Please enter your email address.';
const INVALID_EMAIL = 'Please enter a valid email address.';

export function NavigatorForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [error, setError] = useState('');
  const emailRef = useRef<HTMLInputElement>(null);
  const doneRef = useRef<HTMLHeadingElement>(null);
  // Focus follows the swap: to "Check Your Email" once sent, back to the
  // address on "Send Another Link". Nothing moves on the first render.
  const swapped = useRef(false);

  useEffect(() => {
    if (!swapped.current) return;
    if (isSubmitted) doneRef.current?.focus();
    else emailRef.current?.focus();
  }, [isSubmitted]);

  // The live page's handleSubmit, unchanged except that a failed check also
  // puts focus back on the address.
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email) {
      setError(EMPTY_EMAIL);
      emailRef.current?.focus();
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError(INVALID_EMAIL);
      emailRef.current?.focus();
      return;
    }

    setIsLoading(true);

    try {
      await sendPasswordResetEmail(email);
      swapped.current = true;
      setIsSubmitted(true);
    } catch (error: unknown) {
      setError(getUserErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  };

  const sendAnother = () => {
    swapped.current = true;
    setIsSubmitted(false);
  };

  return (
    <div className="nw-site nwfp">
      <section className="nwfp-sec">
        <div className="nw-wrap nwfp-wrap">
          <div className="nwfp-card">
            <div className="nwfp-main">
              {isSubmitted ? (
                <ForgotPasswordSent
                  email={email}
                  onSendAnother={sendAnother}
                  headingRef={doneRef}
                />
              ) : (
                <ForgotPasswordRequest
                  email={email}
                  onEmailChange={setEmail}
                  error={error}
                  invalid={error === EMPTY_EMAIL || error === INVALID_EMAIL}
                  loading={isLoading}
                  onSubmit={handleSubmit}
                  inputRef={emailRef}
                />
              )}
            </div>
            <ForgotPasswordBrand sent={isSubmitted} footnote={FOOTNOTE} />
          </div>
        </div>
      </section>
    </div>
  );
}

export default NavigatorForgotPasswordPage;
