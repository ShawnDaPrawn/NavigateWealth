/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * HeroSection — Premium redesigned hero for Navigate Wealth homepage
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Design approach:
 *   • Left-aligned text with gradient accent (desktop) / centered on mobile
 *   • Auto-advancing slides with progress bar indicators
 *   • Right-column: floating glassmorphism trust cards with gentle animation
 *   • Animated stat counters at the bottom
 *   • Subtle depth with layered gradients and a dot-grid pattern
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 */
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Link } from 'react-router';
import { Button } from '../../ui/button';
import { OptimizedImage } from '../../shared/OptimizedImage';
import {
  ArrowRight,
  Play,
  Shield,
  TrendingUp,
  Users,
  Award,
  CheckCircle,
  Globe,
} from 'lucide-react';

import saFlag from 'figma:asset/543ae964645db88228743731ee3eebbbc2e3686e.png';

// ── Types ────────────────────────────────────────────────────────────────────

export interface HeroSlide {
  id: number;
  title: string;
  titleAccent: string;
  description: string;
  primaryAction: {
    text: string;
    link?: string;
    action?: () => void;
  };
  secondaryAction: {
    text: string;
    link?: string;
    action?: () => void;
  };
}

interface HeroSectionProps {
  slides: HeroSlide[];
  currentSlideIndex: number;
  onPrevSlide: () => void;
  onNextSlide: () => void;
  onGoToSlide: (index: number) => void;
}

// ── Constants ────────────────────────────────────────────────────────────────

const AUTO_ADVANCE_MS = 7_000;

const STATS = [
  { label: 'Years Experience', value: 15, suffix: '+', icon: Award },
  { label: 'Trusted Partners', value: 30, suffix: '+', icon: Globe },
  { label: 'Happy Clients', value: 1_000, suffix: '+', icon: Users },
  { label: 'Assets Managed', value: 2.5, suffix: 'B+', prefix: 'R', icon: TrendingUp },
] as const;

const TRUST_CARDS = [
  {
    icon: Shield,
    title: 'FSP 54606',
    subtitle: 'FSCA Regulated',
    color: 'from-purple-500/20 to-indigo-500/20',
    border: 'border-purple-400/20',
  },
  {
    icon: CheckCircle,
    title: 'Independent',
    subtitle: '30+ Providers',
    color: 'from-emerald-500/20 to-teal-500/20',
    border: 'border-emerald-400/20',
  },
  {
    icon: TrendingUp,
    title: 'Growth Focused',
    subtitle: 'Proven Strategies',
    color: 'from-amber-500/20 to-orange-500/20',
    border: 'border-amber-400/20',
  },
] as const;

// ── Animated Counter Hook ────────────────────────────────────────────────────

function useCountUp(target: number, duration = 2000, startDelay = 400) {
  const [count, setCount] = useState(0);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    const timeout = setTimeout(() => {
      const isDecimal = target % 1 !== 0;
      const steps = 60;
      const increment = target / steps;
      let current = 0;
      let step = 0;

      const interval = setInterval(() => {
        step++;
        current += increment;
        if (step >= steps) {
          setCount(target);
          clearInterval(interval);
        } else {
          setCount(isDecimal ? parseFloat(current.toFixed(1)) : Math.round(current));
        }
      }, duration / steps);
    }, startDelay);

    return () => clearTimeout(timeout);
  }, [target, duration, startDelay]);

  return count;
}

// ── Main Component ───────────────────────────────────────────────────────────

