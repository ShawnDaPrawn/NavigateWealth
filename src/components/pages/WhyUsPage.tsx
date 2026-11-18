import { useState } from 'react';
import { Link } from 'react-router';
import { SEO, createWebPageSchema } from '../seo/SEO';
import { getSEOData } from '../seo/seo-config';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { GetQuoteModal } from '../modals/GetQuoteModal';
import { ConsultationModal } from '../modals/ConsultationModal';
import { ProvidersModal } from '../modals/ProvidersModal';
import { PublishedReviews } from '../shared/PublishedReviews';
import { TRUST_FACTS } from '@/config/companyFacts';
import { CheckCircle, ArrowRight, Building2 } from 'lucide-react';
import {
  CORE_VALUES,
  CREDENTIALS,
  DIFFERENTIATORS,
  PROCESS_STEPS,
} from '@/site/solutions/whyUsContent';
import consultationImage from 'figma:asset/61c60b4a45c33d3564e85aaf184ff3f3b9db37f8.png';

export function WhyUsPage() {
  const [showQuoteModal, setShowQuoteModal] = useState(false);
  const [showConsultationModal, setShowConsultationModal] = useState(false);
  const [showProvidersModal, setShowProvidersModal] = useState(false);

  const coreValues = CORE_VALUES;
  const differentiators = DIFFERENTIATORS;
  const processSteps = PROCESS_STEPS;

  return (
    <div className="min-h-screen">
      <SEO
        {...getSEOData('why-us')}
        structuredData={createWebPageSchema(
          getSEOData('why-us').title,
          getSEOData('why-us').description,
          getSEOData('why-us').canonicalUrl,
        )}
      />
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-[#111827]" aria-label="Hero">
        <div className="absolute inset-0 bg-gradient-to-b from-[#111827] via-[#161b33] to-[#111827] pointer-events-none" />
        <div
          className="absolute top-0 right-0 w-[600px] h-[600px] rounded-full opacity-20 pointer-events-none"
          style={{
            background: 'radial-gradient(circle, rgba(109,40,217,0.25) 0%, transparent 70%)',
          }}
        />

        <div className="relative z-10 max-w-screen-xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col items-center text-center py-20 lg:py-28">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/[0.06] border border-white/[0.08] mb-8">
              <span className="text-[12px] font-medium text-gray-400 tracking-wide">
                Independent Financial Advice
              </span>
            </div>

            <div className="max-w-3xl space-y-5">
              <h1 className="!text-[clamp(2rem,5vw,3.5rem)] !font-extrabold !leading-[1.1] text-white tracking-tight">
                Why Choose{' '}
                <span className="bg-gradient-to-r from-purple-400 to-violet-300 bg-clip-text text-transparent">
                  Navigate Wealth?
                </span>
              </h1>
              <p className="text-gray-400 text-base sm:text-lg max-w-2xl mx-auto leading-relaxed">
                We're not your typical financial advisers. As a truly independent practice, we work
                for you — not product providers, banks, or shareholders. Your financial success is
                our only measure of success.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 mt-10">
              <Button
                size="lg"
                className="bg-primary text-primary-foreground hover:bg-primary/90 transition-colors duration-200 px-8 h-12 shadow-lg shadow-purple-600/20"
                onClick={() => setShowConsultationModal(true)}
              >
                Schedule Free Consultation
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="border-purple-400/30 bg-transparent text-purple-300 hover:bg-purple-500/15 hover:border-purple-400/50 hover:text-purple-200 transition-colors duration-200 px-8 h-12"
                onClick={() => setShowProvidersModal(true)}
              >
                View Our Partners
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Trust facts — checkable, see src/config/companyFacts.ts */}
      <section className="py-20 section-white">
        <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 lg:gap-8">
            {TRUST_FACTS.map((stat) => {
              const Icon = stat.icon;
              return (
                <Card
                  key={stat.value}
                  className="text-center border-none shadow-lg hover:shadow-xl transition-all duration-300 bg-gradient-to-br from-white to-gray-50"
                >
                  <CardContent className="pt-8 pb-6">
                    <div className="mb-4 inline-flex items-center justify-center w-14 h-14 rounded-full bg-primary/10">
                      <Icon className="h-7 w-7 text-primary" />
                    </div>
                    <div className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">
                      {stat.value}
                    </div>
                    <p className="text-sm text-gray-600 font-medium">{stat.label}</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      {/* Core Values Section */}
      <section className="py-20 section-gray">
        <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <Badge className="bg-primary/10 text-[rgb(255,255,255)] border-primary/20 mb-4">
              Our Core Values
            </Badge>
            <h2 className="text-[rgb(255,255,255)] mb-6">What Makes Us Different</h2>
            <p className="text-[rgb(255,255,255)] text-lg">
              Our values aren't just words on a page—they're the foundation of how we serve our
              clients every single day.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            {coreValues.map((value, index) => {
              const Icon = value.icon;
              return (
                <Card
                  key={index}
                  className="border-none shadow-lg hover:shadow-xl transition-all duration-300 overflow-hidden group"
                >
                  <div className={`h-1.5 bg-gradient-to-r ${value.gradient}`}></div>
                  <CardHeader className="pb-4">
                    <div className="flex items-start space-x-4">
                      <div
                        className={`w-12 h-12 rounded-lg bg-gradient-to-br ${value.gradient} flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform duration-300`}
                      >
                        <Icon className="h-6 w-6 text-white" />
                      </div>
                      <div className="flex-1">
                        <CardTitle className="text-xl mb-2">{value.title}</CardTitle>
                        <p className="text-gray-600 leading-relaxed">{value.description}</p>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-3">
                      {value.features.map((feature, idx) => (
                        <div key={idx} className="flex items-center space-x-2">
                          <CheckCircle className="h-4 w-4 text-primary flex-shrink-0" />
                          <span className="text-sm text-gray-700">{feature}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      {/* Key Differentiators */}
      <section className="py-20 section-white">
        <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-gray-900 mb-6">The Navigate Wealth Advantage</h2>
            <p className="text-gray-600 text-lg">
              Experience the difference that comes from working with an adviser who puts your
              interests first.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {differentiators.map((item, index) => {
              const Icon = item.icon;
              return (
                <Card
                  key={index}
                  className="border border-gray-200 hover:border-primary/50 hover:shadow-lg transition-all duration-300 group"
                >
                  <CardContent className="p-6 text-center">
                    <div className="mb-4 inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/5 group-hover:bg-primary/10 transition-colors duration-300">
                      <Icon className="h-8 w-8 text-primary" />
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-3">{item.title}</h3>
                    <p className="text-sm text-gray-600 leading-relaxed">{item.description}</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      {/* Our Process Section */}
      <section className="py-16 lg:py-20 section-dark-gray">
        <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-start">
            {/* Left Column - Process Steps */}
            <div className="space-y-6">
              <div className="space-y-4 mb-12">
                <Badge className="bg-white/10 text-white border-white/20 text-[11px]">
                  Our Process
                </Badge>
                <h2 className="text-white text-[20px]">How We Work With You</h2>
                <p className="text-white/80 text-lg leading-relaxed">
                  Our four-step process ensures you receive personalized advice backed by thorough
                  research and ongoing support.
                </p>
              </div>

              <div className="space-y-6">
                {processSteps.map((step, index) => {
                  const Icon = step.icon;
                  return (
                    <Card
                      key={index}
                      className="border-none bg-white/5 backdrop-blur-sm hover:bg-white/10 transition-all duration-300"
                    >
                      <CardContent className="p-6">
                        <div className="flex items-start space-x-4">
                          <div className="w-12 h-12 rounded-lg bg-primary flex items-center justify-center text-white font-bold text-lg flex-shrink-0">
                            {step.number}
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center space-x-3 mb-2">
                              <Icon className="h-5 w-5 text-primary" />
                              <h3 className="text-lg font-semibold text-white">{step.title}</h3>
                            </div>
                            <p className="text-white/70 mb-4 leading-relaxed">{step.description}</p>
                            <div className="grid grid-cols-2 gap-2">
                              {step.details.map((detail, idx) => (
                                <div key={idx} className="flex items-center space-x-2">
                                  <CheckCircle className="h-3.5 w-3.5 text-primary flex-shrink-0" />
                                  <span className="text-sm text-white/60">{detail}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>

            {/* Right Column - Image & CTA */}
            <div className="space-y-6 lg:pt-40">
              <div className="relative rounded-2xl overflow-hidden shadow-2xl h-[500px]">
                <img
                  src={consultationImage}
                  alt="Financial planning consultation"
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent"></div>
                <div className="absolute bottom-0 left-0 right-0 p-6 md:p-8">
                  <div className="bg-[rgba(25,15,46,0.95)] backdrop-blur-sm rounded-xl p-6">
                    <h3 className="text-white mb-4">Ready to Get Started?</h3>
                    <p className="text-white/90 mb-6">
                      Book a complimentary consultation to discuss your financial goals, in person
                      or online.
                    </p>
                    <Button
                      className="w-full bg-primary text-white hover:bg-primary/90"
                      size="lg"
                      onClick={() => setShowConsultationModal(true)}
                    >
                      Schedule Free Consultation
                      <ArrowRight className="ml-2 h-5 w-5" />
                    </Button>
                  </div>
                </div>
              </div>

              {/* Checkable credentials — replaces unevidenced satisfaction/retention rates */}
              <Card className="border-none bg-white/5 backdrop-blur-sm">
                <CardContent className="p-6">
                  <h4 className="text-white font-semibold mb-4">Check Our Credentials</h4>
                  <dl className="space-y-3 text-sm">
                    {CREDENTIALS.map(({ term, detail }) => (
                      <div
                        key={term}
                        className="flex flex-col sm:flex-row sm:justify-between gap-1"
                      >
                        <dt className="text-white/60">{term}</dt>
                        <dd className="text-white/90 font-medium sm:text-right">{detail}</dd>
                      </div>
                    ))}
                  </dl>
                  <p className="text-xs text-white/50 mt-4">
                    Our authorisation can be confirmed on the FSCA’s public register of financial
                    services providers.
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* Client reviews — renders only once there are traceable, published reviews */}
      <PublishedReviews />

      {/* Final CTA Section */}
      <section className="py-16 lg:py-20 section-white">
        <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8">
          <Card className="border-none shadow-xl bg-gradient-to-br from-primary to-purple-700 text-white overflow-hidden relative">
            <div className="absolute top-0 right-0 w-1/2 h-full opacity-10">
              <Building2 className="w-full h-full" />
            </div>
            <CardContent className="p-6 sm:p-10 lg:p-16 relative z-10">
              <div className="max-w-3xl">
                <h2 className="text-white mb-6 text-[20px]">
                  Experience the Navigate Wealth Difference
                </h2>
                <p className="text-lg text-white/90 mb-8 leading-relaxed">
                  Discover what truly independent, personalized financial advice looks like.
                  Schedule your free consultation today.
                </p>
                <div className="flex flex-col sm:flex-row gap-4">
                  <Button
                    size="lg"
                    className="bg-white text-primary hover:bg-gray-100 shadow-lg"
                    onClick={() => setShowConsultationModal(true)}
                  >
                    Schedule Free Consultation
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Button>
                  <Button
                    size="lg"
                    variant="outline"
                    className="border-white/30 bg-white/10 text-white hover:bg-white/20 hover:border-white/50 backdrop-blur-sm"
                    asChild
                  >
                    <Link to="/services">Explore Our Services</Link>
                  </Button>
                </div>

                <div className="grid grid-cols-3 gap-4 sm:gap-6 mt-8 sm:mt-12 pt-8 border-t border-white/20">
                  {TRUST_FACTS.slice(0, 3).map(({ value, label }) => (
                    <div key={value}>
                      <div className="text-lg sm:text-2xl font-bold mb-1">{value}</div>
                      <div className="text-xs sm:text-sm text-white/80">{label}</div>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Modals */}
      <GetQuoteModal isOpen={showQuoteModal} onClose={() => setShowQuoteModal(false)} />
      <ConsultationModal
        isOpen={showConsultationModal}
        onClose={() => setShowConsultationModal(false)}
      />
      <ProvidersModal isOpen={showProvidersModal} onClose={() => setShowProvidersModal(false)} />
    </div>
  );
}

export default WhyUsPage;
