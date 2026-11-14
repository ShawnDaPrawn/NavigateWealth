import { Suspense, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { ChevronLeft, Loader2, MoreHorizontal, Plus, Trash2 } from 'lucide-react';
import { Button } from '../../../../../ui/button';
import { Input } from '../../../../../ui/input';
import { Label } from '../../../../../ui/label';
import { Tabs, TabsContent } from '../../../../../ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../../../../../ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../../../../../ui/dropdown-menu';
import {
  SegmentedList,
  SegmentedTrigger,
  FormErrorBanner,
  useConfirm,
  useUrlState,
} from '../../../../layout/page';
import {
  communicationApi,
  FilterBuilder,
  ManualSelection,
  type ClientGroup,
  type ExternalContact,
  type GroupFilterConfig,
  type GroupPreview,
} from '../../../communication';
import {
  GROUP_EDITOR_VIEWS,
  NEWSLETTER_GROUP_ID,
  formatGroupDate,
  groupKind,
  hasDynamicFilters,
  isValidEmail,
  matchCountLabel,
  GROUP_PREVIEW_DEBOUNCE_MS,
  type GroupEditorView,
} from './groupModel';
import { useGroupEditorOptions } from './useClientGroups';
import { Crumbs } from '../Crumbs';

interface GroupEditorPageProps {
  /** The group being edited, or null for a new group. */
  group: ClientGroup | null;
  /** Back to the Groups list. */
  onClose: () => void;
  /** Called after a save or delete so the list refreshes. */
  onChanged: () => Promise<unknown> | void;
}

/**
 * Create / edit a group as a full page (design: CM 16–19): details, then
 * Dynamic filters | Manual selection | External contacts, Cancel and Save in
 * the header, Delete under ⋯.
 */
export function GroupEditorPage({ group, onClose, onChanged }: GroupEditorPageProps) {
  const isNewsletter = group?.id === NEWSLETTER_GROUP_ID;
  const canDelete = !!group && group.type !== 'system' && !isNewsletter;
  const { clients, providers, loading } = useGroupEditorOptions();
  const { confirm, confirmDialog } = useConfirm();
  const [view, setView] = useUrlState<GroupEditorView>(
    'gview',
    isNewsletter ? 'contacts' : 'filters',
    GROUP_EDITOR_VIEWS,
  );
  const [name, setName] = useState(group?.name ?? '');
  const [description, setDescription] = useState(group?.description ?? '');
  const [selectedClientIds, setSelectedClientIds] = useState<string[]>(group?.clientIds ?? []);
  const [filterConfig, setFilterConfig] = useState<GroupFilterConfig>(group?.filterConfig ?? {});
  const [externalContacts, setExternalContacts] = useState<ExternalContact[]>(
    group?.externalContacts ?? [],
  );
  const [manualSearch, setManualSearch] = useState('');
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const nameError = !isNewsletter && !name.trim() ? 'Give the group a name' : undefined;
  const contactErrors = externalContacts.map((c) =>
    c.email.trim() && !isValidEmail(c.email) ? 'Enter a valid email address' : undefined,
  );
  const errorCount = (nameError ? 1 : 0) + contactErrors.filter(Boolean).length;

  const activeView: GroupEditorView = isNewsletter ? 'contacts' : view;
  const validContactCount = externalContacts.filter((c) => isValidEmail(c.email)).length;
  const dynamic = hasDynamicFilters(filterConfig);

  // Live count of who the rules match, refreshed shortly after each change.
  const [preview, setPreview] = useState<
    { state: 'idle' | 'loading' | 'error' } | { state: 'ready'; data: GroupPreview }
  >({ state: 'idle' });
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewToken, setPreviewToken] = useState(0);
  useEffect(() => {
    if (isNewsletter || !dynamic) {
      setPreview({ state: 'idle' });
      return;
    }
    let cancelled = false;
    setPreview({ state: 'loading' });
    const timer = window.setTimeout(() => {
      communicationApi
        .previewGroup(filterConfig)
        .then((data) => {
          if (!cancelled) setPreview({ state: 'ready', data });
        })
        .catch(() => {
          if (!cancelled) setPreview({ state: 'error' });
        });
    }, GROUP_PREVIEW_DEBOUNCE_MS);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [filterConfig, dynamic, isNewsletter, previewToken]);

  const subtitle = useMemo(() => {
    if (!group) return 'New group';
    const kind = groupKind(group);
    const label =
      kind === 'dynamic' ? 'Dynamic group' : kind === 'system' ? 'System group' : 'Manual group';
    const members = group.clientCount ?? 0;
    return `${label} · ${members} ${members === 1 ? 'member' : 'members'} · updated ${formatGroupDate(
      group.updatedAt || group.createdAt,
    )}`;
  }, [group]);

  const toggleClient = (id: string) =>
    setSelectedClientIds((prev) =>
      prev.includes(id) ? prev.filter((cid) => cid !== id) : [...prev, id],
    );

  const updateContact = (index: number, key: 'name' | 'email', value: string) =>
    setExternalContacts((prev) => prev.map((c, i) => (i === index ? { ...c, [key]: value } : c)));

  const handleSave = async () => {
    setSubmitAttempted(true);
    if (errorCount > 0) {
      if (contactErrors.some(Boolean) && !nameError) setView('contacts');
      // Focus the first field with a problem.
      window.setTimeout(() => {
        document
          .querySelector<HTMLElement>('main [aria-invalid="true"], [aria-invalid="true"]')
          ?.focus();
      }, 0);
      return;
    }
    const now = new Date().toISOString();
    const contacts = externalContacts
      .map((c) => ({
        email: c.email.trim().toLowerCase(),
        name: c.name?.trim() || undefined,
        source: c.source || (isNewsletter ? 'newsletter' : 'manual'),
        subscribedAt: c.subscribedAt || now,
      }))
      .filter((c) => isValidEmail(c.email));
    const payload: Partial<ClientGroup> = isNewsletter
      ? { externalContacts: contacts }
      : {
          name: name.trim(),
          description,
          type: group?.type || 'custom',
          clientIds: selectedClientIds,
          filterConfig,
          externalContacts: contacts,
          clientCount: selectedClientIds.length + contacts.length,
        };

    setSaving(true);
    try {
      if (group) {
        await communicationApi.updateGroup(group.id, payload);
        toast.success('Group updated');
      } else {
        await communicationApi.createGroup(payload);
        toast.success('Group created');
      }
      await onChanged();
      onClose();
    } catch (error) {
      console.error('Failed to save group:', error);
      toast.error('Could not save the group');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!group) return;
    const ok = await confirm({
      title: 'Delete group?',
      description: `You are about to permanently delete “${group.name}”. All client associations will be removed, but the clients themselves are not affected. This action cannot be undone.`,
      confirmLabel: 'Delete group',
      destructive: true,
    });
    if (!ok) return;
    setDeleting(true);
    try {
      await communicationApi.deleteGroup(group.id);
      toast.success('Group deleted');
      await onChanged();
      onClose();
    } catch (error) {
      console.error('Failed to delete group:', error);
      toast.error('Could not delete the group');
    } finally {
      setDeleting(false);
    }
  };

  const busy = saving || deleting;

  return (
    <div className="flex flex-col gap-6">
      <Crumbs
        trail={[
          { label: 'Groups', onClick: onClose },
          { label: group ? group.name : 'Create group' },
        ]}
      />
      <button
        type="button"
        onClick={onClose}
        className="inline-flex w-fit items-center gap-1 rounded text-sm text-nw-text-2 hover:text-nw-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nw-violet/60"
      >
        <ChevronLeft className="h-4 w-4" aria-hidden="true" />
        Groups
      </button>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-[26px] font-semibold leading-tight tracking-tight text-nw-ink">
            {group ? group.name : 'Create group'}
          </h1>
          <p className="mt-1 text-sm text-nw-text-3">{subtitle}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={() => void handleSave()} disabled={busy}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
            Save group
          </Button>
          {canDelete && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" aria-label="More actions" disabled={busy}>
                  <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  className="text-red-700 focus:text-red-700"
                  onClick={() => void handleDelete()}
                >
                  <Trash2 className="mr-2 h-4 w-4" aria-hidden="true" />
                  Delete group…
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </header>

      {submitAttempted && <FormErrorBanner count={errorCount} action="save the group" />}

      <section className="rounded-xl border border-nw-line bg-white p-5" aria-label="Group details">
        <h2 className="text-[15px] font-semibold text-nw-ink">Group details</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="group-name">Group name</Label>
            <Input
              id="group-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              readOnly={isNewsletter}
              placeholder="e.g. Gold tier clients"
              aria-invalid={submitAttempted && !!nameError}
              aria-describedby={submitAttempted && nameError ? 'group-name-error' : undefined}
              className={submitAttempted && nameError ? 'border-red-400' : undefined}
            />
            {submitAttempted && nameError && (
              <p id="group-name-error" className="text-xs text-red-700">
                {nameError}
              </p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="group-description">Description</Label>
            <Input
              id="group-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              readOnly={isNewsletter}
              placeholder="Optional"
            />
          </div>
        </div>
      </section>

      <Tabs
        value={activeView}
        onValueChange={(v) => setView(v as GroupEditorView)}
        className="flex flex-col gap-4"
      >
        <SegmentedList aria-label="Group members">
          {!isNewsletter && <SegmentedTrigger value="filters">Dynamic filters</SegmentedTrigger>}
          {!isNewsletter && (
            <SegmentedTrigger value="manual">
              Manual selection · {selectedClientIds.length}
            </SegmentedTrigger>
          )}
          <SegmentedTrigger value="contacts">
            External contacts · {externalContacts.length}
          </SegmentedTrigger>
        </SegmentedList>

        {!isNewsletter && (
          <TabsContent value="filters" className="mt-0 flex flex-col gap-4">
            <p className="text-sm text-nw-text-3">
              Clients matching these rules are included automatically. Ranges within a rule use OR
              logic.
            </p>
            <Suspense
              fallback={<div className="h-40 animate-pulse rounded-xl bg-muted" aria-busy="true" />}
            >
              <FilterBuilder
                filterConfig={filterConfig}
                onChange={setFilterConfig}
                providers={providers}
              />
            </Suspense>
          </TabsContent>
        )}

        {!isNewsletter && (
          <TabsContent value="manual" className="mt-0">
            {loading ? (
              <div className="h-40 animate-pulse rounded-xl bg-muted" aria-busy="true" />
            ) : (
              <Suspense
                fallback={
                  <div className="h-40 animate-pulse rounded-xl bg-muted" aria-busy="true" />
                }
              >
                <ManualSelection
                  clients={clients}
                  selectedIds={selectedClientIds}
                  onToggle={toggleClient}
                  searchTerm={manualSearch}
                  onSearchChange={setManualSearch}
                />
              </Suspense>
            )}
          </TabsContent>
        )}

        <TabsContent value="contacts" className="mt-0">
          <section
            className="rounded-xl border border-nw-line bg-white"
            aria-label="External contacts"
          >
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-nw-line-2 px-5 py-3">
              <div>
                <h2 className="text-[15px] font-semibold text-nw-ink">External contacts</h2>
                <p className="text-sm text-nw-text-3">
                  {isNewsletter
                    ? 'Newsletter contacts who aren’t clients. Changes update the newsletter audience.'
                    : 'People who aren’t clients but should receive this group’s messages.'}
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  setExternalContacts((prev) => [
                    ...prev,
                    {
                      email: '',
                      name: '',
                      source: isNewsletter ? 'newsletter' : 'manual',
                      subscribedAt: new Date().toISOString(),
                    },
                  ])
                }
              >
                <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                Add contact
              </Button>
            </div>
            {externalContacts.length === 0 ? (
              <p className="px-5 py-6 text-sm text-nw-text-3">
                No external contacts in this group yet.
              </p>
            ) : (
              <div className="divide-y divide-nw-line-2">
                <div className="grid grid-cols-[1fr_1fr_auto] gap-3 px-5 py-2 text-xs font-medium text-nw-text-3">
                  <span>Full name</span>
                  <span>Email</span>
                  <span className="sr-only">Actions</span>
                </div>
                {externalContacts.map((contact, index) => (
                  <div
                    key={index}
                    className="grid grid-cols-[1fr_1fr_auto] items-start gap-3 px-5 py-2"
                  >
                    <Input
                      aria-label={`Contact ${index + 1} name`}
                      value={contact.name || ''}
                      onChange={(e) => updateContact(index, 'name', e.target.value)}
                      placeholder="Full name"
                    />
                    <div className="space-y-1">
                      <Input
                        type="email"
                        aria-label={`Contact ${index + 1} email`}
                        value={contact.email}
                        onChange={(e) => updateContact(index, 'email', e.target.value)}
                        placeholder="name@example.com"
                        aria-invalid={submitAttempted && !!contactErrors[index]}
                        className={
                          submitAttempted && contactErrors[index] ? 'border-red-400' : undefined
                        }
                      />
                      {submitAttempted && contactErrors[index] && (
                        <p className="text-xs text-red-700">{contactErrors[index]}</p>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        setExternalContacts((prev) => prev.filter((_, i) => i !== index))
                      }
                    >
                      Remove
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </section>
        </TabsContent>
      </Tabs>

      {/* Member count bar: hand-picked and external, plus a live count of who
          the rules match (refreshed as the rules change, nothing saved). */}
      {!isNewsletter && (
        <div
          className="sticky bottom-0 flex flex-wrap items-center gap-3 rounded-xl border border-nw-line bg-white px-5 py-3 shadow-sm"
          aria-live="polite"
        >
          <span className="text-sm font-semibold text-nw-ink">
            {selectedClientIds.length} hand-picked · {validContactCount} external
          </span>
          <span className="text-sm text-nw-text-3">
            {!dynamic
              ? 'No dynamic rules set'
              : preview.state === 'ready'
                ? matchCountLabel(preview.data.count)
                : preview.state === 'error'
                  ? "Couldn't count the matches"
                  : 'Counting matches…'}
            {group ? ` · ${group.clientCount ?? 0} members now` : ''}
          </span>
          {preview.state === 'error' && (
            <Button variant="ghost" size="sm" onClick={() => setPreviewToken((n) => n + 1)}>
              Try again
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            className="ml-auto"
            disabled={preview.state !== 'ready'}
            onClick={() => setPreviewOpen(true)}
          >
            Preview list
          </Button>
        </div>
      )}
      {preview.state === 'ready' && (
        <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Who the rules match</DialogTitle>
              <DialogDescription>
                {matchCountLabel(preview.data.count)} right now
                {preview.data.count > preview.data.clients.length
                  ? ` (the first ${preview.data.clients.length} are listed)`
                  : ''}
                . Hand-picked clients and external contacts are added on top.
              </DialogDescription>
            </DialogHeader>
            {preview.data.clients.length === 0 ? (
              <p className="py-6 text-center text-sm text-nw-text-3">No clients match yet.</p>
            ) : (
              <ul className="max-h-80 divide-y overflow-y-auto rounded-lg border border-nw-line">
                {preview.data.clients.map((c) => (
                  <li key={c.id} className="flex items-center justify-between gap-3 px-3 py-2">
                    <span className="truncate text-sm text-nw-ink">{c.name}</span>
                    <span className="truncate text-xs text-nw-text-3">{c.email}</span>
                  </li>
                ))}
              </ul>
            )}
          </DialogContent>
        </Dialog>
      )}
      {confirmDialog}
    </div>
  );
}
