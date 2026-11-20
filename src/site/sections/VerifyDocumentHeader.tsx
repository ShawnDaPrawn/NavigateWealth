/**
 * The document verification page's own small header, as the "Verify
 * Document" board draws it: the logo beside a "Document Verification" label,
 * and "Back to site". The route renders outside MainLayout (no site header or
 * footer), as the live page does.
 */
import { Link } from 'react-router';
import siteLogo from 'figma:asset/def9c4d4fdd055d486a64e8df869988fd6a2aca3.png';
import { COMPANY } from '../../config/companyFacts';
import { VerifyDocumentIcon } from './VerifyDocumentIcons';

export function VerifyDocumentHeader() {
  return (
    <header className="nwvd-head">
      <div className="nwvd-head-row">
        <Link to="/" className="nwvd-home" aria-label={`${COMPANY.tradingName} home`}>
          <img className="nwvd-logo" src={siteLogo} alt="" />
          <span className="nwvd-label nw-mono">Document Verification</span>
        </Link>
        <Link to="/" className="nwvd-back">
          <VerifyDocumentIcon name="arrowLeft" size={16} />
          Back to site
        </Link>
      </div>
    </header>
  );
}
