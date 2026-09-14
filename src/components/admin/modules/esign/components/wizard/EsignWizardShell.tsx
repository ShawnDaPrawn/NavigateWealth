/**
 * EsignWizardShell — the standardised frame every step of the
 * send-for-signature flow renders inside.
 *
 * WHY THIS EXISTS
 * ---------------
 * Each step used to supply its own layout: its own max width, its own heading,
 * its own footer buttons placed wherever the step's content happened to end.
 * The result was a flow whose title, action buttons and content column jumped
 * position on every "Next" — the steps looked like three different screens
 * rather than three stops in one task.
 *
 * The shell fixes the three things that moved:
 *   - the header (flow name, progress rail, step title) is the same height and
 *     in the same place on every step;
 *   - the content column is one width, centred, with one vertical rhythm;
 *   - the action bar is pinned to the bottom, so Back / Continue never chase
 *     the length of the step's content.
 *
 * Steps supply content only. Their actions are declared as props so every
 * button in the flow gets the same styling, order and busy-state treatment.
 *
 * Two layouts, one appearance:
 *   - `fill` (default) for the standalone module, which owns the viewport:
 *     the body scrolls between a fixed header and footer.
 *   - `inline` for the client drawer's E-Sign tab, which sits in someone
 *     else's scroll container: header and footer stick to the edges instead.
 */
import { useId, type ReactNode } from 'react';
import { ArrowLeft, Loader2, X, type LucideIcon } from 'lucide-react';

import { Button } from '../../../../../ui/button';
import { cn } from '../../../../../ui/utils';
import { EsignWizardStepper } from './EsignWizardStepper';
import {
  ESIGN_WIZARD_STEP_COUNT,
  esignWizardStepNumber,
  type EsignWizardStepId,
} from './esignWizardSteps';

export interface EsignWizardAction {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  /** Swaps the label for a spinner + `busyLabel`, and blocks the click. */
  busy?: boolean;
  busyLabel?: string;
  icon?: LucideIcon;
  /** Where `icon` sits relative to the label. Default: trailing. */
  iconPosition?: 'leading' | 'trailing';
  /** Default: the flow's primary purple for the primary action, outline for the rest. */
  variant?: 'primary' | 'outline' | 'ghost';
}

export interface EsignWizardShellProps {
  step: EsignWizardStepId;
  /** Step heading, e.g. "Add recipients". */
  title: string;
  /** One line under the heading saying what this step is asking for. */
  description?: string;
  /** Name of the flow, shown in the top bar. */
  flowLabel?: string;
  /** Optional chip next to the flow label — the template in use, say. */
  contextLabel?: string;
  /** Top-bar escape hatch. Omit to hide it. */
  onExit?: () => void;
  exitLabel?: string;
  /** Left-hand action in the footer. */
  backAction?: EsignWizardAction;
  /** Sits to the left of the primary action — express send, for instance. */
  secondaryAction?: EsignWizardAction;
  primaryAction?: EsignWizardAction;
  /**
   * Short line above the footer actions. Use it to say what is still missing
   * while the primary action is disabled, rather than letting the user click
   * a dead button and discover the problem in an error.
   */
  footerHint?: ReactNode;
  layout?: 'fill' | 'inline';
  children: ReactNode;
}

function actionClasses(variant: EsignWizardAction['variant']) {
  if (variant === 'outline') return 'border-purple-200 text-purple-700 hover:bg-purple-50';
  if (variant === 'ghost') return undefined;
  return 'bg-purple-600 hover:bg-purple-700 text-white shadow-sm';
}

function buttonVariantFor(variant: EsignWizardAction['variant']) {
  if (variant === 'outline') return 'outline' as const;
  if (variant === 'ghost') return 'ghost' as const;
  return 'default' as const;
}

function WizardActionButton({
  action,
  className,
  describedBy,
}: {
  action: EsignWizardAction;
  className?: string;
  describedBy?: string;
}) {
  const Icon = action.icon;
  const leading = action.iconPosition === 'leading';

  return (
    <Button
      type="button"
      variant={buttonVariantFor(action.variant)}
      onClick={action.onClick}
      disabled={action.disabled || action.busy}
      aria-describedby={describedBy}
      className={cn(actionClasses(action.variant), className)}
    >
      {action.busy ? (
        <div className="contents">
          <Loader2 className="h-4 w-4 animate-spin" />
          {action.busyLabel ?? action.label}
        </div>
      ) : (
        <div className="contents">
          {Icon && leading && <Icon className="h-4 w-4" />}
          {action.label}
          {Icon && !leading && <Icon className="h-4 w-4" />}
        </div>
      )}
    </Button>
  );
}

