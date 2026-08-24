import { Link } from 'react-router';
import { Card, CardContent } from '../../ui/card';
import { Badge } from '../../ui/badge';
import { Button } from '../../ui/button';
import { Alert, AlertDescription } from '../../ui/alert';
import {
  Code,
  Shield,
  Briefcase,
  Mail,
  Phone,
  Info,
  ArrowRight,
  Building,
  Component,
  Layers,
  Palette,
  Sparkles,
} from 'lucide-react';
import { COMPONENTS_COUNT } from './ComponentsTab';
import { SECTIONS_COUNT } from './sectionsData';

const COLOR_TOKENS_COUNT = 10;

export function PartnershipSection() {
  return (
    <section className="section-white py-16 md:py-24 px-4 border-t border-gray-200">
      <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 xl:px-12">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12 md:mb-16">
            <Badge className="bg-primary/10 text-primary border-primary/20 mb-4">
              <Sparkles className="h-3 w-3 mr-1" />
              Partnership Opportunity
            </Badge>
            <h2 className="text-black mb-4 md:mb-6">
              Build the Future of <span className="text-primary">Fintech</span> Together
            </h2>
            <p className="text-lg md:text-xl text-gray-600 leading-relaxed max-w-3xl mx-auto">
              Partner with Navigate Wealth to develop cutting-edge fintech products in the
              Independent Financial Advisory space.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8 mb-12 md:mb-16">
            {[
              {
                icon: Code,
                title: 'Complete Design System',
                desc: 'Access our comprehensive UI library, components, and patterns built for wealth management platforms.',
              },
              {
                icon: Shield,
                title: 'Regulatory Expertise',
                desc: 'Benefit from our deep understanding of financial services regulations and compliance requirements.',
              },
              {
                icon: Briefcase,
                title: 'Industry Experience',
                desc: 'Leverage years of experience in building solutions for independent financial advisers and wealth managers.',
              },
            ].map((card) => {
              const Icon = card.icon;
              return (
                <Card
                  key={card.title}
                  className="border-gray-200 hover:border-primary/30 transition-colors"
                >
                  <CardContent className="p-6">
                    <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center mb-4">
                      <Icon className="h-6 w-6 text-primary" />
                    </div>
                    <h3 className="text-black mb-2">{card.title}</h3>
                    <p className="text-sm text-gray-600">{card.desc}</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <Card className="border-primary/20 bg-gradient-to-br from-primary/5 via-white to-primary/5 overflow-hidden">
            <CardContent className="p-8 md:p-12">
              <div className="grid lg:grid-cols-2 gap-8 items-center">
                <div>
                  <h3 className="text-2xl md:text-3xl font-bold text-black mb-4">
                    Ready to Partner?
                  </h3>
                  <p className="text-gray-600 mb-6 leading-relaxed">
                    Whether you're building a new fintech product, enhancing an existing platform,
                    or exploring opportunities in the IFA space, we'd love to discuss how we can
                    collaborate.
                  </p>
                  <div className="space-y-3 mb-8">
                    <div className="flex items-center space-x-3 text-sm">
                      <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
                        <Mail className="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        <p className="text-gray-500">Email us at</p>
                        <a
                          href="mailto:info@navigatewealth.com"
                          className="text-primary hover:underline font-medium"
                        >
                          info@navigatewealth.com
                        </a>
                      </div>
                    </div>
                    <div className="flex items-center space-x-3 text-sm">
                      <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
                        <Phone className="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        <p className="text-gray-500">Call us at</p>
                        <a
                          href="tel:+27123456789"
                          className="text-primary hover:underline font-medium"
                        >
                          +27 (0)12 345 6789
                        </a>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-3">
                    <Button
                      className="bg-primary hover:bg-primary/90 text-white px-6 py-3 group"
                      asChild
                    >
                      <Link to="/contact">
                        Get in Touch
                        <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
                      </Link>
                    </Button>
                    <Button
                      variant="outline"
                      className="border-gray-300 hover:border-primary hover:bg-primary/5 px-6 py-3"
                      asChild
                    >
                      <Link to="/about">
                        <Building className="mr-2 h-4 w-4" />
                        Learn About Us
                      </Link>
                    </Button>
                  </div>
                </div>
                <div className="space-y-4">
                  {[
                    { icon: Component, value: `${COMPONENTS_COUNT}+`, label: 'UI Components' },
                    { icon: Layers, value: `${SECTIONS_COUNT}+`, label: 'Section Templates' },
                    { icon: Palette, value: `${COLOR_TOKENS_COUNT}+`, label: 'Colour Tokens' },
                  ].map((stat) => {
                    const Icon = stat.icon;
                    return (
                      <div
                        key={stat.label}
                        className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm"
                      >
                        <div className="flex items-center space-x-3">
                          <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                            <Icon className="h-5 w-5 text-primary" />
                          </div>
                          <div>
                            <div className="text-2xl font-bold text-black">{stat.value}</div>
                            <div className="text-sm text-gray-600">{stat.label}</div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="mt-8 text-center">
            <Alert className="border-primary/20 bg-primary/5 max-w-2xl mx-auto">
              <Info className="h-4 w-4 text-primary" />
              <AlertDescription className="text-sm text-gray-600">
                <strong className="text-black">Exclusive Partnership:</strong> This design system
                represents Navigate Wealth's commitment to excellence in the Independent Financial
                Advisory space. Contact us to explore collaboration opportunities.
              </AlertDescription>
            </Alert>
          </div>
        </div>
      </div>
    </section>
  );
}
