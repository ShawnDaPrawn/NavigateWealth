/**
 * E-Signature Dashboard
 * The main landing view for the E-Signature module.
 * Provides high-level metrics, envelope management, and templates via tabs.
 */

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../../../ui/card';
import { Button } from '../../../../ui/button';
import { 
  FileText, 
  Plus, 
  Clock, 
  CheckCircle2, 
  List,
  Bookmark,
  TrendingUp,
  Timer,
  AlertCircle,
} from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../../../ui/tabs';
import { EnvelopesList } from './EnvelopesList';
import { TemplateLibrary } from './TemplateLibrary';
import type { EsignEnvelope, EsignTemplateRecord } from '../types';
import { useEnvelopes } from '../hooks/useEnvelopes';
import { EXPIRING_SOON_DAYS } from '../constants';

interface EsignDashboardProps {
  onCreateNew: () => void;
  onViewEnvelope: (envelope: EsignEnvelope) => void;
  onResumePrepare?: (envelope: EsignEnvelope) => void;
  resumingEnvelopeId?: string | null;
  onUseTemplate?: (template: EsignTemplateRecord) => void;
  refreshTrigger?: number;
}

export function EsignDashboard({ onCreateNew, onViewEnvelope, onResumePrepare, resumingEnvelopeId, onUseTemplate, refreshTrigger }: EsignDashboardProps) {
  const { envelopes, refetch } = useEnvelopes({ autoLoad: true, refreshTrigger });

  // Calculate metrics
  const now = new Date();
  const soonThreshold = new Date(now.getTime() + EXPIRING_SOON_DAYS * 24 * 60 * 60 * 1000);

  const metrics = {
    total: envelopes.length,
    completed: envelopes.filter(e => e.status === 'completed').length,
    pending: envelopes.filter(e => ['sent', 'viewed', 'partially_signed'].includes(e.status)).length,
    draft: envelopes.filter(e => e.status === 'draft').length,
    expired: envelopes.filter(e => e.status === 'expired').length,
    expiringSoon: envelopes.filter(e => {
      if (!['sent', 'viewed', 'partially_signed'].includes(e.status)) return false;
      const expiresAt = e.expires_at || e.expiresAt;
      if (!expiresAt) return false;
      const expDate = new Date(expiresAt);
      return expDate > now && expDate <= soonThreshold;
    }).length,
  };

  const completionRate = metrics.total > 0 
    ? Math.round((metrics.completed / (metrics.total - metrics.draft)) * 100) 
    : 0;

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">E-Signature Overview</h1>
          <p className="text-sm text-gray-500">Manage your documents and signature requests</p>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            onClick={onCreateNew}
            className="bg-purple-600 hover:bg-purple-700 text-white shadow-sm"
          >
            <Plus className="h-4 w-4 mr-2" />
            Start New Envelope
          </Button>
        </div>
      </div>

      {/* Expiring Soon Alert */}
      {metrics.expiringSoon > 0 && (
        <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-lg px-4 py-2.5">
          <AlertCircle className="h-4 w-4 text-amber-600 flex-shrink-0" />
          <span className="text-sm text-amber-800">
            <strong>{metrics.expiringSoon}</strong> envelope{metrics.expiringSoon > 1 ? 's' : ''} expiring within {EXPIRING_SOON_DAYS} days.
            Consider sending reminders. Expired envelopes are swept automatically.
          </span>
        </div>
      )}

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <Card>
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">Action Required</p>
              <h3 className="text-2xl font-bold text-gray-900 mt-1">{metrics.pending}</h3>
              <p className="text-xs text-orange-600 mt-1">Pending signatures</p>
            </div>
            <div className="h-10 w-10 bg-orange-100 rounded-lg flex items-center justify-center">
              <Clock className="h-5 w-5 text-orange-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">Completed</p>
              <h3 className="text-2xl font-bold text-gray-900 mt-1">{metrics.completed}</h3>
              <p className="text-xs text-green-600 mt-1">Fully signed</p>
            </div>
            <div className="h-10 w-10 bg-green-100 rounded-lg flex items-center justify-center">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">Drafts</p>
              <h3 className="text-2xl font-bold text-gray-900 mt-1">{metrics.draft}</h3>
              <p className="text-xs text-gray-500 mt-1">Not yet sent</p>
            </div>
            <div className="h-10 w-10 bg-gray-100 rounded-lg flex items-center justify-center">
              <FileText className="h-5 w-5 text-gray-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">Expired</p>
              <h3 className="text-2xl font-bold text-gray-900 mt-1">{metrics.expired}</h3>
              <p className="text-xs text-orange-600 mt-1">Past deadline</p>
            </div>
            <div className="h-10 w-10 bg-orange-50 rounded-lg flex items-center justify-center">
              <Timer className="h-5 w-5 text-orange-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">Completion Rate</p>
              <h3 className="text-2xl font-bold text-gray-900 mt-1">
                {isNaN(completionRate) ? 0 : completionRate}%
              </h3>
              <p className="text-xs text-blue-600 mt-1">Of sent envelopes</p>
            </div>
            <div className="h-10 w-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <TrendingUp className="h-5 w-5 text-blue-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabbed Content: Envelopes & Templates */}
      <Tabs defaultValue="envelopes" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="envelopes" className="gap-1.5">
            <List className="h-4 w-4" />
            Envelopes
          </TabsTrigger>
          <TabsTrigger value="templates" className="gap-1.5">
            <Bookmark className="h-4 w-4" />
            Templates
          </TabsTrigger>
        </TabsList>

        {/* Envelopes Tab */}
        <TabsContent value="envelopes" className="mt-0">
          <Card>
            <CardHeader>
              <CardTitle>Recent Envelopes</CardTitle>
              <CardDescription>View and manage all your envelope status and history</CardDescription>
            </CardHeader>
            <CardContent>
              <EnvelopesList 
                onViewEnvelope={onViewEnvelope} 
                onCreateNew={onCreateNew}
                onResumePrepare={onResumePrepare}
                resumingEnvelopeId={resumingEnvelopeId}
                refreshTrigger={refreshTrigger}
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Templates Tab */}
        <TabsContent value="templates" className="mt-0">
          <Card>
            <CardHeader>
              <CardTitle>Template Library</CardTitle>
              <CardDescription>Save and reuse envelope configurations across documents</CardDescription>
            </CardHeader>
            <CardContent>
              <TemplateLibrary
                onUseTemplate={(template) => onUseTemplate?.(template)}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}