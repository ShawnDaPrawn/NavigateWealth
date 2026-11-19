import type { AdviceStep } from '../../components/pages/adviceProcess';
import { SectionHead } from './SectionHead';
import type { ServicesIcon } from './ServicesIcons';
import '../styles/sections.css';
import '../styles/services.css';

interface ServicesProcessProps {
  index: string;
  title: string;
  lead: string;
  steps: readonly AdviceStep[];
  /** One icon per step, in order. */
  icons: readonly ServicesIcon[];
}

/** The advice process as legs of a course, joined by a dashed line. */
export function ServicesProcess({ index, title, lead, steps, icons }: ServicesProcessProps) {
  return (
    <section className="nwsv-proc" aria-labelledby="nwsv-proc-title">
      <div className="nw-wrap">
        <SectionHead
          index={index}
          kicker="Process"
          title={title}
          lead={lead}
          center
          titleId="nwsv-proc-title"
          className="nwsv-head nwsv-head--proc"
        />
        <div className="nwsv-proc-track">
          <div className="nwsv-proc-line" aria-hidden="true" />
          <ol className="nwsv-steps">
            {steps.map((step, i) => {
              const Icon = icons[i];
              return (
                <li key={step.step}>
                  <span
                    className={i === 0 ? 'nwsv-step-mark nwsv-step-mark--first' : 'nwsv-step-mark'}
                    aria-hidden="true"
                  >
                    {Icon ? <Icon size={22} /> : null}
                  </span>
                  <span className="nw-mono nwsv-step-leg" aria-hidden="true">
                    LEG {step.step}
                  </span>
                  <h3 className="nwsv-step-t">{step.title}</h3>
                  <p className="nwsv-step-d">{step.description}</p>
                </li>
              );
            })}
          </ol>
        </div>
      </div>
    </section>
  );
}
