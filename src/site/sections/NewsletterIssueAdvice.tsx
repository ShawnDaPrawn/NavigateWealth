/**
 * NewsletterIssueAdvice — the closing band: from reading the issue to talking
 * to an adviser, by booking a consultation or asking Vasco.
 */
import { Link } from 'react-router';

export function NewsletterIssueAdvice() {
  return (
    <div className="nwni-advice">
      <p className="nwni-advice-p">
        <span className="nw-h nwni-advice-h">Want personalised advice?</span> Talk to a qualified
        adviser about how this issue applies to your household.
      </p>
      <div className="nwni-advice-actions">
        <Link className="nw-btn nwni-btn" to="/schedule-consultation">
          Book a Free Consultation
        </Link>
        <Link className="nw-outline nwni-btn" to="/ask-vasco">
          Ask Vasco
        </Link>
      </div>
    </div>
  );
}
