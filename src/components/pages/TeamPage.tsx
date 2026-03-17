import React, { useState, useEffect } from 'react';
import { Link } from 'react-router';
import { SEO, createWebPageSchema } from '../seo/SEO';
import { getSEOData } from '../seo/seo-config';
import { Button } from '../ui/button';
import { Card, CardContent } from '../ui/card';
import { Badge } from '../ui/badge';
import { Linkedin, Mail, ArrowRight, Loader2 } from 'lucide-react';
import { OptimizedImage } from '../shared/OptimizedImage';
import { TEAM_IMAGES } from '../../utils/imageConstants';
import { projectId, publicAnonKey } from '../../utils/supabase/info';

// ============================================================================
// Types
// ============================================================================

interface TeamMember {
  id: string;
  name: string;
  title: string;
  credentials: string;
  bio: string;
  specialties: string[];
  image: string;
  linkedinUrl?: string;
  email?: string;
  sortOrder: number;
}

// ============================================================================
// Fallback data (used when no KV-managed team members exist)
// ============================================================================

const FALLBACK_MEMBERS: TeamMember[] = [
  {
    id: 'fallback-1',
    name: "Michael Johnson",
    title: "Founder & CEO",
    credentials: "CFP\u00AE, CFA",
    bio: "With over 30 years in wealth management, Michael founded Navigate Wealth with a vision to provide personalized financial solutions. He holds a Master's in Finance from Wharton.",
    specialties: ["Investment Strategy", "Estate Planning", "Tax Optimization"],
    image: TEAM_IMAGES.michael,
    sortOrder: 1,
  },
  {
    id: 'fallback-2',
    name: "Sarah Chen",
    title: "Senior Portfolio Manager",
    credentials: "CFA, MBA",
    bio: "Sarah brings 15 years of institutional investment experience to Navigate Wealth. She previously managed portfolios at leading investment firms before joining our team.",
    specialties: ["Portfolio Management", "Risk Analysis", "Asset Allocation"],
    image: TEAM_IMAGES.sarah,
    sortOrder: 2,
  },
  {
    id: 'fallback-3',
    name: "David Rodriguez",
    title: "Director of Financial Planning",
    credentials: "CFP\u00AE, ChFC",
    bio: "David specializes in comprehensive financial planning and retirement strategies. His analytical approach helps clients navigate complex financial decisions with confidence.",
    specialties: ["Retirement Planning", "Insurance Analysis", "Education Funding"],
    image: TEAM_IMAGES.david,
    sortOrder: 3,
  },
  {
    id: 'fallback-4',
    name: "Jennifer Walsh",
    title: "Senior Wealth Advisor",
    credentials: "CFP\u00AE, CIMA",
    bio: "Jennifer focuses on high-net-worth families and their unique wealth management needs. She has over 12 years of experience in private wealth management.",
    specialties: ["Family Wealth", "Trust Services", "Philanthropy"],
    image: "https://images.unsplash.com/photo-1580489944761-15a19d654956?w=400&h=400&fit=crop&crop=face",
    sortOrder: 4,
  },
  {
    id: 'fallback-5',
    name: "Robert Kim",
    title: "Investment Analyst",
    credentials: "CFA Level III",
    bio: "Robert conducts in-depth market research and analysis to support our investment decisions. He brings fresh perspectives with his quantitative background.",
    specialties: ["Market Research", "Quantitative Analysis", "ESG Investing"],
    image: "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=400&h=400&fit=crop&crop=face",
    sortOrder: 5,
  },
  {
    id: 'fallback-6',
    name: "Lisa Thompson",
    title: "Client Relations Manager",
    credentials: "Series 7, 66",
    bio: "Lisa ensures our clients receive exceptional service and support. She coordinates between our advisors and clients to ensure seamless communication.",
    specialties: ["Client Service", "Operations", "Account Management"],
    image: "https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?w=400&h=400&fit=crop&crop=face",
    sortOrder: 6,
  },
];

// ============================================================================
// Data fetching
// ============================================================================

async function fetchTeamMembers(): Promise<TeamMember[]> {
  try {
    const res = await fetch(
      `https://${projectId}.supabase.co/functions/v1/make-server-91ed8379/publications/team`,
      { headers: { Authorization: `Bearer ${publicAnonKey}` } },
    );
    const json = await res.json();
    if (json.success && Array.isArray(json.data) && json.data.length > 0) {
      return json.data;
    }
  } catch (err) {
    console.error('Failed to fetch team members from API:', err);
  }
  return FALLBACK_MEMBERS;
}

// ============================================================================
// Component
// ============================================================================

