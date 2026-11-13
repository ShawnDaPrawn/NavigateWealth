import { useRef, useState } from 'react';
import { Avatar, AvatarFallback } from '../../../../../ui/avatar';
import { Badge } from '../../../../../ui/badge';
import { Button } from '../../../../../ui/button';
import { Tabs, TabsContent } from '../../../../../ui/tabs';
import { ChevronLeft, Mail, Save } from 'lucide-react';
import { NavTabsList, NavTabsTrigger } from '../../../../layout/page';
import { Personnel, ClientSummary } from '../../types';
import { PROFILE_FORM_ID, TabProfile, type ProfileFormState } from './TabProfile';
import { TabCompliance } from './TabCompliance';
import { TabCommission } from './TabCommission';
import { TabClientBook } from './TabClientBook';
import { TabPermissions } from './TabPermissions';
import { useCurrentUserPermissions } from '../../hooks/usePermissions';

interface PersonnelDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedPersonnel: Personnel | null;
  /** The open tab; the module owns it (the client book loads only when open). */
  activeTab: string;
  clients: ClientSummary[];
  clientsLoading: boolean;
  onTabChange: (value: string) => void;
  onUpdate: (id: string, data: Partial<Personnel>) => Promise<boolean>;
  onInviteCancelled?: () => void;
}

export function PersonnelDrawer({
  open,
  onOpenChange,
  selectedPersonnel,
  activeTab,
  clients,
  clientsLoading,
  onTabChange,
  onUpdate,
  onInviteCancelled,
}: PersonnelDrawerProps) {
  const { canDo } = useCurrentUserPermissions();
  const canManagePermissions = canDo('personnel', 'manage_permissions');
  const [profileForm, setProfileForm] = useState<ProfileFormState>({ dirty: false, saving: false });
  const [permissionsForm, setPermissionsForm] = useState<ProfileFormState>({
    dirty: false,
    saving: false,
  });
  // The Permissions tab hands its save over so the page header can run it.
  const savePermissionsRef = useRef<(() => void) | null>(null);

  if (!selectedPersonnel || !open) return null;

  // An address naming a tab this user cannot see falls back to Profile.
  const tab = activeTab === 'permissions' && !canManagePermissions ? 'profile' : activeTab;

  // A staff member is a page of its own (design system: records are pages).
  return (
    <div className="flex flex-col gap-4">
      <button
        type="button"
        onClick={() => onOpenChange(false)}
        className="inline-flex w-fit items-center gap-1 rounded text-sm text-nw-text-2 hover:text-nw-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nw-violet/60"
      >
        <ChevronLeft className="h-4 w-4" aria-hidden="true" />
        Back to personnel
      </button>
      <div>
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Avatar className="h-12 w-12">
              <AvatarFallback className="text-lg">
                {selectedPersonnel.firstName?.[0] || ''}
                {selectedPersonnel.lastName?.[0] || ''}
              </AvatarFallback>
            </Avatar>
            <div>
              <h1 className="text-[26px] leading-tight font-semibold tracking-tight text-nw-ink">
                {selectedPersonnel.firstName} {selectedPersonnel.lastName}
              </h1>
              <div className="text-sm text-muted-foreground font-normal flex items-center gap-2">
                <Mail className="h-3 w-3" aria-hidden="true" /> {selectedPersonnel.email}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={selectedPersonnel.status === 'active' ? 'default' : 'destructive'}>
              {selectedPersonnel.status}
            </Badge>
            {tab === 'profile' && (
              <Button
                type="submit"
                form={PROFILE_FORM_ID}
                disabled={!profileForm.dirty || profileForm.saving}
              >
                <Save className="h-4 w-4" aria-hidden="true" />
                {profileForm.saving ? 'Saving…' : 'Save'}
              </Button>
            )}
            {tab === 'permissions' && (
              <Button
                type="button"
                disabled={!permissionsForm.dirty || permissionsForm.saving}
                onClick={() => savePermissionsRef.current?.()}
              >
                <Save className="h-4 w-4" aria-hidden="true" />
                {permissionsForm.saving ? 'Saving…' : 'Save'}
              </Button>
            )}
          </div>
        </div>
        <p className="mt-2 text-sm text-nw-text-3">
          Manage profile, compliance and commission settings.
        </p>
      </div>

      <Tabs value={tab} className="gap-5" onValueChange={onTabChange}>
        <NavTabsList aria-label="Staff member">
          <NavTabsTrigger value="profile">Profile</NavTabsTrigger>
          {canManagePermissions && <NavTabsTrigger value="permissions">Permissions</NavTabsTrigger>}
          <NavTabsTrigger value="compliance">Compliance</NavTabsTrigger>
          <NavTabsTrigger value="commission">Commission</NavTabsTrigger>
          <NavTabsTrigger value="clients">Client book</NavTabsTrigger>
        </NavTabsList>

        <TabsContent value="profile">
          <TabProfile
            selectedPersonnel={selectedPersonnel}
            onUpdate={onUpdate}
            onInviteCancelled={onInviteCancelled}
            onFormStateChange={setProfileForm}
          />
        </TabsContent>

        {canManagePermissions && (
          <TabsContent value="permissions">
            <TabPermissions
              selectedPersonnel={selectedPersonnel}
              saveRef={savePermissionsRef}
              onFormStateChange={setPermissionsForm}
            />
          </TabsContent>
        )}

        <TabsContent value="compliance">
          <TabCompliance selectedPersonnel={selectedPersonnel} />
        </TabsContent>

        <TabsContent value="commission">
          <TabCommission selectedPersonnel={selectedPersonnel} />
        </TabsContent>

        <TabsContent value="clients">
          <TabClientBook clients={clients} loading={clientsLoading} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
