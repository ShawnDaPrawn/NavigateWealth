/**
 * Phone quick-actions bar: Call, WhatsApp and "Get a Free Quote", pinned to
 * the bottom of the screen on phones (≤760px) on public pages.
 *
 * Hidden where it would compete with the page's own primary action — the
 * quote flow and the sign-in screens. A spacer of the same height sits at the
 * end of the page so the bar never covers the footer's last lines.
 */
import { Link, useLocation } from 'react-router';
import { ArrowRight, MessageCircle, Phone } from 'lucide-react';
import { PHONE_DISPLAY, PHONE_HREF, WHATSAPP_HREF } from '../siteLinks';

const HIDDEN_ON = ['/get-quote', '/login', '/signup', '/forgot-password', '/reset-password'];

export function NavigatorMobileBar() {
  const { pathname } = useLocation();
  if (HIDDEN_ON.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return null;
  return (
    <>
      <div className="nwm-spacer" aria-hidden="true" />
      <nav className="nwm-bar" aria-label="Quick actions">
        <a
          className="nwm-ic"
          href={PHONE_HREF}
          aria-label={`Call Navigate Wealth on ${PHONE_DISPLAY}`}
        >
          <Phone size={18} strokeWidth={2} aria-hidden="true" />
          Call
        </a>
        <a
          className="nwm-ic nwm-wa"
          href={WHATSAPP_HREF}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Chat to Navigate Wealth on WhatsApp"
        >
          <MessageCircle size={18} strokeWidth={2} aria-hidden="true" />
          WhatsApp
        </a>
        <Link className="nwm-cta" to="/get-quote">
          Get a Free Quote
          <ArrowRight size={16} strokeWidth={2} aria-hidden="true" />
        </Link>
      </nav>
    </>
  );
}
