/**
 * Email Signature Generator
 *
 * Generates professional HTML email signatures with Navigate Wealth branding.
 * Four template styles: Modern, Elegant, Bold, Navigate.
 * Animated live preview, copy-to-clipboard, and HTML download.
 *
 * WHAT THIS FILE IS NOW
 * ---------------------
 * It was 1,640 lines: ~400 of pure HTML-building logic and ~1,200 of markup.
 * The HTML builders had no business being in a component file at all — they are
 * string functions — and the markup was five independent panels stacked in one
 * `return`. What stays here is the state that all of them share and the handlers
 * that change it; the panels below own no state of their own.
 *
 * `EmailSignatureGenerator.characterization.test.tsx` pins the split: the
 * generated HTML, template switching, saved formats, and reset. It was made
 * green before the move and mutation-checked, because prop threading is where a
 * component extraction quietly stops being behaviour-preserving.
 *
 * Guidelines:
 *   §7    — Presentation layer (no business logic in UI)
 *   §8.3  — Status colour vocabulary, stat card standards
 *   §8.4  — Platform constraints (sonner, motion)
 */

import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { Label } from '../../../../ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../../ui/select';
import { DsButton } from '../../../layout/page';

import { toast } from 'sonner';
import navigateWealthLogo from 'figma:asset/def9c4d4fdd055d486a64e8df869988fd6a2aca3.png';
import {
  type SavedFormat,
  type SignatureData,
  DEFAULT_DATA,
  FORMAT_FIELD_KEYS,
  FORMAT_STORAGE_KEY,
  TEMPLATES,
} from './emailSignature/signatureModel';
import { generateSignatureHtml } from './emailSignature/signatureHtml';

import { SignatureFormPanel } from './emailSignature/SignatureFormPanel';
import { SignaturePreviewPanel } from './emailSignature/SignaturePreviewPanel';
import { PreviewDialog } from './emailSignature/PreviewDialog';
import { SaveFormatDialog } from './emailSignature/SaveFormatDialog';

