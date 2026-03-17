import React, { useState } from 'react';
import { Link } from 'react-router';
import { SEO, createWebPageSchema } from '../seo/SEO';
import { getSEOData } from '../seo/seo-config';
import { Button } from '../ui/button';
import { Card, CardContent } from '../ui/card';
import { Badge } from '../ui/badge';
import { ImageWithFallback } from '../figma/ImageWithFallback';
import { GetQuoteModal } from '../modals/GetQuoteModal';
import { ConsultationModal } from '../modals/ConsultationModal';
import { 
  Heart,
  Shield, 
  DollarSign,
  TrendingUp,
  ArrowRight,
  CheckCircle,
  Trophy,
  FileText,
  Briefcase,
  Home,
  Baby,
  GraduationCap,
  Banknote,
  Globe,
  Smartphone,
  HeadphonesIcon,
  Monitor,
  Calendar,
  ChevronRight,
  Sparkles
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Data — identical content to legacy, restructured for the new layout
// ---------------------------------------------------------------------------

const services = [
  {
    title: 'Medical Aid & Gap Cover',
    description: "Access South Africa's leading medical schemes and products with comprehensive gap cover protection.",
    icon: Heart,
    link: '/medical-aid',
    features: ['Top medical schemes', 'Gap cover options', 'Specialist networks'],
    accent: 'from-rose-500 to-pink-600',
    accentLight: 'bg-rose-50 text-rose-600',
  },
  {
    title: 'Life, Disability & Severe Illness Cover',
    description: 'Protecting your income and your loved ones with comprehensive risk management solutions.',
    icon: Shield,
    link: '/risk-management',
    features: ['Income protection', 'Family security', 'Critical illness cover'],
    accent: 'from-blue-500 to-indigo-600',
    accentLight: 'bg-blue-50 text-blue-600',
  },
  {
    title: 'Retirement Planning',
    description: 'Build a future you can count on with proven investment platforms and retirement strategies.',
    icon: Trophy,
    link: '/retirement-planning',
    features: ['Investment platforms', 'Retirement annuities', 'Pension funds'],
    accent: 'from-amber-500 to-orange-600',
    accentLight: 'bg-amber-50 text-amber-600',
  },
  {
    title: 'Investments (Local & Offshore)',
    description: 'Diversify your wealth and hedge against rand depreciation with local and international investments.',
    icon: TrendingUp,
    link: '/investment-management',
    features: ['Local investments', 'Offshore diversification', 'Currency hedging'],
    accent: 'from-emerald-500 to-teal-600',
    accentLight: 'bg-emerald-50 text-emerald-600',
  },
  {
    title: 'Estate Planning',
    description: 'Wills, trusts, and tax-efficient transfer of your legacy to the next generation.',
    icon: FileText,
    link: '/estate-planning',
    features: ['Will drafting', 'Trust structures', 'Tax efficiency'],
    accent: 'from-violet-500 to-purple-600',
    accentLight: 'bg-violet-50 text-violet-600',
  },
  {
    title: 'Tax Planning',
    description: 'Optimize your tax strategy and minimize liability through expert planning and compliance.',
    icon: DollarSign,
    link: '/tax-planning',
    features: ['Tax optimization', 'SARS compliance', 'Strategic planning'],
    accent: 'from-cyan-500 to-blue-600',
    accentLight: 'bg-cyan-50 text-cyan-600',
  },
];

const lifeMilestones = [
  { icon: Briefcase, title: 'First Job', description: 'Starting your career' },
  { icon: Home, title: 'First Home', description: 'Purchasing property' },
  { icon: Heart, title: 'Marriage', description: 'Building together' },
  { icon: Baby, title: 'Children', description: 'Growing family' },
  { icon: GraduationCap, title: 'Retirement', description: 'Enjoying freedom' },
];

const stats = [
  { value: 'R500M+', label: 'Assets Under Advisement', icon: Banknote },
  { value: '100+', label: 'Clients Across SA & Abroad', icon: Globe },
  { value: 'R1B+', label: 'Life Assurance Coverage', icon: Shield },
];

const digitalFeatures = [
  { icon: Smartphone, title: 'Mobile Access', description: 'Manage your finances on the go from any device' },
  { icon: Monitor, title: 'Client Portal', description: 'View all policies, statements and documents in one place' },
  { icon: FileText, title: 'Document Access', description: 'Download and sign documents instantly — no paperwork' },
  { icon: HeadphonesIcon, title: 'Personal Support', description: 'Real human advice from a dedicated financial adviser' },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ForIndividualsPage() {
  const [showQuoteModal, setShowQuoteModal] = useState(false);
  const [showConsultationModal, setShowConsultationModal] = useState(false);

  return (
    <div className="min-h-screen bg-gray-50">
      <SEO {...getSEOData('for-individuals')} structuredData={createWebPageSchema(getSEOData('for-individuals').title, getSEOData('for-individuals').description, getSEOData('for-individuals').canonicalUrl)} />

      {/* ================================================================== */}
      {/* HERO                                                               */}
      {/* ================================================================== */}
      <section className="relative overflow-hidden bg-[#111827]" aria-label="Hero">
        <div className="absolute inset-0 bg-gradient-to-b from-[#111827] via-[#161b33] to-[#111827] pointer-events-none" />
        <div className="absolute top-0 right-0 w-[600px] h-[600px] rounded-full opacity-20 pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(109,40,217,0.25) 0%, transparent 70%)' }} />

        <div className="relative z-10 max-w-screen-xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col items-center text-center py-20 lg:py-28">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/[0.06] border border-white/[0.08] mb-8">
              <Sparkles className="h-3.5 w-3.5 text-purple-400" />
              <span className="text-[12px] font-medium text-gray-400 tracking-wide">Independent Financial Advice</span>
            </div>

            <div className="max-w-3xl space-y-5">
              <h1 className="!text-[clamp(2rem,5vw,3.5rem)] !font-extrabold !leading-[1.1] text-white tracking-tight">
                Financial Planning{' '}
                <span className="bg-gradient-to-r from-purple-400 to-violet-300 bg-clip-text text-transparent">for Individuals</span>
              </h1>
              <p className="text-gray-400 text-base sm:text-lg max-w-2xl mx-auto leading-relaxed">
                We help you make smart, confident financial decisions — whether you're starting out, growing your career, protecting your family, or planning for retirement.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 mt-10">
              <Button
                size="lg"
                className="bg-primary text-primary-foreground hover:bg-primary/90 transition-colors duration-200 px-8 h-12 shadow-lg shadow-purple-600/20"
                asChild
              >
                <Link to="/signup">
                  Get Started
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Link>
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="border-purple-400/30 bg-transparent text-purple-300 hover:bg-purple-500/15 hover:border-purple-400/50 hover:text-purple-200 transition-colors duration-200 px-8 h-12"
                onClick={() => setShowConsultationModal(true)}
              >
                Book a Consultation
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* ================================================================== */}
      {/* STATS BAR                                                          */}
      {/* ================================================================== */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-8 sm:-mt-10 relative z-10 mb-10 sm:mb-16">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
          {stats.map((stat, idx) => (
            <Card key={idx} className="border-0 shadow-lg hover:shadow-xl transition-shadow">
              <CardContent className="flex items-center gap-4 sm:gap-5 p-5 sm:p-6">
                <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl bg-purple-100 flex items-center justify-center flex-shrink-0">
                  <stat.icon className="h-6 w-6 sm:h-7 sm:w-7 text-purple-600" />
                </div>
                <div>
                  <div className="text-2xl font-bold text-gray-900">{stat.value}</div>
                  <div className="text-sm text-gray-500">{stat.label}</div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* ================================================================== */}
      {/* LIFE MILESTONES — horizontal journey strip                        */}
      {/* ================================================================== */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16 lg:py-20">
        <div className="grid lg:grid-cols-2 gap-10 sm:gap-12 lg:gap-16 items-center">
          <div className="space-y-8">
            <div className="space-y-4">
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-semibold text-gray-900 leading-tight">
                Your Financial Partner in Every Season
              </h2>
              <p className="text-base sm:text-lg text-gray-600 leading-relaxed">
                Life comes with milestones — first job, first home, marriage, children, and eventually retirement. At each stage, your financial needs evolve. We partner with you for the long term, helping you adapt your plan as your life changes. Our independence means we're not tied to one provider, so you get the best product fit for your personal goals.
              </p>
            </div>

            {/* Milestone timeline — horizontal on md+, stacked on mobile */}
            <div className="flex flex-wrap gap-3">
              {lifeMilestones.map((m, i) => (
                <div key={i} className="flex items-center gap-3 bg-white border border-gray-200 rounded-full px-4 py-2.5 shadow-sm">
                  <div className="w-9 h-9 rounded-full bg-purple-100 flex items-center justify-center flex-shrink-0">
                    <m.icon className="h-4.5 w-4.5 text-purple-600" />
                  </div>
                  <div className="leading-tight">
                    <span className="text-sm font-semibold text-gray-900">{m.title}</span>
                    <span className="text-xs text-gray-500 block">{m.description}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Image */}
          <div className="relative">
            <div className="aspect-[4/3] rounded-xl sm:rounded-2xl overflow-hidden shadow-xl">
              <ImageWithFallback
                src="https://images.unsplash.com/photo-1758686254550-c5d8f4de1b3a?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxmYW1pbHklMjBmaW5hbmNpYWwlMjBwbGFubmluZyUyMGNvbnN1bHRhdGlvbnxlbnwxfHx8fDE3NzE5Mjk5ODF8MA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral"
                alt="Family financial planning consultation"
                className="w-full h-full object-cover"
              />
            </div>
            {/* Decorative accent */}
            <div className="absolute -bottom-4 -right-4 w-24 h-24 bg-purple-200 rounded-2xl -z-10 hidden sm:block" />
          </div>
        </div>
      </section>

      {/* ================================================================== */}
      {/* SERVICES — clean card grid                                        */}
      {/* ================================================================== */}
      <section className="bg-white py-12 sm:py-16 lg:py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-10 sm:mb-14">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-semibold text-gray-900 mb-4">
              Comprehensive Services
            </h2>
            <p className="text-base sm:text-lg text-gray-600 leading-relaxed">
              We provide advice and solutions across every key area of personal finance.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {services.map((service, index) => {
              const Icon = service.icon;
              return (
                <Link key={index} to={service.link} className="group block">
                  <Card className="h-full border border-gray-200 shadow-sm hover:shadow-lg hover:border-purple-200 transition-all duration-300 hover:-translate-y-0.5 overflow-hidden">
                    {/* Top accent bar */}
                    <div className={`h-1 bg-gradient-to-r ${service.accent}`} />
                    <CardContent className="p-6 space-y-4">
                      <div className="flex items-start justify-between">
                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${service.accentLight}`}>
                          <Icon className="h-6 w-6" />
                        </div>
                        <ChevronRight className="h-5 w-5 text-gray-300 group-hover:text-purple-500 group-hover:translate-x-0.5 transition-all duration-300 mt-1" />
                      </div>

                      <div>
                        <h3 className="text-lg font-semibold text-gray-900 mb-2 group-hover:text-purple-700 transition-colors">
                          {service.title}
                        </h3>
                        <p className="text-sm text-gray-600 leading-relaxed mb-4">
                          {service.description}
                        </p>
                      </div>

                      <ul className="space-y-2">
                        {service.features.map((feature, idx) => (
                          <li key={idx} className="flex items-center text-sm text-gray-500">
                            <CheckCircle className="h-4 w-4 text-purple-500 mr-2 flex-shrink-0" />
                            {feature}
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      {/* ================================================================== */}
      {/* INDEPENDENT ADVICE — full-width accent strip                     */}
      {/* ================================================================== */}
      <section className="relative overflow-hidden section-dark-gray text-white py-12 sm:py-16 lg:py-20">
        <div className="absolute -top-32 -right-32 w-[360px] h-[360px] rounded-full bg-white/5 pointer-events-none" />
        <div className="absolute -bottom-20 -left-20 w-[280px] h-[280px] rounded-full bg-white/5 pointer-events-none" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl mx-auto text-center space-y-6 sm:space-y-8">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-semibold leading-tight">
              Independent Advice Backed by Scale
            </h2>
            <p className="text-base sm:text-lg text-white/80 leading-relaxed">
              Our clients benefit from Navigate Wealth's scale and experience. These numbers mean we have negotiating power with providers, while you still receive the personalised attention of a boutique, independent adviser.
            </p>
            <div className="pt-4">
              <Button
                size="lg"
                className="bg-purple-600 hover:bg-purple-700 text-white font-semibold px-8 shadow-lg hover:shadow-xl transition-all"
                onClick={() => setShowConsultationModal(true)}
              >
                <Calendar className="mr-2 h-5 w-5" />
                Schedule a Free Consultation
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* ================================================================== */}
      {/* DIGITAL PLATFORM — image + feature cards                          */}
      {/* ================================================================== */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16 lg:py-20">
        <div className="grid lg:grid-cols-2 gap-10 sm:gap-12 lg:gap-16 items-center">
          {/* Image first on desktop (order swap) */}
          <div className="relative order-2 lg:order-1">
            <div className="aspect-[4/3] rounded-xl sm:rounded-2xl overflow-hidden shadow-xl">
              <ImageWithFallback
                src="https://images.unsplash.com/photo-1758523668695-7c5192459dc6?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxwZXJzb24lMjB1c2luZyUyMHRhYmxldCUyMGRpZ2l0YWwlMjBiYW5raW5nfGVufDF8fHx8MTc3MTkyOTk4MXww&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral"
                alt="Person using digital banking platform on tablet"
                className="w-full h-full object-cover"
              />
            </div>
            <div className="absolute -top-4 -left-4 w-24 h-24 bg-blue-200 rounded-2xl -z-10 hidden sm:block" />
          </div>

          <div className="order-1 lg:order-2 space-y-8">
            <div className="space-y-4">
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-semibold text-gray-900 leading-tight">
                Digital Convenience, Human Touch
              </h2>
              <p className="text-base sm:text-lg text-gray-600 leading-relaxed">
                Navigate Wealth combines a state-of-the-art digital platform with the reassurance of real-world advice. Through your online client portal you can view policies, access documents, and communicate with us anytime, anywhere.
              </p>
              <p className="text-gray-500 leading-relaxed">
                Behind the tech, we're real people who take the time to understand you and guide you — because great financial advice is both smart and personal.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {digitalFeatures.map((feat, i) => {
                const FIcon = feat.icon;
                return (
                  <div key={i} className="flex items-start gap-4 bg-gray-50 rounded-xl p-4 border border-gray-100">
                    <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center flex-shrink-0">
                      <FIcon className="h-5 w-5 text-purple-600" />
                    </div>
                    <div>
                      <div className="font-semibold text-gray-900 text-sm">{feat.title}</div>
                      <div className="text-gray-500 text-xs leading-relaxed mt-0.5">{feat.description}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* ================================================================== */}
      {/* CTA — clean bottom section                                        */}
      {/* ================================================================== */}
      <section className="bg-white border-t border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 sm:py-20">
          <div className="max-w-3xl mx-auto text-center space-y-6 sm:space-y-8">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-semibold text-gray-900">
              Ready to Take Control of Your Financial Future?
            </h2>
            <p className="text-base sm:text-lg text-gray-600 leading-relaxed">
              Whether you're just starting out or planning for retirement, we're here to help you make smart, confident financial decisions every step of the way.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-6">
              <Button
                size="lg"
                className="bg-purple-600 hover:bg-purple-700 text-white font-semibold px-8 shadow-lg hover:shadow-xl transition-all"
                onClick={() => setShowQuoteModal(true)}
              >
                Get Started
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="border-gray-300 text-gray-700 hover:bg-gray-50 font-medium px-8"
                onClick={() => setShowConsultationModal(true)}
              >
                <Calendar className="mr-2 h-5 w-5" />
                Book Consultation
              </Button>
            </div>

            <div className="flex items-center justify-center gap-6 pt-6 text-sm text-gray-400">
              <span className="flex items-center gap-1.5">
                <CheckCircle className="h-4 w-4 text-green-500" />
                Free consultation
              </span>
              <span className="flex items-center gap-1.5">
                <CheckCircle className="h-4 w-4 text-green-500" />
                No obligation
              </span>
              <span className="flex items-center gap-1.5">
                <CheckCircle className="h-4 w-4 text-green-500" />
                Expert advice
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Modals */}
      <GetQuoteModal 
        isOpen={showQuoteModal} 
        onClose={() => setShowQuoteModal(false)} 
      />
      <ConsultationModal 
        isOpen={showConsultationModal} 
        onClose={() => setShowConsultationModal(false)} 
      />
    </div>
  );
}