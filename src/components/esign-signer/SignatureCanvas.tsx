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

import { Button } from '../ui/button';
import { Trash2, Type, Pen, Upload, Check, Palette, RotateCcw } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import {
  INK_COLORS,
  SIGNATURE_FONTS,
  useSignatureCapture,
  type CanvasType,
  type SignatureMode,
} from './hooks/useSignatureCapture';

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

export function SignatureCanvas({
  onSave,
  onCancel,
  type,
  existingValue: _existingValue,
  savedSignature,
  savedInitials,
  signerName,
}: SignatureCanvasProps) {
  const {
    drawCanvasRef,
    typeCanvasRef,
    fileInputRef,
    containerRef,
    savedAsset,
    hasSavedAsset,
    signatureMode,
    setSignatureMode,
    typedText,
    setTypedText,
    setHasContent,
    selectedFont,
    setSelectedFont,
    inkColor,
    setInkColor,
    uploadedImage,
    startDrawing,
    draw,
    stopDrawing,
    handleFileUpload,
    clearUpload,
    handleSave,
    canSave,
    clearAll,
    typeLabel,
  } = useSignatureCapture({ onSave, type, savedSignature, savedInitials, signerName });

  // Tabs grid columns: 4 when saved is shown, 3 otherwise.
  const tabColsClass = hasSavedAsset ? 'grid-cols-4' : 'grid-cols-3';

  return (
    <div className="space-y-4">
      <Tabs
        value={signatureMode}
        onValueChange={(v) => {
          setSignatureMode(v as SignatureMode);
          setHasContent(
            v === 'saved' ? hasSavedAsset : v === 'type' ? typedText.trim().length > 0 : false,
          );
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
                <span className="text-xs font-medium text-gray-600">
                  Your saved {typeLabel.toLowerCase()}
                </span>
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
            <canvas ref={typeCanvasRef} className="w-full h-32" />
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
                  <p className="text-xs text-gray-500 mt-1">
                    PNG or JPG, max 2MB. Transparent backgrounds work best.
                  </p>
                </div>
              </div>
            </button>
          ) : (
            <div className="border-2 border-gray-200 rounded-lg p-4 bg-white">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs text-gray-500">Uploaded signature</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearUpload}
                  className="h-7 text-red-500 hover:text-red-600 hover:bg-red-50"
                >
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
