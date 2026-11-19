import { Link } from 'react-router';
import { ArrowRight } from 'lucide-react';
import type { AdviceStep } from '../../components/pages/adviceProcess';
import { SectionHead } from './SectionHead';
import '../styles/sections.css';
import '../styles/home.css';

interface ProcessStepsProps {
  index: string;
  title: string;
  lead: string;
  steps: readonly AdviceStep[];
  action: { label: string; to: string };
}

/** The advice process as numbered stops on one line. */
export function ProcessSteps({ index, title, lead, steps, action }: ProcessStepsProps) {
  return (
    <section className="nw-sec nw-sec--white" aria-labelledby="nwpr-title">
      <div className="nw-wrap">
        <div className="nw-sec-row">
          <SectionHead
            index={index}
            kicker="Process"
            title={title}
            lead={lead}
            titleId="nwpr-title"
          />
          <Link className="nw-btn" to={action.to}>
            {action.label}
            <ArrowRight size={16} strokeWidth={1.75} aria-hidden="true" />
          </Link>
        </div>
        <div className="nwpr-track">
          <ol className="nwpr-steps">
            {steps.map((step) => (
              <li key={step.step}>
                <span className="nwpr-marker nw-mono" aria-hidden="true">
                  {step.step}
                </span>
                <h3 className="nwpr-title">{step.title}</h3>
                <p className="nwpr-desc">{step.description}</p>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
