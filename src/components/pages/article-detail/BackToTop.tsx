/**
 * BackToTop
 *
 * Floating button that appears once the user has scrolled past a threshold.
 * Smooth-scrolls back to the top of the page on click.
 *
 * @module article-detail/BackToTop
 */

import React, { useState, useEffect } from 'react';
import { ArrowUp } from 'lucide-react';
import { cn } from '../../ui/utils';

const SCROLL_THRESHOLD = 600;

export function BackToTop() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setVisible(window.scrollY > SCROLL_THRESHOLD);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <button
      onClick={scrollToTop}
      aria-label="Back to top"
      className={cn(
        'fixed bottom-8 right-8 z-50 p-3 rounded-full',
        'bg-white border border-gray-200 shadow-lg',
        'text-gray-600 hover:text-purple-600 hover:border-purple-200 hover:shadow-xl',
        'transition-all duration-300 ease-out',
        visible
          ? 'opacity-100 translate-y-0 pointer-events-auto'
          : 'opacity-0 translate-y-4 pointer-events-none'
      )}
    >
      <ArrowUp className="h-5 w-5" />
    </button>
  );
}
