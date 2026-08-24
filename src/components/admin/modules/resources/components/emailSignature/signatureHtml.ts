/**
 * Rendering a `SignatureData` to email-safe HTML.
 *
 * Split out of `EmailSignatureGenerator.tsx`. These are the four templates the
 * tool actually produces, written as table markup with inline styles because
 * that is what mail clients render — no React, no CSS classes, no external
 * assets beyond the inlined social SVGs.
 */
import { type SignatureData, FSP_TAGLINE } from './signatureModel';

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
  ].filter((l) => l.url.trim());
}

function buildSocialRow(
  data: SignatureData,
  colour: string,
  style: 'icons' | 'pills' | 'text',
): string {
  const links = getSocialLinks(data);
  if (links.length === 0) return '';

  if (style === 'pills') {
    const items = links
      .map(
        (l) =>
          `<a href="${l.url}" target="_blank" style="display:inline-block;padding:5px 12px;border-radius:14px;background-color:${colour}14;color:${colour};font-size:11px;font-weight:500;text-decoration:none;margin-right:6px;margin-bottom:4px;font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">${l.label}</a>`,
      )
      .join('');
    return `<tr><td style="padding-top:12px;padding-bottom:8px;">${items}</td></tr>`;
  }

  if (style === 'icons') {
    const items = links
      .map(
        (l) =>
          `<a href="${l.url}" target="_blank" style="display:inline-block;margin-right:10px;text-decoration:none;vertical-align:middle;" title="${l.label}">${socialIconHtml(l.platform, colour)}</a>`,
      )
      .join('');
    return `<tr><td style="padding-top:12px;padding-bottom:8px;">${items}</td></tr>`;
  }

  // text style
  const items = links
    .map(
      (l) =>
        `<a href="${l.url}" target="_blank" style="color:${colour};font-size:11px;text-decoration:none;margin-right:14px;font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">${l.label}</a>`,
    )
    .join(' ');
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
    data.phone
      ? `<a href="tel:${data.phone.replace(/\s/g, '')}" style="color:${c};text-decoration:none;font-size:12.5px;">${data.phone}</a>`
      : '',
    data.mobile
      ? `<a href="tel:${data.mobile.replace(/\s/g, '')}" style="color:${c};text-decoration:none;font-size:12.5px;">${data.mobile}</a>`
      : '',
    data.email
      ? `<a href="mailto:${data.email}" style="color:${c};text-decoration:none;font-size:12.5px;">${data.email}</a>`
      : '',
  ]
    .filter(Boolean)
    .join('<span style="color:#d1d5db;margin:0 10px;">|</span>');

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
  const socialBar =
    socialLinks.length > 0
      ? `<tr><td style="padding-top:14px;padding-bottom:6px;">${socialLinks
          .map(
            (l) =>
              `<a href="${l.url}" target="_blank" style="display:inline-block;margin-right:12px;text-decoration:none;vertical-align:middle;" title="${l.label}">${socialIconHtml(l.platform, '#ffffffaa')}</a>`,
          )
          .join('')}</td></tr>`
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

export function generateSignatureHtml(
  template: string,
  data: SignatureData,
  logoSrc: string,
): string {
  switch (template) {
    case 'elegant':
      return generateElegantHtml(data, logoSrc);
    case 'bold':
      return generateBoldHtml(data, logoSrc);
    case 'navigate':
      return generateNavigateHtml(data, logoSrc);
    default:
      return generateModernHtml(data, logoSrc);
  }
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================
