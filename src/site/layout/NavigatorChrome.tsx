/**
 * The Navigator design's page chrome, loaded as one lazy chunk by MainLayout
 * only when VITE_SITE_DESIGN is 'navigator'. Importing the stylesheet here, not
 * in main.tsx, keeps the fonts and CSS out of the legacy site's bundle entirely.
 */
import '../styles/navigator.css';

export { NavigatorHeader } from './NavigatorHeader';
export { NavigatorFooter } from './NavigatorFooter';
