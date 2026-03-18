/**
 * ServicePageTemplate — Shared layout for all public-facing service pages.
 *
 * Encapsulates the common page structure established by RiskManagementPage v3:
 *   - Split-panel hero (text left, image right 44%)
 *   - Individual section: light bg + TabStrip + split card
 *   - Business section: dark bg + TabStrip dark variant + matching card
 *   - PartnerMarquee
 *   - Split-panel call-back form
 *   - SEO with full structured data
 *
 * Each service page provides its unique data via props.
 */

import React, { useState, useRef } from 'react';
import { Link } from 'react-router';
import { SEO, createServiceSchema, createBreadcrumbSchema, createOrganizationSchema } from '../seo/SEO';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Label } from '../ui/label';
import {
  ArrowRight,
  Phone,
  Mail,
  CheckCircle,
  Shield,
  TrendingUp,
  MessageSquare,
  User,
  List,
  Calendar,
} from 'lucide-react';
import { ImageWithFallback } from '../figma/ImageWithFallback';
import { ResponsiveImage } from '../shared/ResponsiveImage';
import { TabStrip } from '../shared/TabStrip';
import { PartnerMarquee, type PartnerLogo } from '../shared/PartnerMarquee';
import { useTabScroll } from '../shared/useTabScroll';
import { ThankYouModal } from '../modals/ThankYouModal';
import { ConsultationModal } from '../modals/ConsultationModal';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ApproachStep {
  step: string;
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
  details: string[];
  color: string;
}

export interface CoverContent {
  title: string;
  description: string;
  benefitsDescription: string;
  features: { title: string; description: string }[];
  benefits: string[];
  image: string;
  /** Optional optimized image key for ResponsiveImage */
  imageKey?: string;
}

export interface ServiceSelectOption {
  value: string;
  label: string;
}

export interface ServicePageConfig {
  /** SEO page key from seo-config.ts */
  seoKey: string;

  /** Hero section */
  hero: {
    badgeText: string;
    titleLine1: string;
    titleLine2: string;
    description: string;
    heroImage: string;
    /** Optional optimized image key for ResponsiveImage */
    heroImageKey?: string;
    heroImageAlt: string;
    /** Floating card text */
    statusLabel: string;
    statusValue: string;
    /** Stats bar */
    stats: { value: string; label: string }[];
    /** Icon in the hero floating card */
    statusIcon?: React.ComponentType<{ className?: string }>;
    /** Get quote link */
    quoteLink?: string;
    /**
     * Hero layout style.
     *   - 'classic'  — split-panel with image occupying right 44% (default)
     *   - 'unified'  — centred dark hero matching the company-page standard,
     *                   with the image inset on the right at reduced size
     */
    heroStyle?: 'classic' | 'unified';
  };

  /** Individual products section */
  individuals: {
    badgeText: string;
    title: string;
    subtitle: string;
    tabIcons: Record<string, React.ComponentType<{ className?: string }>>;
    toggleOptions: { id: string; label: string }[];
    products: Record<string, CoverContent>;
    imageAltMap: Record<string, string>;
    /** Icon and label for the floating card on the image */
    cardIcon: React.ComponentType<{ className?: string }>;
    cardLabel: string;
    /** Quote link for individual products */
    quoteLink: string;
    ariaLabel?: string;
  };

  /** Business products section */
  business: {
    badgeText: string;
    title: string;
    subtitle: string;
    tabIcons: Record<string, React.ComponentType<{ className?: string }>>;
    toggleOptions: { id: string; label: string }[];
    products: Record<string, CoverContent>;
    imageAltMap: Record<string, string>;
    cardIcon: React.ComponentType<{ className?: string }>;
    cardLabel: string;
    quoteLink: string;
    ariaLabel?: string;
  };

  /** Partner marquee */
  partners: {
    logos: PartnerLogo[];
    heading?: string;
    subHeading?: string;
  };