export function TeamPage() {
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>(FALLBACK_MEMBERS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetchTeamMembers().then((members) => {
      if (!cancelled) {
        setTeamMembers(members);
        setLoading(false);
      }
    });
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="min-h-screen">
      <SEO {...getSEOData('team')} structuredData={createWebPageSchema(getSEOData('team').title, getSEOData('team').description, getSEOData('team').canonicalUrl)} />
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-[#111827]" aria-label="Hero">
        <div className="absolute inset-0 bg-gradient-to-b from-[#111827] via-[#161b33] to-[#111827] pointer-events-none" />
        <div className="absolute top-0 right-0 w-[600px] h-[600px] rounded-full opacity-20 pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(109,40,217,0.25) 0%, transparent 70%)' }} />

        <div className="relative z-10 max-w-screen-xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col items-center text-center py-20 lg:py-28">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/[0.06] border border-white/[0.08] mb-8">
              <span className="text-[12px] font-medium text-gray-400 tracking-wide">Expert Team</span>
            </div>

            <div className="max-w-3xl space-y-5">
              <h1 className="!text-[clamp(2rem,5vw,3.5rem)] !font-extrabold !leading-[1.1] text-white tracking-tight">
                Meet Our{' '}
                <span className="bg-gradient-to-r from-purple-400 to-violet-300 bg-clip-text text-transparent">Team</span>
              </h1>
              <p className="text-gray-400 text-base sm:text-lg max-w-2xl mx-auto leading-relaxed">
                Our experienced team of financial professionals is dedicated to helping you achieve your wealth management goals with personalized strategies and exceptional service.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Team Grid */}
      <section className="py-20 px-4 bg-white">
        <div className="max-w-7xl mx-auto">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-purple-500" />
            </div>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
              {teamMembers.map((member, index) => (
                <Card key={member.id} className="border border-gray-100 hover:shadow-lg transition-shadow">
                  <CardContent className="p-6 space-y-4">
                    <div className="text-center space-y-4">
                      <div className="w-24 h-24 mx-auto rounded-full overflow-hidden">
                        <OptimizedImage
                          src={member.image}
                          alt={member.name}
                          width={200}
                          height={200}
                          preset="avatar"
                          loading={index < 3 ? 'eager' : 'lazy'}
                          fetchpriority={index < 3 ? 'high' : 'auto'}
                        />
                      </div>
                      <div>
                        <h3 className="text-xl font-semibold text-black">{member.name}</h3>
                        <p className="text-purple-600 font-medium">{member.title}</p>
                        <p className="text-sm text-gray-500">{member.credentials}</p>
                      </div>
                    </div>
                    
                    <p className="text-gray-600 text-sm leading-relaxed">{member.bio}</p>
                    
                    <div className="space-y-2">
                      <h4 className="font-medium text-black text-sm">Specialties:</h4>
                      <div className="flex flex-wrap gap-1">
                        {member.specialties.map((specialty, specialtyIndex) => (
                          <Badge 
                            key={specialtyIndex} 
                            variant="secondary" 
                            className="text-xs bg-purple-50 text-purple-600"
                          >
                            {specialty}
                          </Badge>
                        ))}
                      </div>
                    </div>
                    
                    <div className="flex justify-center space-x-3 pt-2">
                      {member.linkedinUrl ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-gray-600 hover:text-purple-600"
                          asChild
                        >
                          <a href={member.linkedinUrl} target="_blank" rel="noopener noreferrer">
                            <Linkedin className="h-4 w-4" />
                          </a>
                        </Button>
                      ) : (
                        <Button variant="ghost" size="sm" className="text-gray-600 hover:text-purple-600">
                          <Linkedin className="h-4 w-4" />
                        </Button>
                      )}
                      {member.email ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-gray-600 hover:text-purple-600"
                          asChild
                        >
                          <a href={`mailto:${member.email}`}>
                            <Mail className="h-4 w-4" />
                          </a>
                        </Button>
                      ) : (
                        <Button variant="ghost" size="sm" className="text-gray-600 hover:text-purple-600">
                          <Mail className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Our Approach */}
      <section className="py-20 px-4 bg-gray-50">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl font-bold text-black mb-8">Our Team Approach</h2>
          <p className="text-xl text-gray-600 mb-12 leading-relaxed">
            We believe in collaborative wealth management. Our team works together to provide you with comprehensive solutions that address all aspects of your financial life.
          </p>
          
          <div className="grid md:grid-cols-3 gap-8 mb-12">
            {[
              {
                title: "Collaborative Planning",
                description: "Multiple experts review your situation to ensure comprehensive coverage."
              },
              {
                title: "Continuous Education",
                description: "Our team stays current with market trends and regulatory changes."
              },
              {
                title: "Client-Centric Focus",
                description: "Every decision is made with your best interests as our primary consideration."
              }
            ].map((approach, index) => (
              <div key={index} className="text-center space-y-3">
                <h3 className="text-lg font-semibold text-black">{approach.title}</h3>
                <p className="text-gray-600">{approach.description}</p>
              </div>
            ))}
          </div>
          
          <Button 
            size="lg" 
            className="bg-purple-600 hover:bg-purple-700 text-white px-8 py-3"
            asChild
          >
            <Link to="/contact">
              Schedule a Meeting
              <ArrowRight className="ml-2 h-5 w-5" />
            </Link>
          </Button>
        </div>
      </section>
    </div>
  );
}