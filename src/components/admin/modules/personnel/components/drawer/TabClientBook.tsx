import { useState } from 'react';
import { Button } from '../../../../../ui/button';
import { usePersonnel, useReassignPersonnelClients } from '../../hooks';
import { useCurrentUserPermissions } from '../../hooks/usePermissions';
import { Avatar, AvatarFallback } from '../../../../../ui/avatar';
import { Badge } from '../../../../../ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '../../../../../ui/card';
import { Checkbox } from '../../../../../ui/checkbox';
import { Label } from '../../../../../ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../../../../ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../../../ui/select';
import { Briefcase, Users } from 'lucide-react';
import { ClientSummary, Personnel } from '../../types';

interface TabClientBookProps {
  /** Whose client book this is. */
  personnelId: string;
  clients: ClientSummary[];
  loading: boolean;
}

/**
 * Assigned client book. The super admin can move some or all of the clients
 * to another active staff member (Bulk reassign).
 */
export function TabClientBook({ personnelId, clients, loading }: TabClientBookProps) {
  const { isSuperAdmin } = useCurrentUserPermissions();
  const { data: personnel = [] } = usePersonnel();
  const { mutate: reassign, isPending } = useReassignPersonnelClients();
  const [reassignOpen, setReassignOpen] = useState(false);
  const candidates = personnel.filter((p) => p.id !== personnelId && p.status === 'active');

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">Assigned client book</CardTitle>
          {isSuperAdmin && (
            <Button
              variant="outline"
              size="sm"
              disabled={loading || clients.length === 0 || candidates.length === 0}
              onClick={() => setReassignOpen(true)}
            >
              <Briefcase className="h-4 w-4" aria-hidden="true" />
              Bulk reassign
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="py-8 text-center" aria-busy="true">
              Loading clients…
            </div>
          ) : clients.length > 0 ? (
            <div className="space-y-2">
              {clients.map((client) => (
                <div
                  key={client.id}
                  className="flex items-center justify-between rounded border p-3 hover:bg-slate-50"
                >
                  <div className="flex items-center gap-3">
                    <Avatar className="h-8 w-8">
                      <AvatarFallback>{client.name[0]}</AvatarFallback>
                    </Avatar>
                    <div>
                      <div className="text-sm font-medium">{client.name}</div>
                      <div className="text-xs text-muted-foreground">{client.email}</div>
                    </div>
                  </div>
                  <Badge variant={client.status === 'approved' ? 'default' : 'outline'}>
                    {client.status}
                  </Badge>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-12 text-center text-muted-foreground">
              <Users className="mx-auto mb-4 h-12 w-12 opacity-20" aria-hidden="true" />
              <p>No clients currently assigned to this profile.</p>
            </div>
          )}
        </CardContent>
      </Card>
      {reassignOpen && (
        <ReassignClientsDialog
          open
          onOpenChange={setReassignOpen}
          clients={clients}
          candidates={candidates}
          submitting={isPending}
          onReassign={(toId, clientIds) =>
            reassign(
              { fromId: personnelId, toId, clientIds },
              { onSuccess: () => setReassignOpen(false) },
            )
          }
        />
      )}
    </>
  );
}

interface ReassignClientsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clients: ClientSummary[];
  /** Staff the clients can move to (the current owner excluded). */
  candidates: Personnel[];
  onReassign: (toPersonnelId: string, clientIds: string[]) => void;
  submitting?: boolean;
}

/** Bulk reassign clients (design: PE-Reassign). */
export function ReassignClientsDialog({
  open,
  onOpenChange,
  clients,
  candidates,
  onReassign,
  submitting = false,
}: ReassignClientsDialogProps) {
  const [target, setTarget] = useState('');
  const [selected, setSelected] = useState<Set<string>>(() => new Set(clients.map((c) => c.id)));
  const [error, setError] = useState<string | null>(null);

  const toggle = (id: string, checked: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const submit = () => {
    if (!target) {
      setError('Choose who the clients move to');
      return;
    }
    if (selected.size === 0) {
      setError('Select at least one client');
      return;
    }
    setError(null);
    onReassign(target, [...selected]);
  };

  const count = selected.size;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!submitting) onOpenChange(next);
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Bulk reassign clients</DialogTitle>
          <DialogDescription>Move the selected clients to another adviser.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="reassign-target">Reassign to</Label>
            <Select value={target} onValueChange={setTarget}>
              <SelectTrigger id="reassign-target">
                <SelectValue placeholder="Choose a staff member" />
              </SelectTrigger>
              <SelectContent>
                {candidates.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.firstName} {p.lastName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="max-h-64 divide-y overflow-y-auto rounded-lg border">
            {clients.map((client) => (
              <label
                key={client.id}
                className="flex cursor-pointer items-center justify-between gap-3 px-3 py-2"
              >
                <span className="flex items-center gap-3">
                  <Checkbox
                    checked={selected.has(client.id)}
                    onCheckedChange={(c) => toggle(client.id, c === true)}
                    aria-label={client.name}
                  />
                  <span className="text-sm">{client.name}</span>
                </span>
                <Badge variant="outline">{client.status}</Badge>
              </label>
            ))}
          </div>
          {error && (
            <p role="alert" className="text-sm text-red-600">
              {error}
            </p>
          )}
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            disabled={submitting}
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button type="button" disabled={submitting} onClick={submit}>
            Reassign {count} {count === 1 ? 'client' : 'clients'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
