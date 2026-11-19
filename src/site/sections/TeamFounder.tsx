/**
 * TeamFounder — "01 — The founder": the founder's profile and note beside the
 * "Working with …" card, then anyone published through the admin Team manager,
 * in the board's member cards. With no one published (the usual case), the
 * section ends after the founder, as the board's default state does.
 */
import { Link } from 'react-router';
import { ArrowRight, Linkedin, User } from 'lucide-react';
import { NwImage } from '../components/NwImage';
import { MailIcon, PhoneIcon } from './TeamIcons';
import '../styles/navigator.css';
import '../styles/sections.css';
import '../styles/team.css';

export interface TeamFact {
  label: string;
  value: string;
}

export interface TeamContact {
  email: string;
  phoneHref: string;
  phoneDisplay: string;
}

/** A person published through the admin Team manager. */
export interface TeamCardMember {
  id: string;
  name: string;
  title: string;
  credentials?: string;
  bio?: string;
  specialties?: unknown;
  image?: string;
  linkedinUrl?: string;
  email?: string;
}

interface TeamFounderProps {
  index: string;
  kicker: string;
  name: string;
  role: string;
  note: readonly string[];
  noteLink: { label: string; to: string };
  cardLabel: string;
  cardStatus: string;
  facts: readonly TeamFact[];
  contact: TeamContact;
  members: readonly TeamCardMember[];
  /** Used for a member with no address of their own. */
  fallbackEmail: string;
}

export function TeamFounder({
  index,
  kicker,
  name,
  role,
  note,
  noteLink,
  cardLabel,
  cardStatus,
  facts,
  contact,
  members,
  fallbackEmail,
}: TeamFounderProps) {
  return (
    <section className="nwtm-profile" aria-labelledby="nwtm-founder">
      <div className="nw-wrap nwtm-profile-grid">
        <div>
          <p className="nw-kicker nw-mono">
            {index} — {kicker}
          </p>
          <h2 id="nwtm-founder" className="nw-sec-title">
            {name}
          </h2>
          <p className="nwtm-role">{role}</p>
          <div className="nwtm-note">
            {note.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
          </div>
          <Link className="nw-btn nwtm-note-cta" to={noteLink.to}>
            {noteLink.label}
            <ArrowRight size={16} strokeWidth={1.75} aria-hidden="true" />
          </Link>
        </div>

        <aside className="nwtm-card" aria-label="Working with the founder">
          <div className="nwtm-card-head">
            <span className="nw-mono nwtm-card-label">{cardLabel}</span>
            <span className="nwtm-card-status">
              <span className="nwtm-dot" aria-hidden="true" />
              {cardStatus}
            </span>
          </div>
          <dl className="nwtm-dl">
            {facts.map((fact) => (
              <div key={fact.label}>
                <dt className="nw-mono">{fact.label}</dt>
                <dd>{fact.value}</dd>
              </div>
            ))}
          </dl>
          <div className="nwtm-contact">
            <a className="nwtm-icon-btn" href={`mailto:${contact.email}`}>
              <MailIcon size={16} />
              Email
            </a>
            <a className="nwtm-icon-btn" href={contact.phoneHref}>
              <PhoneIcon size={16} />
              {contact.phoneDisplay}
            </a>
          </div>
        </aside>
      </div>

      {members.length > 0 ? (
        <div className="nw-wrap nwtm-members">
          <h2 className="nw-mono nwtm-members-label">Team members</h2>
          <ul className="nwtm-members-grid">
            {members.map((member) => (
              <li key={member.id}>
                <MemberCard member={member} fallbackEmail={fallbackEmail} />
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}

function MemberCard({ member, fallbackEmail }: { member: TeamCardMember; fallbackEmail: string }) {
  const specialties = Array.isArray(member.specialties)
    ? member.specialties.filter((s): s is string => typeof s === 'string' && s.trim() !== '')
    : [];
  const email = member.email || fallbackEmail;
  return (
    <article className="nwtm-tile">
      <div className={member.image ? 'nwtm-avatar nwtm-avatar--photo' : 'nwtm-avatar'}>
        {member.image ? (
          <NwImage src={member.image} alt={member.name} width={200} height={200} />
        ) : (
          <User size={32} strokeWidth={1.75} aria-hidden="true" />
        )}
      </div>
      <h3 className="nw-h nwtm-member-name">{member.name}</h3>
      <p className="nwtm-member-title">{member.title}</p>
      {member.credentials ? <p className="nwtm-member-cred">{member.credentials}</p> : null}
      {member.bio ? <p className="nwtm-member-bio">{member.bio}</p> : null}
      {specialties.length > 0 ? (
        <ul className="nwtm-chips" aria-label="Specialties">
          {specialties.map((specialty, i) => (
            <li key={`${i}-${specialty}`}>{specialty}</li>
          ))}
        </ul>
      ) : null}
      <div className="nwtm-member-links">
        {member.linkedinUrl ? (
          <a
            className="nwtm-icon-btn nwtm-icon-btn--sq"
            href={member.linkedinUrl}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`${member.name} on LinkedIn (opens in a new tab)`}
          >
            <Linkedin size={17} strokeWidth={1.75} aria-hidden="true" />
          </a>
        ) : null}
        <a
          className="nwtm-icon-btn nwtm-icon-btn--sq"
          href={`mailto:${email}`}
          aria-label={`Email ${member.name}`}
        >
          <MailIcon size={17} />
        </a>
      </div>
    </article>
  );
}
