import { useState } from 'react';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { api } from '../../../utils/api/client';
import { ops, options } from './portalApi';
import {
  providers,
  selectorFields,
  type Workflow,
  type Provider,
  type Selectors,
} from '../../../shared/broker-operations';

const labels: Record<keyof Selectors, string> = {
  username: 'Username input',
  password: 'Password input',
  submit: 'Sign-in button',
  identity: 'Signed-in account label',
  brokerSelect: 'Broker dropdown (optional)',
  brokerCode: 'Current broker code',
  monthSelect: 'Statement month dropdown',
  reportRow: 'Statement table rows',
  rowBroker: 'Broker code inside row',
  rowMonth: 'Month inside row',
  documentLink: 'PDF link inside row',
  emptyState: 'Provider’s empty results message',
};
export default function PortalWorkflows({
  flows,
  onSave,
  loginDefaults,
}: {
  flows: Workflow[];
  loginDefaults: Record<Provider, Pick<Selectors, 'username' | 'password' | 'submit'>>;
  onSave: () => void;
}) {
  const [draft, setDraft] = useState<Workflow | null>(null),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  function create() {
    setDraft({
      id: '',
      provider: 'allan-gray',
      kind: 'test_login',
      name: '',
      selectors: {
        ...Object.fromEntries(selectorFields.map((k) => [k, ''])),
        ...loginDefaults['allan-gray'],
      } as Selectors,
    });
  }
  return draft ? (
    <form
      className="space-y-3"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError('');
        try {
          const { id, ...data } = draft;
          if (id) await api.put(ops + '/workflows/' + id, data, options);
          else await api.post(ops + '/workflows', data, options);
          setDraft(null);
          onSave();
        } catch {
          setError('Could not save. Check the required selectors.');
        } finally {
          setBusy(false);
        }
      }}
    >
      <label className="grid gap-1">
        Workflow name
        <Input
          required
          value={draft.name}
          onChange={(e) => setDraft({ ...draft, name: e.target.value })}
        />
      </label>
      <label className="grid gap-1">
        Provider
        <select
          value={draft.provider}
          onChange={(e) =>
            setDraft({
              ...draft,
              provider: e.target.value as Provider,
              selectors: { ...draft.selectors, ...loginDefaults[e.target.value as Provider] },
            })
          }
        >
          {Object.entries(providers).map(([k, p]) => (
            <option key={k} value={k}>
              {p.name}
            </option>
          ))}
        </select>
      </label>
      <label className="grid gap-1">
        Task
        <select
          value={draft.kind}
          onChange={(e) => setDraft({ ...draft, kind: e.target.value as Workflow['kind'] })}
        >
          <option value="test_login">Test login and broker identity</option>
          <option value="monthly_statement">File monthly PDF statement</option>
        </select>
      </label>
      <p className="text-sm text-muted-foreground">
        Enter selectors from the provider’s approved reporting page. Each account label and broker
        code must identify one visible element.
      </p>
      <div className="grid gap-2 sm:grid-cols-2">
        {(draft.kind === 'test_login' ? selectorFields.slice(0, 6) : selectorFields).map((k) => (
          <label className="grid gap-1 text-sm" key={k}>
            {labels[k]}
            <Input
              required={k !== 'brokerSelect'}
              maxLength={400}
              value={draft.selectors[k]}
              onChange={(e) =>
                setDraft({ ...draft, selectors: { ...draft.selectors, [k]: e.target.value } })
              }
            />
          </label>
        ))}
      </div>
      <Button disabled={busy}>Save workflow</Button>{' '}
      <Button type="button" variant="ghost" onClick={() => setDraft(null)}>
        Cancel
      </Button>
      {error && <p role="alert">{error}</p>}
    </form>
  ) : (
    <div className="space-y-3">
      <Button onClick={create}>Create workflow</Button>
      {flows.map((w) => (
        <div className="flex items-center justify-between border-b py-2" key={w.id}>
          <span>
            {w.name} · {providers[w.provider].name}
          </span>
          <Button variant="outline" onClick={() => setDraft(w)}>
            Edit
          </Button>
        </div>
      ))}
      {!flows.length && <p>Configure a provider workflow before starting a run.</p>}
    </div>
  );
}
