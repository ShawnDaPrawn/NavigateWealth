import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../../../../ui/card';
import { Badge } from '../../../../../ui/badge';
import { Button } from '../../../../../ui/button';
import {
  UserCheck,
  Shield,
  Landmark,
  Building2,
  MapPin,
  BarChart3,
  ClipboardList,
  History,
  Eye,
} from 'lucide-react';
import { Client } from '../../types';
import { ComplianceDashboardPanel } from './ComplianceDashboardPanel';
import { ComplianceResultViewer } from './ComplianceResultViewer';
import { StatCard, QuickActionCard } from './ComplianceShared';
import { ComplianceActivity, ComplianceSubTab } from './complianceTypes';
import { ActivityDetailSummary } from './ActivityDetailSummary';

interface OverviewContentProps {
  selectedClient: Client;
  honeycombId: string | null;
  resolvedIdNumber: string | null;
  resolvedPassport: string | null;
  hasIdentification: boolean;
  activities: ComplianceActivity[];
  isLoadingActivity: boolean;
  onNavigate: (tab: ComplianceSubTab) => void;
}

export function OverviewContent({
  selectedClient,
  honeycombId,
  resolvedIdNumber,
  resolvedPassport,
  hasIdentification,
  activities,
  onNavigate,
}: OverviewContentProps) {
  const [viewerActivity, setViewerActivity] = useState<ComplianceActivity | null>(null);

  const activityCounts = activities.reduce<Record<string, number>>((acc, a) => {
    acc[a.type] = (acc[a.type] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="space-y-4">
      {/* Quick stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard
          label="Total Checks"
          value={activities.length}
          icon={<BarChart3 className="h-4 w-4 text-purple-500" />}
        />
        <StatCard
          label="IDV Reports"
          value={activityCounts['IDV Report'] || 0}
          icon={<UserCheck className="h-4 w-4 text-blue-500" />}
        />
        <StatCard
          label="Sanctions Searches"
          value={activityCounts['Sanctions Search'] || 0}
          icon={<Shield className="h-4 w-4 text-purple-500" />}
        />
        <StatCard
          label="Risk Assessments"
          value={activityCounts['Risk Assessment'] || 0}
          icon={<ClipboardList className="h-4 w-4 text-green-500" />}
        />
      </div>

      {/* Compliance Dashboard */}
      <ComplianceDashboardPanel
        clientId={selectedClient.id}
        onNavigate={onNavigate as (tab: string) => void}
      />

      {/* Quick action cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <QuickActionCard
          title="Identity Verification"
          description="Run IDV checks via Honeycomb bureau integration"
          icon={<UserCheck className="h-5 w-5 text-blue-600" />}
          onClick={() => onNavigate('identity-verification')}
          disabled={!hasIdentification}
        />
        <QuickActionCard
          title="Sanctions Screening"
          description="Search OFAC, UN, EU and SA sanctions lists"
          icon={<Shield className="h-5 w-5 text-purple-600" />}
          onClick={() => onNavigate('screening-sanctions')}
        />
        <QuickActionCard
          title="Financial Intelligence"
          description="Bank verification, credit & consumer trace"
          icon={<Landmark className="h-5 w-5 text-green-600" />}
          onClick={() => onNavigate('financial-intelligence')}
          disabled={!hasIdentification}
        />
        <QuickActionCard
          title="Corporate & Governance"
          description="CIPC company search & director enquiry"
          icon={<Building2 className="h-5 w-5 text-purple-600" />}
          onClick={() => onNavigate('corporate-governance')}
          disabled={!hasIdentification}
        />
        <QuickActionCard
          title="Address"
          description="Best known address lookup"
          icon={<MapPin className="h-5 w-5 text-green-600" />}
          onClick={() => onNavigate('address-reports')}
          disabled={!hasIdentification}
        />
      </div>

      {/* Client identification summary */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-md font-medium">Client Identification</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-500">Honeycomb ID</span>
              <div className="font-mono text-xs bg-gray-100 px-2 py-1 rounded mt-1">
                {honeycombId || '—'}
              </div>
            </div>
            <div>
              <span className="text-gray-500">SA ID Number</span>
              <div className="mt-1">
                {resolvedIdNumber ? (
                  <Badge variant="outline" className="font-mono text-xs">
                    {resolvedIdNumber.substring(0, 6)}••••••
                    {resolvedIdNumber.substring(resolvedIdNumber.length - 1)}
                  </Badge>
                ) : (
                  <span className="text-xs text-gray-400">Not set</span>
                )}
              </div>
            </div>
            <div>
              <span className="text-gray-500">Passport</span>
              <div className="mt-1">
                {resolvedPassport ? (
                  <Badge variant="outline" className="font-mono text-xs">
                    {resolvedPassport.substring(0, 3)}•••
                  </Badge>
                ) : (
                  <span className="text-xs text-gray-400">Not set</span>
                )}
              </div>
            </div>
            <div>
              <span className="text-gray-500">Client Name</span>
              <div className="mt-1 font-medium text-sm">
                {selectedClient.firstName} {selectedClient.lastName}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Recent activity snapshot */}
      {activities.length > 0 && (
        <Card>
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <CardTitle className="text-md font-medium flex items-center gap-2">
              <History className="h-5 w-5 text-gray-500" />
              Recent Activity
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={() => onNavigate('activity-log')}>
              View All
            </Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {activities.slice(0, 5).map((activity) => (
                <button
                  key={activity.id}
                  onClick={() => setViewerActivity(activity)}
                  className="flex items-center justify-between p-2 rounded-lg bg-gray-50 text-sm w-full text-left hover:bg-gray-100 transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-xs">{activity.type}</span>
                    <ActivityDetailSummary activity={activity} />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500">
                      {new Date(activity.date).toLocaleDateString('en-ZA', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </span>
                    <Badge
                      variant="outline"
                      className="bg-green-50 text-green-700 border-green-200 text-xs"
                    >
                      {activity.status}
                    </Badge>
                    <Eye className="h-3.5 w-3.5 text-gray-400" />
                  </div>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <ComplianceResultViewer
        open={!!viewerActivity}
        onClose={() => setViewerActivity(null)}
        activity={viewerActivity}
        clientId={selectedClient.id}
        clientName={`${selectedClient.firstName} ${selectedClient.lastName}`}
      />
    </div>
  );
}
