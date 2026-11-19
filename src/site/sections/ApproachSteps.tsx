/**
 * ApproachSteps — "Our Approach" on a service page, in one of the two forms
 * the boards draw:
 * - `legs`: numbered legs on navy joined by a dashed line, with detail chips
 *   and a promise strip (Medical Aid, Retirement, Investment, Employee
 *   Benefits);
 * - `cards`: icon dots over white step cards with ticked details, and the
 *   promise on a navy card (Tax, Estate, Financial Planning).
 */
import type { CSSProperties } from 'react';
import { Link } from 'react-router';
import { SectionHead } from './SectionHead';
import { ServiceIcon, type ServiceIconName } from './serviceIcons';
import { pad2 } from './format';
import '../styles/sections.css';

export interface ApproachStepItem {
  title: string;
  description: string;
  details: string[];
}

interface ApproachStepsProps {
  id?: string;
  variant?: 'legs' | 'cards';
  index: string;
  title: string;
  lead?: string;
  /** Width of the lead under the heading, in px. */
  leadWidth?: number;
  steps: ApproachStepItem[];
  promise?: string;
  quoteLink: string;
}

/** The cards board's three step icons: find, discuss, confirm. */
const STEP_ICONS: ServiceIconName[] = ['search', 'message', 'checkCircle'];

export function ApproachSteps({
  id = 'approach',
  variant = 'legs',
  index,
  title,
  lead,
  leadWidth,
  steps,
  promise,
  quoteLink,
}: ApproachStepsProps) {
  const style = leadWidth ? ({ '--nwa-lead-w': `${leadWidth}px` } as CSSProperties) : undefined;
  const quote = (
    <Link className="nw-btn" to={quoteLink}>
      Get a Quote
      <ServiceIcon name="arrowRight" size={16} />
    </Link>
  );

  if (variant === 'cards') {
    return (
      <section id={id} aria-label="Our approach" className="nw-sec nw-sec--white nwa-cards">
        <div className="nw-wrap">
          <SectionHead index={index} kicker="Our Approach" title={title} lead={lead} center />
          <div className="nwa-ctrack">
            <ol className="nwa-csteps">
              {steps.map((step, i) => (
                <li key={step.title}>
                  <span className="nwa-dot" aria-hidden="true">
                    <ServiceIcon name={STEP_ICONS[i % STEP_ICONS.length]} size={26} />
                  </span>
                  <div className="nwa-card">
                    <span className="nwa-step nw-mono" aria-hidden="true">
                      STEP {pad2(i + 1)}
                    </span>
                    <h3 className="nwa-ctitle">{step.title}</h3>
                    <p className="nwa-cdesc">{step.description}</p>
                    {step.details.length > 0 ? (
                      <ul className="nwa-cdetails">
                        {step.details.map((d) => (
                          <li key={d}>
                            <ServiceIcon name="check" size={14} stroke="#0D1626" />
                            {d}
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                </li>
              ))}
            </ol>
          </div>
          {promise ? (
            <div className="nwa-cpromise">
              <div className="nw-grid-bg" aria-hidden="true" />
              <div className="nwa-cpromise-copy">
                <span className="nwa-cpromise-icon" aria-hidden="true">
                  <ServiceIcon name="shieldCheck" size={20} />
                </span>
                <p>{promise}</p>
              </div>
              {quote}
            </div>
          ) : null}
        </div>
      </section>
    );
  }

  return (
    <section id={id} aria-label="Our approach" className="nw-sec nwa" style={style}>
      <div className="nw-grid-bg" aria-hidden="true" />
      <div className="nw-wrap">
        <SectionHead index={index} kicker="Our Approach" title={title} lead={lead} center dark />
        <div className="nwa-track">
          <ol className="nwa-steps">
            {steps.map((step, i) => (
              <li key={step.title}>
                <span className="nwa-marker nw-mono" aria-hidden="true">
                  {pad2(i + 1)}
                </span>
                <span className="nwa-leg nw-mono" aria-hidden="true">
                  LEG {pad2(i + 1)}
                </span>
                <h3 className="nwa-title">{step.title}</h3>
                <p className="nwa-desc">{step.description}</p>
                {step.details.length > 0 ? (
                  <ul className="nwa-details">
                    {step.details.map((d) => (
                      <li key={d}>{d}</li>
                    ))}
                  </ul>
                ) : null}
              </li>
            ))}
          </ol>
        </div>
        {promise ? (
          <div className="nwa-promise">
            <span className="nwa-promise-icon" aria-hidden="true">
              <ServiceIcon name="shieldCheck" size={22} />
            </span>
            <p>{promise}</p>
            {quote}
          </div>
        ) : null}
      </div>
    </section>
  );
}
