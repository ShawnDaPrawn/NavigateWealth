/**
 * "How We Work": the advice process as four legs on a dashed course line,
 * under a centred heading. The first leg's marker is filled.
 */
import type { AdviceStep } from '../../components/pages/adviceProcess';
import '../styles/for-businesses.css';

interface BusinessesProcessProps {
  kicker: string;
  title: string;
  lead: string;
  steps: readonly AdviceStep[];
}

export function BusinessesProcess({ kicker, title, lead, steps }: BusinessesProcessProps) {
  return (
    <section className="nw-sec nwfb-proc" aria-labelledby="nwfb-proc-title">
      <div className="nw-wrap">
        <div className="nwfb-proc-head">
          <p className="nw-kicker nw-mono">{kicker}</p>
          <h2 id="nwfb-proc-title" className="nwfb-h2">
            {title}
          </h2>
          <p className="nwfb-lead nwfb-proc-lead">{lead}</p>
        </div>
        <div className="nwfb-proc-track">
          <ol className="nwfb-legs">
            {steps.map(({ step, title: name, description }, i) => (
              <li key={step}>
                <span
                  className={
                    i === 0 ? 'nw-mono nwfb-leg-dot nwfb-leg-dot--on' : 'nw-mono nwfb-leg-dot'
                  }
                  aria-hidden="true"
                >
                  {step}
                </span>
                <span className="nw-mono nwfb-leg-k">LEG {step}</span>
                <h3 className="nwfb-leg-t">{name}</h3>
                <p className="nwfb-leg-d">{description}</p>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
