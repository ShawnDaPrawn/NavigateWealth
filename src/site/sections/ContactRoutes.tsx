/**
 * ContactRoutes — "Other ways to reach us": a row of the site's other ways
 * in (a consultation, a quote, WhatsApp, Ask Vasco) under the contact hero.
 */
import { Link } from 'react-router';
import { ContactIcon, type ContactIconName } from './ContactIcons';
import '../styles/contact.css';

export interface ContactRoute {
  title: string;
  text: string;
  icon: ContactIconName;
  /** The icon tile's colour: the board's ink, info blue or success green. */
  tone: 'ink' | 'info' | 'success';
  /** An internal route, or an external address opened in a new tab. */
  to: string;
  external?: boolean;
}

export function ContactRoutes({ routes }: { routes: readonly ContactRoute[] }) {
  return (
    <section className="nwct-routes" aria-label="Other ways to reach us">
      <div className="nw-wrap">
        <ul className="nwct-routes-list">
          {routes.map((route) => {
            const body = (
              <>
                <span
                  className={`nwct-route-icon nwct-route-icon--${route.tone}`}
                  aria-hidden="true"
                >
                  <ContactIcon name={route.icon} size={20} />
                </span>
                <span>
                  <span className="nwct-route-t">{route.title}</span>
                  <span className="nwct-route-d">{route.text}</span>
                </span>
              </>
            );
            return (
              <li key={route.title}>
                {route.external ? (
                  <a
                    className="nwct-route"
                    href={route.to}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {body}
                  </a>
                ) : (
                  <Link className="nwct-route" to={route.to}>
                    {body}
                  </Link>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
