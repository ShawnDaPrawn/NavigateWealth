/**
 * CareersPage — Navigate Wealth Careers
 *
 * Hero section follows the unified company page hero standard:
 *   - bg-[#111827] with single subtle radial gradient glow
 *   - Centered layout with pill badge, gradient accent heading, gray-400 text
 *   - Clean CTA buttons without scale transforms
 *   - Stats bar and trust indicators
 *
 * Sections:
 *   1. Hero (dark — unified standard)
 *   2. Career Categories with job listings (white)
 *   3. Why Navigate Wealth values (dark)
 *   4. Perks & Benefits (white)
 *   5. CTA (dark)
 *
 * @module pages/CareersPage
 */

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Link } from 'react-router';
import { SEO, createWebPageSchema } from '../seo/SEO';
import { getSEOData } from '../seo/seo-config';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { CVUploadModal } from '../modals/CVUploadModal';
import { projectId, publicAnonKey } from '../../utils/supabase/info';
import {
  Briefcase,
  Users,
  FileText,
  TrendingUp,
  ArrowRight,
  CheckCircle,
  Shield,
  Megaphone,
  Star,
  Globe,
  MapPin,
  Clock,
  Calendar,
  Loader2,
  Award,
  Heart,
  Lightbulb,
  Target,
  Rocket,
  GraduationCap,
  Handshake,
  Coffee,
  ChevronRight,
  Building2,
  Zap,
  Send,
} from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

interface JobListing {
  id: string;
  title: string;
  category: string;
  location: string;
  type: string;
  description: string;
  requirements: string[];
  benefits: string[];
  closingDate?: string;
}

// ============================================================================
// Constants
// ============================================================================

const BASE_URL = `https://${projectId}.supabase.co/functions/v1/make-server-91ed8379/publications`;
const AUTH_HEADERS = { Authorization: `Bearer ${publicAnonKey}` };

const categories = [
  {
    id: 'advisory',
    title: 'Advisory',
    icon: Users,
    description: 'Client-facing roles providing financial advice and building lasting relationships.',
  },
  {
    id: 'administration',
    title: 'Administration',
    icon: FileText,
    description: 'Operational support roles ensuring smooth business operations.',
  },
  {
    id: 'compliance',
    title: 'Compliance',
    icon: Shield,
    description: 'Regulatory and compliance roles maintaining standards and oversight.',
  },
  {
    id: 'marketing',
    title: 'Marketing',
    icon: Megaphone,
    description: 'Creative and strategic roles driving brand growth and client acquisition.',
  },
];

const values = [
  {
    title: 'Big Ambitions',
    description: "We're building South Africa's leading independent financial advisory firm.",
    icon: Rocket,
  },
  {
    title: 'Client Excellence',
    description: "Every decision we make is guided by what's best for our clients.",
    icon: Heart,
  },
  {
    title: 'Professional Growth',
    description: 'We invest in our people and support continuous learning and development.',
    icon: GraduationCap,
  },
  {
    title: 'Market Leadership',
    description: 'We set the standard for independent financial advice in South Africa.',
    icon: Globe,
  },
];

const HERO_CAREER_CARDS = [
  {
    icon: TrendingUp,
    title: 'Growth Path',
    subtitle: 'Fast-track development',
    color: 'from-purple-500/20 to-indigo-500/20',
    border: 'border-purple-400/20',
  },
  {
    icon: Handshake,
    title: 'Team Culture',
    subtitle: 'Collaborative & supportive',
    color: 'from-emerald-500/20 to-teal-500/20',
    border: 'border-emerald-400/20',
  },
  {
    icon: Award,
    title: 'Industry Leader',
    subtitle: 'FSCA Regulated · FSP 54606',
    color: 'from-amber-500/20 to-orange-500/20',
    border: 'border-amber-400/20',
  },
] as const;

const HERO_STATS = [
  { label: 'Years Experience', value: 15, suffix: '+', icon: Award },
  { label: 'Team Members', value: 20, suffix: '+', icon: Users },
  { label: 'Roles Filled in 2025', value: 8, suffix: '', icon: Briefcase },
  { label: 'Staff Retention', value: 95, suffix: '%', icon: Heart },
] as const;

