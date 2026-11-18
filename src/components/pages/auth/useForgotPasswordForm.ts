/**
 * useForgotPasswordForm — the reset-link request without its markup.
 *
 * Extracted verbatim from ForgotPasswordPage.tsx so the live page and the
 * Navigator redesign (src/site/pages/NavigatorForgotPasswordPage.tsx) validate
 * the same way and call sendPasswordResetEmail with the same argument.
 */
import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { sendPasswordResetEmail } from '../../../utils/auth/authService';
import { getUserErrorMessage } from '../../../utils/errorUtils';

/** Client-side validation messages; both are about the email field. */
export const FORGOT_PASSWORD_FIELD_ERRORS = {
  'Please enter your email address.': 'email',
  'Please enter a valid email address.': 'email',
} as const satisfies Record<string, 'email'>;

export function useForgotPasswordForm() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email) {
      setError('Please enter your email address.');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError('Please enter a valid email address.');
      return;
    }

    setIsLoading(true);

    try {
      await sendPasswordResetEmail(email);
      setIsSubmitted(true);
    } catch (error: unknown) {
      setError(getUserErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  };

  const handleBackToLogin = () => {
    navigate('/login');
  };

  const errorField: 'email' | null =
    (FORGOT_PASSWORD_FIELD_ERRORS as Record<string, 'email'>)[error] ?? null;

  return {
    email,
    setEmail,
    isLoading,
    isSubmitted,
    /** "Send Another Link": back to the form, address kept. */
    sendAnother: () => setIsSubmitted(false),
    error,
    errorField,
    handleSubmit,
    handleBackToLogin,
  };
}

export type ForgotPasswordForm = ReturnType<typeof useForgotPasswordForm>;
