/**
 * AuthorCard
 *
 * Polished author bio section displayed at the end of the article.
 * Uses a gradient background, avatar placeholder, and credentials.
 *
 * @module article-detail/AuthorCard
 */

import React from 'react';
import { User, Pen } from 'lucide-react';

interface AuthorCardProps {
  name: string;
  bio?: string;
  imageUrl?: string;
}

/** Default bio when no custom bio is provided */
const DEFAULT_BIO =
  'Wealthfront Pty Ltd t/a Navigate Wealth — our editorial team brings you expert insights and analysis on financial markets, investment strategies, and wealth management to help you make informed decisions about your financial future.';

export function AuthorCard({ name, bio, imageUrl }: AuthorCardProps) {
  return (
    <section className="mt-12" aria-label="About the author">
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-50 via-purple-50/40 to-indigo-50/60 border border-gray-100">
        {/* Decorative accent */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-purple-600 via-indigo-500 to-purple-400" />

        <div className="p-8 sm:p-10 flex flex-col sm:flex-row gap-6 items-start">
          {/* Avatar */}
          <div className="flex-shrink-0">
            {imageUrl ? (
              <img
                src={imageUrl}
                alt={name}
                className="w-20 h-20 rounded-full object-cover ring-4 ring-white shadow-md"
              />
            ) : (
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center ring-4 ring-white shadow-md">
                <User className="h-9 w-9 text-white" />
              </div>
            )}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-medium uppercase tracking-wider text-purple-600">
                Written by
              </span>
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-3">
              {name}
            </h3>
            <p className="text-gray-600 leading-relaxed text-[15px]">
              {bio || DEFAULT_BIO}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}