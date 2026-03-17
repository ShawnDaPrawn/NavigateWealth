import { useEffect } from 'react';

export function RobotsTxtPage() {
  useEffect(() => {
    // Remove all React app styling
    document.documentElement.style.cssText = '';
    document.body.style.cssText = '';
    
    const robotsContent = `# Navigate Wealth - robots.txt
# This file tells search engines which pages to crawl

User-agent: *
Allow: /

# Disallow admin and user-specific areas
Disallow: /admin
Disallow: /dashboard
Disallow: /login
Disallow: /signup
Disallow: /account-type
Disallow: /application
Disallow: /password-reset
Disallow: /profile
Disallow: /security

# Allow important pages
Allow: /
Allow: /services
Allow: /about
Allow: /team
Allow: /contact
Allow: /resources
Allow: /legal
Allow: /sitemap

# Sitemap
Sitemap: https://navigatewealth.co.za/sitemap/xml
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