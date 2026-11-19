/**
 * AdvisersSupport — "End-to-end support": an illustration of a transition's
 * route (stages done, in progress and next) beside the section head and the
 * four ways the transition is supported. The illustration is decorative, as
 * the board marks it: its text is a picture of a route, not a client's record.
 */
import { Check } from 'lucide-react';
import type { AdvisersIconType } from './AdvisersIcons';
import { SectionHead } from './SectionHead';
import '../styles/sections.css';
import '../styles/for-advisers.css';

export interface AdvisersRouteStep {
  label: string;
  status: string;
  state: 'done' | 'current' | 'next';
}

export interface AdvisersFeature {
  title: string;
  description: string;
  icon: AdvisersIconType;
}

interface AdvisersSupportProps {
  index: string;
  kicker: string;
  title: string;
  lead: string;
  note: string;
  route: { label: string; badge: string; steps: readonly AdvisersRouteStep[] };
  features: readonly AdvisersFeature[];
}

export function AdvisersSupport({
  index,
  kicker,
  title,
  lead,
  note,
  route,
  features,
}: AdvisersSupportProps) {
  return (
    <section className="nw-sec nw-sec--white" aria-labelledby="nwfa-support-title">
      <div className="nw-wrap nwfa-split">
        <div className="nwfa-route" aria-hidden="true">
          <div className="nw-grid-bg" />
          <div className="nwfa-route-inner">
            <div className="nwfa-route-head">
              <span className="nw-mono nwfa-route-label">{route.label}</span>
              <span className="nw-mono nwfa-route-badge">{route.badge}</span>
            </div>
            <ol className="nwfa-route-steps">
              {route.steps.map((step) => (
                <li key={step.label} data-state={step.state}>
                  <span className="nwfa-route-mark">
                    {step.state === 'done' ? (
                      <Check size={16} strokeWidth={1.75} color="#FFFFFF" />
                    ) : step.state === 'current' ? (
                      <span className="nwfa-route-dot" />
                    ) : null}
                  </span>
                  <span className="nwfa-route-box">
                    <span className="nwfa-route-t">{step.label}</span>
                    <span className="nw-mono nwfa-route-s">{step.status}</span>
                  </span>
                </li>
              ))}
            </ol>
          </div>
        </div>

        <div>
          <SectionHead
            index={index}
            kicker={kicker}
            title={title}
            lead={lead}
            titleId="nwfa-support-title"
            className="nwfa-head nwfa-head--long"
          />
          <p className="nwfa-note">{note}</p>
          <ul className="nwfa-feats">
            {features.map((feature) => {
              const Icon = feature.icon;
              return (
                <li key={feature.title}>
                  <span className="nwfa-feat-icon">
                    <Icon size={18} strokeWidth={1.75} aria-hidden="true" />
                  </span>
                  <span>
                    <span className="nwfa-feat-t">{feature.title}</span>
                    <span className="nwfa-feat-d">{feature.description}</span>
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </section>
  );
}
