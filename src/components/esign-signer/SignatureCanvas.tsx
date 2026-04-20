/**
 * Signature Canvas Component
 *
 * Captures a signer's signature/initials with four interchangeable modes:
 *   - SAVED   (only when a previously-adopted signature exists for this email)
 *   - DRAW    (mouse / finger)
 *   - TYPE    (cursive font selection)
 *   - UPLOAD  (image file)
 *
 * When `savedSignature` (or `savedInitials` for an initials field) is
 * provided, the dialog opens directly on the SAVED tab so a returning
 * signer is one tap away from "Use this signature".
 *
 * Initials default to the signer's auto-derived initials (e.g. "Sarah
 * Smith" → "SS") in the TYPE tab, so the most common case is a single tap.
 */

import React, { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import { Button } from '../ui/button';
import { Trash2, Type, Pen, Upload, Check, Palette, RotateCcw } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Input } from '../ui/input';
import { Label } from '../ui/label';

type CanvasType = 'signature' | 'initials' | 'text' | 'date' | 'checkbox';

interface SignatureCanvasProps {
  onSave: (signatureData: string) => void;
  onCancel: () => void;
  type: CanvasType;
  /** Existing value to pre-populate (e.g. for editing) */
  existingValue?: string;
  /** A previously adopted full signature for this signer's email (data URL).
   *  When present and `type === 'signature'`, the SAVED tab is shown by default. */
  savedSignature?: string | null;
  /** A previously adopted initials image for this signer's email (data URL).
   *  When present and `type === 'initials'`, the SAVED tab is shown by default. */
  savedInitials?: string | null;
  /** Signer's full name — used to seed sensible defaults (auto-derived initials). */
  signerName?: string;
}

/** Available signature fonts with their Google Fonts import names */
const SIGNATURE_FONTS = [
  { name: 'Dancing Script', label: 'Elegant', cssFamily: '"Dancing Script", cursive' },
  { name: 'Great Vibes', label: 'Classic', cssFamily: '"Great Vibes", cursive' },
  { name: 'Caveat', label: 'Casual', cssFamily: '"Caveat", cursive' },
  { name: 'Sacramento', label: 'Formal', cssFamily: '"Sacramento", cursive' },
  { name: 'Satisfy', label: 'Flowing', cssFamily: '"Satisfy", cursive' },
] as const;

/** Ink color options */
const INK_COLORS = [
  { value: '#000000', label: 'Black' },
  { value: '#1e3a5f', label: 'Dark Blue' },
  { value: '#1a1a8f', label: 'Royal Blue' },
] as const;

type SignatureMode = 'saved' | 'draw' | 'type' | 'upload';

/** Derive initials from a signer name. "Sarah Smith" → "SS"; "Sarah" → "S".
 *  Returns "" when no usable name is provided. */
function deriveInitials(name?: string): string {
  if (!name) return '';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '';
  if (parts.length === 1) return parts[0]!.charAt(0).toUpperCase();
  return (parts[0]!.charAt(0) + parts[parts.length - 1]!.charAt(0)).toUpperCase();
}

