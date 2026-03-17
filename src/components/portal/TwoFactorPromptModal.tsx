/**
 * TwoFactorPromptModal
 *
 * Displayed on the client dashboard after login when the user has not
 * yet enabled two-factor authentication. Explains the benefits in plain
 * language and offers a direct link to the Security Settings page.
 *
 * The prompt uses a sessionStorage flag (`nw_show_2fa_prompt`) set by
 * LoginPage so it only appears once per login session.
 *
 * Guidelines refs: §7 (presentation layer), §8.3 (UI standards),
 * §11.1 (client state)
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '../ui/dialog';
import { Button } from '../ui/button';
import { ShieldCheck, Mail, Clock, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { securityService } from '../../utils/auth/securityService';

const SESSION_KEY = 'nw_show_2fa_prompt';

const BENEFITS = [
  {
    icon: ShieldCheck,
    title: 'Extra layer of protection',
    description:
      'Even if someone discovers your password, they cannot access your account without the verification code.',
  },
  {
    icon: Mail,
    title: 'Simple email verification',
    description:
      'Each time you log in, a one-time code is sent to your registered email address. Just enter the code to confirm it\u2019s you.',
  },
  {
    icon: Clock,
    title: 'Quick and effortless',
    description:
      'The entire process takes less than 30 seconds and only happens at login \u2014 it won\u2019t interrupt your normal use of the platform.',
  },
] as const;

export function TwoFactorPromptModal() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const { user } = useAuth();

  useEffect(() => {
    const shouldShow = sessionStorage.getItem(SESSION_KEY);
    if (shouldShow !== 'true' || !user?.id) {
      return;
    }

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const verifyPromptEligibility = async () => {
      const status = await securityService.getSecurityStatus(user.id);

      // If 2FA is already enabled, the login-time session hint is stale.
      if (cancelled || status?.twoFactorEnabled) {
        sessionStorage.removeItem(SESSION_KEY);
        return;
      }

      // Small delay so the dashboard renders first
      timer = setTimeout(() => {
        if (!cancelled) setOpen(true);
      }, 800);
    };

    verifyPromptEligibility().catch(() => {
      // If the security lookup fails, avoid nagging the user with a potentially
      // stale prompt and let the dedicated Security page remain the source of truth.
      sessionStorage.removeItem(SESSION_KEY);
    });

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [user?.id]);

  const dismiss = () => {
    sessionStorage.removeItem(SESSION_KEY);
    setOpen(false);
  };

  const goToSettings = () => {
    sessionStorage.removeItem(SESSION_KEY);
    setOpen(false);
    navigate('/security');
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) dismiss(); }}>
      <DialogContent className="max-w-lg w-full mx-auto bg-white border border-gray-200 rounded-2xl shadow-2xl p-0 overflow-hidden">
        <DialogTitle className="sr-only">
          Enable Two-Factor Authentication
        </DialogTitle>
        <DialogDescription className="sr-only">
          Two-factor authentication adds an extra layer of security to your
          Navigate Wealth account.
        </DialogDescription>

        {/* Accent bar */}
        <div className="h-1.5 bg-gradient-to-r from-purple-600 via-primary to-purple-600" />

        <div className="px-6 sm:px-8 pt-6 pb-6">
          {/* Header */}
          <div className="flex items-start gap-4 mb-5">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-purple-100 flex-shrink-0">
              <ShieldCheck className="h-6 w-6 text-purple-600" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900 leading-tight">
                Protect your account with 2FA
              </h3>
              <p className="text-sm text-gray-500 mt-1">
                Two-factor authentication (2FA) is a recommended security
                feature that helps keep your financial information safe.
              </p>
            </div>
          </div>

          {/* How it works */}
          <div className="rounded-xl bg-gray-50 border border-gray-100 p-4 mb-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">
              How it works & why it matters
            </p>
            <ul className="space-y-3">
              {BENEFITS.map((b) => (
                <li key={b.title} className="flex items-start gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-100 flex-shrink-0 mt-0.5">
                    <b.icon className="h-4 w-4 text-purple-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {b.title}
                    </p>
                    <p className="text-xs text-gray-500 leading-relaxed">
                      {b.description}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          {/* Reassurance note */}
          <div className="flex items-start gap-2 mb-6">
            <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-gray-500 leading-relaxed">
              You can enable or disable 2FA at any time from your{' '}
              <span className="font-medium text-gray-700">Security Settings</span>.
              We strongly recommend keeping it enabled to safeguard your account.
            </p>
          </div>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-3">
            <Button
              onClick={goToSettings}
              className="flex-1 bg-purple-700 hover:bg-purple-800 text-white"
            >
              <ShieldCheck className="h-4 w-4 mr-2" />
              Set up 2FA now
            </Button>
            <Button
              variant="outline"
              onClick={dismiss}
              className="flex-1 border-gray-200 text-gray-600 hover:bg-gray-50"
            >
              Remind me later
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
