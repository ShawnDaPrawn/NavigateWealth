/**
 * AdvisersProcess — "How We Work", as the For Advisers board draws it: a
 * centred head and the four legs of the advice process on one dashed line,
 * the first stop filled. (The home page's ProcessSteps puts an action beside
 * a left-aligned head and draws its stops smaller, so it is not reused here.)
 */
import type { AdviceStep } from '../../components/pages/adviceProcess';
import { SectionHead } from './SectionHead';
import '../styles/sections.css';
import '../styles/for-advisers.css';

interface AdvisersProcessProps {
  index: string;
  title: string;
  lead: string;
  steps: readonly AdviceStep[];
}

export function AdvisersProcess({ index, title, lead, steps }: AdvisersProcessProps) {
  return (
    <section className="nw-sec nw-sec--paper" aria-labelledby="nwfa-process-title">
      <div className="nw-wrap">
        <SectionHead
          index={index}
          kicker="Process"
          title={title}
          lead={lead}
          center
          titleId="nwfa-process-title"
          className="nwfa-head nwfa-head--center"
        />
        <div className="nwfa-legs-track">
          <ol className="nwfa-legs">
            {steps.map((step) => (
              <li key={step.step}>
                <span className="nw-mono nwfa-leg-mark" aria-hidden="true">
                  {step.step}
                </span>
                <span className="nw-mono nwfa-leg-no">LEG {step.step}</span>
                <h3 className="nw-h nwfa-leg-t">{step.title}</h3>
                <p className="nwfa-leg-d">{step.description}</p>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
