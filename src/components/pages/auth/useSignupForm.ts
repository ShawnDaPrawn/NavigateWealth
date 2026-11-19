/**
 * useSignupForm — the sign-up page's state and account creation, shared by
 * both designs of /signup.
 *
 * Moved verbatim out of SignupPage.tsx so the legacy page and the Navigator
 * redesign (src/site/pages/NavigatorSignupPage.tsx) run one copy of it: the
 * same checks in the same order, the same POST to /auth-signup/signup with the
 * same body, the same messages, and the same hand-off to /verify-email. Only
 * how the page looks differs between them. Nothing here may be changed for one
 * design alone.
 *
 * The password rules are validatePassword's, which agree with the server's
 * validator (passwordValidator.agreement.test.ts), so the meter can never show
 * green over a password the endpoint will refuse.
 */
import React from 'react';
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { validatePassword } from '../../../utils/auth/passwordValidation';
import { projectId, publicAnonKey } from '../../../utils/supabase/info';
import { getUserErrorMessage, isError } from '../../../utils/errorUtils';
import { toast } from 'sonner';

export function useSignupForm() {
  const navigate = useNavigate();
  const [firstName, setFirstName] = useState('');
  const [surname, setSurname] = useState('');
  const [email, setEmail] = useState('');
  const [countryCode, setCountryCode] = useState('+27');
  const [cellphone, setCellphone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showLocalhostWarning, setShowLocalhostWarning] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);

  useEffect(() => {
    // Check if we're on localhost and show warning
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      setShowLocalhostWarning(true);
    }
  }, []);

  const passwordStrength = validatePassword(password);
  const passwordsMatch = password === confirmPassword && confirmPassword.length > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    // Validate first name
    if (!firstName.trim()) {
      setError('Please enter your first name');
      return;
    }

    // Validate surname
    if (!surname.trim()) {
      setError('Please enter your surname');
      return;
    }

    // Validate cellphone
    if (!cellphone.trim()) {
      setError('Please enter your cellphone number');
      return;
    }

    // Validate email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError('Please enter a valid email address');
      return;
    }

    // Validate password
    if (!passwordStrength.isValid) {
      setError(
        'Password does not meet security requirements. Please check the requirements below.',
      );
      return;
    }

    // Check passwords match
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setIsLoading(true);

    try {
      // Call our backend signup endpoint that creates user + application

      const endpointUrl = `https://${projectId}.supabase.co/functions/v1/make-server-91ed8379/auth-signup/signup`;

      const response = await fetch(endpointUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${publicAnonKey}`,
        },
        body: JSON.stringify({
          email,
          password,
          firstName: firstName.trim(),
          surname: surname.trim(),
          countryCode,
          phoneNumber: cellphone.trim(),
        }),
      });

      let result;
      const responseText = await response.text();

      try {
        result = JSON.parse(responseText);
      } catch (parseError: unknown) {
        throw new Error(`Server returned non-JSON response: ${responseText.substring(0, 100)}...`, {
          cause: parseError,
        });
      }

      if (!response.ok) {
        throw new Error(result.error || `Server error: ${response.status} ${response.statusText}`);
      }

      if (!result.success) {
        throw new Error('Account creation failed. Please try again.');
      }

      // The response is the SAME for a new account and for an address that
      // already had one — no `user`, no `application`, nothing this screen
      // could branch on. That is deliberate: for an advisory firm, "is this
      // person a client" is confidential, and a signup form that answers it is
      // an enumeration oracle. The real owner is told by email instead.
      //
      // The application number therefore is not shown here any more. It is
      // still generated and stored, and appears in the portal once the user
      // verifies and signs in.
      setSuccess('Thanks — check your email to continue. Redirecting...');

      // Redirect to verify email page
      setTimeout(() => {
        navigate('/verify-email', {
          state: {
            email,
            message: 'Please check your email to continue.',
          },
        });
      }, 1500);
    } catch (error: unknown) {
      if (isError(error)) {
        // Handle specific errors
        if (
          error.message.includes('already registered') ||
          error.message.includes('already exists') ||
          error.message.includes('User already registered')
        ) {
          // Defence in depth. The server no longer answers this way (see the
          // success branch above), but an older cached bundle or a future
          // caller could still surface the phrase, and repeating it on screen
          // would put the enumeration oracle straight back. Say the same thing
          // the non-enumerating path says.
          const msg = 'Thanks — check your email to continue.';
          setSuccess(msg);
          setTimeout(() => {
            navigate('/verify-email', {
              state: { email, message: 'Please check your email to continue.' },
            });
          }, 1500);
        } else if (error.message.includes('password')) {
          const msg = 'Password does not meet requirements. Please try a different password.';
          setError(msg);
          toast.error(msg);
        } else {
          const msg = getUserErrorMessage(error.message);
          setError(msg);
          toast.error(msg);
        }
      } else {
        // Fallback for unknown errors - show the actual message for debugging
        const msg =
          (error instanceof Error ? error.message : null) ||
          'Failed to create account. Please try again.';
        setError(msg);
        toast.error(msg);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const showPasswordHints = passwordFocused || password.length > 0;

  /** The submit button waits until every field and both password checks pass. */
  const submitDisabled =
    isLoading ||
    !passwordStrength.isValid ||
    !passwordsMatch ||
    !email ||
    !firstName.trim() ||
    !surname.trim() ||
    !cellphone.trim();

  return {
    firstName,
    setFirstName,
    surname,
    setSurname,
    email,
    setEmail,
    countryCode,
    setCountryCode,
    cellphone,
    setCellphone,
    password,
    setPassword,
    confirmPassword,
    setConfirmPassword,
    showPassword,
    setShowPassword,
    showConfirmPassword,
    setShowConfirmPassword,
    isLoading,
    error,
    setError,
    success,
    showLocalhostWarning,
    setPasswordFocused,
    passwordStrength,
    passwordsMatch,
    handleSubmit,
    showPasswordHints,
    submitDisabled,
  };
}