const PERKS = [
  { icon: TrendingUp, title: 'Competitive Remuneration', description: 'Market-leading salary & performance bonuses' },
  { icon: GraduationCap, title: 'Continuous Learning', description: 'Funded CPD, certifications & study support' },
  { icon: Coffee, title: 'Flexible Working', description: 'Hybrid model with modern Cape Town office' },
  { icon: Shield, title: 'Comprehensive Benefits', description: 'Medical aid, retirement fund & risk cover' },
  { icon: Lightbulb, title: 'Innovation Culture', description: 'AI tools, modern tech stack & creative freedom' },
  { icon: Users, title: 'Mentorship', description: 'One-on-one coaching from industry veterans' },
];

// ============================================================================
// Data fetching
// ============================================================================

async function fetchJobListings(): Promise<JobListing[]> {
  try {
    const res = await fetch(`${BASE_URL}/careers`, { headers: AUTH_HEADERS });
    const json = await res.json();
    if (json.success && Array.isArray(json.data)) return json.data;
  } catch (err) {
    console.error('Failed to fetch job listings:', err);
  }
  return [];
}

// ============================================================================
// Animated Counter Hook (matches homepage)
// ============================================================================

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

// ============================================================================
// Sub-Components
// ============================================================================

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
    value % 1 !== 0 ? animatedValue.toFixed(1) : animatedValue.toLocaleString();

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

// ============================================================================
// Main Component
// ============================================================================

