/**
 * FNA Module — Component Barrel Exports
 * Guidelines §4.3 — Single, unambiguous entry point for components.
 */

export { FNACard } from './FNACard';
export { FNAStatusBadge } from './FNAStatusBadge';

// Components that still live at module root (to be migrated incrementally):
// These re-exports allow consumers to import from the barrel while the
// physical files remain in place. Move them here as capacity allows.
export { FNAResultsView } from '../FNAResultsView';
export { FNAWizard } from '../FNAWizard';
export { FNAWizardLayout } from '../FNAWizardLayout';
export type { FNAWizardStepConfig } from '../FNAWizardLayout';
export { PublishFNADialog } from '../PublishFNADialog';
export { ViewPublishedFNADialog } from '../ViewPublishedFNADialog';
