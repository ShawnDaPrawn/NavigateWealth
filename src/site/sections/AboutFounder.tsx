/**
 * AboutFounder — "A Note From Our Founder": the founder's portrait beside his
 * note. The note, his name, title and photograph come from FOUNDER in
 * companyFacts, as on the live page, so the About and Team pages cannot drift
 * apart. `id="founder"` is the target of the hero's "Meet Our Founder" link
 * and of /about#founder from the Team page.
 */
import { NwImage } from '../components/NwImage';
import '../styles/sections.css';
import '../styles/about.css';

interface AboutFounderProps {
  kicker: string;
  title: string;
  name: string;
  role: string;
  /** Shown on the caption's right, e.g. "FSP 54606". */
  credential: string;
  note: readonly string[];
  photo: { src: string; imageKey: string; alt: string };
}

export function AboutFounder({
  kicker,
  title,
  name,
  role,
  credential,
  note,
  photo,
}: AboutFounderProps) {
  return (
    <section id="founder" className="nwab-founder" aria-labelledby="nwab-founder-title">
      <div className="nw-wrap nwab-founder-grid">
        <figure className="nwab-figure">
          <div className="nwab-portrait">
            <NwImage
              src={photo.src}
              imageKey={photo.imageKey}
              alt={photo.alt}
              sizes="(min-width: 1320px) 572px, (min-width: 920px) 45vw, 100vw"
              width={1254}
              height={1254}
            />
          </div>
          <figcaption className="nwab-caption">
            <span>
              <span className="nwab-cap-name">{name}</span>
              <span className="nwab-cap-title">{role}</span>
            </span>
            <span className="nwab-cap-fsp nw-mono">{credential}</span>
          </figcaption>
        </figure>

        <div>
          <p className="nw-kicker nw-mono nwab-kicker">{kicker}</p>
          <h2 id="nwab-founder-title" className="nwab-h2">
            {title}
          </h2>
          <div className="nwab-note">
            {note.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
          </div>
          <div className="nwab-sign">
            <span className="nwab-sign-rule" aria-hidden="true" />
            <span className="nwab-sign-name">
              {name}, {role}
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
