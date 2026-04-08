import { useEffect } from 'react';
import { SITE_ORIGIN } from '@/utils/siteOrigin';

export function RobotsTxtPage() {
  useEffect(() => {
    // Remove all React app styling
    document.documentElement.style.cssText = '';
    document.body.style.cssText = '';
    
    const robotsContent = `User-agent: *
Allow: /
Disallow: /admin
Disallow: /dashboard
Disallow: /dashboard/
Disallow: /products-services-dashboard
Disallow: /login
Disallow: /signup
Disallow: /forgot-password
Disallow: /reset-password
Disallow: /verify-email
Disallow: /auth/
Disallow: /account-type
Disallow: /get-started
Disallow: /application
Disallow: /application/
Disallow: /onboarding/
Disallow: /profile
Disallow: /security
Disallow: /history
Disallow: /communication
Disallow: /transactions-documents
Disallow: /my-adviser
Disallow: /ai-advisor
Disallow: /requests/
Disallow: /newsletter/
Disallow: /sign
Disallow: /verify
Disallow: /verify-document
Disallow: /og-preview
Disallow: /links
Disallow: /migration-helper
Disallow: /design-system
Disallow: /preview_page.html

Sitemap: ${SITE_ORIGIN}/sitemap.xml
`;

    // Clear all existing content and styles
    document.body.innerHTML = '';
    document.body.style.cssText = 'font-family: monospace; margin: 0; padding: 0; background: white; color: black;';
    
    // Create a text node to preserve exact formatting
    const pre = document.createElement('pre');
    pre.textContent = robotsContent;
    pre.style.cssText = 'margin: 0; padding: 10px; white-space: pre-wrap; word-wrap: break-word;';
    document.body.appendChild(pre);
  }, []);

  return null;
}