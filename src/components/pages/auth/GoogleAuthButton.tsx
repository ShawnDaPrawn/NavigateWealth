/**
 * GoogleAuthButton — Google OAuth button rendered only when ENABLE_GOOGLE_AUTH is true.
 * Replaces the commented-out Google OAuth blocks in Login and Signup pages.
 */

import React from 'react';
import { Button } from '../../ui/button';
import { ENABLE_GOOGLE_AUTH } from './authConstants';

interface GoogleAuthButtonProps {
  mode: 'signin' | 'signup';
  onClick: () => void;
  isLoading: boolean;
  disabled?: boolean;
}

export function GoogleAuthButton({ mode, onClick, isLoading, disabled }: GoogleAuthButtonProps) {
  if (!ENABLE_GOOGLE_AUTH) return null;

  const label = mode === 'signin' ? 'Sign in with Google' : 'Sign up with Google';
  const loadingLabel = mode === 'signin' ? 'Signing in with Google...' : 'Signing up with Google...';

  return (
    <div className="contents">
      <div className="mb-6">
        <Button
          type="button"
          variant="outline"
          className="w-full flex items-center justify-center gap-3 border-gray-300 hover:bg-gray-50"
          onClick={onClick}
          disabled={isLoading || disabled}
        >
          <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            />
          </svg>
          {isLoading ? loadingLabel : label}
        </Button>
      </div>

      {/* Divider */}
      <div className="relative mb-6">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-gray-200" />
        </div>
        <div className="relative flex justify-center text-sm">
          <span className="px-3 bg-white text-gray-500">
            Or continue with email
          </span>
        </div>
      </div>
    </div>
  );
}
