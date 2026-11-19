/**
 * NavigatorProductQuotePage — the quote funnel's last step, "quote details"
 * (/get-quote/:service), in the redesign.
 *
 * The layout is the "Quote details" board of the Website Redesign canvas
 * (ProductQuote, and MobileQuote on a phone). Everything the step does is the
 * live page's (ProductQuotePage.tsx and its wizards):
 *
 *  - the service from the address, with "Service Not Found" for one that
 *    does not exist;
 *  - the contact details from the router state the "your details" step
 *    hands over, and a redirect back to that step when there are none —
 *    except /get-quote/medical-aid, an indexable landing page that collects
 *    them here, with the same SEO tags; every other service stays noindex;
 *  - for six services, the live wizard's steps, questions, options, checks,
 *    saved progress (session storage, the same keys) and request; for estate
 *    planning, the one-step details form, kept in the same session store;
 *  - the same POST /quote-request/submit, the success screen and where it
 *    leads, and the live failure messages.
 *
 * The board's frame is kept around them: its hero and funnel stepper, its
 * contact card, its quote card (heading, "Quoting for" and step tabs), its
 * sidebar and its success card. How each live question is drawn in the
 * board's controls is said in the wizard sections (ProductQuoteRisk, …).
 */
import { useCallback, useEffect, useMemo, useState, type ComponentType } from 'react';
import { Link, Navigate, useLocation, useNavigate, useParams } from 'react-router';
import { SEO, createWebPageSchema } from '../../components/seo/SEO';
import { getSEOData } from '../../components/seo/seo-config';
import {
  QUOTE_SERVICES,
  getServiceConfig,
  isValidServiceId,
} from '../../components/pages/quote/constants';
import { saveGatewaySession } from '../../components/pages/quote/gatewaySession';
import {
  INDEXABLE_QUOTE_SERVICES,
  SESSION_KEY,
  loadSession,
  saveSession,
} from '../../components/pages/quote/productQuoteSession';
import type {
  QuoteContactDetails,
  QuoteRouterState,
  QuoteServiceId,
} from '../../components/pages/quote/types';
import { ProductQuoteAside } from '../sections/ProductQuoteAside';
import { ProductQuoteBenefits } from '../sections/ProductQuoteBenefits';
import { ProductQuoteCard } from '../sections/ProductQuoteCard';
import { ProductQuoteContact } from '../sections/ProductQuoteContact';
import { ProductQuoteDetails } from '../sections/ProductQuoteDetails';
import { ProductQuoteHero } from '../sections/ProductQuoteHero';
import { ProductQuoteIcon } from '../sections/ProductQuoteIcons';
import { ProductQuoteInvestment } from '../sections/ProductQuoteInvestment';
import { ProductQuoteMedical } from '../sections/ProductQuoteMedical';
import { SEND_FAILED, SEND_UNREACHABLE, submitProductQuote } from '../sections/ProductQuoteModel';
import { ProductQuoteRetirement } from '../sections/ProductQuoteRetirement';
import { ProductQuoteRisk } from '../sections/ProductQuoteRisk';
import { ProductQuoteStepper } from '../sections/ProductQuoteStepper';
import { ProductQuoteSuccess } from '../sections/ProductQuoteSuccess';
import { ProductQuoteTax } from '../sections/ProductQuoteTax';
import type { WizardProps } from '../sections/ProductQuoteSend';
import '../styles/navigator.css';
import '../styles/sections.css';
import '../styles/product-quote.css';

const SERVICES_HREF = '/get-quote';
const PRIVACY_HREF = '/legal/privacy-notice';

/** The services the live page quotes with a wizard, and which one. */
const WIZARDS: Partial<Record<QuoteServiceId, ComponentType<WizardProps>>> = {
  'risk-management': ProductQuoteRisk,
  'medical-aid': ProductQuoteMedical,
  'investment-management': ProductQuoteInvestment,
  'retirement-planning': ProductQuoteRetirement,
  'employee-benefits': ProductQuoteBenefits,
  'tax-planning': ProductQuoteTax,
};

