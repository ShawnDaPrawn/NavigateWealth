import { useEffect } from 'react';
import { useLocation } from 'react-router';

// ScrollToTop component - automatically scrolls to top on route changes
export function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return null;
}
