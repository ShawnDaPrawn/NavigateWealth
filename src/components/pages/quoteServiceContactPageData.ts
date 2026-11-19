/**
 * The quote funnel's "your details" step — the reasons to choose the firm and
 * the three steps of the funnel, as its sidebar lists them. Both designs read
 * them from here (QuoteServiceContactPage.tsx for the live page,
 * src/site/pages/NavigatorQuoteContactPage.tsx for the redesign), so the copy
 * lives in one place whichever design is live. Moved here verbatim from
 * QuoteServiceContactPage.tsx.
 */

export const QUOTE_CONTACT_POINTS = [
  'Independent, unbiased advice',
  'Compare options from top providers',
  'No cost, no obligation',
  'Personalised to your needs',
];

export const QUOTE_CONTACT_STEPS = [
  { step: '1', text: 'Choose your service' },
  { step: '2', text: "Share your details (you're here!)" },
  { step: '3', text: 'Tell us your needs and receive your quote' },
];
