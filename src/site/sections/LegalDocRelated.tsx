/**
 * LegalDocRelated — under a legal document: the other documents filed in the
 * same section (from the shared registry) and the ways to ask about it.
 */
import { Link } from 'react-router';
import type { LegalDocumentRegistryEntry } from '../../shared/legal-documents-registry';
import { LegalIcon } from './LegalIcons';
import { LEGAL_CONTACT, legalDocumentHref } from './legalModel';

interface LegalDocRelatedProps {
  /** The section's name, when the document's section is known. */
  sectionLabel: string | null;
  documents: LegalDocumentRegistryEntry[];
}

export function LegalDocRelated({ sectionLabel, documents }: LegalDocRelatedProps) {
  return (
    <section className="nwld-related" aria-label="Related documents">
      <div className="nw-wrap">
        <div className="nwld-related-head">
          {sectionLabel ? (
            <div>
              <p className="nw-mono nw-kicker">Keep reading</p>
              <h2 className="nwld-related-h2">More in {sectionLabel}</h2>
            </div>
          ) : (
            <span />
          )}
          <Link className="nwld-back nwld-all" to="/legal">
            All legal documents <LegalIcon name="arrowRight" size={16} />
          </Link>
        </div>
        {sectionLabel && documents.length > 0 ? (
          <div className="nwld-related-grid">
            {documents.map((doc) => (
              <Link key={doc.slug} className="nwld-rel" to={legalDocumentHref(doc.slug)}>
                <span className="nw-h nwld-rel-title">{doc.name}</span>
                <span className="nwld-rel-desc">{doc.description}</span>
                <span className="nwld-rel-read" aria-hidden="true">
                  Read →
                </span>
              </Link>
            ))}
          </div>
        ) : null}
        <div className="nwld-help">
          <div className="nwld-help-copy">
            <span className="nwld-help-icon">
              <LegalIcon name="message" size={19} />
            </span>
            <span className="nwld-help-text">Questions about this policy?</span>
          </div>
          <div className="nwld-help-actions">
            <a
              className="nw-outline nwld-help-btn nwld-help-btn--email"
              href={LEGAL_CONTACT.emailHref}
            >
              Email us
            </a>
            <Link className="nw-btn nwld-help-btn nwld-help-btn--contact" to="/contact">
              Contact us
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