export function NavigatorProductQuotePage() {
  const { service } = useParams<{ service: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const routerState = location.state as QuoteRouterState | undefined;
  const serviceConfig = service && isValidServiceId(service) ? getServiceConfig(service) : null;

  const [contact, setContact] = useState<QuoteContactDetails>(() => ({
    firstName: routerState?.contact?.firstName ?? '',
    lastName: routerState?.contact?.lastName ?? '',
    email: routerState?.contact?.email ?? '',
    phone: routerState?.contact?.phone ?? '',
  }));
  const [productFields, setProductFields] = useState<Record<string, string>>(() =>
    service ? loadSession(service) : {},
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [failure, setFailure] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);

  const hasContactFromGateway = Boolean(routerState?.contact);

  // The details form's answers survive a reload, as on the live page.
  useEffect(() => {
    if (service) saveSession(service, productFields);
  }, [productFields, service]);

  const onProductFieldChange = useCallback((fieldId: string, value: string) => {
    setProductFields((prev) => ({ ...prev, [fieldId]: value }));
  }, []);

  const contactValid = Boolean(
    contact.firstName.trim() &&
    contact.lastName.trim() &&
    contact.email.trim() &&
    contact.phone.trim(),
  );
  const requiredProductFields = serviceConfig?.productFields.filter((f) => f.required) ?? [];
  const productFieldsValid = requiredProductFields.every((f) => productFields[f.id]?.trim());
  const isFormValid = contactValid && productFieldsValid;

  // The live page's details-form submit, with the failure shown in the form.
  const submitDetails = useCallback(async () => {
    if (!isFormValid || !service || !serviceConfig) return;
    setIsSubmitting(true);
    setFailure('');
    try {
      const { ok, result } = await submitProductQuote({
        contact,
        productName: serviceConfig.label,
        service: serviceConfig.id,
        parentSubmissionId: routerState?.parentSubmissionId ?? undefined,
        productDetails: productFields,
      });
      if (!ok) {
        console.error('Product quote submission error:', result);
        setFailure(result.error || SEND_FAILED);
        return;
      }
      if (service) sessionStorage.removeItem(`${SESSION_KEY}_${service}`);
      setIsSuccess(true);
    } catch (error) {
      console.error('Product quote network error:', error);
      setFailure(SEND_UNREACHABLE);
    } finally {
      setIsSubmitting(false);
    }
  }, [isFormValid, service, serviceConfig, contact, routerState, productFields]);

  const onSuccess = useCallback(() => setIsSuccess(true), []);

  const isIndexableQuote = Boolean(
    service && INDEXABLE_QUOTE_SERVICES.has(service) && serviceConfig,
  );
  const medicalAidSeo = isIndexableQuote ? getSEOData('get-quote-medical-aid') : null;

  // Quote-funnel steps stay out of the search index (as the edge
  // X-Robots-Tag in vercel.json says), except the indexable landings.
  useEffect(() => {
    if (isIndexableQuote) return;
    let el = document.querySelector('meta[name="robots"]') as HTMLMetaElement | null;
    if (!el) {
      el = document.createElement('meta');
      el.setAttribute('name', 'robots');
      document.head.appendChild(el);
    }
    el.setAttribute('content', 'noindex, follow');
  }, [isIndexableQuote]);

  const wizardProps = useMemo<WizardProps>(
    () => ({ contact, parentSubmissionId: routerState?.parentSubmissionId, onSuccess }),
    [contact, routerState?.parentSubmissionId, onSuccess],
  );

  if (!serviceConfig) {
    return (
      <div className="nw-site nwpq">
        <section className="nwpq-missing">
          <div className="nw-wrap nwpq-missing-wrap">
            <h1 className="nw-h nwpq-missing-title">Service Not Found</h1>
            <p className="nwpq-missing-text">The requested service doesn&apos;t exist.</p>
            <Link className="nw-btn" to={SERVICES_HREF}>
              Browse All Services
            </Link>
          </div>
        </section>
      </div>
    );
  }

  // Deep links must complete the "your details" step first, except the
  // indexable landings, which collect contact details on this page.
  if (!routerState?.contact && !isIndexableQuote) {
    return <Navigate to={`/get-quote/${service}/contact`} replace />;
  }

  const contactHref = `/get-quote/${serviceConfig.id}/contact`;
  const Wizard = WIZARDS[serviceConfig.id];

  const switchService = (id: QuoteServiceId) => {
    // Carry the details over to the other service's "your details" step.
    saveGatewaySession(contact);
    navigate(`/get-quote/${id}/contact`);
  };

  return (
    <div className="nw-site nwpq">
      {medicalAidSeo ? (
        <SEO
          {...medicalAidSeo}
          robotsContent="index, follow"
          structuredData={createWebPageSchema(
            medicalAidSeo.title,
            medicalAidSeo.description,
            medicalAidSeo.canonicalUrl,
          )}
        />
      ) : null}

      <ProductQuoteHero
        label={serviceConfig.label}
        summary={serviceConfig.heroDescription}
        servicesHref={SERVICES_HREF}
      />

      <section className="nwpq-main">
        <div className="nw-wrap nwpq-main-wrap">
          <ProductQuoteStepper servicesHref={SERVICES_HREF} contactHref={contactHref} />
          <div className="nwpq-layout">
            <div className="nwpq-col">
              {isSuccess ? (
                <ProductQuoteSuccess
                  serviceName={serviceConfig.label}
                  servicesHref={SERVICES_HREF}
                />
              ) : (
                <>
                  <ProductQuoteContact
                    values={contact}
                    prefilled={hasContactFromGateway}
                    onChange={(field, value) => setContact((c) => ({ ...c, [field]: value }))}
                  />
                  <ProductQuoteCard
                    service={serviceConfig}
                    services={QUOTE_SERVICES}
                    onServiceChange={switchService}
                    eyebrow={Wizard ? 'Quote wizard' : 'Your quote details'}
                  >
                    {Wizard ? (
                      contactValid ? (
                        <Wizard {...wizardProps} />
                      ) : (
                        <p className="nwpq-waiting">
                          Please fill in all contact details above to start the quote wizard.
                        </p>
                      )
                    ) : (
                      <ProductQuoteDetails
                        fields={serviceConfig.productFields}
                        values={productFields}
                        onChange={onProductFieldChange}
                        valid={isFormValid}
                        submitting={isSubmitting}
                        failure={failure}
                        onSubmit={() => void submitDetails()}
                        shortLabel={serviceConfig.shortLabel}
                        backHref={contactHref}
                      />
                    )}
                  </ProductQuoteCard>
                  <p className="nwpq-privacy">
                    <ProductQuoteIcon name="lock" size={14} stroke="#0D1626" />
                    <span>
                      By submitting, you agree to our <Link to={PRIVACY_HREF}>Privacy Policy</Link>.
                      Your information is secure and will only be used to prepare your personalised
                      quote.
                    </span>
                  </p>
                </>
              )}
            </div>
            <ProductQuoteAside providers={serviceConfig.providers} />
          </div>
        </div>
      </section>
    </div>
  );
}

export default NavigatorProductQuotePage;