export function CareersPage() {
  const [activeCategory, setActiveCategory] = useState('advisory');
  const [showCVModal, setShowCVModal] = useState(false);
  const [listings, setListings] = useState<JobListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedJob, setExpandedJob] = useState<string | null>(null);

  // Load listings
  useEffect(() => {
    fetchJobListings().then((data) => {
      setListings(data);
      setLoading(false);
    });
  }, []);

  const filteredListings = useMemo(
    () => listings.filter((l) => l.category === activeCategory),
    [listings, activeCategory],
  );

  const activeCat = categories.find((c) => c.id === activeCategory);

  const totalOpenings = listings.length;

  return (
    <div className="min-h-screen">
      <SEO
        {...getSEOData('careers')}
        structuredData={createWebPageSchema(
          getSEOData('careers').title,
          getSEOData('careers').description,
          getSEOData('careers').canonicalUrl,
        )}
      />

      {/* ================================================================== */}
      {/* HERO                                                               */}
      {/* ================================================================== */}
      <section className="relative overflow-hidden bg-[#111827]" aria-label="Careers Hero">
        <div className="absolute inset-0 bg-gradient-to-b from-[#111827] via-[#161b33] to-[#111827] pointer-events-none" />
        <div className="absolute top-0 right-0 w-[600px] h-[600px] rounded-full opacity-20 pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(109,40,217,0.25) 0%, transparent 70%)' }} />

        <div className="relative z-10 max-w-screen-xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col items-center text-center py-20 lg:py-28">
            {/* Pill badge */}
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/[0.06] border border-white/[0.08] mb-8">
              <Briefcase className="h-3.5 w-3.5 text-purple-400" />
              <span className="text-[12px] font-medium text-gray-400 tracking-wide">
                {totalOpenings > 0
                  ? `${totalOpenings} Open Position${totalOpenings !== 1 ? 's' : ''}`
                  : 'Careers at Navigate Wealth'}
              </span>
            </div>

            {/* Heading */}
            <div className="max-w-3xl space-y-5">
              <h1 className="!text-[clamp(2rem,5vw,3.5rem)] !font-extrabold !leading-[1.1] text-white tracking-tight">
                Build Your Career in{' '}
                <span className="bg-gradient-to-r from-purple-400 to-violet-300 bg-clip-text text-transparent">
                  Financial Advisory
                </span>
              </h1>
              <p className="text-gray-400 text-base sm:text-lg max-w-2xl mx-auto leading-relaxed">
                Join South Africa's most ambitious independent financial advisory firm. We
                combine cutting-edge technology with personalised service to help clients
                achieve their financial goals.
              </p>
            </div>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-3 mt-10">
              <Button
                size="lg"
                className="bg-primary text-primary-foreground hover:bg-primary/90 transition-colors duration-200 px-8 h-12 shadow-lg shadow-purple-600/20"
                onClick={() => {
                  document.getElementById('opportunities')?.scrollIntoView({ behavior: 'smooth' });
                }}
              >
                View Open Positions
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="border-purple-400/30 bg-transparent text-purple-300 hover:bg-purple-500/15 hover:border-purple-400/50 hover:text-purple-200 transition-colors duration-200 px-8 h-12"
                onClick={() => setShowCVModal(true)}
              >
                <Send className="mr-2 h-5 w-5" />
                Send Your CV
              </Button>
            </div>

            {/* Trust indicators */}
            <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 mt-10 pt-8 border-t border-white/[0.06] w-full max-w-2xl">
              <div className="flex items-center gap-1.5 text-gray-500">
                <Shield className="h-3.5 w-3.5 text-purple-400/70 flex-shrink-0" />
                <span className="text-xs font-medium">FSCA Regulated</span>
              </div>
              <div className="flex items-center gap-1.5 text-gray-500">
                <Globe className="h-3.5 w-3.5 text-purple-400/70 flex-shrink-0" />
                <span className="text-xs font-medium">Independent</span>
              </div>
              <div className="flex items-center gap-1.5 text-gray-500">
                <CheckCircle className="h-3.5 w-3.5 text-purple-400/70 flex-shrink-0" />
                <span className="text-xs font-medium">Equal Opportunity Employer</span>
              </div>
            </div>
          </div>

          {/* Stats Bar */}
          <div className="relative z-10 border-t border-white/[0.06] py-6 lg:py-8">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-8">
              {HERO_STATS.map((stat) => (
                <StatItem key={stat.label} {...stat} />
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ================================================================== */}
      {/* CAREER CATEGORIES — White Background                               */}
      {/* ================================================================== */}
      <section id="opportunities" className="py-16 lg:py-24 section-white scroll-mt-20">
        <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-12 lg:mb-16">
            <Badge className="mb-4 bg-purple-100 text-purple-700 hover:bg-purple-100 border-purple-200/50 text-xs font-medium px-3 py-1">
              Open Positions
            </Badge>
            <h2 className="text-black text-2xl sm:text-3xl lg:text-4xl font-bold mb-4 sm:mb-6">
              Explore Career Opportunities
            </h2>
            <p className="text-gray-600 text-base sm:text-lg leading-relaxed">
              We're always looking for talented individuals across our business. Browse by department
              to find where you fit.
            </p>
          </div>

          {/* Category Navigation */}
          <div className="flex flex-wrap justify-center gap-2 sm:gap-3 mb-10 sm:mb-12">
            {categories.map((category) => {
              const isActive = activeCategory === category.id;
              const count = listings.filter((l) => l.category === category.id).length;
              const Icon = category.icon;

              return (
                <button
                  key={category.id}
                  onClick={() => {
                    setActiveCategory(category.id);
                    setExpandedJob(null);
                  }}
                  className={`
                    flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-medium
                    transition-all duration-200 border
                    ${
                      isActive
                        ? 'bg-[#1a1e36] text-white border-[#1a1e36] shadow-md shadow-[#1a1e36]/15'
                        : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                    }
                  `}
                >
                  <Icon className={`h-4 w-4 ${isActive ? 'text-purple-300' : 'text-gray-400'}`} />
                  {category.title}
                  {count > 0 && (
                    <span
                      className={`
                        text-[11px] font-semibold min-w-[20px] h-5 flex items-center justify-center rounded-full
                        ${isActive ? 'bg-purple-500/30 text-purple-200' : 'bg-gray-100 text-gray-500'}
                      `}
                    >
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Active Category Content */}
          <div className="max-w-4xl mx-auto">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-20">
                <Loader2 className="h-8 w-8 animate-spin text-purple-500 mb-3" />
                <p className="text-sm text-gray-400">Loading positions...</p>
              </div>
            ) : filteredListings.length > 0 ? (
              /* ── Job Listings ─────────────────────────────────────────── */
              <div className="space-y-4">
                {filteredListings.map((listing) => {
                  const isExpanded = expandedJob === listing.id;

                  return (
                    <Card
                      key={listing.id}
                      className={`
                        border transition-all duration-200 overflow-hidden
                        ${isExpanded ? 'border-purple-200 shadow-lg shadow-purple-500/5 ring-1 ring-purple-100' : 'border-gray-200 hover:border-gray-300 hover:shadow-md'}
                      `}
                    >
                      {/* Clickable header */}
                      <button
                        type="button"
                        className="w-full text-left px-6 py-5 flex items-center justify-between gap-4"
                        onClick={() => setExpandedJob(isExpanded ? null : listing.id)}
                        aria-expanded={isExpanded}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className="text-lg font-semibold text-gray-900 truncate">
                              {listing.title}
                            </h3>
                            <Badge className="bg-purple-50 text-purple-700 border-purple-200/50 hover:bg-purple-50 text-[11px] font-medium flex-shrink-0">
                              {activeCat?.title}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-3 text-sm text-gray-500 flex-wrap">
                            <span className="flex items-center gap-1.5">
                              <MapPin className="h-3.5 w-3.5" />
                              {listing.location}
                            </span>
                            <span className="flex items-center gap-1.5">
                              <Clock className="h-3.5 w-3.5" />
                              {listing.type}
                            </span>
                            {listing.closingDate && (
                              <span className="flex items-center gap-1.5">
                                <Calendar className="h-3.5 w-3.5" />
                                Closes{' '}
                                {new Date(listing.closingDate).toLocaleDateString('en-ZA', {
                                  day: 'numeric',
                                  month: 'short',
                                  year: 'numeric',
                                })}
                              </span>
                            )}
                          </div>
                        </div>
                        <ChevronRight
                          className={`h-5 w-5 text-gray-400 flex-shrink-0 transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`}
                        />
                      </button>

                      {/* Expandable detail */}
                      {isExpanded && (
                        <div className="px-6 pb-6 pt-0 space-y-5 border-t border-gray-100">
                          {listing.description && (
                            <p className="text-gray-600 leading-relaxed pt-5">
                              {listing.description}
                            </p>
                          )}

                          {listing.requirements.length > 0 && (
                            <div>
                              <h4 className="font-semibold text-gray-900 text-sm mb-3">
                                Requirements
                              </h4>
                              <ul className="space-y-2">
                                {listing.requirements.map((req, i) => (
                                  <li
                                    key={i}
                                    className="flex items-start gap-2.5 text-sm text-gray-600"
                                  >
                                    <CheckCircle className="h-4 w-4 text-purple-500 mt-0.5 flex-shrink-0" />
                                    {req}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {listing.benefits.length > 0 && (
                            <div>
                              <h4 className="font-semibold text-gray-900 text-sm mb-3">
                                What We Offer
                              </h4>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                {listing.benefits.map((benefit, i) => (
                                  <span
                                    key={i}
                                    className="flex items-center gap-2 text-sm text-gray-600"
                                  >
                                    <CheckCircle className="h-3.5 w-3.5 text-emerald-500 flex-shrink-0" />
                                    {benefit}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}

                          <div className="pt-4 border-t border-gray-100 flex flex-wrap gap-4">
                            <Button
                              size="lg"
                              className="bg-primary text-primary-foreground hover:bg-primary/90 hover:scale-105 transform transition-all duration-200 px-8 shadow-lg hover:shadow-xl"
                              onClick={() => setShowCVModal(true)}
                            >
                              Apply Now
                              <ArrowRight className="ml-2 h-5 w-5" />
                            </Button>
                            <Button
                              size="lg"
                              variant="outline"
                              className="border-gray-200 bg-white text-gray-700 hover:bg-gray-50 hover:border-gray-300 hover:scale-105 transform transition-all duration-200 px-8 shadow-sm hover:shadow-md"
                              onClick={() => {
                                const url = `${window.location.origin}/careers#${listing.id}`;
                                const textArea = document.createElement('textarea');
                                textArea.value = url;
                                textArea.style.position = 'fixed';
                                textArea.style.opacity = '0';
                                document.body.appendChild(textArea);
                                textArea.select();
                                try {
                                  document.execCommand('copy');
                                } catch (_e) {
                                  /* silent fallback */
                                }
                                document.body.removeChild(textArea);
                              }}
                            >
                              Share Position
                            </Button>
                          </div>
                        </div>
                      )}
                    </Card>
                  );
                })}
              </div>
            ) : (
              /* ── No openings fallback ──────────────────────────────── */
              <div className="text-center py-16">
                <div className="w-20 h-20 mx-auto rounded-2xl bg-[#1a1e36] flex items-center justify-center mb-6">
                  {activeCat?.icon && <activeCat.icon className="h-9 w-9 text-purple-300" />}
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">
                  No Current {activeCat?.title} Openings
                </h3>
                <p className="text-gray-500 leading-relaxed max-w-md mx-auto mb-6">
                  {activeCat?.description} We don't have open positions here right now, but
                  we'd love to hear from you.
                </p>
                <Button
                  size="lg"
                  className="bg-primary text-primary-foreground hover:bg-primary/90 hover:scale-105 transform transition-all duration-200 px-8 shadow-lg hover:shadow-xl"
                  onClick={() => setShowCVModal(true)}
                >
                  Send Us Your CV
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>

                {/* Mini perks grid */}
                <div className="mt-12 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 text-left max-w-2xl mx-auto">
                  {[
                    'Competitive salary & benefits',
                    'Professional development',
                    'Growth opportunities',
                    'Modern work environment',
                    'Flexible working options',
                    'Team collaboration culture',
                  ].map((item) => (
                    <div
                      key={item}
                      className="flex items-center gap-2 text-sm text-gray-500 px-3 py-2 rounded-lg bg-gray-50"
                    >
                      <CheckCircle className="h-4 w-4 text-purple-500 flex-shrink-0" />
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ================================================================== */}
      {/* WHY NAVIGATE WEALTH — Dark Background                              */}
      {/* ================================================================== */}
      <section className="relative overflow-hidden bg-[#1a1e36]">
        {/* Subtle background depth */}
        <div className="absolute inset-0 bg-gradient-to-br from-[#1a1e36] via-[#252a47] to-[#1a1e36]" />
        <div className="absolute -top-40 -left-40 w-[500px] h-[500px] rounded-full bg-purple-600/5 blur-[100px]" />
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage:
              'radial-gradient(circle, rgba(255,255,255,0.8) 1px, transparent 1px)',
            backgroundSize: '32px 32px',
          }}
        />

        <div className="relative z-10 max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 py-16 lg:py-24">
          <div className="text-center max-w-3xl mx-auto mb-12 lg:mb-16">
            <Badge className="mb-4 bg-purple-500/10 text-purple-300 hover:bg-purple-500/10 border-purple-400/20 text-xs font-medium px-3 py-1">
              Our Culture
            </Badge>
            <h2 className="text-white text-2xl sm:text-3xl lg:text-4xl font-bold mb-4 sm:mb-6">
              Why Navigate Wealth?
            </h2>
            <p className="text-gray-400 text-base sm:text-lg leading-relaxed">
              Join a company that's revolutionising financial advice in South Africa with ambition,
              innovation, and a commitment to excellence.
            </p>
          </div>

          {/* Values grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {values.map((value, index) => {
              const Icon = value.icon;
              return (
                <div
                  key={index}
                  className="group p-6 rounded-2xl bg-white/[0.04] border border-white/[0.06] hover:bg-white/[0.07] hover:border-white/[0.12] transition-all duration-300"
                >
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500/20 to-indigo-500/20 border border-purple-400/10 flex items-center justify-center mb-4 group-hover:scale-105 transition-transform">
                    <Icon className="h-6 w-6 text-purple-400" />
                  </div>
                  <h3 className="text-white font-semibold mb-2 text-lg">{value.title}</h3>
                  <p className="text-gray-400 leading-relaxed text-sm">{value.description}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ================================================================== */}
      {/* PERKS & BENEFITS — White Background                                */}
      {/* ================================================================== */}
      <section className="py-16 lg:py-24 section-white">
        <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-12 lg:mb-16">
            <Badge className="mb-4 bg-purple-100 text-purple-700 hover:bg-purple-100 border-purple-200/50 text-xs font-medium px-3 py-1">
              Benefits & Perks
            </Badge>
            <h2 className="text-black text-2xl sm:text-3xl lg:text-4xl font-bold mb-4 sm:mb-6">
              Everything You Need to Thrive
            </h2>
            <p className="text-gray-600 text-base sm:text-lg leading-relaxed">
              We believe that taking care of our team is the foundation of exceptional client
              service. Here's what you can expect.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 max-w-5xl mx-auto">
            {PERKS.map((perk, i) => {
              const Icon = perk.icon;
              return (
                <div
                  key={i}
                  className="flex items-start gap-3 p-4 rounded-xl bg-gray-50 hover:bg-purple-50/50 border border-gray-100 hover:border-purple-100 transition-colors group"
                >
                  <div className="w-9 h-9 rounded-lg bg-purple-100 group-hover:bg-purple-200/70 flex items-center justify-center flex-shrink-0 transition-colors">
                    <Icon className="h-4.5 w-4.5 text-purple-600" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-900 text-sm mb-0.5">{perk.title}</h4>
                    <p className="text-gray-500 text-xs leading-relaxed">{perk.description}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ================================================================== */}
      {/* CTA — Dark Background                                              */}
      {/* ================================================================== */}
      <section className="relative overflow-hidden bg-[#1a1e36]">
        <div className="absolute inset-0 bg-gradient-to-br from-[#1a1e36] via-[#252a47] to-[#1a1e36]" />
        <div className="absolute -top-20 right-1/4 w-[400px] h-[400px] rounded-full bg-purple-600/8 blur-[100px]" />
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage:
              'radial-gradient(circle, rgba(255,255,255,0.8) 1px, transparent 1px)',
            backgroundSize: '32px 32px',
          }}
        />

        <div className="relative z-10 max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 py-16 lg:py-24">
          <div className="max-w-3xl mx-auto text-center space-y-6">
            <h2 className="text-white text-2xl sm:text-3xl lg:text-4xl font-bold">
              Ready to Shape the Future of{' '}
              <span className="bg-gradient-to-r from-purple-400 via-violet-400 to-indigo-400 bg-clip-text text-transparent">
                Financial Advisory?
              </span>
            </h2>
            <p className="text-gray-400 text-base sm:text-lg leading-relaxed max-w-2xl mx-auto">
              Even if you don't see a current opening that matches your skills, we're always
              interested in hearing from exceptional candidates who share our vision.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center pt-2">
              <Button
                size="lg"
                className="bg-primary text-primary-foreground hover:bg-primary/90 hover:scale-105 transform transition-all duration-200 px-8 shadow-lg hover:shadow-xl"
                onClick={() => setShowCVModal(true)}
              >
                Start Your Journey With Us
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="border-primary/80 bg-primary/10 text-white hover:bg-primary/20 hover:border-primary hover:text-white hover:scale-105 transform transition-all duration-200 px-8 backdrop-blur-sm shadow-lg hover:shadow-xl"
                asChild
              >
                <Link to="/contact">Contact Our Team</Link>
              </Button>
            </div>

            <div className="pt-6 border-t border-white/[0.06] mt-8">
              <p className="text-gray-500 text-sm">
                Equal opportunity employer &bull; Professional development &bull; Competitive
                benefits &bull; Growth-focused culture
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CV Upload Modal */}
      <CVUploadModal isOpen={showCVModal} onClose={() => setShowCVModal(false)} />
    </div>
  );
}

export default CareersPage;
