/**
 * useSignatureCapture — everything the signature/initials pad does: the four
 * modes (saved, draw, type, upload), the drawing strokes, the typed rendering,
 * the upload checks and PNG conversion, and the image handed to `onSave`
 * (a PNG cropped to the ink, or the uploaded/saved image).
 *
 * Moved verbatim out of SignatureCanvas.tsx so the live pad and the Navigator
 * redesign (src/site/sections/ESignAdopt.tsx) capture exactly the same image —
 * the same format, stroke width, font size, ink colours and crop — and differ
 * only in how the pad is drawn. The one addition is `reportUploadError`: where
 * an upload problem is reported. It defaults to the live page's browser alert;
 * the redesign shows the same words inline, as its board draws them.
 */
import React, { useRef, useState, useEffect, useCallback, useMemo } from 'react';

export type CanvasType = 'signature' | 'initials' | 'text' | 'date' | 'checkbox';

/** Available signature fonts with their Google Fonts import names */
export const SIGNATURE_FONTS = [
  { name: 'Dancing Script', label: 'Elegant', cssFamily: '"Dancing Script", cursive' },
  { name: 'Great Vibes', label: 'Classic', cssFamily: '"Great Vibes", cursive' },
  { name: 'Caveat', label: 'Casual', cssFamily: '"Caveat", cursive' },
  { name: 'Sacramento', label: 'Formal', cssFamily: '"Sacramento", cursive' },
  { name: 'Satisfy', label: 'Flowing', cssFamily: '"Satisfy", cursive' },
] as const;

/** Ink color options */
export const INK_COLORS = [
  { value: '#000000', label: 'Black' },
  { value: '#1e3a5f', label: 'Dark Blue' },
  { value: '#1a1a8f', label: 'Royal Blue' },
] as const;

export type SignatureMode = 'saved' | 'draw' | 'type' | 'upload';

/** Derive initials from a signer name. "Sarah Smith" → "SS"; "Sarah" → "S".
 *  Returns "" when no usable name is provided. */
function deriveInitials(name?: string): string {
  if (!name) return '';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '';
  if (parts.length === 1) return parts[0]!.charAt(0).toUpperCase();
  return (parts[0]!.charAt(0) + parts[parts.length - 1]!.charAt(0)).toUpperCase();
}

export interface SignatureCaptureOptions {
  onSave: (signatureData: string) => void;
  type: CanvasType;
  /** A previously adopted full signature for this signer's email (data URL).
   *  When present and `type === 'signature'`, the SAVED tab is shown by default. */
  savedSignature?: string | null;
  /** A previously adopted initials image for this signer's email (data URL).
   *  When present and `type === 'initials'`, the SAVED tab is shown by default. */
  savedInitials?: string | null;
  /** Signer's full name — used to seed sensible defaults (auto-derived initials). */
  signerName?: string;
  /** Where an upload problem is reported. Defaults to the browser alert. */
  reportUploadError?: (message: string) => void;
}

const alertUploadError = (message: string) => {
  alert(message);
};

