/**
 * OG Image Generator
 *
 * A standalone tool for generating Open Graph preview images for each page.
 * Navigate to /og-preview to use it.
 *
 * Usage:
 *   1. Select a variant from the left panel
 *   2. Click "Open full size" to open the raw 1200×630 render in a new tab
 *   3. In that tab: right-click → Save image as… OR use browser screenshot
 *      (Chrome: Cmd/Ctrl+Shift+P → "Capture screenshot" at device size)
 *   4. Save the file with the name shown (e.g. og-default.jpg)
 *   5. Upload to your domain root (e.g. https://www.navigatewealth.co/og-default.jpg)
 *
 * Adding new variants:
 *   - Add an entry to OG_VARIANTS below
 *   - Create the corresponding <OGImage*> component
 */

import React, { useState } from 'react';
import navigateWealthLogo from 'figma:asset/def9c4d4fdd055d486a64e8df869988fd6a2aca3.png';
import { ImageWithFallback } from '../figma/ImageWithFallback';

/* ─────────────────────────────────────────────────────────────────────────────
   Brand tokens (inline — these must not depend on CSS variables since the
   image is rendered as a static visual, not a live page)
───────────────────────────────────────────────────────────────────────────── */

const NAVY   = '#313653';
const NAVY_LIGHT = '#3d4268';
const PURPLE = '#6d28d9';
const PURPLE_LIGHT = '#7c3aed';
const WHITE  = '#ffffff';
const GRAY_300 = '#d1d5db';
const GRAY_400 = '#9ca3af';

/* ─────────────────────────────────────────────────────────────────────────────
   OG Image Components — each renders at exactly 1200 × 630 px
   Use only inline styles. No Tailwind classes (they won't apply at screenshot time).
───────────────────────────────────────────────────────────────────────────── */

/** Shared logo + wordmark strip */
function LogoStrip({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const h = size === 'lg' ? 52 : size === 'md' ? 40 : 30;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
      <ImageWithFallback
        src={navigateWealthLogo}
        alt="Navigate Wealth"
        style={{ height: h, width: 'auto', display: 'block' }}
      />
    </div>
  );
}

/** Decorative dot grid */
function DotGrid({ color = 'rgba(255,255,255,0.06)', cols = 18, rows = 9 }: {
  color?: string; cols?: number; rows?: number;
}) {
  const dots = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      dots.push(
        <circle key={`${r}-${c}`} cx={c * 60 + 30} cy={r * 60 + 30} r={2} fill={color} />
      );
    }
  }
  return (
    <svg
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
      viewBox={`0 0 ${cols * 60} ${rows * 60}`}
      preserveAspectRatio="xMidYMid slice"
    >
      {dots}
    </svg>
  );
}

/** Decorative arc */
function Arc({ color = 'rgba(109,40,217,0.25)' }: { color?: string }) {
  return (
    <svg
      style={{ position: 'absolute', bottom: -100, right: -100, width: 500, height: 500, pointerEvents: 'none' }}
      viewBox="0 0 500 500"
    >
      <circle cx="250" cy="250" r="200" fill="none" stroke={color} strokeWidth="60" />
      <circle cx="250" cy="250" r="130" fill="none" stroke={color} strokeWidth="30" opacity="0.5" />
    </svg>
  );
}

/* ── DEFAULT OG IMAGE ──────────────────────────────────────────────────────── */

