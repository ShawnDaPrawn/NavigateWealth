/**
 * VascoHelp — under the chat: the way to a person (a call-back request and
 * sign-up for personalised guidance) and the page's full disclaimer.
 */
import type { MouseEvent } from 'react';
import { Link } from 'react-router';
import { VascoIcon } from './VascoIcons';
import '../styles/ask-vasco.css';

interface VascoHelpProps {
  title: string;
  text: string;
  action: string;
  onAction: (event: MouseEvent<HTMLButtonElement>) => void;
  linkLabel: string;
  linkTo: string;
  disclaimer: string;
}

export function VascoHelp({
  title,
  text,
  action,
  onAction,
  linkLabel,
  linkTo,
  disclaimer,
}: VascoHelpProps) {
  return (
    <div className="nwav-after">
      <div className="nwav-help">
        <div className="nwav-help-copy">
          <p className="nwav-help-title">{title}</p>
          <p className="nwav-help-text">{text}</p>
        </div>
        <div className="nwav-help-ctas">
          <button
            type="button"
            className="nw-outline nwav-help-btn"
            aria-haspopup="dialog"
            onClick={onAction}
          >
            <VascoIcon name="phone" size={15} />
            {action}
          </button>
          <Link className="nwav-link" to={linkTo}>
            {linkLabel} <VascoIcon name="arrowRight" size={15} />
          </Link>
        </div>
      </div>
      <p className="nwav-disc">
        <strong>Disclaimer:</strong> {disclaimer}
      </p>
    </div>
  );
}
