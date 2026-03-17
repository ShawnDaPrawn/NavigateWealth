/**
 * FNA Card Component
 * Reusable card for displaying FNA results with actions
 */

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../../../ui/card';
import { Button } from '../../../../ui/button';
import { Edit, Trash2, Eye } from 'lucide-react';
import { FNAStatusBadge } from './FNAStatusBadge';
import type { FNAConfig } from '../../../profile-sections/fna-config';

interface FNACardProps {
  fna: { id?: string; status?: string; createdAt?: string; updatedAt?: string; inputs?: Record<string, unknown>; results?: Record<string, unknown>; [key: string]: unknown };
  config: FNAConfig;
  onEdit: () => void;
  onDelete: () => void;
  onPublish: () => void;
  onView?: () => void; // New: View published FNA in dialog
}

export function FNACard({ fna, config, onEdit, onDelete, onPublish, onView }: FNACardProps) {
  return (
    <Card className="mt-4 border-2 border-primary/20">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                {config.name}
                {fna.status && (
                  <FNAStatusBadge status={fna.status} size="sm" />
                )}
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-1">
                {fna.status === 'published' 
                  ? `Published on ${new Date(fna.publishedAt || fna.createdAt).toLocaleDateString()}`
                  : `Created on ${new Date(fna.createdAt).toLocaleDateString()}`
                }
                {fna.version && ` • Version ${fna.version}`}
              </p>
            </div>
          </div>
          
          <div className="flex gap-2">
            {/* View Details Button */}
            {onView && (
              <Button
                variant="default"
                size="sm"
                onClick={onView}
              >
                <Eye className="h-4 w-4 mr-2" />
                View Details
              </Button>
            )}

            {/* Publish/Unpublish Button */}
            <Button
              variant="outline"
              size="sm"
              onClick={onPublish}
              className={
                fna.status === 'published'
                  ? 'border-orange-300 text-orange-700 hover:bg-orange-50'
                  : 'border-green-300 text-green-700 hover:bg-green-50'
              }
            >
              {fna.status === 'published' ? 'Unpublish' : 'Publish to Client'}
            </Button>

            {/* Edit Button */}
            <Button
              variant="outline"
              size="sm"
              onClick={onEdit}
            >
              <Edit className="h-4 w-4 mr-2" />
              Edit
            </Button>

            {/* Delete Button */}
            <Button
              variant="outline"
              size="sm"
              onClick={onDelete}
            >
              <Trash2 className="h-4 w-4 mr-2 text-red-600" />
              Delete
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        <div className="text-sm text-muted-foreground">
          <p>Latest analysis complete. Click "View Details" to see full recommendations.</p>
        </div>
      </CardContent>
    </Card>
  );
}