export function OGImageDefault() {
  return (
    <div style={{
      width: 1200, height: 630,
      background: NAVY,
      position: 'relative',
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
      fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif",
    }}>
      {/* Background decoration */}
      <DotGrid />
      <Arc />

      {/* Top-left purple bar */}
      <div style={{
        position: 'absolute', top: 0, left: 0,
        width: 6, height: '100%',
        background: `linear-gradient(to bottom, ${PURPLE}, transparent)`,
      }} />

      {/* Large faint circle background accent */}
      <div style={{
        position: 'absolute',
        top: -180, right: -180,
        width: 600, height: 600,
        borderRadius: '50%',
        background: `radial-gradient(circle, rgba(109,40,217,0.18) 0%, transparent 70%)`,
        pointerEvents: 'none',
      }} />

      {/* Content */}
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        padding: '60px 80px',
        position: 'relative',
        zIndex: 1,
        textAlign: 'center',
      }}>

        {/* Logo */}
        <div style={{ marginBottom: 32 }}>
          <LogoStrip size="lg" />
        </div>

        {/* Divider */}
        <div style={{
          width: 64, height: 3,
          background: `linear-gradient(to right, ${PURPLE}, ${PURPLE_LIGHT})`,
          borderRadius: 2,
          marginBottom: 32,
        }} />

        {/* Main headline */}
        <div style={{
          fontSize: 54,
          fontWeight: 800,
          color: WHITE,
          letterSpacing: '-1.5px',
          lineHeight: 1.1,
          marginBottom: 20,
        }}>
          Independent Financial Advisors
        </div>

        {/* Subheading */}
        <div style={{
          fontSize: 26,
          fontWeight: 400,
          color: GRAY_300,
          lineHeight: 1.4,
          maxWidth: 700,
          marginBottom: 48,
        }}>
          Comprehensive financial planning, investment management,<br />
          and wealth protection across South Africa.
        </div>

        {/* Service pills */}
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center', marginBottom: 48 }}>
          {['Risk Management', 'Retirement Planning', 'Investment Management', 'Tax Planning', 'Estate Planning'].map(s => (
            <div key={s} style={{
              background: 'rgba(255,255,255,0.08)',
              border: '1px solid rgba(255,255,255,0.15)',
              borderRadius: 100,
              padding: '8px 20px',
              fontSize: 16,
              fontWeight: 500,
              color: GRAY_300,
            }}>
              {s}
            </div>
          ))}
        </div>
      </div>

      {/* Footer strip */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '20px 56px',
        borderTop: '1px solid rgba(255,255,255,0.08)',
        position: 'relative',
        zIndex: 1,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 8, height: 8, borderRadius: '50%',
            background: '#22c55e',
          }} />
          <span style={{ fontSize: 16, color: GRAY_400, fontWeight: 500 }}>FSCA Regulated</span>
        </div>
        <div style={{ fontSize: 18, color: GRAY_400, fontWeight: 600, letterSpacing: '0.3px' }}>
          navigatewealth.co
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            background: 'rgba(109,40,217,0.2)',
            borderRadius: 8,
            padding: '4px 14px',
            fontSize: 14,
            fontWeight: 600,
            color: '#a78bfa',
          }}>
            Free Consultation Available
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── RISK MANAGEMENT OG IMAGE ─────────────────────────────────────────────── */