export function EmailSignatureGenerator() {
  const [data, setData] = useState<SignatureData>({ ...DEFAULT_DATA });
  const [template, setTemplate] = useState('modern');
  const [loadedFormatId, setLoadedFormatId] = useState('');
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

  // Any edit moves the form away from the loaded format, so the "Saved format"
  // select lets go of it — choosing it again then re-applies it.
  const updateField = useCallback(
    <K extends keyof SignatureData>(field: K, value: SignatureData[K]) => {
      setData((prev) => ({ ...prev, [field]: value }));
      setLoadedFormatId('');
    },
    [],
  );

  const resetForm = useCallback(() => {
    setData({ ...DEFAULT_DATA });
    setTemplate('modern');
    setLoadedFormatId('');
    toast.success('Form reset to defaults');
  }, []);

  const logoSrc = data.logoUrl || navigateWealthLogo;

  // Resolve effective display colours for UI swatches — mirrors the HTML generators' fallback logic
  const effectiveNameColour =
    data.nameColour || (template === 'bold' || template === 'navigate' ? '#ffffff' : '#111827');
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

  // The "Copied" tick resets after 2s; the timer is cleared on unmount so it
  // never sets state on a page that has gone (it failed CI as an unhandled
  // error after the test environment was torn down).
  const copiedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (copiedTimer.current) clearTimeout(copiedTimer.current);
    },
    [],
  );

  const handleCopyHtml = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(signatureHtml);
      setCopied(true);
      if (copiedTimer.current) clearTimeout(copiedTimer.current);
      copiedTimer.current = setTimeout(() => setCopied(false), 2000);
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
    try {
      localStorage.setItem(FORMAT_STORAGE_KEY, JSON.stringify(updated));
    } catch {
      /* quota */
    }
    setFormatName('');
    setSaveFormatOpen(false);
    toast.success(`Format "${newFormat.name}" saved`);
  }, [formatName, savedFormats, data, template]);

  const handleLoadFormat = useCallback((format: SavedFormat) => {
    setTemplate(format.template);
    setData((prev) => ({ ...prev, ...format.fields }));
    toast.success(`Format "${format.name}" loaded`);
  }, []);

  const handleDeleteFormat = useCallback(
    (id: string) => {
      const updated = savedFormats.filter((f) => f.id !== id);
      setSavedFormats(updated);
      try {
        localStorage.setItem(FORMAT_STORAGE_KEY, JSON.stringify(updated));
      } catch {
        /* quota */
      }
      toast.success('Format deleted');
    },
    [savedFormats],
  );

  // ── Logo Upload ─────────────────────────────────────────────────────────────

  const handleLogoUpload = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
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
    },
    [updateField],
  );

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
    <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[minmax(0,1fr)_420px]">
      {/* RE-CI-Signatures: the generator card (template, saved format, details)… */}
      <section className="ds-card overflow-hidden">
        <div className="ds-card-h flex-wrap">
          <h3>Email signature generator</h3>
          <div className="flex flex-wrap gap-1.5">
            <DsButton size="sm" variant="ghost" onClick={resetForm}>
              Reset
            </DsButton>
            <DsButton
              size="sm"
              onClick={() => {
                setFormatName('');
                setSaveFormatOpen(true);
              }}
            >
              Save signature format
            </DsButton>
          </div>
        </div>
        <div className="ds-card-b space-y-5">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="sig-template">Template</Label>
              <Select
                value={template}
                onValueChange={(value) => {
                  setTemplate(value);
                  setLoadedFormatId('');
                }}
              >
                <SelectTrigger id="sig-template">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TEMPLATES.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sig-format">Saved format</Label>
              <div className="flex gap-1.5">
                <Select
                  value={loadedFormatId}
                  onValueChange={(id) => {
                    const format = savedFormats.find((f) => f.id === id);
                    if (format) {
                      setLoadedFormatId(id);
                      handleLoadFormat(format);
                    }
                  }}
                  disabled={savedFormats.length === 0}
                >
                  <SelectTrigger id="sig-format" className="min-w-0 flex-1">
                    <SelectValue placeholder={savedFormats.length ? 'Choose' : 'None saved'} />
                  </SelectTrigger>
                  <SelectContent>
                    {savedFormats.map((f) => (
                      <SelectItem key={f.id} value={f.id}>
                        {f.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {loadedFormatId && (
                  <DsButton
                    size="sm"
                    variant="ghost"
                    className="h-9"
                    aria-label="Delete saved format"
                    onClick={() => {
                      handleDeleteFormat(loadedFormatId);
                      setLoadedFormatId('');
                    }}
                  >
                    Delete
                  </DsButton>
                )}
              </div>
            </div>
          </div>

          <SignatureFormPanel
            data={data}
            template={template}
            logoFileRef={logoFileRef}
            updateField={updateField}
            logoSrc={logoSrc}
            effectiveNameColour={effectiveNameColour}
            effectiveTitleColour={effectiveTitleColour}
            onLogoUpload={handleLogoUpload}
            onClearLogo={handleClearLogo}
          />
        </div>
      </section>

      {/* …and the preview card beside it */}
      <SignaturePreviewPanel
        data={data}
        template={template}
        copied={copied}
        showSource={showSource}
        setShowSource={setShowSource}
        signatureHtml={signatureHtml}
        onCopyHtml={handleCopyHtml}
        onDownloadHtml={handleDownloadHtml}
        onFullPreview={() => setPreviewOpen(true)}
        isReady={isReady}
      />

      <PreviewDialog
        data={data}
        template={template}
        copied={copied}
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        signatureHtml={signatureHtml}
        onCopyHtml={handleCopyHtml}
        onDownloadHtml={handleDownloadHtml}
      />

      <SaveFormatDialog
        data={data}
        template={template}
        open={saveFormatOpen}
        onOpenChange={setSaveFormatOpen}
        formatName={formatName}
        setFormatName={setFormatName}
        logoSrc={logoSrc}
        onSaveFormat={handleSaveFormat}
      />
    </div>
  );
}
