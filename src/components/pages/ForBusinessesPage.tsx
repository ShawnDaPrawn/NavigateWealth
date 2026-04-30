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
  Building,
  Shield,
  Users,
  DollarSign,
  Calculator,
  Globe,
  ArrowRight,
  CheckCircle,
  TrendingUp,
  Trophy,
  BarChart3,
  FileText,
  Smartphone,
  HeadphonesIcon,
  Monitor,
  Calendar,
  ChevronRight,
  Sparkles,
  PieChart,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Data
// ---------------------------------------------------------------------------

const services = [
  {
    title: 'Employee Benefits',
    description: 'Comprehensive group health plans, retirement schemes, and employee benefit packages.',
    icon: Users,
    link: '/employee-benefits',
    features: ['Group health insurance', 'Retirement benefits', 'Wellness programs'],
    accent: 'from-blue-500 to-indigo-600',
    accentLight: 'bg-blue-50 text-blue-600',
  },
  {
    title: 'Cash Management',
    description: 'Optimize cash flow, liquidity management, and working capital solutions.',
    icon: DollarSign,
    link: '/cash-management',
    features: ['Cash flow optimization', 'Liquidity management', 'Working capital'],
    accent: 'from-emerald-500 to-teal-600',
    accentLight: 'bg-emerald-50 text-emerald-600',
  },
  {
    title: 'Risk Management',
    description: 'Comprehensive business insurance and risk protection strategies.',
    icon: Shield,
    link: '/risk-management',
    features: ['Business insurance', 'Key person cover', 'Professional indemnity'],
    accent: 'from-rose-500 to-pink-600',
    accentLight: 'bg-rose-50 text-rose-600',
  },
  {
    title: 'Investment Solutions',
    description: 'Corporate treasury management and investment portfolio optimization.',
    icon: PieChart,
    link: '/investment-management',
    features: ['Corporate treasury', 'Investment portfolios', 'Asset allocation'],
    accent: 'from-violet-500 to-purple-600',
    accentLight: 'bg-violet-50 text-violet-600',
  },
  {
    title: 'Tax Planning',
    description: 'Corporate tax optimization, compliance, and strategic tax planning.',
    icon: Calculator,
    link: '/tax-planning',
    features: ['Corporate tax strategy', 'SARS compliance', 'Tax optimization'],
    accent: 'from-amber-500 to-orange-600',
    accentLight: 'bg-amber-50 text-amber-600',
  },
  {
    title: 'Forex & Trade Finance',
    description: 'Foreign exchange services, currency hedging, and international trade finance.',
    icon: Globe,
    link: '/forex-services',
    features: ['Currency hedging', 'Forex transactions', 'Trade finance'],
    accent: 'from-cyan-500 to-blue-600',
    accentLight: 'bg-cyan-50 text-cyan-600',
  },
];

const businessStages = [
  { icon: Building, title: 'Startup', description: 'Launch phase' },
  { icon: TrendingUp, title: 'Growth', description: 'Scaling up' },
  { icon: Users, title: 'Expansion', description: 'Market presence' },
  { icon: Trophy, title: 'Maturity', description: 'Market leader' },
  { icon: Globe, title: 'Global', description: 'International' },
];

const stats = [
  { value: '500+', label: 'Business Clients', icon: Building },
  { value: 'R2B+', label: 'Corporate Assets Managed', icon: BarChart3 },
  { value: '50+', label: 'Partner Providers', icon: Shield },
];

