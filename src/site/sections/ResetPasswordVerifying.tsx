/**
 * ResetPasswordVerifying — what the card shows while the page checks the reset
 * link. The live page's words; the board's sweeping compass. The line of text
 * is the page's H1 while it shows (styled as the board's paragraph), so the
 * page always has exactly one.
 */
import '../styles/reset-password.css';

export function ResetPasswordVerifying() {
  return (
    <div className="nwrp-verify" role="status" aria-label="Verifying reset link">
      <svg width="88" height="88" viewBox="0 0 88 88" aria-hidden="true" focusable="false">
        <circle cx="44" cy="44" r="40" fill="none" stroke="#EFEBE3" strokeWidth="1.5" />
        <circle
          cx="44"
          cy="44"
          r="40"
          fill="none"
          stroke="#D3CCBF"
          strokeWidth="6"
          strokeDasharray="1 9.47"
        />
        <g className="nwrp-sweep">
          <path d="M44 44 L44 6 A38 38 0 0 1 71 17 Z" fill="#0D1626" fillOpacity="0.18" />
          <line x1="44" y1="44" x2="44" y2="8" stroke="#0D1626" strokeWidth="1.5" />
        </g>
        <circle cx="44" cy="44" r="4" fill="#0D1626" />
      </svg>
      <h1 className="nwrp-verify-text">Verifying reset link...</h1>
    </div>
  );
}
