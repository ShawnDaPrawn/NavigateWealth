import React from 'react';
import { Link } from 'react-router';
import { Button } from '../ui/button';
import { Card, CardContent } from '../ui/card';
import { Badge } from '../ui/badge';
import { SEO } from '../seo/SEO';
import { ImageWithFallback } from '../figma/ImageWithFallback';
import { ResponsiveImage } from '../shared/ResponsiveImage';
import { ConsultationModal } from '../modals/ConsultationModal';
import { useImagePrefetch, prefetchImages } from '../../hooks/useImagePrefetch';
import { getOptimizedImageUrl } from '../../utils/optimizedImages';
import {
  TrendingUp,
  Shield,
  Target,
  Calculator,
  Briefcase,
  ArrowRight,
  CheckCircle,
  Heart,
  Users,
  Globe,
  Zap,
  FileText,
  Stethoscope,
  Phone,
  Mail,
  MapPin,
  Star,
} from 'lucide-react';

// Figma asset images — same images used on Homepage for visual consistency
import familyImage from 'figma:asset/8a93f2fa219696290136738d0dc439f43b6c6235.png';
import consultationImage from 'figma:asset/b0b37f186d8c48117bede379a79e329626b6ac95.png';
import investmentConsultationImage from 'figma:asset/fc6a85769d1248cdde73b1d2252674e730f0655a.png';
import estatePlanningImage from 'figma:asset/482a45127e501f4b3cecd244241cff6024f47011.png';
import taxPlanningImage from 'figma:asset/7f33deddff0f6240cb18dcef045f830436c30355.png';
import employeeBenefitsTeamImage from 'figma:asset/dc2935371f93dc2f6da2f85cfa093001ca172d63.png';
import medicalAidImage from 'figma:asset/0e2b917f64eba502a24068ea5244bd25b0dfc9d5.png';
import southAfricanCurrencyImage from 'figma:asset/1f32a99aadd795f3c7f5c530f916c758d6ccb6f0.png';

// ── Service data ─────────────────────────────────────────────────────────────

interface ServiceItem {
  id: string;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  highlights: string[];
  image: string;
  imageKey?: string;
  path: string;
  badge?: string;
  quoteSlug: string;
}

