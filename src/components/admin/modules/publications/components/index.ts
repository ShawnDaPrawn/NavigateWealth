/**
 * Publications Feature - Components Index
 *
 * Central export for all shared components.
 */

// UI State Components
export { LoadingSpinner, LoadingState, SkeletonLoader } from './LoadingState';
export { ErrorState, InlineError } from './ErrorState';
export { EmptyList, EmptyState } from './EmptyState';

// Status & Badges
export { StatusBadge } from './StatusBadge';
export { CategoryBadge, CategoryFilterButton } from './CategoryBadge';

// Cards & Display
export { ArticleCard, ArticleCardCompact } from './ArticleCard';
export {
  ArticleMetadata,
  ArticleMetadataCompact,
  ArticleMetadataDetailed,
} from './ArticleMetadata';

// Form Components
export {
  CheckboxField,
  DateTimeField,
  ErrorList,
  NumberStepperField,
  SelectField,
  TextField,
  TextareaField,
  VALIDATION_RULES,
} from './FormField';
export type {
  CheckboxFieldProps,
  DateTimeFieldProps,
  ErrorListProps,
  NumberStepperFieldProps,
  SelectFieldProps,
  TextFieldProps,
  TextareaFieldProps,
} from './FormField';
export { SearchInput } from './SearchInput';

// Interaction
export { ConfirmDialog, useConfirmDialog } from './ConfirmDialog';
export { ActionMenu } from './ActionMenu';
export type { ActionMenuItem } from './ActionMenu';
export { Pagination, PaginationInfo } from './Pagination';
export { ArticlePreview } from './ArticlePreview';

// Analytics & Pipeline
export { ContentAnalytics } from './ContentAnalytics';
export { ContentPipeline } from './ContentPipeline';

// AI & Automation
export { AIArticleGenerator } from './AIArticleGenerator';
export { AutoContentPanel } from './AutoContentPanel';
export { ContentSourcesManager } from './ContentSourcesManager';
