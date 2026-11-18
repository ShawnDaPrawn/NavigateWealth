/**
 * The Navigator design's page chrome, loaded as one lazy chunk by MainLayout
 * only when the site design is 'navigator' (the default; see src/site/design.ts).
 * Importing the stylesheet here, not in main.tsx, keeps the fonts and CSS out of
 * a legacy build's bundle entirely.
 */
import '../styles/navigator.css';

export { NavigatorHeader } from './NavigatorHeader';
export { NavigatorFooter } from './NavigatorFooter';
export { NavigatorMobileBar } from './NavigatorMobileBar';
