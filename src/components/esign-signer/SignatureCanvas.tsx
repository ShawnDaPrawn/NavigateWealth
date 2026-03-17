/**
 * Signature Canvas Component
 * Professional signature capture with Draw, Type, and Upload modes.
 * Supports multiple signature fonts, ink colors, and touch/mouse drawing.
 */

import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Button } from '../ui/button';
import { Trash2, Type, Pen, Upload, Check, Palette } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Input } from '../ui/input';
import { Label } from '../ui/label';

interface SignatureCanvasProps {
  onSave: (signatureData: string) => void;
  onCancel: () => void;
  type: 'signature' | 'initials' | 'text' | 'date' | 'checkbox';
  /** Existing value to pre-populate (e.g. for editing) */
  existingValue?: string;
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

export function SignatureCanvas({ onSave, onCancel, type, existingValue }: SignatureCanvasProps) {
  const drawCanvasRef = useRef<HTMLCanvasElement>(null);
  const typeCanvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasContent, setHasContent] = useState(false);
  const [signatureMode, setSignatureMode] = useState<'draw' | 'type' | 'upload'>('draw');
  const [typedText, setTypedText] = useState('');
  const [selectedFont, setSelectedFont] = useState(SIGNATURE_FONTS[0]);
  const [inkColor, setInkColor] = useState(INK_COLORS[0].value);
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [fontsLoaded, setFontsLoaded] = useState(false);

  // Load Google Fonts
  useEffect(() => {
    const fontFamilies = SIGNATURE_FONTS.map(f => f.name.replace(/ /g, '+')).join('&family=');
    const link = document.createElement('link');
    link.href = `https://fonts.googleapis.com/css2?family=${fontFamilies}:wght@400;700&display=swap`;
    link.rel = 'stylesheet';
    document.head.appendChild(link);

    // Wait for fonts to load
    link.onload = () => {
      // Give fonts a moment to register
      setTimeout(() => setFontsLoaded(true), 200);
    };
    // Fallback: mark as loaded after 2s
    const timeout = setTimeout(() => setFontsLoaded(true), 2000);

    return () => {
      clearTimeout(timeout);
    };
  }, []);

  // Initialize draw canvas
  useEffect(() => {
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

    // Draw guide line
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
      const fontSize = type === 'initials' ? 52 : 40;
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

    // Reset stroke style in case color changed
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

    // Validate file type
    if (!file.type.startsWith('image/')) {
      alert('Please upload an image file (PNG, JPG, etc.)');
      return;
    }

    // Validate file size (max 2MB)
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

  // ==================== CANVAS HELPERS ====================

  const isCanvasEmpty = (canvas: HTMLCanvasElement) => {
    const ctx = canvas.getContext('2d');
    if (!ctx) return true;
    const dpr = window.devicePixelRatio || 1;
    const pixelBuffer = new Uint32Array(
      ctx.getImageData(0, 0, canvas.width, canvas.height).data.buffer
    );
    return !pixelBuffer.some(color => color !== 0);
  };

  // ==================== SAVE HANDLER ====================

  const handleSave = () => {
    if (signatureMode === 'draw') {
      const canvas = drawCanvasRef.current;
      if (!canvas || isCanvasEmpty(canvas)) {
        return;
      }
      onSave(canvas.toDataURL('image/png'));

    } else if (signatureMode === 'type') {
      const canvas = typeCanvasRef.current;
      if (!canvas || !typedText.trim()) {
        return;
      }
      onSave(canvas.toDataURL('image/png'));

    } else if (signatureMode === 'upload') {
      if (!uploadedImage) return;
      onSave(uploadedImage);
    }
  };

  const canSave = () => {
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

  return (
    <div className="space-y-4">
      {/* Mode Selector */}
      <Tabs
        value={signatureMode}
        onValueChange={(v) => {
          setSignatureMode(v as 'draw' | 'type' | 'upload');
          setHasContent(false);
        }}
      >
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="draw" className="gap-1.5">
            <Pen className="h-3.5 w-3.5" />
            Draw
          </TabsTrigger>
          <TabsTrigger value="type" className="gap-1.5">
            <Type className="h-3.5 w-3.5" />
            Type
          </TabsTrigger>
          <TabsTrigger value="upload" className="gap-1.5">
            <Upload className="h-3.5 w-3.5" />
            Upload
          </TabsTrigger>
        </TabsList>

        {/* ==================== DRAW TAB ==================== */}
        <TabsContent value="draw" className="space-y-3 mt-4">
          {/* Ink Color Selector */}
          <div className="flex items-center gap-2">
            <Palette className="h-3.5 w-3.5 text-gray-400" />
            <span className="text-xs text-gray-500">Ink:</span>
            <div className="flex gap-1.5">
              {INK_COLORS.map((color) => (
                <button
                  key={color.value}
                  onClick={() => setInkColor(color.value)}
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

          <div
            ref={containerRef}
            className="border-2 border-dashed border-gray-300 rounded-lg bg-white relative overflow-hidden"
          >
            {/* Guide line */}
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
              className="w-full h-48 cursor-crosshair touch-none"
              style={{ touchAction: 'none' }}
            />
          </div>
          <p className="text-xs text-gray-500 text-center">
            Draw your {type} using your mouse or finger
          </p>
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
              className="text-lg"
              maxLength={type === 'initials' ? 5 : 60}
              autoFocus
            />
          </div>

          {/* Font Selector */}
          <div className="space-y-2">
            <Label className="text-xs text-gray-500">Choose a style</Label>
            <div className="grid grid-cols-5 gap-1.5">
              {SIGNATURE_FONTS.map((font) => (
                <button
                  key={font.name}
                  onClick={() => setSelectedFont(font)}
                  className={`flex flex-col items-center p-2 rounded-lg border transition-all text-center ${
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

          {/* Ink Color for Type */}
          <div className="flex items-center gap-2">
            <Palette className="h-3.5 w-3.5 text-gray-400" />
            <span className="text-xs text-gray-500">Ink:</span>
            <div className="flex gap-1.5">
              {INK_COLORS.map((color) => (
                <button
                  key={color.value}
                  onClick={() => setInkColor(color.value)}
                  className={`w-5 h-5 rounded-full border-2 transition-all ${
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

          {/* Preview Canvas */}
          <div className="border-2 border-dashed border-gray-300 rounded-lg bg-white overflow-hidden">
            <canvas
              ref={typeCanvasRef}
              className="w-full h-32"
            />
          </div>
          <p className="text-xs text-gray-500 text-center">
            Preview of your typed {type}
          </p>
        </TabsContent>

        {/* ==================== UPLOAD TAB ==================== */}
        <TabsContent value="upload" className="space-y-3 mt-4">
          {!uploadedImage ? (
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-gray-300 rounded-lg p-8 bg-white cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-colors"
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
            </div>
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
          <p className="text-xs text-gray-500 text-center">
            For best results, use a signature on a white or transparent background
          </p>
        </TabsContent>
      </Tabs>

      {/* Action Buttons */}
      <div className="flex items-center justify-between pt-3 border-t">
        <Button
          onClick={clearAll}
          variant="outline"
          size="sm"
          disabled={!canSave()}
        >
          <Trash2 className="h-4 w-4 mr-1.5" />
          Clear
        </Button>

        <div className="flex gap-2">
          <Button onClick={onCancel} variant="outline">
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={!canSave()}
            className="bg-indigo-600 hover:bg-indigo-700"
          >
            <Check className="h-4 w-4 mr-1.5" />
            Adopt {typeLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