function ShieldIcon({ size = 120, color = PURPLE }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path
        d="M12 2L3 6v6c0 5.25 3.75 10.15 9 11.25C17.25 22.15 21 17.25 21 12V6L12 2z"
        fill={color}
        opacity="0.15"
      />
      <path
        d="M12 2L3 6v6c0 5.25 3.75 10.15 9 11.25C17.25 22.15 21 17.25 21 12V6L12 2z"
        stroke={color}
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path
        d="M9 12l2 2 4-4"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function OGImageRiskManagement() {
  const products = ['Life Cover', 'Disability Cover', 'Severe Illness', 'Income Protection', 'Business Assurance'];

  return (
    <div style={{
      width: 1200, height: 630,
      background: NAVY,
      position: 'relative',
      overflow: 'hidden',
      display: 'flex',
      fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif",
    }}>
      {/* Left accent bar */}
      <div style={{
        position: 'absolute', top: 0, left: 0,
        width: 6, height: '100%',
        background: `linear-gradient(to bottom, ${PURPLE}, transparent)`,
      }} />

      {/* Background dot grid */}
      <DotGrid />

      {/* Right panel — lighter section */}
      <div style={{
        position: 'absolute',
        top: 0, right: 0,
        width: 420, height: '100%',
        background: `linear-gradient(135deg, rgba(109,40,217,0.1) 0%, rgba(61,66,104,0.5) 100%)`,
        borderLeft: '1px solid rgba(255,255,255,0.07)',
      }}>
        {/* Concentric arcs */}
        <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} viewBox="0 0 420 630" preserveAspectRatio="xMidYMid slice">
          <circle cx="210" cy="315" r="180" fill="none" stroke="rgba(109,40,217,0.2)" strokeWidth="1" />
          <circle cx="210" cy="315" r="130" fill="none" stroke="rgba(109,40,217,0.15)" strokeWidth="1" />
          <circle cx="210" cy="315" r="80"  fill="none" stroke="rgba(109,40,217,0.12)" strokeWidth="1" />
        </svg>

        {/* Shield icon centered */}
        <div style={{
          position: 'absolute',
          top: '50%', left: '50%',
          transform: 'translate(-50%, -50%)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 16,
        }}>
          <div style={{
            width: 140, height: 140,
            borderRadius: '50%',
            background: 'rgba(109,40,217,0.15)',
            border: '2px solid rgba(109,40,217,0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <ShieldIcon size={72} color={PURPLE_LIGHT} />
          </div>
          <div style={{
            fontSize: 13,
            fontWeight: 600,
            color: '#a78bfa',
            letterSpacing: '0.15em',
            textTransform: 'uppercase',
            textAlign: 'center',
          }}>
            Navigate Wealth
          </div>
        </div>

        {/* FSCA badge */}
        <div style={{
          position: 'absolute',
          bottom: 32, left: '50%',
          transform: 'translateX(-50%)',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          background: 'rgba(255,255,255,0.06)',
          border: '1px solid rgba(255,255,255,0.12)',
          borderRadius: 100,
          padding: '8px 20px',
        }}>
          <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#22c55e' }} />
          <span style={{ fontSize: 13, color: GRAY_400, fontWeight: 500 }}>FSCA Regulated</span>
        </div>
      </div>

      {/* LEFT — Main content */}
      <div style={{
        width: 780,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '52px 56px',
        position: 'relative',
        zIndex: 1,
      }}>

        {/* Top: logo + badge */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <LogoStrip size="sm" />
          <div style={{
            background: 'rgba(109,40,217,0.2)',
            border: '1px solid rgba(109,40,217,0.35)',
            borderRadius: 100,
            padding: '6px 18px',
            fontSize: 13,
            fontWeight: 600,
            color: '#a78bfa',
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
          }}>
            Risk Management
          </div>
        </div>

        {/* Main headline block */}
        <div>
          {/* Kicker */}
          <div style={{
            fontSize: 16,
            fontWeight: 600,
            color: PURPLE_LIGHT,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            marginBottom: 16,
          }}>
            Insurance &amp; Protection
          </div>

          {/* Headline */}
          <div style={{
            fontSize: 62,
            fontWeight: 800,
            color: WHITE,
            letterSpacing: '-2px',
            lineHeight: 1.05,
            marginBottom: 20,
          }}>
            Protecting What<br />
            <span style={{ color: '#a78bfa' }}>Matters Most</span>
          </div>

          {/* Subheading */}
          <div style={{
            fontSize: 22,
            color: GRAY_300,
            lineHeight: 1.5,
            marginBottom: 36,
            maxWidth: 580,
          }}>
            Independent advice across South Africa's leading insurers — we find the right cover at the right price for you.
          </div>

          {/* Product pills */}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {products.map(p => (
              <div key={p} style={{
                background: 'rgba(255,255,255,0.07)',
                border: '1px solid rgba(255,255,255,0.14)',
                borderRadius: 100,
                padding: '8px 18px',
                fontSize: 15,
                fontWeight: 500,
                color: GRAY_300,
              }}>
                {p}
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingTop: 24,
          borderTop: '1px solid rgba(255,255,255,0.08)',
        }}>
          <div style={{ fontSize: 16, color: GRAY_400, fontWeight: 500 }}>
            navigatewealth.co/services/risk-management
          </div>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            background: PURPLE,
            borderRadius: 100,
            padding: '9px 22px',
            fontSize: 15,
            fontWeight: 600,
            color: WHITE,
          }}>
            Get a Free Quote →
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   Variant registry — add new service page OG images here
───────────────────────────────────────────────────────────────────────────── */

const OG_VARIANTS: {
  id: string;
  label: string;
  filename: string;
  uploadPath: string;
  description: string;
  component: React.ComponentType;
}[] = [
  {
    id: 'default',
    label: 'Site Default',
    filename: 'og-default.jpg',
    uploadPath: 'https://www.navigatewealth.co/og-default.jpg',
    description: 'Used on all pages that don\'t have a specific OG image. This is your brand\'s social media business card.',
    component: OGImageDefault,
  },
  {
    id: 'risk-management',
    label: 'Risk Management',
    filename: 'og-risk-management.jpg',
    uploadPath: 'https://www.navigatewealth.co/og-risk-management.jpg',
    description: 'Used when someone shares the Risk Management service page on LinkedIn, WhatsApp, or social media.',
    component: OGImageRiskManagement,
  },
];

/* ─────────────────────────────────────────────────────────────────────────────
   Generator UI — the full tool page
───────────────────────────────────────────────────────────────────────────── */

export function OGImageGeneratorPage() {
  const [activeVariant, setActiveVariant] = useState('default');
  const [showRaw, setShowRaw] = useState(false);

  const variant = OG_VARIANTS.find(v => v.id === activeVariant) ?? OG_VARIANTS[0];
  const OGComponent = variant.component;

  // Scale factor to fit the 1200px wide image inside the preview area
  const PREVIEW_MAX_WIDTH = 820;
  const scale = PREVIEW_MAX_WIDTH / 1200;

  return (
    <div className="min-h-screen bg-gray-950 text-white">

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="border-b border-white/8 bg-gray-900/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-screen-xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-purple-600/20 rounded-lg flex items-center justify-center">
              <svg className="w-4 h-4 text-purple-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="18" height="14" rx="2" />
                <path d="M3 7h18" />
              </svg>
            </div>
            <div>
              <div className="text-sm font-bold text-white">OG Image Generator</div>
              <div className="text-[11px] text-gray-400">Navigate Wealth — Social Preview Images</div>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-400 bg-white/5 border border-white/10 rounded-full px-4 py-2">
            <span className="w-2 h-2 rounded-full bg-green-400 inline-block"></span>
            Internal tool · not indexed
          </div>
        </div>
      </div>

      <div className="max-w-screen-xl mx-auto px-6 py-10 flex gap-8">

        {/* ── Left panel — variant selector + instructions ───────────── */}
        <div className="w-72 flex-shrink-0 space-y-6">

          {/* Variant selector */}
          <div>
            <div className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest mb-3">Select Image</div>
            <div className="space-y-2">
              {OG_VARIANTS.map(v => (
                <button
                  key={v.id}
                  onClick={() => setActiveVariant(v.id)}
                  className={`w-full text-left rounded-xl px-4 py-3 border transition-all duration-150 ${
                    activeVariant === v.id
                      ? 'bg-purple-600/15 border-purple-500/50 text-white'
                      : 'bg-white/4 border-white/8 text-gray-300 hover:bg-white/8 hover:border-white/15'
                  }`}
                >
                  <div className="text-sm font-semibold mb-0.5">{v.label}</div>
                  <div className="text-[11px] text-gray-500 font-mono">{v.filename}</div>
                </button>
              ))}
            </div>
          </div>

          {/* About this image */}
          <div className="bg-white/4 border border-white/8 rounded-xl p-4">
            <div className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest mb-2">About this image</div>
            <p className="text-xs text-gray-300 leading-relaxed">{variant.description}</p>
          </div>

          {/* File info */}
          <div className="bg-white/4 border border-white/8 rounded-xl p-4 space-y-3">
            <div className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest">File Details</div>
            {[
              { label: 'Dimensions', value: '1200 × 630 px' },
              { label: 'Format',     value: 'JPG (save as)' },
              { label: 'Filename',   value: variant.filename },
            ].map(({ label, value }) => (
              <div key={label} className="flex items-start justify-between gap-2">
                <span className="text-[11px] text-gray-500">{label}</span>
                <span className="text-[11px] text-gray-200 font-mono text-right">{value}</span>
              </div>
            ))}
            <div className="border-t border-white/8 pt-3">
              <div className="text-[11px] text-gray-500 mb-1">Upload to:</div>
              <div className="text-[10px] text-purple-300 font-mono break-all">{variant.uploadPath}</div>
            </div>
          </div>

          {/* How to save */}
          <div className="bg-amber-950/30 border border-amber-500/20 rounded-xl p-4">
            <div className="text-[11px] font-semibold text-amber-400 uppercase tracking-widest mb-3">How to Save</div>
            <ol className="space-y-2.5">
              {[
                'Click "Open full size" below',
                'In the new tab, right-click the image',
                'Select "Save image as…"',
                `Name it exactly: ${variant.filename}`,
                'Upload to your domain root',
              ].map((step, i) => (
                <li key={i} className="flex gap-2.5 text-xs text-amber-200/70 leading-relaxed">
                  <span className="flex-shrink-0 w-4 h-4 rounded-full bg-amber-500/20 text-amber-400 text-[10px] flex items-center justify-center font-bold mt-0.5">
                    {i + 1}
                  </span>
                  {step}
                </li>
              ))}
            </ol>
          </div>

          <button
            onClick={() => setShowRaw(true)}
            className="w-full bg-purple-600 hover:bg-purple-700 text-white font-semibold text-sm rounded-xl py-3 transition-colors duration-150 flex items-center justify-center gap-2"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" />
              <polyline points="15 3 21 3 21 9" />
              <line x1="10" y1="14" x2="21" y2="3" />
            </svg>
            Open full size
          </button>
        </div>

        {/* ── Right panel — scaled preview ───────────────────────────── */}
        <div className="flex-1 min-w-0">
          <div className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest mb-4">
            Preview — scaled to fit ({Math.round(scale * 100)}% of actual size)
          </div>

          {/* Preview container — maintains the 1200×630 aspect ratio */}
          <div
            className="relative rounded-2xl overflow-hidden border border-white/10 shadow-2xl"
            style={{ paddingTop: `${(630 / 1200) * 100}%` }}
          >
            <div className="absolute inset-0 flex items-center justify-center bg-[#1a1a2e]">
              {/* Checkerboard to show true bounds */}
              <div
                className="absolute inset-0 opacity-30"
                style={{
                  backgroundImage: 'repeating-conic-gradient(#2a2a3e 0% 25%, #1a1a2e 0% 50%)',
                  backgroundSize: '20px 20px',
                }}
              />
              {/* Scaled image */}
              <div
                style={{
                  transform: `scale(${scale})`,
                  transformOrigin: 'top left',
                  position: 'absolute',
                  top: 0, left: 0,
                  width: 1200,
                  height: 630,
                }}
              >
                <OGComponent />
              </div>
            </div>
          </div>

          {/* Dimension label */}
          <div className="flex items-center justify-between mt-3 text-xs text-gray-500">
            <span>Preview: {Math.round(1200 * scale)} × {Math.round(630 * scale)} px</span>
            <span>Actual: 1200 × 630 px · {variant.filename}</span>
          </div>
        </div>
      </div>

      {/* ── Full-size modal ────────────────────────────────────────────────── */}
      {showRaw && (
        <div
          className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-start justify-center overflow-auto py-8"
          onClick={() => setShowRaw(false)}
        >
          <div onClick={e => e.stopPropagation()} className="space-y-4">
            {/* Instructions bar */}
            <div className="flex items-center justify-between px-4 py-3 bg-gray-900 rounded-xl border border-white/10 text-sm">
              <div className="flex items-center gap-3 text-amber-300">
                <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2a10 10 0 100 20A10 10 0 0012 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
                </svg>
                <span>Right-click the image below → <strong>Save image as…</strong> → save as <code className="bg-black/30 px-1.5 py-0.5 rounded text-[11px]">{variant.filename}</code></span>
              </div>
              <button
                onClick={() => setShowRaw(false)}
                className="text-gray-400 hover:text-white ml-6 flex-shrink-0 text-lg leading-none"
              >
                ✕
              </button>
            </div>

            {/* The actual 1200×630 image — right-click to save */}
            <div className="rounded-xl overflow-hidden shadow-2xl" style={{ width: 1200, height: 630 }}>
              <OGComponent />
            </div>

            <div className="text-center text-xs text-gray-500">
              Actual size: 1200 × 630 px · Click outside to close
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