export function HeroSection({
  slides,
  currentSlideIndex,
  onNextSlide,
  onGoToSlide,
}: HeroSectionProps) {
  const currentSlide = slides[currentSlideIndex];
  const progressRef = useRef<number | null>(null);
  const [progress, setProgress] = useState(0);

  // Auto-advance slides
  useEffect(() => {
    setProgress(0);
    const start = Date.now();

    const tick = () => {
      const elapsed = Date.now() - start;
      const pct = Math.min((elapsed / AUTO_ADVANCE_MS) * 100, 100);
      setProgress(pct);

      if (pct >= 100) {
        onNextSlide();
      } else {
        progressRef.current = requestAnimationFrame(tick);
      }
    };

    progressRef.current = requestAnimationFrame(tick);

    return () => {
      if (progressRef.current) cancelAnimationFrame(progressRef.current);
    };
  }, [currentSlideIndex, onNextSlide]);

  const handleGoToSlide = useCallback(
    (index: number) => {
      if (progressRef.current) cancelAnimationFrame(progressRef.current);
      setProgress(0);
      onGoToSlide(index);
    },
    [onGoToSlide],
  );

  return (
    <section className="relative overflow-hidden bg-[#1a1e36]" aria-label="Hero">
      {/* ── Layered Background ─────────────────────────────────────────── */}
      {/* Primary gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#1a1e36] via-[#252a47] to-[#1a1e36]" />

      {/* Purple radial glow — upper-right */}
      <div className="absolute -top-40 -right-40 w-[700px] h-[700px] rounded-full bg-purple-600/8 blur-[120px]" />

      {/* Secondary glow — lower-left */}
      <div className="absolute -bottom-60 -left-40 w-[500px] h-[500px] rounded-full bg-indigo-600/6 blur-[100px]" />

      {/* Dot grid pattern */}
      <div
        className="absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage:
            'radial-gradient(circle, rgba(255,255,255,0.8) 1px, transparent 1px)',
          backgroundSize: '32px 32px',
        }}
      />

      {/* ── Content ────────────────────────────────────────────────────── */}
      <div className="relative z-10 max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 xl:px-12">
        <div className="grid lg:grid-cols-2 gap-8 lg:gap-16 items-center min-h-[600px] lg:min-h-[680px] py-16 lg:py-20">
          {/* ── Left Column — Text Content ──────────────────────────────── */}
          <div className="text-center lg:text-left space-y-6 lg:space-y-8 pt-4 lg:pt-0">
            {/* SA Badge */}
            <div className="flex items-center justify-center lg:justify-start gap-2.5 animate-fade-in">
              <OptimizedImage
                src={saFlag}
                alt="South African Flag"
                width={36}
                height={27}
                priority={true}
                className="w-9 h-[27px] rounded-[3px] border border-white/20 object-cover"
                fetchPriority="high"
                loading="eager"
              />
              <span className="text-[13px] font-medium text-gray-400 tracking-wide">
                Proudly South African · Independent · FSP 54606
              </span>
            </div>

            {/* Heading — key transition on slide change */}
            <div
              key={`heading-${currentSlide.id}`}
              className="space-y-4 animate-slide-up"
            >
              <h1 className="!text-[clamp(2rem,5vw,3.5rem)] !font-extrabold !leading-[1.1] text-white tracking-tight">
                {currentSlide.title}
                <span className="bg-gradient-to-r from-purple-400 via-violet-400 to-indigo-400 bg-clip-text text-transparent">
                  {currentSlide.titleAccent}
                </span>
              </h1>

              <p className="text-gray-400 text-base sm:text-lg max-w-xl mx-auto lg:mx-0 leading-relaxed">
                {currentSlide.description}
              </p>
            </div>

            {/* CTA Buttons */}
            <div
              key={`cta-${currentSlide.id}`}
              className="flex flex-col sm:flex-row gap-3 justify-center lg:justify-start animate-slide-up delay-100"
            >
              {currentSlide.primaryAction.link ? (
                <Button
                  size="lg"
                  className="h-12 px-8 bg-purple-600 hover:bg-purple-500 text-white font-semibold shadow-lg shadow-purple-600/25 hover:shadow-purple-500/30 transition-all duration-200 hover:-translate-y-0.5"
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
                  className="h-12 px-8 bg-purple-600 hover:bg-purple-500 text-white font-semibold shadow-lg shadow-purple-600/25 hover:shadow-purple-500/30 transition-all duration-200 hover:-translate-y-0.5"
                  onClick={currentSlide.primaryAction.action}
                >
                  {currentSlide.primaryAction.text}
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              )}

              {currentSlide.secondaryAction.link ? (
                <Button
                  size="lg"
                  variant="outline"
                  className="h-12 px-8 border-purple-400/30 bg-transparent text-purple-300 hover:bg-purple-500/15 hover:border-purple-400/50 hover:text-purple-200 font-medium backdrop-blur-sm transition-all duration-200"
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
                  className="h-12 px-8 border-purple-400/30 bg-transparent text-purple-300 hover:bg-purple-500/15 hover:border-purple-400/50 hover:text-purple-200 font-medium backdrop-blur-sm transition-all duration-200"
                  onClick={currentSlide.secondaryAction.action}
                >
                  <Play className="mr-2 h-5 w-5" />
                  {currentSlide.secondaryAction.text}
                </Button>
              )}
            </div>

            {/* Slide Progress Indicators */}
            <div className="flex items-center gap-2 justify-center lg:justify-start pt-2">
              {slides.map((_, index) => {
                const isActive = index === currentSlideIndex;
                return (
                  <button
                    key={index}
                    onClick={() => handleGoToSlide(index)}
                    className="group relative h-1.5 rounded-full overflow-hidden transition-all duration-300"
                    style={{ width: isActive ? 48 : 24 }}
                    aria-label={`Go to slide ${index + 1}`}
                    aria-current={isActive ? 'true' : undefined}
                  >
                    <div className="absolute inset-0 bg-white/20 rounded-full group-hover:bg-white/30 transition-colors" />
                    {isActive && (
                      <div
                        className="absolute inset-y-0 left-0 bg-purple-400 rounded-full transition-none"
                        style={{ width: `${progress}%` }}
                      />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* ── Right Column — Floating Trust Cards (desktop only) ──────── */}
          <div className="hidden lg:flex items-center justify-center relative" aria-hidden="true">
            {/* Glowing ring background */}
            <div className="absolute w-[420px] h-[420px] rounded-full border border-purple-500/10" />
            <div className="absolute w-[320px] h-[320px] rounded-full border border-purple-500/8" />
            <div className="absolute w-[220px] h-[220px] rounded-full border border-purple-500/5" />

            {/* Center emblem */}
            <div className="absolute w-24 h-24 rounded-2xl bg-gradient-to-br from-purple-600/30 to-indigo-600/30 backdrop-blur-md border border-white/10 flex items-center justify-center shadow-2xl shadow-purple-600/10">
              <TrendingUp className="h-10 w-10 text-purple-300" />
            </div>

            {/* Floating cards */}
            {TRUST_CARDS.map((card, i) => {
              const positions = [
                { top: '8%', right: '5%', animDelay: '0s' },
                { top: '55%', right: '0%', animDelay: '1.5s' },
                { top: '30%', left: '0%', animDelay: '3s' },
              ];
              const pos = positions[i];
              const Icon = card.icon;

              return (
                <div
                  key={card.title}
                  className="absolute"
                  style={{
                    ...pos,
                    animation: `hero-float 6s ease-in-out ${pos.animDelay} infinite`,
                  }}
                >
                  <div
                    className={`flex items-center gap-3 px-5 py-3.5 rounded-xl bg-gradient-to-br ${card.color} backdrop-blur-xl border ${card.border} shadow-lg`}
                  >
                    <div className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center flex-shrink-0">
                      <Icon className="h-5 w-5 text-white/90" />
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-white">{card.title}</div>
                      <div className="text-xs text-gray-400">{card.subtitle}</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Stats Bar ──────────────────────────────────────────────────── */}
        <div className="relative z-10 border-t border-white/[0.06] py-8 lg:py-10">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-8">
            {STATS.map((stat) => (
              <StatItem key={stat.label} {...stat} />
            ))}
          </div>
        </div>
      </div>

      {/* ── Inline keyframes for floating animation ──────────────────── */}
      <style>{`
        @keyframes hero-float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-14px); }
        }
      `}</style>
    </section>
  );
}

// ── Stat Counter Sub-Component ───────────────────────────────────────────────

function StatItem({
  label,
  value,
  suffix,
  prefix,
  icon: Icon,
}: {
  label: string;
  value: number;
  suffix: string;
  prefix?: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  const animatedValue = useCountUp(value, 2200, 600);

  const display =
    value % 1 !== 0
      ? animatedValue.toFixed(1)
      : animatedValue.toLocaleString();

  return (
    <div className="flex items-center gap-3 justify-center lg:justify-start group">
      <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center flex-shrink-0 group-hover:bg-purple-500/15 transition-colors">
        <Icon className="h-5 w-5 text-purple-400" />
      </div>
      <div>
        <div className="text-xl sm:text-2xl font-bold text-white tracking-tight">
          {prefix}
          {display}
          {suffix}
        </div>
        <div className="text-xs text-gray-500 font-medium">{label}</div>
      </div>
    </div>
  );
}