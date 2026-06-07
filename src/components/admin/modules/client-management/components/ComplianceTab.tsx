import React, { useState, useEffect, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  Shield,
  UserCheck,
  Loader2,
  History,
  Landmark,
  Search,
  ClipboardList,
  Building2,
  MapPin,
  FileCheck,
} from 'lucide-react';
import { toast } from 'sonner';
import { api } from '../../../../../utils/api';

import { Client } from '../types';
import { getClientProfileQueryOptions } from '../api';
import { RiskAssessmentPanel } from './RiskAssessmentPanel';
import { IdentityVerificationPanel } from './compliance/IdentityVerificationPanel';
import { FinancialIntelligencePanel } from './compliance/FinancialIntelligencePanel';
import { SanctionsScreeningPanel } from './compliance/SanctionsScreeningPanel';
import { CorporateGovernancePanel } from './compliance/CorporateGovernancePanel';
import { AddressReportsPanel } from './compliance/AddressReportsPanel';
import { CDDPanel } from './compliance/CDDPanel';
import { OverviewContent } from './compliance/OverviewContent';
import { ActivityLogContent } from './compliance/ActivityLogContent';
import { ComplianceRegistrationGate } from './compliance/ComplianceRegistrationGate';
import { ComplianceActivity, ComplianceSubTab } from './compliance/complianceTypes';

interface ComplianceTabProps {
  selectedClient: Client;
  sanctionsScreeningRunning: boolean;
  onRunSanctionsScreening: () => void;
  lastSanctionsCheck: string;
}

const SUB_TABS: {
  id: ComplianceSubTab;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  { id: 'overview', label: 'Overview', icon: Shield },
  { id: 'identity-verification', label: 'Identity Verification', icon: UserCheck },
  { id: 'cdd', label: 'CDD', icon: FileCheck },
  { id: 'financial-intelligence', label: 'Financial Intelligence', icon: Landmark },
  { id: 'corporate-governance', label: 'Corporate & Governance', icon: Building2 },
  { id: 'screening-sanctions', label: 'Screening & Sanctions', icon: Search },
  { id: 'address-reports', label: 'Address', icon: MapPin },
  { id: 'risk-assessment', label: 'Risk Assessment', icon: ClipboardList },
  { id: 'activity-log', label: 'Reports', icon: History },
];

const isValidIdNumber = (val: unknown): val is string =>
  typeof val === 'string' &&
  val.trim().length > 0 &&
  !['not provided', 'n/a', 'undefined', 'null', 'none', '-'].includes(val.trim().toLowerCase());