  /** @deprecated FAQ section removed — kept as optional for backward compat */
  faqs?: { question: string; answer: string }[];
  faqSubtitle?: string;

  /** Call-back form */
  form: {
    specialistType: string;
    selectLabel: string;
    selectPlaceholder: string;
    selectOptions: ServiceSelectOption[];
    textareaPlaceholder: string;
    /** Field name used in state for the select value */
    selectFieldName: string;
  };

  /** Structured data offers for SEO */
  structuredDataOffers: { name: string; description: string }[];
  structuredDataServiceType: string;
  structuredDataServiceName: string;
  breadcrumbs: { name: string; url?: string }[];

  /** All images to preload */
  preloadImages: string[];

  /** Optional approach section — renders between Business and Partners when provided */
  approach?: {
    serviceName: string;
    steps: ApproachStep[];
    /** Inline summary cards shown in the page section */
    summaryCards: { icon: React.ComponentType<{ className?: string }>; title: string; description: string }[];
    headerDescription?: string;
    commitmentText?: string;
  };

}

// ── Component ─────────────────────────────────────────────────────────────────

interface ServicePageTemplateProps {
  config: ServicePageConfig;
  seoData: { title: string; description: string; keywords: string; canonicalUrl: string; ogType: string };
  children?: React.ReactNode;
}

