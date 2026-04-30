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
  Users,
  Shield,
  Award,
  Calculator,
  Target,
  Building,
  ArrowRight,
  CheckCircle,
  TrendingUp,
  Trophy,
  HandHeart,
  FileText,
  Smartphone,
  HeadphonesIcon,
  Monitor,
  Calendar,
  Banknote,
  ChevronRight,
  Sparkles,
  Briefcase,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Data
// ---------------------------------------------------------------------------

const services = [
  {
    title: 'Succession Planning',
    description: 'Smooth practice transitions that preserve client relationships and unlock ongoing revenue streams.',
    icon: Users,
    link: '/succession-planning',
    features: ['Client relationship preservation', 'Revenue stream continuity', 'Transition management'],
    accent: 'from-blue-500 to-indigo-600',
    accentLight: 'bg-blue-50 text-blue-600',
  },
  {
    title: 'Legacy Planning',
    description: 'Structure your firm to honor professional standards and ensure multi-generational continuity.',
    icon: HandHeart,
    link: '/legacy-planning',
    features: ['Professional standards', 'Multi-generational solutions', 'Service continuity'],
    accent: 'from-violet-500 to-purple-600',
    accentLight: 'bg-violet-50 text-violet-600',
  },
  {
    title: 'Practice Valuation',
    description: 'Professional practice appraisals and comprehensive assessments for informed decision-making.',
    icon: Calculator,
    link: '/practice-valuation',
    features: ['Professional valuations', 'Market assessments', 'Deal structuring'],
    accent: 'from-amber-500 to-orange-600',
    accentLight: 'bg-amber-50 text-amber-600',
  },
  {
    title: 'Practice Sales',
    description: 'Comprehensive guidance on valuations, deal structures, and seamless client handovers.',
    icon: Building,
    link: '/practice-sales',
    features: ['Fair valuations', 'Transparent deals', 'Client handovers'],
    accent: 'from-emerald-500 to-teal-600',
    accentLight: 'bg-emerald-50 text-emerald-600',
  },
  {
    title: 'Client Transitions',
    description: 'Seamless client relationship transfers that maintain service quality and trust.',
    icon: Target,
    link: '/client-transitions',
    features: ['Relationship transfers', 'Service quality', 'Trust preservation'],
    accent: 'from-rose-500 to-pink-600',
    accentLight: 'bg-rose-50 text-rose-600',
  },
  {
    title: 'Risk Management',
    description: 'Protect your practice from unforeseen circumstances with comprehensive coverage.',
    icon: Shield,
    link: '/risk-management',
    features: ['Practice protection', 'Key person cover', 'Business continuity'],
    accent: 'from-cyan-500 to-blue-600',
    accentLight: 'bg-cyan-50 text-cyan-600',
  },
];

const practiceStages = [
  { icon: Briefcase, title: 'Early Career', description: 'Building practice' },
  { icon: TrendingUp, title: 'Growing', description: 'Expanding client base' },
  { icon: Trophy, title: 'Established', description: 'Mature practice' },
  { icon: Target, title: 'Planning Exit', description: 'Succession focus' },
  { icon: Award, title: 'Retirement', description: 'Legacy secured' },
];

const stats = [
  { value: '25+', label: 'Years Advisory Experience', icon: Award },
  { value: 'R1B+', label: 'Practice Transitions Managed', icon: Banknote },
  { value: '100%', label: 'Client Retention Rate', icon: Shield },
];

