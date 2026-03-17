/**
 * PolicyDetailModal
 * Shows full policy details and attached documents in a tabbed dialog.
 *
 * Documents tab fetches signed download URLs from the
 * /integrations/policy-documents/download endpoint.
 *
 * Guidelines refs: §7 (presentation), §8.3 (date format en-ZA)
 */

import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '../ui/dialog';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Separator } from '../ui/separator';
import { Card, CardContent } from '../ui/card';
import {
  X,
  Building2,
  FileText,
  Download,
  Loader2,
  File,
  FileImage,
  FileSpreadsheet,
  ExternalLink,
} from 'lucide-react';
import { formatCurrency } from '../../utils/currencyFormatter';
import { projectId, publicAnonKey } from '../../utils/supabase/info';
import { toast } from 'sonner@2.0.3';
import { getSupabaseClient } from '../../utils/supabase/client';

const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-91ed8379/integrations`;

interface PolicyField {
  id: string;
  name: string;
  type: string;
  value: unknown;
}

interface PolicyDocument {
  storageKey: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  provider: string;
  productType: string;
  documentType: string;
  uploadDate: string;
  uploadedBy: string;
}

interface PolicyDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  providerName: string;
  categoryName: string;
  fields: PolicyField[];
  themeColor?: 'purple' | 'blue' | 'green' | 'red' | 'orange' | 'indigo';
  /** Raw policy record — used to access document metadata */
  policyRecord?: Record<string, unknown>;
}

type TabId = 'details' | 'documents';

export function PolicyDetailModal({
  isOpen,
  onClose,
  providerName,
  categoryName,
  fields,
  themeColor = 'purple',
  policyRecord,
}: PolicyDetailModalProps) {
  const [activeTab, setActiveTab] = useState<TabId>('details');
  const [downloading, setDownloading] = useState(false);

  const themeStyles = {
    purple: {
      iconBg: 'bg-purple-50',
      iconText: 'text-purple-600',
      badgeBg: 'bg-purple-100',
      badgeText: 'text-purple-700',
    },
    blue: {
      iconBg: 'bg-blue-50',
      iconText: 'text-blue-600',
      badgeBg: 'bg-blue-100',
      badgeText: 'text-blue-700',
    },
    green: {
      iconBg: 'bg-green-50',
      iconText: 'text-green-600',
      badgeBg: 'bg-green-100',
      badgeText: 'text-green-700',
    },
    red: {
      iconBg: 'bg-rose-50',
      iconText: 'text-rose-600',
      badgeBg: 'bg-rose-100',
      badgeText: 'text-rose-700',
    },
    orange: {
      iconBg: 'bg-amber-50',
      iconText: 'text-amber-600',
      badgeBg: 'bg-amber-100',
      badgeText: 'text-amber-700',
    },
    indigo: {
      iconBg: 'bg-indigo-50',
      iconText: 'text-indigo-600',
      badgeBg: 'bg-indigo-100',
      badgeText: 'text-indigo-700',
    },
  };

  const currentTheme = themeStyles[themeColor];

  const formatValue = (type: string, value: unknown) => {
    if (value === null || value === undefined || value === '') return 'Not specified';
    switch (type) {
      case 'currency':
        return formatCurrency(Number(value));
      case 'percentage':
        return `${value}%`;
      case 'date':
      case 'date_inception':
        return new Date(String(value)).toLocaleDateString('en-ZA', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        });
      case 'boolean':
        return value ? 'Yes' : 'No';
      case 'number':
        return Number(value).toLocaleString();
      default:
        return String(value);
    }
  };

  const getProviderInitials = (name: string) =>
    name
      .split(' ')
      .map((word) => word[0])
      .join('')
      .substring(0, 2)
      .toUpperCase();

  const getProviderStyle = (name: string) => {
    const n = (name || '').toLowerCase();
    if (n.includes('discovery')) return { color: '#EC008C', bg: '#FFF0F8' };
    if (n.includes('liberty')) return { color: '#003DA5', bg: '#E6F0FF' };
    if (n.includes('old mutual')) return { color: '#006C44', bg: '#E6F5EF' };
    if (n.includes('sanlam')) return { color: '#0074C9', bg: '#F0F7FC' };
    if (n.includes('momentum')) return { color: '#C61E4A', bg: '#FDF2F5' };
    if (n.includes('brightrock')) return { color: '#FF6B00', bg: '#FFF3E6' };
    if (n.includes('allan gray')) return { color: '#666666', bg: '#F5F5F5' };
    return { color: '#6d28d9', bg: '#F5F0FF' };
  };

  const providerStyle = getProviderStyle(providerName);

  const primaryFields = fields.filter(
    (f) =>
      f.type === 'currency' ||
      f.name.toLowerCase().includes('policy') ||
      f.name.toLowerCase().includes('number') ||
      f.name.toLowerCase().includes('plan') ||
      f.name.toLowerCase().includes('type'),
  );
  const otherFields = fields.filter((f) => !primaryFields.includes(f));

  // ── Document helpers ──

  const document: PolicyDocument | null =
    (policyRecord?.document as PolicyDocument) || null;

  const policyId = policyRecord?.id as string | undefined;
  const clientId = policyRecord?.clientId as string | undefined;

  const getFileIcon = (mimeType: string) => {
    if (mimeType?.startsWith('image/')) return FileImage;
    if (mimeType?.includes('spreadsheet') || mimeType?.includes('excel')) return FileSpreadsheet;
    return File;
  };

  const formatFileSize = (bytes: number) => {
    if (!bytes) return 'Unknown size';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const DOCUMENT_TYPE_LABELS: Record<string, string> = {
    policy_schedule: 'Policy Schedule',
    amendment: 'Amendment',
    statement: 'Statement',
    benefit_summary: 'Benefit Summary',
    other: 'Other',
  };

  const handleDownload = async () => {
    if (!policyId || !clientId) {
      toast.error('Unable to download: missing policy information.');
      return;
    }

    setDownloading(true);
    try {
      const supabase = getSupabaseClient();
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token || publicAnonKey;

      const res = await fetch(
        `${API_BASE}/policy-documents/download?policyId=${policyId}&clientId=${clientId}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );

      if (!res.ok) {
        const errorBody = await res.text().catch(() => '');
        console.error('Document download failed:', res.status, errorBody);
        toast.error('Unable to download document. Please try again.');
        return;
      }

      const data = await res.json();
      if (data.url) {
        window.open(data.url, '_blank');
      } else {
        toast.error('Download URL not available.');
      }
    } catch (error) {
      console.error('Error downloading policy document:', error);
      toast.error('Unable to download document. Please try again.');
    } finally {
      setDownloading(false);
    }
  };

  const tabs: { id: TabId; label: string; count?: number }[] = [
    { id: 'details', label: 'Details' },
    { id: 'documents', label: 'Documents', count: document ? 1 : 0 },
  ];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-start justify-between mb-2">
            <div className="flex items-center gap-4">
              <div
                className="h-14 w-14 rounded-xl flex items-center justify-center border-2"
                style={{
                  borderColor: providerStyle.color + '40',
                  backgroundColor: providerStyle.bg,
                }}
              >
                <span className="text-lg font-bold" style={{ color: providerStyle.color }}>
                  {getProviderInitials(providerName)}
                </span>
              </div>
              <div>
                <DialogTitle className="text-2xl">{providerName}</DialogTitle>
                <DialogDescription className="mt-1 flex items-center gap-2">
                  <Badge
                    variant="outline"
                    className={`${currentTheme.badgeBg} ${currentTheme.badgeText} border-transparent`}
                  >
                    {categoryName}
                  </Badge>
                </DialogDescription>
              </div>
            </div>
          </div>
        </DialogHeader>

        {/* Tab Bar */}
        <div className="flex border-b border-gray-200 -mx-6 px-6 mb-4">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-purple-600 text-purple-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.label}
              {tab.count !== undefined && tab.count > 0 && (
                <Badge
                  variant="outline"
                  className="ml-1.5 h-5 px-1.5 text-[10px] border-gray-200 text-gray-500"
                >
                  {tab.count}
                </Badge>
              )}
            </button>
          ))}
        </div>

        {/* ── Details Tab ── */}
        {activeTab === 'details' && (
          <div className="contents">
            {/* Primary Information */}
            {primaryFields.length > 0 && (
              <div className="mb-6">
                <h3 className="text-sm font-semibold text-gray-900 mb-4 uppercase tracking-wide">
                  Key Details
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {primaryFields.map((field) => (
                    <Card key={field.id} className="border-gray-200 bg-gray-50/50">
                      <CardContent className="p-4">
                        <div className="flex flex-col">
                          <span className="text-xs text-gray-500 mb-1 uppercase tracking-wide">
                            {field.name}
                          </span>
                          <span
                            className={`${
                              field.type === 'currency'
                                ? 'text-xl font-semibold text-gray-900'
                                : 'text-base font-medium text-gray-900'
                            } ${
                              field.name.toLowerCase().includes('policy') ||
                              field.name.toLowerCase().includes('number')
                                ? 'font-mono text-sm'
                                : ''
                            }`}
                          >
                            {formatValue(field.type, field.value)}
                          </span>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {/* Additional Information */}
            {otherFields.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-gray-900 mb-4 uppercase tracking-wide">
                  Additional Information
                </h3>
                <Card className="border-gray-200">
                  <CardContent className="p-6">
                    <div className="space-y-4">
                      {otherFields.map((field, index) => (
                        <div key={field.id}>
                          <div className="flex justify-between items-start gap-4">
                            <span className="text-sm text-gray-600 flex-shrink-0">{field.name}</span>
                            <span
                              className={`text-sm text-right ${
                                field.type === 'long_text'
                                  ? 'text-gray-700 whitespace-pre-wrap max-w-md'
                                  : 'font-medium text-gray-900'
                              } ${
                                field.name.toLowerCase().includes('policy')
                                  ? 'font-mono text-xs'
                                  : ''
                              }`}
                            >
                              {formatValue(field.type, field.value)}
                            </span>
                          </div>
                          {index < otherFields.length - 1 && <Separator className="mt-4" />}
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </div>
        )}

        {/* ── Documents Tab ── */}
        {activeTab === 'documents' && (
          <div className="contents">
            {document ? (
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">
                  Attached Document
                </h3>
                <Card className="border-gray-200">
                  <CardContent className="p-5">
                    <div className="flex items-start gap-4">
                      <div className="h-12 w-12 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                        {React.createElement(getFileIcon(document.mimeType), {
                          className: 'h-6 w-6 text-gray-500',
                        })}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {document.fileName}
                        </p>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1">
                          <span className="text-xs text-gray-500">
                            {formatFileSize(document.fileSize)}
                          </span>
                          <span className="text-xs text-gray-300">|</span>
                          <Badge
                            variant="outline"
                            className="text-[10px] px-1.5 py-0 h-4 border-gray-200 text-gray-500"
                          >
                            {DOCUMENT_TYPE_LABELS[document.documentType] || document.documentType}
                          </Badge>
                          <span className="text-xs text-gray-300">|</span>
                          <span className="text-xs text-gray-500">
                            Uploaded{' '}
                            {new Date(document.uploadDate).toLocaleDateString('en-ZA', {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric',
                            })}
                          </span>
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleDownload}
                        disabled={downloading}
                        className="flex-shrink-0"
                      >
                        {downloading ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <div className="contents">
                            <Download className="h-4 w-4 mr-1.5" />
                            Download
                          </div>
                        )}
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                <p className="text-xs text-gray-400">
                  Documents are managed by your adviser. Contact them if you need additional policy
                  documents.
                </p>
              </div>
            ) : (
              <div className="py-12 text-center">
                <div className="h-14 w-14 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
                  <FileText className="h-7 w-7 text-gray-400" />
                </div>
                <p className="text-sm font-medium text-gray-700 mb-1">No Documents Attached</p>
                <p className="text-xs text-gray-500 max-w-sm mx-auto">
                  Your adviser has not yet uploaded a policy document for this policy. Contact them
                  to request your policy schedule.
                </p>
              </div>
            )}
          </div>
        )}

        <Separator className="my-6" />

        <div className="flex justify-between items-center">
          <p className="text-xs text-gray-500">For changes or updates, please contact your adviser</p>
          <Button onClick={onClose} variant="outline">
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
