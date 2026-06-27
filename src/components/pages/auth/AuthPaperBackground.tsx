/**
 * AuthPaperBackground — decorative "chart paper" backdrop for the Login & Signup
 * pages, mirroring the Ask Vasco screen: a faint grid, a soft purple/blue glow,
 * a couple of outlined circles and a diagonal accent line.
 *
 * Renders an absolutely-positioned, non-interactive layer. Place it inside a
 * `relative overflow-hidden` container with a `bg-[#f8f9fb]` base, and keep the
 * page content above it with `relative z-10`.
 */

export function AuthPaperBackground() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0">
      {/* Soft glow toward the top */}
      <div className="absolute inset-x-0 top-0 h-80 bg-[radial-gradient(circle_at_28%_12%,rgba(109,40,217,0.10),transparent_34%),radial-gradient(circle_at_72%_0%,rgba(14,165,233,0.08),transparent_32%)]" />
      {/* Outlined circles, top-right */}
      <div className="absolute right-[-90px] top-28 h-72 w-72 rounded-full border border-[#c4b5fd]/30" />
      <div className="absolute right-[-42px] top-40 h-48 w-48 rounded-full border border-[#6d28d9]/10" />
      {/* Diagonal accent line */}
      <div className="absolute left-4 top-64 h-px w-80 rotate-[-12deg] bg-gradient-to-r from-transparent via-[#8b5cf6]/25 to-transparent" />
      {/* Chart-paper grid */}
      <div className="absolute inset-0 opacity-[0.04] [background-image:linear-gradient(rgba(26,30,54,0.8)_1px,transparent_1px),linear-gradient(90deg,rgba(26,30,54,0.8)_1px,transparent_1px)] [background-size:48px_48px]" />
    </div>
  );
}

export default AuthPaperBackground;
