/**
 * AdvisersJourney — "Your practice journey": the section head, the five
 * practice stages as stops on one dashed line (the last one, retirement,
 * filled), and a photograph with its caption card. Phones drop the
 * photograph, as the board does, and never download it.
 */
import { NwImage } from '../components/NwImage';
import { Lock } from 'lucide-react';
import type { AdvisersIconType } from './AdvisersIcons';
import { SectionHead } from './SectionHead';
import '../styles/sections.css';
import '../styles/for-advisers.css';

export interface AdvisersStage {
  title: string;
  description: string;
  icon: AdvisersIconType;
}

interface AdvisersJourneyProps {
  index: string;
  kicker: string;
  title: string;
  lead: string;
  stages: readonly AdvisersStage[];
  photo: { src: string; imageKey: string; alt: string };
  caption: { label: string; text: string };
}

export function AdvisersJourney({
  index,
  kicker,
  title,
  lead,
  stages,
  photo,
  caption,
}: AdvisersJourneyProps) {
  return (
    <section className="nw-sec nw-sec--white" aria-labelledby="nwfa-journey-title">
      <div className="nw-wrap nwfa-split">
        <div>
          <SectionHead
            index={index}
            kicker={kicker}
            title={title}
            lead={lead}
            titleId="nwfa-journey-title"
            className="nwfa-head nwfa-head--long"
          />
          <ol className="nwfa-stages">
            {stages.map((stage) => {
              const Icon = stage.icon;
              return (
                <li key={stage.title}>
                  <span className="nwfa-stage-mark" aria-hidden="true">
                    <Icon size={20} strokeWidth={1.75} aria-hidden="true" />
                  </span>
                  <span className="nwfa-stage-t">{stage.title}</span>
                  <span className="nwfa-stage-d">{stage.description}</span>
                </li>
              );
            })}
          </ol>
        </div>
        <figure className="nwfa-figure">
          <div className="nwfa-photo">
            <NwImage
              src={photo.src}
              imageKey={photo.imageKey}
              alt={photo.alt}
              sizes="(min-width: 1320px) 576px, 50vw"
              hiddenBelow={760}
            />
          </div>
          <figcaption className="nwfa-cap">
            <span className="nwfa-cap-icon" aria-hidden="true">
              <Lock size={18} strokeWidth={1.75} aria-hidden="true" />
            </span>
            <span>
              <span className="nw-mono nwfa-cap-l">{caption.label}</span>
              <span className="nwfa-cap-t">{caption.text}</span>
            </span>
          </figcaption>
        </figure>
      </div>
    </section>
  );
}
