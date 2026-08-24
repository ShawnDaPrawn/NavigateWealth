/**
 * The floating zoom controls over the signed document — one pill for desktop,
 * a smaller one for mobile that clears the bottom action bar.
 *
 * JSX moved verbatim out of SigningWorkflow.tsx, which was over the 1,000-line
 * budget. It closed over only the zoom value and its two handlers, so it is a
 * clean seam.
 */
import { Button } from '../ui/button';
import { ZoomIn, ZoomOut } from 'lucide-react';

interface SigningZoomControlsProps {
  /** Current zoom percentage (50–200). */
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
}

export function SigningZoomControls({ zoom, onZoomIn, onZoomOut }: SigningZoomControlsProps) {
  return (
    <>
      {/* Floating zoom controls — desktop */}
      <div className="fixed bottom-24 left-6 z-30 bg-white shadow-lg border rounded-full p-1 hidden md:flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 rounded-full"
          onClick={onZoomOut}
          disabled={zoom <= 50}
        >
          <ZoomOut className="h-4 w-4" />
        </Button>
        <span className="text-xs font-medium w-10 text-center">{zoom}%</span>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 rounded-full"
          onClick={onZoomIn}
          disabled={zoom >= 200}
        >
          <ZoomIn className="h-4 w-4" />
        </Button>
      </div>

      {/* Floating zoom controls — mobile (sit above the bottom action bar) */}
      <div className="fixed bottom-28 left-3 z-30 bg-white/95 shadow-lg border rounded-full p-0.5 flex md:hidden items-center gap-0.5">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 rounded-full"
          onClick={onZoomOut}
          disabled={zoom <= 50}
        >
          <ZoomOut className="h-3.5 w-3.5" />
        </Button>
        <span className="text-[10px] font-medium w-8 text-center">{zoom}%</span>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 rounded-full"
          onClick={onZoomIn}
          disabled={zoom >= 200}
        >
          <ZoomIn className="h-3.5 w-3.5" />
        </Button>
      </div>
    </>
  );
}
