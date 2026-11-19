/**
 * SEO for the three newsletter status pages a subscriber reaches from an
 * email — /newsletter/confirm, /newsletter/unsubscribe and /newsletter/click —
 * moved here word for word from those pages so both website designs emit the
 * same tags. All three are kept out of search results.
 */

export const NEWSLETTER_CONFIRM_SEO = {
  title: 'Newsletter Confirmation | Navigate Wealth',
  description: 'Newsletter subscription confirmation status for Navigate Wealth.',
  canonicalUrl: 'https://www.navigatewealth.co/newsletter/confirm',
  robotsContent: 'noindex, nofollow',
};

export const NEWSLETTER_UNSUBSCRIBE_SEO = {
  title: 'Newsletter Unsubscribe | Navigate Wealth',
  description: 'Newsletter unsubscribe page for Navigate Wealth.',
  canonicalUrl: 'https://www.navigatewealth.co/newsletter/unsubscribe',
  robotsContent: 'noindex, nofollow',
};

export const NEWSLETTER_CLICK_SEO = {
  title: 'Redirecting | Navigate Wealth',
  description: 'Forwarding you to a Navigate Wealth newsletter link.',
  canonicalUrl: 'https://www.navigatewealth.co/newsletter/click',
  robotsContent: 'noindex, nofollow',
};
