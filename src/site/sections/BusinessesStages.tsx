/**
 * "Every stage": the introduction, the five business stages as stops on a
 * dashed line, and a photograph with a caption card. The photograph is hidden
 * on phones, as the board draws it, and is not downloaded there.
 */
import type { ReactNode } from 'react';
import { NwImage } from '../components/NwImage';
import type { BusinessesIcon } from './BusinessesIcons';
import { BarChartIcon } from './BusinessesIcons';
import '../styles/for-businesses.css';

export interface BusinessesStage {
  title: string;
  description: string;
  icon: BusinessesIcon;
}

interface BusinessesStagesProps {
  kicker: string;
  title: string;
  lead: string;
  stages: readonly BusinessesStage[];
  image: { src: string; imageKey?: string; alt: string };
  caption: { label: string; text: ReactNode };
}

export function BusinessesStages({
  kicker,
  title,
  lead,
  stages,
  image,
  caption,
}: BusinessesStagesProps) {
  return (
    <section className="nw-sec nwfb-stage" aria-labelledby="nwfb-stage-title">
      <div className="nw-wrap nwfb-split">
        <div>
          <p className="nw-kicker nw-mono">{kicker}</p>
          <h2 id="nwfb-stage-title" className="nwfb-h2">
            {title}
          </h2>
          <p className="nwfb-lead nwfb-lead--loose">{lead}</p>

          <ol className="nwfb-stages">
            {stages.map(({ title: stage, description, icon: Icon }, i) => (
              <li key={stage}>
                <span
                  className={
                    i === stages.length - 1 ? 'nwfb-stage-dot nwfb-stage-dot--on' : 'nwfb-stage-dot'
                  }
                  aria-hidden="true"
                >
                  <Icon size={20} />
                </span>
                <span className="nwfb-stage-t">{stage}</span>
                <span className="nwfb-stage-d">{description}</span>
              </li>
            ))}
          </ol>
        </div>

        <figure className="nwfb-figure">
          <div className="nwfb-photo">
            <NwImage
              src={image.src}
              imageKey={image.imageKey}
              alt={image.alt}
              sizes="(max-width: 1000px) 100vw, 600px"
              hiddenBelow={760}
            />
          </div>
          <figcaption className="nwfb-figcap">
            <span className="nwfb-figcap-icon" aria-hidden="true">
              <BarChartIcon size={18} />
            </span>
            <span>
              <span className="nw-mono nwfb-figcap-k">{caption.label}</span>
              <span className="nwfb-figcap-t">{caption.text}</span>
            </span>
          </figcaption>
        </figure>
      </div>
    </section>
  );
}
