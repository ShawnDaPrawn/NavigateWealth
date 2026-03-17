/**
 * Email Signature Generator
 *
 * Generates professional HTML email signatures with Navigate Wealth branding.
 * Four template styles: Modern, Elegant, Bold, Navigate.
 * Animated live preview, copy-to-clipboard, and HTML download.
 *
 * Guidelines:
 *   §7    — Presentation layer (no business logic in UI)
 *   §8.3  — Status colour vocabulary, stat card standards
 *   §8.4  — Platform constraints (sonner, motion)
 */

import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../../../ui/card';
import { Button } from '../../../../ui/button';
import { Badge } from '../../../../ui/badge';
import { Input } from '../../../../ui/input';
import { Label } from '../../../../ui/label';
import { Textarea } from '../../../../ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../../../ui/dialog';
import {
  Copy,
  Check,
  Download,
  Eye,
  Mail,
  Phone,
  Linkedin,
  Instagram,
  Youtube,
  Sparkles,
  RotateCcw,
  Code,
  User,
  Award,
  Palette,
  Shield,
  ImageIcon,
  Type,
  Bookmark,
  Trash2,
  Upload,
  FolderOpen,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner@2.0.3';
import navigateWealthLogo from 'figma:asset/def9c4d4fdd055d486a64e8df869988fd6a2aca3.png';

// ============================================================================
// TYPES
// ============================================================================

interface SignatureData {
  fullName: string;
  jobTitle: string;
  qualifications: string;
  email: string;
  phone: string;
  mobile: string;
  website: string;
  address: string;
  linkedinUrl: string;
  instagramUrl: string;
  youtubeUrl: string;
  xUrl: string;
  disclaimerText: string;
  logoUrl: string;
  logoSize: number;
  logoTransparentBg: boolean;
  primaryColour: string;
  secondaryColour: string;
  nameColour: string;
  titleColour: string;
  showFspTagline: boolean;
}

/** Fields that define a reusable branding format (excludes personal details). */
const FORMAT_FIELD_KEYS: (keyof SignatureData)[] = [
  'website', 'address',
  'linkedinUrl', 'instagramUrl', 'youtubeUrl', 'xUrl',
  'disclaimerText',
  'logoUrl', 'logoSize', 'logoTransparentBg',
  'primaryColour', 'secondaryColour', 'nameColour', 'titleColour',
  'showFspTagline',
];

/** A saved branding preset — stores template + format fields, not personal details. */
interface SavedFormat {
  id: string;
  name: string;
  createdAt: string;
  template: string;
  fields: Partial<SignatureData>;
}

const FORMAT_STORAGE_KEY = 'navigate_wealth_signature_formats';

// ============================================================================
// CONSTANTS
// ============================================================================

const TEMPLATES = [
  {
    id: 'modern',
    name: 'Modern',
    description: 'Two-column layout with gradient accent — best for everyday use',
  },
  {
    id: 'elegant',
    name: 'Elegant',
    description: 'Centred layout with refined dividers — ideal for senior staff',
  },
  {
    id: 'bold',
    name: 'Bold',
    description: 'Purple banner header with strong visual impact',
  },
  {
    id: 'navigate',
    name: 'Navigate',
    description: 'Website-inspired dark charcoal with brand aesthetic',
  },
] as const;

const DEFAULT_DATA: SignatureData = {
  fullName: '',
  jobTitle: '',
  qualifications: '',
  email: '',
  phone: '',
  mobile: '',
  website: 'www.navigatewealth.co.za',
  address: '',
  linkedinUrl: 'https://www.linkedin.com/company/navigatewealth/',
  instagramUrl: 'https://www.instagram.com/navigate_wealth',
  youtubeUrl: 'https://www.youtube.com/@navigatewealth',
  xUrl: '',
  disclaimerText:
    'This email and any attachments are confidential and intended solely for the addressee. If you are not the intended recipient, please notify the sender immediately and delete this email. Navigate Wealth is an authorised financial services provider (FSP No. 54606).',
  logoUrl: '',
  logoSize: 36,
  logoTransparentBg: false,
  primaryColour: '#6d28d9',
  secondaryColour: '#313653',
  nameColour: '',
  titleColour: '',
  showFspTagline: true,
};

const FSP_TAGLINE = 'Proudly South African \u00B7 Fiercely Independent \u00B7 FSP 54606';

// ============================================================================
// SOCIAL ICON SVGs (inline for email compatibility)
// ============================================================================

const SOCIAL_SVGS = {
  linkedin: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="FILL"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>`,
  instagram: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="FILL"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg>`,
  youtube: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="FILL"><path d="M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>`,
  x: `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="FILL"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>`,
};

function socialIconHtml(platform: keyof typeof SOCIAL_SVGS, colour: string): string {
  return SOCIAL_SVGS[platform].replace('FILL', colour);
}

// ============================================================================
// HTML GENERATORS — SHARED HELPERS
// ============================================================================

function getSocialLinks(data: SignatureData) {
  return [
    { platform: 'linkedin' as const, url: data.linkedinUrl, label: 'LinkedIn' },
    { platform: 'instagram' as const, url: data.instagramUrl, label: 'Instagram' },
    { platform: 'youtube' as const, url: data.youtubeUrl, label: 'YouTube' },
    { platform: 'x' as const, url: data.xUrl, label: 'X' },
  ].filter(l => l.url.trim());
}

function buildSocialRow(data: SignatureData, colour: string, style: 'icons' | 'pills' | 'text'): string {
  const links = getSocialLinks(data);
  if (links.length === 0) return '';

  if (style === 'pills') {
    const items = links.map(l =>
      `<a href="${l.url}" target="_blank" style="display:inline-block;padding:5px 12px;border-radius:14px;background-color:${colour}14;color:${colour};font-size:11px;font-weight:500;text-decoration:none;margin-right:6px;margin-bottom:4px;font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">${l.label}</a>`
    ).join('');
    return `<tr><td style="padding-top:12px;padding-bottom:8px;">${items}</td></tr>`;
  }

  if (style === 'icons') {
    const items = links.map(l =>
      `<a href="${l.url}" target="_blank" style="display:inline-block;margin-right:10px;text-decoration:none;vertical-align:middle;" title="${l.label}">${socialIconHtml(l.platform, colour)}</a>`
    ).join('');
    return `<tr><td style="padding-top:12px;padding-bottom:8px;">${items}</td></tr>`;
  }

  // text style
  const items = links.map(l =>
    `<a href="${l.url}" target="_blank" style="color:${colour};font-size:11px;text-decoration:none;margin-right:14px;font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">${l.label}</a>`
  ).join(' ');
  return `<tr><td style="padding-top:10px;padding-bottom:8px;">${items}</td></tr>`;
}

/**
 * Unified logo renderer.
 * transparent=true  → bare img, no background (works on any background)
 * transparent=false + darkBg=true  → white pill wrapper (legacy dark bg behaviour)
 * transparent=false + darkBg=false → bare img (light background, no wrapper needed)
 */
function logoBgHtml(logoSrc: string, size: number, transparent: boolean, darkBg: boolean): string {
  if (transparent) {
    return `<img src="${logoSrc}" alt="Navigate Wealth" height="${size}" style="height:${size}px;width:auto;display:block;" />`;
  }
  if (darkBg) {
    return `<img src="${logoSrc}" alt="Navigate Wealth" height="${size}" style="height:${size}px;width:auto;display:block;background-color:#ffffff;padding:4px 10px;border-radius:5px;" />`;
  }
  return `<img src="${logoSrc}" alt="Navigate Wealth" height="${size}" style="height:${size}px;width:auto;display:block;" />`;
}

function disclaimerHtml(text: string): string {
  if (!text) return '';
  return `<tr><td style="padding-top:16px;border-top:1px solid #e5e7eb;"><p style="font-size:9.5px;color:#9ca3af;line-height:1.5;margin:10px 0 0 0;font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">${text}</p></td></tr>`;
}

// ── MODERN ──────────────────────────────────────────────────────────────────

function generateModernHtml(data: SignatureData, logoSrc: string): string {
  const c = data.primaryColour;
  const nameCol = data.nameColour || '#111827';
  const titleCol = data.titleColour || c;

  const contactRow = (label: string, value: string, href: string) => {
    if (!value) return '';
    return `<tr><td style="padding-bottom:5px;font-size:13px;font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;"><span style="display:inline-block;width:22px;color:#9ca3af;font-size:11px;">${label}</span><a href="${href}" style="color:${c};text-decoration:none;">${value}</a></td></tr>`;
  };

  return `<table cellpadding="0" cellspacing="0" border="0" style="font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:13px;color:#374151;line-height:1.55;max-width:540px;">
  <tr><td style="padding-bottom:16px;">${logoBgHtml(logoSrc, data.logoSize, data.logoTransparentBg, false)}</td></tr>
  <tr><td>
    <table cellpadding="0" cellspacing="0" border="0"><tr>
      <!-- Gradient bar -->
      <td style="width:3px;border-radius:3px;background:linear-gradient(180deg,${c},${c}88);" width="3"></td>
      <td style="padding-left:16px;">
        <table cellpadding="0" cellspacing="0" border="0">
          <tr><td style="padding-bottom:2px;">
            <span style="font-size:18px;font-weight:700;color:${nameCol};letter-spacing:-0.2px;">${data.fullName}</span>
            ${data.qualifications ? `<span style="font-size:11.5px;color:#6b7280;margin-left:8px;font-weight:400;">${data.qualifications}</span>` : ''}
          </td></tr>
          ${data.jobTitle ? `<tr><td style="font-size:13px;color:${titleCol};font-weight:600;padding-bottom:14px;">${data.jobTitle}</td></tr>` : '<tr><td style="padding-bottom:12px;"></td></tr>'}
          ${contactRow('T', data.phone, `tel:${data.phone.replace(/\s/g, '')}`)}
          ${contactRow('M', data.mobile, `tel:${data.mobile.replace(/\s/g, '')}`)}
          ${contactRow('E', data.email, `mailto:${data.email}`)}
          ${contactRow('W', data.website, `https://${data.website.replace(/^https?:\/\//, '')}`)}
          ${data.address ? `<tr><td style="padding-top:8px;font-size:11.5px;color:#9ca3af;font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">${data.address}</td></tr>` : ''}
          ${buildSocialRow(data, c, 'icons')}
        </table>
      </td>
    </tr></table>
  </td></tr>
  ${disclaimerHtml(data.disclaimerText)}
</table>`;
}

// ── ELEGANT ─────────────────────────────────────────────────────────────────

function generateElegantHtml(data: SignatureData, logoSrc: string): string {
  const c = data.primaryColour;
  const gold = '#92711f';
  const nameCol = data.nameColour || '#111827';
  const titleCol = data.titleColour || gold;

  const contactItems = [
    data.phone ? `<a href="tel:${data.phone.replace(/\s/g, '')}" style="color:${c};text-decoration:none;font-size:12.5px;">${data.phone}</a>` : '',
    data.mobile ? `<a href="tel:${data.mobile.replace(/\s/g, '')}" style="color:${c};text-decoration:none;font-size:12.5px;">${data.mobile}</a>` : '',
    data.email ? `<a href="mailto:${data.email}" style="color:${c};text-decoration:none;font-size:12.5px;">${data.email}</a>` : '',
  ].filter(Boolean).join('<span style="color:#d1d5db;margin:0 10px;">|</span>');

  return `<table cellpadding="0" cellspacing="0" border="0" style="font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:13px;color:#374151;line-height:1.55;max-width:540px;">
  <tr><td style="text-align:center;padding-bottom:14px;">${logoBgHtml(logoSrc, data.logoSize, data.logoTransparentBg, false)}</td></tr>
  <tr><td style="border-top:2px solid ${gold};padding-top:16px;text-align:center;">
    <span style="font-size:19px;font-weight:700;color:${nameCol};letter-spacing:-0.3px;">${data.fullName}</span>
    ${data.qualifications ? `<span style="font-size:11px;color:#6b7280;font-style:italic;margin-left:6px;">${data.qualifications}</span>` : ''}
    ${data.jobTitle ? `<br/><span style="font-size:13px;color:${titleCol};font-weight:600;letter-spacing:0.5px;text-transform:uppercase;margin-top:4px;display:inline-block;">${data.jobTitle}</span>` : ''}
  </td></tr>
  <tr><td style="text-align:center;padding-top:14px;">
    <table cellpadding="0" cellspacing="0" border="0" align="center">
      ${contactItems ? `<tr><td style="text-align:center;padding-bottom:6px;">${contactItems}</td></tr>` : ''}
      ${data.website ? `<tr><td style="text-align:center;padding-bottom:6px;"><a href="https://${data.website.replace(/^https?:\/\//, '')}" style="color:${c};text-decoration:none;font-size:12.5px;">${data.website}</a></td></tr>` : ''}
      ${data.address ? `<tr><td style="text-align:center;font-size:11px;color:#9ca3af;padding-bottom:6px;">${data.address}</td></tr>` : ''}
      ${buildSocialRow(data, c, 'pills')}
    </table>
  </td></tr>
  <tr><td style="border-bottom:1px solid ${gold}40;padding-top:12px;"></td></tr>
  ${disclaimerHtml(data.disclaimerText)}
</table>`;
}

// ── BOLD ────────────────────────────────────────────────────────────────────

function generateBoldHtml(data: SignatureData, logoSrc: string): string {
  const c = data.primaryColour;
  const nameCol = data.nameColour || '#ffffff';
  const titleCol = data.titleColour || '#ffffffcc';
  const headerLogoSize = Math.max(16, Math.round(data.logoSize * 0.6));

  const contactRow = (label: string, value: string, href: string) => {
    if (!value) return '';
    return `<tr><td style="padding-bottom:6px;font-size:13px;"><span style="color:#6b7280;font-size:11px;display:inline-block;width:54px;">${label}</span><a href="${href}" style="color:${c};text-decoration:none;">${value}</a></td></tr>`;
  };

  return `<table cellpadding="0" cellspacing="0" border="0" style="font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:13px;color:#374151;line-height:1.55;max-width:540px;border-radius:6px;overflow:hidden;">
  <!-- Purple header -->
  <tr><td style="background-color:${c};padding:22px 24px 18px 24px;">
    <table cellpadding="0" cellspacing="0" border="0" width="100%">
      <tr>
        <td style="vertical-align:top;">
          <span style="font-size:20px;font-weight:700;color:${nameCol};letter-spacing:-0.3px;display:block;">${data.fullName}</span>
          ${data.qualifications ? `<span style="font-size:11px;color:#ffffff99;display:block;margin-top:3px;">${data.qualifications}</span>` : ''}
          ${data.jobTitle ? `<span style="font-size:13px;color:${titleCol};font-weight:500;display:block;margin-top:4px;">${data.jobTitle}</span>` : ''}
        </td>
        <td style="text-align:right;vertical-align:top;padding-left:16px;">${logoBgHtml(logoSrc, headerLogoSize, data.logoTransparentBg, true)}</td>
      </tr>
    </table>
  </td></tr>
  <!-- Contact body -->
  <tr><td style="background-color:#f9fafb;padding:18px 24px 20px 24px;border:1px solid #e5e7eb;border-top:none;">
    <table cellpadding="0" cellspacing="0" border="0">
      ${contactRow('Phone', data.phone, `tel:${data.phone.replace(/\s/g, '')}`)}
      ${contactRow('Mobile', data.mobile, `tel:${data.mobile.replace(/\s/g, '')}`)}
      ${contactRow('Email', data.email, `mailto:${data.email}`)}
      ${contactRow('Web', data.website, `https://${data.website.replace(/^https?:\/\//, '')}`)}
      ${data.address ? `<tr><td style="padding-top:6px;font-size:11px;color:#9ca3af;">${data.address}</td></tr>` : ''}
      ${buildSocialRow(data, c, 'text')}
    </table>
  </td></tr>
  ${data.disclaimerText ? `<tr><td style="padding:12px 24px 14px 24px;"><p style="font-size:9.5px;color:#9ca3af;line-height:1.5;margin:0;font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">${data.disclaimerText}</p></td></tr>` : ''}
</table>`;
}

// ── NAVIGATE ────────────────────────────────────────────────────────────────

function generateNavigateHtml(data: SignatureData, logoSrc: string): string {
  const c = data.primaryColour;
  const charcoal = data.secondaryColour || '#313653';
  const nameCol = data.nameColour || '#ffffff';
  const titleCol = data.titleColour || c;
  const headerLogoSize = Math.max(16, Math.round(data.logoSize * 0.6));

  const socialLinks = getSocialLinks(data);
  const socialBar = socialLinks.length > 0
    ? `<tr><td style="padding-top:14px;padding-bottom:6px;">${socialLinks.map(l =>
        `<a href="${l.url}" target="_blank" style="display:inline-block;margin-right:12px;text-decoration:none;vertical-align:middle;" title="${l.label}">${socialIconHtml(l.platform, '#ffffffaa')}</a>`
      ).join('')}</td></tr>`
    : '';

  const fspRow = data.showFspTagline
    ? `<tr><td style="padding-top:8px;"><span style="font-size:10px;color:#ffffff55;letter-spacing:0.3px;font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">${FSP_TAGLINE}</span></td></tr>`
    : '';

  const contactRow = (label: string, value: string, href: string) => {
    if (!value) return '';
    return `<tr><td style="padding-bottom:6px;font-size:13px;"><span style="color:#9ca3af;font-size:10px;text-transform:uppercase;letter-spacing:0.5px;display:inline-block;width:54px;">${label}</span><a href="${href}" style="color:${c};text-decoration:none;">${value}</a></td></tr>`;
  };

  return `<table cellpadding="0" cellspacing="0" border="0" style="font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:13px;color:#374151;line-height:1.55;max-width:540px;border-radius:6px;overflow:hidden;">
  <!-- Dark charcoal header — mirrors website section-dark-gray -->
  <tr><td style="background-color:${charcoal};padding:24px 26px 20px 26px;">
    <table cellpadding="0" cellspacing="0" border="0" width="100%">
      <tr><td style="vertical-align:top;">
        ${logoBgHtml(logoSrc, headerLogoSize, data.logoTransparentBg, true)}
        <span style="font-size:20px;font-weight:700;color:${nameCol};letter-spacing:-0.3px;display:block;margin-top:14px;">${data.fullName}</span>
        ${data.qualifications ? `<span style="font-size:11px;color:#ffffff70;display:block;margin-top:3px;">${data.qualifications}</span>` : ''}
        ${data.jobTitle ? `<span style="font-size:13px;color:${titleCol};font-weight:600;display:block;margin-top:5px;">${data.jobTitle}</span>` : ''}
        ${socialBar}
        ${fspRow}
      </td></tr>
    </table>
  </td></tr>
  <!-- Purple accent divider -->
  <tr><td style="height:3px;background:linear-gradient(90deg,${c},${c}60,transparent);font-size:0;line-height:0;">&nbsp;</td></tr>
  <!-- Contact body -->
  <tr><td style="background-color:#ffffff;padding:18px 26px 22px 26px;">
    <table cellpadding="0" cellspacing="0" border="0">
      ${contactRow('Phone', data.phone, `tel:${data.phone.replace(/\s/g, '')}`)}
      ${contactRow('Mobile', data.mobile, `tel:${data.mobile.replace(/\s/g, '')}`)}
      ${contactRow('Email', data.email, `mailto:${data.email}`)}
      ${contactRow('Web', data.website, `https://${data.website.replace(/^https?:\/\//, '')}`)}
      ${data.address ? `<tr><td style="padding-top:6px;font-size:11px;color:#9ca3af;">${data.address}</td></tr>` : ''}
    </table>
  </td></tr>
  ${data.disclaimerText ? `<tr><td style="background-color:${charcoal};padding:12px 26px 14px 26px;"><p style="font-size:9px;color:#ffffff45;line-height:1.5;margin:0;font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">${data.disclaimerText}</p></td></tr>` : ''}
</table>`;
}

// ── DISPATCHER ──────────────────────────────────────────────────────────────

function generateSignatureHtml(template: string, data: SignatureData, logoSrc: string): string {
  switch (template) {
    case 'elegant': return generateElegantHtml(data, logoSrc);
    case 'bold': return generateBoldHtml(data, logoSrc);
    case 'navigate': return generateNavigateHtml(data, logoSrc);
    default: return generateModernHtml(data, logoSrc);
  }
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function EmailSignatureGenerator() {
  const [data, setData] = useState<SignatureData>({ ...DEFAULT_DATA });
  const [template, setTemplate] = useState('modern');
  const [copied, setCopied] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [showSource, setShowSource] = useState(false);

  // Saved formats
  const [savedFormats, setSavedFormats] = useState<SavedFormat[]>([]);
  const [saveFormatOpen, setSaveFormatOpen] = useState(false);
  const [formatName, setFormatName] = useState('');

  // Logo upload
  const logoFileRef = useRef<HTMLInputElement>(null);

  // Load saved formats from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(FORMAT_STORAGE_KEY);
      if (stored) setSavedFormats(JSON.parse(stored) as SavedFormat[]);
    } catch {
      // ignore corrupt storage
    }
  }, []);

  const updateField = useCallback(<K extends keyof SignatureData>(field: K, value: SignatureData[K]) => {
    setData(prev => ({ ...prev, [field]: value }));
  }, []);

  const resetForm = useCallback(() => {
    setData({ ...DEFAULT_DATA });
    setTemplate('modern');
    toast.success('Form reset to defaults');
  }, []);

  const logoSrc = data.logoUrl || navigateWealthLogo;

  // Resolve effective display colours for UI swatches — mirrors the HTML generators' fallback logic
  const effectiveNameColour = data.nameColour || (template === 'bold' || template === 'navigate' ? '#ffffff' : '#111827');
  const effectiveTitleColour = (() => {
    if (data.titleColour) return data.titleColour;
    if (template === 'elegant') return '#92711f';
    if (template === 'bold') return '#ffffffcc';
    return data.primaryColour;
  })();

  const signatureHtml = useMemo(
    () => generateSignatureHtml(template, data, logoSrc),
    [template, data, logoSrc],
  );

  const handleCopyHtml = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(signatureHtml);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast.success('HTML signature copied to clipboard');
    } catch {
      toast.error('Failed to copy — check browser permissions');
    }
  }, [signatureHtml]);

  // ── Saved Formats ──────────────────────────────────────────────────────────

  const handleSaveFormat = useCallback(() => {
    if (!formatName.trim()) return;
    const fields: Partial<SignatureData> = {};
    FORMAT_FIELD_KEYS.forEach((k) => {
      (fields as Record<string, unknown>)[k] = data[k];
    });
    const newFormat: SavedFormat = {
      id: crypto.randomUUID(),
      name: formatName.trim(),
      createdAt: new Date().toISOString(),
      template,
      fields,
    };
    const updated = [...savedFormats, newFormat];
    setSavedFormats(updated);
    try { localStorage.setItem(FORMAT_STORAGE_KEY, JSON.stringify(updated)); } catch { /* quota */ }
    setFormatName('');
    setSaveFormatOpen(false);
    toast.success(`Format "${newFormat.name}" saved`);
  }, [formatName, savedFormats, data, template]);

  const handleLoadFormat = useCallback((format: SavedFormat) => {
    setTemplate(format.template);
    setData((prev) => ({ ...prev, ...format.fields }));
    toast.success(`Format "${format.name}" loaded`);
  }, []);

  const handleDeleteFormat = useCallback((id: string) => {
    const updated = savedFormats.filter((f) => f.id !== id);
    setSavedFormats(updated);
    try { localStorage.setItem(FORMAT_STORAGE_KEY, JSON.stringify(updated)); } catch { /* quota */ }
    toast.success('Format deleted');
  }, [savedFormats]);

  // ── Logo Upload ─────────────────────────────────────────────────────────────

  const handleLogoUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file (PNG, JPG, SVG, WebP…)');
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      const result = ev.target?.result;
      if (typeof result === 'string') {
        updateField('logoUrl', result);
        toast.success('Logo uploaded successfully');
      }
    };
    reader.readAsDataURL(file);
    // Reset so the same file can be re-selected
    e.target.value = '';
  }, [updateField]);

  const handleClearLogo = useCallback(() => {
    updateField('logoUrl', '');
    toast.success('Logo reset to Navigate Wealth default');
  }, [updateField]);

  const handleDownloadHtml = useCallback(() => {
    const blob = new Blob([signatureHtml], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `email-signature-${data.fullName.replace(/\s+/g, '-').toLowerCase() || 'navigate-wealth'}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success('HTML file downloaded');
  }, [signatureHtml, data.fullName]);

  const isReady = data.fullName.trim().length > 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold">Email Signature Generator</h3>
          <p className="text-sm text-muted-foreground">
            Create professional HTML email signatures with Navigate Wealth branding.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={resetForm}>
            <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
            Reset
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="border-purple-200 text-purple-700 hover:bg-purple-50"
            onClick={() => { setFormatName(''); setSaveFormatOpen(true); }}
          >
            <Bookmark className="h-3.5 w-3.5 mr-1.5" />
            Save Format
          </Button>
          <Button
            size="sm"
            className="bg-purple-600 hover:bg-purple-700"
            onClick={() => setPreviewOpen(true)}
            disabled={!isReady}
          >
            <Eye className="h-3.5 w-3.5 mr-1.5" />
            Full Preview
          </Button>
        </div>
      </div>

      {/* Template Selection */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {TEMPLATES.map((t) => {
          const active = template === t.id;
          return (
            <motion.button
              key={t.id}
              whileHover={{ y: -2 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setTemplate(t.id)}
              className={`relative p-4 rounded-xl border-2 text-left transition-all ${
                active
                  ? 'border-purple-500 bg-purple-50/60 shadow-sm shadow-purple-500/10'
                  : 'border-border bg-white hover:border-purple-200 hover:bg-purple-50/30'
              }`}
            >
              {active && (
                <motion.div
                  layoutId="template-indicator"
                  className="absolute top-2.5 right-2.5 h-2 w-2 rounded-full bg-purple-600"
                  transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                />
              )}
              {/* Mini preview swatch */}
              <div className={`h-2 w-10 rounded-full mb-3 ${
                t.id === 'modern' ? 'bg-gradient-to-r from-purple-600 to-purple-400'
                : t.id === 'elegant' ? 'bg-gradient-to-r from-amber-600 to-amber-400'
                : t.id === 'navigate' ? 'bg-[#313653]'
                : 'bg-purple-600'
              }`} />
              <p className={`text-sm font-semibold ${active ? 'text-purple-700' : 'text-foreground'}`}>
                {t.name}
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">{t.description}</p>
            </motion.button>
          );
        })}
      </div>

      {/* ── Saved Formats ─────────────────────────────────────────────────── */}
      <div className="rounded-xl border bg-white">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-md bg-purple-50">
              <FolderOpen className="h-3.5 w-3.5 text-purple-600" />
            </div>
            <span className="text-sm font-semibold">Saved Formats</span>
            {savedFormats.length > 0 && (
              <span className="text-[10px] bg-purple-100 text-purple-700 font-medium px-1.5 py-0.5 rounded-full">
                {savedFormats.length}
              </span>
            )}
          </div>
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs border-purple-200 text-purple-700 hover:bg-purple-50"
            onClick={() => { setFormatName(''); setSaveFormatOpen(true); }}
          >
            <Bookmark className="h-3 w-3 mr-1.5" />
            Save current
          </Button>
        </div>

        {savedFormats.length === 0 ? (
          <div className="px-4 py-5 text-center">
            <p className="text-xs text-muted-foreground">
              No saved formats yet. Configure branding settings and click{' '}
              <button
                className="text-purple-600 underline underline-offset-2"
                onClick={() => { setFormatName(''); setSaveFormatOpen(true); }}
              >
                Save Format
              </button>{' '}
              to reuse them for other personnel.
            </p>
          </div>
        ) : (
          <div className="p-3 flex flex-wrap gap-2">
            {savedFormats.map((fmt) => (
              <div
                key={fmt.id}
                className="group flex items-center gap-2 pl-3 pr-1.5 py-1.5 rounded-lg border border-border bg-gray-50 hover:border-purple-300 hover:bg-purple-50/50 transition-colors"
              >
                {/* Colour swatch */}
                <div
                  className="h-3 w-3 rounded-full shrink-0 ring-1 ring-white ring-offset-1 ring-offset-gray-50"
                  style={{ backgroundColor: (fmt.fields.primaryColour as string) || '#6d28d9' }}
                />
                <div className="min-w-0">
                  <p className="text-xs font-medium text-foreground truncate max-w-[120px]">{fmt.name}</p>
                  <p className="text-[10px] text-muted-foreground capitalize">{fmt.template}</p>
                </div>
                <div className="flex items-center gap-0.5 ml-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 px-2 text-[10px] text-purple-600 hover:text-purple-700 hover:bg-purple-100"
                    onClick={() => handleLoadFormat(fmt)}
                    title="Load this format"
                  >
                    Load
                  </Button>
                  <button
                    className="h-6 w-6 flex items-center justify-center rounded text-muted-foreground hover:text-red-500 hover:bg-red-50 transition-colors opacity-0 group-hover:opacity-100"
                    onClick={() => handleDeleteFormat(fmt.id)}
                    title="Delete format"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* LEFT: Form (2 cols) */}
        <div className="lg:col-span-2 space-y-4">
          {/* Personal Details */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-md bg-purple-50">
                  <User className="h-3.5 w-3.5 text-purple-600" />
                </div>
                <CardTitle className="text-sm">Personal Details</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Full Name <span className="text-red-500">*</span></Label>
                <Input
                  value={data.fullName}
                  onChange={(e) => updateField('fullName', e.target.value)}
                  placeholder="e.g. John Smith"
                  className="h-9"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Job Title</Label>
                <Input
                  value={data.jobTitle}
                  onChange={(e) => updateField('jobTitle', e.target.value)}
                  placeholder="e.g. Financial Adviser"
                  className="h-9"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Qualifications</Label>
                <Input
                  value={data.qualifications}
                  onChange={(e) => updateField('qualifications', e.target.value)}
                  placeholder="e.g. CFP\u00AE, B.Com (Hons)"
                  className="h-9"
                />
              </div>
            </CardContent>
          </Card>

          {/* Contact Details */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-md bg-blue-50">
                  <Phone className="h-3.5 w-3.5 text-blue-600" />
                </div>
                <CardTitle className="text-sm">Contact Details</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Email</Label>
                  <Input
                    value={data.email}
                    onChange={(e) => updateField('email', e.target.value)}
                    placeholder="john@navigatewealth.co.za"
                    className="h-9"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Website</Label>
                  <Input
                    value={data.website}
                    onChange={(e) => updateField('website', e.target.value)}
                    placeholder="www.navigatewealth.co.za"
                    className="h-9"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Office Phone</Label>
                  <Input
                    value={data.phone}
                    onChange={(e) => updateField('phone', e.target.value)}
                    placeholder="+27 11 000 0000"
                    className="h-9"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Mobile</Label>
                  <Input
                    value={data.mobile}
                    onChange={(e) => updateField('mobile', e.target.value)}
                    placeholder="+27 82 000 0000"
                    className="h-9"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Address</Label>
                <Input
                  value={data.address}
                  onChange={(e) => updateField('address', e.target.value)}
                  placeholder="e.g. 123 Main Street, Sandton, 2196"
                  className="h-9"
                />
              </div>
            </CardContent>
          </Card>

          {/* Social Profiles */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-md bg-pink-50">
                  <Instagram className="h-3.5 w-3.5 text-pink-600" />
                </div>
                <CardTitle className="text-sm">Social Profiles</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs flex items-center gap-1.5">
                    <Linkedin className="h-3 w-3 text-[#0A66C2]" /> LinkedIn
                  </Label>
                  <Input
                    value={data.linkedinUrl}
                    onChange={(e) => updateField('linkedinUrl', e.target.value)}
                    placeholder="https://linkedin.com/in/..."
                    className="h-9 text-xs"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs flex items-center gap-1.5">
                    <Instagram className="h-3 w-3 text-[#E4405F]" /> Instagram
                  </Label>
                  <Input
                    value={data.instagramUrl}
                    onChange={(e) => updateField('instagramUrl', e.target.value)}
                    placeholder="https://instagram.com/..."
                    className="h-9 text-xs"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs flex items-center gap-1.5">
                    <Youtube className="h-3 w-3 text-[#FF0000]" /> YouTube
                  </Label>
                  <Input
                    value={data.youtubeUrl}
                    onChange={(e) => updateField('youtubeUrl', e.target.value)}
                    placeholder="https://youtube.com/@..."
                    className="h-9 text-xs"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs flex items-center gap-1.5">
                    <svg viewBox="0 0 24 24" className="h-3 w-3" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
                    X (Twitter)
                  </Label>
                  <Input
                    value={data.xUrl}
                    onChange={(e) => updateField('xUrl', e.target.value)}
                    placeholder="https://x.com/..."
                    className="h-9 text-xs"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Branding & Disclaimer */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-md bg-amber-50">
                  <Award className="h-3.5 w-3.5 text-amber-600" />
                </div>
                <CardTitle className="text-sm">Branding & Disclaimer</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {/* Row 1: Primary Colour */}
              <div className="space-y-1.5">
                <Label className="text-xs flex items-center gap-1.5">
                  <Palette className="h-3 w-3 text-purple-500" /> Primary Colour
                </Label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={data.primaryColour}
                    onChange={(e) => updateField('primaryColour', e.target.value)}
                    className="h-9 w-10 rounded border cursor-pointer"
                  />
                  <Input
                    value={data.primaryColour}
                    onChange={(e) => updateField('primaryColour', e.target.value)}
                    className="h-9 font-mono text-xs"
                  />
                </div>
              </div>

              {/* Logo Upload */}
              <div className="space-y-1.5">
                <Label className="text-xs flex items-center gap-1.5">
                  <ImageIcon className="h-3 w-3 text-gray-500" /> Logo
                </Label>
                {/* Hidden file input */}
                <input
                  ref={logoFileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleLogoUpload}
                />
                <div className="rounded-lg border border-dashed bg-gray-50 p-3 space-y-3">
                  {/* Preview + controls */}
                  <div className="flex items-center gap-3">
                    {/* Logo preview thumbnail */}
                    <div className="h-12 w-20 rounded-md border bg-white flex items-center justify-center overflow-hidden shrink-0 shadow-sm">
                      <img
                        src={logoSrc}
                        alt="Logo preview"
                        className="max-h-full max-w-full object-contain p-1"
                      />
                    </div>
                    <div className="flex-1 min-w-0 space-y-1.5">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 text-xs w-full"
                        onClick={() => logoFileRef.current?.click()}
                        type="button"
                      >
                        <Upload className="h-3.5 w-3.5 mr-1.5" />
                        Upload image
                      </Button>
                      {data.logoUrl && (
                        <button
                          onClick={handleClearLogo}
                          className="text-[10px] text-muted-foreground hover:text-red-500 transition-colors w-full text-center"
                          type="button"
                        >
                          ✕ Remove — revert to Navigate Wealth default
                        </button>
                      )}
                      {!data.logoUrl && (
                        <p className="text-[10px] text-muted-foreground text-center leading-snug">
                          Using Navigate Wealth default logo
                        </p>
                      )}
                      {data.logoUrl?.startsWith('data:') && (
                        <p className="text-[10px] text-green-600 text-center font-medium">
                          ✓ Custom logo uploaded
                        </p>
                      )}
                    </div>
                  </div>
                  {/* URL fallback */}
                  <div className="space-y-1 pt-1 border-t border-gray-200">
                    <p className="text-[10px] text-muted-foreground">Or paste a remote image URL:</p>
                    <Input
                      value={data.logoUrl.startsWith('data:') ? '' : data.logoUrl}
                      onChange={(e) => updateField('logoUrl', e.target.value)}
                      placeholder="https://example.com/logo.png"
                      className="h-7 text-xs"
                    />
                  </div>
                </div>
              </div>

              {/* Logo Options */}
              <div className="rounded-lg border border-dashed bg-gray-50 p-3 space-y-3">
                <div className="flex items-center gap-2 mb-1">
                  <ImageIcon className="h-3.5 w-3.5 text-gray-500 shrink-0" />
                  <p className="text-xs font-medium text-gray-700">Logo Options</p>
                </div>
                {/* Logo Size slider */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs text-muted-foreground">Logo Size</Label>
                    <span className="text-xs font-mono font-medium text-gray-700 bg-white border rounded px-1.5 py-0.5 min-w-[42px] text-center">
                      {data.logoSize}px
                    </span>
                  </div>
                  <input
                    type="range"
                    min={16}
                    max={72}
                    step={2}
                    value={data.logoSize}
                    onChange={(e) => updateField('logoSize', Number(e.target.value))}
                    className="w-full h-1.5 bg-gray-200 rounded-full appearance-none cursor-pointer accent-purple-600"
                  />
                  <div className="flex justify-between text-[10px] text-muted-foreground">
                    <span>16px (small)</span>
                    <span>72px (large)</span>
                  </div>
                </div>
                {/* Transparent background toggle */}
                <div className="flex items-center justify-between pt-1 border-t border-gray-200">
                  <div className="pr-3">
                    <p className="text-xs font-medium text-gray-700">Transparent Background</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5 leading-snug">
                      {data.logoTransparentBg
                        ? 'Logo sits directly on the email background — ideal for PNG logos with transparency'
                        : 'White pill added behind the logo on dark-coloured template headers'}
                    </p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer shrink-0">
                    <input
                      type="checkbox"
                      checked={data.logoTransparentBg}
                      onChange={(e) => updateField('logoTransparentBg', e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-purple-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-purple-600"></div>
                  </label>
                </div>
              </div>

              {/* Text Colour Overrides */}
              <div className="rounded-lg border border-dashed bg-gray-50 p-3 space-y-3">
                <div className="flex items-center gap-2">
                  <Type className="h-3.5 w-3.5 text-gray-500 shrink-0" />
                  <p className="text-xs font-medium text-gray-700">Text Colours</p>
                  <span className="text-[10px] text-muted-foreground ml-auto italic">
                    Leave blank to use template defaults
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {/* Name Colour */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs text-muted-foreground">Name Colour</Label>
                      {data.nameColour && (
                        <button
                          onClick={() => updateField('nameColour', '')}
                          className="text-[10px] text-purple-600 hover:underline leading-none"
                          title="Reset to template default"
                        >
                          Reset
                        </button>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="color"
                        value={effectiveNameColour}
                        onChange={(e) => updateField('nameColour', e.target.value)}
                        className="h-8 w-8 rounded border cursor-pointer shrink-0"
                        title="Pick name colour"
                      />
                      <Input
                        value={data.nameColour}
                        onChange={(e) => updateField('nameColour', e.target.value)}
                        placeholder={effectiveNameColour}
                        className="h-8 font-mono text-xs"
                      />
                    </div>
                    {!data.nameColour && (
                      <p className="text-[10px] text-muted-foreground leading-snug">
                        Auto: <span className="font-mono">{effectiveNameColour}</span>
                      </p>
                    )}
                  </div>
                  {/* Title Colour */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs text-muted-foreground">Title Colour</Label>
                      {data.titleColour && (
                        <button
                          onClick={() => updateField('titleColour', '')}
                          className="text-[10px] text-purple-600 hover:underline leading-none"
                          title="Reset to template default"
                        >
                          Reset
                        </button>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="color"
                        value={effectiveTitleColour.length > 7 ? effectiveTitleColour.slice(0, 7) : effectiveTitleColour}
                        onChange={(e) => updateField('titleColour', e.target.value)}
                        className="h-8 w-8 rounded border cursor-pointer shrink-0"
                        title="Pick title colour"
                      />
                      <Input
                        value={data.titleColour}
                        onChange={(e) => updateField('titleColour', e.target.value)}
                        placeholder={effectiveTitleColour}
                        className="h-8 font-mono text-xs"
                      />
                    </div>
                    {!data.titleColour && (
                      <p className="text-[10px] text-muted-foreground leading-snug">
                        Auto: <span className="font-mono">{effectiveTitleColour}</span>
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Navigate-specific options */}
              {template === 'navigate' && (
                <div className="space-y-3 pt-1">
                  <div className="flex items-center gap-3 px-3 py-2.5 bg-gray-50 rounded-lg border border-dashed">
                    <Shield className="h-4 w-4 text-purple-500 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium">FSP Tagline</p>
                      <p className="text-[10px] text-muted-foreground leading-snug mt-0.5">
                        Show &ldquo;{FSP_TAGLINE}&rdquo; in the charcoal header
                      </p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer shrink-0">
                      <input
                        type="checkbox"
                        checked={data.showFspTagline}
                        onChange={(e) => updateField('showFspTagline', e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-purple-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-purple-600"></div>
                    </label>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs flex items-center gap-1.5">
                      <Palette className="h-3 w-3 text-gray-500" /> Secondary Colour (Charcoal)
                    </Label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={data.secondaryColour}
                        onChange={(e) => updateField('secondaryColour', e.target.value)}
                        className="h-9 w-10 rounded border cursor-pointer"
                      />
                      <Input
                        value={data.secondaryColour}
                        onChange={(e) => updateField('secondaryColour', e.target.value)}
                        className="h-9 font-mono text-xs"
                      />
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-9 text-xs px-2 text-muted-foreground"
                        onClick={() => updateField('secondaryColour', '#313653')}
                        title="Reset to default"
                      >
                        <RotateCcw className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              <div className="space-y-1.5">
                <Label className="text-xs">Disclaimer</Label>
                <Textarea
                  value={data.disclaimerText}
                  onChange={(e) => updateField('disclaimerText', e.target.value)}
                  placeholder="Legal disclaimer text..."
                  rows={3}
                  className="text-xs"
                />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* RIGHT: Live Preview (3 cols) */}
        <div className="lg:col-span-3 space-y-4">
          <div className="sticky top-4 space-y-4">
            {/* Preview Card */}
            <Card className="overflow-hidden border-border">
              <CardHeader className="pb-3 bg-muted/40 border-b">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-purple-500" />
                    <CardTitle className="text-sm">Live Preview</CardTitle>
                  </div>
                  <Badge variant="secondary" className="text-[10px] font-medium">
                    {TEMPLATES.find(t => t.id === template)?.name} Template
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={template}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.25, ease: 'easeInOut' }}
                  >
                    {isReady ? (
                      <div className="contents">
                        {/* Simulated email chrome */}
                        <div className="bg-muted/30 border-b px-5 py-3 space-y-2">
                          <div className="flex items-center gap-1.5">
                            <div className="w-2.5 h-2.5 rounded-full bg-red-400/80" />
                            <div className="w-2.5 h-2.5 rounded-full bg-amber-400/80" />
                            <div className="w-2.5 h-2.5 rounded-full bg-green-400/80" />
                            <span className="ml-3 text-[10px] text-muted-foreground font-mono">New Message</span>
                          </div>
                          <div className="space-y-1 text-[11px]">
                            <div className="flex gap-2"><span className="text-muted-foreground w-10 shrink-0">From:</span><span className="font-medium text-foreground truncate">{data.fullName} &lt;{data.email || 'email@navigatewealth.co.za'}&gt;</span></div>
                            <div className="flex gap-2"><span className="text-muted-foreground w-10 shrink-0">To:</span><span className="text-muted-foreground">client@example.com</span></div>
                            <div className="flex gap-2"><span className="text-muted-foreground w-10 shrink-0">Subj:</span><span className="text-foreground">Your Financial Plan Review</span></div>
                          </div>
                        </div>

                        {/* Email body */}
                        <div className="px-5 py-5 bg-white">
                          <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 0.1 }}
                            className="text-xs text-gray-400 space-y-2 mb-6"
                          >
                            <p>Dear Client,</p>
                            <p>Thank you for our meeting earlier today. Please find your updated financial plan attached for review.</p>
                            <p>Kind regards,</p>
                          </motion.div>

                          <div className="border-t border-dashed border-gray-200 my-5" />

                          {/* Signature */}
                          <motion.div
                            initial={{ opacity: 0, x: -8 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: 0.2, duration: 0.35, ease: 'easeOut' }}
                            dangerouslySetInnerHTML={{ __html: signatureHtml }}
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-16 px-6">
                        <motion.div
                          animate={{ scale: [1, 1.06, 1] }}
                          transition={{ repeat: Infinity, duration: 3, ease: 'easeInOut' }}
                        >
                          <div className="p-3 rounded-xl bg-purple-50 inline-flex">
                            <Mail className="h-8 w-8 text-purple-300" />
                          </div>
                        </motion.div>
                        <p className="text-sm font-medium text-muted-foreground mt-4">Enter your name to see the preview</p>
                        <p className="text-xs text-muted-foreground/60 mt-1">Fill in the details on the left to generate your signature</p>
                      </div>
                    )}
                  </motion.div>
                </AnimatePresence>
              </CardContent>
            </Card>

            {/* Action Buttons */}
            <div className="grid grid-cols-2 gap-3">
              <Button
                className="bg-purple-600 hover:bg-purple-700 h-10"
                onClick={handleCopyHtml}
                disabled={!isReady}
              >
                <AnimatePresence mode="wait">
                  {copied ? (
                    <motion.div key="copied" initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.8, opacity: 0 }} className="flex items-center gap-1.5">
                      <Check className="h-4 w-4" /> Copied!
                    </motion.div>
                  ) : (
                    <motion.div key="copy" initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.8, opacity: 0 }} className="flex items-center gap-1.5">
                      <Copy className="h-4 w-4" /> Copy HTML
                    </motion.div>
                  )}
                </AnimatePresence>
              </Button>
              <Button
                variant="outline"
                className="h-10"
                onClick={handleDownloadHtml}
                disabled={!isReady}
              >
                <Download className="h-4 w-4 mr-1.5" />
                Download .html
              </Button>
            </div>

            {/* HTML Source */}
            <Card>
              <button
                className="flex items-center justify-between w-full px-4 py-3"
                onClick={() => setShowSource(!showSource)}
              >
                <div className="flex items-center gap-2">
                  <Code className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-xs font-medium text-muted-foreground">View HTML Source</span>
                </div>
                <motion.svg
                  animate={{ rotate: showSource ? 180 : 0 }}
                  transition={{ duration: 0.2 }}
                  width="14" height="14" viewBox="0 0 14 14" fill="none" className="text-muted-foreground"
                >
                  <path d="M3.5 5.25L7 8.75L10.5 5.25" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </motion.svg>
              </button>
              <AnimatePresence>
                {showSource && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="px-4 pb-4">
                      <div className="relative">
                        <pre className="bg-gray-950 text-emerald-400 text-[10px] p-4 rounded-lg overflow-auto max-h-52 font-mono leading-relaxed">
                          {signatureHtml}
                        </pre>
                        <Button
                          size="sm"
                          variant="secondary"
                          className="absolute top-2 right-2 h-7 text-[10px]"
                          onClick={handleCopyHtml}
                        >
                          {copied ? <Check className="h-3 w-3 mr-1" /> : <Copy className="h-3 w-3 mr-1" />}
                          {copied ? 'Copied' : 'Copy'}
                        </Button>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </Card>
          </div>
        </div>
      </div>

      {/* ═══════ Full Preview Dialog ═══════ */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5 text-purple-500" />
              Full Email Preview
              <Badge variant="secondary" className="text-[10px] ml-2">
                {TEMPLATES.find(t => t.id === template)?.name}
              </Badge>
            </DialogTitle>
          </DialogHeader>
          <div className="py-2">
            <div className="rounded-xl border bg-white overflow-hidden shadow-sm">
              {/* Email chrome */}
              <div className="bg-muted/30 border-b px-5 py-3.5 space-y-2">
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-red-400" />
                  <div className="w-3 h-3 rounded-full bg-amber-400" />
                  <div className="w-3 h-3 rounded-full bg-green-400" />
                  <span className="ml-4 text-xs text-muted-foreground font-mono">New Message</span>
                </div>
                <div className="space-y-1.5 text-xs">
                  <div className="flex gap-2"><span className="text-muted-foreground w-12">From:</span><span className="font-medium">{data.fullName} &lt;{data.email || 'email@navigatewealth.co.za'}&gt;</span></div>
                  <div className="flex gap-2"><span className="text-muted-foreground w-12">To:</span><span className="text-muted-foreground">client@example.com</span></div>
                  <div className="flex gap-2"><span className="text-muted-foreground w-12">Subject:</span><span>Your Financial Plan Review</span></div>
                </div>
              </div>
              {/* Email body */}
              <div className="px-6 py-6">
                <div className="text-sm text-gray-500 space-y-3 mb-8 leading-relaxed">
                  <p>Dear Client,</p>
                  <p>Thank you for our meeting earlier today. I have reviewed your current financial portfolio and prepared an updated plan based on our discussion.</p>
                  <p>Please find the updated documents attached for your review. Should you have any questions, please do not hesitate to contact me.</p>
                  <p>Kind regards,</p>
                </div>
                <div className="border-t border-dashed border-gray-200 my-6" />
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.15, duration: 0.35, ease: 'easeOut' }}
                  dangerouslySetInnerHTML={{ __html: signatureHtml }}
                />
              </div>
            </div>
          </div>
          <div className="flex items-center justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setPreviewOpen(false)}>Close</Button>
            <Button variant="outline" onClick={handleDownloadHtml}>
              <Download className="h-4 w-4 mr-1.5" />
              Download
            </Button>
            <Button className="bg-purple-600 hover:bg-purple-700" onClick={handleCopyHtml}>
              {copied ? <Check className="h-4 w-4 mr-1.5" /> : <Copy className="h-4 w-4 mr-1.5" />}
              {copied ? 'Copied!' : 'Copy HTML'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ═══════ Save Format Dialog ═══════ */}
      <Dialog open={saveFormatOpen} onOpenChange={setSaveFormatOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Bookmark className="h-4 w-4 text-purple-500" />
              Save Signature Format
            </DialogTitle>
            <DialogDescription>
              Save the current branding settings — template, colours, logo, disclaimer, and social
              links — as a reusable format. Personal details (name, email, phone) are not saved.
            </DialogDescription>
          </DialogHeader>

          <div className="py-2 space-y-4">
            {/* Preview of what's being saved */}
            <div className="rounded-lg border bg-gray-50 p-3 space-y-2">
              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
                Format preview
              </p>
              <div className="flex items-center gap-2.5">
                <div
                  className="h-5 w-5 rounded-full ring-2 ring-white shadow-sm shrink-0"
                  style={{ backgroundColor: data.primaryColour }}
                />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium capitalize">
                    {TEMPLATES.find((t) => t.id === template)?.name} template
                  </p>
                  <p className="text-[10px] text-muted-foreground font-mono">{data.primaryColour}</p>
                </div>
                <div className="h-8 w-12 rounded border bg-white flex items-center justify-center overflow-hidden shrink-0">
                  <img src={logoSrc} alt="logo" className="max-h-full max-w-full object-contain p-0.5" />
                </div>
              </div>
            </div>

            {/* Format name input */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Format name <span className="text-red-500">*</span></Label>
              <Input
                value={formatName}
                onChange={(e) => setFormatName(e.target.value)}
                placeholder='e.g. "Navigate Dark", "Adviser Standard"'
                className="h-9"
                autoFocus
                onKeyDown={(e) => { if (e.key === 'Enter') handleSaveFormat(); }}
              />
              <p className="text-[10px] text-muted-foreground">
                This name will appear in the Saved Formats panel for quick loading.
              </p>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setSaveFormatOpen(false)}>
              Cancel
            </Button>
            <Button
              className="bg-purple-600 hover:bg-purple-700"
              onClick={handleSaveFormat}
              disabled={!formatName.trim()}
            >
              <Bookmark className="h-3.5 w-3.5 mr-1.5" />
              Save Format
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}