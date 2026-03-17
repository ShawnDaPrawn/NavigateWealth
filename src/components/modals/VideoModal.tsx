import React from 'react';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '../ui/dialog';
import { Button } from '../ui/button';
import { X } from 'lucide-react';

interface VideoModalProps {
  isOpen: boolean;
  onClose: () => void;
  videoUrl?: string;
  title?: string;
  description?: string;
}

export function VideoModal({
  isOpen,
  onClose,
  videoUrl = "https://www.youtube.com/embed/dQw4w9WgXcQ?autoplay=1&rel=0&modestbranding=1",
  title = "Navigate Wealth Explainer",
  description = "Learn about our comprehensive financial planning services and how we can help you achieve your financial goals."
}: VideoModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl w-full mx-auto p-0 bg-gradient-to-br from-gray-900 via-black to-gray-900 border-0 overflow-hidden rounded-2xl shadow-2xl">
        <DialogTitle className="sr-only">{title}</DialogTitle>
        <DialogDescription className="sr-only">
          {description}
        </DialogDescription>

        {/* Close Button */}
        <Button
          variant="ghost"
          size="sm"
          onClick={onClose}
          className="absolute top-4 right-4 z-50 h-10 w-10 rounded-full bg-black/50 hover:bg-black/70 text-white backdrop-blur-sm"
        >
          <X className="h-5 w-5" />
        </Button>

        {/* Video Container */}
        <div className="relative w-full h-0 pb-[56.25%]">
          <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-gray-900 via-black to-gray-900">
            <div className="w-full h-full flex items-center justify-center">
              <iframe
                className="w-full h-full"
                src={videoUrl}
                title={title}
                frameBorder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          </div>
        </div>

        {/* Video Info Section */}
        <div className="bg-gradient-to-r from-gray-900 via-black to-gray-900 text-white p-8">
          <div className="max-w-3xl mx-auto text-center">
            <h3 className="text-2xl font-bold mb-4">
              Discover Navigate Wealth
            </h3>
            <p className="text-gray-300 text-lg leading-relaxed mb-6">
              Learn how Navigate Wealth can help you build, protect, and grow your wealth through personalized financial planning and expert guidance.
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
