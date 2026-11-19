/**
 * NavigatorQuoteContactPage — the quote funnel's "your details" step
 * (/get-quote/:service/contact) in the redesign.
 *
 * The layout is the "Quote — your details" board of the Website Redesign
 * canvas. Everything the step does is the live page's
 * (QuoteServiceContactPage.tsx): the same SEO tags, noindex and WebPage data;
 * the service from the address, with the same "Service Not Found" for one
 * that does not exist; the details kept in the same session store while they
 * are typed; ?will=true opening estate planning on drafting a will, which
 * hands over to the same will-drafting flow; and the same lead sent to
 * POST /quote-request/submit, after which the visitor continues to
 * /get-quote/:service with the same router state.
 *
 * The services, their copy and their providers come from quote/constants.ts,
 * and the sidebar's lists from quoteServiceContactPageData.ts — both designs
 * read them there. The firm's number is companyFacts'.
 *
 * Where the board says more than the live page does, the live page's words
 * are used: the eyebrow reads "Step 2 of 3 — Your details", without the
 * board's "about a minute left", since how long the next step takes depends
 * on the service.
 */
import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router';
import { SEO, createWebPageSchema } from '../../components/seo/SEO';
import { getQuoteServiceContactSEO } from '../../components/seo/seo-config';
import { WillDraftingFlow } from '../../components/features/wills/WillDraftingFlow';
import {
  QUOTE_SERVICES,
  getServiceConfig,
  isValidServiceId,
} from '../../components/pages/quote/constants';
import {
  clearGatewaySession,
  loadGatewaySession,
  saveGatewaySession,
} from '../../components/pages/quote/gatewaySession';
import type {
  QuoteContactDetails,
  QuoteRouterState,
  QuoteServiceId,
} from '../../components/pages/quote/types';
import {
  QUOTE_CONTACT_POINTS,
  QUOTE_CONTACT_STEPS,
} from '../../components/pages/quoteServiceContactPageData';
import { projectId } from '../../utils/supabase/info';
import { COMPANY } from '../../config/companyFacts';
import { PHONE_DISPLAY, WHATSAPP_HREF } from '../siteLinks';
import { QuoteContactAside } from '../sections/QuoteContactAside';
import { QuoteContactForm, type EstateChoice } from '../sections/QuoteContactForm';
import { QuoteContactHero } from '../sections/QuoteContactHero';
import { QuoteContactStepper } from '../sections/QuoteContactStepper';
import '../styles/navigator.css';
import '../styles/sections.css';
import '../styles/quote-contact.css';

const SERVICES_HREF = '/get-quote';
const PRIVACY_HREF = '/legal/privacy-notice';

/**
 * The live page's request, unchanged: the same endpoint, method, body and
 * body order. POST /quote-request/submit is public (no auth middleware, and
 * the function runs with verify_jwt = false), so no bearer is sent: see
 * anon-key-bearer-ratchet.test.ts. Resolves with the server's reply, or
 * throws as fetch and response.json() do.
 */
async function submitQuoteRequest(
  contact: QuoteContactDetails,
  service: QuoteServiceId,
  productName: string,
  website: string,
) {
  const response = await fetch(
    `https://${projectId}.supabase.co/functions/v1/make-server-91ed8379/quote-request/submit`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        firstName: contact.firstName.trim(),
        lastName: contact.lastName.trim(),
        email: contact.email.trim(),
        phone: contact.phone.trim(),
        productName,
        stage: 'initial',
        service,
        website,
      }),
    },
  );
  const result = await response.json();
  return { ok: response.ok, result };
}

