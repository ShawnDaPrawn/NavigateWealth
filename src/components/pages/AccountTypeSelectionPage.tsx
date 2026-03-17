/**
 * Account Type Selection Page
 *
 * First step in the onboarding flow after signup. Users choose their
 * account type which determines the application form and experience.
 *
 * Active: Personal Client (primary, default)
 * Coming Soon: Business Client, Partner Financial Adviser
 *
 * Design: dark branded hero with purple accents, refined card layout,
 * accurate company statistics.
 *
 * Guidelines refs: §7 (presentation layer), §8.3 (UI standards)
 */

import React, { useState } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '../auth/AuthContext';
import { Button } from '../ui/button';
import { Card, CardContent } from '../ui/card';
import { Badge } from '../ui/badge';
import { projectId, publicAnonKey } from '../../utils/supabase/info';
import {
  User,
  Building,
  Users,
  ArrowRight,
  CheckCircle,
  Clock,
  Shield,
  TrendingUp,
  Award,
  Zap,
  BarChart3,
  Lock,
  HeartHandshake,
} from 'lucide-react';

interface AccountTypeOption {
  id: 'personal' | 'business' | 'adviser';
  title: string;
  description: string;
  features: string[];
  icon: React.ComponentType<{ className?: string }>;
  status: 'available' | 'coming-soon';
}

const ACCOUNT_TYPES: AccountTypeOption[] = [
  {
    id: 'personal',
    title: 'Personal Client',
    description: 'Individual seeking comprehensive financial advisory services',
    features: [
      'Personal wealth management',
      'Investment portfolio planning',
      'Retirement planning guidance',
      'Tax optimisation strategies',
      'Estate planning assistance',
    ],
    icon: User,
    status: 'available',
  },
  {
    id: 'business',
    title: 'Business Client',
    description: 'Business entity seeking corporate financial services',
    features: [
      'Corporate investment strategies',
      'Employee benefits planning',
      'Business assurance solutions',
    ],
    icon: Building,
    status: 'coming-soon',
  },
  {
    id: 'adviser',
    title: 'Partner Financial Adviser',
    description: 'Independent adviser seeking to join our platform',
    features: [
      'Access to product suite',
      'Client management tools',
      'Commission tracking',
    ],
    icon: Users,
    status: 'coming-soon',
  },
];

const TRUST_STATS = [
  { icon: Shield, label: 'FSP 54606', sublabel: 'Regulated' },
  { icon: Award, label: '15+ Years', sublabel: 'Experience' },
  { icon: BarChart3, label: 'R500M+', sublabel: 'Under Management' },
] as const;

const PROCESS_STEPS = [
  { number: '1', label: 'Personal Details' },
  { number: '2', label: 'Contact Info' },
  { number: '3', label: 'Employment' },
  { number: '4', label: 'Services' },
  { number: '5', label: 'Review & Submit' },
] as const;

