/**
 * Admin view for manually unsubscribing contacts from communication campaigns.
 *
 * Unsubscribed people are skipped on campaign send. Direct 1:1 adviser
 * messages from client management are unchanged.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Loader2, MailX, RotateCcw, Search, UserMinus } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../../../../ui/button';
import { Input } from '../../../../ui/input';
import { Badge } from '../../../../ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../../ui/card';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../../../../ui/alert-dialog';
import { useSearchInputAutofillGuard } from '@/shared/forms/useSearchInputAutofillGuard';
import { communicationApi } from '../api';
import type { Client, UnsubscribedContact } from '../types';

interface UnsubscribeManagerProps {
  onClose: () => void;
}

function displayName(client: Client): string {
  return `${client.firstName || ''} ${client.surname || client.lastName || ''}`.trim() || 'Unknown';
}

function formatDate(value?: string): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function UnsubscribeManager({ onClose }: UnsubscribeManagerProps) {
  const searchGuard = useSearchInputAutofillGuard({ id: 'communication-unsubscribe-search' });
  const emailGuard = useSearchInputAutofillGuard({ id: 'communication-unsubscribe-email' });

  const [clients, setClients] = useState<Client[]>([]);
  const [unsubscribed, setUnsubscribed] = useState<UnsubscribedContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [emailInput, setEmailInput] = useState('');
  const [busyEmail, setBusyEmail] = useState<string | null>(null);
  const [confirmTarget, setConfirmTarget] = useState<{
    email: string;
    clientId?: string;
    name?: string;
  } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [fetchedClients, fetchedUnsubscribed] = await Promise.all([
        communicationApi.getClients(),
        communicationApi.getUnsubscribed(),
      ]);
      setClients(fetchedClients);
      setUnsubscribed(fetchedUnsubscribed);
    } catch (error) {
      console.error('Failed to load unsubscribe data', error);
      toast.error('Failed to load unsubscribed contacts');
      setClients([]);
      setUnsubscribed([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const unsubscribedEmails = useMemo(
    () => new Set(unsubscribed.map((row) => row.email.toLowerCase())),
    [unsubscribed],
  );

  const matchingClients = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (q.length < 2) return [];
    return clients
      .filter((client) => {
        const name = displayName(client).toLowerCase();
        const email = (client.email || '').toLowerCase();
        return name.includes(q) || email.includes(q);
      })
      .slice(0, 25);
  }, [clients, searchTerm]);

  const handleUnsubscribe = async (input: { email: string; clientId?: string; name?: string }) => {
    const email = input.email.trim().toLowerCase();
    if (!email.includes('@')) {
      toast.error('Enter a valid email address');
      return;
    }
    setBusyEmail(email);
    try {
      const result = await communicationApi.unsubscribeContact({
        email,
        clientId: input.clientId,
        name: input.name,
      });
      if (result.alreadyUnsubscribed) {
        toast.info(`${email} is already unsubscribed`);
      } else {
        toast.success(`${email} unsubscribed from communication`);
      }
      setEmailInput('');
      setConfirmTarget(null);
      await load();
    } catch (error) {
      console.error('Failed to unsubscribe contact', error);
      toast.error(error instanceof Error ? error.message : 'Failed to unsubscribe');
    } finally {
      setBusyEmail(null);
    }
  };

  const handleResubscribe = async (contact: UnsubscribedContact) => {
    setBusyEmail(contact.email);
    try {
      await communicationApi.resubscribeContact({
        email: contact.email,
        clientId: contact.clientId || undefined,
      });
      toast.success(`${contact.email} re-subscribed to communication`);
      await load();
    } catch (error) {
      console.error('Failed to re-subscribe contact', error);
      toast.error(error instanceof Error ? error.message : 'Failed to re-subscribe');
    } finally {
      setBusyEmail(null);
    }
  };

  return (
    <div className="space-y-6 p-6 max-w-[1600px] mx-auto">
      <div className="flex items-start justify-between gap-4">
        <div>
          <Button variant="ghost" onClick={onClose} className="gap-2 -ml-2 mb-2">
            <ArrowLeft className="h-4 w-4" />
            Back to Communication
          </Button>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <MailX className="h-7 w-7 text-primary" />
            Unsubscribed
          </h1>
          <p className="text-muted-foreground mt-1">
            Manually stop a person from receiving communication campaigns. They can still receive
            direct adviser messages.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Unsubscribe someone</CardTitle>
          <CardDescription>
            Search for a client, or enter any email address. They will be skipped on the next
            campaign send.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-[1fr_auto]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                {...searchGuard}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search clients by name or email"
                className="pl-10"
                aria-label="Search clients to unsubscribe"
              />
            </div>
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                setConfirmTarget({ email: emailInput.trim() });
              }}
            >
              <Input
                {...emailGuard}
                type="email"
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                placeholder="email@example.com"
                aria-label="Email to unsubscribe"
              />
              <Button type="submit" variant="outline" disabled={!emailInput.trim()}>
                <UserMinus className="h-4 w-4 mr-1.5" />
                Unsubscribe email
              </Button>
            </form>
          </div>

          {searchTerm.trim().length >= 2 && (
            <div className="border rounded-md overflow-hidden">
              {matchingClients.length === 0 ? (
                <p className="text-sm text-muted-foreground px-4 py-6 text-center">
                  No matching clients
                </p>
              ) : (
                <ul className="divide-y">
                  {matchingClients.map((client) => {
                    const email = (client.email || '').trim();
                    const optedOut =
                      !client.hasEmailOptIn || unsubscribedEmails.has(email.toLowerCase());
                    return (
                      <li
                        key={client.id}
                        className="flex items-center justify-between gap-3 px-4 py-3"
                      >
                        <div className="min-w-0">
                          <p className="font-medium text-sm truncate">{displayName(client)}</p>
                          <p className="text-xs text-muted-foreground truncate">
                            {email || 'No email address'}
                          </p>
                        </div>
                        {optedOut ? (
                          <Badge variant="secondary">Unsubscribed</Badge>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={!email || busyEmail === email.toLowerCase()}
                            onClick={() =>
                              setConfirmTarget({
                                email,
                                clientId: client.id,
                                name: displayName(client),
                              })
                            }
                          >
                            {busyEmail === email.toLowerCase() ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              'Unsubscribe'
                            )}
                          </Button>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Currently unsubscribed ({unsubscribed.length})</CardTitle>
          <CardDescription>
            These contacts are excluded from Communication Centre campaigns.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-purple-600" />
            </div>
          ) : unsubscribed.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              Nobody is manually unsubscribed yet.
            </p>
          ) : (
            <div className="border rounded-md overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-muted-foreground">
                  <tr>
                    <th className="text-left font-medium px-4 py-3">Name</th>
                    <th className="text-left font-medium px-4 py-3">Email</th>
                    <th className="text-left font-medium px-4 py-3">Unsubscribed</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {unsubscribed.map((contact) => (
                    <tr key={contact.email} className="border-t">
                      <td className="px-4 py-3">{contact.name || '—'}</td>
                      <td className="px-4 py-3">{contact.email}</td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {formatDate(contact.unsubscribedAt)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-green-600 hover:text-green-700 hover:bg-green-50"
                          disabled={busyEmail === contact.email}
                          onClick={() => handleResubscribe(contact)}
                        >
                          {busyEmail === contact.email ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                          ) : (
                            <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
                          )}
                          Re-subscribe
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={!!confirmTarget} onOpenChange={(open) => !open && setConfirmTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Unsubscribe from communication?</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmTarget?.name
                ? `${confirmTarget.name} (${confirmTarget.email})`
                : confirmTarget?.email}{' '}
              will stop receiving Communication Centre campaigns. Direct adviser messages are not
              affected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => confirmTarget && void handleUnsubscribe(confirmTarget)}
            >
              Unsubscribe
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
