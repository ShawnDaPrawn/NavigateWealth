import { Compass } from 'lucide-react';
import { cn } from './utils';

interface BrandLoaderPanelProps {
  title?: string;
  message?: string;
  badge?: string;
  compact?: boolean;
  className?: string;
}

interface BrandPageLoaderProps extends BrandLoaderPanelProps {
  containerClassName?: string;
}

interface BrandSectionLoaderProps extends BrandLoaderPanelProps {
  containerClassName?: string;
}

interface BrandInlineLoaderProps {
  label?: string;
  className?: string;
}

const CARDINALS = [
  { label: 'N', angle: 0 },
  { label: 'E', angle: 90 },
  { label: 'S', angle: 180 },
  { label: 'W', angle: 270 },
] as const;

const TICKS = Array.from({ length: 24 }, (_, i) => i * 15);

/** Polar to cartesian on the 100x100 viewBox, 0deg = North (up). */
function polar(angleDeg: number, radius: number) {
  const rad = (angleDeg * Math.PI) / 180;
  return {
    x: 50 + radius * Math.sin(rad),
    y: 50 - radius * Math.cos(rad),
  };
}

function NavigationCompassLoader({ compact = false }: { compact?: boolean }) {
  const sizeClasses = compact ? 'h-16 w-16' : 'h-20 w-20';

  return (
    <div
      className={cn('relative flex items-center justify-center', sizeClasses)}
      aria-hidden="true"
    >
      <div className="absolute inset-0 rounded-full bg-[#6d28d9]/12 blur-2xl animate-pulse" />

      <svg
        viewBox="0 0 100 100"
        className="relative h-full w-full drop-shadow-[0_18px_30px_-18px_rgba(26,30,54,0.7)]"
      >
        <defs>
          <radialGradient id="compass-dial-face" cx="50%" cy="38%" r="68%">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="62%" stopColor="#f5f7fb" />
            <stop offset="100%" stopColor="#e6ebf4" />
          </radialGradient>
          <linearGradient id="compass-needle-north" x1="50%" y1="0%" x2="50%" y2="100%">
            <stop offset="0%" stopColor="#8b5cf6" />
            <stop offset="100%" stopColor="#6d28d9" />
          </linearGradient>
          <linearGradient id="compass-needle-south" x1="50%" y1="0%" x2="50%" y2="100%">
            <stop offset="0%" stopColor="#cbd5e1" />
            <stop offset="100%" stopColor="#94a3b8" />
          </linearGradient>
        </defs>

        {/* Bezel + dial face */}
        <circle cx="50" cy="50" r="47" fill="url(#compass-dial-face)" />
        <circle
          cx="50"
          cy="50"
          r="47"
          fill="none"
          stroke="#1a1e36"
          strokeOpacity="0.14"
          strokeWidth="1.5"
        />
        <circle
          cx="50"
          cy="50"
          r="40.5"
          fill="none"
          stroke="#1a1e36"
          strokeOpacity="0.08"
          strokeWidth="1"
        />

        {/* Slowly rotating tick ring for depth */}
        <g className="animate-compass-dial">
          {TICKS.map((angle) => {
            const major = angle % 90 === 0;
            const outer = polar(angle, 39);
            const inner = polar(angle, major ? 31.5 : 35.5);
            return (
              <line
                key={angle}
                x1={inner.x}
                y1={inner.y}
                x2={outer.x}
                y2={outer.y}
                stroke={major ? '#6d28d9' : '#94a3b8'}
                strokeOpacity={major ? 0.6 : 0.4}
                strokeWidth={major ? 1.8 : 1}
                strokeLinecap="round"
              />
            );
          })}
        </g>

        {/* Cardinal letters */}
        {CARDINALS.map(({ label, angle }) => {
          const pos = polar(angle, 27);
          return (
            <text
              key={label}
              x={pos.x}
              y={pos.y}
              textAnchor="middle"
              dominantBaseline="central"
              fontSize="9.5"
              fontWeight="700"
              fill={label === 'N' ? '#6d28d9' : '#1a1e36'}
              fillOpacity={label === 'N' ? 1 : 0.45}
            >
              {label}
            </text>
          );
        })}

        {/* Seeking magnetic needle */}
        <g className="animate-compass-seek">
          <polygon points="50,15 46.4,50 53.6,50" fill="url(#compass-needle-north)" />
          <polygon points="50,85 46.4,50 53.6,50" fill="url(#compass-needle-south)" />
        </g>

        {/* Center hub */}
        <circle cx="50" cy="50" r="5.4" fill="#1a1e36" />
        <circle
          cx="50"
          cy="50"
          r="5.4"
          fill="none"
          stroke="#ffffff"
          strokeOpacity="0.85"
          strokeWidth="1.4"
        />
        <circle cx="50" cy="50" r="1.9" fill="#8b5cf6" />
      </svg>
    </div>
  );
}

