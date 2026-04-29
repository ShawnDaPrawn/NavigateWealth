/**
 * Shared envelope row for admin Client Management E-Sign tab and client portal history.
 */

import React, { useState } from 'react';
import { Button } from '../../../../ui/button';
import { Badge } from '../../../../ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '../../../../ui/tooltip';
import {
  TableCell,
  TableRow,
} from '../../../../ui/table';
import {
  FileText,
  Eye,
  Download,
  Users,
  Trash2,
  Undo2,
  Loader2,
  Pencil,
  Award,
} from 'lucide-react';
import { toast } from 'sonner@2.0.3';
import { esignApi } from '../api';
import {
  formatEnvelopeDate,
  getDaysUntilExpiry,
  isExpiringSoon,
  getEnvelopeStatusColor,
  getEnvelopeStatusLabel,
} from '../types';
import { calculateSigningProgress } from '../utils/esignHelpers';
import type { EsignEnvelope } from '../types';

export interface EnvelopeManagementTableRowProps {
  envelope: EsignEnvelope;
  resuming?: boolean;
  /** When true, hides draft edit/delete/recall and admin recalls — portal read-only listing */
  portalReadOnly?: boolean;
  onRowClick: () => void;
  onView: () => void;
  onDownload: () => Promise<void>;
  onDelete: () => void;
  onRecall: () => void;
}

export function EnvelopeManagementTableRow({
  envelope,
  resuming = false,
  portalReadOnly = false,
  onRowClick,
  onView,
  onDownload,
  onDelete,
  onRecall,
}: EnvelopeManagementTableRowProps) {
  const progress = calculateSigningProgress(envelope);
  const daysUntilExpiry = getDaysUntilExpiry(envelope.expires_at);
  const expiringSoon = isExpiringSoon(envelope.expires_at);
  const isDraft = envelope.status === 'draft';
  const isPending = ['sent', 'viewed', 'partially_signed'].includes(envelope.status);
  const isCompleted = envelope.status === 'completed';

  const [downloadLoading, setDownloadLoading] = useState(false);
  const [certLoading, setCertLoading] = useState(false);

  const handleDownloadDocument = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setDownloadLoading(true);
    try { await onDownload(); } finally { setDownloadLoading(false); }
  };

  const handleDownloadCertificate = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setCertLoading(true);
    try {
      const response = await esignApi.getCertificateUrl(envelope.id);
      if (response.url) {
        window.open(response.url, '_blank', 'noopener,noreferrer');
      } else {
        toast.error('Certificate not available');
      }
    } catch (err: unknown) {
      console.error('Failed to download certificate:', err);
      const errObj = err as { status?: number; message?: string };
      if (errObj?.status === 404 || errObj?.message?.includes('not found')) {
        toast.error('Completion certificate has not been generated yet');
      } else {
        toast.error('Unable to download certificate. Please try again.');
      }
    } finally {
      setCertLoading(false);
    }
  };

  return (
    <TableRow
      className="cursor-pointer"
      onClick={(e) => {
        if ((e.target as HTMLElement).closest('button')) return;
        onRowClick();
      }}
    >
      <TableCell className="pl-4">
        <div className="flex items-center gap-3">
          <div className="p-1.5 rounded-md bg-gray-50">
            {resuming ? (
              <Loader2 className="h-4 w-4 animate-spin text-purple-600" />
            ) : (
              <FileText className="h-4 w-4 text-muted-foreground" />
            )}
          </div>
          <div className="min-w-0">
            <p className="font-medium text-sm truncate max-w-[220px]">{envelope.title}</p>
            <p className="text-xs text-muted-foreground">
              {formatEnvelopeDate(envelope.created_at)}
            </p>
          </div>
        </div>
      </TableCell>

      <TableCell>
        <Badge className={`${getEnvelopeStatusColor(envelope.status)} text-xs font-medium px-2 py-0.5`}>
          {getEnvelopeStatusLabel(envelope.status)}
        </Badge>
      </TableCell>

      <TableCell>
        {isDraft ? (
          <span className="text-xs text-muted-foreground">--</span>
        ) : (
          <div className="flex items-center gap-2 min-w-[100px]">
            <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-300 ${
                  progress.isComplete
                    ? 'bg-green-500'
                    : progress.percentComplete > 0
                    ? 'bg-blue-500'
                    : 'bg-gray-300'
                }`}
                style={{ width: `${progress.percentComplete}%` }}
              />
            </div>
            <span className="text-xs text-muted-foreground whitespace-nowrap">
              {progress.signedCount}/{progress.totalSigners}
            </span>
          </div>
        )}
      </TableCell>

      <TableCell>
        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <Users className="h-3.5 w-3.5" />
          <span>{envelope.totalSigners || progress.totalSigners || 0}</span>
        </div>
      </TableCell>

      <TableCell>
        {envelope.expires_at ? (
          <span
            className={`text-xs ${
              expiringSoon
                ? 'text-amber-600 font-medium'
                : daysUntilExpiry !== null && daysUntilExpiry <= 0
                ? 'text-red-600 font-medium'
                : 'text-muted-foreground'
            }`}
          >
            {daysUntilExpiry !== null && daysUntilExpiry > 0 ? `${daysUntilExpiry}d` : 'Expired'}
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">--</span>
        )}
      </TableCell>

      <TableCell className="text-right pr-4">
        <div className="flex items-center justify-end gap-1">
          {isDraft && !portalReadOnly && (
            <div className="contents">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8"
                    onClick={(e) => { e.stopPropagation(); onRowClick(); }}
                    aria-label="Continue editing"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Continue Editing</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-50"
                    onClick={(e) => { e.stopPropagation(); onDelete(); }}
                    aria-label="Delete envelope"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Delete</TooltipContent>
              </Tooltip>
            </div>
          )}

          {isPending && !portalReadOnly && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 text-amber-500 hover:text-amber-600 hover:bg-amber-50"
                  onClick={(e) => { e.stopPropagation(); onRecall(); }}
                  aria-label="Recall envelope"
                >
                  <Undo2 className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Recall</TooltipContent>
            </Tooltip>
          )}

          {isCompleted && (
            <div className="contents">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8"
                    onClick={handleDownloadDocument}
                    disabled={downloadLoading}
                    aria-label="Download PDF"
                  >
                    {downloadLoading ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Download className="h-3.5 w-3.5" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Download PDF</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8"
                    onClick={handleDownloadCertificate}
                    disabled={certLoading}
                    aria-label="Download certificate"
                  >
                    {certLoading ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Award className="h-3.5 w-3.5" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Certificate</TooltipContent>
              </Tooltip>
            </div>
          )}

          {!isDraft && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8"
                  onClick={(e) => { e.stopPropagation(); onView(); }}
                  aria-label="View details"
                >
                  <Eye className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>View Details</TooltipContent>
            </Tooltip>
          )}
        </div>
      </TableCell>
    </TableRow>
  );
}
