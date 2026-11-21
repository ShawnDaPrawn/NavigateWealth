import { useEffect, useState } from 'react';
import { Input } from '../../ui/input';
import { Button } from '../../ui/button';
import { api } from '../../../utils/api/client';
import { getSetup, ops, options } from './portalApi';
import {
  providers,
  type PortalProfile,
  type Provider,
  type Broker,
} from '../../../shared/broker-operations';

export default function PortalProfileFields({
  profile,
  onChange,
}: {
  profile?: PortalProfile;
  onChange: (next?: PortalProfile) => void;
}) {
  const [directory, setDirectory] = useState<Broker[]>([]),
    [name, setName] = useState(''),
    [error, setError] = useState(''),
    [adding, setAdding] = useState(false);
  const enabled = !!profile;
  useEffect(() => {
    if (enabled)
      getSetup()
        .then((s) => setDirectory(s.brokers))
        .catch(() => setError('Could not load broker directory.'));
  }, [enabled]);
  const field = (
    key: 'expectedIdentity' | 'homeUrl' | 'brokerage' | 'purpose' | 'mfaPrompt',
    title: string,
    required = false,
  ) => (
    <label className="grid gap-1 text-sm">
      {title}
      <Input
        required={required}
        maxLength={key === 'homeUrl' ? 2048 : 160}
        value={profile?.[key] ?? ''}
        onChange={(e) => profile && onChange({ ...profile, [key]: e.target.value })}
      />
    </label>
  );
  return (
    <section className="space-y-3 rounded-lg border p-3">
      <label className="flex items-center gap-2 font-medium">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) =>
            onChange(
              e.target.checked
                ? {
                    provider: 'allan-gray',
                    purpose: '',
                    brokerage: '',
                    expectedIdentity: '',
                    homeUrl: '',
                    mfaPrompt: '',
                    brokers: [],
                  }
                : undefined,
            )
          }
        />
        Use for broker operations
      </label>
      {profile && (
        <>
          <label className="grid gap-1 text-sm">
            Provider
            <select
              value={profile.provider}
              onChange={(e) => onChange({ ...profile, provider: e.target.value as Provider })}
            >
              {Object.entries(providers).map(([id, p]) => (
                <option key={id} value={id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          {field('brokerage', 'Brokerage')}
          {field('purpose', 'Account purpose')}
          {field('homeUrl', 'Portal reporting page URL', true)}
          {field('expectedIdentity', 'Exact signed-in account label', true)}
          {field('mfaPrompt', 'Provider approval instructions')}
          <p className="text-sm font-medium">Linked brokers and provider codes</p>
          {directory.map((b) => {
            const link = profile.brokers.find((row) => row.brokerId === b.id);
            return (
              <div className="flex items-center gap-3" key={b.id}>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={!!link}
                    onChange={(e) =>
                      onChange({
                        ...profile,
                        brokers: e.target.checked
                          ? [...profile.brokers, { brokerId: b.id, code: '' }]
                          : profile.brokers.filter((row) => row.brokerId !== b.id),
                      })
                    }
                  />
                  {b.name}
                </label>
                {link && (
                  <Input
                    aria-label={'Provider code for ' + b.name}
                    required
                    maxLength={80}
                    value={link.code}
                    onChange={(e) =>
                      onChange({
                        ...profile,
                        brokers: profile.brokers.map((row) =>
                          row === link ? { ...row, code: e.target.value } : row,
                        ),
                      })
                    }
                  />
                )}
              </div>
            );
          })}
          <div className="flex gap-2">
            <Input
              aria-label="New broker name"
              placeholder="New broker name"
              maxLength={160}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <Button
              type="button"
              variant="outline"
              disabled={adding || !name.trim()}
              onClick={async () => {
                setAdding(true);
                setError('');
                try {
                  const b = await api.post<Broker>(
                    ops + '/brokers',
                    { name: name.trim() },
                    options,
                  );
                  setDirectory((prev) => [...prev, b]);
                  setName('');
                  onChange({
                    ...profile,
                    brokers: [...profile.brokers, { brokerId: b.id, code: '' }],
                  });
                } catch {
                  setError('Could not create broker.');
                } finally {
                  setAdding(false);
                }
              }}
            >
              Add broker
            </Button>
          </div>
          {error && <p role="alert">{error}</p>}
        </>
      )}
    </section>
  );
}
