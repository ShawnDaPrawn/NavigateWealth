import { useState, useEffect, useCallback, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { useAuth } from '../auth/AuthContext';
import { BudgetingPage } from './BudgetingPage';

// Profile hook (Guidelines §6 — all state and handlers in a single hook)
import { useProfileManager } from './profile/hooks/useProfileManager';

// Section components (Guidelines §4.1 — decomposed presentation)
import {
  PersonalInfoSection,
  ContactDetailsSection,
  IdentitySection,
  AddressSection,
  EmploymentSection,
  HealthSection,
  FamilySection,
  BankingSection,
  AssetsLiabilitiesSection,
  RiskProfileSection,
} from './profile/sections';

// UI primitives — only those needed for the page shell
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../ui/alert-dialog';

// Icons — only those used in the page shell (nav, header, loading)
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
  CheckCircle,
  PieChart,
  Activity,
  Wallet,
  AlertTriangle,
} from 'lucide-react';
import { PortalPageHeader } from '../portal/PortalPageHeader';
import { ACTIVE_THEME } from '../portal/portal-theme';

// ============================================================================
// Navigation config
// ============================================================================

const NAV_ITEMS = [
  { id: 'personal', label: 'Personal Info', icon: User },
  { id: 'contact', label: 'Contact Details', icon: Mail },
  { id: 'identity', label: 'Identity', icon: Shield },
  { id: 'address', label: 'Address', icon: MapPin },
  { id: 'employment', label: 'Employment', icon: Briefcase },
  { id: 'health', label: 'Health Info', icon: Heart },
  { id: 'family', label: 'Family', icon: Users },
  { id: 'banking', label: 'Banking', icon: CreditCard },
  { id: 'risk', label: 'Risk Profile', icon: Target },
  { id: 'assets', label: 'Assets & Liabilities', icon: PieChart },
  { id: 'budgeting', label: 'Budgeting', icon: Wallet },
] as const;

// ============================================================================
// Component
// ============================================================================