const SERVICES: ServiceItem[] = [
  {
    id: 'risk-management',
    icon: Shield,
    title: 'Risk Management',
    description:
      'Risk management is arguably the most important part of robust financial planning. We highlight how much coverage you require and search the market to provide the best option.',
    highlights: ['Life Cover', 'Income Protection', 'Disability Cover', 'Severe Illness Cover'],
    image: familyImage,
    imageKey: 'risk-management-family',
    path: '/risk-management',
    quoteSlug: 'risk-management',
  },
  {
    id: 'medical-aid',
    icon: Stethoscope,
    title: 'Medical Aid',
    description:
      'Access quality healthcare with comprehensive medical aid schemes tailored to your family\'s needs and budget, from major medical to full cover options.',
    highlights: ['Hospital Plans', 'Comprehensive Cover', 'Gap Cover', 'Day-to-day Benefits'],
    image: medicalAidImage,
    imageKey: 'medical-aid',
    path: '/medical-aid',
    quoteSlug: 'medical-aid',
  },
  {
    id: 'retirement-planning',
    icon: Target,
    title: 'Retirement Planning',
    description:
      'Secure your future with tailored retirement strategies designed to help you maintain your lifestyle and financial independence in retirement.',
    highlights: ['Retirement Annuities', 'Pension Funds', 'Living Annuities', 'Preservation Funds'],
    image: consultationImage,
    imageKey: 'retirement-planning',
    path: '/retirement-planning',
    quoteSlug: 'retirement-planning',
  },
  {
    id: 'investment-management',
    icon: TrendingUp,
    title: 'Investment Management',
    description:
      'We offer a broad range of carefully selected local and offshore investment products for strategic diversification and long-term growth.',
    highlights: ['Unit Trusts', 'Offshore Investments', 'Tax-Free Savings', 'Portfolio Management'],
    image: investmentConsultationImage,
    imageKey: 'investment-consultation',
    path: '/investment-management',
    badge: 'Most Popular',
    quoteSlug: 'investment-management',
  },
  {
    id: 'employee-benefits',
    icon: Briefcase,
    title: 'Employee Benefits',
    description:
      'Tailored benefit plans for businesses to attract and retain top talent with group risk, retirement, and healthcare solutions.',
    highlights: ['Group Risk Cover', 'Retirement Funds', 'Healthcare Benefits', 'Wellness Programs'],
    image: employeeBenefitsTeamImage,
    imageKey: 'employee-benefits',
    path: '/employee-benefits',
    quoteSlug: 'employee-benefits',
  },
  {
    id: 'tax-planning',
    icon: Calculator,
    title: 'Tax Planning',
    description:
      'Advanced strategies to minimise liabilities and ensure compliance, leveraging tax-efficient structures and allowances.',
    highlights: ['Tax Optimisation', 'Section 12J', 'Tax-Free Savings', 'Estate Duty Planning'],
    image: taxPlanningImage,
    imageKey: 'tax-planning',
    path: '/tax-planning',
    quoteSlug: 'tax-planning',
  },
  {
    id: 'estate-planning',
    icon: FileText,
    title: 'Estate Planning',
    description:
      'Preserve your legacy and minimise taxes through wills, trusts, and tailored strategies to protect your family\'s future.',
    highlights: ['Will Drafting', 'Trust Structures', 'Estate Duty', 'Beneficiary Nominations'],
    image: estatePlanningImage,
    imageKey: 'estate-planning',
    path: '/estate-planning',
    quoteSlug: 'estate-planning',
  },
  {
    id: 'financial-planning',
    icon: Users,
    title: 'Financial Planning',
    description:
      'Holistic financial planning that aligns all aspects of your financial life with your personal goals through a comprehensive needs analysis.',
    highlights: ['Financial Needs Analysis', 'Goal Setting', 'Cash Flow Planning', 'Debt Management'],
    image: southAfricanCurrencyImage,
    imageKey: 'financial-planning',
    path: '/financial-planning',
    quoteSlug: 'financial-planning',
  },
];

const PROCESS_STEPS = [
  {
    step: '01',
    title: 'Discovery',
    description: 'We learn about your goals, timeline, risk tolerance, and current financial situation through a no-obligation consultation.',
    icon: Users,
  },
  {
    step: '02',
    title: 'Analysis',
    description: 'Our team conducts a comprehensive financial needs analysis and develops a customised strategy tailored to your needs.',
    icon: Target,
  },
  {
    step: '03',
    title: 'Implementation',
    description: 'We source the best products from 12+ providers and implement your financial plan with complete transparency.',
    icon: CheckCircle,
  },
  {
    step: '04',
    title: 'Ongoing Support',
    description: 'Continuous portfolio management, annual reviews, and planning updates to keep you on track as your life evolves.',
    icon: TrendingUp,
  },
];

const WHY_US = [
  {
    icon: Globe,
    title: 'Fiercely Independent',
    description: 'We are not tied to any single provider. Our independence means unbiased advice and access to the best products across 12+ top-tier partners.',
  },
  {
    icon: Heart,
    title: 'Client-First Philosophy',
    description: 'Every recommendation is tailored to your unique goals, values, and timeline — never driven by commission or product quotas.',
  },
  {
    icon: Zap,
    title: 'Technology-Enabled',
    description: 'We integrate modern technology to streamline onboarding, real-time portfolio monitoring, and transparent reporting.',
  },
  {
    icon: Shield,
    title: 'FSCA Regulated',
    description: 'Licensed under FSP 54606, we adhere to the highest standards of governance, compliance, and fiduciary responsibility.',
  },
];

