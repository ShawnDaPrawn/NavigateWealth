/**
 * "How We Work": the advice process as legs of a course, numbered stops on a
 * dashed line, with the heading centred above.
 */
import type { AdviceStep } from '../../components/pages/adviceProcess';
import { SectionHead } from './SectionHead';
import '../styles/sections.css';
import '../styles/for-individuals.css';

interface IndividualsProcessProps {
  index: string;
  title: string;
  lead: string;
  steps: readonly AdviceStep[];
}

export function IndividualsProcess({ index, title, lead, steps }: IndividualsProcessProps) {
  return (
    <section className="nw-sec nwfi-paper" aria-labelledby="nwfi-proc-title">
      <div className="nw-wrap">
        <SectionHead
          index={index}
          kicker="Process"
          title={title}
          lead={lead}
          titleId="nwfi-proc-title"
          center
          className="nwfi-head--620"
        />
        <div className="nwfi-legs-track">
          <ol className="nwfi-legs">
            {steps.map((step, i) => (
              <li key={step.step}>
                <span
                  className={
                    i === 0 ? 'nw-mono nwfi-leg-mark nwfi-leg-mark--first' : 'nw-mono nwfi-leg-mark'
                  }
                  aria-hidden="true"
                >
                  {step.step}
                </span>
                <span className="nw-mono nwfi-leg-k">LEG {step.step}</span>
                <h3 className="nwfi-leg-t">{step.title}</h3>
                <p className="nwfi-leg-d">{step.description}</p>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
