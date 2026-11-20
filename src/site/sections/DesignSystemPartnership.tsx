/**
 * The Design System page's closing band, "Build the future of fintech
 * together", as the "Design system" board draws it. The email and phone
 * number are the firm's own (companyFacts.ts); the figures are counted from
 * the page's catalogues.
 */
import { Link } from 'react-router';
import { COMPANY } from '../../config/companyFacts';
import { DsIcon, type DsIconName } from './DesignSystemIcons';
import { COLOUR_TOKEN_COUNT, DS_COMPONENTS, DS_SECTIONS } from './designSystemModel';

/** The number as the live site's footer prints it. */
const PHONE_DISPLAY = '(+27) 12-667-2505';

const CARDS: readonly { icon: DsIconName; title: string; text: string }[] = [
  {
    icon: 'code',
    title: 'Complete Design System',
    text: 'Our UI library, components and patterns, built for wealth management platforms.',
  },
  {
    icon: 'shield',
    title: 'Regulatory Expertise',
    text: 'A working understanding of financial services regulation and compliance requirements.',
  },
  {
    icon: 'briefcase',
    title: 'Industry Experience',
    text: 'Experience building solutions for independent financial advisers and wealth managers.',
  },
];

export function DesignSystemPartnership() {
  const stats = [
    { value: DS_COMPONENTS.length, label: 'UI components' },
    { value: DS_SECTIONS.length, label: 'Section templates' },
    { value: COLOUR_TOKEN_COUNT, label: 'Colour tokens' },
  ];

  return (
    <section className="nwds-partner" aria-labelledby="nwds-partner-title">
      <div className="nw-wrap">
        <div className="nwds-partner-head">
          <p className="nw-eyebrow">Partnership opportunity</p>
          <h2 id="nwds-partner-title" className="nw-h nwds-partner-title">
            Build the future of <span className="nwds-accent-l">fintech</span> together
          </h2>
          <p className="nwds-partner-lead">
            Partner with Navigate Wealth to develop fintech products for the independent financial
            advisory space.
          </p>
        </div>
        <div className="nwds-partner-cards">
          {CARDS.map((card) => (
            <div key={card.title}>
              <span className="nwds-ovc-ic">
                <DsIcon name={card.icon} size={20} />
              </span>
              <h3 className="nwds-feat-t">{card.title}</h3>
              <p className="nwds-feat-d">{card.text}</p>
            </div>
          ))}
        </div>
        <div className="nwds-partner-cta">
          <div className="nwds-partner-copy">
            <h3 className="nw-h nwds-partner-t">Ready to partner?</h3>
            <p className="nwds-partner-d">
              Whether you&apos;re building a new fintech product, enhancing an existing platform or
              exploring the IFA space, we&apos;d like to talk.
            </p>
            <dl className="nwds-pstats">
              {stats.map((s) => (
                <div key={s.label}>
                  <dt>{s.value}</dt>
                  <dd>{s.label}</dd>
                </div>
              ))}
            </dl>
          </div>
          <div className="nwds-partner-side">
            <div className="nwds-contact">
              <span className="nwds-ci">
                <DsIcon name="mail" size={18} />
              </span>
              <span>
                Email us at<a href={`mailto:${COMPANY.email}`}>{COMPANY.email}</a>
              </span>
            </div>
            <div className="nwds-contact">
              <span className="nwds-ci">
                <DsIcon name="phone" size={18} />
              </span>
              <span>
                Call us at<a href={COMPANY.phone.tel}>{PHONE_DISPLAY}</a>
              </span>
            </div>
            <Link className="nw-btn nwds-b nwds-b48" to="/contact">
              Discuss a partnership <DsIcon name="arrow-right" size={16} />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
