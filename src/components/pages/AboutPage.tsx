import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router';
import { SEO, createAboutPageSchema } from '../seo/SEO';
import { getSEOData } from '../seo/seo-config';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { ConsultationModal } from '../modals/ConsultationModal';
import { ThankYouModal } from '../modals/ThankYouModal';
import { ProvidersModal } from '../modals/ProvidersModal';
import { PublishedReviews } from '../shared/PublishedReviews';
import { FounderNote } from './about/FounderNote';
import { COMPANY, TRUST_FACTS } from '@/config/companyFacts';

import {
  Award,
  Users,
  TrendingUp,
  Shield,
  Heart,
  Eye,
  Target,
  ArrowRight,
  CheckCircle,
  Handshake,
  Calendar,
  FileText,
  HandHeart,
  Scale,
  Lightbulb,
  Stethoscope,
} from 'lucide-react';

export function AboutPage() {
  const [consultationModalOpen, setConsultationModalOpen] = useState(false);
  const [thankYouModalOpen, setThankYouModalOpen] = useState(false);
  const [providersModalOpen, setProvidersModalOpen] = useState(false);
  const [activeSection, setActiveSection] = useState('mission');
  const { hash } = useLocation();

  // /about#founder (linked from the Team page) should land on the founder's
  // note. A frame's delay lets ScrollToTop's route-change reset run first.
  useEffect(() => {
    if (hash !== '#founder') return;
    const frame = requestAnimationFrame(() =>
      document.getElementById('founder')?.scrollIntoView({ behavior: 'smooth' }),
    );
    return () => cancelAnimationFrame(frame);
  }, [hash]);

  // Get SEO data for about page
  const seoData = getSEOData('about');

  // About page structured data
  const aboutPageStructuredData = createAboutPageSchema();

  const sections = {
    mission: {
      label: 'Mission & Culture',
      icon: Heart,
      title: 'Our Mission & Culture',
      description: 'Learn about our values, purpose, and the culture that drives everything we do.',
      content: [
        {
          title: 'Our Mission',
          text: 'To empower our clients to achieve financial independence and peace of mind through personalized wealth management strategies, exceptional service, and unwavering commitment to their success.',
          icon: Target,
        },
        {
          title: 'Our Approach',
          text: 'As a founder-led practice, we keep advice personal: you deal directly with the person advising you. We stay current with markets and regulation so that the advice stays relevant as your life changes.',
          icon: Users,
        },
        {
          title: 'Our Promise',
          text: 'Every client relationship is built on trust, transparency, and a deep understanding of your unique financial journey. We promise to be your trusted partner every step of the way.',
          icon: Handshake,
        },
      ],
    },
    partners: {
      label: 'Our Partners',
      icon: HandHeart,
      title: 'Trusted Product Providers',
      description:
        'We work with established South African product providers, so you can compare real options side by side.',
      content: [
        {
          title: 'Investment Partners',
          text: 'Investment managers and platforms including Allan Gray, Sygnia, Stanlib and INN8, used to build diversified investment and retirement portfolios.',
          icon: TrendingUp,
        },
        {
          title: 'Insurance Partners',
          text: 'Life, disability and severe illness cover compared across insurers including Discovery, Old Mutual, Momentum, Sanlam, Liberty, BrightRock and Hollard.',
          icon: Shield,
        },
        {
          title: 'Medical & Estate Partners',
          text: 'Medical aid options from Discovery Health and Momentum Health, and estate planning support from Capital Legacy and EW Serfontein & Associates.',
          icon: Stethoscope,
        },
      ],
    },
    licensing: {
      label: 'Licensing',
      icon: Scale,
      title: 'Regulatory Compliance',
      description:
        'Every detail below can be checked independently, starting with the FSCA’s public register.',
      content: [
        {
          title: 'FSP Licence',
          text: `${COMPANY.tradingName} is the trading name of ${COMPANY.legalName} (registration ${COMPANY.registrationNumber}), an authorised Financial Services Provider (FSP ${COMPANY.fspNumber}) licensed by the ${COMPANY.regulator} on ${COMPANY.fscaAuthorisedOn}.`,
          icon: Award,
        },
        {
          title: 'Fit and Proper Advice',
          text: 'Advice is given by representatives who meet the FSCA’s Fit and Proper requirements for honesty, qualifications, experience and continuous professional development.',
          icon: Users,
        },
        {
          title: 'Regulatory Oversight',
          text: 'We operate under the FAIS Act and the FSCA’s General Code of Conduct, and our authorisation can be confirmed on the FSCA’s public register of financial services providers.',
          icon: CheckCircle,
        },
      ],
    },
    transparency: {
      label: 'Radical Transparency',
      icon: Eye,
      title: 'Complete Transparency',
      description:
        'We believe in radical transparency - no hidden fees, no complex structures, just honest, straightforward advice.',
      content: [
        {
          title: 'Fee Transparency',
          text: "All fees are clearly disclosed upfront with no hidden charges. We believe you should know exactly what you're paying for and why.",
          icon: FileText,
        },
        {
          title: 'Investment Transparency',
          text: 'You have full visibility into your investments with regular reporting, real-time access to your portfolio, and clear explanations of all investment decisions.',
          icon: Lightbulb,
        },
        {
          title: 'Performance Transparency',
          text: 'We provide honest, comprehensive performance reporting that shows both successes and areas for improvement, along with clear benchmarking.',
          icon: TrendingUp,
        },
      ],
    },
  };

  return (
    <div className="contents">
      {/* SEO Meta Tags */}
      <SEO
        title={seoData.title}
        description={seoData.description}
        keywords={seoData.keywords}
        canonicalUrl={seoData.canonicalUrl}
        ogType={seoData.ogType}
        structuredData={aboutPageStructuredData}
      />

      <div className="min-h-screen bg-white">
        {/* Hero Section */}
        <section className="relative overflow-hidden bg-[#111827]" aria-label="Hero">
          {/* Background — single subtle gradient */}
          <div className="absolute inset-0 bg-gradient-to-b from-[#111827] via-[#161b33] to-[#111827] pointer-events-none" />
          <div
            className="absolute top-0 right-0 w-[600px] h-[600px] rounded-full opacity-20 pointer-events-none"
            style={{
              background: 'radial-gradient(circle, rgba(109,40,217,0.25) 0%, transparent 70%)',
            }}
          />

          <div className="relative z-10 max-w-screen-xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col items-center text-center py-20 lg:py-28">
              {/* Pill badge */}
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/[0.06] border border-white/[0.08] mb-8">
                <Shield className="h-3.5 w-3.5 text-purple-400" />
                <span className="text-[12px] font-medium text-gray-400 tracking-wide">
                  FSCA-authorised · FSP {COMPANY.fspNumber}
                </span>
              </div>

              {/* Heading */}
              <div className="max-w-3xl space-y-5">
                <h1 className="!text-[clamp(2rem,5vw,3.5rem)] !font-extrabold !leading-[1.1] text-white tracking-tight">
                  Your Trusted{' '}
                  <span className="bg-gradient-to-r from-purple-400 to-violet-300 bg-clip-text text-transparent">
                    Financial Partners
                  </span>
                </h1>
                <p className="text-gray-400 text-base sm:text-lg max-w-2xl mx-auto leading-relaxed">
                  Navigate Wealth is an independent, founder-led practice that helps individuals and
                  families build, protect, and transfer wealth through comprehensive financial
                  planning and investment management.
                </p>
              </div>

              {/* CTA buttons */}
              <div className="flex flex-col sm:flex-row gap-3 mt-10">
                <Button
                  onClick={() =>
                    document.getElementById('founder')?.scrollIntoView({ behavior: 'smooth' })
                  }
                  size="lg"
                  className="bg-primary text-primary-foreground hover:bg-primary/90 transition-colors duration-200 px-8 h-12 shadow-lg shadow-purple-600/20"
                >
                  Meet Our Founder
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
                <Button
                  onClick={() => setConsultationModalOpen(true)}
                  size="lg"
                  variant="outline"
                  className="border-purple-400/30 bg-transparent text-purple-300 hover:bg-purple-500/15 hover:border-purple-400/50 hover:text-purple-200 transition-colors duration-200 px-8 h-12"
                >
                  Schedule Consultation
                </Button>
              </div>

              {/* Trust indicators */}
              <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 mt-10 pt-8 border-t border-white/[0.06] w-full max-w-2xl">
                {TRUST_FACTS.map(({ icon: Icon, value }) => (
                  <div key={value} className="flex items-center gap-1.5 text-gray-500">
                    <Icon className="h-3.5 w-3.5 text-purple-400/70 flex-shrink-0" />
                    <span className="text-xs font-medium">{value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <FounderNote onBookConsultation={() => setConsultationModalOpen(true)} />

        {/* Information Section Changer */}
        <section className="py-20 section-white relative overflow-hidden">
          <div className="relative max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 xl:px-12">
            <div className="text-center mb-12">
              <Badge className="bg-primary/10 text-primary border-primary/20 mb-6">
                Learn More About Us
              </Badge>
              <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
                Discover Navigate Wealth
              </h2>
              <p className="text-xl text-gray-600 max-w-2xl mx-auto">
                Select a topic to learn more about our company, values, and commitment to
                excellence.
              </p>
            </div>

            {/* Section Tabs - Mobile Dropdown */}
            <div className="md:hidden mb-8 max-w-sm mx-auto">
              <Select value={activeSection} onValueChange={setActiveSection}>
                <SelectTrigger className="w-full bg-white border-2 border-gray-200 hover:border-primary transition-colors">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(sections).map(([key, section]) => {
                    const Icon = section.icon;
                    return (
                      <SelectItem key={key} value={key}>
                        <div className="flex items-center space-x-2">
                          <Icon className="h-4 w-4" />
                          <span>{section.label}</span>
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            {/* Section Tabs - Desktop */}
            <div className="hidden md:flex justify-center mb-8">
              <div className="inline-flex bg-white rounded-2xl p-2 shadow-lg border border-gray-200">
                {Object.entries(sections).map(([key, section]) => {
                  const Icon = section.icon;
                  return (
                    <button
                      key={key}
                      onClick={() => setActiveSection(key)}
                      className={`flex items-center space-x-2 px-6 py-3 rounded-xl transition-all duration-300 whitespace-nowrap ${
                        activeSection === key
                          ? 'bg-primary text-white shadow-md'
                          : 'text-gray-600 hover:text-primary hover:bg-primary/5'
                      }`}
                    >
                      <Icon className="h-5 w-5" />
                      <span className="font-medium">{section.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Active Section Content */}
            <div className="max-w-6xl mx-auto">
              {Object.entries(sections).map(([key, section]) => {
                const Icon = section.icon;
                return (
                  <div
                    key={key}
                    className={`transition-all duration-300 ${
                      activeSection === key ? 'opacity-100 block' : 'opacity-0 hidden'
                    }`}
                  >
                    <div className="bg-white rounded-3xl shadow-xl border border-gray-200 overflow-hidden">
                      <div className="bg-gradient-to-r from-primary/10 via-primary/5 to-primary/10 p-8 border-b border-gray-100">
                        <div className="text-center mb-6">
                          <div className="w-16 h-16 bg-primary/20 rounded-full flex items-center justify-center mx-auto mb-4">
                            <Icon className="h-8 w-8 text-primary" />
                          </div>
                          <h3 className="text-2xl md:text-3xl font-bold text-gray-900">
                            {section.title}
                          </h3>
                          <p className="text-gray-600 mt-2 text-lg">{section.description}</p>
                        </div>
                      </div>

                      {/* Section Content */}
                      <div className="p-8 lg:p-12">
                        <div className="grid lg:grid-cols-2 xl:grid-cols-3 gap-8 lg:gap-10">
                          {section.content.map((item, index) => {
                            const ItemIcon = item.icon;
                            return (
                              <div key={index} className="flex flex-col space-y-4">
                                <div className="flex items-center space-x-3">
                                  <div className="w-12 h-12 bg-primary/20 rounded-lg flex items-center justify-center flex-shrink-0">
                                    <ItemIcon className="h-6 w-6 text-primary" />
                                  </div>
                                  <h4 className="text-xl font-semibold text-gray-900">
                                    {item.title}
                                  </h4>
                                </div>
                                <p className="text-gray-700 leading-relaxed pl-0">{item.text}</p>
                              </div>
                            );
                          })}
                        </div>

                        {/* Call to Action */}
                        <div className="flex justify-center pt-8 mt-8 border-t border-gray-100">
                          {activeSection === 'partners' ? (
                            <Button
                              onClick={() => setProvidersModalOpen(true)}
                              size="lg"
                              className="bg-primary text-primary-foreground hover:bg-primary/90 hover:scale-105 transform transition-all duration-200 px-8 py-4 shadow-lg hover:shadow-xl rounded-lg group"
                            >
                              <Users className="mr-2 h-5 w-5 group-hover:scale-110 transition-transform duration-200" />
                              View Our Partners
                              <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform duration-200" />
                            </Button>
                          ) : activeSection === 'licensing' ? (
                            <Button
                              size="lg"
                              className="bg-primary text-primary-foreground hover:bg-primary/90 hover:scale-105 transform transition-all duration-200 px-8 py-4 shadow-lg hover:shadow-xl rounded-lg group"
                              asChild
                            >
                              <Link to="/legal">
                                <FileText className="mr-2 h-5 w-5 group-hover:scale-110 transition-transform duration-200" />
                                Legal Information
                                <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform duration-200" />
                              </Link>
                            </Button>
                          ) : (
                            <Button
                              onClick={() => setConsultationModalOpen(true)}
                              size="lg"
                              className="bg-primary text-primary-foreground hover:bg-primary/90 hover:scale-105 transform transition-all duration-200 px-8 py-4 shadow-lg hover:shadow-xl rounded-lg group"
                            >
                              <Calendar className="mr-2 h-5 w-5 group-hover:rotate-12 transition-transform duration-200" />
                              Schedule a Consultation
                              <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform duration-200" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* Client reviews — renders only once there are traceable, published reviews */}
        <PublishedReviews />

        {/* Call to Action Section */}
        <section className="py-20 section-white relative overflow-hidden">
          {/* Background Pattern */}
          <div className="absolute inset-0 opacity-10">
            <div className="absolute top-20 left-10 w-32 h-32 border-2 border-primary rounded-full"></div>
            <div className="absolute top-40 right-20 w-24 h-24 border border-primary rounded-lg rotate-45"></div>
            <div className="absolute bottom-32 left-32 w-16 h-16 bg-primary/20 rounded-full"></div>
            <div className="absolute bottom-20 right-10 w-12 h-12 bg-primary/30 rounded-full"></div>
          </div>

          <div className="relative max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 xl:px-12">
            <div className="max-w-4xl mx-auto text-center text-gray-900">
              <h2 className="text-3xl md:text-4xl font-bold mb-6">
                Join Our Team or Stay Informed
              </h2>
              <p className="text-xl text-gray-600 mb-8">
                Discover exciting career opportunities with Navigate Wealth or stay up to date with
                our latest news, announcements, and industry insights.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button
                  size="lg"
                  className="bg-primary text-primary-foreground hover:bg-primary/90 hover:scale-105 transform transition-all duration-200 px-8 py-4 shadow-lg hover:shadow-xl"
                  asChild
                >
                  <Link to="/careers">
                    Explore Careers
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Link>
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  className="border-2 border-primary/60 bg-white text-primary hover:bg-primary/10 hover:border-primary hover:text-primary hover:scale-105 transform transition-all duration-200 px-8 py-4 shadow-lg hover:shadow-xl"
                  asChild
                >
                  <Link to="/press">
                    For the Press
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Link>
                </Button>
              </div>

              {/* Trust indicators */}
              <div className="flex flex-col sm:flex-row flex-wrap items-center justify-center gap-3 sm:gap-6 pt-12 mt-8 border-t border-gray-300">
                {TRUST_FACTS.map(({ value, label }) => (
                  <div key={value} className="flex items-center text-sm text-gray-600">
                    <CheckCircle className="h-4 w-4 text-primary mr-2" />
                    {value} — {label}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Consultation Modal */}
        <ConsultationModal open={consultationModalOpen} onOpenChange={setConsultationModalOpen} />

        {/* Thank You Modal */}
        <ThankYouModal open={thankYouModalOpen} onOpenChange={setThankYouModalOpen} clientName="" />

        {/* Providers Modal */}
        <ProvidersModal isOpen={providersModalOpen} onClose={() => setProvidersModalOpen(false)} />
      </div>
    </div>
  );
}

export default AboutPage;
