/**
 * Public site footer for the Navigator design.
 *
 * It keeps everything the legacy footer offers: the newsletter sign-up (same
 * endpoint, same responses), the address and contact details from
 * companyFacts.ts, the same company / service / resource / legal links with the
 * same section deep links, the social profiles, and the Important Disclosure
 * word for word — that text is a compliance statement, not copy to edit.
 */
import { useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { toast } from 'sonner';
import { ArrowRight, Instagram, Linkedin, Mail, MapPin, Phone } from 'lucide-react';
import wealthFooterLogo from 'figma:asset/8dc2892f50ecc4c5f692fd5ad52639699e2e4656.png';
import { COMPANY } from '../../config/companyFacts';
import { XIcon, NAVIGATE_WEALTH_X_URL } from '../../components/shared/XIcon';
import { api } from '../../utils/api/client';
import { FOOTER_LINKS, PHONE_DISPLAY, PHONE_HREF, type FooterLink } from '../siteLinks';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function NewsletterForm() {
  const [email, setEmail] = useState('');
  // Hidden from people; bots that fill every field fill this one too.
  const [trap, setTrap] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (trap) {
      // Pretend it worked: telling a bot it was caught only teaches it.
      setEmail('');
      return;
    }
    if (!email) {
      toast.error('Please enter your email address');
      return;
    }
    if (!EMAIL_PATTERN.test(email)) {
      toast.error('Please enter a valid email address');
      return;
    }
    setBusy(true);
    try {
      const data = await api.post<{ alreadySubscribed?: boolean; requiresConfirmation?: boolean }>(
        '/newsletter/subscribe',
        { email },
        { retryTransientFailures: false },
      );
      if (data.alreadySubscribed) {
        toast.info('Already subscribed', {
          description: "You're already on our mailing list. We'll keep sending you great content!",
        });
      } else if (data.requiresConfirmation) {
        toast.success('Check your email!', {
          description:
            "We've sent you a confirmation link. Please click it to complete your subscription.",
          duration: 6000,
        });
      } else {
        toast.success('Successfully subscribed!', {
          description: 'Thank you for subscribing to our newsletter.',
        });
      }
      setEmail('');
    } catch (error) {
      toast.error('Subscription failed', {
        description:
          error instanceof Error ? error.message : 'Something went wrong. Please try again.',
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="nwf-form" onSubmit={submit} noValidate>
      <label htmlFor="nwf-email" className="nw-sr-only">
        Email address
      </label>
      <input
        id="nwf-email"
        className="nwf-input"
        type="email"
        name="email"
        autoComplete="email"
        placeholder="Enter your email"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        disabled={busy}
      />
      <div className="nwf-trap" aria-hidden="true">
        <label htmlFor="nwf-website">Website</label>
        <input
          id="nwf-website"
          type="text"
          name="website"
          tabIndex={-1}
          autoComplete="off"
          value={trap}
          onChange={(event) => setTrap(event.target.value)}
        />
      </div>
      <button type="submit" className="nw-btn" disabled={busy}>
        {busy ? 'Subscribing…' : 'Subscribe'}
        <ArrowRight size={16} strokeWidth={1.75} aria-hidden="true" />
      </button>
    </form>
  );
}

function LinkColumn({
  title,
  links,
  className,
}: {
  title: string;
  links: FooterLink[];
  className: string;
}) {
  return (
    <nav className={`nwf-col ${className}`} aria-label={title}>
      <h2 className="nwf-h">{title}</h2>
      <ul>
        {links.map((link) => (
          <li key={link.path}>
            <Link className="nwf-link" to={link.path}>
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

export function NavigatorFooter() {
  const year = new Date().getFullYear();
  const { address } = COMPANY;
  const addressLine = `${address.street}, ${address.park}, ${address.city}, ${address.postalCode}`;

  return (
    <footer className="nwf">
      <div className="nwf-inner">
        <div className="nwf-news">
          <div className="nwf-news-copy">
            <h2 className="nwf-news-h">Stay Connected</h2>
            <p className="nwf-news-p">
              Get the latest market insights and financial tips delivered to your inbox.
            </p>
          </div>
          <NewsletterForm />
        </div>

        <div className="nwf-main">
          <div className="nwf-brand">
            <img
              src={wealthFooterLogo}
              alt="Navigate Wealth"
              height={28}
              style={{ height: 28, width: 'auto', alignSelf: 'flex-start' }}
            />
            <address className="nwf-address">
              <ul className="nwf-contacts">
                <li>
                  <MapPin size={16} strokeWidth={1.75} aria-hidden="true" />
                  <span>{addressLine}</span>
                </li>
                <li>
                  <Phone size={16} strokeWidth={1.75} aria-hidden="true" />
                  <a className="nwf-contact" href={PHONE_HREF}>
                    {PHONE_DISPLAY}
                  </a>
                </li>
                <li>
                  <Mail size={16} strokeWidth={1.75} aria-hidden="true" />
                  <a className="nwf-contact" href={`mailto:${COMPANY.email}`}>
                    {COMPANY.email}
                  </a>
                </li>
              </ul>
            </address>
          </div>
          <LinkColumn title="Company" links={FOOTER_LINKS.company} className="nwf-company" />
          <nav className="nwf-col nwf-services" aria-label="Services">
            <h2 className="nwf-h">Services</h2>
            <div className="nwf-svc">
              <ul>
                {FOOTER_LINKS.services.slice(0, 4).map((link) => (
                  <li key={link.path}>
                    <Link className="nwf-link" to={link.path}>
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
              <ul>
                {FOOTER_LINKS.services.slice(4).map((link) => (
                  <li key={link.path}>
                    <Link className="nwf-link" to={link.path}>
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </nav>
          <LinkColumn title="Resources" links={FOOTER_LINKS.resources} className="nwf-resources" />
        </div>

        <div className="nwf-bottom">
          <p className="nwf-copy">© {year} Navigate Wealth. All rights reserved.</p>
          <nav className="nwf-legal" aria-label="Legal">
            {FOOTER_LINKS.legal.map((link) => (
              <Link key={link.path} className="nwf-link" to={link.path}>
                {link.label}
              </Link>
            ))}
          </nav>
          <div className="nwf-socials">
            <a
              className="nwf-social"
              href="https://www.linkedin.com/company/navigatewealth/"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Navigate Wealth on LinkedIn"
            >
              <Linkedin size={18} strokeWidth={1.75} aria-hidden="true" />
            </a>
            <a
              className="nwf-social"
              href="https://www.instagram.com/navigate_wealth?igsh=MTh6bTc2emszbXU0MA=="
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Navigate Wealth on Instagram"
            >
              <Instagram size={18} strokeWidth={1.75} aria-hidden="true" />
            </a>
            <a
              className="nwf-social"
              href={NAVIGATE_WEALTH_X_URL}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Navigate Wealth on X"
            >
              <XIcon className="h-4 w-4" />
            </a>
          </div>
        </div>

        <p className="nwf-disc">
          <strong>Important Disclosure:</strong> Wealthfront (Pty) Ltd (Reg No. 2024/071953/07),
          trading as &quot;Navigate Wealth,&quot; is a South African financial advisory firm and an
          authorised Financial Services Provider (FSP No. 54606). The information on this website is
          for general informational purposes only and does not constitute financial, investment,
          tax, legal, or other professional advice. While we strive to ensure that the information
          is accurate and up to date, we make no warranties of any kind regarding its completeness
          or reliability. Any reliance you place on such information is strictly at your own risk.
          Past performance is not necessarily indicative of future results. Before making any
          financial decision, you should consider your personal circumstances and, where
          appropriate, seek professional advice. Navigate Wealth will not be liable for any losses
          or damages arising from the use of this website or any reliance on the information
          provided herein. For tailored advice, please contact us directly. Full terms and
          conditions are available on our Legal page.
        </p>
      </div>
    </footer>
  );
}
