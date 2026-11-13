/**
 * The frame of the last-will and living-will wizards: a full page (not a
 * pop-up) with "‹ Will management", the will's title and client under it,
 * the header action (Save & exit) and the wizard body. It also extends the
 * client page's breadcrumb with the wizard's title and current step.
 */
import type { ReactNode } from 'react';
import { ChevronLeft } from 'lucide-react';
import { PageHeader } from '../../../layout/page';
import { useAppendBreadcrumb } from '../../../layout/page';

interface WillWizardPageProps {
  open: boolean;
  title: string;
  description?: string;
  onClose: () => void;
  currentStepLabel?: string;
  headerActions?: ReactNode;
  children: ReactNode;
}

export function WillWizardPage({
  open,
  title,
  description,
  onClose,
  currentStepLabel,
  headerActions,
  children,
}: WillWizardPageProps) {
  useAppendBreadcrumb(
    [{ label: title }, ...(currentStepLabel ? [{ label: currentStepLabel }] : [])],
    open,
  );

  if (!open) return null;

  return (
    <div className="flex flex-col gap-5">
      <button
        type="button"
        onClick={onClose}
        className="inline-flex w-fit items-center gap-1 rounded text-sm text-nw-text-2 hover:text-nw-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nw-violet/60"
      >
        <ChevronLeft className="h-4 w-4" aria-hidden="true" />
        Will management
      </button>
      <PageHeader title={title} description={description} actions={headerActions} />
      {children}
    </div>
  );
}
