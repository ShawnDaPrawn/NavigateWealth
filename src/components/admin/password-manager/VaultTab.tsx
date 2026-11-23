import { useMemo, useState } from 'react';
import { Plus, Upload } from 'lucide-react';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import {
  aiAccessLabels,
  credentialKinds,
  type AiAccess,
  type CredentialKind,
  type RevealedCredential,
  type VaultSummary,
} from '../../../shared/password-manager';
import { DsStat, DsStats, DsState } from '../layout/page/ds';
import type { VaultData } from './useVaultData';
import VaultRail from './VaultRail';
import VaultTable from './VaultTable';
import CollectionDialog from './CollectionDialog';
import CredentialPanel from './CredentialPanel';
import CredentialForm from './CredentialForm';
import ImportDialog from './ImportDialog';
import { filterItems, vaultStats, type VaultScope } from './vaultFilters';
import { ErrorLine, NativeSelect } from './ui';

type FormState = { mode: 'add' } | { mode: 'edit'; item: VaultSummary; secret: RevealedCredential };

export default function VaultTab({
  data,
  onOpenBrokerRuns,
}: {
  data: VaultData;
  onOpenBrokerRuns: (item: VaultSummary) => void;
}) {
  const { items, collections, directory, loading, error, reload } = data;
  const [scope, setScope] = useState<VaultScope>('all');
  const [search, setSearch] = useState('');
  const [kind, setKind] = useState<CredentialKind | ''>('');
  const [aiAccess, setAiAccess] = useState<AiAccess | ''>('');
  const [openId, setOpenId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState | null>(null);
  const [importing, setImporting] = useState(false);
  const [newCollection, setNewCollection] = useState(false);
  const [notice, setNotice] = useState('');
  const shown = useMemo(
    () => filterItems(items, { scope, search, kind, aiAccess }, directory),
    [items, scope, search, kind, aiAccess, directory],
  );
  const stats = vaultStats(items);
  const open = items.find((item) => item.id === openId) ?? null;
  const targetCollection = scope.startsWith('c:') ? scope.slice(2) : undefined;
  function done(message: string) {
    setNotice(message);
    reload();
  }

  return (
    <div className="mx-auto grid max-w-[1400px] gap-6 lg:grid-cols-[15rem_minmax(0,1fr)]">
      <VaultRail
        items={items}
        collections={collections}
        scope={scope}
        onScope={setScope}
        onNewCollection={() => setNewCollection(true)}
      />
      <div className="grid min-w-0 content-start gap-4">
        <DsStats className="max-md:grid-cols-2">
          <DsStat label="Logins" value={stats.logins} />
          <DsStat
            label="Need attention"
            value={stats.attention}
            selected={scope === 'v:attention'}
            onClick={() => setScope(scope === 'v:attention' ? 'all' : 'v:attention')}
          />
          <DsStat label="Readable by AI" value={stats.readable} />
          <DsStat
            label="Never shared"
            value={stats.never}
            selected={scope === 'v:never'}
            onClick={() => setScope(scope === 'v:never' ? 'all' : 'v:never')}
          />
        </DsStats>
        <div className="flex flex-wrap items-center gap-2">
          <Input
            aria-label="Search the vault"
            placeholder="Search by name, site, tag, broker or code"
            className="max-w-sm"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <NativeSelect
            aria-label="Type"
            className="w-auto"
            value={kind}
            onChange={(e) => setKind(e.target.value as CredentialKind | '')}
          >
            <option value="">All types</option>
            {(Object.keys(credentialKinds) as CredentialKind[]).map((k) => (
              <option key={k} value={k}>
                {credentialKinds[k]}
              </option>
            ))}
          </NativeSelect>
          <NativeSelect
            aria-label="AI access"
            className="w-auto"
            value={aiAccess}
            onChange={(e) => setAiAccess(e.target.value as AiAccess | '')}
          >
            <option value="">Any AI access</option>
            {(Object.keys(aiAccessLabels) as AiAccess[]).map((a) => (
              <option key={a} value={a}>
                {aiAccessLabels[a]}
              </option>
            ))}
          </NativeSelect>
          <div className="ml-auto flex gap-2">
            <Button variant="outline" onClick={() => setImporting(true)}>
              <Upload aria-hidden="true" />
              Import CSV
            </Button>
            <Button onClick={() => setForm({ mode: 'add' })}>
              <Plus aria-hidden="true" />
              Add credential
            </Button>
          </div>
        </div>
        {notice && (
          <p role="status" className="text-sm">
            {notice}
          </p>
        )}
        <ErrorLine>{error}</ErrorLine>
        {error && (
          <Button variant="outline" className="justify-self-start" onClick={reload}>
            Retry
          </Button>
        )}
        {loading && !items.length ? (
          <p role="status" className="text-sm text-muted-foreground">
            Loading…
          </p>
        ) : !items.length && !error ? (
          <DsState title="Your vault is empty">Add a login or import a CSV to get started.</DsState>
        ) : !shown.length && !error ? (
          <DsState title="Nothing matches">Change the search, filters or collection.</DsState>
        ) : (
          shown.length > 0 && (
            <div className="rounded-lg border bg-white">
              <VaultTable items={shown} collections={collections} onOpen={(i) => setOpenId(i.id)} />
            </div>
          )
        )}
      </div>
      {open && (
        <CredentialPanel
          item={open}
          collections={collections}
          onClose={() => setOpenId(null)}
          onChanged={reload}
          onDeleted={() => {
            setOpenId(null);
            done('Credential deleted.');
          }}
          onEdit={(secret) => setForm({ mode: 'edit', item: open, secret })}
          onRunBroker={() => onOpenBrokerRuns(open)}
        />
      )}
      {form && (
        <CredentialForm
          existing={form.mode === 'edit' ? form.secret : null}
          revision={form.mode === 'edit' ? form.item.revision : null}
          collections={collections}
          defaultCollectionId={targetCollection}
          onClose={() => setForm(null)}
          onSaved={() => {
            setForm(null);
            done('Credential saved.');
          }}
        />
      )}
      {importing && (
        <ImportDialog
          items={items}
          collections={collections}
          defaultCollectionId={targetCollection}
          onClose={() => setImporting(false)}
          onImported={(count) => {
            setImporting(false);
            done('Imported ' + count + ' credential' + (count === 1 ? '.' : 's.'));
          }}
        />
      )}
      {newCollection && (
        <CollectionDialog
          onClose={() => setNewCollection(false)}
          onCreated={(c) => {
            setNewCollection(false);
            setScope(`c:${c.id}`);
            done('Collection created.');
          }}
        />
      )}
    </div>
  );
}
