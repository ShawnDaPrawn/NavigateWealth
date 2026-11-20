/**
 * ProductQuoteWizard — the board's step-by-step quote form: the numbered
 * steps across the top (a finished one takes the visitor back to it), the
 * current step, and the bar along the bottom with Back or Previous, what is
 * still needed, and Next or Submit Quote Request.
 *
 * Each service's wizard (ProductQuoteRisk, ProductQuoteMedical, …) owns its
 * answers, checks and request, as the live wizards do; this is the frame they
 * share (ProductQuoteSend.ts sends their request).
 */
import { useEffect, useRef, type ReactNode } from 'react';
import { Link } from 'react-router';
import { ProductQuoteIcon } from './ProductQuoteIcons';
import '../styles/product-quote.css';

interface ProductQuoteWizardProps {
  /** The wizard's own step labels, in order (the live WIZARD_STEPS). */
  steps: readonly string[];
  step: number;
  onStep: (step: number) => void;
  /** Whether the current step's required answers are in. */
  valid: boolean;
  /** What is still needed, shown beside a disabled Next. */
  hint: string;
  /** The funnel's previous step, for Back on the first step. */
  backHref: string;
  submitting: boolean;
  failure: string;
  onSubmit: () => void;
  children: ReactNode;
}

export function ProductQuoteWizard({
  steps,
  step,
  onStep,
  valid,
  hint,
  backHref,
  submitting,
  failure,
  onSubmit,
  children,
}: ProductQuoteWizardProps) {
  const last = steps.length;
  const bodyRef = useRef<HTMLDivElement>(null);
  const failureRef = useRef<HTMLDivElement>(null);
  const shownStep = useRef(step);

  // A new step starts at its heading: focus it, which also brings it into view.
  useEffect(() => {
    if (shownStep.current === step) return;
    shownStep.current = step;
    bodyRef.current?.querySelector<HTMLElement>('.nwpq-step-title')?.focus();
  }, [step]);

  useEffect(() => {
    if (failure) failureRef.current?.scrollIntoView?.({ block: 'nearest' });
  }, [failure]);

  const hintId = `nwpq-hint-${step}`;

  return (
    <div>
      <div className="nwpq-tabs-wrap">
        <ol
          aria-label="Quote wizard steps"
          className={last > 4 ? 'nwpq-tabs nwpq-tabs--many' : 'nwpq-tabs'}
          style={{ ['--nwpq-n' as string]: last }}
        >
          {steps.map((label, idx) => {
            const n = idx + 1;
            const isCurrent = n === step;
            const isDone = n < step;
            const state = isCurrent ? 'current' : isDone ? 'done' : 'todo';
            return (
              <li key={label} aria-current={isCurrent ? 'step' : undefined} className="nwpq-tab">
                <button
                  type="button"
                  className={`nwpq-tab-btn nwpq-tab-btn--${state}`}
                  disabled={!isDone}
                  onClick={() => onStep(n)}
                  aria-label={`Step ${n}: ${label}${isDone ? ' (completed, go back)' : isCurrent ? ' (current)' : ''}`}
                >
                  <span className="nwpq-tab-bar" />
                  <span className="nwpq-tab-row">
                    <span className="nw-h nwpq-tab-no">0{n}</span>
                    <span className="nwpq-tab-label">{label}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      </div>

      <div ref={bodyRef} className="nwpq-body">
        {children}
        {failure ? (
          <div ref={failureRef} className="nwpq-alert nw-in" role="alert">
            <ProductQuoteIcon name="alert" size={14} />
            <span>{failure}</span>
          </div>
        ) : null}
      </div>

      <div className="nwpq-foot">
        {step === 1 ? (
          <Link className="nw-outline nwpq-back" to={backHref}>
            <ProductQuoteIcon name="arrowLeft" size={16} />
            Back
          </Link>
        ) : (
          <button type="button" className="nw-outline nwpq-back" onClick={() => onStep(step - 1)}>
            <ProductQuoteIcon name="arrowLeft" size={16} />
            Previous
          </button>
        )}
        <div className="nwpq-foot-end">
          {!valid && step < last ? (
            <span id={hintId} className="nwpq-hint">
              {hint}
            </span>
          ) : null}
          {step < last ? (
            <button
              type="button"
              className="nw-btn nwpq-next"
              disabled={!valid}
              aria-describedby={!valid ? hintId : undefined}
              onClick={() => {
                if (valid) onStep(step + 1);
              }}
            >
              Next <ProductQuoteIcon name="arrowRight" size={16} />
            </button>
          ) : (
            <button
              type="button"
              className="nw-btn nwpq-submit"
              disabled={submitting}
              onClick={onSubmit}
            >
              {submitting ? 'Submitting...' : 'Submit Quote Request'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