export function AccountTypeSelectionPage() {
  const navigate = useNavigate();
  const { updateUser, user } = useAuth();
  const [selectedType, setSelectedType] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSelectAccountType = async (accountType: AccountTypeOption) => {
    if (accountType.status !== 'available') return;

    setSelectedType(accountType.id);
    setIsLoading(true);

    try {
      // Update auth user metadata (drives route guards)
      await updateUser({
        accountType: accountType.id,
        accountStatus: 'application_in_progress',
      });

      // Also sync KV profile to ensure consistency after page refresh (§5.4)
      if (user?.id) {
        try {
          const BASE_URL = `https://${projectId}.supabase.co/functions/v1/make-server-91ed8379`;
          await fetch(`${BASE_URL}/profile/update-status`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${publicAnonKey}`,
            },
            body: JSON.stringify({
              userId: user.id,
              accountStatus: 'application_in_progress',
              accountType: accountType.id,
            }),
          });
        } catch (syncErr) {
          // Non-blocking — auth metadata is the primary source; KV sync is belt-and-suspenders
          console.error('Failed to sync profile status (non-blocking):', syncErr);
        }
      }

      if (accountType.id === 'personal') {
        navigate('/application/personal-client');
      }
    } catch (error) {
      console.error('Failed to select account type:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const personalAccount = ACCOUNT_TYPES[0];
  const comingSoonAccounts = ACCOUNT_TYPES.slice(1);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ── Dark Branded Hero ─────────────────────────────────────── */}
      <div className="relative overflow-hidden bg-[#1a1e36]">
        {/* Gradient overlays */}
        <div className="absolute inset-0 bg-gradient-to-br from-[#1a1e36] via-[#252a47] to-[#1a1e36]" />
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-purple-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/4" />
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-violet-500/8 rounded-full blur-3xl translate-y-1/2 -translate-x-1/4" />

        <div className="relative z-10 max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 xl:px-12 py-14 lg:py-20 text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-white/10 rounded-2xl border border-white/10 mb-6 backdrop-blur-sm">
            <Users className="h-7 w-7 text-purple-300" />
          </div>

          <h1 className="text-3xl lg:text-4xl font-bold text-white mb-3 tracking-tight">
            Choose Your Account Type
          </h1>
          <p className="text-gray-400 text-lg max-w-xl mx-auto leading-relaxed">
            Select the account type that best describes your relationship with Navigate Wealth.
          </p>

          {/* Trust stats */}
          <div className="flex flex-wrap items-center justify-center gap-8 lg:gap-12 mt-10 pt-8 border-t border-white/10">
            {TRUST_STATS.map((stat) => (
              <div key={stat.label} className="flex items-center gap-3 text-left">
                <div className="h-10 w-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center">
                  <stat.icon className="h-5 w-5 text-purple-400" />
                </div>
                <div>
                  <div className="text-sm font-semibold text-white">{stat.label}</div>
                  <div className="text-xs text-gray-500">{stat.sublabel}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Main Content ───────────────────────────────────────────── */}
      <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 xl:px-12 pb-16">

        {/* ── Primary: Personal Client Card ──────────────────────────── */}
        <div className="max-w-3xl mx-auto mt-8 mb-12">
          <Card className="border border-purple-200/80 shadow-xl bg-white overflow-hidden hover:border-purple-300 transition-all duration-200">
            <CardContent className="p-0">
              {/* Purple top accent */}
              <div className="h-1 bg-gradient-to-r from-purple-500 via-violet-500 to-purple-600" />

              <div className="p-6 lg:p-8">
                {/* Header row */}
                <div className="flex items-start justify-between mb-6">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 bg-gradient-to-br from-purple-100 to-violet-100 rounded-xl flex items-center justify-center flex-shrink-0 border border-purple-200/50">
                      <User className="h-6 w-6 text-purple-600" />
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-gray-900">{personalAccount.title}</h2>
                      <p className="text-sm text-gray-500 mt-0.5">{personalAccount.description}</p>
                    </div>
                  </div>
                  <Badge className="bg-green-50 text-green-700 border border-green-200 text-xs px-2.5 py-0.5 hover:bg-green-50 flex-shrink-0">
                    <Zap className="h-3 w-3 mr-1" />
                    Available Now
                  </Badge>
                </div>

                <div className="grid md:grid-cols-2 gap-6">
                  {/* Features */}
                  <div>
                    <h4 className="text-xs font-semibold text-gray-500 mb-3 uppercase tracking-wider">What you'll get</h4>
                    <ul className="space-y-2.5">
                      {personalAccount.features.map((feature, index) => (
                        <li key={index} className="flex items-center gap-2.5">
                          <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
                          <span className="text-sm text-gray-700">{feature}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Process overview + CTA */}
                  <div className="flex flex-col gap-4">
                    <div className="bg-gray-50 border border-gray-200/80 p-4 rounded-xl">
                      <div className="flex items-center gap-2 mb-3">
                        <HeartHandshake className="h-4 w-4 text-purple-600" />
                        <h5 className="font-semibold text-gray-900 text-xs uppercase tracking-wider">5-Step Application</h5>
                      </div>
                      <div className="flex items-center gap-1.5">
                        {PROCESS_STEPS.map((step, i) => (
                          <div className="contents" key={step.number}>
                            <div className="flex flex-col items-center flex-1 min-w-0">
                              <div className="w-6 h-6 rounded-full bg-purple-100 border border-purple-200 flex items-center justify-center text-[10px] font-bold text-purple-700">
                                {step.number}
                              </div>
                              <span className="text-[9px] text-gray-500 mt-1 text-center leading-tight truncate w-full">{step.label}</span>
                            </div>
                            {i < PROCESS_STEPS.length - 1 && (
                              <div className="w-3 h-px bg-purple-200 flex-shrink-0 mt-[-10px]" />
                            )}
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="flex items-center gap-3 text-xs text-gray-500 px-1">
                      <div className="flex items-center gap-1.5">
                        <Lock className="h-3 w-3" />
                        <span>POPIA compliant</span>
                      </div>
                      <span className="text-gray-300">|</span>
                      <div className="flex items-center gap-1.5">
                        <TrendingUp className="h-3 w-3" />
                        <span>Progress auto-saved</span>
                      </div>
                    </div>

                    <Button
                      onClick={() => handleSelectAccountType(personalAccount)}
                      disabled={isLoading}
                      className="w-full bg-gradient-to-r from-purple-600 to-violet-600 hover:from-purple-700 hover:to-violet-700 text-white py-6 text-base shadow-lg shadow-purple-200/50 hover:shadow-xl hover:shadow-purple-300/50 transition-all duration-200"
                      size="lg"
                    >
                      {isLoading && selectedType === 'personal' ? (
                        <div className="flex items-center gap-2">
                          <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          <span>Setting up your account...</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <span>Continue as Personal Client</span>
                          <ArrowRight className="h-5 w-5" />
                        </div>
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ── Coming Soon Account Types ───────────────────────────────── */}
        <div className="max-w-3xl mx-auto">
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4 ml-1">
            Additional Account Types
          </h3>

          <div className="grid md:grid-cols-2 gap-4">
            {comingSoonAccounts.map((accountType) => {
              const Icon = accountType.icon;

              return (
                <Card
                  key={accountType.id}
                  className="border border-gray-200 bg-white/80 relative group overflow-hidden hover:shadow-md transition-all duration-200"
                >
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
                          <Icon className="h-5 w-5 text-gray-400" />
                        </div>
                        <div>
                          <h4 className="font-semibold text-gray-900 text-sm">{accountType.title}</h4>
                          <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{accountType.description}</p>
                        </div>
                      </div>
                      <Badge
                        variant="outline"
                        className="border-amber-200 text-amber-700 bg-amber-50 text-[10px] px-2 py-0.5 flex-shrink-0"
                      >
                        Coming Soon
                      </Badge>
                    </div>

                    <ul className="space-y-1.5 mb-4">
                      {accountType.features.map((feature, index) => (
                        <li key={index} className="flex items-center gap-2 text-xs text-gray-500">
                          <div className="w-1 h-1 bg-gray-300 rounded-full flex-shrink-0" />
                          <span>{feature}</span>
                        </li>
                      ))}
                    </ul>

                    <Button
                      variant="outline"
                      disabled
                      className="w-full border-gray-200 text-gray-400 bg-gray-50 h-9 text-xs"
                      size="sm"
                    >
                      <Clock className="h-3 w-3 mr-1.5" />
                      Coming Soon
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}