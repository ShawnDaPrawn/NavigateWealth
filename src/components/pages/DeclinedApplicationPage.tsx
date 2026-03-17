/**
 * Declined Application Page
 *
 * Shown when an application has been declined by admin review.
 * Provides clear next steps and contact information.
 *
 * Enhanced to match Navigate Wealth website design language.
 *
 * Guidelines refs: §7 (presentation layer), §8.3 (UI standards)
 */

import React, { useState, useEffect } from 'react';
import { useAuth } from '../auth/AuthContext';
import { useNavigate } from 'react-router';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Alert, AlertDescription } from '../ui/alert';
import {
  XCircle,
  Mail,
  Phone,
  Info,
  AlertTriangle,
  LogOut,
  MessageSquare,
  Shield,
  Award,
  TrendingUp,
} from 'lucide-react';

const TRUST_POINTS = [
  { icon: Shield, label: 'FSP 54606 Regulated' },
  { icon: Award, label: 'POPIA Compliant' },
  { icon: TrendingUp, label: 'Independent Advice' },
];

export function DeclinedApplicationPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [reviewNotes, setReviewNotes] = useState<string>('');

  useEffect(() => {
    setReviewNotes('Please contact our team for more information about your application.');
  }, [user]);

  const handleContactSupport = () => {
    window.location.href = 'mailto:info@navigatewealth.co?subject=Application Review - Follow Up';
  };

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login', { replace: true });
    } catch (error) {
      console.error('Failed to logout:', error);
      navigate('/login', { replace: true });
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ── Dark Branded Header ─────────────────────────────────────── */}
      <div className="relative overflow-hidden bg-[#1a1e36]">
        <div className="absolute inset-0 bg-gradient-to-br from-[#1a1e36] via-[#252a47] to-[#1a1e36]" />
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-red-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/4" />

        <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-16 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-red-500/10 rounded-2xl border border-red-400/20 mb-6 backdrop-blur-sm">
            <XCircle className="h-8 w-8 text-red-400" />
          </div>

          <h1 className="text-3xl lg:text-4xl font-bold text-white mb-3">
            Application Not Approved
          </h1>
          <p className="text-gray-400 text-lg max-w-xl mx-auto leading-relaxed">
            We're unable to proceed with your application at this time. Please review the details below.
          </p>

          {/* Trust bar */}
          <div className="flex flex-wrap items-center justify-center gap-6 mt-8 pt-6 border-t border-white/10">
            {TRUST_POINTS.map((point) => (
              <div key={point.label} className="flex items-center gap-2 text-sm text-gray-500">
                <point.icon className="h-4 w-4 text-purple-400/70" />
                <span>{point.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Main Content ───────────────────────────────────────────── */}
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 -mt-6 pb-16">

        {/* Status Alert */}
        <Alert className="mb-6 border-red-200 bg-red-50 shadow-sm">
          <AlertTriangle className="h-5 w-5 text-red-600" />
          <AlertDescription className="text-red-900 text-sm">
            <strong className="block mb-1">Application Status: Declined</strong>
            Your application has been reviewed by our team and we're unable to approve it at this time.
            Please see the details below and contact us if you have any questions.
          </AlertDescription>
        </Alert>

        {/* Review Notes Card */}
        {reviewNotes && (
          <Card className="mb-6 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <MessageSquare className="h-5 w-5 text-gray-600" />
                Review Notes
              </CardTitle>
              <CardDescription>Feedback from our review team</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <p className="text-gray-700 text-sm leading-relaxed whitespace-pre-wrap">
                  {reviewNotes}
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Next Steps Card */}
        <Card className="mb-6 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Info className="h-5 w-5 text-purple-600" />
              What Can You Do?
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[
                {
                  step: '1',
                  title: 'Contact Our Team',
                  desc: 'Reach out to our support team to discuss your application and get clarification on the decision.',
                },
                {
                  step: '2',
                  title: 'Address Concerns',
                  desc: 'If specific issues were identified, you may be able to address them and resubmit your application in the future.',
                },
                {
                  step: '3',
                  title: 'Explore Alternatives',
                  desc: 'Our team can discuss alternative options that may better suit your current situation.',
                },
              ].map((item) => (
                <div key={item.step} className="flex items-start gap-3">
                  <div className="w-7 h-7 rounded-full bg-purple-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-xs font-bold text-purple-700">{item.step}</span>
                  </div>
                  <div>
                    <h4 className="font-medium text-gray-900 text-sm">{item.title}</h4>
                    <p className="text-sm text-gray-500 mt-0.5 leading-relaxed">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Contact Information */}
        <Card className="mb-8 bg-gradient-to-br from-purple-50/50 to-white border-purple-100 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Phone className="h-5 w-5 text-purple-600" />
              Get in Touch
            </CardTitle>
            <CardDescription>We're here to help and answer your questions</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <Alert className="border-purple-200 bg-white/80">
                <Info className="h-4 w-4 text-purple-700" />
                <AlertDescription className="text-gray-700 text-sm">
                  Our team is available during business hours:
                  <strong> Monday - Friday, 9:00 AM - 5:00 PM SAST</strong>
                </AlertDescription>
              </Alert>

              <div className="grid md:grid-cols-2 gap-3">
                <div className="flex items-center gap-3 p-4 bg-white rounded-lg border border-purple-100">
                  <div className="w-9 h-9 rounded-lg bg-purple-100 flex items-center justify-center flex-shrink-0">
                    <Mail className="h-4 w-4 text-purple-600" />
                  </div>
                  <div>
                    <div className="text-xs font-medium text-gray-500">Email Us</div>
                    <a
                      href="mailto:info@navigatewealth.co"
                      className="text-sm text-purple-700 hover:underline font-medium"
                    >
                      info@navigatewealth.co
                    </a>
                  </div>
                </div>

                <div className="flex items-center gap-3 p-4 bg-white rounded-lg border border-purple-100">
                  <div className="w-9 h-9 rounded-lg bg-purple-100 flex items-center justify-center flex-shrink-0">
                    <Phone className="h-4 w-4 text-purple-600" />
                  </div>
                  <div>
                    <div className="text-xs font-medium text-gray-500">Call Us</div>
                    <a
                      href="tel:+27126672505"
                      className="text-sm text-purple-700 hover:underline font-medium"
                    >
                      +27 12 667 2505
                    </a>
                  </div>
                </div>
              </div>

              <Button
                onClick={handleContactSupport}
                className="w-full bg-gradient-to-r from-purple-600 to-violet-600 hover:from-purple-700 hover:to-violet-700 shadow-sm"
                size="lg"
              >
                <Mail className="h-4 w-4 mr-2" />
                Contact Support Team
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Logout Button */}
        <div className="flex justify-center">
          <Button
            variant="outline"
            onClick={handleLogout}
            className="gap-2 text-gray-600 hover:text-gray-900"
          >
            <LogOut className="h-4 w-4" />
            Sign Out
          </Button>
        </div>
      </div>
    </div>
  );
}