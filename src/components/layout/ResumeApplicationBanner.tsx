/**
 * Resume Application Banner
 *
 * Persistent banner shown to authenticated users whose accountStatus is
 * 'application_in_progress'. Provides a clear CTA to continue their
 * application from where they left off.
 *
 * Guidelines refs: §7 (presentation layer), §8.3 (UI standards, status colours),
 * §8.4 (AI builder constraints)
 */

import React from 'react';
import { Link } from 'react-router';
import {
  ArrowRight,
  FileText,
  Clock,
} from 'lucide-react';
import { Button } from '../ui/button';

export function ResumeApplicationBanner() {
  return (
    <div className="bg-gradient-to-r from-[#6d28d9] via-[#7c3aed] to-[#6d28d9] border-b border-[#6d28d9]/30">
      <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 xl:px-12">
        <div className="flex items-center justify-between py-2.5 gap-4">
          {/* Left — Icon + message */}
          <div className="flex items-center gap-3 min-w-0">
            <div className="hidden sm:flex h-8 w-8 rounded-lg bg-white/15 items-center justify-center shrink-0">
              <FileText className="h-4 w-4 text-white" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-white truncate">
                Your application is in progress
              </p>
              <p className="text-xs text-white/70 hidden sm:block">
                <Clock className="inline h-3 w-3 mr-1 -mt-0.5" />
                Pick up right where you left off — your progress has been saved.
              </p>
            </div>
          </div>

          {/* Right — CTA */}
          <Link to="/application/personal-client" className="shrink-0">
            <Button
              size="sm"
              className="bg-white text-[#6d28d9] hover:bg-white/90 font-semibold shadow-sm text-xs sm:text-sm gap-1.5 cursor-pointer"
            >
              Resume Application
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
