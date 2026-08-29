/**
 * Static marketing sections of the home page: the services preview, the
 * "Why us?" panel, the provider logo carousel, and the customer reviews.
 * The carousel takes its position/handlers from HomePage; everything else
 * renders the shared static data.
 */
import { Link } from 'react-router';
import { Button } from '../ui/button';
import { Card, CardContent } from '../ui/card';
import { OptimizedImage } from '../shared/OptimizedImage';
import { ProviderLogo } from '../shared/ProviderLogo';
import { ResponsiveImage } from '../shared/ResponsiveImage';
import { Avatar, AvatarFallback } from '../ui/avatar';
// WORKAROUND: consultationImage reused as retirementPlanningImage — same asset hash.
// If a distinct retirement image is added in Figma, replace this alias.
import { prefetchImages } from '../../hooks/useImagePrefetch';
import { getOptimizedImageUrl } from '../../utils/optimizedImages';
import { ArrowRight, Star, ChevronLeft, ChevronRight, Zap, Heart, Globe } from 'lucide-react';
import { services, providers } from './homePageData';

export function ServicesPreviewSection({ onOpenCashback }: { onOpenCashback: () => void }) {
  return (
    <section className="py-24 section-white">
      <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 xl:px-12">
        <div className="text-center mb-16">
          <h2 className="text-black mb-6">Our Services</h2>
          <p className="text-gray-600 max-w-3xl mx-auto text-lg">
            Comprehensive financial solutions designed to protect and grow your wealth at every
            stage of life.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {services.map((service, index) => {
            const isPrimaryCard = index === 0;
            const hoverPrefetch = () => {
              if (!service.imageKey) return;
              prefetchImages([getOptimizedImageUrl(service.imageKey, 1024, 'webp')]);
            };
            return (
              <Card
                key={index}
                className="group bg-white border border-gray-300 shadow-sm hover:shadow-lg transition-all duration-300 overflow-hidden"
                onMouseEnter={hoverPrefetch}
              >
                {/* Clean Image Section */}
                <div className="relative aspect-[4/3] overflow-hidden">
                  {service.imageKey ? (
                    <ResponsiveImage
                      imageKey={service.imageKey}
                      fallbackSrc={service.image}
                      alt={service.title}
                      width={400}
                      height={300}
                      loading={isPrimaryCard ? 'eager' : 'lazy'}
                      fetchPriority={isPrimaryCard ? 'high' : 'auto'}
                      sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, (max-width: 1280px) 33vw, 25vw"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 high-quality-image"
                    />
                  ) : (
                    <OptimizedImage
                      src={service.image}
                      alt={service.title}
                      width={400}
                      height={300}
                      priority={isPrimaryCard}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 high-quality-image"
                      loading={isPrimaryCard ? 'eager' : 'lazy'}
                      fetchpriority={isPrimaryCard ? 'high' : 'auto'}
                      sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, (max-width: 1280px) 33vw, 25vw"
                    />
                  )}

                  {/* Simple Icon Badge */}
                  <div className="absolute top-3 left-3 w-10 h-10 bg-white rounded-lg shadow-sm flex items-center justify-center">
                    <service.icon className="h-5 w-5 text-primary" />
                  </div>
                </div>

                {/* Clean Content Section */}
                <div className="p-6">
                  <div className="space-y-3">
                    <h3 className="text-gray-900 text-lg font-semibold line-clamp-1">
                      {service.title}
                    </h3>

                    <p className="text-gray-600 leading-relaxed line-clamp-3 text-[13px]">
                      {service.description}
                    </p>
                  </div>

                  {/* Clean Action Button */}
                  <div className="mt-4 pt-2">
                    {service.title === 'Cashback' ? (
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full group/btn border-gray-200 text-gray-700 hover:border-primary hover:text-primary hover:bg-primary/5 transition-all duration-200"
                        onClick={() => onOpenCashback()}
                      >
                        <span>Learn More</span>
                        <ArrowRight className="ml-2 h-3 w-3 group-hover/btn:translate-x-0.5 transition-transform duration-200" />
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full group/btn border-gray-200 text-gray-700 hover:border-primary hover:text-primary hover:bg-primary/5 transition-all duration-200"
                        asChild
                      >
                        <Link to={service.link}>
                          <span>Learn More</span>
                          <ArrowRight className="ml-2 h-3 w-3 group-hover/btn:translate-x-0.5 transition-transform duration-200" />
                        </Link>
                      </Button>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      </div>
    </section>
  );
}

export function WhyNavigateSection() {
  return (
    <section className="py-20 section-dark-gray">
      <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 xl:px-12">
        <div className="text-center mb-16">
          <h2 className="text-white mb-4">Why us?</h2>
        </div>

        <div className="grid md:grid-cols-3 gap-8 lg:gap-12 xl:gap-16">
          <div className="text-center space-y-4">
            <div className="w-16 h-16 bg-primary/20 rounded-lg flex items-center justify-center mx-auto">
              <Globe className="h-8 w-8 text-primary" />
            </div>
            <h3 className="text-white">We're Independent</h3>
            <p className="text-gray-300">
              Unbiased advice and access to top-tier products from multiple providers.
            </p>
          </div>

          <div className="text-center space-y-4">
            <div className="w-16 h-16 bg-primary/20 rounded-lg flex items-center justify-center mx-auto">
              <Heart className="h-8 w-8 text-primary" />
            </div>
            <h3 className="text-white">We're Customer-Centric</h3>
            <p className="text-gray-300">
              We tailor all planning around each client's goals, values, and timeline.
            </p>
          </div>

          <div className="text-center space-y-4">
            <div className="w-16 h-16 bg-primary/20 rounded-lg flex items-center justify-center mx-auto">
              <Zap className="h-8 w-8 text-primary" />
            </div>
            <h3 className="text-white">We're Technology-Enabled</h3>
            <p className="text-gray-300">
              We integrate tech to streamline onboarding, analysis, and portfolio monitoring.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

export function ProvidersCarouselSection({
  currentProviderIndex,
  onNext,
  onPrev,
  onGoTo,
  onViewAll,
}: {
  currentProviderIndex: number;
  onNext: () => void;
  onPrev: () => void;
  onGoTo: (index: number) => void;
  onViewAll: () => void;
}) {
  return (
    <section className="py-20 section-white">
      <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 xl:px-12">
        <div className="text-center mb-16">
          <h2 className="text-black mb-4">Trusted Partners</h2>
          <p className="text-gray-600 max-w-3xl mx-auto">
            Navigate Wealth only works with the best product providers to ensure that you receive
            the highest quality financial solutions.
          </p>
        </div>

        <div className="relative max-w-6xl mx-auto">
          {/* Navigation Buttons */}
          <Button
            variant="ghost"
            size="sm"
            onClick={onPrev}
            className="absolute -left-4 lg:-left-8 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-white shadow-md border border-gray-200 text-gray-600 hover:text-primary hover:border-primary hover:shadow-lg transition-all duration-200"
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={onNext}
            className="absolute -right-4 lg:-right-8 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-white shadow-md border border-gray-200 text-gray-600 hover:text-primary hover:border-primary hover:shadow-lg transition-all duration-200"
          >
            <ChevronRight className="h-5 w-5" />
          </Button>

          {/* Logo Grid - Clean Layout */}
          <div className="overflow-visible px-4 sm:px-8 lg:px-12">
            <div className="flex justify-center">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 lg:gap-12 xl:gap-16 w-full max-w-5xl">
                {providers
                  .slice(currentProviderIndex, Math.min(currentProviderIndex + 4, providers.length))
                  .map((provider, index) => {
                    const actualIndex = currentProviderIndex + index;
                    return (
                      <div
                        key={`${provider.name}-${actualIndex}`}
                        className="flex items-center justify-center py-6 sm:py-8 px-2 group cursor-default"
                      >
                        <ProviderLogo
                          src={provider.logo}
                          alt={`${provider.name} logo`}
                          width={200}
                          height={100}
                          className="h-12 sm:h-14 lg:h-20 xl:h-24 w-full max-w-full object-contain opacity-85 group-hover:opacity-100 transition-all duration-300 group-hover:scale-105 high-quality-image filter grayscale-0"
                          loading="lazy"
                          sizes="(max-width: 640px) 120px, (max-width: 768px) 150px, (max-width: 1024px) 180px, 200px"
                        />
                      </div>
                    );
                  })}

                {/* Fill empty spaces when less than 4 items */}
                {Array.from({
                  length: Math.max(
                    0,
                    4 -
                      (Math.min(currentProviderIndex + 4, providers.length) - currentProviderIndex),
                  ),
                }).map((_, index) => (
                  <div key={`empty-${index}`} className="py-6 sm:py-8 px-2 hidden lg:block"></div>
                ))}
              </div>
            </div>
          </div>

          {/* Pagination Dots */}
          <div className="flex justify-center mt-8 space-x-2">
            {Array.from({ length: Math.ceil(providers.length / 4) }).map((_, index) => (
              <button
                key={index}
                onClick={() => onGoTo(index * 4)}
                className={`w-2 h-2 rounded-full transition-all duration-300 ${
                  Math.floor(currentProviderIndex / 4) === index
                    ? 'bg-primary scale-125'
                    : 'bg-gray-300 hover:bg-gray-400'
                }`}
                aria-label={`Go to provider group ${index + 1}`}
              />
            ))}
          </div>
        </div>

        {/* View All Partners Button */}
        <div className="text-center mt-12">
          <Button
            variant="outline"
            className="border-gray-200 text-gray-600 hover:border-primary hover:text-primary hover:bg-primary/5 transition-all duration-200"
            onClick={() => onViewAll()}
          >
            View All Partners
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </div>
    </section>
  );
}

export function ReviewsSection() {
  return (
    <section className="py-20 section-dark-gray">
      <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 xl:px-12">
        <div className="text-center mb-16">
          <h2 className="text-white mb-4">What Our Clients Say</h2>
          <p className="text-gray-300 max-w-3xl mx-auto">
            Don't just take our word for it. Here's what our valued clients have to say about their
            experience with Navigate Wealth.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 lg:gap-10">
          {/* Review 1 */}
          <Card className="border border-gray-600 bg-gray-800/50 backdrop-blur-sm">
            <CardContent className="p-6">
              <div className="flex items-center mb-4">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="h-5 w-5 text-yellow-400 fill-current" />
                ))}
              </div>
              <p className="text-gray-300 mb-6 leading-relaxed">
                "Navigate Wealth transformed our financial planning approach. Their independent
                advice and personalized strategies helped us achieve our retirement goals faster
                than we thought possible."
              </p>
              <div className="flex items-center space-x-3">
                <Avatar className="h-10 w-10">
                  <AvatarFallback className="bg-primary/20 text-primary">SM</AvatarFallback>
                </Avatar>
                <div>
                  <div className="text-white font-medium">Sarah Mitchell</div>
                  <div className="text-gray-400 text-sm">Retired Teacher</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Review 2 */}
          <Card className="border border-gray-600 bg-gray-800/50 backdrop-blur-sm">
            <CardContent className="p-6">
              <div className="flex items-center mb-4">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="h-5 w-5 text-yellow-400 fill-current" />
                ))}
              </div>
              <p className="text-gray-300 mb-6 leading-relaxed">
                "The team's expertise in risk management saved our family from financial
                uncertainty. Their comprehensive approach covers all aspects of our financial
                well-being."
              </p>
              <div className="flex items-center space-x-3">
                <Avatar className="h-10 w-10">
                  <AvatarFallback className="bg-primary/20 text-primary">DT</AvatarFallback>
                </Avatar>
                <div>
                  <div className="text-white font-medium">David Thompson</div>
                  <div className="text-gray-400 text-sm">Business Owner</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Review 3 */}
          <Card className="border border-gray-600 bg-gray-800/50 backdrop-blur-sm">
            <CardContent className="p-6">
              <div className="flex items-center mb-4">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="h-5 w-5 text-yellow-400 fill-current" />
                ))}
              </div>
              <p className="text-gray-300 mb-6 leading-relaxed">
                "Professional, knowledgeable, and truly independent. Navigate Wealth helped us
                navigate complex investment decisions with confidence and clarity."
              </p>
              <div className="flex items-center space-x-3">
                <Avatar className="h-10 w-10">
                  <AvatarFallback className="bg-primary/20 text-primary">LP</AvatarFallback>
                </Avatar>
                <div>
                  <div className="text-white font-medium">Lisa Patel</div>
                  <div className="text-gray-400 text-sm">Medical Professional</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  );
}
