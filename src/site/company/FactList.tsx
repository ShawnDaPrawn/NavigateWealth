/**
 * A term / value list for checkable facts — the "On the register" card on the
 * About page, "Working with Shawn" on the Team page, "Company Information" on
 * the Press page. Values come from companyFacts.ts at the call site.
 */
import type { ReactNode } from 'react';
import '../styles/company.css';

export interface Fact {
  term: string;
  value: ReactNode;
  /** Set in tabular figures (registration and FSP numbers). */
  mono?: boolean;
  /** Picked out in the cream accent on dark cards. */
  accent?: boolean;
}

interface FactListProps {
  facts: Fact[];
  tone: 'dark' | 'light' | 'plain';
}

export function FactList({ facts, tone }: FactListProps) {
  return (
    <dl className={`nwco-facts nwco-facts--${tone}`}>
      {facts.map((f) => (
        <div key={f.term}>
          <dt>{f.term}</dt>
          <dd
            className={
              [f.mono ? 'nw-mono nwco-fact-mono' : '', f.accent ? 'nwco-fact-accent' : '']
                .filter(Boolean)
                .join(' ') || undefined
            }
          >
            {f.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}
