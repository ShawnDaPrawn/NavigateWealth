import React, { useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { EmptyPolicyState } from './EmptyPolicyState';
import { projectId, publicAnonKey } from '../../utils/supabase/info';
import { AlertCircle, Clock, CheckCircle } from 'lucide-react';

const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-91ed8379`;

interface ApplicationStatusGuardProps {
  children: React.ReactNode;
  requireApproved?: boolean;
}

/**
 * ApplicationStatusGuard
 * 
 * Protects portal routes based on application status:
 * - Pending/Submitted: Shows pending message (no access to dashboard)
 * - Approved: Shows full dashboard (children) - full access granted
 * - Declined: Shows declined message with contact support
 * - Default: Shows full dashboard
 */
export function ApplicationStatusGuard({ 
  children, 
  requireApproved = true 
}: ApplicationStatusGuardProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [applicationStatus, setApplicationStatus] = useState<string | null>(null);
  const [hasPolicies, setHasPolicies] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.id) {
      setLoading(false);
      return;
    }

    fetchUserApplicationStatus();
  }, [user?.id]);

  const fetchUserApplicationStatus = async () => {
    try {
      setLoading(true);
      setError(null);

      if (!user?.id || !user?.email) {
        throw new Error('User information not available');
      }

      // Fetch user profile which contains application info
      const profileKey = `user_profile:${user.id}:personal_info`;
      const profileRes = await fetch(
        `${API_BASE}/profile/personal-info?key=${encodeURIComponent(profileKey)}&email=${encodeURIComponent(user.email)}`,
        {
          headers: { 'Authorization': `Bearer ${publicAnonKey}` }
        }
      );

      if (!profileRes.ok) {
        // If profile doesn't exist, user might be new - treat as in_progress
        if (profileRes.status === 404) {
          setApplicationStatus('in_progress');
          setLoading(false);
          return;
        }
        throw new Error('Failed to load profile');
      }

      const profileResponse = await profileRes.json();
      const profileData = profileResponse.data || profileResponse;
      const userId = user?.id;

      // Get application status from applications endpoint
      let status = 'in_progress'; // Default status
      
      // Fetch application details - use correct endpoint format
      const appRes = await fetch(
        `${API_BASE}/applications/${userId}`,
        {
          headers: { 'Authorization': `Bearer ${publicAnonKey}` }
        }
      );

      console.log('🔍 Application API Response Status:', appRes.status);

      if (appRes.ok) {
        const applicationResponse = await appRes.json();
        console.log('🔍 Application API Response Data:', JSON.stringify(applicationResponse, null, 2));
        
        // The endpoint returns { success: true, data: application }
        const userApp = applicationResponse.data;
        if (userApp && userApp.status) {
          status = userApp.status;
          console.log('✅ Application status loaded:', status);
        } else {
          console.log('ℹ️ No application found for user, defaulting to in_progress');
        }
      } else {
        const errorText = await appRes.text();
        console.log('⚠️ Failed to fetch application. Status:', appRes.status, 'Response:', errorText);
      }

      setApplicationStatus(status);

      // If approved, check if user has policies
      if (status === 'approved') {
        const policiesRes = await fetch(`${API_BASE}/integrations/policies?clientId=${userId}`, {
          headers: { 'Authorization': `Bearer ${publicAnonKey}` }
        });

        if (policiesRes.ok) {
          const policiesData = await policiesRes.json();
          // The policies endpoint returns { policies: [...] }
          const allPolicies = policiesData.policies || [];
          setHasPolicies(allPolicies.length > 0);
        }
      }

    } catch (err: unknown) {
      console.error('Error fetching application status:', err);
      setError(err instanceof Error ? err.message : 'Failed to load application status');
    } finally {
      setLoading(false);
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center space-y-4">
          <div className="h-12 w-12 border-4 border-purple-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-gray-600">Loading your account...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen p-4">
        <div className="max-w-md w-full bg-red-50 border border-red-200 rounded-lg p-6 text-center">
          <AlertCircle className="h-12 w-12 text-red-600 mx-auto mb-4" />
          <h3 className="text-red-900 font-semibold mb-2">Error Loading Account</h3>
          <p className="text-red-700 text-sm">{error}</p>
          <button
            onClick={fetchUserApplicationStatus}
            className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  // Pending application - block access
  if (requireApproved && (applicationStatus === 'in_progress' || applicationStatus === 'submitted')) {
    return (
      <div className="flex items-center justify-center min-h-screen p-4">
        <div className="max-w-2xl w-full bg-yellow-50 border border-yellow-200 rounded-lg p-8 text-center">
          <Clock className="h-16 w-16 text-yellow-600 mx-auto mb-4" />
          <h3 className="text-gray-900 mb-3">
            Application Under Review
          </h3>
          <p className="text-gray-600 mb-6 max-w-lg mx-auto">
            Thank you for submitting your application! Our team is currently reviewing your information. 
            You'll receive an email notification once your application has been approved.
          </p>
          <div className="bg-white border border-yellow-200 rounded-lg p-4 max-w-md mx-auto">
            <p className="text-sm text-gray-700">
              <strong className="text-gray-900">What's happening now:</strong>
            </p>
            <ul className="text-sm text-gray-600 mt-2 space-y-1 text-left">
              <li className="flex items-start gap-2">
                <span className="text-yellow-600 mt-1">•</span>
                <span>Your adviser is reviewing your application</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-yellow-600 mt-1">•</span>
                <span>They're preparing your personalized financial plan</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-yellow-600 mt-1">•</span>
                <span>You'll gain full access once approved</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    );
  }

  // Declined application
  if (applicationStatus === 'declined') {
    return (
      <div className="flex items-center justify-center min-h-screen p-4">
        <div className="max-w-2xl w-full bg-gray-50 border border-gray-200 rounded-lg p-8 text-center">
          <AlertCircle className="h-16 w-16 text-gray-600 mx-auto mb-4" />
          <h3 className="text-gray-900 mb-3">
            Application Status Update
          </h3>
          <p className="text-gray-600 mb-6 max-w-lg mx-auto">
            We're unable to proceed with your application at this time. 
            Please contact our team for more information.
          </p>
          <a 
            href="mailto:info@navigatewealth.co"
            className="inline-flex items-center px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
          >
            Contact Support
          </a>
        </div>
      </div>
    );
  }

  // Approved - show full dashboard (regardless of policy status)
  if (applicationStatus === 'approved') {
    return <div className="contents">{children}</div>;
  }

  // Default: show full dashboard for any other status
  return <div className="contents">{children}</div>;
}