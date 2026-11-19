/**
 * BookingSummary — the rail beside the booking: the choices so far, what
 * happens once the request is in, and the phone and WhatsApp for anyone who
 * would rather talk now. Sticks beside the booking on wide screens.
 */
import { BookingIcon } from './BookingIcons';

interface BookingSummaryProps {
  meeting: string;
  /** The chosen day and time, or null while not chosen. */
  date: string | null;
  time: string | null;
  steps: readonly string[];
  phoneHref: string;
  whatsappHref: string;
}

const NOT_YET = 'Not selected yet';

export function BookingSummary({
  meeting,
  date,
  time,
  steps,
  phoneHref,
  whatsappHref,
}: BookingSummaryProps) {
  return (
    <aside className="nwbk-rail" aria-label="Your booking">
      <div className="nwbk-sum">
        <div className="nw-grid-bg" aria-hidden="true" />
        <div className="nwbk-sum-head">
          <span className="nw-mono nwbk-sum-label">Your booking</span>
        </div>
        <dl className="nwbk-sum-list">
          <div className="nwbk-sum-row">
            <dt>Meeting</dt>
            <dd>{meeting}</dd>
          </div>
          <div className="nwbk-sum-row">
            <dt>Date</dt>
            <dd className={date ? undefined : 'nwbk-sum-empty'}>{date ?? NOT_YET}</dd>
          </div>
          <div className="nwbk-sum-row">
            <dt>Time</dt>
            <dd className={time ? undefined : 'nwbk-sum-empty'}>{time ?? NOT_YET}</dd>
          </div>
        </dl>
        <div className="nwbk-sum-foot">
          <BookingIcon name="shield" size={15} />
          Free, no-obligation consultation
        </div>
      </div>

      <div className="nwbk-panel">
        <h3 className="nwbk-panel-title">What happens next</h3>
        <ol className="nwbk-after">
          {steps.map((text, i) => (
            <li key={text}>
              <span
                className={
                  i === 0 ? 'nw-mono nwbk-after-no nwbk-after-no--on' : 'nw-mono nwbk-after-no'
                }
                aria-hidden="true"
              >
                {String(i + 1).padStart(2, '0')}
              </span>
              <span className="nwbk-after-text">{text}</span>
            </li>
          ))}
        </ol>
      </div>

      <div className="nwbk-panel">
        <h3 className="nwbk-panel-title">Prefer to talk now?</h3>
        <div className="nwbk-quick-row">
          <a className="nwbk-quick" href={phoneHref}>
            <BookingIcon name="phone" size={16} stroke="#0D1626" />
            Call
          </a>
          <a className="nwbk-quick" href={whatsappHref} target="_blank" rel="noopener noreferrer">
            <BookingIcon name="message" size={16} stroke="#15803D" />
            WhatsApp
          </a>
        </div>
      </div>
    </aside>
  );
}