const digitalFeatures = [
  { icon: Smartphone, title: 'Digital Tools', description: 'Track every step of your transition from any device' },
  { icon: Monitor, title: 'Client Portal', description: 'Secure access for all parties throughout the handover' },
  { icon: FileText, title: 'Documentation', description: 'Complete compliance records and audit trails maintained' },
  { icon: HeadphonesIcon, title: 'Personal Service', description: 'Dedicated support team from planning through completion' },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ForAdvisersPage() {
  const [showQuoteModal, setShowQuoteModal] = useState(false);
  const [showConsultationModal, setShowConsultationModal] = useState(false);

  return (
    <div className="min-h-screen bg-gray-50">
      <SEO {...getSEOData('for-advisers')} structuredData={createWebPageSchema(getSEOData('for-advisers').title, getSEOData('for-advisers').description, getSEOData('for-advisers').canonicalUrl)} />

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
              <span className="text-[12px] font-medium text-gray-400 tracking-wide">Succession & Practice Management</span>
            </div>

            <div className="max-w-3xl space-y-5">
              <h1 className="!text-[clamp(2rem,5vw,3.5rem)] !font-extrabold !leading-[1.1] text-white tracking-tight">
                Succession Planning{' '}
                <span className="bg-gradient-to-r from-purple-400 to-violet-300 bg-clip-text text-transparent">for Advisers</span>
              </h1>
              <p className="text-gray-400 text-base sm:text-lg max-w-2xl mx-auto leading-relaxed">
                We specialise in succession planning for financial advisers looking to secure the future of their practice — ensuring smooth transitions that preserve client relationships and honour the professional standards you've built.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 mt-10">
              <Button
                size="lg"
                className="bg-primary text-primary-foreground hover:bg-primary/90 transition-colors duration-200 px-8 h-12 shadow-lg shadow-purple-600/20"
                asChild
              >
                <Link to="/contact">
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
      {/* PRACTICE STAGES                                                    */}
      {/* ================================================================== */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16 lg:py-20">
        <div className="grid lg:grid-cols-2 gap-10 sm:gap-12 lg:gap-16 items-center">
          <div className="space-y-8">
            <div className="space-y-4">
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-semibold text-gray-900 leading-tight">
                Supporting Your Practice Journey at Every Stage
              </h2>
              <p className="text-base sm:text-lg text-gray-600 leading-relaxed">
                From building your early career practice to planning your retirement legacy, every adviser faces unique challenges and opportunities. We provide expert guidance and tailored solutions that evolve with your practice, ensuring your life's work creates lasting value for you, your clients, and the next generation of advisers.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              {practiceStages.map((stage, i) => (
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
                src="https://images.unsplash.com/photo-1770627000564-3feb36aecbcd?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxzZW5pb3IlMjBmaW5hbmNpYWwlMjBhZHZpc2VyJTIwcHJvZmVzc2lvbmFsJTIwb2ZmaWNlfGVufDF8fHx8MTc3MTkzMTEyNXww&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral"
                alt="Senior financial adviser in professional office"
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
              Comprehensive Succession & Advisory Services
            </h2>
            <p className="text-base sm:text-lg text-gray-600 leading-relaxed">
              Specialised services across every aspect of practice management and succession.
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
      {/* TRUSTED EXPERIENCE — accent strip                                  */}
      {/* ================================================================== */}
      <section className="relative overflow-hidden section-dark-gray text-white py-12 sm:py-16 lg:py-20">
        <div className="absolute -top-32 -right-32 w-[360px] h-[360px] rounded-full bg-white/5 pointer-events-none" />
        <div className="absolute -bottom-20 -left-20 w-[280px] h-[280px] rounded-full bg-white/5 pointer-events-none" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl mx-auto text-center space-y-6 sm:space-y-8">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-semibold leading-tight">
              Trusted Experience in Practice Transitions
            </h2>
            <p className="text-base sm:text-lg text-white/80 leading-relaxed">
              Our expertise in succession planning and practice management means your transition is handled with the professionalism and care your practice deserves.
            </p>
            <div className="pt-4">
              <Button
                size="lg"
                className="bg-purple-600 hover:bg-purple-700 text-white font-semibold px-8 shadow-lg hover:shadow-xl transition-all"
                onClick={() => setShowConsultationModal(true)}
              >
                <Calendar className="mr-2 h-5 w-5" />
                Schedule a Confidential Consultation
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* ================================================================== */}
      {/* DIGITAL SUPPORT                                                    */}
      {/* ================================================================== */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16 lg:py-20">
        <div className="grid lg:grid-cols-2 gap-10 sm:gap-12 lg:gap-16 items-center">
          <div className="relative order-2 lg:order-1">
            <div className="aspect-[4/3] rounded-xl sm:rounded-2xl overflow-hidden shadow-xl">
              <ImageWithFallback
                src="https://images.unsplash.com/photo-1745847768380-2caeadbb3b71?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxidXNpbmVzcyUyMGhhbmRzaGFrZSUyMHBhcnRuZXJzaGlwJTIwYWdyZWVtZW50fGVufDF8fHx8MTc3MTg2NjUwMXww&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral"
                alt="Business partnership handshake"
                className="w-full h-full object-cover"
              />
            </div>
            <div className="absolute -top-4 -left-4 w-24 h-24 bg-blue-200 rounded-2xl -z-10 hidden sm:block" />
          </div>

          <div className="order-1 lg:order-2 space-y-8">
            <div className="space-y-4">
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-semibold text-gray-900 leading-tight">
                Comprehensive Support Throughout Your Transition
              </h2>
              <p className="text-base sm:text-lg text-gray-600 leading-relaxed">
                Navigate Wealth provides end-to-end support throughout your succession journey. From initial planning and valuation through to final client handovers, our dedicated team ensures every detail is managed professionally.
              </p>
              <p className="text-gray-500 leading-relaxed">
                Focus on your next chapter with complete confidence — we handle the complexity so you don't have to.
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
              Ready to Secure Your Practice's Future?
            </h2>
            <p className="text-base sm:text-lg text-gray-600 leading-relaxed">
              Whether you're planning retirement, considering a practice sale, or structuring legacy solutions, our succession planning experts are here to guide you through every step of the process.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-6">
              <Button
                size="lg"
                className="bg-purple-600 hover:bg-purple-700 text-white font-semibold px-8 shadow-lg hover:shadow-xl transition-all"
                onClick={() => setShowQuoteModal(true)}
              >
                Get Your Succession Plan
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
                Confidential consultation
              </span>
              <span className="flex items-center gap-1.5">
                <CheckCircle className="h-4 w-4 text-green-500" />
                No obligation
              </span>
              <span className="flex items-center gap-1.5">
                <CheckCircle className="h-4 w-4 text-green-500" />
                Succession expertise
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

export default ForAdvisersPage;
