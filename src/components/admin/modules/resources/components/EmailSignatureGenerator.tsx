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
import { Button } from '../../../../ui/button';
import { Eye, RotateCcw, Bookmark } from 'lucide-react';
import { motion } from 'motion/react';
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
import { SavedFormatsBar } from './emailSignature/SavedFormatsBar';
import { SignatureFormPanel } from './emailSignature/SignatureFormPanel';
import { SignaturePreviewPanel } from './emailSignature/SignaturePreviewPanel';
import { PreviewDialog } from './emailSignature/PreviewDialog';
import { SaveFormatDialog } from './emailSignature/SaveFormatDialog';

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

  const updateField = useCallback(
    <K extends keyof SignatureData>(field: K, value: SignatureData[K]) => {
      setData((prev) => ({ ...prev, [field]: value }));
    },
    [],
  );

  const resetForm = useCallback(() => {
    setData({ ...DEFAULT_DATA });
    setTemplate('modern');
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
            onClick={() => {
              setFormatName('');
              setSaveFormatOpen(true);
            }}
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
              <div
                className={`h-2 w-10 rounded-full mb-3 ${
                  t.id === 'modern'
                    ? 'bg-gradient-to-r from-purple-600 to-purple-400'
                    : t.id === 'elegant'
                      ? 'bg-gradient-to-r from-amber-600 to-amber-400'
                      : t.id === 'navigate'
                        ? 'bg-[#313653]'
                        : 'bg-purple-600'
                }`}
              />
              <p
                className={`text-sm font-semibold ${active ? 'text-purple-700' : 'text-foreground'}`}
              >
                {t.name}
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">
                {t.description}
              </p>
            </motion.button>
          );
        })}
      </div>

      <SavedFormatsBar
        savedFormats={savedFormats}
        onOpenSaveDialog={() => {
          setFormatName('');
          setSaveFormatOpen(true);
        }}
        onLoadFormat={handleLoadFormat}
        onDeleteFormat={handleDeleteFormat}
      />

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
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

        <SignaturePreviewPanel
          data={data}
          template={template}
          copied={copied}
          showSource={showSource}
          setShowSource={setShowSource}
          signatureHtml={signatureHtml}
          onCopyHtml={handleCopyHtml}
          onDownloadHtml={handleDownloadHtml}
          isReady={isReady}
        />
      </div>

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