export function ProfilePage() {
  const { user, updateUser } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [activeSection, setActiveSection] = useState('personal');
  const [isSavingBeforeLeave, setIsSavingBeforeLeave] = useState(false);

  // All profile state and handlers via custom hook (Guidelines §6)
  const pm = useProfileManager({
    userEmail: user?.email,
    userFirstName: user?.firstName,
    userLastName: user?.lastName,
    updateUser,
  });

  // Handle URL parameters to open specific tab
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const tab = params.get('tab');
    if (tab) {
      setActiveSection(tab);
    }
  }, [location]);

  // ── Browser tab/window close protection ─────────────────────────
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (pm.isDirty) {
        e.preventDefault();
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [pm.isDirty]);

  // ── Custom navigation guard ─────────────────────────────────────
  // WORKAROUND: useBlocker-data-router-incompatibility
  // `useBlocker` from react-router requires a data router (createBrowserRouter),
  // but this app uses BrowserRouter. This custom guard uses the popstate event
  // to intercept browser back/forward navigation when there are unsaved changes.
  // Proper fix: migrate to createBrowserRouter when feasible.
  const [navBlocked, setNavBlocked] = useState(false);
  const isDirtyRef = useRef(pm.isDirty);
  isDirtyRef.current = pm.isDirty;
  const pendingNavRef = useRef<number | null>(null);

  useEffect(() => {
    if (!pm.isDirty) return;

    // Push a duplicate history entry so we can catch the back navigation
    window.history.pushState({ profileGuard: true }, '');

    const handlePopState = (_e: PopStateEvent) => {
      if (isDirtyRef.current) {
        // Re-push to stay on the page and show the confirmation dialog
        window.history.pushState({ profileGuard: true }, '');
        setNavBlocked(true);
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [pm.isDirty]);

  // "Stay on Page" — dismiss the dialog
  const handleNavReset = useCallback(() => {
    setNavBlocked(false);
  }, []);

  // "Discard Changes" — allow the navigation to proceed
  const handleNavProceed = useCallback(() => {
    setNavBlocked(false);
    // Navigate back (pop the guard entry + the original back intent)
    navigate(-1);
  }, [navigate]);

  // "Save & Leave" — save first, then navigate
  const handleSaveAndProceed = useCallback(async () => {
    setIsSavingBeforeLeave(true);
    try {
      await pm.handleSave();
      setNavBlocked(false);
      navigate(-1);
    } catch {
      // Save failed — toast already shown by handleSave, stay on page
    } finally {
      setIsSavingBeforeLeave(false);
    }
  }, [pm.handleSave, navigate]);

  // ========================================================================
  // Render
  // ========================================================================

  if (pm.initialLoading) {
    return (
      <div className="min-h-screen bg-[rgb(243,244,246)] flex items-center justify-center" role="status" aria-label="Loading profile">
        <div className="text-center">
          <Activity className="h-12 w-12 animate-spin mx-auto text-[#6d28d9] mb-4" aria-hidden="true" />
          <h2 className="text-xl font-medium text-gray-900 mb-2">Loading Your Profile</h2>
          <p className="text-sm text-gray-600">Please wait while we fetch your information...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${ACTIVE_THEME === 'branded' ? 'bg-[#f8f9fb]' : 'bg-[rgb(249,249,249)]'}`}>
      <PortalPageHeader
        title="My Profile"
        subtitle="Manage your personal information and preferences"
        icon={User}
        compact
        actions={
          <div className="flex items-center gap-3">
            {pm.isDirty && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 text-amber-700 rounded-lg border border-amber-200 text-xs font-medium">
                <AlertTriangle className="h-3.5 w-3.5" />
                Unsaved changes
              </div>
            )}
            {pm.saveSuccess && (
              <div className="flex items-center gap-2 px-4 py-2 bg-green-50 text-green-700 rounded-lg border border-green-200 animate-in fade-in slide-in-from-top-2 duration-300">
                <CheckCircle className="h-4 w-4" />
                <span className="text-sm">Saved successfully</span>
              </div>
            )}
            <Button onClick={pm.handleSave} disabled={pm.isLoading} className="bg-[#6d28d9] hover:bg-[#5b21b6] text-white">
              {pm.isLoading ? (
                <div className="contents"><Activity className="h-4 w-4 mr-2 animate-spin" />Saving...</div>
              ) : (
                <div className="contents"><Save className="h-4 w-4 mr-2" />Save Changes</div>
              )}
            </Button>
          </div>
        }
      />
      <div className="mx-auto max-w-screen-2xl px-4 sm:px-6 lg:px-8 py-6 lg:py-8">

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Sidebar Navigation */}
          <div className="lg:col-span-1">
            <Card className="sticky top-6 hidden lg:block">
              <CardHeader className="pb-4">
                <CardTitle className="text-base">Quick Navigation</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <nav className="space-y-1">
                  {NAV_ITEMS.map((item) => {
                    const Icon = item.icon;
                    return (
                      <button
                        key={item.id}
                        onClick={() => setActiveSection(item.id)}
                        className={`w-full flex items-center gap-3 px-4 py-3 text-sm transition-colors ${
                          activeSection === item.id
                            ? 'bg-[#6d28d9]/10 text-[#6d28d9] border-r-2 border-[#6d28d9]'
                            : 'text-gray-700 hover:bg-gray-50'
                        }`}
                      >
                        <Icon className="h-4 w-4" />
                        <span className="text-[13px]">{item.label}</span>
                      </button>
                    );
                  })}
                </nav>
              </CardContent>
            </Card>

            {/* Mobile Navigation */}
            <div className="lg:hidden mb-4">
              <Select value={activeSection} onValueChange={setActiveSection}>
                <SelectTrigger className="w-full"><SelectValue placeholder="Select section" /></SelectTrigger>
                <SelectContent>
                  {NAV_ITEMS.map((item) => (
                    <SelectItem key={item.id} value={item.id}>{item.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Main Content — Decomposed Sections */}
          <div className="lg:col-span-3 space-y-6">
            {activeSection === 'personal' && (
              <PersonalInfoSection
                profileData={pm.profileData}
                handleInputChange={pm.handleInputChange}
                grossIncomeDisplay={pm.grossIncomeDisplay}
                setGrossIncomeDisplay={pm.setGrossIncomeDisplay}
                netIncomeDisplay={pm.netIncomeDisplay}
                setNetIncomeDisplay={pm.setNetIncomeDisplay}
                grossAnnualIncomeDisplay={pm.grossAnnualIncomeDisplay}
                setGrossAnnualIncomeDisplay={pm.setGrossAnnualIncomeDisplay}
                netAnnualIncomeDisplay={pm.netAnnualIncomeDisplay}
                setNetAnnualIncomeDisplay={pm.setNetAnnualIncomeDisplay}
                incomeValidationError={pm.incomeValidationError}
                setIncomeValidationError={pm.setIncomeValidationError}
                setProfileData={pm.setProfileData}
                setSaveSuccess={pm.setSaveSuccess}
              />
            )}

            {activeSection === 'contact' && (
              <ContactDetailsSection profileData={pm.profileData} handleInputChange={pm.handleInputChange} />
            )}

            {activeSection === 'identity' && (
              <IdentitySection
                profileData={pm.profileData}
                identityDocsInEditMode={pm.identityDocsInEditMode}
                identityDocToDelete={pm.identityDocToDelete}
                setIdentityDocToDelete={pm.setIdentityDocToDelete}
                hasDocumentType={pm.hasDocumentType}
                addIdentityDocument={pm.addIdentityDocument}
                updateIdentityDocument={pm.updateIdentityDocument}
                saveIdentityDocument={pm.saveIdentityDocument}
                editIdentityDocument={pm.editIdentityDocument}
                cancelEditIdentityDocument={pm.cancelEditIdentityDocument}
                confirmDeleteIdentityDocument={pm.confirmDeleteIdentityDocument}
                removeIdentityDocument={pm.removeIdentityDocument}
                handleDocumentUpload={pm.handleDocumentUpload}
                getDocumentTypeLabel={pm.getDocumentTypeLabel}
                getDocumentTypeIcon={pm.getDocumentTypeIcon}
              />
            )}

            {activeSection === 'address' && (
              <AddressSection
                profileData={pm.profileData}
                handleInputChange={pm.handleInputChange}
                proofOfResidenceInEditMode={pm.proofOfResidenceInEditMode}
                proofOfResidenceToDelete={pm.proofOfResidenceToDelete}
                setProofOfResidenceToDelete={pm.setProofOfResidenceToDelete}
                handleProofOfResidenceUpload={pm.handleProofOfResidenceUpload}
                editProofOfResidence={pm.editProofOfResidence}
                saveProofOfResidence={pm.saveProofOfResidence}
                confirmDeleteProofOfResidence={pm.confirmDeleteProofOfResidence}
                removeProofOfResidence={pm.removeProofOfResidence}
              />
            )}

            {activeSection === 'employment' && (
              <EmploymentSection
                profileData={pm.profileData}
                handleInputChange={pm.handleInputChange}
                employersInEditMode={pm.employersInEditMode}
                employerToDelete={pm.employerToDelete}
                setEmployerToDelete={pm.setEmployerToDelete}
                addEmployer={pm.addEmployer}
                updateEmployer={pm.updateEmployer}
                saveEmployer={pm.saveEmployer}
                editEmployer={pm.editEmployer}
                cancelEditEmployer={pm.cancelEditEmployer}
                confirmDeleteEmployer={pm.confirmDeleteEmployer}
                removeEmployer={pm.removeEmployer}
                selfEmployedInEditMode={pm.selfEmployedInEditMode}
                editSelfEmployed={pm.editSelfEmployed}
                saveSelfEmployed={pm.saveSelfEmployed}
                cancelEditSelfEmployed={pm.cancelEditSelfEmployed}
              />
            )}

            {activeSection === 'health' && (
              <HealthSection
                profileData={pm.profileData}
                handleInputChange={pm.handleInputChange}
                chronicConditionsInEditMode={pm.chronicConditionsInEditMode}
                chronicConditionToDelete={pm.chronicConditionToDelete}
                setChronicConditionToDelete={pm.setChronicConditionToDelete}
                addChronicCondition={pm.addChronicCondition}
                updateChronicCondition={pm.updateChronicCondition}
                saveChronicCondition={pm.saveChronicCondition}
                editChronicCondition={pm.editChronicCondition}
                cancelEditChronicCondition={pm.cancelEditChronicCondition}
                confirmDeleteChronicCondition={pm.confirmDeleteChronicCondition}
                removeChronicCondition={pm.removeChronicCondition}
              />
            )}

            {activeSection === 'family' && (
              <FamilySection
                profileData={pm.profileData}
                familyMembersInEditMode={pm.familyMembersInEditMode}
                familyMemberToDelete={pm.familyMemberToDelete}
                setFamilyMemberToDelete={pm.setFamilyMemberToDelete}
                addFamilyMember={pm.addFamilyMember}
                updateFamilyMember={pm.updateFamilyMember}
                saveFamilyMember={pm.saveFamilyMember}
                editFamilyMember={pm.editFamilyMember}
                cancelEditFamilyMember={pm.cancelEditFamilyMember}
                confirmDeleteFamilyMember={pm.confirmDeleteFamilyMember}
                removeFamilyMember={pm.removeFamilyMember}
              />
            )}

            {activeSection === 'banking' && (
              <BankingSection
                profileData={pm.profileData}
                bankAccountsInEditMode={pm.bankAccountsInEditMode}
                bankAccountToDelete={pm.bankAccountToDelete}
                setBankAccountToDelete={pm.setBankAccountToDelete}
                proofOfBankToDelete={pm.proofOfBankToDelete}
                setProofOfBankToDelete={pm.setProofOfBankToDelete}
                addBankAccount={pm.addBankAccount}
                updateBankAccount={pm.updateBankAccount}
                saveBankAccount={pm.saveBankAccount}
                editBankAccount={pm.editBankAccount}
                cancelEditBankAccount={pm.cancelEditBankAccount}
                confirmDeleteBankAccount={pm.confirmDeleteBankAccount}
                removeBankAccount={pm.removeBankAccount}
                handleProofOfBankUpload={pm.handleProofOfBankUpload}
                confirmDeleteProofOfBank={pm.confirmDeleteProofOfBank}
                removeProofOfBank={pm.removeProofOfBank}
              />
            )}

            {activeSection === 'assets' && (
              <AssetsLiabilitiesSection
                profileData={pm.profileData}
                assetsInEditMode={pm.assetsInEditMode}
                liabilitiesInEditMode={pm.liabilitiesInEditMode}
                assetToDelete={pm.assetToDelete}
                setAssetToDelete={pm.setAssetToDelete}
                liabilityToDelete={pm.liabilityToDelete}
                setLiabilityToDelete={pm.setLiabilityToDelete}
                assetDisplayValues={pm.assetDisplayValues}
                setAssetDisplayValues={pm.setAssetDisplayValues}
                liabilityDisplayValues={pm.liabilityDisplayValues}
                setLiabilityDisplayValues={pm.setLiabilityDisplayValues}
                addAsset={pm.addAsset}
                updateAsset={pm.updateAsset}
                saveAsset={pm.saveAsset}
                editAsset={pm.editAsset}
                cancelEditAsset={pm.cancelEditAsset}
                confirmDeleteAsset={pm.confirmDeleteAsset}
                removeAsset={pm.removeAsset}
                addLiability={pm.addLiability}
                updateLiability={pm.updateLiability}
                saveLiability={pm.saveLiability}
                editLiability={pm.editLiability}
                cancelEditLiability={pm.cancelEditLiability}
                confirmDeleteLiability={pm.confirmDeleteLiability}
                removeLiability={pm.removeLiability}
                totalAssets={pm.totalAssets}
                totalLiabilities={pm.totalLiabilities}
                netWorth={pm.netWorth}
              />
            )}

            {activeSection === 'risk' && (
              <RiskProfileSection
                profileData={pm.profileData}
                assessmentStarted={pm.assessmentStarted}
                setAssessmentStarted={pm.setAssessmentStarted}
                updateRiskQuestion={pm.updateRiskQuestion}
                resetRiskAssessment={pm.resetRiskAssessment}
                allQuestionsAnswered={pm.allQuestionsAnswered}
              />
            )}

            {activeSection === 'budgeting' && (
              <BudgetingPage
                netIncome={pm.profileData.netIncome}
                grossIncome={pm.profileData.grossIncome}
              />
            )}
          </div>
        </div>
      </div>

      {/* ── Unsaved Changes Dialog ─────────────────────────────────── */}
      <AlertDialog open={navBlocked}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <div className="flex items-center gap-3 mb-1">
              <div className="h-10 w-10 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <AlertDialogTitle className="text-lg text-gray-900">Unsaved Changes</AlertDialogTitle>
                <AlertDialogDescription className="text-sm text-gray-600 mt-1">
                  You have unsaved changes to your profile. Would you like to save before leaving?
                </AlertDialogDescription>
              </div>
            </div>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:gap-2">
            <AlertDialogCancel
              onClick={handleNavReset}
              className="border-gray-200 text-gray-700 hover:bg-gray-50"
            >
              Stay on Page
            </AlertDialogCancel>
            <Button
              variant="outline"
              onClick={handleNavProceed}
              className="border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
            >
              Discard Changes
            </Button>
            <AlertDialogAction
              onClick={handleSaveAndProceed}
              disabled={isSavingBeforeLeave}
              className="bg-[#6d28d9] hover:bg-[#5b21b6] text-white"
            >
              {isSavingBeforeLeave ? (
                <div className="contents"><Activity className="h-4 w-4 mr-2 animate-spin" />Saving...</div>
              ) : (
                <div className="contents"><Save className="h-4 w-4 mr-2" />Save & Leave</div>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}