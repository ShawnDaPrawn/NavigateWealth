/**
 * The left column: every field that feeds the signature.
 *
 * Split out of `EmailSignatureGenerator.tsx` (1,640 lines). Presentational —
 * it owns no state; everything it needs arrives as a prop.
 */
import type { ChangeEvent, RefObject } from 'react';
import { Button } from '../../../../../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../../../../ui/card';
import { Input } from '../../../../../ui/input';
import { Label } from '../../../../../ui/label';
import { Textarea } from '../../../../../ui/textarea';
import {
  Award,
  ImageIcon,
  Instagram,
  Linkedin,
  Palette,
  Phone,
  RotateCcw,
  Shield,
  Type,
  Upload,
  User,
  Youtube,
} from 'lucide-react';
import { type SignatureData, FSP_TAGLINE } from './signatureModel';

interface SignatureFormPanelProps {
  data: SignatureData;
  template: string;
  logoFileRef: RefObject<HTMLInputElement>;
  updateField: <K extends keyof SignatureData>(field: K, value: SignatureData[K]) => void;
  logoSrc: string;
  effectiveNameColour: string;
  effectiveTitleColour: string;
  onLogoUpload: (e: ChangeEvent<HTMLInputElement>) => void;
  onClearLogo: () => void;
}

export function SignatureFormPanel({
  data,
  template,
  logoFileRef,
  updateField,
  logoSrc,
  effectiveNameColour,
  effectiveTitleColour,
  onLogoUpload,
  onClearLogo,
}: SignatureFormPanelProps) {
  return (
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
            <Label className="text-xs">
              Full Name <span className="text-red-500">*</span>
            </Label>
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
                <svg viewBox="0 0 24 24" className="h-3 w-3" fill="currentColor">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                </svg>
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
              onChange={onLogoUpload}
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
                      onClick={onClearLogo}
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
                    value={
                      effectiveTitleColour.length > 7
                        ? effectiveTitleColour.slice(0, 7)
                        : effectiveTitleColour
                    }
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
  );
}
