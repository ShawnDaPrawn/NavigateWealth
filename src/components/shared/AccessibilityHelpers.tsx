/**
 * AccessibilityHelpers — Shared utilities for WCAG 2.1 AA compliance
 *
 * Provides:
 * - SkipToContent: skip navigation link (keyboard users)
 * - LiveRegion: screen reader announcements for dynamic content
 * - VisuallyHidden: content visible only to screen readers
 *
 * Guidelines §8.3 — Accessibility (WCAG 2.1 AA Minimum)
 */
import React, { useEffect, useState } from 'react';

// ─── Skip to Content ──────────────────────────────────────────
// Renders an anchor that becomes visible on focus, allowing
// keyboard users to skip past navigation directly to main content.
interface SkipToContentProps {
  targetId?: string;
  label?: string;
}

export function SkipToContent({
  targetId = 'main-content',
  label = 'Skip to main content',
}: SkipToContentProps) {
  return (
    <a
      href={`#${targetId}`}
      className="skip-to-content"
    >
      {label}
    </a>
  );
}

// ─── Live Region ──────────────────────────────────────────────
// Announces dynamic content changes to screen readers.
// - politeness="polite" (default): waits for idle
// - politeness="assertive": interrupts immediately (errors)
interface LiveRegionProps {
  message: string;
  politeness?: 'polite' | 'assertive';
  clearAfterMs?: number;
}

export function LiveRegion({
  message,
  politeness = 'polite',
  clearAfterMs = 5000,
}: LiveRegionProps) {
  const [currentMessage, setCurrentMessage] = useState(message);

  useEffect(() => {
    setCurrentMessage(message);

    if (message && clearAfterMs > 0) {
      const timer = setTimeout(() => setCurrentMessage(''), clearAfterMs);
      return () => clearTimeout(timer);
    }
  }, [message, clearAfterMs]);

  return (
    <div
      role="status"
      aria-live={politeness}
      aria-atomic="true"
      className="sr-only"
    >
      {currentMessage}
    </div>
  );
}

// ─── useAnnounce hook ─────────────────────────────────────────
// Imperative hook that injects announcements via a live region.
export function useAnnounce() {
  const [announcement, setAnnouncement] = useState('');

  const announce = (msg: string) => {
    // Clear first to ensure re-announcement of identical messages
    setAnnouncement('');
    requestAnimationFrame(() => setAnnouncement(msg));
  };

  const Announcer = () => (
    <LiveRegion message={announcement} politeness="polite" />
  );

  return { announce, Announcer };
}

// ─── ErrorAnnouncer ───────────────────────────────────────────
// Assertive live region for error messages — interrupts screen reader.
export function ErrorAnnouncer({ message }: { message: string }) {
  if (!message) return null;

  return (
    <div
      role="alert"
      aria-live="assertive"
      aria-atomic="true"
      className="sr-only"
    >
      {message}
    </div>
  );
}