export function ComplianceTab({ selectedClient }: ComplianceTabProps) {
  const queryClient = useQueryClient();
  const [registrationStatus, setRegistrationStatus] = useState<
    'loading' | 'registered' | 'unregistered'
  >('loading');
  const [isRegistering, setIsRegistering] = useState(false);
  const [honeycombId, setHoneycombId] = useState<string | null>(null);

  const [activities, setActivities] = useState<ComplianceActivity[]>([]);
  const [isLoadingActivity, setIsLoadingActivity] = useState(false);

  const [kvProfileIdNumber, setKvProfileIdNumber] = useState<string | null>(null);
  const [kvProfilePassport, setKvProfilePassport] = useState<string | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);

  const [activeSubTab, setActiveSubTab] = useState<ComplianceSubTab>('overview');

  useEffect(() => {
    const loadProfileForCompliance = async () => {
      setProfileLoading(true);
      try {
        const profile = await queryClient.fetchQuery(
          getClientProfileQueryOptions(selectedClient.id),
        );
        if (profile) {
          setKvProfileIdNumber(isValidIdNumber(profile.idNumber) ? profile.idNumber : null);
          setKvProfilePassport(
            isValidIdNumber(profile.passportNumber) ? profile.passportNumber : null,
          );
        } else {
          setKvProfileIdNumber(null);
          setKvProfilePassport(null);
        }
      } catch (err) {
        console.warn('[ComplianceTab] Could not fetch KV profile:', err);
        setKvProfileIdNumber(null);
        setKvProfilePassport(null);
      } finally {
        setProfileLoading(false);
      }
    };

    if (selectedClient.id) {
      loadProfileForCompliance();
    }
  }, [selectedClient.id, queryClient]);

  const resolvedIdNumber =
    [
      kvProfileIdNumber,
      selectedClient.profile?.personalInformation?.idNumber,
      (selectedClient.profile as Record<string, unknown>)?.profile_id_number,
      selectedClient.idNumber,
      (selectedClient as unknown as Record<string, unknown>).profile_id_number,
    ].find(isValidIdNumber) || null;

  const resolvedPassport =
    [
      kvProfilePassport,
      selectedClient.profile?.personalInformation?.passportNumber,
      (selectedClient.profile as Record<string, unknown>)?.passportNumber,
    ].find(isValidIdNumber) || null;

  const hasIdentification = !!resolvedIdNumber || !!resolvedPassport;

  const checkRegistration = useCallback(async () => {
    try {
      setRegistrationStatus('loading');
      const data = await api.get<{ registered?: boolean; honeycombId?: string }>(
        `/integrations/honeycomb/status/${selectedClient.id}`,
      );
      if (data.registered) {
        setRegistrationStatus('registered');
        setHoneycombId(data.honeycombId ?? null);
      } else {
        setRegistrationStatus('unregistered');
      }
    } catch (error) {
      console.error('Error checking registration:', error);
      setRegistrationStatus('unregistered');
    }
  }, [selectedClient.id]);

  const fetchActivityLog = useCallback(async () => {
    try {
      setIsLoadingActivity(true);
      const data = await api.get<{ activity?: ComplianceActivity[] }>(
        `/integrations/honeycomb/activity/${selectedClient.id}`,
      );
      setActivities(data.activity || []);
    } catch (error) {
      console.error('Error fetching activity:', error);
    } finally {
      setIsLoadingActivity(false);
    }
  }, [selectedClient.id]);

  useEffect(() => {
    checkRegistration();
  }, [selectedClient.id, checkRegistration]);

  useEffect(() => {
    if (registrationStatus === 'registered') {
      fetchActivityLog();
    }
  }, [registrationStatus, selectedClient.id, fetchActivityLog]);

  const handleRegister = async () => {
    setIsRegistering(true);
    const toastId = toast.loading('Registering client with Honeycomb/Beeswax...');

    try {
      const data = await api.post<{ honeycombId?: string }>(
        `/integrations/honeycomb/register-client`,
        {
          clientId: selectedClient.id,
          firstName: selectedClient.firstName,
          lastName: selectedClient.lastName,
          idNumber: resolvedIdNumber,
          passport: resolvedPassport,
          email: selectedClient.email,
        },
      );

      toast.success('Client registered successfully!', { id: toastId });
      setHoneycombId(data.honeycombId ?? null);
      setRegistrationStatus('registered');
    } catch (error: unknown) {
      console.error('Registration error:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to register client', {
        id: toastId,
      });
    } finally {
      setIsRegistering(false);
    }
  };

  if (registrationStatus === 'loading' || profileLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-purple-600" />
      </div>
    );
  }

  if (registrationStatus === 'unregistered') {
    return (
      <ComplianceRegistrationGate
        clientFirstName={selectedClient.firstName}
        clientLastName={selectedClient.lastName}
        resolvedIdNumber={resolvedIdNumber}
        hasIdentification={hasIdentification}
        isRegistering={isRegistering}
        onRegister={handleRegister}
      />
    );
  }

  // ─── Registered State (Sub-tab Navigation) ────────────────────────────

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium">Compliance Workspace</h3>
          <p className="text-sm text-muted-foreground flex items-center gap-2">
            Linked to Beeswax ID:{' '}
            <span className="font-mono text-xs bg-gray-100 px-1.5 py-0.5 rounded">
              {honeycombId}
            </span>
          </p>
        </div>
      </div>

      {/* SUBTABS - Level 2: Secondary Navigation */}
      <div className="pb-4 border-b border-gray-200">
        <div className="flex items-center gap-2 overflow-x-auto">
          {SUB_TABS.map((subtab) => {
            const Icon = subtab.icon;
            return (
              <button
                key={subtab.id}
                onClick={() => setActiveSubTab(subtab.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
                  activeSubTab === subtab.id
                    ? 'bg-white text-[#6d28d9] border-2 border-[#6d28d9] shadow-sm'
                    : 'bg-transparent text-gray-600 hover:bg-gray-100 border border-gray-300 hover:border-gray-400'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                <span>{subtab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ──── Sub-tab Content ──── */}

      {activeSubTab === 'overview' && (
        <OverviewContent
          selectedClient={selectedClient}
          honeycombId={honeycombId}
          resolvedIdNumber={resolvedIdNumber}
          resolvedPassport={resolvedPassport}
          hasIdentification={hasIdentification}
          activities={activities}
          isLoadingActivity={isLoadingActivity}
          onNavigate={setActiveSubTab}
        />
      )}

      {activeSubTab === 'identity-verification' && (
        <IdentityVerificationPanel
          clientId={selectedClient.id}
          firstName={selectedClient.firstName}
          lastName={selectedClient.lastName}
          idNumber={resolvedIdNumber}
          passport={resolvedPassport}
          hasIdentification={hasIdentification}
          onCheckComplete={fetchActivityLog}
        />
      )}

      {activeSubTab === 'cdd' && (
        <CDDPanel
          clientId={selectedClient.id}
          firstName={selectedClient.firstName}
          lastName={selectedClient.lastName}
          idNumber={resolvedIdNumber}
          passport={resolvedPassport}
          hasIdentification={hasIdentification}
          onCheckComplete={fetchActivityLog}
        />
      )}

      {activeSubTab === 'financial-intelligence' && (
        <FinancialIntelligencePanel
          clientId={selectedClient.id}
          firstName={selectedClient.firstName}
          lastName={selectedClient.lastName}
          idNumber={resolvedIdNumber}
          passport={resolvedPassport}
          hasIdentification={hasIdentification}
          onCheckComplete={fetchActivityLog}
        />
      )}

      {activeSubTab === 'screening-sanctions' && (
        <SanctionsScreeningPanel
          clientId={selectedClient.id}
          firstName={selectedClient.firstName}
          lastName={selectedClient.lastName}
          idNumber={resolvedIdNumber}
          passport={resolvedPassport}
          onCheckComplete={fetchActivityLog}
        />
      )}

      {activeSubTab === 'corporate-governance' && (
        <CorporateGovernancePanel
          clientId={selectedClient.id}
          firstName={selectedClient.firstName}
          lastName={selectedClient.lastName}
          idNumber={resolvedIdNumber}
          passport={resolvedPassport}
          hasIdentification={hasIdentification}
          onCheckComplete={fetchActivityLog}
        />
      )}

      {activeSubTab === 'address-reports' && (
        <AddressReportsPanel
          clientId={selectedClient.id}
          firstName={selectedClient.firstName}
          lastName={selectedClient.lastName}
          idNumber={resolvedIdNumber}
          passport={resolvedPassport}
          hasIdentification={hasIdentification}
          onCheckComplete={fetchActivityLog}
        />
      )}

      {activeSubTab === 'risk-assessment' && (
        <RiskAssessmentPanel
          clientId={selectedClient.id}
          clientFirstName={selectedClient.firstName}
          clientLastName={selectedClient.lastName}
          idNumber={resolvedIdNumber}
          passport={resolvedPassport}
          hasIdentification={hasIdentification}
        />
      )}

      {activeSubTab === 'activity-log' && (
        <ActivityLogContent
          activities={activities}
          isLoading={isLoadingActivity}
          onRefresh={fetchActivityLog}
          clientId={selectedClient.id}
          clientName={`${selectedClient.firstName} ${selectedClient.lastName}`}
        />
      )}
    </div>
  );
}
