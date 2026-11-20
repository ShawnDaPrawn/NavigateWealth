/**
 * The request itself, as the "Request Completion" board draws it: a document
 * with the firm's letterhead, the request's title, who it is for and today's
 * date, a count of the required answers given, the form, and a footer with
 * "Submit Response" and the live page's notes.
 */
import type { ReactNode } from 'react';
import siteLogo from 'figma:asset/def9c4d4fdd055d486a64e8df869988fd6a2aca3.png';
import { COMPANY } from '../../config/companyFacts';
import { RequestCompletionIcon } from './RequestCompletionIcons';
import { REQUEST_PHONE } from './RequestCompletionStates';

interface DocumentProps {
  title: string;
  recipientEmail: string;
  /** Required answers given, and required answers in all. */
  done: number;
  required: number;
  /** The live page's message naming the required fields left empty, once the form was sent. */
  alert: string | null;
  submitting: boolean;
  onSubmit: () => void;
  children: ReactNode;
}

export function RequestCompletionDocument({
  title,
  recipientEmail,
  done,
  required,
  alert,
  submitting,
  onSubmit,
  children,
}: DocumentProps) {
  const today = new Date().toLocaleDateString('en-ZA', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  const progress = required > 0 ? Math.round((done / required) * 100) : 0;

  return (
    <article className="nwrc-doc">
      <header className="nwrc-doc-head">
        <img className="nwrc-doc-logo" src={siteLogo} alt={COMPANY.tradingName} />
        <div className="nwrc-doc-contact">
          <span>
            <RequestCompletionIcon name="mapPin" size={12} stroke="#0D1626" />
            {COMPANY.headquarters}
          </span>
          <span>
            <RequestCompletionIcon name="phone" size={12} stroke="#0D1626" />
            {REQUEST_PHONE}
          </span>
          <span>
            <RequestCompletionIcon name="mail" size={12} stroke="#0D1626" />
            {COMPANY.email}
          </span>
        </div>
      </header>

      <div className="nwrc-intro">
        <h1 className="nwrc-title">{title}</h1>
        <p className="nwrc-for">
          Requested for: <span className="nwrc-for-email">{recipientEmail}</span>
        </p>
        <p className="nwrc-date nw-mono">
          <RequestCompletionIcon name="calendar" size={12} />
          Document Date:<span>{today}</span>
        </p>
        {required > 0 ? (
          <div className="nwrc-progress">
            <div className="nwrc-track" aria-hidden="true">
              <div className="nwrc-bar" style={{ width: `${progress}%` }} />
            </div>
            <span className="nwrc-count nw-mono">
              {done}/{required} required
            </span>
          </div>
        ) : null}
      </div>

      {alert ? (
        <div className="nwrc-alert" role="alert">
          <RequestCompletionIcon name="alertCircle" size={17} className="nwrc-alert-icon" />
          <span>{alert}</span>
        </div>
      ) : null}

      <form
        className="nwrc-form"
        noValidate
        aria-label={title}
        onSubmit={(e) => {
          // The live page has no form to submit: Enter in a field sends nothing.
          e.preventDefault();
        }}
      >
        {children}
      </form>

      <footer className="nwrc-foot">
        <button
          type="button"
          className="nw-btn nwrc-submit"
          aria-disabled={submitting ? true : undefined}
          onClick={onSubmit}
        >
          {submitting ? <span className="nwrc-spin" aria-hidden="true" /> : null}
          Submit Response
        </button>
        <div className="nwrc-info">
          <p className="nwrc-info-title">Important Information:</p>
          <ul className="nwrc-info-list">
            <li>Please complete all required fields marked with an asterisk (*)</li>
            <li>All information provided will be treated as confidential</li>
            <li>For assistance, please contact us at {COMPANY.email}</li>
          </ul>
          <p className="nwrc-info-note">
            This document is for information purposes only and does not constitute financial advice.
          </p>
          <p className="nwrc-info-fsp">
            {COMPANY.legalName} t/a {COMPANY.tradingName} | Authorised FSP {COMPANY.fspNumber}
          </p>
        </div>
      </footer>
    </article>
  );
}
