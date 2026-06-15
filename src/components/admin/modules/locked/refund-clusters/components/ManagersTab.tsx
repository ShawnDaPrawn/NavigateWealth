/**
 * Managers tab for an opened refund cluster.
 *
 * Lists the cluster's managers (people who run entity banking + eFiling) with
 * create / edit / delete actions. Managers are assigned to entities from the
 * entity form's "Entity Manager" selector.
 */

import { useState } from 'react';
import { Mail, Pencil, Phone, Plus, Trash2, UserCog } from 'lucide-react';
import { Badge } from '../../../../../ui/badge';
import { Button } from '../../../../../ui/button';
import { Card, CardContent } from '../../../../../ui/card';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../../../../../ui/alert-dialog';
import { Skeleton } from '../../../../../ui/skeleton';
import {
  useClusterManagers,
  useCreateManager,
  useDeleteManager,
  useUpdateManager,
} from '../hooks/useRefundClusters';
import type { RefundManager, RefundManagerInput } from '../types';
import { ManagerFormDialog } from './ManagerFormDialog';

export function ManagersTab({ clusterId }: { clusterId: string }) {
  const { data: managers = [], isLoading } = useClusterManagers(clusterId);
  const createManager = useCreateManager();
  const updateManager = useUpdateManager();
  const deleteManager = useDeleteManager();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<RefundManager | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<RefundManager | null>(null);

  const handleSubmit = (values: RefundManagerInput) => {
    if (editing) {
      updateManager.mutate(
        { clusterId, managerId: editing.id, manager: values },
        { onSuccess: () => setFormOpen(false) },
      );
    } else {
      createManager.mutate({ clusterId, manager: values }, { onSuccess: () => setFormOpen(false) });
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          People who run the banking and eFiling for this cluster&apos;s entities.
        </p>
        <Button
          onClick={() => {
            setEditing(null);
            setFormOpen(true);
          }}
        >
          <Plus className="h-4 w-4 mr-1" /> Add Manager
        </Button>
      </div>

      {managers.length === 0 ? (
        <div className="border border-dashed rounded-lg p-10 text-center text-sm text-muted-foreground">
          No managers yet. Click &quot;Add Manager&quot; to create one, then assign it to an entity.
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {managers.map((manager) => (
            <Card key={manager.id}>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <UserCog className="h-4 w-4 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium truncate">{manager.name}</p>
                      {manager.role && (
                        <p className="text-xs text-muted-foreground truncate">{manager.role}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label="Edit manager"
                      onClick={() => {
                        setEditing(manager);
                        setFormOpen(true);
                      }}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label="Delete manager"
                      onClick={() => setDeleteTarget(manager)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
                {(manager.email || manager.phone) && (
                  <div className="flex flex-wrap items-center gap-1.5">
                    {manager.email && (
                      <Badge variant="outline" className="gap-1">
                        <Mail className="h-3 w-3" />
                        {manager.email}
                      </Badge>
                    )}
                    {manager.phone && (
                      <Badge variant="outline" className="gap-1">
                        <Phone className="h-3 w-3" />
                        {manager.phone}
                      </Badge>
                    )}
                  </div>
                )}
                {manager.notes && (
                  <p className="text-xs text-muted-foreground whitespace-pre-wrap">
                    {manager.notes}
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <ManagerFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        manager={editing}
        onSubmit={handleSubmit}
        isSubmitting={createManager.isPending || updateManager.isPending}
      />

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete manager?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget &&
                `"${deleteTarget.name}" will be removed and unassigned from any entity. This action is audit-logged and cannot be undone.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteTarget) {
                  deleteManager.mutate({ clusterId, managerId: deleteTarget.id });
                }
                setDeleteTarget(null);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