const STATS = [
  { label: 'Years Experience', value: '15+', icon: Star },
  { label: 'Product Partners', value: '12+', icon: Globe },
  { label: 'Happy Clients', value: '100+', icon: Heart },
  { label: 'Assets Under Advice', value: 'R500M+', icon: TrendingUp },
];

// ── Component ────────────────────────────────────────────────────────────────

export function ServicesPage() {
  const [consultationOpen, setConsultationOpen] = React.useState(false);

  // While the user browses Services, warm the cache for likely next navigations.
  useImagePrefetch(
    SERVICES
      .filter((s) => !!s.imageKey)
      .map((s) => getOptimizedImageUrl(s.imageKey!, 768, 'webp')),
    { delayMs: 2500, idleTimeoutMs: 4000 },
  );

  return (
    <div className="contents">
      <SEO
        title="Our Services | Navigate Wealth"
        description="Comprehensive wealth management services from Navigate Wealth — risk management, retirement planning, investments, medical aid, estate planning, tax planning, and employee benefits."
        keywords={['financial services', 'wealth management', 'risk management', 'retirement planning', 'investment management', 'medical aid', 'estate planning', 'tax planning', 'employee benefits', 'South Africa']}
        canonicalUrl="https://navigatewealth.co/services"
      />

      <div className="min-h-screen">
        {/* ═══ HERO SECTION ═══ */}
        <section className="relative overflow-hidden bg-[#111827]" aria-label="Services hero">
          {/* Background decoration */}
          <div className="absolute inset-0 bg-gradient-to-br from-[#111827] via-[#1a1f3a] to-[#111827] pointer-events-none" />
          <div
            className="absolute -top-32 -right-32 w-[600px] h-[600px] rounded-full opacity-25 pointer-events-none"
            style={{ background: 'radial-gradient(circle, rgba(109,40,217,0.35) 0%, transparent 70%)' }}
          />
          <div
            className="absolute -bottom-48 -left-32 w-[450px] h-[450px] rounded-full opacity-20 pointer-events-none"
            style={{ background: 'radial-gradient(circle, rgba(99,102,241,0.3) 0%, transparent 70%)' }}
          />
          <div
            className="absolute inset-0 opacity-[0.03] pointer-events-none"
            style={{
              backgroundImage: 'linear-gradient(rgba(255,255,255,0.07) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.07) 1px, transparent 1px)',
              backgroundSize: '64px 64px',
            }}
          />

          <div className="relative z-10 max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 xl:px-12 py-20 lg:py-28">
            <div className="max-w-3xl mx-auto text-center space-y-6">
              {/* Badge */}
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/[0.06] border border-white/[0.08]">
                <Shield className="h-3.5 w-3.5 text-purple-400" />
                <span className="text-[12px] font-medium text-gray-400 tracking-wide">Comprehensive Wealth Management</span>
              </div>

              {/* Heading */}
              <h1 className="!text-[clamp(1.85rem,4.5vw,3rem)] !font-extrabold !leading-[1.1] text-white tracking-tight">
                Financial Solutions for{' '}
                <span className="bg-gradient-to-r from-purple-400 via-violet-300 to-indigo-400 bg-clip-text text-transparent">
                  Every Stage of Life
                </span>
              </h1>

              <p className="text-gray-400 text-base lg:text-lg max-w-2xl mx-auto leading-relaxed">
                From investment management to estate planning, we provide independent, unbiased financial advice backed by 12+ trusted product partners — so you always get the best solution for your goals.
              </p>

              {/* CTA row */}
              <div className="flex flex-col sm:flex-row gap-4 justify-center pt-2">
                <Button
                  size="lg"
                  className="bg-primary text-primary-foreground hover:bg-primary/90 hover:scale-105 transform transition-all duration-200 px-8 shadow-lg hover:shadow-xl"
                  asChild
                >
                  <Link to="/get-quote">
                    Get a Free Quote
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Link>
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  className="border-primary/80 bg-primary/10 text-white hover:bg-primary/20 hover:border-primary hover:text-white hover:scale-105 transform transition-all duration-200 px-8 backdrop-blur-sm shadow-lg hover:shadow-xl"
                  onClick={() => setConsultationOpen(true)}
                >
                  Book a Consultation
                </Button>
              </div>

              {/* Trust badges */}
              <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 pt-2">
                {[
                  { icon: Shield, text: 'FSCA Regulated · FSP 54606' },
                  { icon: Globe, text: 'Fiercely Independent' },
                  { icon: CheckCircle, text: '12+ Trusted Partners' },
                ].map(({ icon: Icon, text }) => (
                  <div key={text} className="flex items-center gap-1.5 text-gray-500">
                    <Icon className="h-3.5 w-3.5 text-purple-400/70 flex-shrink-0" />
                    <span className="text-[11px] sm:text-xs font-medium whitespace-nowrap">{text}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Stats strip */}
          <div className="relative z-10 border-t border-white/[0.06]">
            <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 xl:px-12">
              <div className="grid grid-cols-2 lg:grid-cols-4 divide-x divide-white/[0.06]">
                {STATS.map((stat) => (
                  <div key={stat.label} className="flex items-center gap-3 py-6 lg:py-7 justify-center group">
                    <div className="w-9 h-9 rounded-lg bg-purple-500/[0.08] flex items-center justify-center flex-shrink-0 group-hover:bg-purple-500/[0.14] transition-colors">
                      <stat.icon className="h-[18px] w-[18px] text-purple-400/80" />
                    </div>
                    <div>
                      <div className="text-lg sm:text-xl font-bold text-white tracking-tight leading-none">{stat.value}</div>
                      <div className="text-[11px] text-gray-500 font-medium mt-0.5">{stat.label}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ═══ ALL SERVICES GRID ═══ */}
        <section className="py-20 lg:py-24 section-white">
          <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 xl:px-12">
            <div className="text-center mb-14 lg:mb-16">
              <h2 className="text-black mb-4">Our Services</h2>
              <p className="text-gray-600 max-w-3xl mx-auto text-base lg:text-lg">
                Comprehensive wealth management solutions for every stage of your financial journey
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {SERVICES.map((service, index) => (
                <Card
                  key={service.id}
                  className="group bg-white border border-gray-200 shadow-sm hover:shadow-xl transition-all duration-300 overflow-hidden relative"
                  onMouseEnter={() => {
                    if (!service.imageKey) return;
                    prefetchImages([getOptimizedImageUrl(service.imageKey, 1024, 'webp')]);
                  }}
                >
                  {/* Badge */}
                  {service.badge && (
                    <Badge className="absolute top-3 right-3 z-10 bg-purple-600 hover:bg-purple-700 text-white text-[10px] font-semibold shadow-md">
                      {service.badge}
                    </Badge>
                  )}

                  {/* Image */}
                  <div className="relative aspect-[4/3] overflow-hidden">
                    {service.imageKey ? (
                      <ResponsiveImage
                        imageKey={service.imageKey}
                        fallbackSrc={service.image}
                        alt={service.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        loading={index < 4 ? 'eager' : 'lazy'}
                        fetchPriority={index === 0 ? 'high' : 'auto'}
                        sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, (max-width: 1280px) 33vw, 25vw"
                        width={400}
                        height={300}
                      />
                    ) : (
                      <ImageWithFallback
                        src={service.image}
                        alt={service.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        loading={index < 4 ? 'eager' : 'lazy'}
                      />
                    )}
                    {/* Icon badge */}
                    <div className="absolute top-3 left-3 w-10 h-10 bg-white rounded-lg shadow-sm flex items-center justify-center">
                      <service.icon className="h-5 w-5 text-primary" />
                    </div>
                    {/* Gradient overlay at bottom */}
                    <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/30 to-transparent pointer-events-none" />
                  </div>

                  {/* Content */}
                  <CardContent className="p-5 space-y-3">
                    <h3 className="text-gray-900 text-lg font-semibold leading-tight">{service.title}</h3>
                    <p className="text-gray-600 text-[13px] leading-relaxed line-clamp-3">{service.description}</p>

                    {/* Highlights */}
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {service.highlights.slice(0, 3).map((h) => (
                        <span
                          key={h}
                          className="inline-flex items-center text-[10px] font-medium text-purple-700 bg-purple-50 px-2 py-0.5 rounded-full"
                        >
                          {h}
                        </span>
                      ))}
                      {service.highlights.length > 3 && (
                        <span className="inline-flex items-center text-[10px] font-medium text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                          +{service.highlights.length - 3} more
                        </span>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2 pt-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 border-gray-200 text-gray-700 hover:border-primary hover:text-primary hover:bg-primary/5 transition-all duration-200 text-xs"
                        asChild
                      >
                        <Link to={service.path}>
                          Learn More
                          <ArrowRight className="ml-1.5 h-3 w-3 group-hover:translate-x-0.5 transition-transform duration-200" />
                        </Link>
                      </Button>
                      {/* Financial Planning is a holistic service without a dedicated quote wizard —
                          its "Get Quote" opens the consultation modal instead of routing to an
                          invalid /get-quote/financial-planning slug (not in QuoteServiceId). */}
                      {service.id === 'financial-planning' ? (
                        <Button
                          size="sm"
                          className="bg-primary text-primary-foreground hover:bg-primary/90 transition-all duration-200 text-xs px-4"
                          onClick={() => setConsultationOpen(true)}
                        >
                          Book Consult
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          className="bg-primary text-primary-foreground hover:bg-primary/90 transition-all duration-200 text-xs px-4"
                          asChild
                        >
                          <Link to={`/get-quote/${service.quoteSlug}`}>
                            Get Quote
                          </Link>
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* ═══ WHY CHOOSE US ═══ */}
        <section className="py-20 lg:py-24 section-dark-gray">
          <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 xl:px-12">
            <div className="text-center mb-14 lg:mb-16">
              <h2 className="text-white mb-4">Why Choose Navigate Wealth?</h2>
              <p className="text-gray-300 max-w-2xl mx-auto text-base lg:text-lg">
                We exist to give you access to the best financial products and unbiased advice — because your goals deserve nothing less.
              </p>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-8">
              {WHY_US.map((item) => (
                <div key={item.title} className="group text-center space-y-4 p-6 rounded-xl bg-white/[0.04] border border-white/[0.06] hover:bg-white/[0.07] hover:border-white/[0.1] transition-all duration-300">
                  <div className="w-14 h-14 bg-primary/15 rounded-xl flex items-center justify-center mx-auto group-hover:bg-primary/25 transition-colors">
                    <item.icon className="h-7 w-7 text-purple-400" />
                  </div>
                  <h3 className="text-white text-base font-semibold">{item.title}</h3>
                  <p className="text-gray-400 text-sm leading-relaxed">{item.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ═══ HOW WE WORK — PROCESS STEPS ═══ */}
        <section className="py-20 lg:py-24 section-white">
          <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 xl:px-12">
            <div className="text-center mb-14 lg:mb-16">
              <h2 className="text-black mb-4">How We Work</h2>
              <p className="text-gray-600 max-w-2xl mx-auto text-base lg:text-lg">
                A simple, transparent process designed to put your financial goals at the centre of every decision.
              </p>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-8">
              {PROCESS_STEPS.map((step, index) => (
                <div key={step.step} className="relative group">
                  {/* Connector line (desktop only) */}
                  {index < PROCESS_STEPS.length - 1 && (
                    <div className="hidden lg:block absolute top-10 left-[calc(50%+2rem)] w-[calc(100%-3rem)] h-[2px] bg-gradient-to-r from-purple-200 to-purple-100 pointer-events-none" />
                  )}

                  <div className="text-center space-y-4 p-6 rounded-xl border border-gray-100 hover:border-primary/20 hover:shadow-lg transition-all duration-300 bg-white">
                    {/* Step number */}
                    <div className="relative mx-auto">
                      <div className="w-14 h-14 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto group-hover:bg-primary/15 transition-colors">
                        <span className="text-lg font-bold text-primary">{step.step}</span>
                      </div>
                    </div>
                    <h3 className="text-gray-900 text-base font-semibold">{step.title}</h3>
                    <p className="text-gray-600 text-sm leading-relaxed">{step.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ═══ CTA SECTION ═══ */}
        <section className="relative py-16 sm:py-20 overflow-hidden bg-[#1e2035]">
          {/* Background decoration */}
          <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
            <div className="absolute top-0 right-0 w-[600px] h-[600px] rounded-full bg-primary/10 blur-[120px] -translate-y-1/3 translate-x-1/4" />
            <div className="absolute bottom-0 left-0 w-[400px] h-[400px] rounded-full bg-primary/8 blur-[100px] translate-y-1/3 -translate-x-1/4" />
          </div>

          <div className="relative z-10 max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 xl:px-12">
            <div className="max-w-3xl mx-auto text-center space-y-8">
              <div className="space-y-4">
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/15 border border-primary/20">
                  <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                  <span className="text-xs font-medium text-gray-300">Free initial consultation</span>
                </div>
                <h2 className="!text-[28px] sm:!text-[32px] !font-bold !leading-tight text-white">
                  Ready to Take the First Step?
                </h2>
                <p className="text-gray-400 text-base max-w-xl mx-auto leading-relaxed">
                  Schedule a complimentary, no-obligation consultation to discuss how our services can help you reach your financial goals.
                </p>
              </div>

              {/* CTA buttons */}
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button
                  size="lg"
                  className="bg-primary text-primary-foreground hover:bg-primary/90 hover:scale-105 transform transition-all duration-200 px-8 shadow-lg hover:shadow-xl"
                  onClick={() => setConsultationOpen(true)}
                >
                  Schedule Consultation
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  className="border-primary/80 bg-primary/10 text-white hover:bg-primary/20 hover:border-primary hover:text-white hover:scale-105 transform transition-all duration-200 px-8 backdrop-blur-sm shadow-lg hover:shadow-xl"
                  asChild
                >
                  <Link to="/get-quote">Get a Free Quote</Link>
                </Button>
              </div>

              {/* Contact strip */}
              <div className="flex flex-col sm:flex-row gap-6 sm:gap-8 justify-center pt-4">
                <a href="tel:+27126672505" className="flex items-center gap-2.5 group justify-center">
                  <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center group-hover:bg-primary/30 transition-colors">
                    <Phone className="h-4 w-4 text-purple-400" />
                  </div>
                  <div className="text-left">
                    <div className="text-[11px] text-gray-500 font-medium uppercase tracking-wider">Call us</div>
                    <div className="text-sm text-white font-medium">+27 12 667 2505</div>
                  </div>
                </a>
                <a href="mailto:info@navigatewealth.co" className="flex items-center gap-2.5 group justify-center">
                  <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center group-hover:bg-primary/30 transition-colors">
                    <Mail className="h-4 w-4 text-purple-400" />
                  </div>
                  <div className="text-left">
                    <div className="text-[11px] text-gray-500 font-medium uppercase tracking-wider">Email</div>
                    <div className="text-sm text-white font-medium">info@navigatewealth.co</div>
                  </div>
                </a>
                <div className="flex items-center gap-2.5 justify-center">
                  <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center">
                    <MapPin className="h-4 w-4 text-purple-400" />
                  </div>
                  <div className="text-left">
                    <div className="text-[11px] text-gray-500 font-medium uppercase tracking-wider">Office</div>
                    <div className="text-sm text-white font-medium">Irene, Centurion</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* Consultation booking modal */}
      <ConsultationModal
        open={consultationOpen}
        onOpenChange={setConsultationOpen}
      />
    </div>
  );
}