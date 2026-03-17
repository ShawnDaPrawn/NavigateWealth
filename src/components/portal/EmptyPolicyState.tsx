import React from 'react';
import { FileText, Shield, TrendingUp, Package } from 'lucide-react';

export function EmptyPolicyState() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[500px] px-4 py-12">
      <div className="max-w-2xl w-full text-center space-y-6">
        {/* Icon Grid */}
        <div className="flex justify-center gap-4 mb-6">
          <div className="w-16 h-16 rounded-2xl bg-purple-50 flex items-center justify-center">
            <Shield className="w-8 h-8 text-purple-600" />
          </div>
          <div className="w-16 h-16 rounded-2xl bg-blue-50 flex items-center justify-center">
            <TrendingUp className="w-8 h-8 text-blue-600" />
          </div>
          <div className="w-16 h-16 rounded-2xl bg-green-50 flex items-center justify-center">
            <Package className="w-8 h-8 text-green-600" />
          </div>
        </div>

        {/* Main Content */}
        <div className="space-y-3">
          <h3 className="text-gray-900">
            Your Account is Active
          </h3>
          <p className="text-gray-600 max-w-lg mx-auto">
            Welcome to Navigate Wealth! Your account has been approved and is ready to use.
          </p>
        </div>

        {/* Info Box */}
        <div className="bg-purple-50 border border-purple-100 rounded-xl p-6 max-w-lg mx-auto">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 mt-1">
              <FileText className="w-5 h-5 text-purple-600" />
            </div>
            <div className="text-left space-y-2">
              <p className="text-gray-900 font-semibold">
                Building Your Portfolio
              </p>
              <p className="text-sm text-gray-600">
                Your dedicated financial adviser is currently preparing your personalized portfolio. 
                Your policy details, investment strategies, and financial planning information will appear here once they've been finalized.
              </p>
            </div>
          </div>
        </div>

        {/* What's Next */}
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-6 max-w-lg mx-auto text-left">
          <h4 className="text-gray-900 font-semibold mb-3">
            What happens next?
          </h4>
          <ul className="space-y-2 text-sm text-gray-600">
            <li className="flex items-start gap-2">
              <span className="text-purple-600 mt-1">•</span>
              <span>Your adviser will review your financial goals and circumstances</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-purple-600 mt-1">•</span>
              <span>They'll prepare tailored recommendations for your portfolio</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-purple-600 mt-1">•</span>
              <span>Once ready, your policy details will automatically appear in your dashboard</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-purple-600 mt-1">•</span>
              <span>You'll receive a notification when your portfolio is available</span>
            </li>
          </ul>
        </div>

        {/* Contact Info */}
        <div className="pt-4">
          <p className="text-sm text-gray-500">
            Have questions in the meantime?{' '}
            <a href="/contact" className="text-purple-600 hover:text-purple-700 font-medium">
              Contact your adviser
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
