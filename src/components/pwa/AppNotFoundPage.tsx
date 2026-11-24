/**
 * AppNotFoundPage — the 404 inside the installed app.
 *
 * The installed PWA is a portal-only app (see StandaloneRedirect), so the
 * website's 404, with its marketing header, page search and footer, sent
 * people towards pages the app bounces straight back from. This is the app's
 * own: the Navigator status card on paper, a way back, and one way forward,
 * to the portal when signed in or to Log in when not.
 *
 * It sets the same title and noindex robots tag as the website's 404.
 */
import { useEffect } from 'react';
import { useNavigate } from 'react-router';
import { ArrowLeft, LayoutDashboard, LogIn } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { getAuthenticatedRedirectPath } from '../auth/RouteGuards';
import { StatusScreen } from '../shared/StatusScreen';

export function AppNotFoundPage() {
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuth();

  useEffect(() => {
    document.title = 'Page Not Found | Navigate Wealth';
    let el = document.querySelector('meta[name="robots"]') as HTMLMetaElement | null;
    if (!el) {
      el = document.createElement('meta');
      el.setAttribute('name', 'robots');
      document.head.appendChild(el);
    }
    el.setAttribute('content', 'noindex, nofollow');
  }, []);

  const home = isAuthenticated ? getAuthenticatedRedirectPath(user) : '/login';

  return (
    <StatusScreen
      variant="lost"
      eyebrow="404 · Off course"
      title="We can't find this page"
      lead={<p>The page you're looking for doesn't exist or has been moved.</p>}
      actions={[
        isAuthenticated
          ? { label: 'Go to my portal', icon: LayoutDashboard, onClick: () => navigate(home) }
          : { label: 'Go to Log in', icon: LogIn, onClick: () => navigate(home) },
        {
          label: 'Go back',
          icon: ArrowLeft,
          onClick: () => (window.history.length > 1 ? navigate(-1) : navigate(home)),
        },
      ]}
    />
  );
}

export default AppNotFoundPage;
