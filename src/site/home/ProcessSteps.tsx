/**
 * "How We Work" — the four-step process from the live Services page, as a
 * dashed course line with a waypoint per step. The home page numbers the
 * waypoints and offers a consultation beside the heading; the Services page
 * centres the heading and marks each leg with an icon.
 */
import { Link } from 'react-router';
import { ArrowRight, ChartColumn, CircleCheck, RefreshCw, Search } from 'lucide-react';
import { PROCESS_STEPS } from '../../components/pages/servicesPageData';
import { SectionHead } from '../sections/SectionHead';
import { CONSULTATION_PATH } from './homeContent';

const LEG_ICONS = [Search, ChartColumn, CircleCheck, RefreshCw];

interface ProcessStepsProps {
  index: string;
  variant: 'home' | 'services';
}

export function ProcessSteps({ index, variant }: ProcessStepsProps) {
  const home = variant === 'home';
  const head = (
    <SectionHead
      index={index}
      kicker="Process"
      title="How We Work"
      titleId={`nwhm-process-${variant}`}
      lead="A simple, transparent process designed to put your financial goals at the centre of every decision."
      center={!home}
    />
  );
  return (
    <section
      className={`nw-sec ${home ? 'nw-sec--white' : 'nw-sec--paper'} nwhm-process nwhm-process--${variant}`}
      aria-labelledby={`nwhm-process-${variant}`}
    >
      <div className="nw-wrap">
        {home ? (
          <div className="nwhm-head-row">
            {head}
            <Link className="nw-btn" to={CONSULTATION_PATH}>
              Book a Free Consultation
              <ArrowRight size={16} strokeWidth={1.75} aria-hidden="true" />
            </Link>
          </div>
        ) : (
          head
        )}
        <div className="nwhm-steps-track">
          <ol className="nwhm-steps">
            {PROCESS_STEPS.map((step, i) => {
              const Icon = LEG_ICONS[i % LEG_ICONS.length];
              return (
                <li key={step.step}>
                  <span className="nwhm-step-mark nw-mono" aria-hidden="true">
                    {home ? step.step : <Icon size={22} strokeWidth={1.75} />}
                  </span>
                  {home ? null : (
                    <span className="nwhm-step-leg nw-mono" aria-hidden="true">
                      Leg {step.step}
                    </span>
                  )}
                  <h3 className="nwhm-step-t">{step.title}</h3>
                  <p className="nwhm-step-d">{step.description}</p>
                </li>
              );
            })}
          </ol>
        </div>
      </div>
    </section>
  );
}
