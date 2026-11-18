import type { ReactNode } from 'react';
import '../styles/sections.css';

interface SectionHeadProps {
  /** Two-digit position on the page, e.g. "01". Omit for an unnumbered label. */
  index?: string;
  kicker: string;
  title: ReactNode;
  lead?: string;
  center?: boolean;
  dark?: boolean;
  titleId?: string;
  className?: string;
}

/** The label, heading and lead every Navigator section opens with. */
export function SectionHead({
  index,
  kicker,
  title,
  lead,
  center,
  dark,
  titleId,
  className,
}: SectionHeadProps) {
  const classes = ['nw-sec-head', center ? 'nw-sec-head--center' : '', className ?? '']
    .filter(Boolean)
    .join(' ');
  return (
    <div className={classes}>
      <p className={dark ? 'nw-kicker nw-kicker--dark nw-mono' : 'nw-kicker nw-mono'}>
        {index ? `${index} — ${kicker}` : kicker}
      </p>
      <h2 id={titleId} className="nw-sec-title">
        {title}
      </h2>
      {lead ? <p className="nw-sec-lead">{lead}</p> : null}
    </div>
  );
}