export function SignatureCanvas({
  onSave,
  onCancel,
  type,
  existingValue: _existingValue,
  savedSignature,
  savedInitials,
  signerName,
}: SignatureCanvasProps) {
  const drawCanvasRef = useRef<HTMLCanvasElement>(null);
  const typeCanvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // What "saved" means depends on the field type.
  const savedAsset = type === 'initials' ? (savedInitials ?? null) : (savedSignature ?? null);
  const hasSavedAsset = !!savedAsset;

  const [isDrawing, setIsDrawing] = useState(false);
  const [hasContent, setHasContent] = useState(false);
  // Default to the SAVED tab if we have one for this field type, otherwise DRAW.
  const [signatureMode, setSignatureMode] = useState<SignatureMode>(hasSavedAsset ? 'saved' : 'draw');

  // For initials, seed the typed text with auto-derived initials.
  // For signatures, seed with the signer's full name.
  const seededName = useMemo(() => {
    if (type === 'initials') return deriveInitials(signerName);
    return (signerName || '').trim();
  }, [signerName, type]);

  type SigFont = (typeof SIGNATURE_FONTS)[number];
  const [typedText, setTypedText] = useState(seededName);
  const [selectedFont, setSelectedFont] = useState<SigFont>(SIGNATURE_FONTS[0]);
  const [inkColor, setInkColor] = useState<string>(INK_COLORS[0].value);
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [fontsLoaded, setFontsLoaded] = useState(false);

  // Mark "has content" whenever a seeded type-tab value exists.
  useEffect(() => {
    if (signatureMode === 'type' && typedText.trim().length > 0) {
      setHasContent(true);
    }
  }, [signatureMode, typedText]);

  // Load Google Fonts
  useEffect(() => {
    const fontFamilies = SIGNATURE_FONTS.map(f => f.name.replace(/ /g, '+')).join('&family=');
    const link = document.createElement('link');
    link.href = `https://fonts.googleapis.com/css2?family=${fontFamilies}:wght@400;700&display=swap`;
    link.rel = 'stylesheet';
    document.head.appendChild(link);

    link.onload = () => {
      setTimeout(() => setFontsLoaded(true), 200);
    };
    const timeout = setTimeout(() => setFontsLoaded(true), 2000);

    return () => {
      clearTimeout(timeout);
    };
  }, []);

  // Initialize draw canvas
  useEffect(() => {
    if (signatureMode !== 'draw') return;
    const canvas = drawCanvasRef.current;
    if (!canvas) return;
    initCanvas(canvas);
  }, [signatureMode, inkColor]);

  const initCanvas = (canvas: HTMLCanvasElement) => {
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.scale(dpr, dpr);
    ctx.strokeStyle = inkColor;
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  };

  // Re-render typed text on canvas when font/text/color changes
  useEffect(() => {
    if (signatureMode !== 'type' || !fontsLoaded) return;
    renderTypedSignature();
  }, [typedText, selectedFont, inkColor, fontsLoaded, signatureMode]);

  const renderTypedSignature = useCallback(() => {
    const canvas = typeCanvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, rect.width, rect.height);

    // Subtle baseline guide
    const lineY = rect.height * 0.7;
    ctx.strokeStyle = '#e5e7eb';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(20, lineY);
    ctx.lineTo(rect.width - 20, lineY);
    ctx.stroke();
    ctx.setLineDash([]);

    if (typedText) {
      const fontSize = type === 'initials' ? 56 : 44;
      ctx.font = `${fontSize}px ${selectedFont.cssFamily}`;
      ctx.fillStyle = inkColor;
      ctx.textBaseline = 'alphabetic';
      ctx.textAlign = 'center';
      ctx.fillText(typedText, rect.width / 2, lineY - 4);
    }
  }, [typedText, selectedFont, inkColor, type]);

  // ==================== DRAWING HANDLERS ====================

  const getCoords = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = drawCanvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0]?.clientX ?? 0 : e.clientX;
    const clientY = 'touches' in e ? e.touches[0]?.clientY ?? 0 : e.clientY;
    return { x: clientX - rect.left, y: clientY - rect.top };
  };

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    setIsDrawing(true);
    setHasContent(true);

    const canvas = drawCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.strokeStyle = inkColor;
    ctx.lineWidth = 2.5;

    const { x, y } = getCoords(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    if (!isDrawing) return;

    const canvas = drawCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { x, y } = getCoords(e);
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = (e?: React.MouseEvent | React.TouchEvent) => {
    e?.preventDefault();
    setIsDrawing(false);
  };

  const clearDrawCanvas = () => {
    const canvas = drawCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);
    setHasContent(false);
  };

  // ==================== UPLOAD HANDLERS ====================

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Please upload an image file (PNG, JPG, etc.)');
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      alert('Image must be less than 2MB');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      setUploadedImage(event.target?.result as string);
      setHasContent(true);
    };
    reader.readAsDataURL(file);
  };

  const clearUpload = () => {
    setUploadedImage(null);
    setHasContent(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // ==================== SAVE HANDLER ====================

  const isCanvasEmpty = (canvas: HTMLCanvasElement) => {
    const ctx = canvas.getContext('2d');
    if (!ctx) return true;
    const pixelBuffer = new Uint32Array(
      ctx.getImageData(0, 0, canvas.width, canvas.height).data.buffer
    );
    return !pixelBuffer.some(color => color !== 0);
  };

  const handleSave = () => {
    if (signatureMode === 'saved') {
      if (!savedAsset) return;
      onSave(savedAsset);
      return;
    }
    if (signatureMode === 'draw') {
      const canvas = drawCanvasRef.current;
      if (!canvas || isCanvasEmpty(canvas)) return;
      onSave(canvas.toDataURL('image/png'));
      return;
    }
    if (signatureMode === 'type') {
      const canvas = typeCanvasRef.current;
      if (!canvas || !typedText.trim()) return;
      onSave(canvas.toDataURL('image/png'));
      return;
    }
    if (signatureMode === 'upload') {
      if (!uploadedImage) return;
      onSave(uploadedImage);
    }
  };

  const canSave = () => {
    if (signatureMode === 'saved') return hasSavedAsset;
    if (signatureMode === 'draw') return hasContent;
    if (signatureMode === 'type') return typedText.trim().length > 0;
    if (signatureMode === 'upload') return !!uploadedImage;
    return false;
  };

  const clearAll = () => {
    if (signatureMode === 'draw') clearDrawCanvas();
    else if (signatureMode === 'type') {
      setTypedText('');
      setHasContent(false);
    }
    else if (signatureMode === 'upload') clearUpload();
  };

  const typeLabel = type === 'signature' ? 'Signature' : type === 'initials' ? 'Initials' : 'Input';

  // Tabs grid columns: 4 when saved is shown, 3 otherwise.
  const tabColsClass = hasSavedAsset ? 'grid-cols-4' : 'grid-cols-3';

  return (
    <div className="space-y-4">
      <Tabs
        value={signatureMode}
        onValueChange={(v) => {
          setSignatureMode(v as SignatureMode);
          setHasContent(v === 'saved' ? hasSavedAsset : v === 'type' ? typedText.trim().length > 0 : false);
        }}
      >
        <TabsList className={`grid w-full ${tabColsClass} h-auto`}>
          {hasSavedAsset && (
            <TabsTrigger value="saved" className="gap-1.5 py-2.5">
              <Check className="h-3.5 w-3.5" />
              Saved
            </TabsTrigger>
          )}
          <TabsTrigger value="draw" className="gap-1.5 py-2.5">
            <Pen className="h-3.5 w-3.5" />
            Draw
          </TabsTrigger>
          <TabsTrigger value="type" className="gap-1.5 py-2.5">
            <Type className="h-3.5 w-3.5" />
            Type
          </TabsTrigger>
          <TabsTrigger value="upload" className="gap-1.5 py-2.5">
            <Upload className="h-3.5 w-3.5" />
            Upload
          </TabsTrigger>
        </TabsList>

        {/* ==================== SAVED TAB ==================== */}
        {hasSavedAsset && (
          <TabsContent value="saved" className="space-y-3 mt-4">
            <div className="border-2 border-indigo-200 rounded-lg bg-white p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-medium text-gray-600">Your saved {typeLabel.toLowerCase()}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSignatureMode('draw')}
                  className="h-7 text-xs text-indigo-600 hover:text-indigo-700"
                >
                  <RotateCcw className="h-3 w-3 mr-1" />
                  Create new
                </Button>
              </div>
              <div className="flex items-center justify-center h-40 bg-gray-50 rounded-lg overflow-hidden">
                <img
                  src={savedAsset!}
                  alt={`Saved ${typeLabel.toLowerCase()}`}
                  className="max-h-full max-w-full object-contain"
                />
              </div>
            </div>
            <p className="text-xs text-gray-500 text-center">
              Tap "Adopt {typeLabel}" to use this for the document.
            </p>
          </TabsContent>
        )}

        {/* ==================== DRAW TAB ==================== */}
        <TabsContent value="draw" className="space-y-3 mt-4">
          <div className="flex items-center gap-2">
            <Palette className="h-3.5 w-3.5 text-gray-400" />
            <span className="text-xs text-gray-500">Ink:</span>
            <div className="flex gap-1.5">
              {INK_COLORS.map((color) => (
                <button
                  key={color.value}
                  type="button"
                  onClick={() => setInkColor(color.value)}
                  aria-label={`Use ${color.label} ink`}
                  className={`w-7 h-7 rounded-full border-2 transition-all ${
                    inkColor === color.value
                      ? 'border-primary ring-2 ring-primary/20 scale-110'
                      : 'border-gray-200 hover:border-gray-400'
                  }`}
                  style={{ backgroundColor: color.value }}
                  title={color.label}
                />
              ))}
            </div>
          </div>

          <div
            ref={containerRef}
            className="border-2 border-dashed border-gray-300 rounded-lg bg-white relative overflow-hidden"
          >
            <div className="absolute bottom-[30%] left-5 right-5 border-b border-gray-200 pointer-events-none" />
            <div className="absolute bottom-[28%] left-5 text-[10px] text-gray-300 pointer-events-none">
              Sign above this line
            </div>
            <canvas
              ref={drawCanvasRef}
              onMouseDown={startDrawing}
              onMouseMove={draw}
              onMouseUp={stopDrawing}
              onMouseLeave={stopDrawing}
              onTouchStart={startDrawing}
              onTouchMove={draw}
              onTouchEnd={stopDrawing}
              // 240px tall on mobile; 200px desktop is plenty given the wider
              // dialog. The fixed-height-via-class lets the canvas pixel
              // dimensions match the rendered CSS box on mount.
              className="w-full h-60 md:h-52 cursor-crosshair touch-none"
              style={{ touchAction: 'none' }}
            />
          </div>
        </TabsContent>

        {/* ==================== TYPE TAB ==================== */}
        <TabsContent value="type" className="space-y-3 mt-4">
          <div className="space-y-2">
            <Label htmlFor="typed-sig" className="text-sm text-gray-600">
              Type your {type}
            </Label>
            <Input
              id="typed-sig"
              type="text"
              value={typedText}
              onChange={(e) => {
                setTypedText(e.target.value);
                setHasContent(e.target.value.trim().length > 0);
              }}
              placeholder={type === 'initials' ? 'e.g. JD' : 'e.g. John Doe'}
              className="text-lg h-12"
              maxLength={type === 'initials' ? 5 : 60}
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <Label className="text-xs text-gray-500">Choose a style</Label>
            <div className="grid grid-cols-5 gap-1.5">
              {SIGNATURE_FONTS.map((font) => (
                <button
                  key={font.name}
                  type="button"
                  onClick={() => setSelectedFont(font)}
                  className={`flex flex-col items-center p-2 rounded-lg border transition-all text-center min-h-[56px] ${
                    selectedFont.name === font.name
                      ? 'border-primary bg-primary/5 ring-1 ring-primary/20'
                      : 'border-gray-200 hover:border-gray-300 bg-white'
                  }`}
                >
                  <span
                    className="text-lg leading-tight mb-0.5 truncate w-full"
                    style={{ fontFamily: font.cssFamily, color: inkColor }}
                  >
                    {typedText || (type === 'initials' ? 'JD' : 'Name')}
                  </span>
                  <span className="text-[9px] text-gray-400">{font.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Palette className="h-3.5 w-3.5 text-gray-400" />
            <span className="text-xs text-gray-500">Ink:</span>
            <div className="flex gap-1.5">
              {INK_COLORS.map((color) => (
                <button
                  key={color.value}
                  type="button"
                  onClick={() => setInkColor(color.value)}
                  aria-label={`Use ${color.label} ink`}
                  className={`w-6 h-6 rounded-full border-2 transition-all ${
                    inkColor === color.value
                      ? 'border-primary ring-2 ring-primary/20 scale-110'
                      : 'border-gray-200 hover:border-gray-400'
                  }`}
                  style={{ backgroundColor: color.value }}
                  title={color.label}
                />
              ))}
            </div>
          </div>

          <div className="border-2 border-dashed border-gray-300 rounded-lg bg-white overflow-hidden">
            <canvas
              ref={typeCanvasRef}
              className="w-full h-32"
            />
          </div>
        </TabsContent>

        {/* ==================== UPLOAD TAB ==================== */}
        <TabsContent value="upload" className="space-y-3 mt-4">
          {!uploadedImage ? (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-full border-2 border-dashed border-gray-300 rounded-lg p-8 bg-white hover:border-primary/50 hover:bg-primary/5 transition-colors"
            >
              <div className="flex flex-col items-center text-center space-y-3">
                <div className="h-12 w-12 rounded-full bg-gray-100 flex items-center justify-center">
                  <Upload className="h-6 w-6 text-gray-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-700">Upload a signature image</p>
                  <p className="text-xs text-gray-500 mt-1">PNG or JPG, max 2MB. Transparent backgrounds work best.</p>
                </div>
              </div>
            </button>
          ) : (
            <div className="border-2 border-gray-200 rounded-lg p-4 bg-white">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs text-gray-500">Uploaded signature</span>
                <Button variant="ghost" size="sm" onClick={clearUpload} className="h-7 text-red-500 hover:text-red-600 hover:bg-red-50">
                  <Trash2 className="h-3.5 w-3.5 mr-1" />
                  Remove
                </Button>
              </div>
              <div className="flex items-center justify-center h-32 bg-gray-50 rounded-lg">
                <img
                  src={uploadedImage}
                  alt="Uploaded signature"
                  className="max-h-full max-w-full object-contain"
                />
              </div>
            </div>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={handleFileUpload}
            className="hidden"
          />
        </TabsContent>
      </Tabs>

      {/* Action Buttons */}
      <div className="flex items-center justify-between pt-3 border-t gap-2">
        <Button
          onClick={clearAll}
          variant="outline"
          size="sm"
          disabled={signatureMode === 'saved' || !canSave()}
          className="h-11"
        >
          <Trash2 className="h-4 w-4 mr-1.5" />
          Clear
        </Button>

        <div className="flex gap-2">
          <Button onClick={onCancel} variant="outline" className="h-11">
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={!canSave()}
            className="bg-indigo-600 hover:bg-indigo-700 h-11"
          >
            <Check className="h-4 w-4 mr-1.5" />
            Adopt {typeLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
