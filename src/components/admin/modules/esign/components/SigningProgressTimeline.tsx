/**
 * SigningProgressTimeline
 * Visual timeline showing sequential/parallel signing progress.
 * Displays each signer's status, order, and signing time.
 */

import React from 'react';
import {
  CheckCircle2,
  Clock,
  XCircle,
  Send,
  Eye,
  ArrowRight,
  Users,
  Shuffle,
  ListOrdered,
} from 'lucide-react';
import { Badge } from '../../../../ui/badge';
import type { EsignSigner, EsignEnvelope, SigningMode } from '../types';

interface SigningProgressTimelineProps {
  envelope: EsignEnvelope;
  compact?: boolean;
}

const SIGNER_STATUS_CONFIG: Record<string, {
  icon: React.ReactNode;
  color: string;
  bgColor: string;
  lineColor: string;
  label: string;
}> = {
  signed: {
    icon: <CheckCircle2 className="h-5 w-5" />,
    color: 'text-green-600',
    bgColor: 'bg-green-100',
    lineColor: 'bg-green-400',
    label: 'Signed',
  },
  sent: {
    icon: <Send className="h-5 w-5" />,
    color: 'text-blue-600',
    bgColor: 'bg-blue-100',
    lineColor: 'bg-blue-300',
    label: 'Invited',
  },
  viewed: {
    icon: <Eye className="h-5 w-5" />,
    color: 'text-cyan-600',
    bgColor: 'bg-cyan-100',
    lineColor: 'bg-cyan-300',
    label: 'Viewed',
  },
  pending: {
    icon: <Clock className="h-5 w-5" />,
    color: 'text-gray-400',
    bgColor: 'bg-gray-100',
    lineColor: 'bg-gray-200',
    label: 'Pending',
  },
  declined: {
    icon: <XCircle className="h-5 w-5" />,
    color: 'text-red-600',
    bgColor: 'bg-red-100',
    lineColor: 'bg-red-300',
    label: 'Declined',
  },
  rejected: {
    icon: <XCircle className="h-5 w-5" />,
    color: 'text-red-600',
    bgColor: 'bg-red-100',
    lineColor: 'bg-red-300',
    label: 'Rejected',
  },
  otp_verified: {
    icon: <Eye className="h-5 w-5" />,
    color: 'text-cyan-600',
    bgColor: 'bg-cyan-100',
    lineColor: 'bg-cyan-300',
    label: 'OTP Verified',
  },
};

function formatTime(dateString?: string | null): string {
  if (!dateString) return '';
  try {
    return new Date(dateString).toLocaleString('en-ZA', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
}

export function SigningProgressTimeline({ envelope, compact = false }: SigningProgressTimelineProps) {
  const signers = [...(envelope.signers || [])].sort((a, b) => (a.order || 1) - (b.order || 1));
  const signingMode: SigningMode = envelope.signing_mode || 'sequential';
  const signedCount = signers.filter(s => s.status === 'signed').length;
  const totalSigners = signers.length;
  const percentComplete = totalSigners > 0 ? Math.round((signedCount / totalSigners) * 100) : 0;

  if (signers.length === 0) {
    return (
      <div className="text-center py-6 text-muted-foreground text-sm">
        <Users className="h-8 w-8 mx-auto mb-2 opacity-30" />
        No signers configured
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Mode badge and progress summary */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Badge
            variant="outline"
            className={`text-xs font-medium ${
              signingMode === 'sequential'
                ? 'border-purple-200 bg-purple-50 text-purple-700'
                : 'border-blue-200 bg-blue-50 text-blue-700'
            }`}
          >
            {signingMode === 'sequential' ? (
              <ListOrdered className="h-3 w-3 mr-1" />
            ) : (
              <Shuffle className="h-3 w-3 mr-1" />
            )}
            {signingMode === 'sequential' ? 'Sequential' : 'Parallel'}
          </Badge>
          <span className="text-sm text-muted-foreground">
            {signedCount} of {totalSigners} signed
          </span>
        </div>
        <span className="text-sm font-semibold text-purple-700">{percentComplete}%</span>
      </div>

      {/* Progress bar */}
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-purple-500 to-purple-600 rounded-full transition-all duration-500 ease-out"
          style={{ width: `${percentComplete}%` }}
        />
      </div>

      {/* Timeline */}
      <div className={`relative ${compact ? 'space-y-2' : 'space-y-0'}`}>
        {signers.map((signer, index) => {
          const config = SIGNER_STATUS_CONFIG[signer.status] || SIGNER_STATUS_CONFIG.pending;
          const isLast = index === signers.length - 1;
          const isCurrentTurn =
            signingMode === 'sequential' &&
            signer.status !== 'signed' &&
            signer.status !== 'declined' &&
            index === signers.findIndex(s => s.status !== 'signed' && s.status !== 'declined');

          return (
            <div key={signer.id} className="relative flex gap-3">
              {/* Vertical line connector */}
              {!isLast && !compact && (
                <div className="absolute left-[19px] top-[40px] bottom-0 w-0.5 z-0">
                  <div className={`w-full h-full ${config.lineColor}`} />
                </div>
              )}

              {/* Status icon */}
              <div className={`relative z-10 flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${config.bgColor} ${config.color} ${isCurrentTurn ? 'ring-2 ring-purple-400 ring-offset-2' : ''}`}>
                {config.icon}
              </div>

              {/* Content */}
              <div className={`flex-1 ${compact ? 'pb-0' : 'pb-6'} min-w-0`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm truncate">{signer.name}</span>
                      {isCurrentTurn && (
                        <Badge className="bg-purple-100 text-purple-700 border-purple-200 text-[10px] px-1.5 py-0">
                          Current
                        </Badge>
                      )}
                      {signingMode === 'sequential' && (
                        <span className="text-[10px] text-muted-foreground font-mono">
                          #{signer.order || index + 1}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground truncate">{signer.email}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Badge variant="outline" className={`text-[10px] ${config.color} border-current/20`}>
                      {config.label}
                    </Badge>
                  </div>
                </div>

                {/* Timestamp */}
                {signer.signed_at && (
                  <p className="text-[11px] text-muted-foreground mt-1">
                    Signed {formatTime(signer.signed_at)}
                  </p>
                )}

                {/* Arrow connector for sequential mode (compact view) */}
                {compact && !isLast && signingMode === 'sequential' && (
                  <div className="flex justify-center py-1">
                    <ArrowRight className="h-3 w-3 text-muted-foreground/40 rotate-90" />
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
