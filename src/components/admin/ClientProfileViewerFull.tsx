/**
 * FULL CLIENT PROFILE VIEWER FOR ADMIN
 * Complete feature parity with client ProfilePage
 *
 * This component replicates ALL functionality from /components/pages/ProfilePage.tsx
 * including CRUD operations, validations, file uploads, risk assessment, and more.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Button } from '../ui/button';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';
import {
  formatCurrency,
  formatCurrencyInput,
  cleanCurrencyInput,
} from '../../utils/currencyFormatter';
import {
  User,
  Mail,
  MapPin,
  Briefcase,
  Heart,
  Users,
  CreditCard,
  Shield,
  Target,
  Save,
  PieChart,
  Wallet,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { AddressSection } from './profile-sections/AddressSection';
import { EmploymentSection } from './profile-sections/EmploymentSection';
import { HealthSection } from './profile-sections/HealthSection';
import { FamilySection } from './profile-sections/FamilySection';
import { BankingSection } from './profile-sections/BankingSection';
import { RiskProfileSection } from './profile-sections/RiskProfileSection';
import { AssetsLiabilitiesSection } from './profile-sections/AssetsLiabilitiesSection';
import { BudgetingPage } from '../pages/BudgetingPage';
import { IdentitySection } from './profile-sections/IdentitySection';
import { Client, ProfileData } from './modules/client-management/types';
import { useClientProfile } from './modules/client-management/hooks/useClientProfile';
import { copyToClipboard } from '../../utils/clipboard';
import { api } from '../../utils/api';
import {
  UnsavedChangesDialog,
  useUnsavedChangesGuard,
  useUnsavedChangesRegistry,
} from '../shared/unsaved-changes';
import {
  derivePolicyAssetsFromPolicies,
  type DerivedPolicyAsset,
  type PolicyAssetSourceRecord,
} from '../../utils/derivedPolicyAssets';

import { ClientProfilePersonalCard } from './ClientProfilePersonalCard';
import { ClientProfileContactCard } from './ClientProfileContactCard';

interface ClientProfileViewerFullProps {
  clientData: Client;
  onSave?: (data: ProfileData) => void;
}

const ADMIN_CLIENT_PROFILE_REGISTRY_ID = 'admin-client-profile';

export function ClientProfileViewerFull({ clientData, onSave }: ClientProfileViewerFullProps) {
  const [activeSection, setActiveSection] = useState('personal');
  const { state, actions } = useClientProfile(clientData, onSave);
  // The profile-section child components declare looser prop contracts
  // (profileData: Record<string, unknown>; handleInputChange: (field: string,
  // value: string | number | boolean) => void) than the strongly-typed hook
  // state/actions. Adapt at this single call boundary rather than weakening the
  // hook's types.
  const profileDataLoose = state.profileData as unknown as Record<string, unknown>;
  const handleInputChangeLoose = actions.handleInputChange as unknown as (
    field: string,
    value: unknown,
  ) => void;
  const registry = useUnsavedChangesRegistry();

  const unsavedChangesGuard = useUnsavedChangesGuard({
    isDirty: state.hasChanges,
    onSave: actions.handleSave,
    onDiscard: actions.handleDiscard,
    message:
      'You have unsaved changes to this client profile. Would you like to save before leaving?',
  });

  useEffect(() => {
    registry.register({
      id: ADMIN_CLIENT_PROFILE_REGISTRY_ID,
      isDirty: state.hasChanges,
      tryAction: unsavedChangesGuard.tryAction,
    });
    return () => registry.unregister(ADMIN_CLIENT_PROFILE_REGISTRY_ID);
  }, [registry, state.hasChanges, unsavedChangesGuard.tryAction]);

  const handleSectionChange = useCallback(
    (sectionId: string) => {
      if (sectionId === activeSection) return;
      unsavedChangesGuard.tryAction(() => setActiveSection(sectionId));
    },
    [activeSection, unsavedChangesGuard],
  );
  const [policyRecords, setPolicyRecords] = useState<PolicyAssetSourceRecord[]>([]);
  const [policyAssetsLoading, setPolicyAssetsLoading] = useState(false);
  const [policyAssetsError, setPolicyAssetsError] = useState<string | null>(null);

  // Local display state for currency inputs
  const [grossIncomeDisplay, setGrossIncomeDisplay] = useState<string | null>(null);
  const [netIncomeDisplay, setNetIncomeDisplay] = useState<string | null>(null);
  const [grossAnnualIncomeDisplay, setGrossAnnualIncomeDisplay] = useState<string | null>(null);
  const [netAnnualIncomeDisplay, setNetAnnualIncomeDisplay] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadPolicyAssets() {
      setPolicyAssetsLoading(true);
      setPolicyAssetsError(null);

      try {
        const response = await api.get<{ policies?: PolicyAssetSourceRecord[] }>(
          `/integrations/policies?clientId=${encodeURIComponent(clientData.id)}`,
        );

        if (!cancelled) {
          setPolicyRecords(Array.isArray(response.policies) ? response.policies : []);
        }
      } catch (_error) {
        if (!cancelled) {
          setPolicyRecords([]);
          setPolicyAssetsError('Linked policy assets could not be loaded right now.');
        }
      } finally {
        if (!cancelled) {
          setPolicyAssetsLoading(false);
        }
      }
    }

    void loadPolicyAssets();

    return () => {
      cancelled = true;
    };
  }, [clientData.id]);

  const derivedPolicyAssets = useMemo<DerivedPolicyAsset[]>(
    () => derivePolicyAssetsFromPolicies(policyRecords),
    [policyRecords],
  );

  const sections = [
    { id: 'personal', label: 'Personal Info', icon: User },
    { id: 'contact', label: 'Contact Details', icon: Mail },
    { id: 'kyc', label: 'KYC', icon: Shield },
    { id: 'address', label: 'Address', icon: MapPin },
    { id: 'employment', label: 'Employment', icon: Briefcase },
    { id: 'health', label: 'Health Info', icon: Heart },
    { id: 'family', label: 'Family', icon: Users },
    { id: 'banking', label: 'Banking', icon: CreditCard },
    { id: 'risk', label: 'Risk Profile', icon: Target },
    { id: 'assets', label: 'Assets & Liabilities', icon: PieChart },
    { id: 'budgeting', label: 'Budgeting', icon: Wallet },
  ];

  // Show loading state while fetching data
  if (state.loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-[#6d28d9] mb-3" />
          <p className="text-sm text-gray-600">Loading client profile...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* SUBTABS - Level 2: Secondary Navigation within Personal Details tab */}
      <div className="mb-6 pb-4 border-b border-gray-200">
        <div className="flex items-center gap-2 overflow-x-auto">
          {sections.map((section) => {
            const Icon = section.icon;
            return (
              <button
                key={section.id}
                onClick={() => handleSectionChange(section.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
                  activeSection === section.id
                    ? 'bg-white text-[#6d28d9] border-2 border-[#6d28d9] shadow-sm'
                    : 'bg-transparent text-gray-600 hover:bg-gray-100 border border-gray-300 hover:border-gray-400'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                <span>{section.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {state.error && (
        <Alert variant="destructive" className="mb-4">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      )}

      {state.hasChanges && (
        <div className="mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-yellow-500 animate-pulse"></div>
            <span className="text-sm font-medium text-yellow-900">You have unsaved changes</span>
          </div>
          <Button
            onClick={actions.handleSave}
            disabled={state.saving}
            className="bg-green-600 hover:bg-green-700"
          >
            {state.saving ? (
              <div className="contents">
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </div>
            ) : (
              <div className="contents">
                <Save className="h-4 w-4 mr-2" />
                Save Changes
              </div>
            )}
          </Button>
        </div>
      )}

      <div className="flex-1 overflow-y-auto pr-2">
        {/* Personal Information Section */}
        {activeSection === 'personal' && (
          <ClientProfilePersonalCard
            state={state}
            actions={actions}
            grossIncomeDisplay={grossIncomeDisplay}
            setGrossIncomeDisplay={setGrossIncomeDisplay}
            netIncomeDisplay={netIncomeDisplay}
            setNetIncomeDisplay={setNetIncomeDisplay}
            grossAnnualIncomeDisplay={grossAnnualIncomeDisplay}
            setGrossAnnualIncomeDisplay={setGrossAnnualIncomeDisplay}
            netAnnualIncomeDisplay={netAnnualIncomeDisplay}
            setNetAnnualIncomeDisplay={setNetAnnualIncomeDisplay}
          />
        )}

        {/* Contact Details Section */}
        {activeSection === 'contact' && (
          <ClientProfileContactCard state={state} actions={actions} />
        )}

        {/* KYC Section */}
        {activeSection === 'kyc' && (
          <IdentitySection
            profileData={profileDataLoose}
            identityDocsInEditMode={state.identityDocsInEditMode}
            hasDocumentType={actions.hasDocumentType}
            addIdentityDocument={actions.addIdentityDocument}
            handleDocumentUpload={actions.handleDocumentUpload}
            updateIdentityDocument={actions.updateIdentityDocument}
            confirmDeleteIdentityDocument={actions.confirmDeleteIdentityDocument}
            removeIdentityDocument={actions.removeIdentityDocument}
            saveIdentityDocument={actions.saveIdentityDocument}
            cancelEditIdentityDocument={actions.cancelEditIdentityDocument}
            editIdentityDocument={actions.editIdentityDocument}
            getDocumentTypeLabel={actions.getDocumentTypeLabel}
            getDocumentTypeIcon={actions.getDocumentTypeIcon}
            identityDocToDelete={state.identityDocToDelete}
            setIdentityDocToDelete={actions.setIdentityDocToDelete}
            userId={clientData.id}
          />
        )}

        {/* Address Section */}
        {activeSection === 'address' && (
          <AddressSection
            profileData={profileDataLoose}
            handleInputChange={handleInputChangeLoose}
            proofOfResidenceInEditMode={state.proofOfResidenceInEditMode}
            handleProofOfResidenceUpload={actions.handleProofOfResidenceUpload}
            saveProofOfResidence={actions.saveProofOfResidence}
            editProofOfResidence={actions.editProofOfResidence}
            confirmDeleteProofOfResidence={actions.confirmDeleteProofOfResidence}
            removeProofOfResidence={actions.removeProofOfResidence}
            proofOfResidenceToDelete={state.proofOfResidenceToDelete}
            setProofOfResidenceToDelete={actions.setProofOfResidenceToDelete}
            copyToClipboard={(text: string, _fieldName: string) => copyToClipboard(text)}
          />
        )}

        {/* Employment Section */}
        {activeSection === 'employment' && (
          <EmploymentSection
            profileData={profileDataLoose}
            handleInputChange={handleInputChangeLoose}
            employersInEditMode={state.employersInEditMode}
            selfEmployedInEditMode={state.selfEmployedInEditMode}
            addEmployer={actions.addEmployer}
            updateEmployer={actions.updateEmployer}
            saveEmployer={actions.saveEmployer}
            editEmployer={actions.editEmployer}
            cancelEditEmployer={actions.cancelEditEmployer}
            confirmDeleteEmployer={actions.confirmDeleteEmployer}
            removeEmployer={actions.removeEmployer}
            saveSelfEmployed={actions.saveSelfEmployed}
            editSelfEmployed={actions.editSelfEmployed}
            cancelEditSelfEmployed={actions.cancelEditSelfEmployed}
            employerToDelete={state.employerToDelete}
            setEmployerToDelete={actions.setEmployerToDelete}
            copyToClipboard={(text: string, _fieldName: string) => copyToClipboard(text)}
          />
        )}

        {/* Health Section */}
        {activeSection === 'health' && (
          <HealthSection
            profileData={profileDataLoose}
            handleInputChange={handleInputChangeLoose}
            chronicConditionsInEditMode={state.chronicConditionsInEditMode}
            addChronicCondition={actions.addChronicCondition}
            updateChronicCondition={actions.updateChronicCondition}
            saveChronicCondition={actions.saveChronicCondition}
            editChronicCondition={actions.editChronicCondition}
            cancelEditChronicCondition={actions.cancelEditChronicCondition}
            confirmDeleteChronicCondition={actions.confirmDeleteChronicCondition}
            removeChronicCondition={actions.removeChronicCondition}
            chronicConditionToDelete={state.chronicConditionToDelete}
            setChronicConditionToDelete={actions.setChronicConditionToDelete}
          />
        )}

        {/* Family Section */}
        {activeSection === 'family' && (
          <FamilySection
            profileData={profileDataLoose}
            familyMembersInEditMode={state.familyMembersInEditMode}
            addFamilyMember={actions.addFamilyMember}
            updateFamilyMember={actions.updateFamilyMember}
            saveFamilyMember={actions.saveFamilyMember}
            editFamilyMember={actions.editFamilyMember}
            cancelEditFamilyMember={actions.cancelEditFamilyMember}
            confirmDeleteFamilyMember={actions.confirmDeleteFamilyMember}
            removeFamilyMember={actions.removeFamilyMember}
            familyMemberToDelete={state.familyMemberToDelete}
            setFamilyMemberToDelete={actions.setFamilyMemberToDelete}
          />
        )}

        {/* Banking Section */}
        {activeSection === 'banking' && (
          <BankingSection
            profileData={profileDataLoose}
            bankAccountsInEditMode={state.bankAccountsInEditMode}
            addBankAccount={actions.addBankAccount}
            updateBankAccount={actions.updateBankAccount}
            saveBankAccount={actions.saveBankAccount}
            editBankAccount={actions.editBankAccount}
            cancelEditBankAccount={actions.cancelEditBankAccount}
            confirmDeleteBankAccount={actions.confirmDeleteBankAccount}
            removeBankAccount={actions.removeBankAccount}
            handleProofOfBankUpload={actions.handleProofOfBankUpload}
            confirmDeleteProofOfBank={actions.confirmDeleteProofOfBank}
            removeProofOfBank={actions.removeProofOfBank}
            bankAccountToDelete={state.bankAccountToDelete}
            setBankAccountToDelete={actions.setBankAccountToDelete}
            proofOfBankToDelete={state.proofOfBankToDelete}
            setProofOfBankToDelete={actions.setProofOfBankToDelete}
            copyToClipboard={(text: string, _fieldName: string) => copyToClipboard(text)}
          />
        )}

        {/* Risk Profile Section */}
        {activeSection === 'risk' && (
          <RiskProfileSection
            profileData={state.profileData}
            updateRiskQuestion={actions.updateRiskQuestion}
            resetRiskAssessment={actions.resetRiskAssessment}
            assessmentStarted={state.assessmentStarted}
            setAssessmentStarted={actions.setAssessmentStarted}
            allQuestionsAnswered={actions.allQuestionsAnswered}
          />
        )}

        {/* Assets & Liabilities Section */}
        {activeSection === 'assets' && (
          <AssetsLiabilitiesSection
            assets={state.profileData.assets || []}
            liabilities={state.profileData.liabilities || []}
            derivedPolicyAssets={derivedPolicyAssets}
            linkedPolicyAssetsLoading={policyAssetsLoading}
            linkedPolicyAssetsError={policyAssetsError}
            assetsInEditMode={state.assetsInEditMode}
            liabilitiesInEditMode={state.liabilitiesInEditMode}
            addAsset={actions.addAsset}
            updateAsset={actions.updateAsset}
            saveAsset={actions.saveAsset}
            editAsset={actions.editAsset}
            cancelEditAsset={actions.cancelEditAsset}
            confirmDeleteAsset={actions.confirmDeleteAsset}
            removeAsset={actions.removeAsset}
            addLiability={actions.addLiability}
            updateLiability={actions.updateLiability}
            saveLiability={actions.saveLiability}
            editLiability={actions.editLiability}
            cancelEditLiability={actions.cancelEditLiability}
            confirmDeleteLiability={actions.confirmDeleteLiability}
            removeLiability={actions.removeLiability}
            assetToDelete={state.assetToDelete}
            setAssetToDelete={actions.setAssetToDelete}
            liabilityToDelete={state.liabilityToDelete}
            setLiabilityToDelete={actions.setLiabilityToDelete}
            assetDisplayValues={state.assetDisplayValues}
            setAssetDisplayValues={actions.setAssetDisplayValues}
            liabilityDisplayValues={state.liabilityDisplayValues}
            setLiabilityDisplayValues={actions.setLiabilityDisplayValues}
            cleanCurrencyInput={cleanCurrencyInput}
            formatCurrencyInput={formatCurrencyInput}
            formatCurrency={formatCurrency}
          />
        )}

        {/* Budgeting Section - Reusing the BudgetingPage component */}
        {activeSection === 'budgeting' && (
          <div className="h-full">
            <BudgetingPage
              userId={clientData.id}
              embedded={true}
              onEmptyStateAction={() => handleSectionChange('personal')}
              incomeValidationError={state.incomeValidationError}
              setIncomeValidationError={
                actions.setIncomeValidationError as (error: string | null) => void
              }
              grossIncomeDisplay={state.grossIncomeDisplay ?? undefined}
              setGrossIncomeDisplay={actions.setGrossIncomeDisplay}
              netIncomeDisplay={state.netIncomeDisplay ?? undefined}
              setNetIncomeDisplay={actions.setNetIncomeDisplay}
              profileData={profileDataLoose}
              handleInputChange={handleInputChangeLoose}
            />
          </div>
        )}
      </div>
      <UnsavedChangesDialog {...unsavedChangesGuard.dialogProps} />
    </div>
  );
}
