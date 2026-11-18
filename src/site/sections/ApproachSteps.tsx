import { Link } from 'react-router';
import { ArrowRight, ShieldCheck } from 'lucide-react';
import { SectionHead } from './SectionHead';
import { pad2 } from './format';
import '../styles/sections.css';

export interface ApproachStepItem {
  title: string;
  description: string;
  details: string[];
}

interface ApproachStepsProps {
  id?: string;
  index: string;
  title: string;
  lead?: string;
  steps: ApproachStepItem[];
  promise?: string;
  quoteLink: string;
}

/** "Our Approach": numbered legs on navy, with the firm's promise beneath. */
export function ApproachSteps({
  id = 'approach',
  index,
  title,
  lead,
  steps,
  promise,
  quoteLink,
}: ApproachStepsProps) {
  return (
    <section id={id} aria-label="Our approach" className="nw-sec nwa">
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
                  Leg {pad2(i + 1)}
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
              <ShieldCheck size={22} strokeWidth={1.75} />
            </span>
            <p>{promise}</p>
            <Link className="nw-btn" to={quoteLink}>
              Get a Quote
              <ArrowRight size={16} strokeWidth={1.75} aria-hidden="true" />
            </Link>
          </div>
        ) : null}
      </div>
    </section>
  );
}