/**
 * The flow's content column. Wide enough to actually use an admin-sized
 * screen — the steps lay their own content out in two columns from `xl` up
 * rather than stretching one column of form fields across it.
 */
const COLUMN = 'mx-auto w-full max-w-[1600px] px-4 sm:px-6 lg:px-8';

export function EsignWizardShell({
  step,
  title,
  description,
  flowLabel = 'Send for signature',
  contextLabel,
  onExit,
  exitLabel = 'Exit',
  backAction,
  secondaryAction,
  primaryAction,
  footerHint,
  layout = 'fill',
  children,
}: EsignWizardShellProps) {
  const isFill = layout === 'fill';
  const hintId = useId();

  return (
    <div
      className={cn(
        'flex flex-col bg-gray-50',
        // No `overflow-hidden` on the inline container: it would make this a
        // scroll container of its own and the sticky header/footer would stop
        // tracking the page the drawer actually scrolls.
        isFill ? 'h-full min-h-0' : 'min-h-[32rem] rounded-xl border border-gray-200',
      )}
      data-testid="esign-wizard-shell"
      data-step={step}
    >
      {/* ---------- Header: identity, escape hatch, progress ---------- */}
      <header
        className={cn(
          'shrink-0 border-b border-gray-200 bg-white',
          !isFill && 'sticky top-0 z-20 rounded-t-xl',
        )}
      >
        <div className={cn(COLUMN, 'flex h-14 items-center justify-between gap-3')}>
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="truncate text-sm font-semibold text-gray-900">{flowLabel}</span>
            {contextLabel && (
              <span className="hidden sm:inline-flex max-w-[16rem] truncate rounded-full border border-purple-200 bg-purple-50 px-2.5 py-0.5 text-xs font-medium text-purple-700">
                {contextLabel}
              </span>
            )}
          </div>

          <div className="flex items-center gap-3">
            {/* Hidden below sm, where the compact rail carries the same count. */}
            <span
              className="hidden sm:block text-xs font-medium text-gray-500"
              data-testid="esign-wizard-step-count"
            >
              Step {esignWizardStepNumber(step)} of {ESIGN_WIZARD_STEP_COUNT}
            </span>
            {onExit && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={onExit}
                className="text-gray-500 hover:text-gray-900"
              >
                <div className="contents">
                  <X className="h-4 w-4" />
                  {exitLabel}
                </div>
              </Button>
            )}
          </div>
        </div>

        <div className="border-t border-gray-100">
          <div className={cn(COLUMN, 'py-3')}>
            <EsignWizardStepper current={step} />
          </div>
        </div>
      </header>

      {/* ---------- Body: one column, one rhythm, on every step ---------- */}
      <div className={cn('flex-1', isFill && 'min-h-0 overflow-y-auto')}>
        <div className={cn(COLUMN, 'space-y-6 py-8')}>
          <div className="space-y-1">
            <h2 className="text-xl font-semibold tracking-tight text-gray-900">{title}</h2>
            {description && <p className="text-sm text-gray-500">{description}</p>}
          </div>
          {children}
        </div>
      </div>

      {/* ---------- Footer: the actions never move ---------- */}
      {(backAction || secondaryAction || primaryAction || footerHint) && (
        <footer
          className={cn(
            'shrink-0 border-t border-gray-200 bg-white',
            !isFill && 'sticky bottom-0 z-20 rounded-b-xl',
          )}
        >
          <div
            className={cn(
              COLUMN,
              'flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between',
            )}
          >
            <div className="order-2 sm:order-1">
              {backAction && (
                <WizardActionButton
                  action={{
                    variant: 'ghost',
                    icon: ArrowLeft,
                    iconPosition: 'leading',
                    ...backAction,
                  }}
                  className="w-full sm:w-auto text-gray-600 hover:text-gray-900"
                />
              )}
            </div>

            <div className="order-1 flex flex-col gap-3 sm:order-2 sm:flex-row sm:items-center">
              {footerHint && (
                <p id={hintId} className="text-xs text-gray-500 sm:max-w-sm sm:text-right">
                  {footerHint}
                </p>
              )}
              {secondaryAction && (
                <WizardActionButton
                  action={{ variant: 'outline', ...secondaryAction }}
                  className="w-full sm:w-auto"
                />
              )}
              {primaryAction && (
                <WizardActionButton
                  action={primaryAction}
                  className="w-full sm:w-auto"
                  // A disabled button explains nothing on its own; point at the
                  // hint that says what is still missing.
                  describedBy={footerHint ? hintId : undefined}
                />
              )}
            </div>
          </div>
        </footer>
      )}
    </div>
  );
}
