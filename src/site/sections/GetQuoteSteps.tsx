/**
 * GetQuoteSteps — the quote flow's progress card: three numbered steps, the
 * first one current, and a line on what asking for a quote involves.
 */
import { GetQuoteIcon } from './GetQuoteIcons';
import '../styles/get-quote.css';

export interface GetQuoteStep {
  label: string;
  /** Shown under the current step only, and not on narrow screens. */
  hint?: string;
}

interface GetQuoteStepsProps {
  steps: readonly GetQuoteStep[];
  /** The first is the time it takes (with a clock); the rest are plain. */
  notes: readonly string[];
}

export function GetQuoteSteps({ steps, notes }: GetQuoteStepsProps) {
  return (
    <nav className="nwgq-steps" aria-label="Quote progress">
      <ol className="nwgq-steps-list">
        {steps.map((step, i) => {
          const current = i === 0;
          return (
            <li
              key={step.label}
              className="nwgq-step"
              data-current={current || undefined}
              aria-current={current ? 'step' : undefined}
            >
              {/* The rule into the next step is darker than the one after it. */}
              {i > 0 && (
                <span
                  className="nwgq-step-rule nwgq-hide-md"
                  data-next={i === 1 || undefined}
                  aria-hidden="true"
                />
              )}
              <span className="nw-mono nwgq-step-no">{i + 1}</span>
              {current ? (
                <span className="nwgq-step-text">
                  <span className="nwgq-step-label">{step.label}</span>
                  {step.hint && <span className="nwgq-step-hint nwgq-hide-md">{step.hint}</span>}
                </span>
              ) : (
                <span className="nwgq-step-label">{step.label}</span>
              )}
            </li>
          );
        })}
      </ol>
      <p className="nwgq-steps-notes">
        {notes.map((note, i) =>
          i === 0 ? (
            <span key={note} className="nwgq-steps-time">
              <GetQuoteIcon name="timer" size={14} />
              {note}
            </span>
          ) : (
            <span key={note}>{note}</span>
          ),
        )}
      </p>
    </nav>
  );
}
