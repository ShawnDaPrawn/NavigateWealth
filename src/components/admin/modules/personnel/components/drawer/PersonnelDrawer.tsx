import React from 'react';
import { Avatar, AvatarFallback } from '../../../../../ui/avatar';
import { Badge } from '../../../../../ui/badge';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '../../../../../ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../../../../ui/tabs';
import { Mail } from 'lucide-react';
import { Personnel, ClientSummary } from '../../types';
import { TabProfile } from './TabProfile';
import { TabCompliance } from './TabCompliance';
import { TabCommission } from './TabCommission';
import { TabClientBook } from './TabClientBook';
import { TabPermissions } from './TabPermissions';
import { useCurrentUserPermissions } from '../../hooks/usePermissions';

interface PersonnelDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedPersonnel: Personnel | null;
  clients: ClientSummary[];
  clientsLoading: boolean;
  onTabChange: (value: string) => void;
  onUpload: (type: string) => void;
  onUpdate: (id: string, data: Partial<Personnel>) => Promise<boolean>;
  onInviteCancelled?: () => void;
}

export function PersonnelDrawer({
  open,
  onOpenChange,
  selectedPersonnel,
  clients,
  clientsLoading,
  onTabChange,
  onUpload,
  onUpdate,
  onInviteCancelled,
}: PersonnelDrawerProps) {
  const { canDo } = useCurrentUserPermissions();
  const canManagePermissions = canDo('personnel', 'manage_permissions');

  if (!selectedPersonnel) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[800px] sm:max-w-[800px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center justify-between">
            <div className="flex items-center gap-3">
               <Avatar className="h-12 w-12">
                <AvatarFallback className="text-lg">
                  {(selectedPersonnel.firstName?.[0] || '')}{(selectedPersonnel.lastName?.[0] || '')}
                </AvatarFallback>
              </Avatar>
              <div>
                <div className="text-xl">{selectedPersonnel.firstName} {selectedPersonnel.lastName}</div>
                <div className="text-sm text-muted-foreground font-normal flex items-center gap-2">
                  <Mail className="h-3 w-3" /> {selectedPersonnel.email}
                </div>
              </div>
            </div>
            <Badge variant={selectedPersonnel.status === 'active' ? 'default' : 'destructive'}>
              {selectedPersonnel.status}
            </Badge>
          </SheetTitle>
          <SheetDescription>
            Manage profile, compliance, and commission settings.
          </SheetDescription>
        </SheetHeader>

        <Tabs defaultValue="profile" className="mt-8" onValueChange={onTabChange}>
          <TabsList className={canManagePermissions ? "grid w-full grid-cols-5" : "grid w-full grid-cols-4"}>
            <TabsTrigger value="profile">Profile</TabsTrigger>
            {canManagePermissions && (
              <TabsTrigger value="permissions">Permissions</TabsTrigger>
            )}
            <TabsTrigger value="compliance">Compliance</TabsTrigger>
            <TabsTrigger value="commission">Commission</TabsTrigger>
            <TabsTrigger value="clients">Client Book</TabsTrigger>
          </TabsList>

          <TabsContent value="profile">
            <TabProfile selectedPersonnel={selectedPersonnel} onUpdate={onUpdate} onInviteCancelled={onInviteCancelled} />
          </TabsContent>

          {canManagePermissions && (
            <TabsContent value="permissions" className="mt-4">
              <TabPermissions selectedPersonnel={selectedPersonnel} />
            </TabsContent>
          )}

          <TabsContent value="compliance" className="mt-4">
            <TabCompliance selectedPersonnel={selectedPersonnel} onUpload={onUpload} />
          </TabsContent>

          <TabsContent value="commission" className="mt-4">
            <TabCommission selectedPersonnel={selectedPersonnel} />
          </TabsContent>

          <TabsContent value="clients" className="mt-4">
            <TabClientBook clients={clients} loading={clientsLoading} />
          </TabsContent>

        </Tabs>
      </SheetContent>
    </Sheet>
  );
}