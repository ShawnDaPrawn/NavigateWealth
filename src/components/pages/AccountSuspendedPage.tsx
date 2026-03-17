import React from 'react';
import { Button } from '../ui/button';
import { Card, CardContent } from '../ui/card';
import { Alert, AlertDescription } from '../ui/alert';
import { Ban, Mail, Phone, AlertTriangle } from 'lucide-react';
import { CONTACT_INFO, SECURITY_COLORS } from '../../utils/auth/securityConstants';

interface AccountSuspendedPageProps {
  reason?: string;
  suspendedAt?: string;
  onLogout?: () => void;
}

export function AccountSuspendedPage({ 
  reason = 'Account activity review',
  suspendedAt,
  onLogout 
}: AccountSuspendedPageProps) {
  
  const formatDate = (dateString?: string) => {
    if (!dateString) return 'recently';
    try {
      return new Date(dateString).toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      });
    } catch {
      return 'recently';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        {/* Main Card */}
        <Card className="border-2 border-red-200 shadow-xl">
          <CardContent className="pt-12 pb-8 px-6 sm:px-12">
            {/* Icon */}
            <div className="flex justify-center mb-6">
              <div className="h-24 w-24 rounded-full bg-red-100 flex items-center justify-center">
                <Ban className="h-12 w-12 text-red-600" />
              </div>
            </div>

            {/* Title */}
            <h1 className="text-3xl text-center text-gray-900 mb-3">
              Account Suspended
            </h1>

            {/* Subtitle */}
            <p className="text-center text-gray-600 mb-8">
              Your account has been temporarily suspended and you cannot access the platform at this time.
            </p>

            {/* Reason Alert */}
            <Alert className="border-red-200 bg-red-50 mb-8">
              <AlertTriangle className="h-5 w-5 text-red-600" />
              <AlertDescription className="text-red-800">
                <p className="font-medium mb-1">Reason for suspension:</p>
                <p className="text-sm">{reason}</p>
                {suspendedAt && (
                  <p className="text-xs mt-2 text-red-700">
                    Suspended on {formatDate(suspendedAt)}
                  </p>
                )}
              </AlertDescription>
            </Alert>

            {/* Information */}
            <div className="space-y-4 mb-8">
              <div className="bg-gray-50 rounded-lg p-6 space-y-3">
                <h3 className="font-medium text-gray-900 mb-3">What you can do:</h3>
                
                <div className="space-y-3 text-sm text-gray-700">
                  <div className="flex items-start gap-3">
                    <div className="h-6 w-6 rounded-full bg-[#6d28d9]/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Mail className="h-3.5 w-3.5 text-[#6d28d9]" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">Contact Support</p>
                      <p className="text-gray-600">
                        Email us at <a href={`mailto:${CONTACT_INFO.SUPPORT_EMAIL}`} className="text-[#6d28d9] hover:underline">{CONTACT_INFO.SUPPORT_EMAIL}</a> for assistance
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="h-6 w-6 rounded-full bg-[#6d28d9]/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Phone className="h-3.5 w-3.5 text-[#6d28d9]" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">Call Our Team</p>
                      <p className="text-gray-600">
                        Reach us at <a href={CONTACT_INFO.PHONE_HREF} className="text-[#6d28d9] hover:underline">{CONTACT_INFO.PHONE}</a> during business hours
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-800">
                  <strong>Note:</strong> Account suspensions are typically temporary and resolved within 1-3 business days after reviewing your case.
                </p>
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button
                variant="outline"
                onClick={onLogout}
                className="w-full sm:w-auto"
              >
                Sign Out
              </Button>
              <Button
                onClick={() => window.location.href = `mailto:${CONTACT_INFO.SUPPORT_EMAIL}?subject=Account%20Suspension%20Inquiry`}
                className="bg-[#6d28d9] hover:bg-[#5b21b6] text-white w-full sm:w-auto"
              >
                <Mail className="h-4 w-4 mr-2" />
                Contact Support
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="mt-6 text-center">
          <p className="text-sm text-gray-500">
            Navigate Wealth | {CONTACT_INFO.ADDRESS}
          </p>
        </div>
      </div>
    </div>
  );
}
