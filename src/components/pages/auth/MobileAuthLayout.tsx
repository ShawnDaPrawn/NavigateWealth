import type { ReactNode } from 'react';

interface MobileAuthLayoutProps {
  children: ReactNode;
  /** Tailwind max-width class for the content column (e.g. "max-w-md", "max-w-xl"). */
  maxWidthClass?: string;
  /** Optional short caption shown under the wordmark (e.g. "Client Portal"). */
  caption?: string;
}

/**
 * Branded, full-screen auth shell for the installed PWA.
 *
 * Wraps the existing auth form content (login / signup / password reset) in a
 * consistent, mobile-first structure: the Navigate Wealth app icon and wordmark
 * up top, then the form in a clean rounded card — vertically centred, scrollable
 * when the form is tall, and respecting the device safe areas (notch / home bar).
 *
 * This is only used when running as an installed PWA, so the website rendered in
 * a normal browser is unaffected. Form fields and buttons are passed through as
 * children unchanged.
 */
export function MobileAuthLayout({
  children,
  maxWidthClass = 'max-w-md',
  caption = 'Client Portal',
}: MobileAuthLayoutProps) {
  return (
    <div
      className="min-h-[100dvh] overflow-y-auto bg-gradient-to-b from-purple-50 via-white to-white"
      style={{
        paddingTop: 'env(safe-area-inset-top)',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
    >
      <div className="mx-auto flex min-h-[100dvh] w-full flex-col items-center justify-center px-5 py-10">
        <div className={`flex w-full flex-col ${maxWidthClass}`}>
          {/* Brand */}
          <div className="mb-7 flex flex-col items-center text-center">
            <img
              src="/maskable-icon-512x512.png?v=20260605b"
              alt="Navigate Wealth"
              width={64}
              height={64}
              className="h-16 w-16 rounded-2xl shadow-md ring-1 ring-black/5"
            />
            <p className="mt-3 text-xl font-semibold tracking-tight text-gray-900">
              Navigate <span className="text-purple-700">Wealth</span>
            </p>
            {caption && (
              <p className="mt-1 text-xs font-medium uppercase tracking-wide text-gray-400">
                {caption}
              </p>
            )}
          </div>

          {/* Form card */}
          <div className="rounded-3xl border border-gray-100 bg-white p-6 shadow-xl shadow-purple-900/5 sm:p-8">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
