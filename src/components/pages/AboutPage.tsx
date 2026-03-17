import React, { useState } from 'react';
import { Link } from 'react-router';
import { SEO, createAboutPageSchema } from '../seo/SEO';
import { getSEOData } from '../seo/seo-config';
import { Button } from '../ui/button';
import { Card, CardContent } from '../ui/card';
import { Badge } from '../ui/badge';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '../ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { ImageWithFallback } from '../figma/ImageWithFallback';
import { ConsultationModal } from '../modals/ConsultationModal';
import { ThankYouModal } from '../modals/ThankYouModal';
import { ProvidersModal } from '../modals/ProvidersModal';

import { 
  Award, 
  Users, 
  TrendingUp, 
  Shield,
  Heart,
  Eye,
  Target,
  ArrowRight,
  Building,
  Globe,
  CheckCircle,
  Star,
  Clock,
  Handshake,
  Zap,
  Calendar,
  FileText,
  HandHeart,
  Scale,
  Lightbulb,
  Play,
} from 'lucide-react';

export function AboutPage() {
  const [consultationModalOpen, setConsultationModalOpen] = useState(false);
  const [thankYouModalOpen, setThankYouModalOpen] = useState(false);
  const [founderVideoModalOpen, setFounderVideoModalOpen] = useState(false);
  const [providersModalOpen, setProvidersModalOpen] = useState(false);
  const [activeSection, setActiveSection] = useState('mission');

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
          icon: Target
        },
        {
          title: 'Our Culture',
          text: 'We foster a culture of excellence, integrity, and continuous learning. Our team is committed to staying at the forefront of financial planning while maintaining the personal touch that makes us different.',
          icon: Users
        },
        {
          title: 'Our Promise',
          text: 'Every client relationship is built on trust, transparency, and a deep understanding of your unique financial journey. We promise to be your trusted partner every step of the way.',
          icon: Handshake
        }
      ]
    },
    partners: {
      label: 'Our Partners',
      icon: HandHeart,
      title: 'Trusted Product Providers',
      description: 'We work with industry-leading partners to provide you with the best financial products and solutions.',
      content: [
        {
          title: 'Investment Partners',
          text: 'We partner with top-tier asset managers including Allan Gray, Coronation, Ninety One, and Prudential to provide diversified investment solutions.',
          icon: TrendingUp
        },
        {
          title: 'Insurance Partners',
          text: 'Our insurance partnerships with Discovery, Old Mutual, Momentum, and Sanlam ensure comprehensive risk management and life cover solutions.',
          icon: Shield
        },
        {
          title: 'Platform Partners',
          text: 'We utilize cutting-edge technology platforms from FNB, Nedbank, and Standard Bank to provide seamless account management and reporting.',
          icon: Building
        }
      ]
    },
    licensing: {
      label: 'Licensing',
      icon: Scale,
      title: 'Regulatory Compliance',
      description: 'Our comprehensive licensing ensures we can provide you with expert advice across all financial services.',
      content: [
        {
          title: 'FSP License',
          text: 'Navigate Wealth is an authorized Financial Services Provider (FSP 54606) licensed by the Financial Sector Conduct Authority (FSCA).',
          icon: Award
        },
        {
          title: 'Professional Qualifications',
          text: 'Our advisors hold CFP®, CFA, and other relevant qualifications, ensuring the highest standards of professional competence.',
          icon: Star
        },
        {
          title: 'Regulatory Oversight',
          text: 'We operate under strict regulatory oversight, with regular compliance audits and adherence to all industry best practices and ethical standards.',
          icon: CheckCircle
        }
      ]
    },
    transparency: {
      label: 'Radical Transparency',
      icon: Eye,
      title: 'Complete Transparency',
      description: 'We believe in radical transparency - no hidden fees, no complex structures, just honest, straightforward advice.',
      content: [
        {
          title: 'Fee Transparency',
          text: 'All fees are clearly disclosed upfront with no hidden charges. We believe you should know exactly what you\'re paying for and why.',
          icon: FileText
        },
        {
          title: 'Investment Transparency',
          text: 'You have full visibility into your investments with regular reporting, real-time access to your portfolio, and clear explanations of all investment decisions.',
          icon: Lightbulb
        },
        {
          title: 'Performance Transparency',
          text: 'We provide honest, comprehensive performance reporting that shows both successes and areas for improvement, along with clear benchmarking.',
          icon: TrendingUp
        }
      ]
    }
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
          <div className="absolute top-0 right-0 w-[600px] h-[600px] rounded-full opacity-20 pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(109,40,217,0.25) 0%, transparent 70%)' }} />

          <div className="relative z-10 max-w-screen-xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col items-center text-center py-20 lg:py-28">
              {/* Pill badge */}
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/[0.06] border border-white/[0.08] mb-8">
                <Award className="h-3.5 w-3.5 text-purple-400" />
                <span className="text-[12px] font-medium text-gray-400 tracking-wide">55+ Years of Combined Experience</span>
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
                  Navigate Wealth helps individuals and families build, protect, and transfer wealth through comprehensive financial planning and investment management.
                </p>
              </div>

              {/* CTA buttons */}
              <div className="flex flex-col sm:flex-row gap-3 mt-10">
                <Button
                  onClick={() => setFounderVideoModalOpen(true)}
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
                {[
                  { icon: CheckCircle, text: 'R500m+ Assets Under Advisement' },
                  { icon: CheckCircle, text: '200+ Clients' },
                  { icon: CheckCircle, text: '98% Retention' },
                ].map(({ icon: Icon, text }) => (
                  <div key={text} className="flex items-center gap-1.5 text-gray-500">
                    <Icon className="h-3.5 w-3.5 text-purple-400/70 flex-shrink-0" />
                    <span className="text-xs font-medium">{text}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

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
                Select a topic to learn more about our company, values, and commitment to excellence.
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
                          <h3 className="text-2xl md:text-3xl font-bold text-gray-900">{section.title}</h3>
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
                                  <h4 className="text-xl font-semibold text-gray-900">{item.title}</h4>
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

        {/* Client Reviews */}
        <section className="py-20 section-dark-gray">
          <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 xl:px-12">
            <div className="text-center mb-16">
              <Badge className="bg-primary/20 text-white border-primary/30 mb-6">
                Client Stories
              </Badge>
              <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
                What Our Clients Say
              </h2>
              <p className="text-xl text-gray-300 max-w-3xl mx-auto">
                Don't just take our word for it. Here's what our valued clients have to say about their experience with Navigate Wealth.
              </p>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 lg:gap-10">
              {/* Review 1 */}
              <Card className="border border-gray-600 bg-gray-800/50 backdrop-blur-sm hover:bg-gray-800/70 transition-all duration-300">
                <CardContent className="p-6">
                  <div className="flex items-center mb-4">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} className="h-5 w-5 text-yellow-400 fill-current" />
                    ))}
                  </div>
                  <p className="text-gray-300 mb-6 leading-relaxed">
                    "Navigate Wealth completely transformed our financial future. Their personalized approach and expert guidance helped us secure our retirement and protect our family's wealth. I couldn't be happier with their service."
                  </p>
                  <div className="flex items-center space-x-3">
                    <div className="w-12 h-12 bg-primary/20 rounded-full flex items-center justify-center">
                      <span className="text-primary font-medium">FU</span>
                    </div>
                    <div>
                      <h4 className="text-white font-medium">Franswa Uys</h4>
                      <p className="text-gray-400 text-sm">Private Client</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Review 2 */}
              <Card className="border border-gray-600 bg-gray-800/50 backdrop-blur-sm hover:bg-gray-800/70 transition-all duration-300">
                <CardContent className="p-6">
                  <div className="flex items-center mb-4">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} className="h-5 w-5 text-yellow-400 fill-current" />
                    ))}
                  </div>
                  <p className="text-gray-300 mb-6 leading-relaxed">
                    "The team at Navigate Wealth is exceptional. They took the time to understand our unique situation and created a comprehensive financial plan that exceeded our expectations. Their ongoing support is invaluable."
                  </p>
                  <div className="flex items-center space-x-3">
                    <div className="w-12 h-12 bg-primary/20 rounded-full flex items-center justify-center">
                      <span className="text-primary font-medium">LS</span>
                    </div>
                    <div>
                      <h4 className="text-white font-medium">Lee-Anne Simmons</h4>
                      <p className="text-gray-400 text-sm">Family Client</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Review 3 */}
              <Card className="border border-gray-600 bg-gray-800/50 backdrop-blur-sm hover:bg-gray-800/70 transition-all duration-300">
                <CardContent className="p-6">
                  <div className="flex items-center mb-4">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} className="h-5 w-5 text-yellow-400 fill-current" />
                    ))}
                  </div>
                  <p className="text-gray-300 mb-6 leading-relaxed">
                    "Professional, knowledgeable, and trustworthy. Navigate Wealth helped us navigate complex investment decisions with confidence. Their independent advice gave us peace of mind knowing we're in good hands."
                  </p>
                  <div className="flex items-center space-x-3">
                    <div className="w-12 h-12 bg-primary/20 rounded-full flex items-center justify-center">
                      <span className="text-primary font-medium">DK</span>
                    </div>
                    <div>
                      <h4 className="text-white font-medium">David Kruger</h4>
                      <p className="text-gray-400 text-sm">Business Owner</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Call to Action */}
            <div className="text-center mt-16">
              <div className="max-w-2xl mx-auto">
                <h3 className="text-2xl font-bold text-white mb-4">
                  Ready to Join Our Success Stories?
                </h3>
                <p className="text-gray-300 mb-8">
                  Experience the Navigate Wealth difference for yourself. Schedule a complimentary consultation today.
                </p>
                <Button 
                  size="lg"
                  className="bg-primary text-primary-foreground hover:bg-primary/90 hover:scale-105 transform transition-all duration-200 px-8 py-4 shadow-lg hover:shadow-xl rounded-lg group"
                  asChild
                >
                  <Link to="/signup">
                    <Zap className="mr-2 h-5 w-5 group-hover:scale-110 transition-transform duration-200" />
                    Get Started
                    <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform duration-200" />
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        </section>

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
                Discover exciting career opportunities with Navigate Wealth or stay up to date with our latest news, announcements, and industry insights.
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
                <div className="flex items-center text-sm text-gray-600">
                  <CheckCircle className="h-4 w-4 text-primary mr-2" />
                  25+ Years Combined Experience
                </div>
                <div className="flex items-center text-sm text-gray-600">
                  <CheckCircle className="h-4 w-4 text-primary mr-2" />
                  R500M+ Assets Managed
                </div>
                <div className="flex items-center text-sm text-gray-600">
                  <CheckCircle className="h-4 w-4 text-primary mr-2" />
                  98% Client Retention
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Consultation Modal */}
        <ConsultationModal 
          open={consultationModalOpen} 
          onOpenChange={setConsultationModalOpen} 
        />
        
        {/* Thank You Modal */}
        <ThankYouModal 
          open={thankYouModalOpen} 
          onOpenChange={setThankYouModalOpen} 
          clientName=""
        />

        {/* Providers Modal */}
        <ProvidersModal 
          isOpen={providersModalOpen} 
          onClose={() => setProvidersModalOpen(false)} 
        />

        {/* Founder Video Modal */}
        <Dialog open={founderVideoModalOpen} onOpenChange={setFounderVideoModalOpen}>
          <DialogContent className="max-w-md w-full mx-auto bg-white border border-gray-200 rounded-2xl shadow-2xl p-0 overflow-hidden">
            <DialogTitle className="sr-only">Video Coming Soon</DialogTitle>
            <DialogDescription className="sr-only">
              The founder video is not yet available. Please check back soon.
            </DialogDescription>

            {/* Top accent bar */}
            <div className="h-1.5 bg-gradient-to-r from-purple-600 via-primary to-purple-600" />

            <div className="px-8 pt-8 pb-6 text-center">
              {/* Icon */}
              <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                <Play className="h-7 w-7 text-primary ml-0.5" />
              </div>

              <h3 className="text-xl font-bold text-gray-900 mb-2">
                Video Coming Soon
              </h3>
              <p className="text-gray-600 text-sm leading-relaxed mb-6">
                We're currently preparing this video. Please check back soon to meet our founder and learn more about the Navigate Wealth story.
              </p>

              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Button
                  variant="outline"
                  onClick={() => setFounderVideoModalOpen(false)}
                  className="px-6"
                >
                  Close
                </Button>
                <Button
                  onClick={() => {
                    setFounderVideoModalOpen(false);
                    setConsultationModalOpen(true);
                  }}
                  className="bg-primary text-primary-foreground hover:bg-primary/90 px-6"
                >
                  Book a Consultation
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}