/**
 * NotFoundHero — the 404's navy opening: the "Off course" badge, the 4–0–4
 * with a compass for the zero whose needle searches for north, the heading,
 * and the way back. The needle and the badge's dot stand still for anyone who
 * prefers reduced motion.
 */
import { Link } from 'react-router';
import { NotFoundIcon } from './NotFoundIcons';
import '../styles/sections.css';
import '../styles/not-found.css';

interface NotFoundHeroProps {
  onGoBack: () => void;
}

export function NotFoundHero({ onGoBack }: NotFoundHeroProps) {
  return (
    <section className="nwnf-hero">
      <div className="nw-grid-bg nwnf-fade" aria-hidden="true" />
      <div className="nwnf-glow" aria-hidden="true" />
      <div className="nw-wrap nwnf-hero-inner">
        <div className="nwnf-badge">
          <span className="nwnf-blink" aria-hidden="true" />
          <span className="nw-mono nwnf-badge-t">404 error · Off course</span>
        </div>

        <div className="nwnf-digits" aria-hidden="true">
          <span className="nw-h nwnf-digit">4</span>
          <svg className="nwnf-compass" viewBox="0 0 120 120" focusable="false">
            <circle
              cx="60"
              cy="60"
              r="56"
              fill="rgba(13, 22, 38, 0.084)"
              stroke="rgba(201, 209, 224, 0.55)"
              strokeWidth="2"
            />
            <circle
              cx="60"
              cy="60"
              r="48"
              fill="none"
              stroke="rgba(255,255,255,0.28)"
              strokeWidth="5"
              strokeDasharray="0.6 3.59"
            />
            <circle
              cx="60"
              cy="60"
              r="48"
              fill="none"
              stroke="#C5CAD3"
              strokeWidth="9"
              strokeDasharray="1.2 24"
            />
            <text
              x="60"
              y="27"
              textAnchor="middle"
              fontFamily="Inter, sans-serif"
              fontSize="9"
              fontWeight="600"
              fill="#E3D9C3"
            >
              N
            </text>
            <g className="nwnf-needle">
              <polygon points="60,20 65,60 55,60" fill="#C5CAD3" />
              <polygon points="60,100 65,60 55,60" fill="rgba(255,255,255,0.3)" />
            </g>
            <circle cx="60" cy="60" r="6" fill="#0D1626" stroke="#E3D9C3" strokeWidth="2" />
          </svg>
          <span className="nw-h nwnf-digit">4</span>
        </div>

        <h1 className="nwnf-title">
          We can&apos;t find <span className="nw-accent">this page</span>
        </h1>
        <p className="nwnf-lead">
          The page you are looking for doesn&apos;t exist or has been moved.
        </p>
        <div className="nwnf-actions">
          <button type="button" className="nw-ghost-dark nwnf-action" onClick={onGoBack}>
            <NotFoundIcon name="arrowLeft" size={17} />
            Go back
          </button>
          <Link className="nw-btn nwnf-action" to="/">
            <NotFoundIcon name="home" size={17} />
            Go home
          </Link>
        </div>
      </div>
    </section>
  );
}
