import { useNavigate } from 'react-router';

interface AuthModeToggleProps {
  /** Which mode is currently active. */
  active: 'signin' | 'signup';
}

/**
 * Segmented Sign In / Sign Up switch for the auth screens.
 *
 * Login and sign-up are separate routes, so the inactive segment navigates to
 * the other one. Forgot-password is intentionally NOT a segment — it stays a
 * link on the sign-in form (and its own screen has a "Back to Login" action),
 * so the control never needs a third tab.
 */
export function AuthModeToggle({ active }: AuthModeToggleProps) {
  const navigate = useNavigate();

  const base =
    'rounded-lg py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-600';
  const activeClass = 'bg-white text-gray-900 shadow-sm';
  const inactiveClass = 'text-gray-500 hover:text-gray-700';

  return (
    <div
      role="tablist"
      aria-label="Sign in or sign up"
      className="mb-6 grid grid-cols-2 gap-1 rounded-xl bg-gray-100 p-1"
    >
      <button
        type="button"
        role="tab"
        aria-selected={active === 'signin'}
        onClick={() => active !== 'signin' && navigate('/login')}
        className={`${base} ${active === 'signin' ? activeClass : inactiveClass}`}
      >
        Sign In
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={active === 'signup'}
        onClick={() => active !== 'signup' && navigate('/signup')}
        className={`${base} ${active === 'signup' ? activeClass : inactiveClass}`}
      >
        Sign Up
      </button>
    </div>
  );
}