export function useSignatureCapture({
  onSave,
  type,
  savedSignature,
  savedInitials,
  signerName,
  reportUploadError = alertUploadError,
}: SignatureCaptureOptions) {
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
  const [signatureMode, setSignatureMode] = useState<SignatureMode>(
    hasSavedAsset ? 'saved' : 'draw',
  );

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
    const fontFamilies = SIGNATURE_FONTS.map((f) => f.name.replace(/ /g, '+')).join('&family=');
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

  const initCanvas = useCallback(
    (canvas: HTMLCanvasElement) => {
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
    },
    [inkColor],
  );

  // Initialize draw canvas
  useEffect(() => {
    if (signatureMode !== 'draw') return;
    const canvas = drawCanvasRef.current;
    if (!canvas) return;
    initCanvas(canvas);
  }, [signatureMode, inkColor, initCanvas]);

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

  // Re-render typed text on canvas when font/text/color changes
  useEffect(() => {
    if (signatureMode !== 'type' || !fontsLoaded) return;
    renderTypedSignature();
  }, [typedText, selectedFont, inkColor, fontsLoaded, signatureMode, renderTypedSignature]);

  // ==================== DRAWING HANDLERS ====================

  const getCoords = (
    e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>,
  ) => {
    const canvas = drawCanvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? (e.touches[0]?.clientX ?? 0) : e.clientX;
    const clientY = 'touches' in e ? (e.touches[0]?.clientY ?? 0) : e.clientY;
    return { x: clientX - rect.left, y: clientY - rect.top };
  };

  const startDrawing = (
    e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>,
  ) => {
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
      reportUploadError('Please upload an image file (PNG, JPG, etc.)');
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      reportUploadError('Image must be less than 2MB');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      // The signed PDF can only embed PNG and JPEG; anything else (WebP,
      // GIF…) printed as a grey "[Signature]". Convert it to PNG here.
      if (/^data:image\/(png|jpe?g)/i.test(dataUrl)) {
        setUploadedImage(dataUrl);
        setHasContent(true);
        return;
      }
      void toPngDataUrl(dataUrl).then((png) => {
        if (!png) {
          reportUploadError('That image could not be read. Please upload a PNG or JPG.');
          return;
        }
        setUploadedImage(png);
        setHasContent(true);
      });
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
      ctx.getImageData(0, 0, canvas.width, canvas.height).data.buffer,
    );
    return !pixelBuffer.some((color) => color !== 0);
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
      onSave(trimmedPng(canvas));
      return;
    }
    if (signatureMode === 'type') {
      const canvas = typeCanvasRef.current;
      if (!canvas || !typedText.trim()) return;
      onSave(trimmedPng(canvas));
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
    } else if (signatureMode === 'upload') clearUpload();
  };

  /** Switching tabs — the live Tabs' onValueChange. */
  const changeMode = (v: string) => {
    setSignatureMode(v as SignatureMode);
    setHasContent(
      v === 'saved' ? hasSavedAsset : v === 'type' ? typedText.trim().length > 0 : false,
    );
  };

  const typeLabel = type === 'signature' ? 'Signature' : type === 'initials' ? 'Initials' : 'Input';

  return {
    drawCanvasRef,
    typeCanvasRef,
    fileInputRef,
    containerRef,
    savedAsset,
    hasSavedAsset,
    hasContent,
    signatureMode,
    setSignatureMode,
    changeMode,
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
  };
}

/**
 * The canvas as a PNG cropped to the ink, with a small margin. The whole pad
 * used to be exported, empty margins included, so once the signature was
 * fitted into a field box the actual strokes came out small.
 */
function trimmedPng(canvas: HTMLCanvasElement): string {
  try {
    const ctx = canvas.getContext('2d');
    if (!ctx) return canvas.toDataURL('image/png');
    const { width, height } = canvas;
    const data = ctx.getImageData(0, 0, width, height).data;
    let minX = width;
    let minY = height;
    let maxX = -1;
    let maxY = -1;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (data[(y * width + x) * 4 + 3] > 8) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }
    if (maxX < 0) return canvas.toDataURL('image/png');
    const pad = Math.round(Math.max(width, height) * 0.02);
    const sx = Math.max(0, minX - pad);
    const sy = Math.max(0, minY - pad);
    const sw = Math.min(width, maxX + pad + 1) - sx;
    const sh = Math.min(height, maxY + pad + 1) - sy;
    const out = document.createElement('canvas');
    out.width = sw;
    out.height = sh;
    out.getContext('2d')?.drawImage(canvas, sx, sy, sw, sh, 0, 0, sw, sh);
    return out.toDataURL('image/png');
  } catch {
    return canvas.toDataURL('image/png');
  }
}

/** Re-encode any browser-readable image as PNG; null if it cannot be read. */
function toPngDataUrl(dataUrl: string): Promise<string | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      try {
        const c = document.createElement('canvas');
        c.width = img.naturalWidth || img.width;
        c.height = img.naturalHeight || img.height;
        const ctx = c.getContext('2d');
        if (!ctx || !c.width || !c.height) return resolve(null);
        ctx.drawImage(img, 0, 0);
        resolve(c.toDataURL('image/png'));
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = dataUrl;
  });
}
