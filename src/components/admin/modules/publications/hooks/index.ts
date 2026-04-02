/**
 * Publications Feature - Hooks Index
 * 
 * Central export for all custom hooks.
 */

// Query key registry
export * from './queryKeys';

// Data fetching hooks
export * from './useArticles';
export * from './useArticle';
export * from './useCategories';
export * from './useTypes';

// Form management hooks
export * from './useArticleForm';

// Action hooks
export * from './useArticleActions';
export * from './useCategoryActions';
export * from './useTypeActions';

// Other hooks
export * from './useMarketNews';
export * from './usePublicationsInit';
export * from './useScheduledPublishProcessor';
export * from './useArticleNotificationProcessor';
export * from './useAutoContentProcessor';

// Newsletter hooks
export * from './useNewsletterSubscribers';
export * from './useNewsletterMutations';
