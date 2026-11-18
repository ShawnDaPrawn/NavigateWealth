/**
 * The navigator's instrument beside the home hero: a compass rose whose
 * needle swings to a new heading with each slide. Pure decoration, drawn
 * inline (no download), so it is hidden from assistive technology. Phones get
 * the small dial instead (`CompassBadge`).
 */
import { COMPASS_READINGS } from './homeContent';

interface CompassProps {
  slide: number;
}

function reading(slide: number) {
  return COMPASS_READINGS[slide % COMPASS_READINGS.length];
}

const BEARINGS: { x: number; y: number; text: string; cardinal?: boolean }[] = [
  { x: 330, y: 88, text: '030' },
  { x: 396, y: 154, text: '060' },
  { x: 420, y: 245, text: 'E', cardinal: true },
  { x: 396, y: 334, text: '120' },
  { x: 330, y: 400, text: '150' },
  { x: 240, y: 425, text: 'S', cardinal: true },
  { x: 150, y: 400, text: '210' },
  { x: 84, y: 334, text: '240' },
  { x: 60, y: 245, text: 'W', cardinal: true },
  { x: 84, y: 154, text: '300' },
  { x: 150, y: 88, text: '330' },
];

export function HeroCompass({ slide }: CompassProps) {
  const { degrees, label } = reading(slide);
  return (
    <div className="nwhm-instrument" aria-hidden="true">
      <svg viewBox="0 0 480 480" width="500" height="500" className="nwhm-rose">
        <defs>
          <linearGradient id="nwhm-needle" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#E3D9C3" />
            <stop offset="1" stopColor="#6D28D9" />
          </linearGradient>
          <radialGradient id="nwhm-dial" cx="50%" cy="50%" r="50%">
            <stop offset="0" stopColor="#0D1626" stopOpacity="0.26" />
            <stop offset="0.72" stopColor="#0D1626" stopOpacity="0.05" />
            <stop offset="1" stopColor="#0D1626" stopOpacity="0" />
          </radialGradient>
        </defs>
        <circle cx="240" cy="240" r="236" fill="url(#nwhm-dial)" />
        <circle cx="240" cy="240" r="224" fill="none" stroke="rgba(255,255,255,0.16)" />
        <circle
          cx="240"
          cy="240"
          r="208"
          fill="none"
          stroke="rgba(255,255,255,0.24)"
          strokeWidth="8"
          strokeDasharray="1 17.15"
        />
        <circle
          cx="240"
          cy="240"
          r="208"
          fill="none"
          stroke="#C5CAD3"
          strokeOpacity="0.75"
          strokeWidth="16"
          strokeDasharray="2 106.92"
        />
        <circle
          cx="240"
          cy="240"
          r="150"
          fill="none"
          stroke="rgba(255,255,255,0.09)"
          strokeDasharray="2 6"
        />
        <circle cx="240" cy="240" r="96" fill="none" stroke="rgba(255,255,255,0.1)" />
        <line x1="40" y1="240" x2="440" y2="240" stroke="rgba(255,255,255,0.06)" />
        <line x1="240" y1="40" x2="240" y2="440" stroke="rgba(255,255,255,0.06)" />
        <g fontFamily="Inter, sans-serif" fontSize="11" fill="#9AA3B2" textAnchor="middle">
          <text x="240" y="64" fill="#E3D9C3" fontSize="15" fontWeight="600">
            N
          </text>
          {BEARINGS.map((b) =>
            b.cardinal ? (
              <text key={b.text} x={b.x} y={b.y} fontSize="14" fontWeight="600" fill="#C5CAD3">
                {b.text}
              </text>
            ) : (
              <text key={b.text} x={b.x} y={b.y}>
                {b.text}
              </text>
            ),
          )}
        </g>
        <polygon
          points="296.6,183.4 258,240 296.6,296.6 240,258 183.4,296.6 222,240 183.4,183.4 240,222"
          fill="rgba(255,255,255,0.02)"
          stroke="rgba(255,255,255,0.12)"
        />
        <polygon
          points="240,112 258.4,221.6 368,240 258.4,258.4 240,368 221.6,258.4 112,240 221.6,221.6"
          fill="rgba(255,255,255,0.03)"
          stroke="rgba(255,255,255,0.18)"
        />
        <polyline
          points="96,372 168,318 238,262 314,196 372,128"
          fill="none"
          stroke="#C5CAD3"
          strokeOpacity="0.55"
          strokeWidth="1.5"
          strokeDasharray="5 6"
        />
        <circle cx="168" cy="318" r="4" fill="#0D1626" stroke="#C5CAD3" strokeWidth="1.5" />
        <circle cx="314" cy="196" r="4" fill="#0D1626" stroke="#C5CAD3" strokeWidth="1.5" />
        <circle
          cx="372"
          cy="128"
          r="6"
          fill="#C5CAD3"
          fillOpacity="0.25"
          stroke="#C5CAD3"
          strokeWidth="1.5"
        />
        <g className="nwhm-needle" style={{ transform: `rotate(${degrees}deg)` }}>
          <polygon points="240,78 251,240 229,240" fill="url(#nwhm-needle)" />
          <polygon points="240,402 251,240 229,240" fill="rgba(255,255,255,0.22)" />
        </g>
        <circle cx="240" cy="240" r="12" fill="#0D1626" stroke="#C5CAD3" strokeWidth="2" />
        <circle cx="240" cy="240" r="3.5" fill="#E3D9C3" />
      </svg>
      <div className="nwhm-readout nwhm-readout--top">
        <span className="nwhm-readout-l nw-mono">Heading</span>
        <span className="nwhm-readout-v nwhm-readout-v--lg nw-mono">{label}</span>
      </div>
      <div className="nwhm-readout nwhm-readout--bottom">
        <span className="nwhm-readout-l nw-mono">Pretoria</span>
        <span className="nwhm-readout-v nw-mono">25°44′S · 28°11′E</span>
      </div>
    </div>
  );
}

/** The phone version: a small dial with the heading beside it. */
export function CompassBadge({ slide }: CompassProps) {
  const { degrees, label } = reading(slide);
  return (
    <div className="nwhm-badge" aria-hidden="true">
      <svg width="52" height="52" viewBox="0 0 480 480">
        <circle
          cx="240"
          cy="240"
          r="224"
          fill="none"
          stroke="rgba(255,255,255,0.22)"
          strokeWidth="12"
        />
        <circle
          cx="240"
          cy="240"
          r="196"
          fill="none"
          stroke="#C5CAD3"
          strokeOpacity="0.75"
          strokeWidth="28"
          strokeDasharray="4 98.63"
        />
        <g className="nwhm-needle" style={{ transform: `rotate(${degrees}deg)` }}>
          <polygon points="240,64 264,240 216,240" fill="#C5CAD3" />
          <polygon points="240,416 264,240 216,240" fill="rgba(255,255,255,0.3)" />
        </g>
        <circle cx="240" cy="240" r="24" fill="#0D1626" stroke="#C5CAD3" strokeWidth="10" />
      </svg>
      <span>
        <span className="nwhm-badge-l nw-mono">Heading {label}</span>
        <span className="nwhm-badge-v nw-mono">Pretoria · 25°44′S 28°11′E</span>
      </span>
    </div>
  );
}
