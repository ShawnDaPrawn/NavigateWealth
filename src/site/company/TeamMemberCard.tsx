/**
 * A team member added through the admin Team manager. Everything on the card
 * comes from that record; the LinkedIn and email actions appear only when the
 * record has them (the live page showed inert buttons otherwise).
 */
import { Linkedin, Mail } from 'lucide-react';
import { NwImage } from '../components/NwImage';
import type { TeamMember } from './teamContent';
import '../styles/company.css';

interface TeamMemberCardProps {
  member: TeamMember;
  priority?: boolean;
}

export function TeamMemberCard({ member, priority }: TeamMemberCardProps) {
  const specialties = Array.isArray(member.specialties) ? member.specialties : [];
  return (
    <li className="nwco-member">
      <div className="nwco-member-photo">
        {member.image ? (
          <NwImage
            src={member.image}
            alt={member.name}
            width={200}
            height={200}
            sizes="96px"
            priority={priority}
          />
        ) : null}
      </div>
      <h3 className="nwco-member-name">{member.name}</h3>
      <p className="nwco-member-title">{member.title}</p>
      {member.credentials ? <p className="nwco-member-cred">{member.credentials}</p> : null}
      {member.bio ? <p className="nwco-member-bio">{member.bio}</p> : null}
      {specialties.length > 0 ? (
        <>
          <h4 className="nw-sr-only">Specialties</h4>
          <ul className="nwco-member-tags">
            {specialties.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        </>
      ) : null}
      {member.linkedinUrl || member.email ? (
        <div className="nwco-member-links">
          {member.linkedinUrl ? (
            <a
              className="nw-outline nw-btn--sm"
              href={member.linkedinUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`${member.name} on LinkedIn`}
            >
              <Linkedin size={17} strokeWidth={1.75} aria-hidden="true" />
            </a>
          ) : null}
          {member.email ? (
            <a
              className="nw-outline nw-btn--sm"
              href={`mailto:${member.email}`}
              aria-label={`Email ${member.name}`}
            >
              <Mail size={17} strokeWidth={1.75} aria-hidden="true" />
            </a>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}