export function BrandLoaderPanel({
  title = 'Plotting your course',
  message = 'Checking your bearing and bringing the next view into focus.',
  badge = 'Charting course',
  compact = false,
  className,
}: BrandLoaderPanelProps) {
  return (
    <div
      className={cn(
        'relative w-full max-w-md overflow-hidden rounded-[28px] border border-slate-200/80 bg-white/90 text-center shadow-[0_28px_90px_-48px_rgba(26,30,54,0.6)] backdrop-blur-sm',
        compact ? 'px-6 py-7' : 'px-8 py-9',
        className,
      )}
      role="status"
      aria-live="polite"
      aria-label={title}
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.35]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(26, 30, 54, 0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(26, 30, 54, 0.05) 1px, transparent 1px)',
          backgroundSize: '24px 24px',
        }}
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-[radial-gradient(circle_at_50%_120%,rgba(109,40,217,0.12),transparent_70%)]"
        aria-hidden="true"
      />

      <div className="relative">
        <div className="mx-auto mb-4 inline-flex items-center gap-2 rounded-full border border-[#6d28d9]/15 bg-[#6d28d9]/7 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-[#5b21b6]">
          <Compass className="h-3 w-3" aria-hidden="true" />
          {badge}
        </div>
        <div className="flex flex-col items-center">
          <NavigationCompassLoader compact={compact} />
          <h2
            className={cn(
              'mt-5 font-semibold tracking-tight text-[#1a1e36]',
              compact ? 'text-lg' : 'text-xl',
            )}
          >
            {title}
          </h2>
          <p
            className={cn(
              'mt-2 max-w-sm text-balance text-slate-600',
              compact ? 'text-sm' : 'text-sm leading-6',
            )}
          >
            {message}
          </p>
        </div>
      </div>
    </div>
  );
}

export function BrandPageLoader({ containerClassName, ...panelProps }: BrandPageLoaderProps) {
  return (
    <div
      className={cn(
        'relative min-h-screen px-4 py-8 flex items-center justify-center overflow-hidden',
        'bg-[radial-gradient(circle_at_top,rgba(109,40,217,0.1),transparent_32%),linear-gradient(180deg,#f4f7fb_0%,#e7eef6_100%)]',
        containerClassName,
      )}
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          backgroundImage:
            'linear-gradient(rgba(26, 30, 54, 0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(26, 30, 54, 0.04) 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }}
        aria-hidden="true"
      />
      <div className="relative">
        <BrandLoaderPanel {...panelProps} />
      </div>
    </div>
  );
}

export function BrandSectionLoader({
  containerClassName,
  compact = true,
  ...panelProps
}: BrandSectionLoaderProps) {
  return (
    <div className={cn('flex items-center justify-center py-12', containerClassName)}>
      <BrandLoaderPanel compact={compact} {...panelProps} />
    </div>
  );
}

export function BrandInlineLoader({
  label = 'Plotting course...',
  className,
}: BrandInlineLoaderProps) {
  return (
    <div
      className={cn('inline-flex items-center gap-2 text-sm font-medium text-slate-600', className)}
      role="status"
      aria-live="polite"
    >
      <span className="relative flex h-4 w-4 items-center justify-center" aria-hidden="true">
        <span className="absolute inset-0 rounded-full border border-[#6d28d9]/20" />
        <span className="absolute inset-[1px] rounded-full border border-dashed border-[#6d28d9]/30 animate-spin [animation-duration:3s]" />
        <Compass className="h-2.5 w-2.5 text-[#6d28d9]" strokeWidth={2.4} />
      </span>
      <span>{label}</span>
    </div>
  );
}
