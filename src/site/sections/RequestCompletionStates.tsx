/**
 * The request page's states around the form, as the "Request Completion"
 * board draws them: the loading card, the card for a request that could not be
 * loaded, the thank-you card, and the toast for a submission that failed.
 * The words are the live page's.
 */
import siteLogo from 'figma:asset/def9c4d4fdd055d486a64e8df869988fd6a2aca3.png';
import { COMPANY } from '../../config/companyFacts';
import { RequestCompletionIcon } from './RequestCompletionIcons';

/** The live page's telephone number, as it prints it on the request. */
export const REQUEST_PHONE = '(+27) 12-667-2505';

export function RequestCompletionLoading() {
  return (
    <div className="nwrc-skel" role="status" aria-label="Loading request">
      <div className="nwrc-skel-row">
        <span className="nwrc-sk nwrc-sk--logo" />
        <span className="nwrc-sk nwrc-sk--contact" />
      </div>
      <span className="nwrc-sk nwrc-sk--title" />
      <span className="nwrc-sk nwrc-sk--meta" />
      <div className="nwrc-skel-fields">
        <span className="nwrc-sk nwrc-sk--field" />
        <span className="nwrc-sk nwrc-sk--field" />
        <span className="nwrc-sk nwrc-sk--area" />
      </div>
    </div>
  );
}

export function RequestCompletionError({ message }: { message: string }) {
  return (
    <div className="nwrc-card nw-in" role="alert">
      <img className="nwrc-card-logo" src={siteLogo} alt={COMPANY.tradingName} />
      <span className="nwrc-card-badge nwrc-card-badge--danger">
        <RequestCompletionIcon name="fileX" size={26} />
      </span>
      <h1 className="nwrc-card-title nwrc-card-title--danger">Error</h1>
      <p className="nwrc-card-text">{message}</p>
      <p className="nwrc-card-help">
        Need help? <a href={`mailto:${COMPANY.email}`}>{COMPANY.email}</a>
      </p>
    </div>
  );
}

export function RequestCompletionSubmitted() {
  return (
    <div className="nwrc-card nw-in">
      <span className="nwrc-card-badge nwrc-card-badge--success">
        <RequestCompletionIcon name="checkCircle" size={32} />
      </span>
      <h1 className="nwrc-card-title nwrc-card-title--done">Thank You!</h1>
      <p className="nwrc-card-lead">Your response has been successfully submitted.</p>
      <p className="nwrc-card-text nwrc-card-text--next">
        We have been notified and will review your information shortly.
      </p>
      <div className="nwrc-card-contact">
        <span>{REQUEST_PHONE}</span>
        <span>{COMPANY.email}</span>
      </div>
    </div>
  );
}

/** The board's toast, carrying the live page's failure message. */
export function RequestCompletionToast({ message }: { message: string }) {
  return (
    <div className="nwrc-toast" role="alert">
      <RequestCompletionIcon
        name="alertCircle"
        size={18}
        stroke="#FECACA"
        className="nwrc-toast-icon"
      />
      <span>{message}</span>
    </div>
  );
}
