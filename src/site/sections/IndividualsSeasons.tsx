/**
 * "Your Financial Partner in Every Season": the copy and the life milestones
 * as stops on a dashed line, beside a photograph with a caption card. The
 * photograph is hidden on phones, as the board draws it, and is not
 * downloaded there.
 */
import type { LucideIcon } from 'lucide-react';
import { NwImage } from '../components/NwImage';
import { CompassIcon, IndividualsIcon } from './IndividualsIcons';
import { SectionHead } from './SectionHead';
import '../styles/sections.css';
import '../styles/for-individuals.css';

interface IndividualsSeasonsProps {
  index: string;
  kicker: string;
  title: string;
  lead: string;
  milestones: readonly { icon: LucideIcon; title: string; description: string }[];
  photo: { src: string; imageKey: string; alt: string };
  caption: { label: string; text: string };
}

export function IndividualsSeasons({
  index,
  kicker,
  title,
  lead,
  milestones,
  photo,
  caption,
}: IndividualsSeasonsProps) {
  return (
    <section className="nw-sec nwfi-white" aria-labelledby="nwfi-seasons-title">
      <div className="nw-wrap nwfi-split">
        <div>
          <SectionHead
            index={index}
            kicker={kicker}
            title={title}
            lead={lead}
            titleId="nwfi-seasons-title"
            className="nwfi-head--long"
          />
          <ol className="nwfi-stops">
            {milestones.map(({ icon, title: stop, description }, i) => (
              <li
                key={stop}
                className={i === milestones.length - 1 ? 'nwfi-stop nwfi-stop--last' : 'nwfi-stop'}
              >
                <span className="nwfi-stop-mark" aria-hidden="true">
                  <IndividualsIcon icon={icon} size={20} />
                </span>
                <span className="nwfi-stop-t">{stop}</span>
                <span className="nwfi-stop-d">{description}</span>
              </li>
            ))}
          </ol>
        </div>
        <figure className="nwfi-figure">
          <div className="nwfi-figure-frame">
            <NwImage
              src={photo.src}
              imageKey={photo.imageKey}
              alt={photo.alt}
              className="nwfi-figure-img"
              sizes="(max-width: 1320px) 50vw, 576px"
              hiddenBelow={760}
            />
          </div>
          <figcaption className="nwfi-caption">
            <span className="nwfi-caption-icon" aria-hidden="true">
              <CompassIcon size={18} />
            </span>
            <span>
              <span className="nw-mono nwfi-caption-k">{caption.label}</span>
              <span className="nwfi-caption-t">{caption.text}</span>
            </span>
          </figcaption>
        </figure>
      </div>
    </section>
  );
}
