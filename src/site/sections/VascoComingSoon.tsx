/**
 * VascoComingSoon — what the page shows while Vasco is switched off: the live
 * page's message and its two ways onward, in the card the chat would occupy.
 */
import { Link } from 'react-router';
import { VascoIcon } from './VascoIcons';
import '../styles/sections.css';
import '../styles/ask-vasco.css';

interface VascoComingSoonProps {
  title: string;
  accent: string;
  text: string;
  actions: readonly { label: string; to: string; primary?: boolean }[];
}

export function VascoComingSoon({ title, accent, text, actions }: VascoComingSoonProps) {
  return (
    <div className="nwav-soon">
      <span className="nwav-soon-mark" aria-hidden="true">
        <VascoIcon name="compass" size={26} stroke="#0D1626" />
      </span>
      <h2 className="nwav-soon-title">
        {title} <span className="nwav-accent-l">{accent}</span>
      </h2>
      <p className="nwav-soon-text">{text}</p>
      <div className="nwav-soon-ctas">
        {actions.map((action) => (
          <Link key={action.to} className={action.primary ? 'nw-btn' : 'nw-outline'} to={action.to}>
            {action.label}
          </Link>
        ))}
      </div>
    </div>
  );
}
