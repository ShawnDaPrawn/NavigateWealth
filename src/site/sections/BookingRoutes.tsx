/**
 * BookingRoutes — "Other ways to reach us", for visitors who would rather not
 * book online: the firm's phone and mailbox, the full contact form (with the
 * campaign parameters still on the link) and a way back up to the booking.
 */
import { Link } from 'react-router';
import { BookingIcon } from './BookingIcons';

interface BookingRoutesProps {
  phone: { display: string; href: string };
  email: string;
  /** The contact page, carrying this page's query string (UTMs). */
  contactHref: string;
  /** The in-page anchor of the booking section. */
  bookingHref: string;
}

export function BookingRoutes({ phone, email, contactHref, bookingHref }: BookingRoutesProps) {
  return (
    <section className="nwbk-routes" aria-labelledby="nwbk-other-ways">
      <div className="nw-wrap">
        <div className="nwbk-routes-card">
          <div className="nwbk-routes-head">
            <div className="nw-mono nwbk-kicker">
              <span aria-hidden="true" className="nwbk-kicker-rule" />
              <span>Alternate routes</span>
            </div>
            <h2 id="nwbk-other-ways" className="nwbk-routes-title">
              Other ways to reach us
            </h2>
            <p className="nwbk-routes-lead">
              Prefer not to book online? Call or email us directly, or send a message from the full
              contact page.
            </p>
          </div>
          <div className="nwbk-routes-body">
            <ul className="nwbk-routes-list">
              <li className="nwbk-route">
                <span className="nwbk-route-icon" aria-hidden="true">
                  <BookingIcon name="phone" size={20} />
                </span>
                <div>
                  <p className="nwbk-route-label">Phone</p>
                  <a className="nwbk-route-link" href={phone.href}>
                    {phone.display}
                  </a>
                </div>
              </li>
              <li className="nwbk-route">
                <span className="nwbk-route-icon" aria-hidden="true">
                  <BookingIcon name="mail" size={20} />
                </span>
                <div className="nwbk-route-text">
                  <p className="nwbk-route-label">Email</p>
                  <a className="nwbk-route-link nwbk-route-link--wrap" href={`mailto:${email}`}>
                    {email}
                  </a>
                </div>
              </li>
            </ul>
            <div className="nwbk-routes-actions">
              <Link className="nw-btn nwbk-route-btn" to={contactHref}>
                Open full contact form
              </Link>
              <a className="nw-outline nwbk-route-btn" href={bookingHref}>
                <BookingIcon name="calendar" size={16} />
                Continue scheduling online
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