export function ServicePageTemplate({ config, seoData, children }: ServicePageTemplateProps) {
  const [activeIndividual, setActiveIndividual] = useState(config.individuals.toggleOptions[0].id);
  const [activeBusiness, setActiveBusiness] = useState(config.business.toggleOptions[0].id);
  const [formData, setFormData] = useState({
    name: '', email: '', contactNumber: '', [config.form.selectFieldName]: '', message: '',
  });
  const [thankYouOpen, setThankYouOpen] = useState(false);
  const [consultationOpen, setConsultationOpen] = useState(false);

  // Tab navigation — individuals
  const indivScrollRef = useRef<HTMLDivElement>(null);
  const indivOpts = config.individuals.toggleOptions;
  const indivIdx = indivOpts.findIndex(o => o.id === activeIndividual);
  const goPrevIndiv = () => setActiveIndividual(indivOpts[(indivIdx - 1 + indivOpts.length) % indivOpts.length].id);
  const goNextIndiv = () => setActiveIndividual(indivOpts[(indivIdx + 1) % indivOpts.length].id);
  useTabScroll(indivScrollRef, activeIndividual);

  // Tab navigation — business
  const bizScrollRef = useRef<HTMLDivElement>(null);
  const bizOpts = config.business.toggleOptions;
  const bizIdx = bizOpts.findIndex(o => o.id === activeBusiness);
  const goPrevBiz = () => setActiveBusiness(bizOpts[(bizIdx - 1 + bizOpts.length) % bizOpts.length].id);
  const goNextBiz = () => setActiveBusiness(bizOpts[(bizIdx + 1) % bizOpts.length].id);
  useTabScroll(bizScrollRef, activeBusiness);

  const currentIndividual = config.individuals.products[activeIndividual];
  const currentBusiness = config.business.products[activeBusiness];

  const handleInputChange = (field: string, value: string) =>
    setFormData(prev => ({ ...prev, [field]: value }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.email || !formData.contactNumber) return;
    setThankYouOpen(true);
    setFormData({ name: '', email: '', contactNumber: '', [config.form.selectFieldName]: '', message: '' });
  };

  // SEO structured data
  const structuredData = {
    '@context': 'https://schema.org',
    '@graph': [
      createOrganizationSchema(),
      createServiceSchema({
        name: config.structuredDataServiceName,
        description: seoData.description,
        url: seoData.canonicalUrl,
        serviceType: config.structuredDataServiceType,
        offers: config.structuredDataOffers,
      }),
      createBreadcrumbSchema(config.breadcrumbs),
    ],
  };

  const IndivCardIcon = config.individuals.cardIcon;
  const BizCardIcon = config.business.cardIcon;

  return (
    <div className="min-h-screen bg-white">
      <SEO
        title={seoData.title}
        description={seoData.description}
        keywords={seoData.keywords}
        canonicalUrl={seoData.canonicalUrl}
        ogType={seoData.ogType}
        ogImage={config.hero.heroImage}
        structuredData={structuredData}
      />

      {/* ═══ HERO ═══ */}
      {config.hero.heroStyle === 'unified' ? (
        /* ── Unified hero — matches the company-page dark hero standard ── */
        <section className="relative overflow-hidden bg-[#111827]" aria-label={`${config.hero.badgeText} hero`}>
          {/* Background — subtle gradient + radial glow */}
          <div className="absolute inset-0 bg-gradient-to-b from-[#111827] via-[#161b33] to-[#111827] pointer-events-none" />
          <div className="absolute top-0 right-0 w-[600px] h-[600px] rounded-full opacity-20 pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(109,40,217,0.25) 0%, transparent 70%)' }} />

          <div className="relative z-10 max-w-screen-xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center py-20 lg:py-28">
              {/* Left — text content */}
              <div className="flex flex-col">
                {/* Pill badge */}
                <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/[0.06] border border-white/[0.08] mb-8 w-fit">
                  <span className="text-[12px] font-medium text-gray-400 tracking-wide">{config.hero.badgeText}</span>
                </div>

                {/* Heading */}
                <h1 className="!text-[clamp(2rem,5vw,3.5rem)] !font-extrabold !leading-[1.1] text-white tracking-tight mb-5">
                  {config.hero.titleLine1}{' '}
                  <span className="bg-gradient-to-r from-purple-400 to-violet-300 bg-clip-text text-transparent">
                    {config.hero.titleLine2}
                  </span>
                </h1>

                <p className="text-gray-400 text-base sm:text-lg max-w-xl leading-relaxed mb-10">
                  {config.hero.description}
                </p>

                {/* CTA buttons */}
                <div className="flex flex-col sm:flex-row gap-3 mb-12">
                  <Button size="lg" className="bg-primary text-primary-foreground hover:bg-primary/90 transition-colors duration-200 px-8 h-12 shadow-lg shadow-purple-600/20" asChild>
                    <Link to="/signup">
                      Get Started
                      <ArrowRight className="ml-2 h-5 w-5" />
                    </Link>
                  </Button>
                  <Button size="lg" variant="outline" className="border-purple-400/30 bg-transparent text-purple-300 hover:bg-purple-500/15 hover:border-purple-400/50 hover:text-purple-200 transition-colors duration-200 px-8 h-12" asChild>
                    <Link to={config.hero.quoteLink ?? '/get-quote'}>Get a Quote</Link>
                  </Button>
                </div>

                {/* Stats bar */}
                <div className="grid grid-cols-3 gap-0 border-t border-white/10 pt-8">
                  {config.hero.stats.map((s, i) => (
                    <div key={i} className={`${i > 0 ? 'pl-6 border-l border-white/10' : ''} pr-6`}>
                      <div className="text-2xl font-bold text-white mb-0.5">{s.value}</div>
                      <div className="text-xs text-gray-400">{s.label}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Right — hero image */}
              <div className="hidden lg:block relative">
                <div className="relative rounded-2xl overflow-hidden shadow-2xl shadow-black/40 border border-white/[0.08]">
                  {config.hero.heroImageKey ? (
                    <ResponsiveImage
                      imageKey={config.hero.heroImageKey}
                      fallbackSrc={config.hero.heroImage}
                      alt={config.hero.heroImageAlt}
                      className="w-full h-[420px] object-cover object-center"
                      loading="eager"
                      fetchPriority="high"
                      sizes="(min-width: 1024px) 44vw, 100vw"
                      width={1100}
                      height={420}
                    />
                  ) : (
                    <ImageWithFallback
                      src={config.hero.heroImage}
                      alt={config.hero.heroImageAlt}
                      className="w-full h-[420px] object-cover object-center"
                    />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent" />
                  {/* Floating status card */}
                  <div className="absolute bottom-5 left-5 bg-white/90 backdrop-blur-sm rounded-2xl px-5 py-4 shadow-2xl flex items-center gap-4">
                    <div className="w-10 h-10 bg-green-50 rounded-xl flex items-center justify-center flex-shrink-0">
                      <CheckCircle className="h-5 w-5 text-green-600" />
                    </div>
                    <div>
                      <div className="text-[11px] text-gray-400 font-medium uppercase tracking-wide">{config.hero.statusLabel}</div>
                      <div className="text-sm font-bold text-gray-900">{config.hero.statusValue}</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      ) : (
        /* ── Classic hero — split-panel with right-side image at 44% ── */
        <section className="relative section-dark-gray overflow-hidden" aria-label={`${config.hero.badgeText} hero`}>
          <div className="hidden lg:block absolute inset-y-0 right-0 w-[44%]">
            {config.hero.heroImageKey ? (
              <ResponsiveImage
                imageKey={config.hero.heroImageKey}
                fallbackSrc={config.hero.heroImage}
                alt={config.hero.heroImageAlt}
                className="w-full h-full object-cover object-center"
                loading="eager"
                fetchPriority="high"
                sizes="(min-width: 1024px) 44vw, 100vw"
                width={1100}
                height={700}
              />
            ) : (
              <ImageWithFallback
                src={config.hero.heroImage}
                alt={config.hero.heroImageAlt}
                className="w-full h-full object-cover object-center"
              />
            )}
            <div className="absolute inset-y-0 left-0 w-48" style={{ background: 'linear-gradient(to right, #313653 0%, transparent 100%)' }} />
            <div className="absolute inset-0 bg-black/10" />
            <div className="absolute bottom-10 left-8 bg-white rounded-2xl px-5 py-4 shadow-2xl flex items-center gap-4">
              <div className="w-10 h-10 bg-green-50 rounded-xl flex items-center justify-center flex-shrink-0">
                <CheckCircle className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <div className="text-[11px] text-gray-400 font-medium uppercase tracking-wide">{config.hero.statusLabel}</div>
                <div className="text-sm font-bold text-gray-900">{config.hero.statusValue}</div>
              </div>
            </div>
          </div>

          <div className="relative max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 xl:px-12 py-16 lg:py-20">
            <div className="lg:max-w-[54%]">
              <Badge className="bg-white/10 text-white border-white/20 mb-5 inline-flex font-medium text-[11px] tracking-widest uppercase">
                {config.hero.badgeText}
              </Badge>
              <h1 className="text-4xl sm:text-5xl font-bold text-white mb-5 leading-tight">
                {config.hero.titleLine1}<br className="hidden sm:block" />
                <span className="text-primary"> {config.hero.titleLine2}</span>
              </h1>
              <p className="text-base text-gray-300 mb-8 max-w-lg leading-relaxed">
                {config.hero.description}
              </p>
              <div className="flex flex-col sm:flex-row gap-3 mb-12">
                <Button size="lg" className="bg-primary text-white hover:bg-primary/90 hover:scale-[1.02] transition-all duration-200 px-7 shadow-lg font-medium text-sm" asChild>
                  <Link to="/signup">Get Started <ArrowRight className="ml-2 h-4 w-4" /></Link>
                </Button>
                <Button size="lg" variant="outline" className="w-full sm:w-fit border-primary/80 bg-primary/10 text-white hover:bg-primary/20 hover:border-primary hover:text-white hover:scale-105 transform transition-all duration-200 px-8 backdrop-blur-sm shadow-lg hover:shadow-xl" asChild>
                  <Link to={config.hero.quoteLink ?? '/get-quote'}>Get a Quote</Link>
                </Button>
              </div>
              <div className="grid grid-cols-3 gap-0 border-t border-white/10 pt-8">
                {config.hero.stats.map((s, i) => (
                  <div key={i} className={`${i > 0 ? 'pl-6 border-l border-white/10' : ''} pr-6`}>
                    <div className="text-2xl font-bold text-white mb-0.5">{s.value}</div>
                    <div className="text-xs text-gray-400">{s.label}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ═══ INDIVIDUALS SECTION ═══ */}
      <section className="py-20 bg-white" aria-label={config.individuals.ariaLabel ?? config.individuals.title}>
        <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 xl:px-12">
          <div className="text-center mb-10">
            <Badge className="bg-primary/10 text-primary border-primary/20 mb-3 font-medium text-[11px] tracking-widest uppercase">
              {config.individuals.badgeText}
            </Badge>
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-3">{config.individuals.title}</h2>
            <p className="text-base text-gray-500 max-w-xl mx-auto">{config.individuals.subtitle}</p>
          </div>

          <TabStrip
            options={indivOpts}
            activeId={activeIndividual}
            icons={config.individuals.tabIcons}
            onSelect={setActiveIndividual}
            onPrev={goPrevIndiv}
            onNext={goNextIndiv}
            scrollRef={indivScrollRef}
            ariaLabel={`${config.individuals.title} types`}
          />

          <div className="rounded-2xl border border-gray-100 shadow-sm overflow-hidden bg-gray-50">
            <div className="grid lg:grid-cols-5">
              <div className="lg:col-span-2 relative min-h-[260px]">
                <div className="absolute inset-0">
                  {currentIndividual.imageKey ? (
                    <ResponsiveImage
                      imageKey={currentIndividual.imageKey}
                      fallbackSrc={currentIndividual.image}
                      alt={config.individuals.imageAltMap[activeIndividual] ?? currentIndividual.title}
                      className="w-full h-full object-cover"
                      loading="eager"
                      fetchPriority="high"
                      sizes="(min-width: 1024px) 40vw, 100vw"
                      width={900}
                      height={600}
                    />
                  ) : (
                    <ImageWithFallback
                      src={currentIndividual.image}
                      alt={config.individuals.imageAltMap[activeIndividual] ?? currentIndividual.title}
                      className="w-full h-full object-cover"
                    />
                  )}
                </div>
                <div className="absolute top-4 left-4 bg-white/90 backdrop-blur-sm rounded-xl px-3 py-2 shadow-md flex items-center gap-2">
                  <IndivCardIcon className="h-3.5 w-3.5 text-primary" />
                  <span className="text-[11px] font-semibold text-gray-800">{config.individuals.cardLabel}</span>
                </div>
              </div>

              <div className="lg:col-span-3 p-7 lg:p-10 flex flex-col justify-center">
                <h3 className="text-xl font-bold text-gray-900 mb-1.5">{currentIndividual.title}</h3>
                <p className="text-sm text-gray-500 mb-4">{currentIndividual.description}</p>
                <p className="text-sm text-gray-700 leading-relaxed mb-6">{currentIndividual.benefitsDescription}</p>

                <div className="grid grid-cols-2 gap-2.5 mb-6">
                  {currentIndividual.features.map((f, i) => (
                    <div key={i} className="bg-white rounded-xl p-3.5 border border-gray-100 shadow-sm">
                      <div className="text-xs font-semibold text-gray-900 mb-0.5">{f.title}</div>
                      <div className="text-[11px] text-gray-500 leading-relaxed">{f.description}</div>
                    </div>
                  ))}
                </div>

                <div className="flex flex-wrap gap-1.5 mb-7">
                  {currentIndividual.benefits.map((b, i) => (
                    <span key={i} className="inline-flex items-center gap-1 text-[11px] font-medium text-primary bg-primary/8 rounded-full px-2.5 py-1 border border-primary/15">
                      <CheckCircle className="h-3 w-3 flex-shrink-0" /> {b}
                    </span>
                  ))}
                </div>

                <div>
                  <Button asChild className="bg-primary text-white hover:bg-primary/90 transition-all duration-200 font-medium text-sm">
                    <Link to={config.individuals.quoteLink}>Get a Quote <ArrowRight className="ml-2 h-4 w-4" /></Link>
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══ BUSINESS SECTION ═══ */}
      <section className="py-20 section-dark-gray" aria-label={config.business.ariaLabel ?? config.business.title}>
        <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 xl:px-12">
          <div className="text-center mb-10">
            <Badge className="bg-primary/20 border-primary/30 mb-3 font-medium text-[11px] tracking-widest uppercase text-white">
              {config.business.badgeText}
            </Badge>
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-3">{config.business.title}</h2>
            <p className="text-base text-gray-400 max-w-xl mx-auto">{config.business.subtitle}</p>
          </div>

          <TabStrip
            options={bizOpts}
            activeId={activeBusiness}
            icons={config.business.tabIcons}
            onSelect={setActiveBusiness}
            onPrev={goPrevBiz}
            onNext={goNextBiz}
            scrollRef={bizScrollRef}
            variant="dark"
            ariaLabel={`${config.business.title} types`}
          />

          <div className="rounded-2xl border border-white/10 shadow-sm overflow-hidden bg-white/5">
            <div className="grid lg:grid-cols-5">
              <div className="lg:col-span-2 relative min-h-[260px]">
                <div className="absolute inset-0">
                  {currentBusiness.imageKey ? (
                    <ResponsiveImage
                      imageKey={currentBusiness.imageKey}
                      fallbackSrc={currentBusiness.image}
                      alt={config.business.imageAltMap[activeBusiness] ?? currentBusiness.title}
                      className="w-full h-full object-cover"
                      loading="eager"
                      fetchPriority="high"
                      sizes="(min-width: 1024px) 40vw, 100vw"
                      width={900}
                      height={600}
                    />
                  ) : (
                    <ImageWithFallback
                      src={currentBusiness.image}
                      alt={config.business.imageAltMap[activeBusiness] ?? currentBusiness.title}
                      className="w-full h-full object-cover"
                    />
                  )}
                </div>
                <div className="absolute top-4 left-4 bg-white/90 backdrop-blur-sm rounded-xl px-3 py-2 shadow-md flex items-center gap-2">
                  <BizCardIcon className="h-3.5 w-3.5 text-primary" />
                  <span className="text-[11px] font-semibold text-gray-800">{config.business.cardLabel}</span>
                </div>
              </div>

              <div className="lg:col-span-3 p-7 lg:p-10 flex flex-col justify-center">
                <h3 className="text-xl font-bold text-white mb-1.5">{currentBusiness.title}</h3>
                <p className="text-sm text-gray-400 mb-4">{currentBusiness.description}</p>
                <p className="text-sm text-gray-300 leading-relaxed mb-6">{currentBusiness.benefitsDescription}</p>

                <div className="grid grid-cols-2 gap-2.5 mb-6">
                  {currentBusiness.features.map((f, i) => (
                    <div key={i} className="bg-white/8 rounded-xl p-3.5 border border-white/10">
                      <div className="text-xs font-semibold text-white mb-0.5">{f.title}</div>
                      <div className="text-[11px] text-gray-400 leading-relaxed">{f.description}</div>
                    </div>
                  ))}
                </div>

                <div className="flex flex-wrap gap-1.5 mb-7">
                  {currentBusiness.benefits.map((b, i) => (
                    <span key={i} className="inline-flex items-center gap-1 text-[11px] font-medium text-white bg-primary/10 rounded-full px-2.5 py-1 border border-primary/20">
                      <CheckCircle className="h-3 w-3 flex-shrink-0" /> {b}
                    </span>
                  ))}
                </div>

                <div>
                  <Button asChild size="lg" variant="outline" className="border-primary/80 bg-primary/10 text-white hover:bg-primary/20 hover:border-primary hover:text-white hover:scale-105 transform transition-all duration-200 px-8 backdrop-blur-sm shadow-lg hover:shadow-xl">
                    <Link to={config.business.quoteLink}>Get a Quote <ArrowRight className="ml-2 h-4 w-4" /></Link>
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══ APPROACH SECTION ═══ */}
      {config.approach && (
        <section className="py-20 bg-white" aria-label="Our approach">
          <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 xl:px-12">
            <div className="text-center mb-12">
              <Badge className="bg-primary/10 text-primary border-primary/20 mb-3 font-medium text-[11px] tracking-widest uppercase">Our Approach</Badge>
              <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-3">{config.approach.serviceName}</h2>
              <p className="text-base text-gray-500 max-w-xl mx-auto">{config.approach.headerDescription ?? 'Our step-by-step approach to delivering exceptional service.'}</p>
            </div>

            <div className="grid md:grid-cols-3 gap-6 mb-10">
              {config.approach.steps.map((step, i) => (
                <div key={i} className="relative bg-gray-50 rounded-2xl p-7 border border-gray-100 shadow-sm hover:shadow-md transition-all">
                  <div className="flex items-center gap-4 mb-4">
                    <div className={`w-12 h-12 bg-gradient-to-br ${step.color} rounded-xl flex items-center justify-center shadow-md`}>
                      <step.icon className="h-6 w-6 text-white" />
                    </div>
                    <div className="w-7 h-7 bg-white border-2 border-gray-200 rounded-full flex items-center justify-center shadow-sm">
                      <span className="text-xs font-bold text-gray-700">{step.step}</span>
                    </div>
                  </div>
                  <h3 className="text-lg font-bold text-gray-900 mb-2">{step.title}</h3>
                  <p className="text-sm text-gray-600 leading-relaxed">{step.description}</p>
                </div>
              ))}
            </div>

            <div className="text-center">
              <p className="text-sm text-gray-500 max-w-2xl mx-auto mb-6">{config.approach.commitmentText ?? 'We are committed to providing the best possible service to meet your needs.'}</p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Button
                  size="lg"
                  className="bg-primary text-white hover:bg-primary/90 hover:scale-[1.02] transition-all duration-200 px-7 shadow-lg font-medium text-sm"
                  onClick={() => setConsultationOpen(true)}
                >
                  <Calendar className="mr-2 h-4 w-4" /> Schedule Consultation
                </Button>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ═══ TRUSTED PARTNERS ═══ */}
      <PartnerMarquee
        partners={config.partners.logos}
        heading={config.partners.heading}
        subHeading={config.partners.subHeading}
      />

      {/* ═══ CALL-BACK FORM ═══ */}
      <section className="py-20 bg-[#ffffff]" aria-label="Request a call back">
        <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 xl:px-12">
          <div className="rounded-3xl overflow-hidden shadow-xl border border-gray-100">
            <div className="grid lg:grid-cols-5">
              <div className="lg:col-span-2 section-dark-gray p-9 lg:p-12 flex flex-col justify-between">
                <div>
                  <div className="w-11 h-11 bg-primary/20 rounded-2xl flex items-center justify-center mb-6">
                    <Phone className="h-5 w-5 text-primary" />
                  </div>
                  <h2 className="text-2xl lg:text-3xl font-bold text-white mb-4 leading-tight">Let us call<br />you back</h2>
                  <p className="text-sm text-gray-300 leading-relaxed mb-8">
                    Complete the form and a {config.form.specialistType} specialist will contact you with personalised options tailored to your needs.
                  </p>
                  <div className="space-y-4">
                    {[
                      { icon: CheckCircle, label: 'Free consultation', sub: 'No cost, no commitment' },
                      { icon: Shield, label: 'Expert advice', sub: 'From accredited specialists' },
                      { icon: TrendingUp, label: 'Market-wide search', sub: 'Best options at the right price' },
                    ].map(({ icon: Icon, label, sub }) => (
                      <div key={label} className="flex items-start gap-3">
                        <div className="w-8 h-8 bg-white/8 rounded-xl flex items-center justify-center flex-shrink-0 border border-white/10">
                          <Icon className="h-4 w-4 text-primary" />
                        </div>
                        <div>
                          <div className="text-sm font-semibold text-white">{label}</div>
                          <div className="text-xs text-gray-400">{sub}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="mt-10 pt-8 border-t border-white/10">
                  <div className="flex flex-wrap gap-2">
                    {['Free consultation', 'No obligation', 'Quick response'].map(tag => (
                      <span key={tag} className="inline-flex items-center gap-1.5 text-[11px] font-medium text-gray-300 bg-white/5 rounded-full px-3 py-1.5 border border-white/10">
                        <CheckCircle className="h-3 w-3 text-primary flex-shrink-0" /> {tag}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              <div className="lg:col-span-3 bg-white p-9 lg:p-12">
                <h3 className="text-lg font-bold text-gray-900 mb-7">Your details</h3>
                <form onSubmit={handleSubmit} aria-label="Request a call back" className="space-y-5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label className="flex items-center gap-2 text-gray-700 text-xs font-semibold uppercase tracking-wide"><User className="h-3.5 w-3.5 text-primary" /> Full Name</Label>
                      <Input type="text" required placeholder="Enter your full name" value={formData.name} onChange={e => handleInputChange('name', e.target.value)} className="border-gray-200 focus:border-primary focus:ring-primary text-sm" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="flex items-center gap-2 text-gray-700 text-xs font-semibold uppercase tracking-wide"><Mail className="h-3.5 w-3.5 text-primary" /> Email Address</Label>
                      <Input type="email" required placeholder="Enter your email" value={formData.email} onChange={e => handleInputChange('email', e.target.value)} className="border-gray-200 focus:border-primary focus:ring-primary text-sm" />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label className="flex items-center gap-2 text-gray-700 text-xs font-semibold uppercase tracking-wide"><Phone className="h-3.5 w-3.5 text-primary" /> Contact Number</Label>
                      <Input type="tel" required placeholder="Enter your phone number" value={formData.contactNumber} onChange={e => handleInputChange('contactNumber', e.target.value)} className="border-gray-200 focus:border-primary focus:ring-primary text-sm" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="flex items-center gap-2 text-gray-700 text-xs font-semibold uppercase tracking-wide"><List className="h-3.5 w-3.5 text-primary" /> {config.form.selectLabel}</Label>
                      <Select value={formData[config.form.selectFieldName] ?? ''} onValueChange={v => handleInputChange(config.form.selectFieldName, v)}>
                        <SelectTrigger className="border-gray-200 focus:border-primary focus:ring-primary text-sm">
                          <SelectValue placeholder={config.form.selectPlaceholder} />
                        </SelectTrigger>
                        <SelectContent>
                          {config.form.selectOptions.map(opt => (
                            <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="flex items-center gap-2 text-gray-700 text-xs font-semibold uppercase tracking-wide"><MessageSquare className="h-3.5 w-3.5 text-primary" /> Message</Label>
                    <Textarea placeholder={config.form.textareaPlaceholder} rows={4} value={formData.message} onChange={e => handleInputChange('message', e.target.value)} className="border-gray-200 focus:border-primary focus:ring-primary resize-none text-sm" />
                  </div>
                  <div className="pt-1">
                    <Button type="submit" size="lg" className="w-full bg-primary text-white hover:bg-primary/90 hover:scale-[1.01] transition-all duration-200 shadow-md font-medium text-sm">
                      <Phone className="mr-2 h-4 w-4" /> Call Me Back
                    </Button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Modals passed as children */}
      {children}
      <ThankYouModal open={thankYouOpen} onOpenChange={setThankYouOpen} />
      <ConsultationModal open={consultationOpen} onOpenChange={setConsultationOpen} />
    </div>
  );
}