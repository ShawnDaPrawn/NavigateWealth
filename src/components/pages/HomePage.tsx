import React, { useState, useEffect, useRef, useCallback, Suspense } from 'react';
import { useImagePrefetch } from '../../hooks/useImagePrefetch';
import { getOptimizedImageUrl } from '../../utils/optimizedImages';
import { Link } from 'react-router';
import { SEO } from '../seo/SEO';
import { commonFAQs } from '../seo/seo-config';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '../ui/dialog';
import { OptimizedImage } from '../shared/OptimizedImage';
import { FAQSection } from '../shared/FAQSection';
const VideoModal = React.lazy(() =>
  import('../modals/VideoModal').then((m) => ({ default: m.VideoModal })),
);
const ProvidersModal = React.lazy(() =>
  import('../modals/ProvidersModal').then((m) => ({ default: m.ProvidersModal })),
);
const FeaturedInsights = React.lazy(() =>
  import('../shared/FeaturedInsights').then((m) => ({ default: m.FeaturedInsights })),
);
import { toast } from 'sonner';
import { projectId, publicAnonKey } from '../../utils/supabase/info';
import saFlag from 'figma:asset/543ae964645db88228743731ee3eebbbc2e3686e.png';
// WORKAROUND: consultationImage reused as retirementPlanningImage — same asset hash.
// If a distinct retirement image is added in Figma, replace this alias.
import {
  ArrowRight,
  Shield,
  Target,
  TrendingUp,
  Gift,
  CheckCircle,
  Phone,
  Mail,
  MapPin,
  Star,
  Zap,
  Heart,
  Globe,
  Loader2,
} from 'lucide-react';
import { seoData, homePageStructuredData, heroSlides, providers, services } from './homePageData';
import {
  ServicesPreviewSection,
  WhyNavigateSection,
  ProvidersCarouselSection,
  ReviewsSection,
} from './homePageSections';

