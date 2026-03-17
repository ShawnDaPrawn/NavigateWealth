/**
 * Empty State Component
 * Displayed when no envelopes exist
 */

import React from 'react';
import { Card, CardContent } from '../../../../ui/card';
import { Button } from '../../../../ui/button';
import { FileText, Plus, Upload, FileSignature } from 'lucide-react';

interface EmptyStateProps {
  onUpload?: () => void;
  variant?: 'default' | 'compact';
}

export function EmptyState({ onUpload, variant = 'default' }: EmptyStateProps) {
  if (variant === 'compact') {
    return (
      <div className="text-center py-8 space-y-3">
        <FileText className="h-12 w-12 text-muted-foreground/30 mx-auto" />
        <div>
          <h3 className="font-semibold">No documents yet</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Upload a document to get started
          </p>
        </div>
        {onUpload && (
          <Button onClick={onUpload} className="bg-purple-600 hover:bg-purple-700 mt-2">
            <Plus className="h-4 w-4 mr-2" />
            Upload Document
          </Button>
        )}
      </div>
    );
  }

  return (
    <Card>
      <CardContent className="pt-12 pb-12">
        <div className="text-center space-y-6 max-w-md mx-auto">
          {/* Icon */}
          <div className="relative">
            <div className="absolute inset-0 bg-purple-100 rounded-full blur-3xl opacity-50" />
            <div className="relative bg-purple-50 rounded-full p-6 inline-block">
              <FileSignature className="h-16 w-16 text-purple-600" />
            </div>
          </div>

          {/* Content */}
          <div>
            <h3 className="text-xl font-semibold mb-2">
              No E-Signature Documents Yet
            </h3>
            <p className="text-muted-foreground">
              Upload documents to request electronic signatures from your clients. 
              Track signing progress and manage all documents in one place.
            </p>
          </div>

          {/* Features */}
          <div className="grid grid-cols-3 gap-4 text-left">
            <FeatureItem 
              icon={Upload}
              title="Upload PDF"
              description="Upload any PDF document"
            />
            <FeatureItem 
              icon={FileSignature}
              title="Add Signers"
              description="Invite people to sign"
            />
            <FeatureItem 
              icon={FileText}
              title="Track Progress"
              description="Monitor signing status"
            />
          </div>

          {/* CTA */}
          {onUpload && (
            <Button 
              onClick={onUpload} 
              className="bg-purple-600 hover:bg-purple-700"
              size="lg"
            >
              <Plus className="h-5 w-5 mr-2" />
              Upload Your First Document
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

interface FeatureItemProps {
  icon: React.ElementType;
  title: string;
  description: string;
}

function FeatureItem({ icon: Icon, title, description }: FeatureItemProps) {
  return (
    <div className="space-y-2">
      <div className="bg-purple-50 rounded-lg p-3 inline-block">
        <Icon className="h-5 w-5 text-purple-600" />
      </div>
      <div>
        <h4 className="font-medium text-sm">{title}</h4>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}
