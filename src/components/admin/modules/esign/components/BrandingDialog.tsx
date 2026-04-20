/**
 * P8.6 — Firm branding dialog.
 *
 * Lets a firm administrator set the logo, accent colour, display name,
 * and support email that the signer page renders for envelopes sent
 * from this firm. Empty values revert to the platform defaults.
 *
 * Validation is mirrored client + server: hex must be #RRGGBB, the
 * logo URL must start with https://, support email must look like an
 * email. A live preview shows what the signer page header strip will
 * look like with the chosen accent / logo combo.
 */

import { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../../../../ui/dialog';
import { Label } from '../../../../ui/label';
import { Input } from '../../../../ui/input';
import { Button } from '../../../../ui/button';
import { Loader2, ShieldCheck } from 'lucide-react';
import { esignApi } from '../api';
import { toast } from 'sonner';
import { logger } from '../../../../../utils/logger';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const HEX_RE = /^#([0-9a-fA-F]{6})$/;
const HTTPS_URL_RE = /^https:\/\/[^\s]+$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DEFAULT_ACCENT = '#4f46e5';

function deriveStripGradient(hex: string): string {
  // The signer page paints a 1.5px coloured strip at the top of every
  // card. We want the strip to feel like a brand mark even at low
  // opacity, so we render it as a horizontal gradient between the
  // accent and a slightly darkened variant.
  const safe = HEX_RE.test(hex) ? hex : DEFAULT_ACCENT;
  return `linear-gradient(90deg, ${safe} 0%, ${safe}cc 50%, ${safe} 100%)`;
}

export function BrandingDialog({ open, onOpenChange }: Props) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [accentHex, setAccentHex] = useState('');
  const [supportEmail, setSupportEmail] = useState('');
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const { branding } = await esignApi.getFirmBranding();
        if (cancelled) return;
        setDisplayName(branding?.display_name ?? '');
        setLogoUrl(branding?.logo_url ?? '');
        setAccentHex(branding?.accent_hex ?? '');
        setSupportEmail(branding?.support_email ?? '');
        setUpdatedAt(branding?.updated_at ?? null);
      } catch (err) {
        logger.error('Failed to load branding', err);
        toast.error('Failed to load branding settings');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [open]);

  const errors = useMemo(() => {
    const e: { logo?: string; accent?: string; support?: string } = {};
    if (logoUrl.trim() && !HTTPS_URL_RE.test(logoUrl.trim())) {
      e.logo = 'Logo URL must start with https://';
    }
    if (accentHex.trim() && !HEX_RE.test(accentHex.trim())) {
      e.accent = 'Use a 6-digit hex like #4f46e5';
    }
    if (supportEmail.trim() && !EMAIL_RE.test(supportEmail.trim())) {
      e.support = 'Enter a valid email address';
    }
    return e;
  }, [logoUrl, accentHex, supportEmail]);

  const hasErrors = Object.keys(errors).length > 0;
  const previewAccent = HEX_RE.test(accentHex.trim()) ? accentHex.trim() : DEFAULT_ACCENT;
  const previewName = displayName.trim() || 'Your firm name';

  const handleSave = async () => {
    if (hasErrors) return;
    setSaving(true);
    try {
      const { branding } = await esignApi.setFirmBranding({
        display_name: displayName.trim() || null,
        logo_url: logoUrl.trim() || null,
        accent_hex: accentHex.trim() || null,
        support_email: supportEmail.trim() || null,
      });
      const ts = (branding as { updated_at?: string })?.updated_at ?? new Date().toISOString();
      setUpdatedAt(ts);
      toast.success('Signer branding saved');
      onOpenChange(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save branding';
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    setSaving(true);
    try {
      await esignApi.deleteFirmBranding();
      setDisplayName('');
      setLogoUrl('');
      setAccentHex('');
      setSupportEmail('');
      setUpdatedAt(null);
      toast.success('Branding reverted to platform defaults');
      onOpenChange(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to reset branding';
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Signer-page branding</DialogTitle>
          <DialogDescription>
            Customise the logo, accent colour, and support email shown to signers receiving envelopes from your firm.
            Leave a field blank to use the platform default.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-5">
            {/* Live preview */}
            <div className="rounded-lg border border-border overflow-hidden">
              <div className="h-1.5" style={{ background: deriveStripGradient(previewAccent) }} />
              <div className="p-4 flex items-center gap-3 bg-white">
                {logoUrl.trim() && HTTPS_URL_RE.test(logoUrl.trim()) ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={logoUrl.trim()}
                    alt={`${previewName} logo`}
                    className="h-10 w-10 object-contain rounded"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                  />
                ) : (
                  <div
                    className="h-10 w-10 rounded flex items-center justify-center text-white font-semibold"
                    style={{ background: previewAccent }}
                  >
                    {previewName.slice(0, 1).toUpperCase()}
                  </div>
                )}
                <div className="flex-1">
                  <div className="text-sm font-semibold text-gray-900">{previewName}</div>
                  <div className="text-xs text-gray-500 flex items-center gap-1">
                    <ShieldCheck className="h-3 w-3" /> Sample signer page header
                  </div>
                </div>
                <Button
                  size="sm"
                  className="text-white"
                  style={{ background: previewAccent }}
                  type="button"
                >
                  Sign now
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="branding-name">Display name</Label>
                <Input
                  id="branding-name"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Your firm name"
                  maxLength={80}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="branding-accent">Accent colour</Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="branding-accent"
                    value={accentHex}
                    onChange={(e) => setAccentHex(e.target.value)}
                    placeholder="#4f46e5"
                    aria-invalid={!!errors.accent}
                  />
                  <input
                    type="color"
                    aria-label="Pick accent colour"
                    value={HEX_RE.test(accentHex.trim()) ? accentHex.trim() : DEFAULT_ACCENT}
                    onChange={(e) => setAccentHex(e.target.value)}
                    className="h-9 w-10 rounded border border-input cursor-pointer"
                  />
                </div>
                {errors.accent && <p className="text-xs text-red-600">{errors.accent}</p>}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="branding-logo">Logo URL</Label>
              <Input
                id="branding-logo"
                value={logoUrl}
                onChange={(e) => setLogoUrl(e.target.value)}
                placeholder="https://example.com/logo.png"
                aria-invalid={!!errors.logo}
              />
              {errors.logo && <p className="text-xs text-red-600">{errors.logo}</p>}
              <p className="text-xs text-muted-foreground">
                Square PNG / SVG works best. The image must be hosted over HTTPS.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="branding-support">Support email</Label>
              <Input
                id="branding-support"
                type="email"
                value={supportEmail}
                onChange={(e) => setSupportEmail(e.target.value)}
                placeholder="support@example.com"
                aria-invalid={!!errors.support}
              />
              {errors.support && <p className="text-xs text-red-600">{errors.support}</p>}
              <p className="text-xs text-muted-foreground">
                Shown in the signer-page footer so recipients know who to contact for help.
              </p>
            </div>

            {updatedAt && (
              <p className="text-xs text-muted-foreground">
                Last updated {new Date(updatedAt).toLocaleString()}
              </p>
            )}

            <div className="flex flex-col-reverse sm:flex-row sm:justify-between gap-2 pt-2 border-t border-border">
              <Button
                variant="ghost"
                onClick={handleReset}
                disabled={saving}
              >
                Revert to defaults
              </Button>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
                  Cancel
                </Button>
                <Button onClick={handleSave} disabled={saving || hasErrors}>
                  {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Save
                </Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
