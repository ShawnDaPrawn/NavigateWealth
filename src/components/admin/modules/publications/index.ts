/**
 * Publications Module - Public API
 *
 * Explicit named exports only — avoids pulling the entire module tree through
 * wildcard re-exports when consumers only need a handful of items.
 */

// Module entry point
export { PublicationsModule } from './PublicationsModule';

// Types used by external pages
export type { Article, ArticleStatus, ArticleFilters, Category, ContentType } from './types';

// Hooks consumed by public / client-facing resource pages
export { useArticles } from './hooks/useArticles';
export { useCategories } from './hooks/useCategories';
export { useTypes } from './hooks/useTypes';
export { useMarketNews } from './hooks/useMarketNews';

// Components consumed by external pages
export { InsightsTab } from './components/InsightsTab';
export { MarketWatchTab } from './components/MarketWatchTab';
export { MarketNewsTab } from './components/MarketNewsTab';
export { LoadingState } from './components/LoadingState';
export { EmptyState } from './components/EmptyState';
export { SearchInput } from './components/SearchInput';

// Constants consumed by external pages
export { CATEGORY_ICON_MAP } from './constants';

// Utils consumed by external pages
export { formatDate } from './utils';