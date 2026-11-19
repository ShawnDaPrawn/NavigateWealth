/**
 * BookingHero — the booking page's dark hero: the page's one H1, its lead,
 * three trust marks and a card with the firm's business hours and booking
 * notice. Drawn from the "Schedule Consultation" board.
 */
import { BookingIcon, type BookingIconName } from './BookingIcons';

interface BookingHeroProps {
  badge: string;
  title: string;
  accent: string;
  lead: string;
  marks: readonly { label: string; icon: BookingIconName }[];
  hours: string;
  notice: string;
}

export function BookingHero({
  badge,
  title,
  accent,
  lead,
  marks,
  hours,
  notice,
}: BookingHeroProps) {
  return (
    <section className="nwbk-hero" aria-labelledby="nwbk-title">
      <div className="nw-grid-bg nwbk-hero-grid" aria-hidden="true" />
      <div className="nwbk-hero-glow" aria-hidden="true" />
      <div className="nw-wrap nwbk-hero-row">
        <div className="nwbk-hero-copy">
          <div className="nwbk-pill">
            <BookingIcon name="calendar" size={14} stroke="#C5CAD3" />
            <span>{badge}</span>
          </div>
          <h1 id="nwbk-title" className="nwbk-title">
            {title} <span className="nw-accent">{accent}</span>
          </h1>
          <p className="nwbk-lead">{lead}</p>
          <ul className="nwbk-marks">
            {marks.map((mark) => (
              <li key={mark.label}>
                <BookingIcon name={mark.icon} size={16} stroke="#C5CAD3" />
                {mark.label}
              </li>
            ))}
          </ul>
        </div>
        <div className="nwbk-hours">
          <div className="nwbk-hours-head">
            <span className="nw-mono nwbk-hours-label">Business Hours</span>
            <span className="nw-mono nwbk-hours-zone">SAST</span>
          </div>
          <p className="nwbk-hours-time">{hours}</p>
          <p className="nwbk-hours-note">{notice}</p>
        </div>
      </div>
    </section>
  );
}