const digitalFeatures = [
  { icon: Smartphone, title: 'Mobile Access', description: 'Manage your business finances from any device, anywhere' },
  { icon: Monitor, title: 'Dashboard', description: 'Real-time insights into your corporate portfolio and benefits' },
  { icon: FileText, title: 'Reporting', description: 'Detailed analytics and compliance reporting on demand' },
  { icon: HeadphonesIcon, title: 'Dedicated Support', description: 'Expert advisers assigned to your business for proactive guidance' },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ForBusinessesPage() {
  const [showQuoteModal, setShowQuoteModal] = useState(false);
  const [showConsultationModal, setShowConsultationModal] = useState(false);

  return (
    <div className="min-h-screen bg-gray-50">
      <SEO {...getSEOData('for-businesses')} structuredData={createWebPageSchema(getSEOData('for-businesses').title, getSEOData('for-businesses').description, getSEOData('for-businesses').canonicalUrl)} />

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
              <span className="text-[12px] font-medium text-gray-400 tracking-wide">Corporate Financial Solutions</span>
            </div>

            <div className="max-w-3xl space-y-5">
              <h1 className="!text-[clamp(2rem,5vw,3.5rem)] !font-extrabold !leading-[1.1] text-white tracking-tight">
                Financial Solutions{' '}
                <span className="bg-gradient-to-r from-purple-400 to-violet-300 bg-clip-text text-transparent">for Businesses</span>
              </h1>
              <p className="text-gray-400 text-base sm:text-lg max-w-2xl mx-auto leading-relaxed">
                We partner with businesses of all sizes to deliver comprehensive financial solutions that drive stability and growth — from employee benefits and cash management to risk protection and tax optimization.
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
      {/* BUSINESS STAGES                                                    */}
      {/* ================================================================== */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16 lg:py-20">
        <div className="grid lg:grid-cols-2 gap-10 sm:gap-12 lg:gap-16 items-center">
          <div className="space-y-8">
            <div className="space-y-4">
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-semibold text-gray-900 leading-tight">
                Your Strategic Financial Partner at Every Stage
              </h2>
              <p className="text-base sm:text-lg text-gray-600 leading-relaxed">
                Every business has unique financial challenges and opportunities. Whether you're a startup looking to establish financial foundations, a growing company needing employee benefits, or an established enterprise seeking to optimize corporate treasury — we provide the expertise and solutions to support your journey at every stage.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              {businessStages.map((stage, i) => (
                <div key={i} className="flex items-center gap-3 bg-white border border-gray-200 rounded-full px-4 py-2.5 shadow-sm">
                  <div className="w-9 h-9 rounded-full bg-purple-100 flex items-center justify-center flex-shrink-0">
                    <stage.icon className="h-4.5 w-4.5 text-purple-600" />
                  </div>
                  <div className="leading-tight">
                    <span className="text-sm font-semibold text-gray-900">{stage.title}</span>
                    <span className="text-xs text-gray-500 block">{stage.description}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="relative">
            <div className="aspect-[4/3] rounded-xl sm:rounded-2xl overflow-hidden shadow-xl">
              <ImageWithFallback
                src="https://images.unsplash.com/photo-1760346546771-a81d986459ff?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxjb3Jwb3JhdGUlMjBidXNpbmVzcyUyMHRlYW0lMjBtZWV0aW5nJTIwc3RyYXRlZ3l8ZW58MXx8fHwxNzcxOTMxMTI1fDA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral"
                alt="Corporate business team discussing financial strategy"
                className="w-full h-full object-cover"
              />
            </div>
            <div className="absolute -bottom-4 -right-4 w-24 h-24 bg-purple-200 rounded-2xl -z-10 hidden sm:block" />
          </div>
        </div>
      </section>

      {/* ================================================================== */}
      {/* SERVICES                                                           */}
      {/* ================================================================== */}
      <section className="bg-white py-12 sm:py-16 lg:py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-10 sm:mb-14">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-semibold text-gray-900 mb-4">
              Comprehensive Business Solutions
            </h2>
            <p className="text-base sm:text-lg text-gray-600 leading-relaxed">
              Integrated financial services across every key area of business finance.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {services.map((service, index) => {
              const Icon = service.icon;
              return (
                <Link key={index} to={service.link} className="group block">
                  <Card className="h-full border border-gray-200 shadow-sm hover:shadow-lg hover:border-purple-200 transition-all duration-300 hover:-translate-y-0.5 overflow-hidden">
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
      {/* ENTERPRISE EXPERTISE — accent strip                                */}
      {/* ================================================================== */}
      <section className="relative overflow-hidden section-dark-gray text-white py-12 sm:py-16 lg:py-20">
        <div className="absolute -top-32 -right-32 w-[360px] h-[360px] rounded-full bg-white/5 pointer-events-none" />
        <div className="absolute -bottom-20 -left-20 w-[280px] h-[280px] rounded-full bg-white/5 pointer-events-none" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl mx-auto text-center space-y-6 sm:space-y-8">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-semibold leading-tight">
              Enterprise-Level Expertise with Personal Service
            </h2>
            <p className="text-base sm:text-lg text-white/80 leading-relaxed">
              Our business clients benefit from Navigate Wealth's institutional experience and provider relationships, while receiving the dedicated attention and tailored solutions your business deserves.
            </p>
            <div className="pt-4">
              <Button
                size="lg"
                className="bg-purple-600 hover:bg-purple-700 text-white font-semibold px-8 shadow-lg hover:shadow-xl transition-all"
                onClick={() => setShowConsultationModal(true)}
              >
                <Calendar className="mr-2 h-5 w-5" />
                Schedule a Business Consultation
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* ================================================================== */}
      {/* DIGITAL PLATFORM                                                   */}
      {/* ================================================================== */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16 lg:py-20">
        <div className="grid lg:grid-cols-2 gap-10 sm:gap-12 lg:gap-16 items-center">
          <div className="relative order-2 lg:order-1">
            <div className="aspect-[4/3] rounded-xl sm:rounded-2xl overflow-hidden shadow-xl">
              <ImageWithFallback
                src="https://images.unsplash.com/photo-1551288049-bebda4e38f71?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxtb2Rlcm4lMjBvZmZpY2UlMjBkYXNoYm9hcmQlMjBhbmFseXRpY3MlMjBzY3JlZW58ZW58MXx8fHwxNzcxOTMxMTI1fDA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral"
                alt="Modern office dashboard with analytics"
                className="w-full h-full object-cover"
              />
            </div>
            <div className="absolute -top-4 -left-4 w-24 h-24 bg-blue-200 rounded-2xl -z-10 hidden sm:block" />
          </div>

          <div className="order-1 lg:order-2 space-y-8">
            <div className="space-y-4">
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-semibold text-gray-900 leading-tight">
                Modern Technology, Expert Partnership
              </h2>
              <p className="text-base sm:text-lg text-gray-600 leading-relaxed">
                Navigate Wealth combines cutting-edge financial technology with deep business expertise. Through our dedicated business portal, you can manage policies, access reports, and communicate with your financial team.
              </p>
              <p className="text-gray-500 leading-relaxed">
                Our experienced advisers provide strategic guidance and proactive support so you can focus on what matters most — your business.
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
      {/* CTA                                                                */}
      {/* ================================================================== */}
      <section className="bg-white border-t border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 sm:py-20">
          <div className="max-w-3xl mx-auto text-center space-y-6 sm:space-y-8">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-semibold text-gray-900">
              Ready to Optimize Your Business Finances?
            </h2>
            <p className="text-base sm:text-lg text-gray-600 leading-relaxed">
              Whether you're looking to enhance employee benefits, optimize cash flow, or develop a comprehensive risk management strategy, our business financial experts are here to help you succeed.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-6">
              <Button
                size="lg"
                className="bg-purple-600 hover:bg-purple-700 text-white font-semibold px-8 shadow-lg hover:shadow-xl transition-all"
                onClick={() => setShowQuoteModal(true)}
              >
                Get Your Business Quote
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

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-6 pt-6 text-sm text-gray-400">
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
                Business expertise
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

export default ForBusinessesPage;
