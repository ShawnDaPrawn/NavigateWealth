/**
 * Publish FNA Dialog Component
 * Reusable dialog for publishing/unpublishing FNA analyses to clients
 */

import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../../ui/dialog';
import { Button } from '../../../ui/button';
import { Badge } from '../../../ui/badge';
import { Loader2, CheckCircle, AlertCircle, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner@2.0.3';

interface PublishFNADialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fnaType: 'risk' | 'medical' | 'retirement' | 'investment' | 'tax' | 'estate';
  fnaTypeName: string; // e.g., "Risk Planning FNA"
  fnaData: { id?: string; status?: string; [key: string]: unknown };
  currentStatus: 'draft' | 'published' | 'archived';
  onPublishSuccess: () => void;
  publishFunction: (fnaId: string) => Promise<void>;
  unpublishFunction?: (fnaId: string) => Promise<void>;
}

export function PublishFNADialog({
  open,
  onOpenChange,
  fnaType,
  fnaTypeName,
  fnaData,
  currentStatus,
  onPublishSuccess,
  publishFunction,
  unpublishFunction,
}: PublishFNADialogProps) {
  const [isPublishing, setIsPublishing] = useState(false);
  const isPublished = currentStatus === 'published';

  const handlePublish = async () => {
    try {
      setIsPublishing(true);

      if (isPublished && unpublishFunction) {
        // Unpublish
        await unpublishFunction(fnaData.id);
        toast.success('FNA unpublished', {
          description: `${fnaTypeName} has been unpublished and is no longer visible to the client.`,
        });
      } else {
        // Publish
        await publishFunction(fnaData.id);
        toast.success('FNA published successfully!', {
          description: `${fnaTypeName} is now visible to the client in their portal.`,
        });
      }

      onPublishSuccess();
      onOpenChange(false);
    } catch (error) {
      console.error('Error publishing/unpublishing FNA:', error);
      toast.error('Failed to update FNA status', {
        description: error instanceof Error ? error.message : 'Please try again',
      });
    } finally {
      setIsPublishing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isPublished ? 'Unpublish' : 'Publish'} {fnaTypeName}
          </DialogTitle>
          <DialogDescription>
            {isPublished
              ? 'Remove this analysis from the client portal'
              : 'Make this analysis visible to the client'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Current Status */}
          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
            <span className="text-sm text-gray-700">Current Status</span>
            <Badge
              variant={currentStatus === 'published' ? 'default' : 'secondary'}
              className={
                currentStatus === 'published'
                  ? 'bg-green-600 hover:bg-green-700'
                  : ''
              }
            >
              {currentStatus === 'published' ? (
                <div className="contents">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  Published
                </div>
              ) : (
                <div className="contents">
                  <AlertCircle className="h-3 w-3 mr-1" />
                  {currentStatus === 'draft' ? 'Draft' : 'Archived'}
                </div>
              )}
            </Badge>
          </div>

          {/* FNA Details */}
          <div className="space-y-2 p-3 border border-gray-200 rounded-lg">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">FNA Type</span>
              <span className="text-gray-900 capitalize">{fnaType}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Version</span>
              <span className="text-gray-900">{fnaData.version || 1}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Last Updated</span>
              <span className="text-gray-900">
                {new Date(fnaData.updatedAt || fnaData.createdAt).toLocaleDateString()}
              </span>
            </div>
          </div>

          {/* Action Description */}
          <div
            className={`p-4 rounded-lg border-2 ${
              isPublished
                ? 'bg-orange-50 border-orange-200'
                : 'bg-green-50 border-green-200'
            }`}
          >
            <div className="flex items-start gap-3">
              {isPublished ? (
                <EyeOff className="h-5 w-5 text-orange-600 flex-shrink-0 mt-0.5" />
              ) : (
                <Eye className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
              )}
              <div>
                <p
                  className={`text-sm mb-2 ${
                    isPublished ? 'text-orange-900' : 'text-green-900'
                  }`}
                >
                  <strong>
                    {isPublished ? 'Unpublishing will:' : 'Publishing will:'}
                  </strong>
                </p>
                <ul
                  className={`text-xs space-y-1 ${
                    isPublished ? 'text-orange-800' : 'text-green-800'
                  }`}
                >
                  {isPublished ? (
                    <div className="contents">
                      <li>• Remove this analysis from the client portal</li>
                      <li>• Client will no longer see this FNA</li>
                      <li>• Status will change to "Draft"</li>
                      <li>• You can edit and republish later</li>
                    </div>
                  ) : (
                    <div className="contents">
                      <li>• Make this analysis visible in the client portal</li>
                      <li>• Client can view comprehensive results</li>
                      <li>• Status will change to "Published"</li>
                      <li>• Publish timestamp will be recorded</li>
                    </div>
                  )}
                </ul>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isPublishing}
          >
            Cancel
          </Button>
          <Button
            onClick={handlePublish}
            disabled={isPublishing}
            className={
              isPublished
                ? 'bg-orange-600 hover:bg-orange-700'
                : 'bg-green-600 hover:bg-green-700'
            }
          >
            {isPublishing ? (
              <div className="contents">
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                {isPublished ? 'Unpublishing...' : 'Publishing...'}
              </div>
            ) : (
              <div className="contents">
                {isPublished ? (
                  <div className="contents">
                    <EyeOff className="h-4 w-4 mr-2" />
                    Unpublish
                  </div>
                ) : (
                  <div className="contents">
                    <Eye className="h-4 w-4 mr-2" />
                    Publish to Client
                  </div>
                )}
              </div>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}