export function NavigatorQuoteContactPage() {
  const { service: serviceParam } = useParams<{ service: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const selectedService: QuoteServiceId | null =
    serviceParam && isValidServiceId(serviceParam) ? serviceParam : null;
  const config = selectedService ? getServiceConfig(selectedService) : null;

  const [estateChoice, setEstateChoice] = useState<EstateChoice>('consultation');
  const [values, setValues] = useState<QuoteContactDetails>(() => {
    const saved = loadGatewaySession();
    return {
      firstName: saved.firstName ?? '',
      lastName: saved.lastName ?? '',
      email: saved.email ?? '',
      phone: saved.phone ?? '',
    };
  });
  const [website, setWebsite] = useState('');
  const [showWillDrafting, setShowWillDrafting] = useState(false);

  useEffect(() => {
    if (searchParams.get('will') === 'true' && selectedService === 'estate-planning') {
      setEstateChoice('will');
    }
  }, [searchParams, selectedService]);

  // The details survive a reload, and the move to another service.
  useEffect(() => {
    saveGatewaySession(values);
  }, [values]);

  const draftingWill = selectedService === 'estate-planning' && estateChoice === 'will';

  const onContinue = useCallback(async (): Promise<string | null> => {
    if (!selectedService || !config) return null;
    if (draftingWill) {
      setShowWillDrafting(true);
      return null;
    }
    try {
      const { ok, result } = await submitQuoteRequest(
        values,
        selectedService,
        config.label,
        website,
      );
      if (!ok) {
        console.error('Quote gateway submission error:', result);
        return result.error || 'Something went wrong. Please try again.';
      }
      clearGatewaySession();
      const routerState: QuoteRouterState = {
        contact: {
          firstName: values.firstName.trim(),
          lastName: values.lastName.trim(),
          email: values.email.trim(),
          phone: values.phone.trim(),
        },
        service: selectedService,
        parentSubmissionId: result.submissionId ?? result.submissionEntryId ?? '',
      };
      navigate(`/get-quote/${selectedService}`, { state: routerState });
      return null;
    } catch (error) {
      console.error('Quote gateway network error:', error);
      return 'Unable to submit your request. Please check your connection and try again.';
    }
  }, [selectedService, config, draftingWill, values, website, navigate]);

  if (!selectedService || !config) {
    return (
      <div className="nw-site nwqc">
        <section className="nwqc-missing">
          <div className="nw-wrap nwqc-missing-wrap">
            <h1 className="nw-h nwqc-missing-title">Service Not Found</h1>
            <p className="nwqc-missing-text">The requested service does not exist.</p>
            <Link className="nw-btn" to={SERVICES_HREF}>
              Browse All Services
            </Link>
          </div>
        </section>
      </div>
    );
  }

  const seo = getQuoteServiceContactSEO(selectedService);

  if (showWillDrafting) {
    return (
      <WillDraftingFlow
        clientDetails={{
          name: values.firstName,
          surname: values.lastName,
          email: values.email,
          cellphone: values.phone,
        }}
        onComplete={() => {
          setShowWillDrafting(false);
          navigate('/get-quote');
        }}
        onBack={() => setShowWillDrafting(false)}
      />
    );
  }

  return (
    <div className="nw-site nwqc">
      <SEO
        {...seo}
        // Lead-gen funnel step, not a search landing page. Kept out of the index
        // (matches the edge X-Robots-Tag in vercel.json) but links are followed.
        robotsContent="noindex, follow"
        structuredData={createWebPageSchema(seo.title, seo.description, seo.canonicalUrl)}
      />

      <QuoteContactHero
        label={config.label}
        eyebrow="Step 2 of 3 — Your details"
        lead="Tell us who you are so we can prepare your personalised quote. Next step: your specific needs."
        servicesHref={SERVICES_HREF}
      />

      <section className="nwqc-main">
        <div className="nw-wrap nwqc-main-wrap">
          <QuoteContactStepper servicesHref={SERVICES_HREF} />
          <div className="nwqc-layout">
            <QuoteContactForm
              service={config}
              services={QUOTE_SERVICES}
              onServiceChange={(id) => navigate(`/get-quote/${id}/contact`, { replace: true })}
              values={values}
              onValueChange={(field, value) => setValues((v) => ({ ...v, [field]: value }))}
              website={website}
              onWebsiteChange={setWebsite}
              estateChoice={selectedService === 'estate-planning' ? estateChoice : null}
              onEstateChoice={setEstateChoice}
              continueLabel={draftingWill ? 'Start Will Drafting' : 'Continue to Quote Details'}
              onContinue={onContinue}
              servicesHref={SERVICES_HREF}
              privacyHref={PRIVACY_HREF}
            />
            <QuoteContactAside
              label={config.label}
              description={config.description}
              summary={config.heroDescription}
              topics={config.topicChips ?? []}
              points={QUOTE_CONTACT_POINTS}
              steps={QUOTE_CONTACT_STEPS}
              phone={{ href: COMPANY.phone.tel, display: PHONE_DISPLAY }}
              whatsappHref={WHATSAPP_HREF}
            />
          </div>
        </div>
      </section>
    </div>
  );
}

export default NavigatorQuoteContactPage;