export function HomePage() {
  const [currentProviderIndex, setCurrentProviderIndex] = useState(0);
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [videoModalOpen, setVideoModalOpen] = useState(false);
  const [explainerVideoModalOpen, setExplainerVideoModalOpen] = useState(false);
  const [cashbackModalOpen, setCashbackModalOpen] = useState(false);
  const [providersModalOpen, setProvidersModalOpen] = useState(false);
  const [ctaSubmitting, setCtaSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    services: 'General consultation / All Service',
  });

  // ── Hero auto-advance ──────────────────────────────────────────
  const HERO_AUTO_ADVANCE_MS = 8_000;
  const heroProgressRef = useRef<number | null>(null);
  // Drive the hero progress bar imperatively via a DOM ref rather than React
  // state. The previous `setHeroProgress` per animation frame re-rendered the
  // whole homepage ~60×/sec continuously, which pinned a CPU core. Writing the
  // width directly to the node is visually identical with zero re-renders.
  const heroProgressBarRef = useRef<HTMLDivElement | null>(null);

  const nextSlideStable = useCallback(() => {
    setCurrentSlideIndex((prev) => (prev + 1) % 4); // 4 slides
  }, []);

  useEffect(() => {
    if (heroProgressBarRef.current) heroProgressBarRef.current.style.width = '0%';
    const start = Date.now();
    const tick = () => {
      const pct = Math.min(((Date.now() - start) / HERO_AUTO_ADVANCE_MS) * 100, 100);
      if (heroProgressBarRef.current) heroProgressBarRef.current.style.width = `${pct}%`;
      if (pct >= 100) {
        nextSlideStable();
      } else {
        heroProgressRef.current = requestAnimationFrame(tick);
      }
    };
    heroProgressRef.current = requestAnimationFrame(tick);
    return () => {
      if (heroProgressRef.current) cancelAnimationFrame(heroProgressRef.current);
    };
  }, [currentSlideIndex, nextSlideStable]);

  const heroGoToSlide = useCallback((index: number) => {
    if (heroProgressRef.current) cancelAnimationFrame(heroProgressRef.current);
    if (heroProgressBarRef.current) heroProgressBarRef.current.style.width = '0%';
    setCurrentSlideIndex(index);
  }, []);

  // Get SEO data for home page

  // Preload the smallest truly critical above-the-fold asset for better performance
  useEffect(() => {
    const criticalImages = [saFlag];

    criticalImages.forEach((src) => {
      const link = document.createElement('link');
      link.rel = 'preload';
      link.as = 'image';
      link.href = src;
      link.fetchPriority = 'high';
      document.head.appendChild(link);
    });

    // Cleanup preload links on unmount
    return () => {
      criticalImages.forEach((src) => {
        const existingLink = document.querySelector(`link[href="${src}"]`);
        if (existingLink) {
          document.head.removeChild(existingLink);
        }
      });
    };
  }, []);

  // Background prefetch: while the user stays on Home, warm the cache for
  // likely next pages (optimized, right-sized variants only).
  useImagePrefetch(
    services.filter((s) => !!s.imageKey).map((s) => getOptimizedImageUrl(s.imageKey!, 768, 'webp')),
    { delayMs: 3000, idleTimeoutMs: 4000 },
  );

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate required fields
    if (!formData.firstName || !formData.lastName || !formData.email) {
      toast.error('Please fill in all required fields');
      return;
    }

    setCtaSubmitting(true);

    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-91ed8379/contact-form/submit`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${publicAnonKey}`,
          },
          body: JSON.stringify({
            firstName: formData.firstName.trim(),
            lastName: formData.lastName.trim(),
            email: formData.email.trim(),
            phone: formData.phone.trim() || '',
            service: formData.services,
            message: '',
            clientType: '',
          }),
        },
      );

      const result = await response.json();

      if (!response.ok) {
        console.error('Home CTA submission error:', result);
        toast.error(result.error || 'Something went wrong. Please try again.');
        return;
      }

      toast.success('Thank you for your interest!', {
        description: `Hi ${formData.firstName}, we've received your inquiry about ${formData.services}. Our team will contact you within 24 hours to discuss your financial goals.`,
        duration: 6000,
      });

      // Reset form after successful submission
      setFormData({
        firstName: '',
        lastName: '',
        email: '',
        phone: '',
        services: 'General consultation / All Service',
      });
    } catch (error) {
      console.error('Home CTA network error:', error);
      toast.error('Unable to submit your request. Please check your connection and try again.');
    } finally {
      setCtaSubmitting(false);
    }
  };

  const nextProvider = () => {
    setCurrentProviderIndex((prev) => {
      const next = prev + 4;
      return next >= providers.length ? 0 : next;
    });
  };

  const prevProvider = () => {
    setCurrentProviderIndex((prev) => {
      const previous = prev - 4;
      return previous < 0 ? Math.floor((providers.length - 1) / 4) * 4 : previous;
    });
  };

  const currentSlide = heroSlides[currentSlideIndex];

  return (
    <div className="contents">
      {/* SEO Meta Tags */}
      <SEO
        title={seoData.title}
        description={seoData.description}
        keywords={seoData.keywords}
        canonicalUrl={seoData.canonicalUrl}
        ogType={seoData.ogType}
        structuredData={homePageStructuredData}
      />

      <div className="min-h-screen section-white">
        {/* ═══ HERO — Clean & Confident (v4) ═══ */}
        <section className="relative overflow-hidden bg-[#111827]" aria-label="Hero">
          {/* Background — single subtle gradient, no busy patterns */}
          <div className="absolute inset-0 bg-gradient-to-b from-[#111827] via-[#161b33] to-[#111827] pointer-events-none" />
          <div
            className="absolute top-0 right-0 w-[600px] h-[600px] rounded-full opacity-20 pointer-events-none"
            style={{
              background: 'radial-gradient(circle, rgba(109,40,217,0.25) 0%, transparent 70%)',
            }}
          />

          {/* Content */}
          <div className="relative z-10 max-w-screen-xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col items-center text-center py-20 lg:py-28">
              {/* SA Flag pill */}
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/[0.06] border border-white/[0.08] mb-8 animate-fade-in">
                <OptimizedImage
                  src={saFlag}
                  alt="South African Flag"
                  width={24}
                  height={17}
                  priority={true}
                  className="w-6 h-[17px] rounded-[2px] border border-white/15 object-cover"
                  fetchpriority="high"
                  loading="eager"
                />
                <span className="text-[12px] font-medium text-gray-400 tracking-wide">
                  Proudly South African · Independent · FSP 54606
                </span>
              </div>

              {/* Heading */}
              <div
                key={`heading-${currentSlide.id}`}
                className="max-w-3xl space-y-5 animate-slide-up"
              >
                <h1 className="!text-[clamp(2rem,5vw,3.5rem)] !font-extrabold !leading-[1.1] text-white tracking-tight">
                  {currentSlide.title}{' '}
                  <span className="bg-gradient-to-r from-purple-400 to-violet-300 bg-clip-text text-transparent">
                    {currentSlide.titleAccent}
                  </span>
                </h1>
                <p className="text-gray-400 text-base sm:text-lg max-w-2xl mx-auto leading-relaxed">
                  {currentSlide.description}
                </p>
              </div>

              {/* CTA buttons */}
              <div
                key={`cta-${currentSlide.id}`}
                className="flex flex-col sm:flex-row gap-3 mt-10 animate-slide-up delay-100"
              >
                {currentSlide.primaryAction.link ? (
                  <Button
                    size="lg"
                    className="bg-primary text-primary-foreground hover:bg-primary/90 transition-colors duration-200 px-8 h-12 shadow-lg shadow-purple-600/20"
                    asChild
                  >
                    <Link to={currentSlide.primaryAction.link}>
                      {currentSlide.primaryAction.text}
                      <ArrowRight className="ml-2 h-5 w-5" />
                    </Link>
                  </Button>
                ) : (
                  <Button
                    size="lg"
                    className="bg-primary text-primary-foreground hover:bg-primary/90 transition-colors duration-200 px-8 h-12 shadow-lg shadow-purple-600/20"
                    onClick={(currentSlide.primaryAction as { action?: () => void }).action}
                  >
                    {currentSlide.primaryAction.text}
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Button>
                )}
                {currentSlide.secondaryAction.link ? (
                  <Button
                    size="lg"
                    variant="outline"
                    className="border-purple-400/30 bg-transparent text-purple-300 hover:bg-purple-500/15 hover:border-purple-400/50 hover:text-purple-200 transition-colors duration-200 px-8 h-12"
                    asChild
                  >
                    <Link to={currentSlide.secondaryAction.link}>
                      {currentSlide.secondaryAction.text}
                    </Link>
                  </Button>
                ) : (
                  <Button
                    size="lg"
                    variant="outline"
                    className="border-purple-400/30 bg-transparent text-purple-300 hover:bg-purple-500/15 hover:border-purple-400/50 hover:text-purple-200 transition-colors duration-200 px-8 h-12"
                    onClick={(currentSlide.secondaryAction as { action?: () => void }).action}
                  >
                    {currentSlide.secondaryAction.text}
                  </Button>
                )}
              </div>

              {/* Slide progress indicators */}
              <div className="flex items-center gap-2 mt-8">
                {heroSlides.map((slide, index) => {
                  const isActive = index === currentSlideIndex;
                  return (
                    <button
                      key={slide.id}
                      onClick={() => heroGoToSlide(index)}
                      className="group relative rounded-full overflow-hidden transition-all duration-300"
                      style={{ width: isActive ? 48 : 20, height: 5 }}
                      aria-label={`Go to slide ${index + 1}`}
                      aria-current={isActive ? 'true' : undefined}
                    >
                      <div className="absolute inset-0 bg-white/[0.12] rounded-full group-hover:bg-white/20 transition-colors" />
                      {isActive && (
                        <div
                          ref={heroProgressBarRef}
                          className="absolute inset-y-0 left-0 rounded-full bg-purple-400"
                          style={{ width: '0%', transition: 'none' }}
                        />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Stats strip */}
            <div className="relative z-10 border-t border-white/[0.06]">
              <div className="grid grid-cols-2 lg:grid-cols-4 divide-x divide-white/[0.06]">
                {[
                  { label: 'Years Experience', value: '15+', icon: Star },
                  { label: 'Product Partners', value: '12+', icon: Globe },
                  { label: 'Happy Clients', value: '100+', icon: Heart },
                  { label: 'Assets Under Advice', value: 'R500M+', icon: TrendingUp },
                ].map((stat) => (
                  <div
                    key={stat.label}
                    className="flex items-center gap-3 py-5 lg:py-6 justify-center"
                  >
                    <div className="w-9 h-9 rounded-lg bg-purple-500/[0.08] flex items-center justify-center flex-shrink-0">
                      <stat.icon className="h-[18px] w-[18px] text-purple-400/80" />
                    </div>
                    <div>
                      <div className="text-lg sm:text-xl font-bold text-white tracking-tight leading-none">
                        {stat.value}
                      </div>
                      <div className="text-[11px] text-gray-500 font-medium mt-0.5">
                        {stat.label}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <ServicesPreviewSection onOpenCashback={() => setCashbackModalOpen(true)} />

        <WhyNavigateSection />

        <ProvidersCarouselSection
          currentProviderIndex={currentProviderIndex}
          onNext={nextProvider}
          onPrev={prevProvider}
          onGoTo={(index) => setCurrentProviderIndex(index)}
          onViewAll={() => setProvidersModalOpen(true)}
        />

        <ReviewsSection />

        {/* Featured Insights — dynamically populated from published featured articles */}
        <Suspense fallback={null}>
          <FeaturedInsights />
        </Suspense>

        {/* FAQ — same content as the FAQPage JSON-LD emitted above */}
        <FAQSection
          faqs={commonFAQs}
          subtitle="Answers to the questions South Africans ask us most about independent financial advice."
        />

        {/* Get Started CTA Section */}
        <section className="relative py-16 sm:py-20 overflow-hidden bg-[#1e2035]">
          {/* Background decoration */}
          <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
            <div className="absolute top-0 right-0 w-[600px] h-[600px] rounded-full bg-primary/10 blur-[120px] -translate-y-1/3 translate-x-1/4" />
            <div className="absolute bottom-0 left-0 w-[400px] h-[400px] rounded-full bg-primary/8 blur-[100px] translate-y-1/3 -translate-x-1/4" />
          </div>

          <div className="relative max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 xl:px-12">
            <div className="grid lg:grid-cols-2 gap-10 lg:gap-16 items-center">
              {/* Left Column — Messaging & Contact */}
              <div className="space-y-8">
                <div className="space-y-4">
                  <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/15 border border-primary/20">
                    <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                    <span className="text-xs font-medium text-primary-foreground/80">
                      Free initial consultation
                    </span>
                  </div>
                  <h2 className="!text-[28px] sm:!text-[32px] !font-bold !leading-tight text-white">
                    Take the First Step Toward
                    <br className="hidden sm:block" /> Your Financial Future
                  </h2>
                  <p className="text-gray-400 text-base max-w-lg leading-relaxed">
                    Our independent advisers evaluate solutions from 30+ trusted partners to
                    recommend what's truly best for your goals.
                  </p>
                </div>

                {/* Trust points */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {[
                    { text: 'Personalised financial advice', icon: Target },
                    { text: 'Independent & unbiased', icon: Shield },
                    { text: 'No-obligation consultation', icon: CheckCircle },
                    { text: 'Response within 24 hours', icon: Zap },
                  ].map(({ text, icon: Icon }) => (
                    <div key={text} className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-md bg-primary/15 flex items-center justify-center flex-shrink-0">
                        <Icon className="h-3.5 w-3.5 text-purple-400" />
                      </div>
                      <span className="text-sm text-gray-300">{text}</span>
                    </div>
                  ))}
                </div>

                {/* Contact strip */}
                <div className="flex flex-col sm:flex-row gap-4 sm:gap-6 pt-2">
                  <a href="tel:+27126672505" className="flex items-center gap-2.5 group">
                    <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center group-hover:bg-primary/30 transition-colors">
                      <Phone className="h-4 w-4 text-purple-400" />
                    </div>
                    <div>
                      <div className="text-[11px] text-gray-500 font-medium uppercase tracking-wider">
                        Call us
                      </div>
                      <div className="text-sm text-white font-medium">+27 12 667 2505</div>
                    </div>
                  </a>
                  <a
                    href="mailto:info@navigatewealth.co"
                    className="flex items-center gap-2.5 group"
                  >
                    <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center group-hover:bg-primary/30 transition-colors">
                      <Mail className="h-4 w-4 text-purple-400" />
                    </div>
                    <div>
                      <div className="text-[11px] text-gray-500 font-medium uppercase tracking-wider">
                        Email
                      </div>
                      <div className="text-sm text-white font-medium">info@navigatewealth.co</div>
                    </div>
                  </a>
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center">
                      <MapPin className="h-4 w-4 text-purple-400" />
                    </div>
                    <div>
                      <div className="text-[11px] text-gray-500 font-medium uppercase tracking-wider">
                        Office
                      </div>
                      <div className="text-sm text-white font-medium">Irene, Centurion</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Column — Form Card */}
              <div className="bg-white rounded-2xl shadow-2xl shadow-black/20 p-6 sm:p-8">
                <div className="mb-6">
                  <h3 className="!text-lg !font-semibold text-gray-900 mb-1">Get Started</h3>
                  <p className="text-sm text-gray-500">
                    Fill in your details and we'll be in touch within 24 hours.
                  </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="firstName" className="text-xs font-medium text-gray-700">
                        First Name *
                      </Label>
                      <Input
                        id="firstName"
                        value={formData.firstName}
                        onChange={(e) => handleInputChange('firstName', e.target.value)}
                        required
                        placeholder="First Name"
                        className="h-10 bg-gray-50 border-gray-200 focus:border-primary focus:ring-primary/20 text-sm"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="lastName" className="text-xs font-medium text-gray-700">
                        Last Name *
                      </Label>
                      <Input
                        id="lastName"
                        value={formData.lastName}
                        onChange={(e) => handleInputChange('lastName', e.target.value)}
                        required
                        placeholder="Last Name"
                        className="h-10 bg-gray-50 border-gray-200 focus:border-primary focus:ring-primary/20 text-sm"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="email" className="text-xs font-medium text-gray-700">
                      Email Address *
                    </Label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => handleInputChange('email', e.target.value)}
                      required
                      placeholder="your.email@example.com"
                      className="h-10 bg-gray-50 border-gray-200 focus:border-primary focus:ring-primary/20 text-sm"
                    />
                  </div>

                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="phone" className="text-xs font-medium text-gray-700">
                        Phone Number
                      </Label>
                      <Input
                        id="phone"
                        type="tel"
                        value={formData.phone}
                        onChange={(e) => handleInputChange('phone', e.target.value)}
                        placeholder="+27 12 345 6789"
                        className="h-10 bg-gray-50 border-gray-200 focus:border-primary focus:ring-primary/20 text-sm"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="services" className="text-xs font-medium text-gray-700">
                        Service of Interest
                      </Label>
                      <Select
                        value={formData.services}
                        onValueChange={(value) => handleInputChange('services', value)}
                      >
                        <SelectTrigger className="h-10 bg-gray-50 border-gray-200 focus:border-primary focus:ring-primary/20 text-sm">
                          <SelectValue placeholder="Select a service..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="General consultation / All Service">
                            General consultation
                          </SelectItem>
                          <SelectItem value="Risk Management">Risk Management</SelectItem>
                          <SelectItem value="Medical Aid">Medical Aid</SelectItem>
                          <SelectItem value="Investment Management">
                            Investment Management
                          </SelectItem>
                          <SelectItem value="Retirement Planning">Retirement Planning</SelectItem>
                          <SelectItem value="Group Benefits">Group Benefits</SelectItem>
                          <SelectItem value="Tax Planning">Tax Planning</SelectItem>
                          <SelectItem value="Estate Planning">Estate Planning</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <Button
                    type="submit"
                    size="lg"
                    disabled={ctaSubmitting}
                    className="w-full bg-primary text-primary-foreground hover:bg-primary/90 transition-all duration-200 h-11 text-sm font-semibold mt-2"
                  >
                    {ctaSubmitting ? (
                      <div className="contents">
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        Submitting...
                      </div>
                    ) : (
                      <div className="contents">
                        Get Started Today
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </div>
                    )}
                  </Button>

                  <p className="text-[11px] text-gray-400 text-center leading-relaxed pt-1">
                    By submitting, you agree to be contacted by our team. Your data is secure and
                    will never be shared with third parties.
                  </p>
                </form>
              </div>
            </div>
          </div>
        </section>

        {/* Video Modals */}
        <Suspense fallback={null}>
          <VideoModal
            isOpen={videoModalOpen}
            onClose={() => setVideoModalOpen(false)}
            title="Meet Our Team"
            videoUrl="/videos/team-introduction.mp4"
            description="Get to know the dedicated team behind Navigate Wealth"
          />

          <VideoModal
            isOpen={explainerVideoModalOpen}
            onClose={() => setExplainerVideoModalOpen(false)}
            title="How Navigate Wealth Works"
            videoUrl="/videos/explainer.mp4"
            description="Learn how our comprehensive financial planning process works"
          />
        </Suspense>

        {/* Cashback Modal */}
        <Dialog open={cashbackModalOpen} onOpenChange={setCashbackModalOpen}>
          <DialogContent className="max-w-lg">
            <DialogTitle>Monthly Cashback Rewards</DialogTitle>
            <DialogDescription>
              Earn cashback rewards on your financial products and policies
            </DialogDescription>
            <div className="space-y-4 pt-4">
              <div className="flex items-center space-x-2 p-4 bg-primary/5 rounded-lg">
                <Gift className="h-6 w-6 text-primary" />
                <div>
                  <h4 className="font-medium text-gray-900">Earn While You Save</h4>
                  <p className="text-sm text-gray-600">
                    Get monthly cashback on all your policies and financial products.
                  </p>
                </div>
              </div>
              <p className="text-gray-600">
                Our cashback program rewards you for making smart financial decisions. Earn monthly
                returns on qualifying policies including life insurance, investments, and retirement
                planning products.
              </p>
              <div className="flex gap-3 pt-2">
                <Button className="bg-primary text-primary-foreground hover:bg-primary/90" asChild>
                  <Link to="/services">Learn More</Link>
                </Button>
                <Button variant="outline" onClick={() => setCashbackModalOpen(false)}>
                  Close
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Providers Modal */}
        <Suspense fallback={null}>
          <ProvidersModal
            isOpen={providersModalOpen}
            onClose={() => setProvidersModalOpen(false)}
          />
        </Suspense>
      </div>
    </div>
  );
}

export default HomePage;
